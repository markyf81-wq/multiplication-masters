import { TABLES, newGame, currentCard, markFlash, markRetry, startQuiz, markQuiz, finishGame, gameStats } from "./game.js";
import * as data from "./store.js";
import { renderReadme } from "./guide.js";
import { connectClassroom, classroomRoster, forgetClassroomAccess } from "./classroom.js";

const main = document.querySelector("#main");
const accountDialog = document.querySelector("#account-dialog");
const confirmDialog = document.querySelector("#confirm-dialog");
const classroomDialog = document.querySelector("#classroom-dialog");
const state = {
  route: "play", table: 6, game: null, stage: "intro", locked: false,
  cardStarted: 0, quizStarted: 0, deadline: 0, frame: 0,
  timers: new Set(), renderId: 0, targetRoute: null, detailProfile: null,
  teacherStudents: [], teacherCursor: null, teacherMore: false,
  filter: "", classFilter: "", saving: false, saveError: null,
  classroomCourses: [], classroomStudents: [], classroomCourseId: "",
  importing: false, importVersion: 0, teacherClasses: [], importBatch: null,
};

const icons = {
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
  if (error?.code === "permission-denied") return "Access isn’t available for this account. Your teacher can help check the account setup.";
  if (error?.code === "auth/unauthorized-domain") return "This website’s address needs to be added to Firebase’s authorised domains.";
  return error?.message || "Something didn’t connect. Please try again.";
}

function updateHeader() {
  const profile = data.activeProfile();
  document.querySelector("#profile-label").textContent = profile?.nickname || (data.store.teacher ? "Teacher account" : "Let’s get started");
  document.querySelector(".profile-button .avatar").textContent = profile ? profile.nickname[0].toUpperCase() : "✦";
  document.querySelector("#teacher-nav").hidden = !data.isTeacher();
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = link.dataset.route === state.route
      || (state.route === "game" && link.dataset.route === "play")
      || (state.route === "guide" && link.dataset.route === "teacher");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const strip = document.querySelector("#storage-strip");
  if (!data.store.storageAvailable) strip.textContent = "Your browser can’t save progress right now. Keep this page open, or allow site storage before playing.";
  else if (profile?.cloud && data.store.connectionError) strip.textContent = "Cloud connection unavailable. New results will stay on this device until you reconnect.";
  else if (profile?.cloud) strip.textContent = `Cloud account · ${profile.className || "No class yet"}`;
  else if (data.store.configured) strip.textContent = "Saved on this device · Sign in with Google to keep your progress at school and at home.";
  else strip.textContent = "Practice on this device · Google accounts and shared records will be available when Firebase is connected.";
  strip.classList.toggle("cloud-connected", !!profile?.cloud && !data.store.connectionError);
  document.body.classList.toggle("playing", state.route === "game");
}

function navigate(route, { force = false, keepDetail = false } = {}) {
  if (state.game && state.stage !== "complete" && state.route === "game" && route !== "game" && !force) {
    state.targetRoute = route;
    confirmDialog.showModal();
    return;
  }
  if (route !== "game") { stopTimers(); state.game = null; }
  if (!keepDetail) state.detailProfile = null;
  state.route = ["play", "progress", "medals", "teacher", "game", "guide"].includes(route) ? route : "play";
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
  if (state.route === "progress") { await renderProgress(renderId); return; }
  if (state.route === "guide") { await renderGuide(renderId); return; }
  renderHome();
}

function renderHome() {
  const profile = data.activeProfile();
  const summary = profile ? data.getSummary(profile) : { games: 0, accuracy: 0, bestScore: 0 };
  main.innerHTML = `
    <section class="welcome-row"><p>${profile ? `HELLO, ${esc(profile.nickname.toUpperCase())} <span aria-hidden="true">✦</span>` : "BIG THINGS START WITH LITTLE PRACTICE"}</p><span class="tiny-chip">${icon("clock")} A quick brain boost</span></section>
    <section class="hero" aria-labelledby="hero-heading">
      <div class="hero-copy"><span class="eyebrow">MEET YOUR NEXT LITTLE WIN</span><h1 id="hero-heading">Small cards.<br>Big <span class="highlight">confidence.</span></h1><p>A few minutes, a handful of flashcards, and a little more “I’ve got this”. Let’s make your times tables stick.</p><a class="text-link" href="#table-picker" data-scroll-picker>Pick a table to get started ${icon("arrow")}</a></div>
      <div class="hero-art" aria-hidden="true"><span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span><div class="art-card art-card-back"><span>YOU’VE GOT THIS</span><b>×</b></div><div class="art-card art-card-front"><span>A LITTLE EVERY TIME</span><b>6 <i>×</i> 4</b><span class="art-answer">24 <span>✓</span></span><small>One more thing you know.</small></div><span class="art-note">progress, one card at a time <span>↗</span></span><span class="art-orbit"></span></div>
    </section>
    <section class="play-layout" id="table-picker" aria-labelledby="table-heading">
      <div class="table-panel"><div class="section-heading"><div><span class="eyebrow">LET’S PRACTISE</span><h2 id="table-heading">Choose your times table</h2></div><span class="section-counter">01 — 12</span></div><p class="muted">Start with a favourite. Or give yourself a little challenge.</p>
        <div class="table-grid" role="group" aria-label="Choose a times table">${TABLES.map(table => `<button class="table-tile ${state.table === table ? "selected" : ""}" type="button" data-table="${table}" aria-pressed="${state.table === table}"><span class="tile-prefix">THE</span><strong>${table}<span>×</span></strong><span class="tile-caption">${profile?.medals?.includes(table) ? `${icon("check")} Mastered` : "times table"}</span></button>`).join("")}</div>
        <div class="start-row"><span>${icon("clock")} 12 cards <span class="dot-separator">·</span> 5 seconds each</span><button class="button" type="button" data-action="prepare-game">Start game · ${state.table}× ${icon("arrow")}</button></div>
      </div>
      <aside class="side-column"><section class="journey-card"><span class="eyebrow">YOUR LITTLE WINS</span><h2>Look at you grow.</h2><div class="journey-stats"><div><span class="stat-icon lilac">${icon("chart")}</span><strong>${summary.games}</strong><span>games played</span></div><div><span class="stat-icon butter">${icon("star")}</span><strong>${medalCount(profile)}<small>/12</small></strong><span>medals earned</span></div></div><div class="mini-track"><span style="width:${medalCount(profile) / 12 * 100}%"></span></div><p class="small muted">${medalCount(profile) === 12 ? "All twelve tables mastered. Look at that trophy!" : "A medal for every table. A trophy when you master them all."}</p><a class="text-link" href="#progress" data-link="progress">See your progress ${icon("arrow")}</a></section>
      <section class="how-card"><span class="eyebrow">SMALL STEPS, BIG WINS</span><h3>How it works</h3><ol class="how-list"><li><span>1</span><div><strong>Think fast</strong><p>Type an answer. Press Enter. You have 5 seconds per card.</p></div></li><li><span>2</span><div><strong>Make it stick</strong><p>Revisit the “not yet” pile at your own pace.</p></div></li><li><span>3</span><div><strong>Go for a medal</strong><p>Get all 12 first try to unlock the one-minute quiz.</p></div></li></ol></section></aside>
    </section>
    <section class="kind-note"><span aria-hidden="true">✦</span><p>“Not yet” just means you’re still learning. Every try helps it stick.</p><span aria-hidden="true">✦</span></section>
    ${!data.store.configured ? '<div class="setup-link"><button class="text-link" type="button" data-action="local-teacher">Explore the teacher desk on this device →</button></div>' : ""}
  `;
}

