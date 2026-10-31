import { firebaseConfig } from "../config.js";
import { gameStats } from "./game.js";

let auth, db, authApi, dataApi;
let approvedTeacherUid = null;

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

export async function classroomAccessToken() {
  if (!auth.currentUser || approvedTeacherUid !== auth.currentUser.uid) throw new Error("An approved teacher must sign in before importing a class.");
  const provider = new authApi.GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/classroom.courses.readonly");
  provider.addScope("https://www.googleapis.com/auth/classroom.rosters.readonly");
  provider.addScope("https://www.googleapis.com/auth/classroom.profile.emails");
  const result = await authApi.reauthenticateWithPopup(auth.currentUser, provider);
  const token = authApi.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error("Google Classroom access wasn’t granted. Your teacher account needs permission to read class rosters.");
  return token;
}

export async function logout() { approvedTeacherUid = null; await authApi.signOut(auth); }

export async function isTeacher(uid) {
  const approval = await dataApi.getDoc(dataApi.doc(db, "teachers", uid));
  const approved = approval.exists() && approval.data().enabled === true;
  approvedTeacherUid = approved ? uid : null;
  return approved;
}

export async function getStudent(id) {
  const snapshot = await dataApi.getDoc(dataApi.doc(db, "students", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data(), cloud: true } : null;
}

export async function enrolStudent(nickname, className, address) {
  const email = address.trim().toLowerCase();
  if (!email || !email.includes("@") || email.includes("/") || email.length > 254) throw new Error("Enter the student’s school Google email address.");
  const enrolmentRef = dataApi.doc(db, "enrolments", email);
  const newId = crypto.randomUUID();
  let studentId;
  await dataApi.runTransaction(db, async transaction => {
    const enrolment = await transaction.get(enrolmentRef);
    studentId = enrolment.exists() ? enrolment.data().studentId : newId;
    const profileRef = dataApi.doc(db, "students", studentId);
    const existing = await transaction.get(profileRef);
    if (existing.exists()) {
      // Adding another class must keep the same student, nickname and progress.
      const before = existing.data();
      transaction.update(profileRef, { classNames: [...new Set([...(before.classNames || [before.className]), className])] });
    } else {
      transaction.set(profileRef, {
        nickname, className, classNames: [className], email, ownerUid: null,
        createdAt: new Date().toISOString(), medals: [], summary: emptySummary(),
      });
    }
    transaction.set(enrolmentRef, { email, studentId, active: true });
  });
  return getStudent(studentId);
}

export async function resolveEnrolledStudent(user) {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.emailVerified) throw new Error("Please use your verified school Google account.");
  const enrolmentRef = dataApi.doc(db, "enrolments", email);
  let studentId;
  await dataApi.runTransaction(db, async transaction => {
    const enrolment = await transaction.get(enrolmentRef);
    if (!enrolment.exists() || !enrolment.data().active) throw new Error("Your teacher hasn’t added this Google account to a class yet. Ask your teacher to add you, then sign in again.");
    studentId = enrolment.data().studentId;
    const profileRef = dataApi.doc(db, "students", studentId);
    const profile = await transaction.get(profileRef);
    if (!profile.exists()) throw new Error("Your class account needs your teacher’s help before you can sign in.");
    if (profile.data().ownerUid && profile.data().ownerUid !== user.uid) throw new Error("This class account is linked to a different Google identity. Ask your teacher to check it.");
    if (!profile.data().ownerUid) transaction.update(profileRef, { ownerUid: user.uid });
  });
  return getStudent(studentId);
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
  const snapshot = await dataApi.getDocs(dataApi.query(dataApi.collection(db, "students"), ...constraints));
  return {
    students: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cloud: true })),
    cursor: snapshot.docs.at(-1) || null, more: snapshot.size === 100,
  };
}

export async function listClasses() {
  const snapshot = await dataApi.getDocs(dataApi.query(dataApi.collection(db, "classes"), dataApi.orderBy("name")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createClass(name, classroomCourseId = null) {
  const id = name.trim().toUpperCase();
  const changes = { name: id };
  if (classroomCourseId) changes.classroomCourseId = classroomCourseId;
  await dataApi.setDoc(dataApi.doc(db, "classes", id), changes, { merge: true });
  return { id, name: id };
}

export async function getGames(studentId) {
  const snapshot = await dataApi.getDocs(dataApi.query(
    dataApi.collection(db, "students", studentId, "games"),
    dataApi.orderBy("startedAt", "desc"), dataApi.limit(100),
  ));
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, synced: true }));
}

export async function saveGame(game) {
  const profileRef = dataApi.doc(db, "students", game.studentId);
  const gameRef = dataApi.doc(db, "students", game.studentId, "games", game.id);
  const { synced, cloud, ...record } = game;
  await dataApi.runTransaction(db, async transaction => {
    // Replaying a pending save after a connection failure never counts twice.
    const existing = await transaction.get(gameRef);
    if (existing.exists()) return;
    const profile = await transaction.get(profileRef);
    if (!profile.exists()) throw new Error("The student account could not be found.");
    const stats = gameStats(game);
    const before = profile.data();
    const summary = { ...emptySummary(), ...before.summary };
    transaction.set(gameRef, record);
    transaction.update(profileRef, {
      summary: {
        games: summary.games + 1,
        totalCorrect: summary.totalCorrect + stats.correct,
        totalResponseMs: summary.totalResponseMs + game.cards.reduce((sum, card) => sum + card.responseMs, 0),
        bestScore: Math.max(summary.bestScore, game.score),
        lastPlayed: !summary.lastPlayed || game.completedAt > summary.lastPlayed ? game.completedAt : summary.lastPlayed,
      },
      medals: [...new Set([...(before.medals || []), ...(stats.medal ? [game.table] : [])])].sort((a, b) => a - b),
    });
  });
  return getStudent(game.studentId);
}
