import { firebaseConfig } from "../config.js";
import { gameStats, GAME_PAGE_SIZE } from "./game.js";

let auth, db, authApi, dataApi;
let approvedTeacherUid = null;
const gameCursors = new WeakMap();

export async function connect() {
  const [appApi, authentication, database] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"),
  ]);
  authApi = authentication;
  dataApi = database;
  const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(firebaseConfig);
  auth = authApi.getAuth(app);
  db = dataApi.getFirestore(app);
  await auth.authStateReady();
  return auth.currentUser;
}

export async function login() {
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await authApi.signInWithPopup(auth, provider)).user;
}

export async function logout() { approvedTeacherUid = null; await authApi.signOut(auth); }

export function signedInAs(uid) { return !!uid && auth?.currentUser?.uid === uid && auth.currentUser.emailVerified; }

function normaliseEmail(address) {
  const email = address.trim().toLowerCase();
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || email.length > 254) throw new Error("Enter a valid Google email address.");
  return email;
}

export async function isTeacher(user) {
  if (!user.email || !user.emailVerified) { approvedTeacherUid = null; return false; }
  const approval = await dataApi.getDocFromServer(dataApi.doc(db, "teachers", normaliseEmail(user.email)));
  const approved = approval.exists() && approval.data().enabled === true;
  approvedTeacherUid = approved ? user.uid : null;
  return approved;
}

export async function listTeachers(after = null) {
  const constraints = [dataApi.orderBy("email")];
  if (after) constraints.push(dataApi.startAfter(after));
  constraints.push(dataApi.limit(100));
  const snapshot = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "teachers"), ...constraints));
  return {
    teachers: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    cursor: snapshot.docs.at(-1) || null, more: snapshot.size === 100,
  };
}

export async function setTeacherAccess(address, enabled) {
  if (!auth.currentUser || approvedTeacherUid !== auth.currentUser.uid) throw new Error("An approved teacher must sign in to manage teacher access.");
  const email = normaliseEmail(address);
  if (email === auth.currentUser.email?.toLowerCase()) throw new Error("You can’t change your own teacher access. Ask another teacher if you need help.");
  const reference = dataApi.doc(db, "teachers", email);
  await dataApi.runTransaction(db, async transaction => {
    const existing = await transaction.get(reference);
    const now = new Date().toISOString();
    if (!existing.exists() && !enabled) throw new Error("This teacher account hasn’t been added yet.");
    if (existing.data()?.deleting) throw new Error("Deletion has started for this teacher. Finish deleting their access first.");
    if (existing.exists() && existing.data().enabled === enabled) return;
    if (existing.exists()) transaction.update(reference, { enabled, updatedAt: now, updatedByUid: auth.currentUser.uid });
    else transaction.set(reference, {
      email, enabled: true, createdAt: now, invitedByUid: auth.currentUser.uid,
      updatedAt: now, updatedByUid: auth.currentUser.uid,
    });
  });
}