function medalShelf(profile, compact = false) {
  return `<div class="medal-grid ${compact ? "compact" : ""}">${TABLES.map(table => {
    const earned = profile?.medals?.includes(table);
    return `<div class="medal-item ${earned ? "earned" : "unearned"}"><span class="medal-drawing" aria-hidden="true">${icons.medal}</span><strong>${table}×</strong><span>${earned ? "Mastered!" : "Still growing"}</span></div>`;
  }).join("")}</div>`;
}

function renderMedals() {
  const profile = data.activeProfile();
  const complete = medalCount(profile) === 12;
  main.innerHTML = `<section class="page-heading"><span class="eyebrow">YOUR MEDAL CABINET</span><h1>Little wins. <span class="purple-text">Lasting confidence.</span></h1><p class="muted">Get all 12 flashcards right first try, then answer at least 19 of 20 quiz questions correctly in a minute.</p></section><section class="panel medal-panel"><div class="section-heading"><h2>${medalCount(profile)} of 12 tables mastered</h2><span class="tiny-chip">${icon("star")} Keep growing</span></div>${medalShelf(profile)}<div class="trophy-panel ${complete ? "earned" : ""}"><span class="trophy-drawing" aria-hidden="true">${icons.trophy}</span><div><h2>${complete ? "You’re a Multiplication Master!" : "The big little goal"}</h2><p>${complete ? "All 12 medals are yours. Every bit of practice added up to this." : "Collect all 12 medals to earn your Multiplication Masters trophy."}</p></div><strong>${medalCount(profile)} / 12</strong></div><button class="button" type="button" data-link="play">Choose a table ${icon("arrow")}</button></section>`;
}

function loadingPage(title) {
  main.innerHTML = `<section class="page-heading"><span class="eyebrow">ONE LITTLE MOMENT</span><h1>${title}</h1><p class="muted" role="status">Getting things ready…</p></section>`;
  main.setAttribute("aria-busy", "true");
}

async function renderProgress(renderId) {
  const profile = state.detailProfile || data.activeProfile();
  if (!profile) {
    main.innerHTML = `<section class="empty-state"><span class="empty-symbol">↗</span><h1>Your progress starts here.</h1><p>Play a game and your results will appear here. Every little win counts.</p><button class="button" type="button" data-link="play">Choose a table ${icon("arrow")}</button></section>`;
    return;
  }
  loadingPage("Your practice, adding up.");
  let games, connectionNotice = "";
  try { games = await data.gamesFor(profile.id); }
  catch { games = data.cachedGamesFor(profile.id); connectionNotice = '<p class="notice">Couldn’t load shared results. Showing the results already saved on this device.</p>'; }
  if (renderId !== state.renderId) return;
  main.removeAttribute("aria-busy");
  const summary = data.getSummary(profile, games);
  const lastGames = games.slice(0, 12).reverse();
  main.innerHTML = `<section class="page-heading">${state.detailProfile ? '<button class="text-link" type="button" data-link="teacher">← Back to teacher desk</button>' : '<span class="eyebrow">YOUR LEARNING JOURNEY</span>'}<h1>${state.detailProfile ? `${esc(profile.nickname)}’s progress` : "Practice makes progress."}</h1><p class="muted">${esc(profile.className)} <span class="dot-separator">·</span> Scores, speed and the little things that are starting to stick.</p></section>${connectionNotice}
    <section class="summary-grid" aria-label="Performance summary">${summaryCard("Games played", summary.games, "Every try is practice", "chart")}${summaryCard("First-try accuracy", summary.games ? `${summary.accuracy}%` : "—", "Across the flashcard rounds", "check")}${summaryCard("Best score", summary.games ? `${summary.bestScore}<small>/60</small>` : "—", "A maximum of 5 points per card", "star")}${summaryCard("Tables mastered", `${medalCount(profile)}<small>/12</small>`, "Medals earned in the quiz", "medal")}</section>
    <section class="panel chart-panel"><div class="section-heading"><div><span class="eyebrow">A LITTLE BETTER EVERY TIME</span><h2>Recent game scores</h2></div><span class="small muted">Out of 60 points</span></div>${lastGames.length ? `<div class="score-chart" role="img" aria-label="Recent scores: ${lastGames.map(game => `${game.table} times table, ${game.score} out of 60 on ${dateLabel(game.startedAt)}`).join("; ")}"><div class="chart-scale"><span>60</span><span>30</span><span>0</span></div><div class="chart-bars">${lastGames.map(game => `<div class="chart-column"><span class="bar-value">${game.score}</span><div class="bar-space"><span class="chart-bar" style="height:${Math.max(2, game.score / 60 * 100)}%"></span></div><span class="bar-label">${game.table}×</span></div>`).join("")}</div></div>` : '<div class="chart-empty">Your first game will plant the first bar here. <span aria-hidden="true">↗</span></div>'}</section>
    <section class="panel table-performance"><div class="section-heading"><h2>What’s sticking?</h2><span class="small muted">First-try accuracy by table</span></div><div class="table-tracks">${TABLES.map(table => {
      const attempts = games.filter(game => game.table === table);
      const accuracy = attempts.length ? Math.round(attempts.reduce((sum, game) => sum + gameStats(game).correct, 0) / (attempts.length * 12) * 100) : null;
      return `<div class="table-track"><strong>${table}×</strong><div class="mini-track"><span style="width:${accuracy || 0}%"></span></div><span>${accuracy === null ? "—" : `${accuracy}%`}</span></div>`;
    }).join("")}</div><p class="small muted">Based on the ${games.length} available recent game${games.length === 1 ? "" : "s"} shown below. Speed averages include timeouts.</p></section>
    <section class="history-section"><div class="section-heading"><h2>Game history</h2><span class="small muted">Newest first · up to 100 cloud games</span></div>${games.length ? games.map(historyRow).join("") : '<div class="empty-inline">No games just yet. Choose a table and give it a go.</div>'}</section>`;
}

