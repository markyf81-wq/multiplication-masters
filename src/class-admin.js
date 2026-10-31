import { classLabel } from "./student-profile.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
let previousController;

export function mountClassAdmin({ container, data, getClasses, getTeachers, getStudents, isCurrent, isBusy, setBusy, onChanged, errorMessage }) {
  previousController?.abort();
  const controller = new AbortController();
  previousController = controller;
  const signal = controller.signal;
  const panel = document.createElement("section");
  panel.className = "panel class-admin-panel";
  panel.innerHTML = `<div class="section-heading"><h2>Classes</h2><span class="small muted">Shared across teachers</span></div><div class="scroll-table"><table><thead><tr><th>Class</th><th>Assigned teacher</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${getClasses().map(item => {
    const assigned = getTeachers().find(teacher => teacher.email === item.teacherEmail);
    return `<tr><th>${esc(item.name)}${item.deleting ? '<small class="student-email">Deletion incomplete</small>' : ""}</th><td>${item.teacherEmail ? `${esc(item.teacherEmail)}${assigned && !assigned.enabled ? ' <span class="small muted">(disabled)</span>' : ""}` : "Unassigned"}</td><td><div class="roster-actions">${item.deleting ? "" : `<button class="text-link" type="button" data-class-manage="${esc(item.id)}">Assign teacher</button>`}<button class="text-link danger-link" type="button" data-class-delete="${esc(item.id)}">${item.deleting ? "Finish deletion" : "Delete class"}</button></div></td></tr>`;
  }).join("") || '<tr><td colspan="3">No classes yet. Add a class above.</td></tr>'}</tbody></table></div><dialog class="class-admin-dialog" aria-labelledby="class-admin-title"><h2 id="class-admin-title"></h2><div class="class-admin-content"></div><p class="notice admin-status" role="status" tabindex="-1" hidden></p></dialog>`;
  const anchor = container.querySelector(".teacher-forms");
  if (anchor) anchor.after(panel); else container.append(panel);
  const dialog = panel.querySelector("dialog");
  const title = dialog.querySelector("h2");
  const content = dialog.querySelector(".class-admin-content");
  const status = dialog.querySelector(".admin-status");
  let operation = null, busy = false;
  function open(heading, html, action) {
    if (!isCurrent() || isBusy()) return;
    title.textContent = heading;
    content.innerHTML = html;
    status.hidden = true;
    status.textContent = "";
    operation = action;
    dialog.showModal();
  }
  const actions = (label, danger = false) => `<div class="dialog-actions"><button class="button secondary" type="button" data-admin-cancel>Cancel</button><button class="button ${danger ? "danger-button" : ""}" type="submit">${label}</button></div>`;
  function progress(message) {
    if (!dialog.isConnected) return;
    status.hidden = false;
    status.textContent = message;
  }
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); }, { signal });
  container.addEventListener("click", event => {
    const cancel = event.target.closest("[data-admin-cancel]");
    if (cancel) { event.preventDefault(); event.stopPropagation(); if (!busy) dialog.close(); return; }
    const edit = event.target.closest("[data-edit-student]");
    if (edit) {
      const student = getStudents().find(item => item.id === edit.dataset.editStudent);
      if (!student || student.deleting) return;
      const classes = getClasses().filter(item => !item.deleting);
      const currentMissing = student.className && !classes.some(item => item.name === student.className);
      open("Edit student", `<p class="muted">${esc(student.email)}</p><form class="stack-form" data-admin-form><label>Name<input name="nickname" value="${esc(student.nickname)}" maxlength="32" autocomplete="off" required autofocus></label><label>Class<select name="className"><option value="">Unassigned</option>${currentMissing ? `<option value="${esc(student.className)}" selected>${esc(student.className)} (current)</option>` : ""}${classes.map(item => `<option value="${esc(item.name)}" ${student.className === item.name ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label><p class="small muted">Current classes: ${esc(classLabel(student))}. Choosing a different class moves the student there. Results and medals are kept.</p>${actions("Save student")}</form>`, { type: "student-edit", id: student.id });
      return;
    }
    const manage = event.target.closest("[data-class-manage]");
    if (manage) {
      const item = getClasses().find(item => item.id === manage.dataset.classManage);
      if (!item || item.deleting) return;
      const teachers = getTeachers().filter(teacher => teacher.enabled && !teacher.deleting);
      const currentMissing = item.teacherEmail && !teachers.some(teacher => teacher.email === item.teacherEmail);
      open(`Assign teacher · ${item.name}`, `<form class="stack-form" data-admin-form><label>Teacher<select name="teacherEmail"><option value="">Unassigned</option>${currentMissing ? `<option value="${esc(item.teacherEmail)}" selected>${esc(item.teacherEmail)} (current)</option>` : ""}${teachers.map(teacher => `<option value="${esc(teacher.email)}" ${teacher.email === item.teacherEmail ? "selected" : ""}>${esc(teacher.email)}</option>`).join("")}</select></label><p class="small muted">All approved teachers can still manage this class. Use Load more teachers in the Teachers section if someone is missing.</p>${actions("Save assignment")}</form>`, { type: "class-assign", id: item.id });
      return;
    }
    const deleteClass = event.target.closest("[data-class-delete]");
    if (deleteClass) {
      const item = getClasses().find(item => item.id === deleteClass.dataset.classDelete);
      if (!item) return;
      open(`${item.deleting ? "Finish deleting" : "Delete"} ${item.name}?`, `<p>Students in this class will be set to <strong>Unassigned</strong>. Their accounts, results and medals are kept. You can assign them to a class later.</p><p class="small muted">This removes their current class memberships. The class cannot be restored after deletion; a new class can be created.</p><form data-admin-form>${actions(item.deleting ? "Finish deletion" : "Delete class", true)}</form>`, { type: "class-delete", id: item.id });
      return;
    }
    const deleteTeacher = event.target.closest("[data-delete-teacher]");
    if (deleteTeacher) {
      const teacher = getTeachers().find(item => item.email === deleteTeacher.dataset.deleteTeacher);
      if (!teacher || teacher.email === data.store.user?.email?.toLowerCase()) return;
      open(`${teacher.deleting ? "Finish deleting teacher" : "Delete teacher"}?`, `<p><strong>${esc(teacher.email)}</strong> will lose teacher access. Their classes and students remain. Classes assigned to them become unassigned to a teacher.</p><p class="small muted">This removes their app teacher record. Their Google account is unchanged.</p><form data-admin-form>${actions(teacher.deleting ? "Finish deletion" : "Delete teacher", true)}</form>`, { type: "teacher-delete", email: teacher.email });
    }
  }, { signal });
  dialog.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!operation || busy || isBusy() || !isCurrent() || !event.target.reportValidity()) return;
    const action = operation;
    const fields = new FormData(event.target);
    busy = true;
    setBusy(true);
    dialog.querySelectorAll("button, input, select").forEach(item => { item.disabled = true; });
    progress("Saving…");
    try {
      if (action.type === "student-edit") await data.editStudent(action.id, String(fields.get("nickname") || ""), String(fields.get("className") || ""));
      if (action.type === "class-assign") await data.assignClassTeacher(action.id, String(fields.get("teacherEmail") || ""));
      if (action.type === "class-delete") await data.deleteClass(action.id, progress);
      if (action.type === "teacher-delete") await data.deleteTeacher(action.email, progress);
      dialog.close();
      if (isCurrent()) await onChanged(action);
    } catch (error) {
      progress(`${errorMessage(error)}${action.type.endsWith("-delete") ? " If deletion started, it can be resumed with Finish deletion after refreshing the teacher desk." : ""}`);
      if (dialog.isConnected && dialog.open) status.focus();
    } finally {
      busy = false;
      setBusy(false);
      if (dialog.isConnected) dialog.querySelectorAll("button, input, select").forEach(item => { item.disabled = false; });
    }
  }, { signal });
}
