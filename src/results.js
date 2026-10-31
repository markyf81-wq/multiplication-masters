import { gameStats, TABLES, GAME_PAGE_SIZE } from "./game.js";
import { classNamesFor, classLabel, matchesClass, UNASSIGNED_CLASS, classOptionLabel } from "./student-profile.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const colours = ["#5140a4", "#28735c", "#a54e28", "#236d99", "#9c3974", "#665e17"];
const tableColours = ["#6842c2", "#087f5b", "#c2410c", "#0369a1", "#be185d", "#78620b", "#4f46e5", "#159ca0", "#b91c1c", "#8b5b2b", "#a21caf", "#475569"];
const dayKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const shortDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const fullDate = value => new Date(value).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const inClass = matchesClass;

function summarise(games) {
  const completed = games.filter(game => game.phase === "complete");
  const correct = games.reduce((total, game) => total + gameStats(game).correct, 0);
  const missed = games.reduce((total, game) => total + gameStats(game).notYet, 0);
  const milliseconds = games.reduce((total, game) => total + (game.firstRound?.totalResponseMs ?? game.cards.reduce((sum, card) => sum + card.responseMs, 0)), 0);
  return { count: games.length, completed: completed.length, correct, missed,
    gotIt: games.length ? Math.round(correct / games.length * 10) / 10 : null,
    notYet: games.length ? Math.round(missed / games.length * 10) / 10 : null,
    accuracy: games.length ? Math.round(correct / (games.length * 12) * 100) : null,
    seconds: games.length ? (milliseconds / (games.length * 12000)).toFixed(1) : null };
}

function dailyPoints(games, metric) {
  const days = new Map();
  for (const game of games) {
    const key = dayKey(game.startedAt);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(game);
  }
  return [...days].sort(([first], [second]) => first.localeCompare(second)).map(([day, records]) => ({ day, value: summarise(records)[metric], count: records.length })).filter(point => point.value !== null);
}