function summaryCard(label, value, caption, symbol) {
  return `<div class="summary-card"><div class="summary-label">${icon(symbol)}<span>${label}</span></div><strong>${value}</strong><p>${caption}</p></div>`;
}

function historyRow(game) {
  const stats = gameStats(game);
  return `<details class="history-row"><summary><span class="history-table">${game.table}×</span><span class="history-date"><strong>${dateLabel(game.startedAt)}</strong><small>${stats.correct}/12 first try · ${seconds(stats.averageMs)} average</small></span><span class="history-score">${game.score}<small> / 60</small></span><span class="history-badge ${stats.medal ? "won" : ""}">${stats.medal ? "Medal earned" : `${stats.retries} retr${stats.retries === 1 ? "y" : "ies"}`}</span><span class="details-chevron" aria-hidden="true">⌄</span></summary><div class="history-detail">${game.quiz ? `<p class="quiz-history">Medal quiz: <strong>${game.quiz.correct}/20 correct</strong> · ${seconds(game.quiz.durationMs)} · ${game.quiz.passed ? "Passed" : game.quiz.endedBecause === "mistakes" ? "Ended after two mistakes" : game.quiz.endedBecause === "time" ? "Time ran out" : "Not passed"}</p>` : ""}<div class="scroll-table"><table><thead><tr><th>Equation</th><th>First try</th><th>Time</th><th>Retry attempts</th><th>Points</th></tr></thead><tbody>${game.cards.map(card => `<tr><th>${game.table} × ${card.multiplier} = ${game.table * card.multiplier}</th><td>${card.initialCorrect ? "Got it" : card.timedOut ? "Timed out" : `Not yet (${esc(card.initialAnswer || "blank")})`}</td><td>${seconds(card.responseMs)}</td><td>${card.retries.length || "—"}</td><td>${card.points}</td></tr>`).join("")}</tbody></table></div>${game.cloud && !game.synced ? '<p class="notice">Saved on this device; cloud upload pending.</p>' : ""}</div></details>`;
}