export async function getStudent(id) {
  const snapshot = await dataApi.getDocFromServer(dataApi.doc(db, "students", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data(), cloud: true } : null;
}

export function watchStudentAccess(user, studentId, onRevoked) {
  return dataApi.onSnapshot(dataApi.doc(db, "enrolments", normaliseEmail(user.email)), snapshot => {
    if (snapshot.metadata.fromCache) return;
    if (!snapshot.exists() || !snapshot.data().active || snapshot.data().studentId !== studentId) onRevoked();
  }, error => {
    if (["permission-denied", "unauthenticated"].includes(error.code)) onRevoked();
  });
}

function requireApprovedTeacher() {
  if (!auth.currentUser || approvedTeacherUid !== auth.currentUser.uid) throw new Error("Sign in with an approved teacher Google account.");
}

export async function setStudentEnabled(studentId, enabled) {
  requireApprovedTeacher();
  const reference = dataApi.doc(db, "students", studentId);
  return dataApi.runTransaction(db, async transaction => {
    const profile = await transaction.get(reference);
    if (!profile.exists()) throw new Error("This student has already been deleted. Refresh the roster.");
    if (profile.data().deleting) throw new Error("Deletion has started for this student. Finish deleting their records.");
    const enrolmentRef = dataApi.doc(db, "enrolments", profile.data().email);
    const enrolment = await transaction.get(enrolmentRef);
    if (!enrolment.exists() || enrolment.data().studentId !== studentId) throw new Error("This student’s enrolment needs the project administrator’s help.");
    if (profile.data().active !== enabled || enrolment.data().active !== enabled) {
      transaction.update(reference, { active: enabled });
      transaction.update(enrolmentRef, { active: enabled });
    }
    return { id: profile.id, ...profile.data(), active: enabled, cloud: true };
  });
}

export async function deleteStudent(studentId, onProgress = () => {}) {
  requireApprovedTeacher();
  const reference = dataApi.doc(db, "students", studentId);
  // Block access and re-imports before removing history. Keep this marker if interrupted.
  const exists = await dataApi.runTransaction(db, async transaction => {
    const profile = await transaction.get(reference);
    if (!profile.exists()) return false;
    const enrolmentRef = dataApi.doc(db, "enrolments", profile.data().email);
    const enrolment = await transaction.get(enrolmentRef);
    if (enrolment.exists() && enrolment.data().studentId !== studentId) throw new Error("This student’s enrolment needs the project administrator’s help.");
    transaction.update(reference, { active: false, deleting: true });
    if (enrolment.exists()) transaction.update(enrolmentRef, { active: false });
    return true;
  });
  if (!exists) return;
  onProgress("Deleting game results…");
  let removed = 0;
  while (true) {
    // Query the entire history in small batches, rather than the reports' latest 100.
    const games = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(reference, "games"), dataApi.limit(100)));
    if (games.empty) break;
    const batch = dataApi.writeBatch(db);
    games.docs.forEach(game => batch.delete(game.ref));
    await batch.commit();
    removed += games.size;
    onProgress(`${removed} game result${removed === 1 ? "" : "s"} deleted…`);
  }
  onProgress("Deleting student profile and enrolment…");
  await dataApi.runTransaction(db, async transaction => {
    const profile = await transaction.get(reference);
    if (!profile.exists()) return;
    if (!profile.data().deleting || profile.data().active !== false) throw new Error("Deletion could not be confirmed. Please retry.");
    const enrolmentRef = dataApi.doc(db, "enrolments", profile.data().email);
    const enrolment = await transaction.get(enrolmentRef);
    if (enrolment.exists() && enrolment.data().studentId !== studentId) throw new Error("This student’s enrolment needs the project administrator’s help.");
    if (enrolment.exists()) transaction.delete(enrolmentRef);
    transaction.delete(reference);
  });
}

export async function enrolStudent(nickname, className, address) {
  requireApprovedTeacher();
  className = normaliseClassName(className);
  const email = normaliseEmail(address);
  nickname = nickname.trim();
  if (!nickname || nickname.length > 32) throw new Error("Enter a student name up to 32 characters.");
  const enrolmentRef = dataApi.doc(db, "enrolments", email);
  const newId = crypto.randomUUID();
  return dataApi.runTransaction(db, async transaction => {
    const enrolment = await transaction.get(enrolmentRef);
    const studentId = enrolment.exists() ? enrolment.data().studentId : newId;
    const profileRef = dataApi.doc(db, "students", studentId);
    const existing = await transaction.get(profileRef);
    if (className) await requireClassInTransaction(transaction, className);
    if (existing.exists()) {
      // Adding another class must keep the same student, nickname and progress.
      const before = existing.data();
      if (before.deleting) throw new Error("This student’s records are being deleted. Finish the deletion before adding them again.");
      const active = before.active !== false && enrolment.data().active !== false;
      const classNames = [...new Set([...(before.classNames || [before.className]), className].filter(Boolean))];
      if (before.active !== active || classNames.length !== before.classNames?.length || classNames.some((name, index) => name !== before.classNames[index])) {
        transaction.update(profileRef, { active, classNames, className: before.className || classNames[0] || "" });
        transaction.set(enrolmentRef, { email, studentId, active });
      }
      return { id: studentId, ...before, active, classNames, className: before.className || classNames[0] || "", cloud: true };
    } else {
      const profile = {
        nickname, className, classNames: className ? [className] : [], email, ownerUid: null, active: true,
        createdAt: new Date().toISOString(), medals: [], summary: emptySummary(),
      };
      transaction.set(profileRef, profile);
      transaction.set(enrolmentRef, { email, studentId, active: true });
      return { id: studentId, ...profile, cloud: true };
    }
  });
}