function lineChart(series, maximum, label) {
  const stamp = point => new Date(point.time || `${point.day}T12:00:00`).getTime();
  const times = [...new Set(series.flatMap(item => item.points.map(stamp)))].sort((first, second) => first - second);
  if (!times.length) return '<p class="empty-inline">No games in this selection.</p>';
  const left = 45, right = 690, top = 24, bottom = 220;
  const start = times[0], end = times.at(-1);
  const x = time => end === start ? (left + right) / 2 : left + (time - start) / (end - start) * (right - left);
  const timed = series.some(item => item.points.some(point => point.time));
  const tickLabel = time => timed && end - start < 86400000 ? new Date(time).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", ...(end - start < 120000 ? { second: "2-digit" } : {}) }) : shortDate(dayKey(time));
  const y = value => bottom - value / maximum * (bottom - top);
  const ticks = (end === start ? [start] : [start, (start + end) / 2, end])
    .map(time => ({ time, label: tickLabel(time) }))
    .filter((tick, index, values) => !values.slice(0, index).some(previous => previous.label === tick.label));
  return `<div class="report-chart-scroll"><svg class="report-line" viewBox="0 0 720 265" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>
    ${[0, maximum / 2, maximum].map(value => `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" class="report-grid-line"/><text x="${left - 10}" y="${y(value) + 5}" text-anchor="end">${value}</text>`).join("")}
    ${ticks.map(tick => `<text x="${x(tick.time)}" y="250" text-anchor="${end === start ? "middle" : tick.time === start ? "start" : tick.time === end ? "end" : "middle"}">${esc(tick.label)}</text>`).join("")}
    ${series.map((item, index) => `<polyline fill="none" stroke="${(item.colour || colours[index % colours.length])}" stroke-width="3" ${index && !item.solid ? `stroke-dasharray="${index * 3 + 3} 3"` : ""} points="${item.points.map(point => `${x(stamp(point))},${y(point.value)}`).join(" ")}"/>${item.points.map(point => `<circle cx="${x(stamp(point))}" cy="${y(point.value)}" r="4.5" fill="${(item.colour || colours[index % colours.length])}"><title>${esc(item.label)} · ${esc(point.time ? fullDate(point.time) : point.day)}: ${point.value}${point.detail ? ` · ${esc(point.detail)}` : ` (${point.count} rounds)`}</title></circle>`).join("")}`).join("")}
  </svg></div><ul class="report-legend">${series.map((item, index) => `<li><span style="background:${(item.colour || colours[index % colours.length])}"></span>${esc(item.label)}</li>`).join("")}</ul>`;
}

function answerPie(summary) {
  if (!summary.count) return '<p class="empty-inline">No answers in this selection.</p>';
  const circumference = 2 * Math.PI * 64;
  const correctArc = summary.correct / (summary.count * 12) * circumference;
  return `<div class="report-pie"><svg viewBox="0 0 180 180" role="img" aria-label="First-round answers: ${summary.correct} correct, ${summary.missed} missed"><title>First-round answers: ${summary.correct} correct, ${summary.missed} missed</title><circle cx="90" cy="90" r="64" fill="none" stroke="#ad5638" stroke-width="28"/><circle cx="90" cy="90" r="64" fill="none" stroke="#28735c" stroke-width="28" stroke-dasharray="${correctArc} ${circumference}" transform="rotate(-90 90 90)"/><text x="90" y="95" text-anchor="middle">${summary.accuracy}%</text></svg><ul class="report-legend"><li><span style="background:#28735c"></span>Got it: ${summary.correct}</li><li><span style="background:#ad5638"></span>Not yet: ${summary.missed}</li></ul></div>`;
}

function renderReport(target, groups, failures, table, description) {
  const records = groups.flatMap(group => group.games.filter(game => !table || game.table === table).map(game => ({ ...game, student: group.student })));
  const summary = summarise(records);
  const chronological = records.slice().sort((first, second) => first.startedAt.localeCompare(second.startedAt));
  const tableProgress = TABLES.map((timesTable, index) => ({
    label: `${timesTable}×`, colour: tableColours[index], solid: true,
    points: chronological.filter(game => game.table === timesTable).map(game => ({
      time: game.startedAt, value: gameStats(game).correct,
      detail: `${game.student.nickname} · Got it out of 12`,
    })),
  })).filter(series => series.points.length);
  const days = dailyPoints(records, "gotIt");
  const capped = groups.filter(group => group.more).length;
  const tableRows = groups.map(group => {
    const games = group.games.filter(game => !table || game.table === table);
    const stats = summarise(games);
    return `<tr><th><button class="text-link" type="button" data-result-student="${esc(group.student.id)}">${esc(group.student.nickname)}</button><small class="student-email">${esc(group.student.email)}</small></th><td>${esc(classLabel(group.student))}</td><td>${stats.count}</td><td>${stats.completed}</td><td>${stats.gotIt ?? "—"}</td><td>${stats.notYet ?? "—"}</td><td>${stats.accuracy === null ? "—" : `${stats.accuracy}%`}</td><td>${stats.seconds === null ? "—" : `${stats.seconds}s`}</td><td>${group.student.medals?.length || 0}/12</td></tr>`;
  }).join("");
  const recent = records.slice().sort((first, second) => second.startedAt.localeCompare(first.startedAt)).slice(0, 100);
  target.innerHTML = `<p class="report-scope muted">${esc(description)} · ${groups.length} student${groups.length === 1 ? "" : "s"} loaded${table ? ` · ${table}× table` : ""}</p>
    ${failures.length ? `<p class="notice" role="alert">Results unavailable for ${failures.map(item => esc(item.nickname)).join(", ")}. They are excluded from the charts and totals. Select Show results to retry.</p>` : ""}
    ${capped ? `<p class="notice">Older games may be available for ${capped} student${capped === 1 ? "" : "s"}. Charts and totals use the games loaded. Use Load older games to extend the report.</p>` : ""}
    <section class="summary-grid" aria-label="Selected results">${[["First rounds", summary.count], ["Completed games", summary.completed], ["First-try accuracy", summary.accuracy === null ? "—" : `${summary.accuracy}%`], ["Average answer time", summary.seconds === null ? "—" : `${summary.seconds}<small>s</small>`]].map(([label, value]) => `<div class="summary-card"><div class="summary-label">${label}</div><strong>${value}</strong></div>`).join("")}</section>
    <section class="panel"><h2>Got it by times table</h2><p class="small muted">Each colour is a times table. Each point is one game's first-round Got it count, out of 12.${groups.length > 1 ? " Games from the selected students share each table's line." : ""} Hover over a point for the student and date.</p>${lineChart(tableProgress, 12, "First-round Got it counts per game over time, with a different coloured line for each times table")}
      <details class="report-data"><summary>View games in this graph</summary><div class="scroll-table"><table><thead><tr><th>Date and time</th><th>Student</th><th>Times table</th><th>Got it /12</th></tr></thead><tbody>${chronological.map(game => `<tr><td>${esc(fullDate(game.startedAt))}</td><th>${esc(game.student.nickname)}</th><td>${game.table}×</td><td>${gameStats(game).correct}</td></tr>`).join("") || '<tr><td colspan="4">No games in this selection.</td></tr>'}</tbody></table></div></details>
    </section>
    <section class="panel"><h2>First-round answers</h2>${answerPie(summary)}</section>
    <details class="panel report-data"><summary>View daily chart data</summary><div class="scroll-table"><table><thead><tr><th>Date</th><th>Games</th><th>Average Got it /12</th><th>Average Not yet /12</th><th>Accuracy</th></tr></thead><tbody>${days.map(point => `<tr><th>${esc(point.day)}</th><td>${point.count}</td><td>${point.value}</td><td>${summarise(records.filter(game => dayKey(game.startedAt) === point.day)).notYet}</td><td>${summarise(records.filter(game => dayKey(game.startedAt) === point.day)).accuracy}%</td></tr>`).join("") || '<tr><td colspan="5">No games in this selection.</td></tr>'}</tbody></table></div></details>
    <section class="panel"><h2>Student results</h2><p class="small muted">First-round counts include games left after phase one. Medals show current totals.</p><div class="scroll-table"><table><thead><tr><th>Student</th><th>Classes</th><th>First rounds</th><th>Completed</th><th>Avg Got it /12</th><th>Avg Not yet /12</th><th>Accuracy</th><th>Answer time</th><th>Medals</th></tr></thead><tbody>${tableRows || '<tr><td colspan="9">No student results available.</td></tr>'}</tbody></table></div></section>
    <section class="panel"><h2>Recent games</h2><p class="small muted">Newest ${recent.length} of ${records.length} loaded games.</p><div class="scroll-table"><table><thead><tr><th>Date</th><th>Student</th><th>Table</th><th>Got it</th><th>Not yet</th><th>Status</th><th>Quiz</th></tr></thead><tbody>${recent.map(game => `<tr><td>${esc(fullDate(game.startedAt))}${game.firstRound?.completedAt ? `<small class="student-email">First round: ${esc(fullDate(game.firstRound.completedAt))}</small>` : ""}</td><th><button class="text-link" type="button" data-result-student="${esc(game.student.id)}">${esc(game.student.nickname)}</button></th><td>${game.table}×</td><td>${gameStats(game).correct}</td><td>${gameStats(game).notYet}</td><td>${game.phase === "complete" ? "Complete" : "First round saved"}</td><td>${game.quiz ? game.quiz.passed ? "Passed" : "Not passed" : "—"}</td></tr>`).join("") || '<tr><td colspan="7">No games in this selection.</td></tr>'}</tbody></table></div></section>`;
}

export async function renderTeacherResults({ container, data, isCurrent, errorMessage, openStudent }) {
  if (!data.isTeacher()) {
    container.innerHTML = '<section class="empty-state"><h1>Results</h1><p>Sign in with an approved teacher Google account.</p><button class="button" type="button" data-action="account">Sign in</button></section>';
    return;
  }
  container.innerHTML = '<section class="page-heading"><h1>Results</h1><p role="status">Loading students…</p></section>';
  let roster, classes;
  try { [roster, classes] = await Promise.all([data.students(), data.classes()]); }
  catch (error) {
    if (isCurrent()) container.innerHTML = `<section class="empty-state"><h1>Results unavailable</h1><p>${esc(errorMessage(error))}</p><button class="button" type="button" data-link="results">Try again</button></section>`;
    return;
  }
  if (!isCurrent()) return;
  let students = roster.students, cursor = roster.cursor, more = roster.more;
  let selectedIds = null, version = 0, loading = false, loadedGroups = null, failures = [], loadedRange = null;
  let gamesByStudent = new Map();
  const today = new Date(), monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);
  const defaultFrom = dayKey(monthAgo), defaultTo = dayKey(today);
  container.innerHTML = `<section class="page-heading"><h1>Results</h1><p class="muted">Compare student progress and review game results.</p></section><section class="panel"><form id="results-filter-form" class="report-filters">
    <label>Class<select name="className"><option value="">All classes</option></select></label>
    <div class="report-student-field" role="group" aria-labelledby="report-students-label"><span id="report-students-label">Students</span><details class="student-picker"><summary id="report-selection-label">All students</summary><div class="student-picker-content"><label><span class="sr-only">Find a student</span><input type="search" id="report-student-search" placeholder="Find a student…" autocomplete="off"></label><div class="student-picker-buttons"><button type="button" class="text-link" data-select-students="all">Select all</button><button type="button" class="text-link" data-select-students="none">Clear selection</button></div><div id="report-student-options"></div></div></details></div>
    <label>Times table<select name="table" disabled><option value="">Load results first</option></select></label>
    <div class="report-date-range" role="group" aria-label="Date range"><label>From<input name="from" type="date" required value="${defaultFrom}"></label><label>To<input name="to" type="date" required value="${defaultTo}"></label></div><button class="button" type="submit">Show results</button>
    <div class="report-roster-note"><span id="report-roster-count" class="small muted"></span><div class="report-filter-actions"><button class="text-link" type="button" id="report-clear-filters">Clear filters</button><button class="text-link" type="button" id="report-load-students">Load more students</button></div></div>
  </form><p id="report-load-status" class="small muted" role="status">Choose dates, then select Show results. Filters update together once results are loaded.</p></section><div id="teacher-report"></div>`;
  const form = container.querySelector("#results-filter-form");
  const options = container.querySelector("#report-student-options");
  const status = container.querySelector("#report-load-status");
  const report = container.querySelector("#teacher-report");
  const submit = form.querySelector('[type="submit"]');
  const searchInput = container.querySelector("#report-student-search");
  const picker = container.querySelector(".student-picker");
  const loadMore = container.querySelector("#report-load-students");
  const selected = student => selectedIds === null || selectedIds.has(student.id);
  const tableValue = () => Number(form.elements.table.value) || null;
  const matchingGames = (student, ignoreTable = false) => (gamesByStudent.get(student.id) || []).filter(game => ignoreTable || !tableValue() || game.table === tableValue());
  // Each facet applies every other selection, while leaving its own alternatives available.
  const facetStudents = facet => students.filter(student =>
    (facet === "class" || inClass(student, form.elements.className.value))
    && (facet === "student" || selected(student))
    && (loadedGroups === null || matchingGames(student, facet === "table").length > 0));
  function dateBounds() {
    form.elements.from.max = form.elements.to.value;
    form.elements.to.min = form.elements.from.value;
  }
  function renderOptions(resetScroll = false) {
    const scroll = resetScroll ? 0 : options.scrollTop;
    const classValue = form.elements.className.value;
    const activeTable = tableValue();
    const classCounts = new Map();
    for (const student of facetStudents("class")) {
      const count = loadedGroups === null ? 1 : matchingGames(student).length;
      for (const name of classNamesFor(student).length ? classNamesFor(student) : [UNASSIGNED_CLASS]) classCounts.set(name, (classCounts.get(name) || 0) + count);
    }
    const classNames = [...new Set([...classes.map(item => item.name), ...classCounts.keys(), ...(classValue ? [classValue] : [])])].sort();
    form.elements.className.innerHTML = '<option value="">All classes</option>' + classNames.filter(name => classCounts.has(name) || name === classValue).map(name => `<option value="${esc(name)}" ${name === classValue ? "selected" : ""} ${!classCounts.has(name) ? "disabled" : ""}>${esc(classOptionLabel(name))} (${classCounts.get(name) || 0}${loadedGroups === null ? " students" : " games"})</option>`).join("");
    const tableCounts = new Map();
    if (loadedGroups !== null) for (const student of facetStudents("table")) for (const game of matchingGames(student, true)) tableCounts.set(game.table, (tableCounts.get(game.table) || 0) + 1);
    form.elements.table.innerHTML = `<option value="">${loadedGroups === null ? "Load results first" : "All tables"}</option>` + TABLES.filter(table => tableCounts.has(table) || table === activeTable).map(table => `<option value="${table}" ${table === activeTable ? "selected" : ""} ${!tableCounts.has(table) ? "disabled" : ""}>${table}× (${tableCounts.get(table) || 0} games)</option>`).join("");
    form.elements.table.disabled = loadedGroups === null;
    const available = facetStudents("student");
    const availableIds = new Set(available.map(student => student.id));
    const visible = students.filter(student => availableIds.has(student.id) || selectedIds?.has(student.id));
    const search = searchInput.value.trim().toLowerCase();
    const matches = visible.filter(student => `${student.nickname} ${student.email}`.toLowerCase().includes(search));
    container.querySelector("#report-selection-label").textContent = selectedIds === null ? `All matching students (${available.length})` : `${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"} selected`;
    options.innerHTML = matches.map(student => `<label class="student-picker-option"><input type="checkbox" value="${esc(student.id)}" ${selected(student) ? "checked" : ""}><span>${esc(student.nickname)}${student.active === false ? " · disabled" : ""}<small>${esc(student.email)}${!availableIds.has(student.id) ? " · Outside current filters" : loadedGroups !== null ? ` · ${matchingGames(student).length} games` : ""}</small></span></label>`).join("") || '<p class="small muted">No matching students. Clear filters or load more students.</p>';
    options.scrollTop = scroll;
    container.querySelector("#report-roster-count").textContent = `${students.length} students loaded${more ? " · load more to include further students" : ""}. Games load ${GAME_PAGE_SIZE} at a time per student.`;
    loadMore.hidden = !more;
    loadMore.disabled = loading;
    submit.disabled = loading;
    submit.textContent = loading ? "Loading…" : loadedGroups === null ? "Show results" : "Refresh results";
    dateBounds();
  }
  function updateReport() {
    renderOptions();
    if (loading || loadedGroups === null) return;
    const table = tableValue();
    const groups = loadedGroups.filter(group => selected(group.student) && inClass(group.student, form.elements.className.value) && group.games.some(game => !table || game.table === table));
    const unavailable = failures.filter(student => selected(student) && inClass(student, form.elements.className.value));
    const description = `${form.elements.className.value ? classOptionLabel(form.elements.className.value) : "All classes"} · ${form.elements.from.value} to ${form.elements.to.value}`;
    renderReport(report, groups, unavailable, table, description);
    const older = loadedGroups.filter(group => group.more && selected(group.student) && inClass(group.student, form.elements.className.value));
    if (older.length) report.insertAdjacentHTML("afterbegin", '<div class="report-more-row"><button class="button secondary" type="button" data-report-more>Load older games</button></div>');
    const count = groups.reduce((total, group) => total + group.games.filter(game => !table || game.table === table).length, 0);
    status.textContent = `${count} matching games · ${groups.length} students${failures.length ? ` · ${failures.length} students unavailable` : ""}. Filters use the loaded date range.`;
  }
  function clearLoadedResults(message) {
    version++;
    loading = false;
    loadedGroups = null;
    loadedRange = null;
    gamesByStudent = new Map();
    failures = [];
    report.replaceChildren();
    renderOptions();
    status.textContent = message;
  }
  renderOptions();
  form.addEventListener("change", event => {
    if (["from", "to"].includes(event.target.name)) {
      clearLoadedResults("Dates changed. Select Show results to load this range.");
      return;
    }
    const focusedStudent = event.target.closest("#report-student-options") ? event.target.value : null;
    if (focusedStudent) {
      if (selectedIds === null) selectedIds = new Set(facetStudents("student").map(student => student.id));
      if (event.target.checked) selectedIds.add(focusedStudent); else selectedIds.delete(focusedStudent);
    }
    updateReport();
    if (focusedStudent) [...options.querySelectorAll("input")].find(input => input.value === focusedStudent)?.focus({ preventScroll: true });
  });
  searchInput.addEventListener("input", () => renderOptions(true));
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") event.preventDefault();
  });
  form.addEventListener("click", async event => {
    const selection = event.target.closest("[data-select-students]");
    if (selection) { selectedIds = selection.dataset.selectStudents === "all" ? null : new Set(); updateReport(); return; }
    if (event.target.id === "report-clear-filters") {
      const datesChanged = form.elements.from.value !== defaultFrom || form.elements.to.value !== defaultTo;
      selectedIds = null;
      form.elements.className.value = "";
      form.elements.table.value = "";
      form.elements.from.value = defaultFrom;
      form.elements.to.value = defaultTo;
      searchInput.value = "";
      picker.open = false;
      if (datesChanged) clearLoadedResults("Filters cleared. Select Show results for the last 30 days.");
      else updateReport();
      return;
    }
    if (event.target.id !== "report-load-students" || loading) return;
    loadMore.disabled = true;
    try {
      const next = await data.students(cursor);
      if (!isCurrent()) return;
      const known = new Set(students.map(student => student.id));
      students = students.concat(next.students.filter(student => !known.has(student.id)));
      cursor = next.cursor; more = next.more;
      clearLoadedResults("More students loaded. Select Show results to include their games.");
    } catch (error) { if (isCurrent()) status.textContent = errorMessage(error); }
    finally { if (loadMore.isConnected) loadMore.disabled = false; }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault(); event.stopPropagation();
    if (loading || !isCurrent() || !form.reportValidity()) return;
    const from = new Date(`${form.elements.from.value}T00:00:00`);
    const until = new Date(`${form.elements.to.value}T00:00:00`);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime()) || from > until) { status.textContent = "Choose a valid date range, with From before To."; return; }
    until.setDate(until.getDate() + 1);
    const range = { from: from.toISOString(), until: until.toISOString() };
    const refresh = loadedGroups !== null;
    const requestVersion = ++version;
    const current = () => isCurrent() && version === requestVersion;
    // Load the date range once for the loaded roster so every facet can offer alternatives.
    const targets = students.slice(), groups = [], unavailable = [];
    let nextIndex = 0, completed = 0;
    loading = true;
    report.replaceChildren();
    picker.open = false;
    renderOptions();
    status.textContent = `Loading results: 0 of ${targets.length} students…`;
    async function worker() {
      while (current() && nextIndex < targets.length) {
        const student = targets[nextIndex++];
        try {
          const games = await data.reportGamesFor(student.id, range, { refresh });
          groups.push({ student, games, more: games.length === GAME_PAGE_SIZE });
        }
        catch { unavailable.push(student); }
        completed++;
        if (current()) status.textContent = `Loading results: ${completed} of ${targets.length} students…`;
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
    if (!current()) return;
    groups.sort((first, second) => first.student.nickname.localeCompare(second.student.nickname));
    loadedGroups = groups;
    loadedRange = range;
    gamesByStudent = new Map(groups.map(group => [group.student.id, group.games]));
    failures = unavailable;
    loading = false;
    updateReport();
  });
  report.addEventListener("click", async event => {
    const moreButton = event.target.closest("[data-report-more]");
    if (moreButton) {
      if (loading || !loadedRange || !isCurrent()) return;
      const requestVersion = version;
      const current = () => isCurrent() && version === requestVersion;
      const range = loadedRange;
      const targets = loadedGroups.filter(group => group.more && selected(group.student) && inClass(group.student, form.elements.className.value));
      let next = 0, finished = 0;
      const failed = [];
      loading = true;
      moreButton.disabled = true;
      moreButton.textContent = "Loading…";
      renderOptions();
      async function worker() {
        while (current() && next < targets.length) {
          const group = targets[next++];
          try {
            const page = await data.reportGamesFor(group.student.id, { ...range, after: group.games.at(-1) });
            if (!current()) return;
            group.games = [...new Map([...group.games, ...page].map(game => [game.id, game])).values()];
            group.more = page.length === GAME_PAGE_SIZE;
            gamesByStudent.set(group.student.id, group.games);
          } catch { failed.push(group.student.nickname); }
          finished++;
          if (current()) status.textContent = `Loading older games: ${finished} of ${targets.length} students…`;
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
      if (!current()) return;
      loading = false;
      updateReport();
      if (failed.length) status.textContent += ` Older games unavailable for ${failed.join(", ")}. Retry Load older games.`;
      return;
    }
    const button = event.target.closest("[data-result-student]");
    if (!button || !isCurrent()) return;
    const student = students.find(item => item.id === button.dataset.resultStudent);
    if (student) openStudent(student);
  });
}
