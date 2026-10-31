import { TABLES, newGame, currentCard, markFlash, markRetry, startQuiz, markQuiz, finishGame, gameStats } from "./game.js";
import * as data from "./store.js";
import { renderReadme } from "./guide.js";
import { parseStudentRows } from "./student-import.js";
import { renderTeacherResults } from "./results.js";
import { medalArt, medalFor } from "./medals.js";
import { publicAppUrl } from "../config.js";
import { mountClassAdmin } from "./class-admin.js";
import { classNamesFor, classLabel, matchesClass, UNASSIGNED_CLASS, classOptionLabel } from "./student-profile.js";

const main = document.querySelector("#main");
const accountDialog = document.querySelector("#account-dialog");
const confirmDialog = document.querySelector("#confirm-dialog");
const studentImportDialog = document.querySelector("#student-import-dialog");
const teacherAccessDialog = document.querySelector("#teacher-access-dialog");
const studentManageDialog = document.querySelector("#student-manage-dialog");
const state = {
  route: "play", table: 6, game: null, stage: "intro", locked: false, adminBusy: false, classRecords: [],
  cardStarted: 0, quizStarted: 0, deadline: 0, frame: 0,
  timers: new Set(), renderId: 0, targetRoute: null, detailProfile: null,
  teacherStudents: [], teacherCursor: null, teacherMore: false,
  filter: "", classFilter: "", saving: false, saveError: null,
  firstRoundSaving: false, firstRoundSaved: false, firstRoundError: null, firstRoundPromise: null,
  importing: false, teacherClasses: [], importBatch: null, importDraft: null, importPreview: null,
  teacherAccounts: [], teacherAccountCursor: null, teacherAccountMore: false,
  teacherAccountError: null, pendingTeacherAccess: null, changingTeacherAccess: false,
  pendingStudentAction: null, changingStudent: false, detailReturnRoute: "teacher",
};

const icons = {
  chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/></svg>',
  medal: '<svg viewBox="0 0 48 56"><path d="m12 31-3 22 15-8 15 8-3-22" fill="#c0b2ed"/><circle cx="24" cy="22" r="19" fill="#f5cf77" stroke="#d8a847" stroke-width="2"/><circle cx="24" cy="22" r="14" fill="none" stroke="#fff4cd" stroke-width="2"/><path d="m24 12 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#fff8df"/></svg>',
  trophy: '<svg viewBox="0 0 100 108"><path d="M27 15H10v14c0 16 13 24 26 24m37-38h17v14c0 16-13 24-26 24" fill="none" stroke="#dfa947" stroke-width="7"/><path d="M26 9h48v26c0 15-10 27-24 27S26 50 26 35Z" fill="#f5cf77"/><path d="M38 17v19c0 8 4 14 8 16" fill="none" stroke="#fff0bb" stroke-width="6" stroke-linecap="round"/><path d="M45 60h10v25H45Z" fill="#dfa947"/><path d="M32 84h36v13H32Z" fill="#f5cf77"/><path d="M25 96h50v8H25Z" fill="#6850c8"/></svg>',
};
const icon = name => `<span class="icon" aria-hidden="true">${icons[name] || ""}</span>`;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const seconds = milliseconds => `${(milliseconds / 1000).toFixed(1)}s`;
const dateTimeLabel = value => new Date(value).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateLabel = value => value ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Not played yet";
const medalCount = profile => profile?.medals?.length || 0;
const delay = (callback, milliseconds) => {
  const timer = setTimeout(() => { state.timers.delete(timer); callback(); }, milliseconds);
  state.timers.add(timer);
  return timer;
};

function stopTimers() {
  cancelAnimationFrame(state.frame);
  for (const timer of state.timers) clearTimeout(timer);
  state.timers.clear();
}

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 5500);
}

function errorMessage(error) {
  if (error?.code === "auth/popup-closed-by-user") return "Sign-in was closed. You can try again whenever you’re ready.";
  if (error?.code === "auth/popup-blocked") return "Please allow the Google sign-in popup, then try again.";
  if (error?.code === "permission-denied") return data.isTeacher()
    ? "The database denied this action. The project administrator needs to check your teacher access and publish the latest Firestore rules."
    : "Access isn’t available for this account. Your teacher can help check the account setup.";
  if (error?.code === "auth/unauthorized-domain") return "This website’s address needs to be added to Firebase’s authorised domains.";
  return error?.message || "Something didn’t connect. Please try again.";
}

function updateHeader() {
  const profile = data.activeProfile();
  document.querySelector("#profile-label").textContent = profile?.nickname || (data.store.teacher ? "Teacher account" : "Sign in");
  document.querySelector(".profile-button .avatar").textContent = profile ? profile.nickname[0].toUpperCase() : "✦";
  document.querySelector("#teacher-nav").hidden = !data.isTeacher();
  document.querySelector("#results-nav").hidden = !data.isTeacher();
  document.querySelectorAll("[data-student-nav]").forEach(link => { link.hidden = data.isTeacher(); });
  document.querySelector("a.brand").href = data.isTeacher() ? "#teacher" : "#play";
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = link.dataset.route === state.route
      || (state.route === "game" && link.dataset.route === "play")
      || (state.route === "guide" && link.dataset.route === "teacher")
      || (data.isTeacher() && state.route === "progress" && link.dataset.route === state.detailReturnRoute);
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.body.classList.toggle("playing", state.route === "game");
}

function navigate(route, { force = false, keepDetail = false } = {}) {
  if (data.isTeacher() && ["play", "medals", "game"].includes(route)) route = "teacher";
  if (data.isTeacher() && route === "progress" && (!keepDetail || !state.detailProfile)) route = "results";
  if (state.game && state.stage !== "complete" && state.route === "game" && route !== "game" && !force) {
    state.targetRoute = route;
    confirmDialog.querySelector("p").textContent = state.firstRoundSaved
      ? "First-round results are saved. The rest of this game will be discarded."
      : state.firstRoundSaving ? "The first-round save is still pending. Keep the game open to confirm it." : "This unfinished game won’t be saved.";
    confirmDialog.showModal();
    return;
  }
  if (route !== "game") { stopTimers(); state.game = null; }
  if (!keepDetail) state.detailProfile = null;
  state.route = ["play", "progress", "medals", "teacher", "results", "game", "guide"].includes(route) ? route : data.isTeacher() ? "teacher" : "play";
  history.replaceState(null, "", `#${state.route}`);
  render();
}

async function render() {
  const renderId = ++state.renderId;
  updateHeader();
  main.removeAttribute("aria-busy");
  if (state.route === "game" && state.game) { renderGame(); return; }
  if (state.route === "medals") { renderMedals(); return; }
  if (state.route === "teacher") { await renderTeacher(renderId); return; }
  if (state.route === "results") {
    await renderTeacherResults({ container: main, data, isCurrent: () => state.renderId === renderId && data.isTeacher(), errorMessage,
      openStudent: profile => { state.detailProfile = profile; state.detailReturnRoute = "results"; navigate("progress", { keepDetail: true }); },
    });
    return;
  }
  if (state.route === "progress") { await renderProgress(renderId); return; }
  if (state.route === "guide") { await renderGuide(renderId); return; }
  renderHome();
}

function renderHome() {
  const profile = data.activeProfile();
  const summary = profile ? data.getSummary(profile) : { games: 0 };
  main.innerHTML = `
    <section class="page-heading play-heading"><div><h1>Pick your <span>times table!</span></h1><p class="muted">12 cards. 5 seconds per answer.</p></div><span class="heading-character" aria-hidden="true">${medalArt(state.table, false)}</span></section>
    ${profile ? homeMedals(profile) : ""}
    ${!profile ? `<section class="notice">${data.store.teacher ? 'You are signed in as a teacher. Switch to a student Google account to play.' : 'Sign in with your student Google account to play. Your teacher must add your account first.'}<button class="button" type="button" data-action="account">${data.store.user ? "Switch account" : "Sign in with Google"}</button></section>` : ""}
    <section class="play-layout" id="table-picker" aria-labelledby="table-heading">
      <div class="table-panel"><div class="section-heading"><h2 id="table-heading">Choose a times table</h2></div>
        <div class="table-grid" role="group" aria-label="Choose a times table">${TABLES.map(table => {
          const earned = !!profile?.medals?.includes(table);
          const medal = medalFor(table);
          return `<button class="table-tile ${state.table === table ? "selected" : ""}" type="button" data-table="${table}" aria-pressed="${state.table === table}" aria-label="${table} times table, ${esc(medal.name)}${earned ? ", medal earned" : ""}" style="--tile-colour:${medal.colour};--tile-accent:${medal.accent}"><span class="tile-character" aria-hidden="true">${medalArt(table, earned)}</span><strong>${table}<span>×</span></strong>${earned ? `<span class="tile-caption" aria-hidden="true">${icon("check")}</span>` : ""}</button>`;
        }).join("")}</div>
        <div class="start-row"><span>5-second countdown before the first card</span><button class="button" type="button" data-action="${profile ? "prepare-game" : "account"}">${profile ? `Start game · ${state.table}×` : "Sign in to play"} ${icon("arrow")}</button></div>
      </div>
      <aside class="side-column"><section class="medal-preview" style="--medal-colour:${medalFor(state.table).colour}"><span class="medal-preview-art" aria-hidden="true">${medalArt(state.table)}</span><div><span class="tiny-chip">${state.table}× medal</span><h2>${esc(medalFor(state.table).name)}</h2><p>${profile?.medals?.includes(state.table) ? "Collected!" : "12/12, then pass the quiz."}</p></div></section>${profile ? `<section class="journey-card"><h2>My progress</h2><div class="journey-stats"><div><strong>${summary.games}</strong><span>games</span></div><div><strong>${medalCount(profile)}<small>/12</small></strong><span>medals</span></div></div><a class="text-link" href="#progress" data-link="progress">View results ${icon("arrow")}</a></section>` : ""}
      </aside>
    </section>`;
}

