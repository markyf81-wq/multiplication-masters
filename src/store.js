import { firebaseConfig } from "../config.js";
import { gameStats } from "./game.js";
import { forgetClassroomAccess } from "./classroom.js";

const KEY = "multiplication-masters-v1";
let memory = { profiles: [], games: [], classes: [], activeId: null };
let hydrated = false;
export const store = {
  configured: !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain && firebaseConfig.appId),
  cloud: null, user: null, teacher: false, localTeacher: false,
  storageAvailable: true, connectionError: null,
};

function read() {
  if (hydrated) return memory;
  hydrated = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && Array.isArray(saved.profiles) && Array.isArray(saved.games) && Array.isArray(saved.classes)) memory = saved;
  } catch { store.storageAvailable = false; }
  return memory;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); }
  catch { store.storageAvailable = false; }
}

function cacheProfile(profile) {
  read();
  memory.profiles = memory.profiles.filter(item => item.id !== profile.id);
  memory.profiles.push(profile);
  write();
  return profile;
}

export async function initialise() {
  read();
  if (store.configured) {
    try {
      store.cloud = await import("./firebase.js");
      store.user = await store.cloud.connect();
      if (store.user) {
        store.teacher = await store.cloud.isTeacher(store.user.uid);
        const profile = store.teacher ? null : await store.cloud.resolveEnrolledStudent(store.user);
        if (profile) {
          cacheProfile(profile);
          const selected = activeProfile();
          if (!selected || !selected.cloud || !store.teacher) setActive(profile.id);
        } else if (!activeProfile()?.cloud) setActive(null);
      } else if (activeProfile()?.cloud) setActive(null);
    } catch (error) {
      store.connectionError = error;
      if (store.user && !store.teacher) {
        await store.cloud.logout();
        store.user = null;
        if (activeProfile()?.cloud) setActive(null);
      }
    }
  }
}

export function activeProfile() {
  return read().profiles.find(item => item.id === memory.activeId) || null;
}

export function setActive(id) { read(); memory.activeId = id; write(); }

export function isTeacher() { return store.teacher || store.localTeacher; }

export function localProfiles() { return read().profiles.filter(profile => !profile.cloud); }

export function useLocalProfile(nickname, className) {
  const normal = value => value.trim().toLowerCase();
  let profile = localProfiles().find(item => normal(item.nickname) === normal(nickname) && normal(item.className) === normal(className));
  if (!profile) {
    profile = { id: `local-${crypto.randomUUID()}`, nickname: nickname.trim(), className: className.trim().toUpperCase(), medals: [], cloud: false };
    cacheProfile(profile);
  }
  setActive(profile.id);
  return profile;
}

export function usePracticeProfile() { return useLocalProfile("Explorer", "Practice"); }

export async function loginGoogle() {
  if (!store.configured) throw new Error("Google sign-in needs the Firebase project connected first. You can play on this device now.");
  if (!store.cloud || store.connectionError) {
    store.cloud = await import("./firebase.js");
    await store.cloud.connect();
  }
  store.user = await store.cloud.login();
  store.connectionError = null;
  store.teacher = false;
  store.localTeacher = false;
  let profile;
  try {
    store.teacher = await store.cloud.isTeacher(store.user.uid);
    profile = store.teacher ? null : await store.cloud.resolveEnrolledStudent(store.user);
  }
  catch (error) {
    await store.cloud.logout();
    store.user = null;
    store.teacher = false;
    if (activeProfile()?.cloud) setActive(null);
    throw error;
  }
  if (profile) { cacheProfile(profile); setActive(profile.id); }
  else setActive(null);
  return profile;
}

export async function logout() {
  if (store.user && store.cloud) await store.cloud.logout();
  store.user = null;
  store.teacher = false;
  store.localTeacher = false;
  forgetClassroomAccess();
  setActive(null);
}

export async function updateProfile(nickname, className) {
  const profile = activeProfile();
  if (!profile) return;
  if (profile.cloud) return cacheProfile(await store.cloud.updateStudent(profile.id, { nickname, className }));
  return cacheProfile({ ...profile, nickname, className });
}

