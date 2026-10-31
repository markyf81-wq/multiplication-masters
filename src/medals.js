export const MEDALS = [
  { table: 1, name: "Shrimply amazing", colour: "#ffddd9", accent: "#a83e32" },
  { table: 2, name: "Orange you smart", colour: "#ffe4ae", accent: "#8b4817" },
  { table: 3, name: "Grape job", colour: "#e6d6ff", accent: "#6540a8" },
  { table: 4, name: "You're a-peeling", colour: "#fff09c", accent: "#705511" },
  { table: 5, name: "Berry brilliant", colour: "#ffdbe6", accent: "#a52e52" },
  { table: 6, name: "You're a fun-gi", colour: "#ffe2c9", accent: "#974a26" },
  { table: 7, name: "Donut stop learning", colour: "#ffdaf2", accent: "#a3327d" },
  { table: 8, name: "Taco 'bout smart", colour: "#ffebad", accent: "#805116" },
  { table: 9, name: "Pear-fect answers", colour: "#d6f6b4", accent: "#396822" },
  { table: 10, name: "Looking pine!", colour: "#fff0ab", accent: "#756019" },
  { table: 11, name: "Easy pea-sy", colour: "#c8f2d8", accent: "#256744" },
  { table: 12, name: "You're one in a melon", colour: "#ffdce3", accent: "#a33450" },
];