function homeMedals(profile) {
  return `<section class="home-medals" aria-labelledby="home-medals-heading"><div class="home-medals-heading"><div><h2 id="home-medals-heading">My medals</h2><strong>${medalCount(profile)}<small> /12</small></strong></div><a class="text-link" href="#medals" data-link="medals">View medals ${icon("arrow")}</a></div><div class="home-medal-strip">${TABLES.map(table => {
    const earned = profile.medals?.includes(table);
    const medal = medalFor(table);
    return `<button class="home-medal ${earned ? "earned" : "locked"}" type="button" data-link="medals" title="${table}× · ${esc(medal.name)}${earned ? " · Collected" : " · To collect"}" aria-label="${table} times table, ${esc(medal.name)}, ${earned ? "medal earned" : "not earned yet"}">${earned ? medalArt(table) : `<span>${table}×</span>`}</button>`;
  }).join("")}</div></section>`;
}

function medalShelf(profile, compact = false) {
  return `<div class="medal-grid ${compact ? "compact" : ""}">${TABLES.map(table => {
    const earned = profile?.medals?.includes(table);
    return `<div class="medal-item ${earned ? "earned" : "unearned"}" style="--medal-colour:${medalFor(table).colour}"><span class="medal-drawing" aria-hidden="true">${medalArt(table)}</span><strong>${table}×</strong><h3>${esc(medalFor(table).name)}</h3><span>${earned ? "Collected ✓" : "To collect"}</span></div>`;
  }).join("")}</div>`;
}

function renderMedals() {
  const profile = data.activeProfile();
  if (!profile) { main.innerHTML = '<section class="empty-state"><h1>My medals</h1><p>Sign in with your student Google account to view medals.</p><button class="button" type="button" data-action="account">Sign in</button></section>'; return; }
  const complete = medalCount(profile) === 12;
  main.innerHTML = `<section class="page-heading"><h1>My medal collection</h1><p>Get 12/12 flashcards correct, then at least 19/20 in the quiz.</p></section><section class="panel medal-panel"><h2>${medalCount(profile)} of 12 medals</h2>${medalShelf(profile)}<div class="trophy-panel ${complete ? "earned" : ""}"><span class="trophy-drawing" aria-hidden="true">${icons.trophy}</span><div><h2>${complete ? "Trophy earned" : "Trophy"}</h2><p>Earn all 12 medals to complete the game.</p></div><strong>${medalCount(profile)} / 12</strong></div><button class="button" type="button" data-link="play">Choose a table</button></section>`;
}

function loadingPage(title) {
  main.innerHTML = `<section class="page-heading"><h1>${title}</h1><p class="muted" role="status">Loading…</p></section>`;
  main.setAttribute("aria-busy", "true");
}