export async function classes() {
  if (store.teacher && store.cloud) return store.cloud.listClasses();
  const names = new Set([...read().classes, ...localProfiles().map(profile => profile.className)]);
  return [...names].filter(Boolean).sort().map(name => ({ id: name, name }));
}

export async function addClass(name, classroomCourseId = null) {
  if (store.teacher && store.cloud) return store.cloud.createClass(name, classroomCourseId);
  read(); memory.classes = [...new Set([...memory.classes, name])]; write();
  return { id: name, name };
}

export async function addStudent(nickname, className, email) {
  if (store.teacher && store.cloud) {
    const profile = await store.cloud.enrolStudent(nickname, className, email);
    return cacheProfile(profile);
  }
  const before = activeProfile()?.id || null;
  const existing = email && localProfiles().find(profile => profile.email === email.toLowerCase());
  let profile;
  if (existing) {
    profile = cacheProfile({ ...existing, classNames: [...new Set([...(existing.classNames || [existing.className]), className])] });
  } else {
    profile = email
      ? cacheProfile({ id: `local-${crypto.randomUUID()}`, nickname, className, medals: [], cloud: false })
      : useLocalProfile(nickname, className);
    profile = cacheProfile({ ...profile, email: email?.toLowerCase() || "", classNames: [className] });
  }
  setActive(before);
  return profile;
}

export async function students(after = null) {
  if (store.teacher && store.cloud) {
    const result = await store.cloud.listStudents(after);
    for (const profile of result.students) cacheProfile(profile);
    return result;
  }
  return { students: localProfiles().sort((a, b) => a.nickname.localeCompare(b.nickname)), more: false, cursor: null };
}

export async function gamesFor(id) {
  const profile = read().profiles.find(item => item.id === id);
  let games = read().games.filter(game => game.studentId === id);
  if (profile?.cloud && store.user && store.cloud) {
    const remote = await store.cloud.getGames(id);
    const combined = new Map(games.map(game => [game.id, game]));
    for (const game of remote) combined.set(game.id, { ...game, cloud: true });
    games = [...combined.values()];
    memory.games = memory.games.filter(game => game.studentId !== id).concat(games);
    write();
  }
  return games.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function cachedGamesFor(id) {
  return read().games.filter(game => game.studentId === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function saveGame(game) {
  const profile = activeProfile();
  const cloud = !!profile?.cloud;
  read();
  const record = { ...game, cloud, synced: !cloud };
  memory.games = memory.games.filter(item => item.id !== game.id).concat(record);
  if (profile) {
    const medals = new Set(profile.medals || []);
    if (gameStats(game).medal) medals.add(game.table);
    memory.profiles = memory.profiles.map(item => item.id === profile.id ? { ...item, medals: [...medals].sort((a, b) => a - b) } : item);
  }
  write();
  if (cloud) {
    const updated = await store.cloud.saveGame(record);
    read();
    memory.games = memory.games.map(item => item.id === record.id ? { ...item, synced: true } : item);
    write();
    cacheProfile(updated);
  }
  return store.storageAvailable;
}

export async function syncPending() {
  if (!store.user || !store.cloud) return 0;
  const pending = read().games.filter(game => game.cloud && !game.synced && (store.teacher || memory.profiles.find(profile => profile.id === game.studentId)?.ownerUid === store.user.uid));
  for (const game of pending) {
    const updated = await store.cloud.saveGame(game);
    read();
    memory.games = memory.games.map(item => item.id === game.id ? { ...item, synced: true } : item);
    write();
    cacheProfile(updated);
  }
  return pending.length;
}

export function getSummary(profile, games = cachedGamesFor(profile.id)) {
  const remote = profile.summary;
  const local = games.reduce((result, game) => {
    const stats = gameStats(game);
    result.games++;
    result.totalCorrect += stats.correct;
    result.totalResponseMs += game.cards.reduce((sum, card) => sum + card.responseMs, 0);
    result.bestScore = Math.max(result.bestScore, game.score);
    return result;
  }, { games: 0, totalCorrect: 0, totalResponseMs: 0, bestScore: 0 });
  const summary = remote && remote.games >= local.games ? remote : local;
  return { ...summary, accuracy: summary.games ? Math.round(summary.totalCorrect / (summary.games * 12) * 100) : 0 };
}