export async function resolveEnrolledStudent(user) {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.emailVerified) throw new Error("Please use your verified school Google account.");
  const enrolmentRef = dataApi.doc(db, "enrolments", email);
  return dataApi.runTransaction(db, async transaction => {
    const enrolment = await transaction.get(enrolmentRef);
    if (!enrolment.exists()) throw new Error("Your teacher hasn’t added this Google account to a class yet. Ask your teacher to add you, then sign in again.");
    if (!enrolment.data().active) throw new Error("Your student account is disabled. Ask your teacher for help.");
    const studentId = enrolment.data().studentId;
    const profileRef = dataApi.doc(db, "students", studentId);
    const profile = await transaction.get(profileRef);
    if (!profile.exists()) throw new Error("Your class account needs your teacher’s help before you can sign in.");
    if (profile.data().active === false || profile.data().deleting) throw new Error("Your student account is disabled. Ask your teacher for help.");
    if (profile.data().ownerUid && profile.data().ownerUid !== user.uid) throw new Error("This class account is linked to a different Google identity. Ask your teacher to check it.");
    if (!profile.data().ownerUid) transaction.update(profileRef, { ownerUid: user.uid });
    return { id: studentId, ...profile.data(), ownerUid: user.uid, cloud: true };
  });
}

export function emptySummary() {
  return { games: 0, totalCorrect: 0, totalResponseMs: 0, bestScore: 0, lastPlayed: null };
}

export async function updateStudent(id, changes) {
  await dataApi.updateDoc(dataApi.doc(db, "students", id), changes);
  return getStudent(id);
}

export async function listStudents(after = null) {
  const constraints = [dataApi.orderBy("nickname")];
  if (after) constraints.push(dataApi.startAfter(after));
  constraints.push(dataApi.limit(100));
  const snapshot = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "students"), ...constraints));
  return {
    students: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cloud: true })),
    cursor: snapshot.docs.at(-1) || null, more: snapshot.size === 100,
  };
}

export async function listClasses() {
  const snapshot = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "classes"), dataApi.orderBy("name")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createClass(name) {
  requireApprovedTeacher();
  const id = normaliseClassName(name);
  if (!id) throw new Error("Enter a class name.");
  return dataApi.runTransaction(db, async transaction => {
    const reference = dataApi.doc(db, "classes", id);
    const existing = await transaction.get(reference);
    if (existing.data()?.deleting) throw new Error("This class is being deleted. Finish its deletion first.");
    if (!existing.exists()) transaction.set(reference, { name: id, teacherEmail: null });
    return { id, ...(existing.exists() ? existing.data() : { name: id, teacherEmail: null }) };
  });
}

function normaliseClassName(name) {
  const value = String(name || "").trim().toUpperCase();
  if (value.length > 24 || (value && !/^[A-Z0-9 _-]+$/.test(value))) throw new Error("Use a class name up to 24 letters, numbers, spaces, hyphens or underscores.");
  return value;
}

