// Spreadsheet clipboard data uses tabs; comma-separated rows are accepted too.
function readRows(text) {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = source.includes("\t") ? "\t" : ",";
  const rows = [];
  let cells = [], cell = "", quoted = false, closedQuote = false;
  let line = 1, rowLine = 1;
  function finishCell() { cells.push(cell.trim()); cell = ""; closedQuote = false; }
  function finishRow() {
    finishCell();
    // Ignore empty spreadsheet rows and unused trailing columns.
    while (cells.length && !cells.at(-1)) cells.pop();
    if (cells.length) rows.push({ line: rowLine, cells });
    cells = [];
  }
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (character === '"') { quoted = false; closedQuote = true; }
      else { cell += character; if (character === "\n") line++; }
    } else if (character === delimiter) finishCell();
    else if (character === "\n") { finishRow(); line++; rowLine = line; }
    else if (character === '"' && !cell && !closedQuote) quoted = true;
    else if (closedQuote && !/\s/.test(character)) throw new Error(`Row ${rowLine}: check the quotation marks around each cell.`);
    else cell += character;
  }
  if (quoted) throw new Error(`Row ${rowLine}: a quoted cell is missing its closing quotation mark.`);
  finishRow();
  return rows;
}

export function parseStudentRows(text) {
  const records = readRows(text);
  const header = value => value.toLowerCase().replace(/[^a-z]/g, "");
  const first = records[0]?.cells;
  if (first?.length === 2
    && ["name", "studentname", "nickname"].includes(header(first[0]))
    && ["email", "studentemail", "emailaddress", "studentemailaddress", "googleemail", "schoolgoogleemail"].includes(header(first[1]))) records.shift();
  const seen = new Set();
  const rows = records.map(({ line, cells }) => {
    const nickname = cells[0] || "";
    const email = (cells[1] || "").toLowerCase();
    const errors = [];
    if (cells.length > 2) errors.push("Use two columns: name, then email.");
    if (!nickname || nickname.length > 32 || /[\n\t]/.test(nickname)) errors.push("Name must be 1–32 characters on one line.");
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || email.length > 254) errors.push("Enter a valid student Google email.");
    const duplicate = !errors.length && seen.has(email);
    if (!errors.length) seen.add(email);
    return { line, nickname, email, errors, duplicate };
  });
  return {
    rows,
    students: rows.filter(row => !row.errors.length && !row.duplicate).map(({ nickname, email }) => ({ nickname, email })),
    errors: rows.filter(row => row.errors.length).length,
    duplicates: rows.filter(row => row.duplicate).length,
  };
}