export const medalFor = table => MEDALS.find(medal => medal.table === table) || MEDALS[0];
const face = (x = 60, y = 72, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><g stroke="none"><ellipse cx="-20" cy="5" rx="6" ry="3.5" fill="#f6a0a4"/><ellipse cx="20" cy="5" rx="6" ry="3.5" fill="#f6a0a4"/><ellipse cx="-11" cy="-3" rx="3.8" ry="5.5" fill="#30234d"/><ellipse cx="11" cy="-3" rx="3.8" ry="5.5" fill="#30234d"/><circle cx="-12" cy="-5" r="1.3" fill="#fff"/><circle cx="10" cy="-5" r="1.3" fill="#fff"/></g><path d="M-7 7Q0 16 7 7" fill="none" stroke="#30234d" stroke-width="3.5"/></g>`;
const drawings = [
  `<path d="M42 87 22 102 24 80 10 72 36 66" fill="#f58c80"/><path d="M42 80C16 57 30 25 63 24C87 22 103 41 98 61C95 74 83 75 77 67C74 62 80 56 78 50C75 41 62 41 57 49C48 60 58 71 67 75L58 91Z" fill="#ffb4a0"/><path d="m38 43 14 6M33 58l15 1m-9 14 12-8m-1 19 7-13M88 28q8-17 17-13m-9 23q18-14 16-3" fill="none"/>${face(84, 52, .6)}`,
  `<path d="M60 34Q54 17 61 10" fill="none" stroke="#685036" stroke-width="5"/><path d="M61 26Q65 4 90 12Q84 34 61 26Z" fill="#62c47a"/><path d="m65 23 16-7" fill="none" stroke="#388954" stroke-width="2"/><path d="M59 34C31 20 11 42 13 70C15 100 36 118 62 116C91 117 110 94 108 67C107 42 85 23 69 35Z" fill="#ffa52e"/><path d="M25 84Q43 117 77 106Q98 97 102 75C104 104 83 116 62 116Q35 118 25 84Z" fill="#f17f25" stroke="none"/><path d="M31 46Q20 59 24 72" fill="none" stroke="#fff0bf" stroke-width="7"/><g fill="#d87921" stroke="none"><circle cx="39" cy="95" r="1.8"/><circle cx="49" cy="102" r="1.5"/><circle cx="83" cy="88" r="1.8"/></g>${face(62, 73)}`,
  `<path d="M60 34Q55 19 67 11m-5 11q21-20 35-7-10 18-35 7" fill="#70c77c"/><path d="m68 22 15-5" fill="none" stroke="#3c8b52" stroke-width="2"/><circle cx="43" cy="45" r="20" fill="#a985ee"/><circle cx="77" cy="45" r="20" fill="#9670dc"/><circle cx="30" cy="73" r="19" fill="#b293f0"/><circle cx="90" cy="73" r="19" fill="#8e68cf"/><circle cx="60" cy="101" r="18" fill="#9a73da"/><circle cx="60" cy="75" r="25" fill="#b192ef"/><g fill="none" stroke="#e5d6ff" stroke-width="4"><path d="M34 36q-6 4-6 10m42-11q6-3 10 1M20 66q-4 4-3 9m36-12q-6 3-7 8"/></g>${face(60, 77, .85)}`,
  `<path d="m78 32 4-17 11 2 2 13-9 7Z" fill="#947048"/><path d="M87 28C98 63 70 101 35 105C20 108 8 101 13 87L21 78C40 90 69 67 72 35Z" fill="#ffe16a"/><path d="M18 96Q55 114 82 60" fill="none" stroke="#e9b535" stroke-width="6"/><path d="M29 88Q51 89 69 63" fill="none" stroke="#fff3b1" stroke-width="5"/><path d="m13 88 8 7m51-60 9 4" fill="none" stroke="#705036" stroke-width="4"/>${face(52, 82, .75)}`,
  `<path d="M60 39C84 25 109 36 103 60C96 84 73 109 60 116C45 108 23 83 16 60C9 36 36 25 60 39Z" fill="#f86180"/><path d="M94 45Q103 78 60 110Q86 85 86 54Z" fill="#e74468" stroke="none"/><path d="M60 40 35 36 27 23 49 27 60 10 70 28 92 21 84 37 66 45Z" fill="#66c77d"/><path d="M60 37 60 23m-4 15-13-7m22 7 13-7" fill="none" stroke="#398e55" stroke-width="2"/><path d="M28 47q-7 6-4 15" fill="none" stroke="#ffb6bf" stroke-width="5"/><g fill="#ffe49c" stroke="none"><ellipse cx="35" cy="49" rx="2.2" ry="3.6" transform="rotate(-20 35 49)"/><ellipse cx="85" cy="49" rx="2.2" ry="3.6" transform="rotate(20 85 49)"/><ellipse cx="27" cy="74" rx="2" ry="3.5"/><ellipse cx="93" cy="74" rx="2" ry="3.5"/><ellipse cx="40" cy="93" rx="2" ry="3.5"/><ellipse cx="80" cy="93" rx="2" ry="3.5"/><ellipse cx="60" cy="104" rx="2" ry="3.5"/></g>${face(60, 68, .9)}`,
  `<path d="M44 62 39 98Q59 116 81 98L76 61Z" fill="#fff1cd"/><path d="M11 65C7 12 109 4 110 65Q88 77 60 67Q33 78 11 65Z" fill="#ff786c"/><g fill="#fff2df" stroke="none"><ellipse cx="39" cy="38" rx="10" ry="8" transform="rotate(-20 39 38)"/><ellipse cx="82" cy="35" rx="9" ry="7"/><ellipse cx="61" cy="57" rx="9" ry="6"/></g>${face(60, 89, .7)}`,
  `<path d="M110 64A50 48 0 1 1 10 64A50 48 0 1 1 110 64" fill="#efb36c"/><path d="M15 46C26 6 93 6 106 47L100 62l-13-5-8 9-15-7-13 9-13-9-14 7-13-9Z" fill="#f292c3"/><ellipse cx="60" cy="53" rx="14" ry="12" fill="#fff9eb"/><g fill="none" stroke-width="5"><path d="m29 39 8 3m47-8 5 6" stroke="#fff2ac"/><path d="m47 29 7 3m37 16 7 1" stroke="#8561cc"/></g>${face(60, 85, .8)}`,
  `<path d="M14 55Q23 34 34 46Q43 26 55 43Q70 27 79 44Q97 32 106 54" fill="#72c98c"/><path d="M12 58Q14 109 59 109Q107 108 109 58Z" fill="#fbd36c"/><path d="M12 58Q27 24 60 29Q95 25 109 58Z" fill="#ffab60"/><path d="m23 53 7-5m15 3 6-7m21 6 6-6m15 10 6-6" stroke="#e85b58" stroke-width="7"/>${face(60, 80)}`,
  `<path d="M61 33Q53 18 64 9" fill="none" stroke="#79603b" stroke-width="5"/><path d="M62 25Q74 5 93 19Q82 36 62 25Z" fill="#66b96c"/><path d="m68 24 15-4" fill="none" stroke="#368448" stroke-width="2"/><path d="M62 30C45 27 41 43 36 57C31 70 16 74 17 91C18 111 43 118 66 116C94 114 110 101 105 85C101 71 83 61 81 46C80 35 75 29 62 30Z" fill="#b4dd73"/><path d="M80 49Q81 70 95 84Q111 109 65 113Q94 102 88 85Z" fill="#8dc45b" stroke="none"/><path d="M45 47q-2 13-8 22m-8 13q-4 9 2 15" fill="none" stroke="#effac6" stroke-width="6"/><g fill="#7ca94d" stroke="none"><circle cx="43" cy="103" r="1.5"/><circle cx="78" cy="103" r="1.5"/><circle cx="86" cy="96" r="1.5"/></g>${face(61, 83, .95)}`,
  `<path d="M45 40 30 17 50 24 58 5 68 25 91 11 81 39Z" fill="#55b979"/><path d="m60 38-2-22m8 23 15-17m-27 17L42 27" fill="none" stroke="#2c8c59" stroke-width="2"/><rect x="28" y="35" width="65" height="82" rx="28" fill="#ffce61"/><path d="M81 43Q104 108 61 113" fill="none" stroke="#efad3d" stroke-width="6"/><g fill="none" stroke="#d99b32" stroke-width="2"><path d="m34 48 52 48M29 67l48 44M48 37l42 39M32 91l51-47m-43 64 52-48m-32 55 29-27"/></g><ellipse cx="60" cy="79" rx="25" ry="19" fill="#ffda7c" stroke="none"/><path d="M39 51q-5 7-5 14" fill="none" stroke="#fff0b2" stroke-width="5"/>${face(60, 80, .85)}`,
  `<path d="M13 90Q14 14 105 33Q111 112 26 107Z" fill="#5cc687"/><path d="M21 93Q58 59 101 37" fill="none" stroke="#2d9463"/><g fill="#bcf2a0"><circle cx="37" cy="79" r="18"/><circle cx="64" cy="63" r="18"/><circle cx="88" cy="46" r="15"/></g>${face(63, 65, .52)}`,
  `<path d="M7 34H113C110 80 91 111 60 111S10 80 7 34Z" fill="#55b871"/><path d="M16 35H104C101 76 84 102 60 102S19 76 16 35Z" fill="#e6f3b4" stroke="none"/><path d="M23 35H97C94 70 80 94 60 94S26 70 23 35Z" fill="#ff6e86" stroke="none"/><path d="M31 43q1 9 4 14" fill="none" stroke="#ffb6c1" stroke-width="5"/><path d="M24 88q36 31 72 0" fill="none" stroke="#318e57" stroke-width="3"/><g fill="#46304b" stroke="none"><ellipse cx="41" cy="44" rx="2.5" ry="4" transform="rotate(-25 41 44)"/><ellipse cx="60" cy="43" rx="2.5" ry="4"/><ellipse cx="79" cy="44" rx="2.5" ry="4" transform="rotate(25 79 44)"/><ellipse cx="37" cy="77" rx="2.2" ry="3.5" transform="rotate(-25 37 77)"/><ellipse cx="83" cy="77" rx="2.2" ry="3.5" transform="rotate(25 83 77)"/><ellipse cx="60" cy="85" rx="2" ry="3"/></g>${face(60, 64, .8)}`,
];

export function medalArt(table, ribbon = true) {
  const medal = medalFor(table);
  if (!ribbon) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 134" focusable="false" aria-hidden="true"><g stroke="#30234d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${drawings[medal.table - 1]}</g></svg>`;
  const rosette = Array.from({ length: 24 }, (_, index) => {
    const angle = index * Math.PI / 12 - Math.PI / 2;
    const radius = index % 2 ? 47 : 52;
    return `${60 + Math.cos(angle) * radius},${54 + Math.sin(angle) * radius}`;
  }).join(" ");
  const frames = [
    '<circle cx="60" cy="54" r="49"/>',
    '<path d="M60 4 104 29V79L60 105 16 79V29Z"/>',
    `<polygon points="${rosette}"/>`,
    '<path d="M14 15Q60-1 106 15L100 64Q96 91 60 107Q24 91 20 64Z"/>',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 134" focusable="false" aria-hidden="true"><g stroke="#30234d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M38 80 62 88 48 130 35 117 18 121Z" fill="#ef4444"/>
    <path d="M59 88 83 79 102 121 84 118 72 131Z" fill="#ef4444"/>
    <path d="m43 96-8 19m43-19 8 20" fill="none" stroke="#b91c1c" stroke-width="2"/>
    <g fill="#ffd471">${frames[(medal.table - 1) % frames.length]}</g>
    <circle cx="60" cy="54" r="40" fill="#fff9e8" fill-opacity="1" stroke="${medal.accent}" stroke-width="2"/>
    <path d="M29 27q14-13 31-12" fill="none" stroke="#fff6cf" stroke-width="3"/>
    <g transform="translate(27.6 21.6) scale(.54)">${drawings[medal.table - 1]}</g>
  </g></svg>`;
}