async function requireClassInTransaction(transaction, name) {
  const snapshot = await transaction.get(dataApi.doc(db, "classes", name));
  if (!snapshot.exists() || snapshot.data().deleting) throw new Error("This class is unavailable. Refresh the classes and choose another.");
  return snapshot;
}

export async function editStudent(id, nickname, className) {
  requireApprovedTeacher();
  nickname = nickname.trim();
  className = normaliseClassName(className);
  if (!nickname || nickname.length > 32) throw new Error("Enter a student name up to 32 characters.");
  return dataApi.runTransaction(db, async transaction => {
    const reference = dataApi.doc(db, "students", id);
    const profile = await transaction.get(reference);
    if (!profile.exists() || profile.data().deleting) throw new Error("This student is unavailable or being deleted.");
    const before = profile.data();
    if (className && className !== before.className) await requireClassInTransaction(transaction, className);
    const changes = { nickname, className, classNames: className === before.className ? before.classNames : className ? [className] : [] };
    if (nickname !== before.nickname || className !== before.className) transaction.update(reference, changes);
    return { id, ...before, ...changes, cloud: true };
  });
}

export async function assignClassTeacher(id, address) {
  requireApprovedTeacher();
  const teacherEmail = address ? normaliseEmail(address) : null;
  return dataApi.runTransaction(db, async transaction => {
    const snapshot = await requireClassInTransaction(transaction, id);
    if ((snapshot.data().teacherEmail || null) === teacherEmail) return;
    if (teacherEmail) {
      const teacher = await transaction.get(dataApi.doc(db, "teachers", teacherEmail));
      if (!teacher.exists() || !teacher.data().enabled || teacher.data().deleting) throw new Error("Choose an enabled teacher. Refresh the teacher list if needed.");
    }
    transaction.update(snapshot.ref, { teacherEmail });
  });
}

export async function deleteTeacher(address, onProgress = () => {}) {
  requireApprovedTeacher();
  const email = normaliseEmail(address);
  if (email === auth.currentUser.email?.toLowerCase()) throw new Error("You can’t delete your own teacher account.");
  const reference = dataApi.doc(db, "teachers", email);
  const exists = await dataApi.runTransaction(db, async transaction => {
    const actor = await transaction.get(dataApi.doc(db, "teachers", normaliseEmail(auth.currentUser.email)));
    const target = await transaction.get(reference);
    if (!actor.exists() || !actor.data().enabled) throw new Error("Your teacher access is no longer enabled.");
    if (!target.exists()) return false;
    transaction.update(reference, { enabled: false, deleting: true, updatedAt: new Date().toISOString(), updatedByUid: auth.currentUser.uid });
    return true;
  });
  if (!exists) return;
  onProgress("Removing class assignments…");
  while (true) {
    const classes = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "classes"), dataApi.where("teacherEmail", "==", email), dataApi.limit(100)));
    if (classes.empty) break;
    for (const item of classes.docs) await dataApi.runTransaction(db, async transaction => {
      const current = await transaction.get(item.ref);
      if (current.exists() && current.data().teacherEmail === email) transaction.update(item.ref, { teacherEmail: null });
    });
  }
  onProgress("Deleting teacher access…");
  await dataApi.runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    if (!current.exists()) return;
    if (!current.data().deleting || current.data().enabled) throw new Error("Teacher deletion could not be confirmed. Refresh and retry.");
    transaction.delete(reference);
  });
}

export async function deleteClass(id, onProgress = () => {}) {
  requireApprovedTeacher();
  const reference = dataApi.doc(db, "classes", id);
  const exists = await dataApi.runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    if (!current.exists()) return false;
    transaction.update(reference, { deleting: true, teacherEmail: null });
    return true;
  });
  if (!exists) return;
  let removed = 0;
  while (true) {
    const students = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "students"), dataApi.where("classNames", "array-contains", id), dataApi.limit(100)));
    if (students.empty) break;
    for (const item of students.docs) {
      await dataApi.runTransaction(db, async transaction => {
        const current = await transaction.get(item.ref);
        if (!current.exists() || !current.data().classNames.includes(id)) return;
        // Class deletion explicitly moves its students to Unassigned, retaining all records.
        transaction.update(item.ref, { className: "", classNames: [] });
      });
      removed++;
      onProgress(`${removed} student${removed === 1 ? "" : "s"} set to Unassigned…`);
    }
  }
  onProgress("Deleting class…");
  await dataApi.runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    if (!current.exists()) return;
    if (!current.data().deleting) throw new Error("Class deletion could not be confirmed. Refresh and retry.");
    transaction.delete(reference);
  });
}