async function renderTeacher(renderId) {
  if (!data.isTeacher()) {
    main.innerHTML = `<section class="empty-state"><span class="empty-symbol">✦</span><h1>A little space for teachers.</h1><p>Sign in with an approved teacher Google account to view students across all classes.</p><button class="button" type="button" data-action="account">Open account ${icon("arrow")}</button>${!data.store.configured ? '<button class="text-link" type="button" data-action="local-teacher">Explore with profiles on this device</button>' : ""}</section>`;
    addTeacherGuideLink();
    return;
  }
  loadingPage("At the teacher desk.");
  try {
    const [result, savedClasses] = await Promise.all([data.students(), data.classes()]);
    if (renderId !== state.renderId) return;
    const classes = [...new Set([...savedClasses.map(item => item.name), ...result.students.flatMap(profile => profile.classNames || [profile.className])])]
      .filter(Boolean).sort().map(name => ({ id: name, name }));
    Object.assign(state, { teacherStudents: result.students, teacherCursor: result.cursor, teacherMore: result.more, teacherClasses: savedClasses });
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="page-heading"><span class="eyebrow">TEACHER DESK ${data.store.localTeacher ? "· THIS DEVICE" : ""}</span><h1>Little learners. <span class="purple-text">Big possibilities.</span></h1><p class="muted">Find any student across all classes, see what’s sticking, and spot where a little practice could help.</p></section>${data.store.localTeacher ? '<p class="notice">Local preview: these profiles and reports stay in this browser. Shared classes and Google accounts need Firebase connected.</p>' : ""}<section class="panel"><div class="section-heading"><h2>Students & classes</h2><span class="tiny-chip">All classes</span></div><div class="teacher-tools"><label class="search-field"><span class="sr-only">Search students</span><input type="search" id="student-search" placeholder="Find a student…" value="${esc(state.filter)}"></label><label><span class="sr-only">Filter by class</span><select id="class-filter"><option value="">All classes</option>${classes.map(item => `<option ${state.classFilter === item.name ? "selected" : ""} value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select></label></div><div id="student-list"></div><div class="load-more-row"><span id="student-count" class="small muted"></span><button class="button secondary small-button" type="button" data-action="load-students" ${state.teacherMore ? "" : "hidden"}>Load more students</button></div></section><div class="teacher-forms"><section class="panel"><span class="eyebrow">MAKE ROOM TO GROW</span><h2>Add a class</h2><form id="class-form" class="stack-form"><label>Class name<input name="className" placeholder="e.g. 4F" maxlength="24" required pattern="[A-Za-z0-9 _-]+"></label><button class="button secondary" type="submit">Add class +</button></form></section><section class="panel"><span class="eyebrow">A NEW LITTLE LEARNER</span><h2>Add a student</h2><form id="student-form" class="stack-form"><div class="field-pair"><label>Nickname<input name="nickname" placeholder="e.g. Alex" maxlength="32" required></label><label>Class<select name="className" required><option value="">Choose a class</option>${classes.map(item => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select></label></div><p class="small muted">No student password needed. Open a student’s game from this desk on a classroom device. Google sign-in gives students their own account for home.</p><button class="button" type="submit">Add student +</button></form></section></div>`;
    renderStudentList();
    addTeacherGuideLink();
    enhanceTeacherSetup();
  } catch (error) {
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="empty-state"><h1>Couldn’t open the teacher desk.</h1><p>${esc(errorMessage(error))}</p><button class="button" data-link="teacher" type="button">Try again</button></section>`;
    addTeacherGuideLink();
  }
}

function enhanceTeacherSetup() {
  const form = main.querySelector("#student-form");
  const label = document.createElement("label");
  label.innerHTML = 'School Google email<input name="email" type="email" required maxlength="254" placeholder="student@school.example" autocomplete="off">';
  form.querySelector(".field-pair").after(label);
  form.querySelector("p").textContent = "The student signs in with this Google account. If they already exist, their class is added without duplicating their progress. Device-only preview accounts stay in this browser until cloud setup is finished.";
  const panel = document.createElement("section");
  panel.className = "panel classroom-panel";
  panel.innerHTML = `<div><span class="eyebrow">BRING YOUR CLASS WITH YOU</span><h2>Already using Google Classroom?</h2><p class="muted">Choose a class, review its students, then import their Google accounts. You can also add students one at a time below.</p><p class="small muted">Read-only class and roster access. Importing won’t change Google Classroom or send invitations.</p></div><div><button class="button secondary" type="button" data-action="connect-classroom" ${data.store.teacher ? "" : "disabled"}>Import from Google Classroom ${icon("arrow")}</button>${!data.store.teacher ? '<p class="small muted">Available after Firebase and teacher Google sign-in are connected.</p>' : ""}</div>`;
  main.querySelector(".teacher-forms").before(panel);
}

function showClassroomCourses() {
  document.querySelector("#classroom-content").innerHTML = `<p class="muted">Choose one of the active classes you teach. Nothing is imported until you review and confirm the roster.</p>${state.classroomCourses.length ? `<form id="classroom-course-form" class="stack-form"><label>Your Google Classroom class<select name="courseId" required><option value="">Choose a class</option>${state.classroomCourses.map(course => `<option value="${esc(course.id)}">${esc(course.name)}${course.section ? ` · ${esc(course.section)}` : ""}</option>`).join("")}</select></label><button class="button" type="submit">Review students ${icon("arrow")}</button></form>` : '<p class="notice">No active classes were found for this teacher Google account. You can still create a class and add students manually.</p>'}`;
}

function showClassroomPreview() {
  const course = state.classroomCourses.find(item => item.id === state.classroomCourseId);
  const selected = state.classroomStudents.filter(item => item.email);
  const linkedClass = state.teacherClasses.find(item => item.classroomCourseId === course?.id);
  const defaultClass = (linkedClass?.name || course?.section || course?.name || "").slice(0, 24).toUpperCase();
  document.querySelector("#classroom-content").innerHTML = `<p class="muted">${esc(course?.name)} · ${selected.length} student Google account${selected.length === 1 ? "" : "s"} ready to import.</p><form id="classroom-import-form" class="stack-form"><label>Class name in Multiplication Masters<input name="className" required maxlength="24" value="${esc(defaultClass)}" placeholder="e.g. 4F"></label><p class="small muted">Use an existing class name to add these students to that class, or a new name to create it. Untick any students you don’t want to import. You can edit nicknames below.</p><div class="scroll-table classroom-roster"><table><thead><tr><th>Include</th><th>Nickname</th><th>School Google email</th></tr></thead><tbody>${state.classroomStudents.map((student, index) => `<tr><td><input class="roster-checkbox" name="include-${index}" type="checkbox" ${student.email ? "checked" : "disabled"} aria-label="Include ${esc(student.nickname)}"></td><td><input name="nickname-${index}" maxlength="32" value="${esc(student.nickname.slice(0, 32))}" aria-label="Nickname for ${esc(student.email || student.nickname)}"></td><td>${student.email ? esc(student.email) : '<span class="muted">Email unavailable · cannot import</span>'}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Existing students keep their nickname, history and medals. Their new class is added to the same account. Imports don’t remove students who are absent from this roster.</p><button class="button" type="submit" ${selected.length ? "" : "disabled"}>Import selected students ${icon("arrow")}</button><button class="text-link" type="button" data-action="classroom-back">← Choose a different class</button></form>`;
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
  loadingPage("The teacher’s project guide.");
  try {
    const response = await fetch(new URL("../README.md", import.meta.url));
    if (!response.ok) throw new Error("The project guide couldn’t be loaded.");
    const source = await response.text();
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="page-heading"><button class="text-link" type="button" data-link="teacher">← Back to teacher desk</button><span class="eyebrow">A GUIDE FOR TEACHERS</span><h1>How it all adds up.</h1><p class="muted">Using the game, understanding student records, and setting up the technology.</p></section><article class="panel guide-prose" aria-label="Multiplication Masters project README">${renderReadme(source)}</article><p class="small muted guide-source-note">This is the project README, displayed inside the app. <a class="text-link" href="./README.md" target="_blank" rel="noopener noreferrer">Open the original file →</a></p>`;
  } catch (error) {
    if (renderId !== state.renderId) return;
    main.removeAttribute("aria-busy");
    main.innerHTML = `<section class="empty-state"><h1>The guide didn’t load.</h1><p>${esc(errorMessage(error))}</p><button class="button" type="button" data-link="guide">Try again</button><p><a class="text-link" href="./README.md" target="_blank" rel="noopener noreferrer">Open the README file →</a></p></section>`;
  }
}

function renderStudentList() {
  const list = document.querySelector("#student-list");
  if (!list) return;
  const students = state.teacherStudents.filter(profile =>
    `${profile.nickname} ${profile.email || ""}`.toLowerCase().includes(state.filter.toLowerCase())
    && (!state.classFilter || (profile.classNames || [profile.className]).includes(state.classFilter)));
  document.querySelector("#student-count").textContent = `${students.length} matching · ${state.teacherStudents.length} loaded${state.teacherMore ? " · load more to search further" : ""}`;
  list.innerHTML = students.length ? `<div class="scroll-table"><table class="roster-table"><thead><tr><th>Student</th><th>Class</th><th>Games</th><th>Accuracy</th><th>Medals</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${students.map(profile => {
    const summary = data.getSummary(profile);
    return `<tr><th><span class="student-name"><span class="avatar">${esc(profile.nickname[0])}</span><span>${esc(profile.nickname)}${profile.email ? `<small class="student-email">${esc(profile.email)}</small>` : ""}</span></span></th><td>${esc((profile.classNames || [profile.className]).join(", "))}</td><td>${summary.games}</td><td>${summary.games ? `${summary.accuracy}%` : "—"}</td><td>${medalCount(profile)}/12</td><td class="roster-actions"><button class="text-link" type="button" data-report="${esc(profile.id)}">View progress</button><button class="button secondary small-button" type="button" data-play-student="${esc(profile.id)}">Open game</button></td></tr>`;
  }).join("")}</tbody></table></div>` : '<div class="empty-inline">No students found. Add a class and a student to get started.</div>';
}

function prepareGame() {
  let profile = data.activeProfile();
  if (!profile) {
    if (data.store.user && !data.store.teacher) { openAccount(); return; }
    profile = data.usePracticeProfile();
  }
  stopTimers();
  state.game = newGame(state.table, profile.id);
  state.stage = "countdown";
  state.locked = true;
  state.saveError = null;
  state.deadline = Date.now() + 5000;
  navigate("game", { force: true });
  countdownTick();
}

function countdownTick() {
  if (!state.game || state.stage !== "countdown") return;
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

function renderGame() {
  const game = state.game;
  if (state.stage === "complete") { renderResults(); return; }
  if (state.stage === "countdown") {
    main.innerHTML = `<section class="countdown-screen"><span class="eyebrow">THE ${game.table} TIMES TABLE</span><h1>Ready, maths master?</h1><p class="muted">Get your fingers ready. Your first card is on its way.</p><div class="countdown-ring" id="countdown-ring"><div><strong id="countdown-number" class="count-pop" role="timer" aria-live="polite">5</strong></div></div><p class="countdown-instruction">Type your answer. Press <kbd>Enter ↵</kbd></p><p class="small muted">Your 5 seconds per card start after this countdown.</p><button class="text-link" type="button" data-link="play">← Back to tables</button></section>`;
    return;
  }
  if (game.phase === "retry-ready") {
    const misses = game.cards.filter(card => !card.initialCorrect).length;
    main.innerHTML = `<section class="interlude"><div class="interlude-symbol peach">${icon("retry")}</div><span class="eyebrow">A LITTLE PRACTICE MAKES IT STICK</span><h1>Let’s turn “not yet”<br>into <span class="purple-text">“got it”.</span></h1><p>There ${misses === 1 ? "is 1 card" : `are ${misses} cards`} to revisit. No timer this time.<br>Type the whole equation and its answer, then press Enter.</p><div class="example-equation">${game.table} x ${game.cards.find(card => !card.initialCorrect).multiplier} = <span>your answer</span></div><p class="small muted">Spaces and uppercase or lowercase X are all fine.<br>If you miss one, the card will flip to show the answer for one second.</p><button class="button" type="button" data-action="start-retry">Let’s make it stick ${icon("arrow")}</button></section>`;
    return;
  }
  if (game.phase === "quiz-ready") {
    main.innerHTML = `<section class="interlude"><div class="celebration-symbol" aria-hidden="true">${icons.medal}</div><span class="eyebrow">TWELVE OUT OF TWELVE!</span><h1>Look at you.<br><span class="purple-text">Ready for a medal?</span></h1><p>You got every flashcard right first try. One final challenge:<br><strong>20 questions. 60 seconds. At least 19 correct.</strong></p><div class="quiz-rule-chips"><span>${icon("clock")} One-minute countdown</span><span>${icon("check")} One mistake allowed</span></div><p class="small muted">A second wrong answer ends the quiz. No worries if it takes another game.</p><button class="button" type="button" data-action="start-quiz">Start medal quiz ${icon("arrow")}</button></section>`;
    return;
  }
  const retry = game.phase === "retry";
  const quiz = game.phase === "quiz";
  const card = quiz ? null : currentCard(game);
  const multiplier = quiz ? game.quiz.questions[game.index] : card.multiplier;
  const total = retry ? game.cards.filter(item => !item.initialCorrect).length : quiz ? 20 : 12;
  const correctCount = game.cards.filter(item => item.initialCorrect).length + (retry ? game.index : 0);
  const notYetCount = game.cards.filter(item => item.initialCorrect === false).length - (retry ? game.index : 0);
  const phaseName = retry ? "MAKE IT STICK" : quiz ? "THE MEDAL QUIZ" : "THINK FAST";
  main.innerHTML = `<section class="game-top"><button class="text-link" type="button" data-link="play">← Leave game</button><span class="game-table-name">${game.table} TIMES TABLE</span><span class="score-chip">${icon("star")} ${game.score} <span>points</span></span></section><section class="game-intro"><span class="eyebrow">${phaseName}</span><h1>${retry ? "Take your time. You’ve got this." : quiz ? "Your medal is in sight." : "A little focus. A little faster."}</h1><p>${retry ? "Type the whole equation and answer. No rush." : quiz ? "Type the answer, then Enter. You can miss one." : "Type the answer, then press Enter. Trust what you know."}</p></section>
    <section class="game-board ${quiz ? "quiz-board" : ""}" aria-label="${retry ? "Retry round" : quiz ? "Medal quiz" : "Flashcard round"}">
      ${quiz ? `<aside class="pile quiz-count"><span class="pile-symbol butter">${icon("star")}</span><h2>Quiz progress</h2><strong>${game.quiz.correct}<small>/20</small></strong><span>correct answers</span><p>${game.quiz.wrong} / 2 mistakes</p></aside>` : `<aside class="pile got-pile"><span class="pile-symbol mint">${icon("check")}</span><h2>Got it</h2><strong>${correctCount}</strong><span>in the bag</span><div class="pile-cards mint" aria-hidden="true"><span></span><span></span><span>✓</span></div></aside>`}
      <div class="card-centre"><div class="card-meta"><span>${retry ? "PRACTICE CARD" : "CARD"} ${game.index + 1} <span class="muted">OF ${total}</span></span><span id="timer-label" role="timer" aria-label="${quiz ? "Quiz time remaining" : "Time remaining"}">${retry ? "∞ Take your time" : quiz ? "60.0s" : "5.0s"}</span></div>${retry ? "" : '<div class="timer-track" role="progressbar" aria-label="Time remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span id="timer-fill"></span></div>'}
      <div class="card-perspective"><div class="flashcard dealt" id="flashcard"><div class="card-face card-front"><span class="card-wordmark">multiplication masters<span>✦</span></span><span class="card-table-tag">${game.table} TIMES TABLE</span><div class="equation">${game.table} <span>×</span> ${multiplier} <span>=</span> <b>?</b></div><span class="card-caption">${retry ? "Let’s help this one stick." : quiz ? "One little step towards your medal." : "You know more than you think."}</span></div><div class="card-face card-back"><span class="card-wordmark">one more thing you know<span>✦</span></span><span class="back-label" id="back-label">LET’S REMEMBER THIS</span><div class="back-equation" id="back-equation">${game.table} × ${multiplier} = <strong>${game.table * multiplier}</strong></div><span class="card-caption" id="back-caption">Take a little look. Then give it another go.</span></div></div></div>
      <form class="answer-form ${retry ? "equation-form" : ""}" id="answer-form"><label class="sr-only" for="answer">${retry ? "Full equation and answer" : "Your answer"}</label><input id="answer" name="answer" type="text" inputmode="${retry ? "text" : "numeric"}" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${retry ? `${game.table} x ${multiplier} = ?` : "Your answer"}" maxlength="${retry ? "40" : "4"}" aria-describedby="answer-hint" required><button class="answer-submit" type="submit" aria-label="Submit answer">↵</button></form><p class="answer-hint" id="answer-hint">${retry ? "Include the equation, = sign and answer" : "Press Enter ↵ to send your answer"}</p><div class="answer-feedback" id="answer-feedback" role="status" aria-live="polite"></div></div>
      <aside class="pile not-yet-pile"><span class="pile-symbol ${quiz ? "lilac" : "peach"}">${icon(quiz ? "clock" : "retry")}</span><h2>${quiz ? "One minute" : "Not yet"}</h2><strong ${quiz ? 'id="quiz-side-time"' : ""}>${quiz ? Math.ceil(Math.max(0, state.deadline - Date.now()) / 1000) : notYetCount}</strong><span>${quiz ? "seconds to shine" : "a little more practice"}</span>${quiz ? '<p>19 out of 20 earns a medal.</p>' : '<div class="pile-cards peach" aria-hidden="true"><span></span><span></span><span>↻</span></div>'}</aside>
    </section><p class="game-kind-note">${retry ? "Getting it wrong is part of getting it right." : quiz ? "Stay steady. You can do this." : "Just you, a few cards, and a little more confidence."}</p>`;
}

function beginCard() {
  if (!state.game || state.stage !== "playing") return;
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

function showFeedback(correct, message, { showAnswer = false } = {}) {
  const card = document.querySelector("#flashcard");
  const feedback = document.querySelector("#answer-feedback");
  if (feedback) { feedback.textContent = message; feedback.className = `answer-feedback ${correct ? "correct" : "try-again"}`; }
  card?.classList.add(correct ? "correct-card" : "retry-card");
  if (!showAnswer) {
    document.querySelector("#back-equation").textContent = correct ? "Got it! ✓" : "Not yet. That’s okay.";
    document.querySelector("#back-caption").textContent = correct ? "One more thing you know." : "We’ll come back to this one.";
  }
  document.querySelector("#back-label").textContent = correct ? "A LITTLE WIN" : "STILL GROWING";
  card?.classList.add("is-flipped");
}

function submitFlash(timedOut = false) {
  if (state.locked || !state.game || state.game.phase !== "flash") return;
  timedOut ||= Date.now() >= state.deadline;
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markFlash(state.game, answer, Math.min(5000, Date.now() - state.cardStarted), timedOut);
  cancelAnimationFrame(state.frame);
  showFeedback(correct, correct ? "Got it! +5 points" : timedOut ? "Time’s up. We’ll practise this one together." : "Not yet. We’ll give this one another go.");
  delay(() => document.querySelector("#flashcard")?.classList.add(correct ? "fly-got" : "fly-not-yet"), 400);
  delay(() => {
    state.game.index++;
    if (state.game.index < 12) { beginCard(); return; }
    state.game.index = 0;
    state.stage = "break";
    state.game.phase = state.game.cards.every(card => card.initialCorrect) ? "quiz-ready" : "retry-ready";
    renderGame();
    main.focus({ preventScroll: true });
  }, 760);
}

function submitRetry() {
  if (state.locked || state.game?.phase !== "retry") return;
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markRetry(state.game, answer, Date.now() - state.cardStarted);
  const points = currentCard(state.game).points;
  showFeedback(correct, correct ? `That’s it! +${points} point${points === 1 ? "" : "s"}` : "Have a little look. Then try the whole equation again.", { showAnswer: true });
  if (correct) {
    delay(() => document.querySelector("#flashcard")?.classList.add("fly-got"), 400);
    delay(() => {
      state.game.index++;
      if (state.game.index >= state.game.cards.filter(card => !card.initialCorrect).length) completeGame();
      else beginCard();
    }, 760);
  } else {
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
      document.querySelector("#answer-feedback").textContent = "Your turn. You can do this.";
      input.focus({ preventScroll: true });
    }, 1640);
  }
}

function submitQuiz() {
  if (state.locked || state.game?.phase !== "quiz") return;
  if (Date.now() >= state.deadline) { endQuiz("time"); return; }
  const answer = document.querySelector("#answer").value;
  lockAnswer();
  const correct = markQuiz(state.game, answer, Date.now() - state.cardStarted);
  if (state.game.quiz.wrong >= 2) { endQuiz("mistakes"); return; }
  if (state.game.index === 20) { endQuiz("answered"); return; }
  showFeedback(correct, correct ? "Got it!" : "One mistake. You’re still in it.");
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
  stopTimers();
  state.stage = "complete";
  state.locked = true;
  state.saving = true;
  state.saveError = null;
  const record = finishGame(state.game);
  renderResults();
  main.focus({ preventScroll: true });
  try { await data.saveGame(record); }
  catch (error) { state.saveError = errorMessage(error); }
  state.saving = false;
  updateHeader();
  if (state.route === "game" && state.game?.id === record.id) renderResults();
}

function renderResults() {
  const game = state.game;
  const stats = gameStats(game);
  const profile = data.activeProfile();
  const trophy = medalCount(profile) === 12;
  const headline = stats.medal ? (trophy ? "You’re a Multiplication Master!" : `The ${game.table}s medal is yours!`) : "A little more confident.";
  const quizMessage = game.quiz && !stats.medal ? game.quiz.endedBecause === "mistakes" ? "Two quiz answers didn’t stick this time. Your perfect flashcard round still counts—come back for the medal whenever you like." : "The quiz timer ran out. Your perfect flashcard round still counts—another little practice will help." : "You’ve worked through every card. That’s twelve facts a little closer to sticking.";
  main.innerHTML = `<section class="results-heading"><div class="results-art ${stats.medal ? "medal-won" : ""}" aria-hidden="true">${stats.medal ? trophy ? icons.trophy : icons.medal : '<span>✓</span>'}</div><span class="eyebrow">${stats.medal ? "LOOK WHAT YOUR PRACTICE DID" : "ONE GAME. A LITTLE MORE KNOW-HOW."}</span><h1>${headline}</h1><p>${stats.medal ? `You answered ${game.quiz.correct} of 20 quiz questions correctly.<br>That’s the ${game.table} times table mastered. Nicely done.` : quizMessage}</p></section><section class="summary-grid results-stats">${summaryCard("Your score", `${game.score}<small>/60</small>`, "Points from your 12 flashcards", "star")}${summaryCard("First try", `${stats.correct}<small>/12</small>`, `${stats.accuracy}% straight into “got it”`, "check")}${summaryCard("Average time", seconds(stats.averageMs), "First round, including timeouts", "clock")}${summaryCard(game.quiz ? "Quiz result" : "Practice tries", game.quiz ? `${game.quiz.correct}<small>/20</small>` : stats.retries, game.quiz ? `${seconds(game.quiz.durationMs)} · ${stats.medal ? "medal earned" : "keep growing"}` : "Attempts in the retry round", game.quiz ? "medal" : "retry")}</section><section class="panel results-panel"><div class="section-heading"><h2>Every little card counts.</h2><span class="small muted">The ${game.table} times table</span></div><div class="result-facts">${[...game.cards].sort((a, b) => a.multiplier - b.multiplier).map(card => `<div class="result-fact ${card.initialCorrect ? "first-time" : "practised"}"><span>${game.table} × ${card.multiplier} = <strong>${game.table * card.multiplier}</strong></span><small>${card.initialCorrect ? "Got it first try" : `${card.retries.length} practice ${card.retries.length === 1 ? "try" : "tries"}`}</small><b>+${card.points}</b></div>`).join("")}</div><p class="save-status ${state.saveError ? "notice" : ""}" id="save-status" role="status">${state.saving ? "Saving your little wins…" : state.saveError ? `Saved on this device. Cloud upload pending: ${esc(state.saveError)}` : !data.store.storageAvailable ? "Your browser couldn’t save this result. Keep this page open to view it." : profile?.cloud ? "Your results are saved to your account." : "Your results are saved on this device."}</p>${state.saveError ? '<button type="button" class="text-link" data-action="sync">Retry cloud save →</button>' : ""}<div class="results-actions"><button class="button" type="button" data-link="play">Back to the tables ${icon("arrow")}</button><button class="button secondary" type="button" data-link="progress">See my progress ${icon("chart")}</button></div></section>${stats.medal ? '<div class="confetti" aria-hidden="true">' + Array.from({ length: 20 }, (_, index) => `<i style="--i:${index}"></i>`).join("") + '</div>' : ""}`;
}

function openAccount() {
  if (state.game && state.stage !== "complete") { toast("Finish your game before switching accounts."); return; }
  const profile = data.activeProfile();
  const content = document.querySelector("#account-content");
    content.innerHTML = `${profile ? `<div class="account-current"><span class="avatar">${esc(profile.nickname[0])}</span><div><strong>${esc(profile.nickname)}</strong><span>${esc(profile.className)} · ${profile.cloud ? "Google account" : "This device"}</span></div></div>` : ""}<button class="button google-button" type="button" data-action="google-login" ${data.store.configured ? "" : "disabled"}><span aria-hidden="true" class="google-g">G</span> Continue with Google</button>${!data.store.configured ? '<p class="small muted">Google sign-in will be available after the Firebase project is connected. You can play and save on this device now.</p>' : '<p class="small muted">Use your education Google account to keep your progress at school and at home.</p>'}<div class="form-divider"><span>or play on this device</span></div><form id="local-profile-form" class="stack-form"><div class="field-pair"><label>Nickname<input name="nickname" required maxlength="32" placeholder="e.g. Alex"></label><label>Class<input name="className" required maxlength="24" placeholder="e.g. 4F"></label></div><p class="small muted">No password needed. Use the same nickname and class in this browser to find your saved progress.</p><button class="button secondary" type="submit">Let’s go ${icon("arrow")}</button></form>${data.localProfiles().length ? `<details class="profile-switcher"><summary>Profiles saved on this device</summary><div>${data.localProfiles().map(item => `<button class="saved-profile" type="button" data-switch="${esc(item.id)}"><span class="avatar">${esc(item.nickname[0])}</span><span>${esc(item.nickname)} <small>${esc(item.className)}</small></span>${icon("arrow")}</button>`).join("")}</div></details>` : ""}${data.isTeacher() ? '<button class="text-link account-signout" type="button" data-action="teacher-desk">Open teacher desk →</button>' : ""}${profile || data.store.user ? '<button class="text-link account-signout" type="button" data-action="signout">Sign out / switch player</button>' : ""}`;
  if (!accountDialog.open) accountDialog.showModal();
}

async function performClassroomImport(batch) {
  if (state.importing || !data.store.teacher) return;
  state.importing = true;
  let processed = 0;
  const content = document.querySelector("#classroom-content");
  content.innerHTML = `<p class="muted">Adding the selected students to ${esc(batch.className)}.</p><progress id="import-progress" max="${batch.students.length}" value="0" aria-label="Students imported"></progress><p id="import-status" role="status">0 of ${batch.students.length} ready…</p><p class="small muted">Keep this page open while the roster is saved.</p>`;
  try {
    await data.addClass(batch.className, batch.courseId);
    for (const student of batch.students) {
      await data.addStudent(student.nickname, batch.className, student.email);
      processed++;
      document.querySelector("#import-progress").value = processed;
      document.querySelector("#import-status").textContent = `${processed} of ${batch.students.length} ready…`;
    }
    state.importBatch = null;
    state.importing = false;
    classroomDialog.close();
    toast(`${batch.students.length} student account${batch.students.length === 1 ? " is" : "s are"} ready in ${batch.className}.`);
    navigate("teacher");
  } catch (error) {
    content.innerHTML = `<p class="notice">${processed} of ${batch.students.length} students finished before the import stopped. ${esc(errorMessage(error))}</p><p class="small muted">You can safely retry the same import. Existing students keep their history and won’t be duplicated.</p><button class="button" type="button" data-action="retry-classroom-import">Retry this import</button>`;
  } finally { state.importing = false; }
}

async function handleAction(action, button) {
  if (action === "prepare-game") { prepareGame(); return; }
  if (action === "account") { openAccount(); return; }
  if (action === "local-teacher") {
    data.store.localTeacher = true;
    navigate("teacher");
    return;
  }
  if (action === "teacher-desk") { accountDialog.close(); navigate("teacher"); return; }
  if (action === "connect-classroom") {
    if (!data.store.teacher || !data.store.cloud) return;
    const version = ++state.importVersion;
    classroomDialog.showModal();
    document.querySelector("#classroom-content").innerHTML = '<p class="muted" role="status">Connect your teacher Google account to load its active classes. Nothing will be imported yet.</p>';
    button.disabled = true;
    try {
      const courses = await connectClassroom(data.store.cloud);
      if (!classroomDialog.open || version !== state.importVersion) return;
      state.classroomCourses = courses;
      showClassroomCourses();
    } catch (error) {
      if (classroomDialog.open && version === state.importVersion) document.querySelector("#classroom-content").innerHTML = `<p class="notice">${esc(errorMessage(error))}</p><p class="small muted">Manual student setup is still available in the teacher desk.</p><button class="text-link" type="button" data-link="guide">Read Classroom setup instructions →</button>`;
    } finally { if (button.isConnected) button.disabled = false; }
    return;
  }
  if (action === "classroom-back") { showClassroomCourses(); return; }
  if (action === "retry-classroom-import") { await performClassroomImport(state.importBatch); return; }
  if (action === "start-retry") {
    state.game.phase = "retry";
    state.game.index = 0;
    state.stage = "playing";
    beginCard();
    return;
  }
  if (action === "start-quiz") {
    startQuiz(state.game);
    state.quizStarted = Date.now();
    state.deadline = state.quizStarted + 60000;
    state.stage = "playing";
    beginCard();
    return;
  }
  if (action === "google-login") {
    button.disabled = true;
    try {
      await data.loginGoogle();
      accountDialog.close();
      await data.syncPending().catch(() => toast("You’re signed in. Some previous results still need a cloud connection."));
      navigate(data.store.teacher ? "teacher" : "play");
    } finally { if (button.isConnected) button.disabled = false; }
    return;
  }
  if (action === "signout") {
    await data.logout();
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
      await data.syncPending();
      state.saveError = null;
      if (state.route === "game" && state.game?.id === gameId) renderResults();
      toast("Your results are saved to your account.");
    } finally { if (button.isConnected) button.disabled = false; }
  }
}

document.addEventListener("click", async event => {
  const close = event.target.closest("[data-close-dialog]");
  if (close) {
    if (close.closest("dialog") === classroomDialog && state.importing) { toast("Please wait for the import to finish."); return; }
    close.closest("dialog").close(); return;
  }
  const pickerLink = event.target.closest("[data-scroll-picker]");
  if (pickerLink) { event.preventDefault(); document.querySelector("#table-picker")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); return; }
  const tile = event.target.closest("[data-table]");
  if (tile) { state.table = Number(tile.dataset.table); renderHome(); document.querySelector(`[data-table="${state.table}"]`)?.focus({ preventScroll: true }); return; }
  const routeLink = event.target.closest("[data-link], a[data-route], a.brand");
  if (routeLink) {
    event.preventDefault();
    if (classroomDialog.open && !state.importing) classroomDialog.close();
    navigate(routeLink.dataset.link || routeLink.dataset.route || "play"); return;
  }
  const switcher = event.target.closest("[data-switch]");
  if (switcher) { data.setActive(switcher.dataset.switch); accountDialog.close(); navigate("play"); return; }
  const studentAction = event.target.closest("[data-report], [data-play-student]");
  if (studentAction) {
    const profile = state.teacherStudents.find(item => item.id === (studentAction.dataset.report || studentAction.dataset.playStudent));
    if (!profile) return;
    if (studentAction.dataset.report) { state.detailProfile = profile; navigate("progress", { keepDetail: true }); }
    else { data.setActive(profile.id); navigate("play"); toast(`Ready for ${profile.nickname}. Choose a table to play.`); }
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
  if (form.id === "classroom-course-form") {
    const version = state.importVersion;
    const courseId = String(fields.get("courseId") || "");
    if (!state.classroomCourses.some(course => course.id === courseId)) return;
    button.disabled = true;
    try {
      const students = await classroomRoster(courseId);
      if (!classroomDialog.open || version !== state.importVersion) return;
      state.classroomCourseId = courseId;
      state.classroomStudents = students;
      showClassroomPreview();
    } catch (error) { toast(errorMessage(error)); }
    finally { if (button.isConnected) button.disabled = false; }
    return;
  }
  const nickname = String(fields.get("nickname") || "").trim();
  const className = String(fields.get("className") || "").trim().toUpperCase();
  const email = String(fields.get("email") || "").trim().toLowerCase();
  if ((form.id.includes("profile") || form.id === "student-form") && !nickname) { toast("Please enter a nickname."); return; }
  if (!className || className.length > 24 || /[\/]/.test(className)) { toast("Please enter a class name without slashes, up to 24 characters."); return; }
  if (form.id === "classroom-import-form") {
    const students = state.classroomStudents.flatMap((student, index) => fields.has(`include-${index}`) && student.email ? [{ ...student, nickname: String(fields.get(`nickname-${index}`) || "").trim() }] : []);
    if (!students.length) { toast("Choose at least one student to import."); return; }
    if (students.some(student => !student.nickname)) { toast("Please enter a nickname for every selected student."); return; }
    state.importBatch = { className, courseId: state.classroomCourseId, students };
    await performClassroomImport(state.importBatch);
    return;
  }
  if (button) button.disabled = true;
  try {
    if (form.id === "local-profile-form") {
      data.useLocalProfile(nickname, className);
      accountDialog.close();
      navigate("play");
    } else if (form.id === "class-form") {
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

document.addEventListener("input", event => {
  if (event.target.id === "student-search") { state.filter = event.target.value; renderStudentList(); }
});
document.addEventListener("change", event => {
  if (event.target.id === "class-filter") { state.classFilter = event.target.value; renderStudentList(); }
});
document.querySelector("#profile-button").addEventListener("click", () => openAccount());
document.querySelector("#stay-button").addEventListener("click", () => { confirmDialog.close(); document.querySelector("#answer")?.focus(); });
document.querySelector("#leave-button").addEventListener("click", () => { confirmDialog.close(); navigate(state.targetRoute || "play", { force: true }); });
window.addEventListener("beforeunload", event => { if ((state.game && state.stage !== "complete") || state.importing) { event.preventDefault(); event.returnValue = ""; } });
classroomDialog.addEventListener("cancel", event => { if (state.importing) event.preventDefault(); });
classroomDialog.addEventListener("close", () => {
  state.importVersion++;
  state.classroomStudents = [];
  state.classroomCourses = [];
  state.importBatch = null;
  forgetClassroomAccess();
});
window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "play"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  cancelAnimationFrame(state.frame);
  if (state.stage === "countdown") countdownTick();
  else if (state.game && state.stage === "playing") timerTick();
});

async function boot() {
  loadingPage("Hello, maths master.");
  await data.initialise();
  const route = location.hash.slice(1);
  navigate(route === "game" ? "play" : route || "play", { force: true });
  if (data.store.connectionError) toast(errorMessage(data.store.connectionError));
  else if (data.store.user) data.syncPending().then(count => {
    updateHeader();
    if (count && state.route !== "game") render();
  }).catch(() => toast("Some results are saved on this device and still need to upload."));
}

boot().catch(error => {
  main.innerHTML = `<section class="empty-state"><h1>A little hiccup.</h1><p>${esc(errorMessage(error))}</p><a class="button" href="./">Reload the game</a></section>`;
});
