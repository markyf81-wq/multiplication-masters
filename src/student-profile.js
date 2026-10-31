export const UNASSIGNED_CLASS = "@unassigned";

export function classNamesFor(student) {
  return (student.classNames || (student.className ? [student.className] : [])).filter(Boolean);
}

export function classLabel(student) {
  return classNamesFor(student).join(", ") || "Unassigned";
}

export function matchesClass(student, name) {
  if (!name) return true;
  const classes = classNamesFor(student);
  return name === UNASSIGNED_CLASS ? classes.length === 0 : classes.includes(name);
}

export const classOptionLabel = name => name === UNASSIGNED_CLASS ? "Unassigned" : name;