export async function getGames(studentId, { from, until, after = null } = {}) {
  const constraints = [];
  if (from) constraints.push(dataApi.where("startedAt", ">=", from));
  if (until) constraints.push(dataApi.where("startedAt", "<", until));
  constraints.push(dataApi.orderBy("startedAt", "desc"));
  if (after) {
    const cursor = gameCursors.get(after);
    if (!cursor) throw new Error("Refresh the results before loading older games.");
    constraints.push(dataApi.startAfter(cursor));
  }
  constraints.push(dataApi.limit(GAME_PAGE_SIZE));
  const snapshot = await dataApi.getDocsFromServer(dataApi.query(dataApi.collection(db, "students", studentId, "games"), ...constraints));
  return snapshot.docs.map(doc => {
    const game = { ...doc.data(), id: doc.id, synced: true };
    gameCursors.set(game, doc);
    return game;
  });
}

export async function saveFirstRound(game) {
  if (!game.firstRound) throw new Error("Answer all 12 flashcards before saving the first round.");
  const reference = dataApi.doc(db, "students", game.studentId, "games", game.id);
  const { synced, cloud, ...record } = structuredClone(game);
  record.phase = "first-round-complete";
  record.index = 0;
  record.completedAt = null;
  record.quiz = null;
  // Legacy fields required by the deployed schema; unused by the game and reports.
  record.score = record.firstRound.gotIt * 5;
  await dataApi.runTransaction(db, async transaction => {
    const existing = await transaction.get(reference);
    if (existing.exists()) return;
    transaction.set(reference, record);
  });
}

export async function saveGame(game) {
  const profileRef = dataApi.doc(db, "students", game.studentId);
  const gameRef = dataApi.doc(db, "students", game.studentId, "games", game.id);
  const { synced, cloud, ...record } = game;
  record.score = 0; // Compatibility with the deployed schema; scoring has been removed.
  const updated = await dataApi.runTransaction(db, async transaction => {
    // Replaying a pending save after a connection failure never counts twice.
    const existing = await transaction.get(gameRef);
    const profile = await transaction.get(profileRef);
    if (!profile.exists()) throw new Error("The student account could not be found.");
    if (existing.exists() && existing.data().phase === "complete") return { id: game.studentId, ...profile.data(), cloud: true };
    // The first-round snapshot stays fixed when the same game record is completed.
    if (existing.exists()) record.firstRound = existing.data().firstRound;
    const stats = gameStats(record);
    const before = profile.data();
    const summary = { ...emptySummary(), ...before.summary };
    transaction.set(gameRef, record);
    const changes = {
      summary: {
        games: summary.games + 1,
        totalCorrect: summary.totalCorrect + stats.correct,
        totalResponseMs: summary.totalResponseMs + game.cards.reduce((sum, card) => sum + card.responseMs, 0),
        bestScore: summary.bestScore, // Retain the legacy field without calculating scores.
        lastPlayed: !summary.lastPlayed || game.completedAt > summary.lastPlayed ? game.completedAt : summary.lastPlayed,
      },
      medals: [...new Set([...(before.medals || []), ...(stats.medal ? [game.table] : [])])].sort((a, b) => a - b),
    };
    transaction.update(profileRef, changes);
    return { id: game.studentId, ...before, ...changes, cloud: true };
  });
  return updated;
}