async function renderProgress(renderId) {
  const profile = state.detailProfile || data.activeProfile();
  if (!profile) {
    main.innerHTML = `<section class="empty-state"><h1>My progress</h1><p>Sign in with your student Google account to view results.</p><button class="button" type="button" data-action="account">Sign in</button></section>`;
    return;
  }
  loadingPage(state.detailProfile ? "Student results" : "My progress");
  let games;
  try { games = await data.gamesFor(profile.id); }
  catch (error) {
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="empty-state"><h1>Results unavailable</h1><p>${esc(errorMessage(error))}</p><button class="button" type="button" data-action="reload-progress">Try again</button></section>`;
    return;
  }
  if (renderId !== state.renderId) return;
  main.removeAttribute("aria-busy");
  const summary = data.getSummary(profile, games);
  const lastGames = games.slice(0, 12).reverse();
  main.innerHTML = `<section class="page-heading">${state.detailProfile ? `<button class="text-link" type="button" data-link="${state.detailReturnRoute}">← Back to ${state.detailReturnRoute === "results" ? "results" : "students"}</button>` : ""}<h1>${state.detailProfile ? `${esc(profile.nickname)}’s progress` : "My progress"}</h1><p class="muted">${esc(classLabel(profile))} <span class="dot-separator">·</span> Results and response times.</p></section>
    <section class="summary-grid" aria-label="Performance summary">${summaryCard("Games played", summary.games, "Completed games", "chart")}${summaryCard("First-try accuracy", summary.games ? `${summary.accuracy}%` : "—", "Across the flashcard rounds", "check")}${summaryCard("First rounds", games.length, "Available recent games", "chart")}${summaryCard("Tables mastered", `${medalCount(profile)}<small>/12</small>`, "Medals earned in the quiz", "medal")}</section>
    <section class="panel chart-panel"><div class="section-heading"><h2>Recent first rounds</h2><span class="small muted">Got it out of 12</span></div>${lastGames.length ? `<div class="round-chart" role="img" aria-label="Recent first rounds: ${lastGames.map(game => `${game.table} times table, ${gameStats(game).correct} Got it out of 12 on ${dateLabel(game.startedAt)}`).join("; ")}"><div class="chart-scale"><span>12</span><span>6</span><span>0</span></div><div class="chart-bars">${lastGames.map(game => `<div class="chart-column"><span class="bar-value">${gameStats(game).correct}</span><div class="bar-space"><span class="chart-bar" style="height:${gameStats(game).correct / 12 * 100}%"></span></div><span class="bar-label">${game.table}×</span></div>`).join("")}</div></div>` : '<div class="chart-empty">No games recorded.</div>'}</section>
    <section class="panel table-performance"><div class="section-heading"><h2>Accuracy by table</h2><span class="small muted">First-try accuracy by table</span></div><div class="table-tracks">${TABLES.map(table => {
      const attempts = games.filter(game => game.table === table);
      const accuracy = attempts.length ? Math.round(attempts.reduce((sum, game) => sum + gameStats(game).correct, 0) / (attempts.length * 12) * 100) : null;
      return `<div class="table-track"><strong>${table}×</strong><div class="mini-track"><span style="width:${accuracy || 0}%"></span></div><span>${accuracy === null ? "—" : `${accuracy}%`}</span></div>`;
    }).join("")}</div><p class="small muted">Based on the ${games.length} available recent game${games.length === 1 ? "" : "s"} shown below. Speed averages include timeouts.</p></section>
    <section class="history-section"><div class="section-heading"><h2>Game history</h2><span class="small muted">${games.length} recent games loaded</span><button class="text-link" type="button" data-action="reload-progress">Refresh</button></div>${games.length ? games.map(historyRow).join("") : '<div class="empty-inline">No games recorded.</div>'}${data.hasMoreGames(profile.id) ? '<div class="load-more-row"><button class="button secondary" type="button" data-action="load-more-games">Load older games</button></div>' : ""}</section>`;
}

function summaryCard(label, value, caption, symbol) {
  return `<div class="summary-card"><div class="summary-label">${icon(symbol)}<span>${label}</span></div><strong>${value}</strong>${caption ? `<p>${caption}</p>` : ""}</div>`;
}

function historyRow(game) {
  const stats = gameStats(game);
  return `<details class="history-row"><summary><span class="history-table">${game.table}×</span><span class="history-date"><strong>${esc(dateTimeLabel(game.startedAt))}</strong><small>Got it: ${stats.correct} · Not yet: ${stats.notYet} · ${seconds(stats.averageMs)} average</small></span><span class="history-count">${stats.correct}<small> /12 Got it</small></span><span class="history-badge ${stats.medal ? "won" : ""}">${game.phase !== "complete" ? "First round saved" : stats.medal ? "Medal earned" : `${stats.retries} retr${stats.retries === 1 ? "y" : "ies"}`}</span><span class="details-chevron" aria-hidden="true">${icon("chevron")}</span></summary><div class="history-detail">${game.quiz ? `<p class="quiz-history">Medal quiz: <strong>${game.quiz.correct}/20 correct</strong> · ${seconds(game.quiz.durationMs)} · ${game.quiz.passed ? "Passed" : game.quiz.endedBecause === "mistakes" ? "Ended after two mistakes" : game.quiz.endedBecause === "time" ? "Time ran out" : "Not passed"}</p>` : ""}<div class="scroll-table"><table><thead><tr><th>Equation</th><th>First try</th><th>Time</th><th>Retry attempts</th></tr></thead><tbody>${game.cards.map(card => `<tr><th>${game.table} × ${card.multiplier} = ${game.table * card.multiplier}</th><td>${card.initialCorrect ? "Got it" : card.timedOut ? "Timed out" : `Not yet (${esc(card.initialAnswer || "blank")})`}</td><td>${seconds(card.responseMs)}</td><td>${card.retries.length || "—"}</td></tr>`).join("")}</tbody></table></div></div></details>`;
}

async function renderTeacher(renderId) {
  if (!data.isTeacher()) {
    main.innerHTML = `<section class="empty-state"><span class="empty-symbol">✦</span><h1>Teacher sign-in</h1><p>Sign in with an approved teacher Google account to view students across all classes.</p><button class="button" type="button" data-action="account">Open account ${icon("arrow")}</button></section>`;
    addTeacherGuideLink();
    return;
  }
  loadingPage("Teacher desk");
  try {
    const [result, savedClasses, teacherResult] = await Promise.all([
      data.students(), data.classes(),
      data.store.teacher ? data.teachers().catch(error => ({ teachers: [], error })) : null,
    ]);
    if (renderId !== state.renderId) return;
    const deletingClasses = new Set(savedClasses.filter(item => item.deleting).map(item => item.name));
    const classes = [...new Set([...savedClasses.map(item => item.name), ...result.students.flatMap(classNamesFor)])]
      .filter(name => !deletingClasses.has(name))
      .filter(Boolean).sort().map(name => ({ id: name, name }));
    Object.assign(state, { teacherStudents: result.students, teacherCursor: result.cursor, teacherMore: result.more, teacherClasses: classes, classRecords: savedClasses });
    Object.assign(state, {
      teacherAccounts: teacherResult?.teachers || [], teacherAccountCursor: teacherResult?.cursor || null,
      teacherAccountMore: !!teacherResult?.more, teacherAccountError: teacherResult?.error || null,
    });
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="page-heading"><span class="eyebrow">TEACHER DESK</span><h1>Teacher desk</h1><p class="muted">Manage classes, students and teachers.</p></section><section class="panel"><div class="section-heading"><h2>Students & classes</h2><button class="text-link" type="button" data-action="refresh-teacher-data">Refresh</button></div><div class="teacher-tools"><label class="search-field"><span class="sr-only">Search students</span><input type="search" id="student-search" placeholder="Find a student…" value="${esc(state.filter)}"></label><label><span class="sr-only">Filter by class</span><select id="class-filter"><option value="">All classes</option>${classes.map(item => `<option ${state.classFilter === item.name ? "selected" : ""} value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select></label></div><div id="student-list"></div><div class="load-more-row"><span id="student-count" class="small muted"></span><button class="button secondary small-button" type="button" data-action="load-students" ${state.teacherMore ? "" : "hidden"}>Load more students</button></div></section><div class="teacher-forms"><section class="panel"><h2>Add a class</h2><form id="class-form" class="stack-form"><label>Class name<input name="className" placeholder="e.g. 4F" maxlength="24" required pattern="([A-Za-z0-9 _]|-)+"></label><button class="button secondary" type="submit">Add class +</button></form></section><section class="panel"><h2>Add a student</h2><form id="student-form" class="stack-form"><div class="field-pair"><label>Nickname<input name="nickname" placeholder="e.g. Alex" maxlength="32" required></label><label>Class<select name="className" required><option value="">Choose a class</option>${classes.map(item => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select></label></div><p class="small muted">Students must sign in with their own Google account to play.</p><button class="button" type="submit">Add student +</button></form></section></div>`;
    renderStudentList();
    addTeacherGuideLink();
    enhanceTeacherSetup();
    renderTeacherAccess();
    mountClassAdmin({
      container: main, data, getClasses: () => state.classRecords, getTeachers: () => state.teacherAccounts,
      getStudents: () => state.teacherStudents, isCurrent: () => state.renderId === renderId && state.route === "teacher" && data.isTeacher(),
      isBusy: () => state.adminBusy, setBusy: busy => { state.adminBusy = busy; }, errorMessage,
      onChanged: async action => {
        if (action.type === "class-delete" && state.classFilter === action.id) state.classFilter = "";
        data.refreshTeacherData();
        await render();
      },
    });
  } catch (error) {
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="empty-state"><h1>Couldn’t open the teacher desk.</h1><p>${esc(errorMessage(error))}</p><button class="button" data-link="teacher" type="button">Try again</button></section>`;
    addTeacherGuideLink();
  }
}

function teacherInviteUrl(email) {
  const link = new URL("#teacher", publicAppUrl).href;
  const subject = "You're invited to Multiplication Masters";
  const body = `Hi,\n\nYou've been added as a teacher in Multiplication Masters.\n\nOpen ${link}\n\nSign in with Google using ${email}. You can manage classes, add students and view their results.\n\nThanks!`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderTeacherAccess() {
  let panel = document.querySelector("#teacher-access-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "teacher-access-panel";
    panel.className = "panel teacher-access-panel";
    main.append(panel);
  }
  if (!data.store.teacher) {
    panel.innerHTML = '<h2>Teacher access</h2><p class="muted">Sign in with an approved teacher Google account to add other teachers. </p>';
    return;
  }
  const ownEmail = data.store.user.email.toLowerCase();
  const gameLink = new URL("#teacher", publicAppUrl).href;
  panel.innerHTML = `<div class="section-heading"><div><h2>Teachers</h2></div><span class="tiny-chip">Shared admin access</span></div>
    <p class="muted">Every approved teacher can view all student results, manage classes and add other teachers. Add their Google email, then share the game link. They sign in with that account.</p>
    <form id="teacher-access-form" class="teacher-access-form"><label>Teacher Google email<input name="email" type="email" required maxlength="254" autocomplete="off" placeholder="teacher@school.example"></label><button class="button secondary" type="submit">Add a teacher +</button></form>
    <p class="small muted">Adding a teacher opens an invitation in your email app. Check the From account and press Send. You can also share the link: <a class="text-link teacher-game-link" href="${esc(gameLink)}">${esc(gameLink)}</a></p>
    ${state.teacherAccountError ? `<p class="notice">Couldn’t load teachers. ${esc(errorMessage(state.teacherAccountError))}</p><button class="text-link" type="button" data-action="reload-teachers">Reload teachers →</button>` : `<div class="scroll-table"><table><thead><tr><th>Google account</th><th>Access</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${state.teacherAccounts.map(teacher => `<tr><th class="teacher-email">${esc(teacher.email)}${teacher.email === ownEmail ? ' <span class="small muted">(you)</span>' : ""}</th><td>${teacher.deleting ? "Deletion incomplete" : teacher.enabled ? "Ready to sign in" : "Disabled"}</td><td>${teacher.email === ownEmail ? '<span class="small muted">Your current account</span>' : `${teacher.enabled ? `<a class="text-link teacher-invite-link" href="${esc(teacherInviteUrl(teacher.email))}">Invite by email</a>` : ""}${!teacher.deleting ? `<button class="text-link" type="button" data-teacher-email="${esc(teacher.email)}" data-teacher-enabled="${!teacher.enabled}">${teacher.enabled ? "Disable access" : "Restore access"}</button>` : ""}<button class="text-link danger-link" type="button" data-delete-teacher="${esc(teacher.email)}">${teacher.deleting ? "Finish deletion" : "Delete teacher"}</button>`}</td></tr>`).join("")}</tbody></table></div><div class="load-more-row"><span class="small muted">${state.teacherAccounts.length} teacher account${state.teacherAccounts.length === 1 ? "" : "s"} loaded</span><button class="button secondary small-button" type="button" data-action="load-teachers" ${state.teacherAccountMore ? "" : "hidden"}>Load more teachers</button></div>`}`;
}

function confirmTeacherAccess(email, enabled, { invite = false } = {}) {
  if (!data.store.teacher || state.changingTeacherAccess) return;
  email = email.trim().toLowerCase();
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || email.length > 254) { toast("Please enter a valid Google email address."); return; }
  if (email === data.store.user.email.toLowerCase()) { toast("You can’t change your own teacher access. Ask another teacher if you need help."); return; }
  state.pendingTeacherAccess = { email, enabled, invite };
  document.querySelector("#teacher-access-title").textContent = enabled ? "Give teacher access?" : "Disable teacher access?";
  document.querySelector("#teacher-access-description").textContent = enabled
    ? `${email} will be able to view every student’s records, manage classes and give other teachers access. They must sign in using this Google account.${invite ? " An invitation will open in your email app, ready to send." : ""}`
    : `${email} will lose access to shared classes, student results and teacher management. Their account and student records won’t be deleted.`;
  document.querySelector("#teacher-access-status").textContent = "";
  teacherAccessDialog.querySelector('[data-action="confirm-teacher-access"]').textContent = enabled ? "Grant teacher access" : "Disable access";
  teacherAccessDialog.showModal();
}

async function refreshTeachers(after = null) {
  const result = await data.teachers(after);
  state.teacherAccounts = after ? state.teacherAccounts.concat(result.teachers) : result.teachers;
  state.teacherAccountCursor = result.cursor;
  state.teacherAccountMore = result.more;
  state.teacherAccountError = null;
  if (state.route === "teacher" && data.store.teacher) renderTeacherAccess();
}

function enhanceTeacherSetup() {
  const form = main.querySelector("#student-form");
  const label = document.createElement("label");
  label.innerHTML = 'School Google email<input name="email" type="email" required maxlength="254" placeholder="student@school.example" autocomplete="off">';
  form.querySelector(".field-pair").after(label);
  form.querySelector("p").textContent = "The student signs in with this Google account. If they already exist, their class is added without duplicating their progress. ";
  const panel = document.createElement("section");
  panel.className = "panel student-import-panel";
  panel.innerHTML = `<div><h2>Import students</h2><p class="muted">Paste student names and Google emails from a spreadsheet.</p></div><button class="button secondary" type="button" data-action="open-student-import">Bulk import ${icon("arrow")}</button>`;
  main.querySelector(".teacher-forms").after(panel);
}

function showStudentImportForm() {
  const draft = state.importDraft;
  document.querySelector("#student-import-content").innerHTML = `<form id="student-import-form" class="stack-form">
    <label>Class<select name="className" required autofocus><option value="">Choose a class</option>${state.teacherClasses.map(item => `<option value="${esc(item.name)}" ${draft?.className === item.name ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label>
    ${!state.teacherClasses.length ? '<p class="notice">Add a class in the teacher desk first.</p>' : ""}
    <label>Student rows<textarea name="rows" rows="8" maxlength="200000" required spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="student-import-help" placeholder="Student name&#9;Student email&#10;Alex&#9;alex@school.example">${esc(draft?.text || "")}</textarea></label>
    <p id="student-import-help" class="small muted">Copy two columns: name, then Google email. A header row is optional.</p>
    <button class="button" type="submit" ${state.teacherClasses.length ? "" : "disabled"}>Review students ${icon("arrow")}</button>
  </form>`;
  if (studentImportDialog.open) studentImportDialog.querySelector("select").focus();
}

function showStudentImportPreview() {
  const preview = state.importPreview;
  const count = preview.students.length;
  document.querySelector("#student-import-content").innerHTML = `<p><strong>Class ${esc(state.importDraft.className)}</strong> · ${count} student${count === 1 ? "" : "s"} ready</p>
    ${preview.errors ? `<p class="notice" role="alert">Fix ${preview.errors} row${preview.errors === 1 ? "" : "s"} before importing.</p>` : ""}
    ${preview.duplicates ? `<p class="small muted">${preview.duplicates} repeated email${preview.duplicates === 1 ? " is" : "s are"} skipped. The first row for each email is used.</p>` : ""}
    ${!preview.rows.length ? '<p class="notice">Paste at least one student row below the optional header.</p>' : `<div class="scroll-table student-import-roster"><table><thead><tr><th>Row</th><th>Student name</th><th>Google email</th><th>Status</th></tr></thead><tbody>${preview.rows.map(row => `<tr class="${row.errors.length ? "import-row-error" : ""}"><td>${row.line}</td><td>${esc(row.nickname)}</td><td>${esc(row.email)}</td><td>${row.errors.length ? esc(row.errors.join(" ")) : row.duplicate ? "Duplicate · skipped" : "Ready"}</td></tr>`).join("")}</tbody></table></div>`}
    <p class="small muted">Existing accounts keep their name, results and medals. This class is added to their account.</p>
    <div class="dialog-actions"><button class="button secondary" type="button" data-action="edit-student-import">Edit rows or class</button><button class="button" type="button" data-action="confirm-student-import" ${!count || preview.errors ? "disabled" : ""}>Import ${count} student${count === 1 ? "" : "s"}</button></div>`;
  document.querySelector("#student-import-title").focus();
}

function addTeacherGuideLink() {
  const guideLink = document.createElement("a");
  guideLink.href = "#guide";
  guideLink.dataset.link = "guide";
  guideLink.className = "text-link teacher-guide-link";
  guideLink.textContent = "Teacher guide · setup & technology →";
  main.querySelector(".page-heading, .empty-state")?.append(guideLink);
}

async function renderGuide(renderId) {
  loadingPage("Teacher guide");
  try {
    const response = await fetch(new URL("../README.md", import.meta.url));
    if (!response.ok) throw new Error("The project guide couldn’t be loaded.");
    const source = await response.text();
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="page-heading"><button class="text-link" type="button" data-link="teacher">← Back to teacher desk</button><h1>Teacher guide</h1><p class="muted">Using the game, understanding student records, and setting up the technology.</p></section><article class="panel guide-prose" aria-label="Multiplication Masters project README">${renderReadme(source)}</article><p class="small muted guide-source-note">This is the project README, displayed inside the app. <a class="text-link" href="./README.md" target="_blank" rel="noopener noreferrer">Open the original file →</a></p>`;
  } catch (error) {
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="empty-state"><h1>The guide didn’t load.</h1><p>${esc(errorMessage(error))}</p><button class="button" type="button" data-link="guide">Try again</button><p><a class="text-link" href="./README.md" target="_blank" rel="noopener noreferrer">Open the README file →</a></p></section>`;
  }
}

function renderStudentList() {
  const list = document.querySelector("#student-list");
  if (!list) return;
  const matching = state.teacherStudents.filter(profile =>
    `${profile.nickname} ${profile.email || ""}`.toLowerCase().includes(state.filter.trim().toLowerCase()));
  const classCounts = new Map();
  for (const profile of matching) for (const name of classNamesFor(profile).length ? classNamesFor(profile) : [UNASSIGNED_CLASS]) {
    if (name) classCounts.set(name, (classCounts.get(name) || 0) + 1);
  }
  const classFilter = document.querySelector("#class-filter");
  const names = [...new Set([...classCounts.keys(), ...(state.classFilter ? [state.classFilter] : [])])].sort();
  classFilter.innerHTML = '<option value="">All classes</option>' + names.map(name => `<option value="${esc(name)}" ${name === state.classFilter ? "selected" : ""} ${!classCounts.has(name) ? "disabled" : ""}>${esc(classOptionLabel(name))} (${classCounts.get(name) || 0})</option>`).join("");
  const students = matching.filter(profile => matchesClass(profile, state.classFilter));
  document.querySelector("#student-count").textContent = `${students.length} matching · ${state.teacherStudents.length} loaded${state.teacherMore ? " · load more to search further" : ""}`;
  list.innerHTML = students.length ? `<div class="scroll-table"><table class="roster-table"><thead><tr><th>Student</th><th>Class</th><th>Games</th><th>Accuracy</th><th>Medals</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${students.map(profile => {
    const summary = data.getSummary(profile);
    return `<tr><th><span class="student-name"><span class="avatar">${esc(profile.nickname[0])}</span><span>${esc(profile.nickname)}${profile.email ? `<small class="student-email">${esc(profile.email)}</small>` : ""}</span></span></th><td>${esc(classLabel(profile))}</td><td>${summary.games}</td><td>${summary.games ? `${summary.accuracy}%` : "—"}</td><td>${medalCount(profile)}/12</td><td><span class="student-status ${profile.active === false || profile.deleting ? "disabled" : ""}">${profile.deleting ? "Deletion incomplete" : profile.active === false ? "Disabled" : "Active"}</span></td><td><div class="roster-actions"><button class="text-link" type="button" data-report="${esc(profile.id)}">View progress</button>${!profile.deleting ? `<button class="text-link" type="button" data-edit-student="${esc(profile.id)}">Edit</button>` : ""}${!profile.deleting ? `<button class="text-link" type="button" data-student-id="${esc(profile.id)}" data-student-action="${profile.active === false ? "enable" : "disable"}">${profile.active === false ? "Enable" : "Disable"}</button>` : ""}<button class="text-link danger-link" type="button" data-student-id="${esc(profile.id)}" data-student-action="delete">${profile.deleting ? "Finish deletion" : "Delete"}</button></div></td></tr>`;
  }).join("")}</tbody></table></div>` : '<div class="empty-inline">No students found. Add a class and a student to get started.</div>';
}

function confirmStudentAction(id, action) {
  if (!data.isTeacher() || state.changingStudent) return;
  const profile = state.teacherStudents.find(item => item.id === id);
  if (!profile || !["enable", "disable", "delete"].includes(action)) return;
  state.pendingStudentAction = { profile, action };
  document.querySelector("#student-manage-title").textContent = action === "delete" ? "Delete student permanently?" : action === "enable" ? "Enable student?" : "Disable student?";
  document.querySelector("#student-manage-description").textContent = action === "delete"
    ? `${profile.nickname} (${profile.email}): permanently remove their profile, enrolment, all game results and medals across every class. This cannot be undone.`
    : action === "enable" ? `${profile.nickname} (${profile.email}) will be able to sign in and play again. Their results and medals are kept.`
    : `${profile.nickname} (${profile.email}) will lose access across every class. Their profile, results and medals are kept, and you can enable them again.`;
  document.querySelector("#student-manage-status").textContent = "";
  const confirm = studentManageDialog.querySelector('[data-action="confirm-student-management"]');
  confirm.textContent = action === "delete" ? "Delete permanently" : action === "enable" ? "Enable student" : "Disable student";
  confirm.classList.toggle("danger-button", action === "delete");
  studentManageDialog.showModal();
}

async function performStudentManagement() {
  if (!data.isTeacher() || !state.pendingStudentAction || state.changingStudent) return;
  const { profile, action } = state.pendingStudentAction;
  state.changingStudent = true;
  const buttons = studentManageDialog.querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });
  const status = document.querySelector("#student-manage-status");
  status.textContent = action === "delete" ? "Starting deletion…" : "Saving student access…";
  try {
    if (action === "delete") {
      await data.deleteStudent(profile.id, message => {
        status.textContent = message;
        state.teacherStudents = state.teacherStudents.map(item => item.id === profile.id ? { ...item, active: false, deleting: true } : item);
      });
      state.teacherStudents = state.teacherStudents.filter(item => item.id !== profile.id);
      if (state.detailProfile?.id === profile.id) state.detailProfile = null;
    } else {
      const updated = await data.setStudentEnabled(profile.id, action === "enable");
      state.teacherStudents = state.teacherStudents.map(item => item.id === profile.id ? updated : item);
    }
    studentManageDialog.close();
    renderStudentList();
    toast(action === "delete" ? "Student records permanently deleted." : action === "enable" ? "Student enabled." : "Student disabled.");
  } catch (error) {
    status.textContent = `${errorMessage(error)}${action === "delete" ? " If deletion has started, the student stays disabled. Retry to finish removing their records." : ""}`;
    renderStudentList();
  } finally { state.changingStudent = false; buttons.forEach(button => { button.disabled = false; }); }
}

function prepareGame() {
  const profile = data.activeProfile();
  if (!profile) { openAccount(); return; }
  stopTimers();
  state.game = newGame(state.table, profile.id);
  main.style.setProperty("--card-tint", medalFor(state.table).colour);
  state.stage = "countdown";
  state.locked = true;
  state.saveError = null;
  state.firstRoundSaving = false;
  state.firstRoundSaved = false;
  state.firstRoundError = null;
  state.firstRoundPromise = null;
  state.deadline = Date.now() + 5000;
  navigate("game", { force: true });
  countdownTick();
}

function gameSessionIsValid() {
  if (state.game && data.activeProfile()?.id === state.game.studentId) return true;
  stopTimers();
  state.stage = "intro";
  state.locked = true;
  navigate("play", { force: true });
  toast("Sign in with your student Google account to play.");
  return false;
}

function countdownTick() {
  if (!state.game || state.stage !== "countdown") return;
  if (!gameSessionIsValid()) return;
  const remaining = Math.max(0, state.deadline - Date.now());
  const number = document.querySelector("#countdown-number");
  if (remaining <= 0) {
    state.stage = "playing";
    beginCard();
    return;
  }
  const count = Math.ceil(remaining / 1000);
  if (number && number.textContent !== String(count)) {
    number.textContent = count;
    number.classList.remove("count-pop");
    void number.offsetWidth;
    number.classList.add("count-pop");
  }
  const ring = document.querySelector("#countdown-ring");
  if (ring) ring.style.setProperty("--count-progress", `${remaining / 5000 * 100}%`);
  state.frame = requestAnimationFrame(countdownTick);
}

function stageIntro(game) {
  const retry = game.phase === "retry-ready";
  const missed = game.firstRound.notYet;
  const example = game.cards.find(card => !card.initialCorrect);
  const medal = medalFor(game.table);
  const artwork = retry
    ? `<div class="stage-card-stack"><div class="stage-mini-card stage-mini-back">${icon("check")}</div><div class="stage-mini-card stage-mini-front"><span>${game.table} × ${example.multiplier}</span><strong>?</strong></div><span class="stage-card-count">${missed} card${missed === 1 ? "" : "s"}</span></div>`
    : `<span class="stage-medal-art">${medalArt(game.table)}</span><h2>${esc(medal.name)}</h2>`;
  return `<section class="interlude stage-intro ${retry ? "retry-intro" : "quiz-intro"}" style="--stage-colour:${retry ? "#ffe2c5" : medal.colour}">
    <div class="stage-topline"><button class="text-link" type="button" data-link="play">← Tables</button><span class="tiny-chip">${game.table}× table</span></div>
    <div class="stage-panel"><aside class="stage-art" aria-hidden="true">${artwork}</aside><div class="stage-content">
      <span class="stage-label">${retry ? "No timer" : "Medal challenge"}</span>
      <h1>${retry ? `Retry ${missed} card${missed === 1 ? "" : "s"}` : "Ready for the quiz?"}</h1>
      <p class="stage-description">${retry ? "Type the full equation and answer." : "Get 19 out of 20 correct to collect your medal."}</p>
      ${firstRoundSaveStatus()}
      ${retry ? `<div class="stage-example"><span>Example</span><div>${game.table} x ${example.multiplier} = <b>?</b></div></div>` : '<div class="stage-quiz-rules"><div><strong>20</strong><span>questions</span></div><div><strong>60s</strong><span>time limit</span></div><div><strong>1</strong><span>mistake allowed</span></div></div>'}
      <button class="button stage-start" type="button" data-action="${retry ? "start-retry" : "start-quiz"}" ${state.firstRoundSaved ? "" : "disabled"}>${retry ? "Start retries" : "Start quiz"} ${icon("arrow")}</button>
    </div></div>
  </section>`;
}

function renderGame() {
  const game = state.game;
  if (state.stage === "complete") { renderResults(); return; }
  if (state.stage === "countdown") {
    main.innerHTML = `<section class="countdown-screen"><h1>${game.table} times table</h1><div class="countdown-ring" id="countdown-ring"><div><strong id="countdown-number" class="count-pop" role="timer" aria-live="polite">5</strong></div></div><p>Type your answer and press <kbd>Enter ↵</kbd></p><button class="text-link" type="button" data-link="play">← Back to tables</button></section>`;
    return;
  }
  if (["retry-ready", "quiz-ready"].includes(game.phase)) {
    main.innerHTML = stageIntro(game);
    return;
  }
  const retry = game.phase === "retry";
  const quiz = game.phase === "quiz";
  const card = quiz ? null : currentCard(game);
  const multiplier = quiz ? game.quiz.questions[game.index] : card.multiplier;
  const total = retry ? game.cards.filter(item => !item.initialCorrect).length : quiz ? 20 : 12;
  const correctCount = game.cards.filter(item => item.initialCorrect).length;
  const notYetCount = game.cards.filter(item => item.initialCorrect === false).length - (retry ? game.index : 0);
  main.innerHTML = `<section class="game-top"><button class="text-link" type="button" data-link="play">← Leave game</button><span class="game-table-name">${game.table} TIMES TABLE</span><span class="game-medal-chip">${icon("medal")} ${medalCount(data.activeProfile())}<span>/12 medals</span></span></section><section class="game-intro"><h1>${retry ? "Not yet — retries" : quiz ? "Medal quiz" : "Flashcards"}</h1></section>
    <section class="game-board ${quiz ? "quiz-board" : retry ? "retry-board" : ""}" aria-label="${retry ? "Retry round" : quiz ? "Medal quiz" : "Flashcard round"}">
      ${quiz ? `<aside class="pile quiz-count"><h2>Correct</h2><strong>${game.quiz.correct}<small>/20</small></strong><p>${game.quiz.wrong} / 2 mistakes</p></aside>` : retry ? "" : `<aside class="pile got-pile"><h2>Got it</h2><strong>${correctCount}</strong><div class="pile-cards mint" aria-hidden="true"><span></span><span></span><span>✓</span></div></aside>`}
      <div class="card-centre"><div class="card-meta"><span>Card ${game.index + 1} of ${total}</span><span id="timer-label" role="timer" aria-label="${quiz ? "Quiz time remaining" : "Time remaining"}">${retry ? "No timer" : quiz ? "60.0s" : "5.0s"}</span></div>${retry ? "" : '<div class="timer-track" role="progressbar" aria-label="Time remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span id="timer-fill"></span></div>'}
      <div class="card-perspective"><div class="flashcard dealt" id="flashcard"><div class="card-face card-front"><span class="card-sticker" aria-hidden="true">${medalArt(game.table, false)}</span><div class="equation">${game.table} <span>×</span> ${multiplier} <span>=</span> <b>?</b></div></div><div class="card-face card-back"><div class="back-equation" id="back-equation">${game.table} × ${multiplier} = <strong>${game.table * multiplier}</strong></div></div></div></div>
      <form class="answer-form ${retry ? "equation-form" : ""}" id="answer-form"><label class="sr-only" for="answer">${retry ? "Full equation and answer" : "Your answer"}</label><input id="answer" name="answer" type="text" inputmode="${retry ? "text" : "numeric"}" pattern="${retry ? "[0-9xX×= ]*" : "[0-9]*"}" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${retry ? `${game.table} x ${multiplier} = ?` : "Answer"}" maxlength="${retry ? "40" : "4"}" aria-describedby="answer-hint" required><button class="answer-submit" type="submit" aria-label="Submit answer">↵</button></form><p class="answer-hint" id="answer-hint">${retry ? "Type the full equation and answer, then Enter" : "Type the answer, then Enter"}</p><div class="answer-feedback" id="answer-feedback" role="status" aria-live="polite"></div></div>
      <aside class="pile not-yet-pile"><h2>${quiz ? "Seconds left" : "Not yet"}</h2><strong ${quiz ? 'id="quiz-side-time"' : ""}>${quiz ? Math.ceil(Math.max(0, state.deadline - Date.now()) / 1000) : notYetCount}</strong>${quiz ? "" : '<div class="pile-cards peach" aria-hidden="true"><span></span><span></span><span>↻</span></div>'}</aside>
    </section>`;
}

function beginCard() {
  if (!state.game || state.stage !== "playing") return;
  if (!gameSessionIsValid()) return;
  state.locked = false;
  state.cardStarted = Date.now();
  if (state.game.phase === "flash") state.deadline = state.cardStarted + 5000;
  renderGame();
  const input = document.querySelector("#answer");
  input?.focus({ preventScroll: true });
  cancelAnimationFrame(state.frame);
  if (state.game.phase !== "retry") timerTick();
}

function timerTick() {
  if (!state.game || state.stage !== "playing") return;
  if (!gameSessionIsValid()) return;
  const quiz = state.game.phase === "quiz";
  if (!quiz && (state.game.phase !== "flash" || state.locked)) return;
  const remaining = Math.max(0, state.deadline - Date.now());
  const fraction = remaining / (quiz ? 60000 : 5000) * 100;
  const label = document.querySelector("#timer-label");
  if (label) label.textContent = `${(remaining / 1000).toFixed(1)}s`;
  const track = document.querySelector(".timer-track");
  track?.setAttribute("aria-valuenow", String(Math.round(fraction)));
  track?.classList.toggle("running-low", remaining <= (quiz ? 10000 : 1500));
  const fill = document.querySelector("#timer-fill");
  if (fill) fill.style.width = `${fraction}%`;
  const sideTime = document.querySelector("#quiz-side-time");
  if (sideTime) sideTime.textContent = Math.ceil(remaining / 1000);
  if (remaining <= 0) {
    if (quiz) endQuiz("time");
    else submitFlash(true);
    return;
  }
  state.frame = requestAnimationFrame(timerTick);
}

function lockAnswer() {
  state.locked = true;
  const input = document.querySelector("#answer");
  if (input) input.disabled = true;
  const button = document.querySelector(".answer-submit");
  if (button) button.disabled = true;
}

function showFeedback(correct, message) {
  const card = document.querySelector("#flashcard");
  const feedback = document.querySelector("#answer-feedback");
  if (feedback) { feedback.textContent = message; feedback.className = `answer-feedback ${correct ? "correct" : "try-again"}`; }
  card?.classList.remove("dealt");
  card?.classList.add(correct ? "correct-card" : "retry-card", "is-flipped");
}

function firstRoundSaveStatus() {
  const round = state.game.firstRound;
  return `<div class="round-piles" aria-label="First-round results"><div class="round-pile round-pile-got"><span>${icon("check")} Got it</span><strong>${round.gotIt}</strong></div><div class="round-pile round-pile-not-yet"><span>${icon("retry")} Not yet</span><strong>${round.notYet}</strong></div></div>
    <div class="round-save-state ${state.firstRoundError ? "round-save-error" : ""}"><p role="status">${state.firstRoundSaving ? "Saving results…" : state.firstRoundError ? `Save not confirmed. ${esc(state.firstRoundError)}` : `${icon("check")} Results saved`}</p>${state.firstRoundError ? '<button class="button secondary small-button" type="button" data-action="retry-first-round-save">Retry save</button>' : ""}</div>`;
}

function saveFirstRoundNow(game) {
  if (state.firstRoundPromise || state.firstRoundSaved) return state.firstRoundPromise;
  const record = structuredClone(game);
  state.firstRoundSaving = true;
  state.firstRoundError = null;
  state.firstRoundPromise = data.saveFirstRound(record).then(() => {
    if (state.game?.id === record.id) state.firstRoundSaved = true;
  }).catch(error => {
    if (state.game?.id === record.id) state.firstRoundError = errorMessage(error);
  }).finally(() => {
    if (state.game?.id !== record.id) return;
    state.firstRoundSaving = false;
    state.firstRoundPromise = null;
    if (state.stage === "break") renderGame();
  });
  return state.firstRoundPromise;
}

function submitFlash(timedOut = false) {
  if (state.locked || !state.game || state.game.phase !== "flash") return;
  if (!gameSessionIsValid()) return;
  timedOut ||= Date.now() >= state.deadline;
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markFlash(state.game, answer, Math.min(5000, Date.now() - state.cardStarted), timedOut);
  if (state.game.firstRound) void saveFirstRoundNow(state.game);
  cancelAnimationFrame(state.frame);
  showFeedback(correct, correct ? "Correct" : timedOut ? "Time up" : "Incorrect");
  // Allow the 320ms flip to finish, then show a missed answer for three seconds.
  const moveAfter = correct ? 400 : 320 + 3000;
  delay(() => document.querySelector("#flashcard")?.classList.add(correct ? "fly-got" : "fly-not-yet"), moveAfter);
  delay(() => {
    state.game.index++;
    if (state.game.index < 12) { beginCard(); return; }
    state.game.index = 0;
    state.stage = "break";
    state.game.phase = state.game.cards.every(card => card.initialCorrect) ? "quiz-ready" : "retry-ready";
    renderGame();
    main.focus({ preventScroll: true });
  }, moveAfter + 360);
}

function submitRetry() {
  if (state.locked || state.game?.phase !== "retry") return;
  if (!gameSessionIsValid()) return;
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markRetry(state.game, answer, Date.now() - state.cardStarted);
  if (correct) {
    const feedback = document.querySelector("#answer-feedback");
    feedback.textContent = "Correct";
    feedback.className = "answer-feedback correct";
    document.querySelector("#flashcard")?.classList.add("dismissed");
    delay(() => {
      state.game.index++;
      if (state.game.index >= state.game.cards.filter(card => !card.initialCorrect).length) completeGame();
      else beginCard();
    }, 300);
  } else {
    showFeedback(false, "Incorrect · try again");
    // The flip takes 320ms, then the answer remains face-up for one full second.
    delay(() => document.querySelector("#flashcard")?.classList.remove("is-flipped"), 1320);
    delay(() => {
      state.locked = false;
      state.cardStarted = Date.now();
      const input = document.querySelector("#answer");
      input.value = "";
      input.disabled = false;
      document.querySelector(".answer-submit").disabled = false;
      document.querySelector("#flashcard")?.classList.remove("retry-card");
      document.querySelector("#answer-feedback").textContent = "Try again";
      input.focus({ preventScroll: true });
    }, 1640);
  }
}

function submitQuiz() {
  if (state.locked || state.game?.phase !== "quiz") return;
  if (!gameSessionIsValid()) return;
  if (Date.now() >= state.deadline) { endQuiz("time"); return; }
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markQuiz(state.game, answer, Date.now() - state.cardStarted);
  if (state.game.quiz.wrong >= 2) { endQuiz("mistakes"); return; }
  if (state.game.index === 20) { endQuiz("answered"); return; }
  showFeedback(correct, correct ? "Correct" : "Incorrect · 1 mistake");
  delay(() => {
    if (state.stage !== "playing") return;
    if (Date.now() >= state.deadline) endQuiz("time");
    else beginCard();
  }, 340);
}

function endQuiz(reason) {
  if (!state.game || state.game.phase !== "quiz" || state.stage === "complete") return;
  const quiz = state.game.quiz;
  quiz.durationMs = Math.min(60000, Date.now() - state.quizStarted);
  quiz.endedBecause = reason;
  quiz.passed = reason === "answered" && quiz.answers.length === 20 && quiz.correct >= 19;
  completeGame();
}

async function completeGame() {
  if (!gameSessionIsValid()) return;
  stopTimers();
  state.stage = "complete";
  state.locked = true;
  state.saving = true;
  state.saveError = null;
  const record = finishGame(state.game);
  renderResults();
  main.focus({ preventScroll: true });
  let saveError = null;
  try { await data.saveGame(record); }
  catch (error) { saveError = errorMessage(error); }
  if (state.game?.id !== record.id) return;
  state.saveError = saveError;
  state.saving = false;
  updateHeader();
  if (state.route === "game" && state.game?.id === record.id) renderResults();
}

function renderResults() {
  const game = state.game;
  const stats = gameStats(game);
  const profile = data.activeProfile();
  const trophy = medalCount(profile) === 12;
  const headline = stats.medal ? (trophy ? "Trophy earned!" : medalFor(game.table).name) : "Game complete";
  const quizMessage = game.quiz && !stats.medal ? game.quiz.endedBecause === "mistakes" ? "Quiz ended: two incorrect answers." : "Quiz ended: time ran out." : "";
  main.innerHTML = `<section class="results-heading">${stats.medal ? `<span class="earned-medal-art" aria-hidden="true">${medalArt(game.table)}</span>` : ""}<h1>${esc(headline)}</h1>${quizMessage ? `<p>${quizMessage}</p>` : ""}</section><section class="summary-grid results-stats">${summaryCard("Got it", stats.correct, "First round", "check")}${summaryCard("Not yet", stats.notYet, "First round", "retry")}${summaryCard("Average time", seconds(stats.averageMs), "Includes timeouts", "clock")}${summaryCard(game.quiz ? "Quiz result" : "Retry attempts", game.quiz ? `${game.quiz.correct}<small>/20</small>` : stats.retries, game.quiz ? `${seconds(game.quiz.durationMs)} · ${stats.medal ? "Passed" : "Not passed"}` : "", game.quiz ? "medal" : "retry")}</section><section class="panel results-panel"><h2>Card results</h2><div class="result-facts">${[...game.cards].sort((a, b) => a.multiplier - b.multiplier).map(card => `<div class="result-fact ${card.initialCorrect ? "first-time" : "practised"}"><span>${game.table} × ${card.multiplier} = <strong>${game.table * card.multiplier}</strong></span><small>${card.initialCorrect ? "First try" : `${card.retries.length} retry attempt${card.retries.length === 1 ? "" : "s"}`}</small></div>`).join("")}</div><p class="save-status ${state.saveError ? "notice" : ""}" id="save-status" role="status">${state.saving ? "Saving results…" : state.saveError ? `Save not confirmed. Keep this page open and retry. ${esc(state.saveError)}` : "Results saved."}</p>${state.saveError ? '<button type="button" class="text-link" data-action="sync">Retry cloud save</button>' : ""}<div class="results-actions"><button class="button" type="button" data-link="play">Back to tables</button><button class="button secondary" type="button" data-link="progress">My progress</button></div></section>`;
}

function openAccount() {
  if (state.game && state.stage !== "complete") { toast("Finish or leave the game before switching accounts."); return; }
  const profile = data.activeProfile();
  const status = accountDialog.querySelector("#account-status");
  status.hidden = true;
  status.textContent = "";
  const content = document.querySelector("#account-content");
  content.innerHTML = `${data.store.user ? `<div class="account-current"><div><strong>${data.store.teacher ? "Teacher account" : esc(profile?.nickname || "Student account")}</strong><span>${esc(data.store.user.email)}</span>${profile ? `<span>Class ${esc(classLabel(profile))}</span>` : ""}</div></div>` : '<p class="muted">Sign in with the Google account your teacher has added.</p>'}<button class="button google-button" type="button" data-action="google-login" ${data.store.configured ? "" : "disabled"}><span aria-hidden="true" class="google-g">G</span> ${data.store.user ? "Switch Google account" : "Sign in with Google"}</button>${!data.store.configured ? '<p class="notice">Google sign-in is not configured. Contact your teacher.</p>' : ""}${data.isTeacher() ? '<button class="text-link account-signout" type="button" data-action="teacher-desk">Teacher desk →</button>' : ""}${data.store.user ? '<button class="text-link account-signout" type="button" data-action="signout">Sign out</button>' : ""}`;
  if (!accountDialog.open) accountDialog.showModal();
}

async function performStudentImport(batch) {
  if (!batch || state.importing || !data.store.teacher) return;
  state.importing = true;
  const content = document.querySelector("#student-import-content");
  const closeButton = studentImportDialog.querySelector("[data-close-dialog]");
  closeButton.disabled = true;
  content.innerHTML = `<p>Adding students to <strong>${esc(batch.className)}</strong>.</p><progress id="import-progress" max="${batch.students.length}" value="${batch.processed}" aria-label="Students imported"></progress><p id="import-status" role="status">${batch.processed} of ${batch.students.length} saved</p><p class="small muted">Keep this page open until the import finishes.</p>`;
  try {
    while (batch.processed < batch.students.length) {
      const student = batch.students[batch.processed];
      await data.addStudent(student.nickname, batch.className, student.email);
      batch.processed++;
      document.querySelector("#import-progress").value = batch.processed;
      document.querySelector("#import-status").textContent = `${batch.processed} of ${batch.students.length} saved`;
    }
    state.importing = false;
    studentImportDialog.close();
    toast(`${batch.students.length} student account${batch.students.length === 1 ? " is" : "s are"} ready in ${batch.className}.`);
    navigate("teacher");
  } catch (error) {
    content.innerHTML = `<p class="notice" role="alert">${batch.processed} of ${batch.students.length} students saved. ${esc(errorMessage(error))}</p><p class="small muted">Retry to continue this import. Accounts and progress won’t be duplicated.</p><button class="button" type="button" data-action="retry-student-import">Retry import</button>`;
  } finally { state.importing = false; closeButton.disabled = false; }
}

async function handleAction(action, button) {
  if (action === "refresh-teacher-data") { data.refreshTeacherData(); await render(); return; }
  if (action === "retry-first-round-save") { if (gameSessionIsValid() && state.game.firstRound) await saveFirstRoundNow(state.game); return; }
  if (action === "cancel-student-management") { if (!state.changingStudent) studentManageDialog.close(); return; }
  if (action === "confirm-student-management") { await performStudentManagement(); return; }
  if (action === "cancel-teacher-access") {
    if (!state.changingTeacherAccess) teacherAccessDialog.close();
    return;
  }
  if (action === "confirm-teacher-access") {
    if (!data.store.teacher || !state.pendingTeacherAccess || state.changingTeacherAccess) return;
    const { email, enabled, invite } = state.pendingTeacherAccess;
    state.changingTeacherAccess = true;
    const buttons = teacherAccessDialog.querySelectorAll("button");
    buttons.forEach(item => { item.disabled = true; });
    document.querySelector("#teacher-access-status").textContent = "Saving teacher access…";
    let invitation = null;
    try {
      await data.setTeacherAccess(email, enabled);
      teacherAccessDialog.close();
      toast(enabled ? invite ? "Teacher added. Finish sending the invitation in your email app." : "Teacher access is ready." : "Teacher access has been disabled.");
      if (enabled && invite) invitation = teacherInviteUrl(email);
      try { await refreshTeachers(); }
      catch (error) { state.teacherAccountError = error; if (state.route === "teacher") renderTeacherAccess(); }
    } catch (error) { document.querySelector("#teacher-access-status").textContent = errorMessage(error); }
    finally { state.changingTeacherAccess = false; buttons.forEach(item => { item.disabled = false; }); }
    if (invitation) {
      try { window.location.href = invitation; }
      catch { toast("Teacher added. Use Invite by email to open the invitation."); }
    }
    return;
  }
  if (action === "load-teachers" || action === "reload-teachers") {
    button.disabled = true;
    try { await refreshTeachers(action === "load-teachers" ? state.teacherAccountCursor : null); }
    finally { if (button.isConnected) button.disabled = false; }
    return;
  }
  if (action === "reload-progress" || action === "load-more-games") {
    const profile = state.detailProfile || data.activeProfile();
    if (!profile) return;
    const renderId = state.renderId;
    button.disabled = true;
    try {
      await data.gamesFor(profile.id, { loadMore: action === "load-more-games", refresh: action === "reload-progress" });
      if (state.renderId === renderId && state.route === "progress") await render();
    } finally { if (button.isConnected) button.disabled = false; }
    return;
  }
  if (action === "prepare-game") { prepareGame(); return; }
  if (action === "account") { openAccount(); return; }
  if (action === "teacher-desk") { accountDialog.close(); navigate("teacher"); return; }
  if (action === "open-student-import") {
    if (!data.store.teacher) return;
    state.importDraft = { className: state.classFilter || (state.teacherClasses.length === 1 ? state.teacherClasses[0].name : ""), text: "" };
    state.importPreview = null;
    state.importBatch = null;
    showStudentImportForm();
    studentImportDialog.showModal();
    return;
  }
  if (action === "edit-student-import") { if (!state.importing) showStudentImportForm(); return; }
  if (action === "confirm-student-import") {
    if (state.importing || !data.store.teacher || !state.importDraft || !state.importPreview?.students.length || state.importPreview.errors) return;
    state.importBatch = { className: state.importDraft.className, students: state.importPreview.students, processed: 0 };
    await performStudentImport(state.importBatch);
    return;
  }
  if (action === "retry-student-import") { await performStudentImport(state.importBatch); return; }
  if (action === "start-retry") {
    if (!gameSessionIsValid() || !state.firstRoundSaved) return;
    state.game.phase = "retry";
    state.game.index = 0;
    state.stage = "playing";
    beginCard();
    return;
  }
  if (action === "start-quiz") {
    if (!gameSessionIsValid() || !state.firstRoundSaved) return;
    startQuiz(state.game);
    state.quizStarted = Date.now();
    state.deadline = state.quizStarted + 60000;
    state.stage = "playing";
    beginCard();
    return;
  }
  if (action === "google-login") {
    const status = accountDialog.querySelector("#account-status");
    status.hidden = true;
    status.textContent = "";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await data.loginGoogle();
      accountDialog.close();
      navigate(data.store.teacher ? "teacher" : "play");
    } catch (error) {
      if (accountDialog.open) {
        status.textContent = errorMessage(error);
        status.hidden = false;
        status.focus();
      } else toast(errorMessage(error));
    } finally {
      if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); }
    }
    return;
  }
  if (action === "signout") {
    await data.logout();
    state.teacherStudents = [];
    state.teacherClasses = [];
    state.teacherAccounts = [];
    state.teacherAccountCursor = null;
    state.teacherAccountMore = false;
    accountDialog.close();
    navigate("play", { force: true });
    return;
  }
  if (action === "load-students") {
    button.disabled = true;
    try {
      const result = await data.students(state.teacherCursor);
      state.teacherStudents.push(...result.students);
      state.teacherCursor = result.cursor;
      state.teacherMore = result.more;
      button.hidden = !result.more;
      renderStudentList();
    } finally { button.disabled = false; }
    return;
  }
  if (action === "sync") {
    const gameId = state.game?.id;
    button.disabled = true;
    try {
      if (!state.game || state.stage !== "complete") return;
      await data.saveGame(state.game);
      state.saveError = null;
      if (state.route === "game" && state.game?.id === gameId) renderResults();
      toast("Your results are saved to your account.");
    } finally { if (button.isConnected) button.disabled = false; }
  }
}

document.addEventListener("click", async event => {
  const studentManagement = event.target.closest("[data-student-action]");
  if (studentManagement) { confirmStudentAction(studentManagement.dataset.studentId, studentManagement.dataset.studentAction); return; }
  const teacherAction = event.target.closest("[data-teacher-email]");
  if (teacherAction) { confirmTeacherAccess(teacherAction.dataset.teacherEmail, teacherAction.dataset.teacherEnabled === "true"); return; }
  const close = event.target.closest("[data-close-dialog]");
  if (close) {
    if (close.closest("dialog") === studentImportDialog && state.importing) { toast("Please wait for the import to finish."); return; }
    close.closest("dialog").close(); return;
  }
  const pickerLink = event.target.closest("[data-scroll-picker]");
  if (pickerLink) { event.preventDefault(); document.querySelector("#table-picker")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); return; }
  const tile = event.target.closest("[data-table]");
  if (tile) { state.table = Number(tile.dataset.table); renderHome(); document.querySelector(`[data-table="${state.table}"]`)?.focus({ preventScroll: true }); return; }
  const routeLink = event.target.closest("[data-link], a[data-route], a.brand");
  if (routeLink) {
    event.preventDefault();
    if (studentImportDialog.open && !state.importing) studentImportDialog.close();
    navigate(routeLink.dataset.link || routeLink.dataset.route || (data.isTeacher() ? "teacher" : "play")); return;
  }
  const studentAction = event.target.closest("[data-report]");
  if (studentAction) {
    if (!data.store.teacher) return;
    const profile = state.teacherStudents.find(item => item.id === studentAction.dataset.report);
    if (!profile) return;
    state.detailProfile = profile;
    state.detailReturnRoute = "teacher";
    navigate("progress", { keepDetail: true });
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    try { await handleAction(actionButton.dataset.action, actionButton); }
    catch (error) { toast(errorMessage(error)); }
  }
});

document.addEventListener("submit", async event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "answer-form") {
    if (state.locked || !state.game) return;
    if (state.game.phase === "flash") submitFlash();
    else if (state.game.phase === "retry") submitRetry();
    else if (state.game.phase === "quiz") submitQuiz();
    return;
  }
  const button = form.querySelector('[type="submit"]');
  if (button?.disabled) return;
  const fields = new FormData(form);
  if (form.id === "teacher-access-form") {
    confirmTeacherAccess(String(fields.get("email") || ""), true, { invite: true });
    return;
  }
  if (form.id === "student-import-form") {
    if (!data.store.teacher || state.importing) return;
    const className = String(fields.get("className") || "");
    if (!state.teacherClasses.some(item => item.name === className)) { toast("Choose a class from the list."); return; }
    state.importDraft = { className, text: String(fields.get("rows") || "") };
    try {
      state.importPreview = parseStudentRows(state.importDraft.text);
      showStudentImportPreview();
    } catch (error) { toast(errorMessage(error)); }
    return;
  }
  const nickname = String(fields.get("nickname") || "").trim();
  const className = String(fields.get("className") || "").trim().toUpperCase();
  const email = String(fields.get("email") || "").trim().toLowerCase();
  if ((form.id.includes("profile") || form.id === "student-form") && !nickname) { toast("Please enter a nickname."); return; }
  if (!className || className.length > 24 || /[\/]/.test(className)) { toast("Please enter a class name without slashes, up to 24 characters."); return; }
  if (button) button.disabled = true;
  try {
    if (form.id === "class-form") {
      await data.addClass(className);
      toast(`Class ${className} is ready.`);
      navigate("teacher");
    } else if (form.id === "student-form") {
      await data.addStudent(nickname, className, email);
      toast(`${nickname} has been added to ${className}.`);
      navigate("teacher");
    }
  } catch (error) { toast(errorMessage(error)); }
  finally { if (button?.isConnected) button.disabled = false; }
});

function restrictAnswerInput(input) {
  const clean = value => value.replace(input.form?.classList.contains("equation-form") ? /[^0-9xX×= ]/g : /[^0-9]/g, "");
  const value = clean(input.value);
  if (value === input.value) return;
  const start = clean(input.value.slice(0, input.selectionStart)).length;
  const end = clean(input.value.slice(0, input.selectionEnd)).length;
  input.value = value;
  input.setSelectionRange(start, end);
}

document.addEventListener("pointerdown", event => {
  for (const picker of document.querySelectorAll(".student-picker[open]")) {
    if (!picker.contains(event.target)) picker.open = false;
  }
});
document.addEventListener("focusin", event => {
  for (const picker of document.querySelectorAll(".student-picker[open]")) {
    if (!picker.contains(event.target)) picker.open = false;
  }
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const picker = document.querySelector(".student-picker[open]");
  if (picker) {
    event.preventDefault();
    picker.open = false;
    picker.querySelector("summary").focus({ preventScroll: true });
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "answer" && !event.isComposing) restrictAnswerInput(event.target);
  if (event.target.id === "student-search") { state.filter = event.target.value; renderStudentList(); }
});
document.addEventListener("compositionend", event => {
  if (event.target.id === "answer") restrictAnswerInput(event.target);
});
document.addEventListener("change", event => {
  if (event.target.id === "class-filter") { state.classFilter = event.target.value; renderStudentList(); }
});
document.querySelector("#profile-button").addEventListener("click", () => openAccount());
document.querySelector("#stay-button").addEventListener("click", () => { confirmDialog.close(); document.querySelector("#answer")?.focus(); });
document.querySelector("#leave-button").addEventListener("click", () => { confirmDialog.close(); navigate(state.targetRoute || "play", { force: true }); });
window.addEventListener("beforeunload", event => { if ((state.game && state.stage !== "complete") || state.importing || state.changingTeacherAccess || state.changingStudent || state.adminBusy) { event.preventDefault(); event.returnValue = ""; } });
studentManageDialog.addEventListener("cancel", event => { if (state.changingStudent) event.preventDefault(); });
studentManageDialog.addEventListener("close", () => { state.pendingStudentAction = null; });
teacherAccessDialog.addEventListener("cancel", event => { if (state.changingTeacherAccess) event.preventDefault(); });
teacherAccessDialog.addEventListener("close", () => { state.pendingTeacherAccess = null; });
studentImportDialog.addEventListener("cancel", event => { if (state.importing) event.preventDefault(); });
studentImportDialog.addEventListener("close", () => {
  state.importDraft = null;
  state.importPreview = null;
  state.importBatch = null;
  document.querySelector("#student-import-content").replaceChildren();
});
window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "play"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  cancelAnimationFrame(state.frame);
  if (state.stage === "countdown") countdownTick();
  else if (state.game && state.stage === "playing") timerTick();
});

async function boot() {
  loadingPage("Multiplication Masters");
  data.store.onAccessRevoked = () => {
    stopTimers();
    state.game = null;
    state.stage = "intro";
    accountDialog.close();
    navigate("play", { force: true });
    toast("Student access is no longer available. Ask your teacher for help.");
  };
  await data.initialise();
  const route = location.hash.slice(1);
  navigate(route === "game" ? "play" : route || "play", { force: true });
  if (data.store.connectionError) toast(errorMessage(data.store.connectionError));
}

boot().catch(error => {
  main.innerHTML = `<section class="empty-state"><h1>Unable to load</h1><p>${esc(errorMessage(error))}</p><a class="button" href="./">Reload the game</a></section>`;
});
