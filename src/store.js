import { firebaseConfig } from "../config.js";
import { gameStats, GAME_PAGE_SIZE } from "./game.js";

// Records are persisted only in Firestore. This cache lasts for this page session.
const memory = { profiles: [], games: [], activeId: null, reads: new Map(), history: new Map() };
const READ_TTL = 2 * 60 * 1000;
let stopAccessWatch = null;
export const store = {
  configured: !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain && firebaseConfig.appId),
  cloud: null, user: null, teacher: false, connectionError: null, onAccessRevoked: null,
};

function cacheProfile(profile) {
  memory.profiles = memory.profiles.filter(item => item.id !== profile.id);
  memory.profiles.push(profile);
  return profile;
}

function invalidateReads(prefix) {
  for (const key of memory.reads.keys()) if (key.startsWith(prefix)) memory.reads.delete(key);
}

async function cachedRead(key, loader, refresh = false) {
  const uid = store.user?.uid;
  let entry = memory.reads.get(key);
  if (!entry || (!entry.pending && (refresh || Date.now() - entry.time >= READ_TTL))) {
    entry = { time: Date.now(), pending: true };
    memory.reads.set(key, entry);
    entry.promise = Promise.resolve().then(loader).then(value => {
      entry.pending = false;
      entry.time = Date.now();
      entry.value = value;
      return value;
    }).catch(error => {
      if (memory.reads.get(key) === entry) memory.reads.delete(key);
      throw error;
    });
    if (memory.reads.size > 256) {
      const oldest = [...memory.reads].find(([, item]) => !item.pending);
      if (oldest) memory.reads.delete(oldest[0]);
    }
  }
  const value = await entry.promise;
  if (!uid || store.user?.uid !== uid) throw new Error("The account changed. Sign in again to view results.");
  return value;
}

function invalidateGames(id) {
  invalidateReads(`games:${id}:`);
  memory.history.delete(id);
}

function watchAccess(profile) {
  stopAccessWatch?.();
  const user = store.user;
  stopAccessWatch = store.cloud.watchStudentAccess(user, profile.id, () => {
    if (store.user?.uid !== user.uid || memory.activeId !== profile.id) return;
    void logout().catch(() => {}).finally(() => store.onAccessRevoked?.());
  });
}

export async function initialise() {
  setActive(null);
  if (store.configured) {
    try {
      store.cloud = await import("./firebase.js");
      store.user = await store.cloud.connect();
      if (store.user) {
        store.teacher = await store.cloud.isTeacher(store.user);
        const profile = store.teacher ? null : await store.cloud.resolveEnrolledStudent(store.user);
        if (profile) {
          cacheProfile(profile);
          setActive(profile.id);
          watchAccess(profile);
        }
      }
    } catch (error) {
      store.connectionError = error;
      if (store.user && !store.teacher) {
        await store.cloud.logout();
        store.user = null;
        setActive(null);
      }
    }
  }
}

export function activeProfile() {
  const profile = memory.profiles.find(item => item.id === memory.activeId);
  return store.user?.emailVerified && store.cloud?.signedInAs(store.user.uid) && !store.teacher && profile?.cloud && profile.ownerUid === store.user.uid && profile.active !== false && !profile.deleting ? profile : null;
}

function setActive(id) { memory.activeId = id; }

export function isTeacher() { return store.teacher; }

function requireTeacher() {
  if (!store.teacher || !store.user || !store.cloud) throw new Error("Sign in with an approved teacher Google account.");
}

export async function loginGoogle() {
  if (!store.configured) throw new Error("Google sign-in is not configured. Contact your teacher.");
  if (!store.cloud || store.connectionError) {
    store.cloud = await import("./firebase.js");
    await store.cloud.connect();
  }
  const previousProfile = activeProfile();
  stopAccessWatch?.();
  stopAccessWatch = null;
  try { store.user = await store.cloud.login(); }
  catch (error) { if (previousProfile && activeProfile()) watchAccess(previousProfile); throw error; }
  memory.profiles = [];
  memory.games = [];
  memory.reads.clear();
  memory.history.clear();
  setActive(null);
  store.connectionError = null;
  store.teacher = false;
  let profile;
  try {
    store.teacher = await store.cloud.isTeacher(store.user);
    profile = store.teacher ? null : await store.cloud.resolveEnrolledStudent(store.user);
  }
  catch (error) {
    await store.cloud.logout();
    store.user = null;
    store.teacher = false;
    setActive(null);
    throw error;
  }
  if (profile) { cacheProfile(profile); setActive(profile.id); watchAccess(profile); }
  else setActive(null);
  return profile;
}

export async function logout() {
  stopAccessWatch?.();
  stopAccessWatch = null;
  const signedIn = store.user && store.cloud;
  store.user = null;
  store.teacher = false;
  memory.profiles = [];
  memory.games = [];
  memory.reads.clear();
  memory.history.clear();
  setActive(null);
  if (signedIn) await store.cloud.logout();
}

export async function classes() {
  requireTeacher();
  return [...await cachedRead("classes", () => store.cloud.listClasses())];
}

export async function addClass(name) {
  requireTeacher();
  const existing = memory.reads.get("classes");
  const normalised = name.trim().toUpperCase();
  const saved = existing?.value?.find(item => item.name === normalised);
  if (saved?.deleting) throw new Error("This class is being deleted. Finish its deletion first.");
  if (saved && Date.now() - existing.time < READ_TTL) return saved;
  const created = await store.cloud.createClass(name);
  invalidateReads("classes");
  return created;
}

export async function addStudent(nickname, className, email) {
  requireTeacher();
  const profile = await store.cloud.enrolStudent(nickname, className, email);
  invalidateReads("students:");
  return cacheProfile(profile);
}

