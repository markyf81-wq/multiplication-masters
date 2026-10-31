// This deliberately small renderer handles the README's headings, paragraphs,
// lists, code and links. Raw HTML is always shown as text, never executed.
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function inline(text) {
  const tokens = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let html = "", cursor = 0;
  for (const match of text.matchAll(tokens)) {
    html += escapeHtml(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("`")) html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    else if (token.startsWith("**")) html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      let safeUrl = null;
      try {
        const url = new URL(link[2], location.href);
        if (["https:", "http:"].includes(url.protocol)) safeUrl = url.href;
      } catch { /* Invalid links remain plain text. */ }
      html += safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link[1])}</a>` : escapeHtml(link[1]);
    }
    cursor = match.index + token.length;
  }
  return html + escapeHtml(text.slice(cursor));
}

export function renderReadme(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let html = "", paragraph = [], list = null;
  const flushParagraph = () => {
    if (paragraph.length) { html += `<p>${inline(paragraph.join(" "))}</p>`; paragraph = []; }
  };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("```")) {
      flushParagraph(); closeList();
      const code = [];
      while (++index < lines.length && !lines[index].startsWith("```")) code.push(lines[index]);
      html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      // The app already has its own page title; keep one H1 on the screen.
      if (heading[1].length === 1 && index === 0) continue;
      const level = Math.min(6, heading[1].length);
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }
    const item = line.match(/^\s*(?:(\d+)\.\s+|[-*]\s+)(.+)$/);
    if (item) {
      flushParagraph();
      const type = item[1] ? "ol" : "ul";
      if (list !== type) { closeList(); list = type; html += `<${type}>`; }
      html += `<li>${inline(item[2])}</li>`;
      continue;
    }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    closeList();
    paragraph.push(line.trim());
  }
  flushParagraph(); closeList();
  return html;
}