export async function students(after = null) {
  requireTeacher();
  const result = await cachedRead(`students:${after?.id || "first"}`, () => store.cloud.listStudents(after));
  for (const profile of result.students) cacheProfile(profile);
  return { ...result, students: [...result.students] };
}

export function refreshTeacherData() {
  requireTeacher();
  invalidateReads("students:");
  invalidateReads("teachers:");
  invalidateReads("classes");
}

export async function editStudent(id, nickname, className) {
  requireTeacher();
  const profile = await store.cloud.editStudent(id, nickname, className);
  invalidateReads("students:");
  return cacheProfile(profile);
}

export async function assignClassTeacher(id, email) {
  requireTeacher();
  await store.cloud.assignClassTeacher(id, email);
  invalidateReads("classes");
}

export async function deleteTeacher(email, onProgress) {
  requireTeacher();
  try { await store.cloud.deleteTeacher(email, onProgress); }
  finally { invalidateReads("teachers:"); invalidateReads("classes"); }
}

export async function deleteClass(id, onProgress) {
  requireTeacher();
  try { await store.cloud.deleteClass(id, onProgress); }
  finally { invalidateReads("students:"); invalidateReads("classes"); }
}

export async function setStudentEnabled(id, enabled) {
  requireTeacher();
  const profile = await store.cloud.setStudentEnabled(id, enabled);
  invalidateReads("students:");
  return cacheProfile(profile);
}

export async function deleteStudent(id, onProgress) {
  requireTeacher();
  try { await store.cloud.deleteStudent(id, onProgress); }
  finally { invalidateReads("students:"); invalidateGames(id); }
  memory.profiles = memory.profiles.filter(profile => profile.id !== id);
  memory.games = memory.games.filter(game => game.studentId !== id);
  if (memory.activeId === id) setActive(null);
}

export async function teachers(after = null) {
  if (!store.teacher || !store.cloud) throw new Error("Sign in with an approved teacher Google account to manage teachers.");
  const result = await cachedRead(`teachers:${after?.id || "first"}`, () => store.cloud.listTeachers(after));
  return { ...result, teachers: [...result.teachers] };
}

export async function setTeacherAccess(email, enabled) {
  if (!store.teacher || !store.cloud) throw new Error("Sign in with an approved teacher Google account to manage teachers.");
  await store.cloud.setTeacherAccess(email, enabled);
  invalidateReads("teachers:");
}

function requireStudentResults(id) {
  if (!store.user || !store.cloud || (!isTeacher() && activeProfile()?.id !== id)) throw new Error("Sign in to view student results.");
}

async function gamePage(id, range = {}, refresh = false) {
  const key = `games:${id}:${range.from || ""}:${range.until || ""}:${range.after?.startedAt || ""}:${range.after?.id || ""}`;
  return cachedRead(key, () => store.cloud.getGames(id, range), refresh);
}

export function hasMoreGames(id) { return memory.history.get(id)?.more === true; }

export async function gamesFor(id, { loadMore = false, refresh = false } = {}) {
  requireStudentResults(id);
  let history = memory.history.get(id);
  if (history?.pending) return history.pending;
  if (!refresh && !loadMore && history && Date.now() - history.time < READ_TTL) return [...history.games];
  if (loadMore && history && !history.more) return [...history.games];
  const previous = loadMore && history ? history.games : [];
  history = { games: previous, more: true, time: Date.now() };
  memory.history.set(id, history);
  const request = (async () => {
    const games = await gamePage(id, { after: previous.at(-1) || null }, refresh);
    history.games = [...new Map([...previous, ...games].map(game => [game.id, game])).values()];
    history.more = games.length === GAME_PAGE_SIZE;
    history.time = Date.now();
    if (memory.history.get(id) === history) {
      memory.games = memory.games.filter(game => game.studentId !== id).concat(history.games);
    }
    return [...history.games];
  })();
  history.pending = request;
  try { return await request; }
  catch (error) {
    if (memory.history.get(id) === history) {
      if (previous.length) memory.history.set(id, { games: previous, more: true, time: Date.now() });
      else memory.history.delete(id);
    }
    throw error;
  }
  finally { history.pending = null; }
}

export async function reportGamesFor(id, range, { refresh = false } = {}) {
  requireTeacher();
  return gamePage(id, range, refresh);
}

export async function saveGame(game) {
  const profile = activeProfile();
  if (!profile || game.studentId !== profile.id) throw new Error("Sign in with your student Google account to record a game.");
  const updated = await store.cloud.saveGame(game);
  invalidateGames(game.studentId);
  invalidateReads("students:");
  cacheProfile(updated);
  memory.games = memory.games.filter(item => item.id !== game.id).concat({ ...game, synced: true });
}

export async function saveFirstRound(game) {
  const profile = activeProfile();
  if (!profile || game.studentId !== profile.id) throw new Error("Sign in with your student Google account to save the first round.");
  await store.cloud.saveFirstRound(game);
  invalidateGames(game.studentId);
}

export function getSummary(profile, games = memory.games.filter(game => game.studentId === profile.id)) {
  const remote = profile.summary;
  const loaded = games.filter(game => game.phase === "complete").reduce((result, game) => {
    const stats = gameStats(game);
    result.games++;
    result.totalCorrect += stats.correct;
    result.totalResponseMs += game.cards.reduce((sum, card) => sum + card.responseMs, 0);
    return result;
  }, { games: 0, totalCorrect: 0, totalResponseMs: 0 });
  const summary = remote && remote.games >= loaded.games ? remote : loaded;
  return { ...summary, accuracy: summary.games ? Math.round(summary.totalCorrect / (summary.games * 12) * 100) : 0 };
}
