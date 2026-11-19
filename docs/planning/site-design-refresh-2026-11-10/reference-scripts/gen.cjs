// Generates the two hand-drawn figures of F1A (journey strip, mask-layer stacks) and splices them into the lesson.
// Usage: node gen.cjs   (reads <title>, <desc> and <figcaption> from git HEAD so they are never retyped)
const fs = require("fs");
const { execSync } = require("child_process");
const WT = "<repo>";
const REL = "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx";
const head = execSync(`git -C ${WT} show HEAD:${REL}`, { encoding: "utf8", maxBuffer: 1 << 26 });
const r = (n) => String(Math.round(n * 10) / 10);
const T = (s) => `{${JSON.stringify(s)}}`;

function headFigure(id) {
  const m = new RegExp(`<figure>(?:(?!</figure>)[\\s\\S])*?${id}[\\s\\S]*?</figure>`).exec(head);
  if (!m) throw new Error("no figure " + id);
  const block = m[0];
  return {
    svgOpen: /<svg [^>]*>/.exec(block)[0],
    title: /<title [^>]*>[\s\S]*?<\/title>/.exec(block)[0],
    titleText: /<title [^>]*>([\s\S]*?)<\/title>/.exec(block)[1],
    desc: /<desc [^>]*>[\s\S]*?<\/desc>/.exec(block)[0],
    figcaption: /<figcaption>[\s\S]*?<\/figcaption>/.exec(block)[0],
  };
}

/* ------------------------------------------------------------------ A: the journey strip */
function journey() {
  const f = headFigure("f1a-journey-title");
  const P = "f1a-journey";
  const L = [];
  const plates = [
    { x: 9, lines: ["spec", "review"] },
    { x: 74, lines: ["RTL", "simulation", "one block"] },
    { x: 139, lines: ["full-chip", "sim or", "emulation"] },
    { x: 226, lines: ["post-", "silicon", "lab"] },
    { x: 291, lines: ["in the", "field"] },
  ];
  const PY = 25, PW = 60, PH = 48, RX = 7;
  const TX = 212.5; // the tape-out line
  L.push(`  <defs>`);
  for (let i = 1; i <= 5; i++) {
    L.push(`    <linearGradient id="${P}-body-${i}" x1="0" y1="0" x2="0" y2="1" className="text-fig-ramp-${i}-body"><stop offset="0" className="fig-stop-top" /><stop offset="1" className="fig-stop-bottom" /></linearGradient>`);
  }
  L.push(`    <linearGradient id="${P}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="fig-rim-top" /><stop offset="0.6" className="fig-rim-end" /></linearGradient>`);
  L.push(`    <linearGradient id="${P}-grow" x1="0" y1="0" x2="1" y2="0">${[1, 2, 3, 4, 5].map((n, i) => `<stop offset="${i / 4}" className="text-fig-ramp-${n}" stopColor="currentColor" />`).join("")}</linearGradient>`);
  L.push(`    <filter id="${P}-shadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="200"><feGaussianBlur stdDeviation="2.4" /></filter>`);
  L.push(`    <filter id="${P}-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="200"><feGaussianBlur stdDeviation="4.5" /></filter>`);
  L.push(`  </defs>`);
  // The two bays: what a fix means on each side of the line.
  L.push(`  <rect x="4" y="20" width="200" height="98" rx="9" className="fig-well stroke-fig-generic" strokeOpacity="0.85" />`);
  L.push(`  <rect x="221" y="20" width="135" height="98" rx="9" className="fig-well stroke-fig-generic" strokeOpacity="0.85" />`);
  // The focal part: the tape-out line, lit, with its flag.
  L.push(`  <g className="fig-fx fig-fx-blur fig-glow" filter="url(#${P}-glow)" aria-hidden="true"><rect x="${r(TX - 3)}" y="6" width="6" height="114" rx="3" className="fill-tier-current" stroke="none" /></g>`);
  L.push(`  <line x1="${TX}" y1="16" x2="${TX}" y2="121" className="stroke-tier-current" strokeWidth="2" strokeDasharray="4 3" />`);
  L.push(`  <rect x="${r(TX - 28)}" y="1.5" width="56" height="15" rx="5" className="fill-card stroke-tier-current" strokeWidth="1.2" />`);
  L.push(`  <rect x="${r(TX - 28)}" y="1.5" width="56" height="15" rx="5" className="fig-fx fill-tier-current" fillOpacity="0.16" stroke="none" />`);
  L.push(`  <text x="${TX}" y="12.7" fontSize="10.5" fill="currentColor" fontWeight="600" textAnchor="middle">${T("tape-out")}</text>`);
  // Stage plates: objects whose hue climbs the ordered ramp.
  L.push(`  <g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow)" aria-hidden="true">${plates.map((p) => `<rect x="${p.x + 1}" y="${PY + 3}" width="${PW - 2}" height="${PH}" rx="${RX}" className="fig-shadow" stroke="none" />`).join("")}</g>`);
  plates.forEach((p, i) => {
    const n = i + 1;
    L.push(`  <rect x="${p.x}" y="${PY}" width="${PW}" height="${PH}" rx="${RX}" className="fill-card" stroke="none" />`);
    L.push(`  <rect x="${p.x}" y="${PY}" width="${PW}" height="${PH}" rx="${RX}" fill="url(#${P}-body-${n})" stroke="none" className="fig-fx" />`);
    L.push(`  <rect x="${p.x}" y="${PY}" width="${PW}" height="${PH}" rx="${RX}" fill="none" className="stroke-fig-ramp-${n}" strokeWidth="1.5" />`);
    L.push(`  <rect x="${p.x + 1.25}" y="${PY + 1.25}" width="${PW - 2.5}" height="${PH - 2.5}" rx="${RX - 1.25}" fill="none" stroke="url(#${P}-rim)" strokeWidth="1" className="fig-fx" />`);
    const cx = p.x + PW / 2;
    const ys = p.lines.length === 3 ? [40.5, 52.5, 64.5] : [46.5, 59.5];
    p.lines.forEach((s, k) => L.push(`  <text x="${cx}" y="${ys[k]}" fontSize="10.5" fill="currentColor" textAnchor="middle">${T(s)}</text>`));
  });
  // What a fix means, under each group.
  L.push(`  <text x="104" y="93.5" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("fix = edit the design database")}</text>`);
  L.push(`  <text x="104" y="106.5" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("(a pre-tape-out ECO)")}</text>`);
  L.push(`  <text x="288.5" y="88" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("fix = new masks (metal-")}</text>`);
  L.push(`  <text x="288.5" y="100" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("only or full respin)")}</text>`);
  L.push(`  <text x="288.5" y="112" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("or a workaround")}</text>`);
  // The arrow under the row: a wedge that swells and climbs the ramp, so "grow" is drawn as well as said.
  const wedge = "6,133.2 337,128.5 337,123.5 355,134 337,144.5 337,139.5 6,134.8";
  L.push(`  <polygon points="${wedge}" className="fig-solid fill-fig-ramp-3" stroke="none" />`);
  L.push(`  <polygon points="${wedge}" fill="url(#${P}-grow)" stroke="none" className="fig-fx" />`);
  L.push(`  <text x="180" y="156" fontSize="10.5" fill="currentColor" textAnchor="middle">${T("the cost and delay of the same fix grow")}</text>`);
  return [
    `<figure>`,
    `<div className="glass-liquid fig-panel">`,
    `<div className="fig-titlebar" aria-hidden="true" data-fig-title><span>${f.titleText}</span></div>`,
    `<div className="fig-stage">`,
    f.svgOpen.replace(`style={{ width: "100%", maxWidth: 520 }}`, `style={{ display: "block", width: "100%", maxWidth: 520, margin: "0 auto" }}`),
    `  ${f.title}`,
    `  ${f.desc}`,
    ...L,
    `</svg>`,
    `</div>`,
    `</div>`,
    f.figcaption,
    `</figure>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ B: the mask-layer stacks */
function respin() {
  const f = headFigure("f1a-respin-title");
  const P = "f1a-respin";
  const w = 44, d = 28, TM = 7, TB = 13, GAP = 4, LIFT = 5;
  const ux = 0.866, uy = 0.5;
  // Corners relative to the plate's top-front corner F = (0,0). Axes at 30 degrees; light from the top left.
  const R = [d * ux, -d * uy];
  const Lc = [-w * ux, -w * uy];
  const B = [(d - w) * ux, -(w + d) * uy];
  const pt = (p, dy = 0) => `${r(p[0])},${r(p[1] + dy)}`;
  const top = [[0, 0], R, B, Lc].map((p) => pt(p)).join(" ");
  const left = (t) => [pt(Lc), pt([0, 0]), pt([0, 0], t), pt(Lc, t)].join(" ");
  const right = (t) => [pt([0, 0]), pt(R), pt(R, t), pt([0, 0], t)].join(" ");
  const sil = (t) => [pt(Lc), pt(B), pt(R), pt(R, t), pt([0, 0], t), pt(Lc, t)].join(" ");
  const wire = (t, back) =>
    `M${pt(Lc)} L${pt([0, 0])} L${pt(R)} M${pt(Lc, t)} L${pt([0, 0], t)} L${pt(R, t)} M${pt(Lc)} v${t} M0,0 v${t} M${pt(R)} v${t}` + (back ? ` M${pt(Lc)} L${pt(B)} L${pt(R)}` : "");
  // One plate, drawn in place (no <use>: rules that reach into a figure by its ancestors, forced colours among them, do not reach a <use> copy).
  const plate = (kind, t, x, y, topmost) => {
    const at = `transform="translate(${r(x)} ${r(y)})"`;
    if (kind === "none") return `  <path ${at} d="${wire(t, topmost)}" fill="none" className="stroke-fig-generic" strokeWidth="1" strokeDasharray="3 2.4" strokeLinejoin="round" />`;
    const base = `<polygon points="${sil(t)}" className="fill-card" stroke="none" />`;
    if (kind === "held") {
      const s = `stroke="currentColor" strokeWidth="1" strokeLinejoin="round"`;
      return `  <g ${at} className="text-fig-generic">${base}<polygon points="${top}" className="fig-face-top" ${s} /><polygon points="${left(t)}" className="fig-face-left" ${s} /><polygon points="${right(t)}" className="fig-face-right" ${s} /></g>`;
    }
    const s = `fill="url(#${P}-hatch)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"`;
    return (
      `  <g ${at} className="text-fig-ramp-4">${base}<polygon points="${top}" className="fig-face-top" stroke="none" /><polygon points="${left(t)}" className="fig-face-left" stroke="none" /><polygon points="${right(t)}" className="fig-face-right" stroke="none" />` +
      `<polygon points="${top}" ${s} /><polygon points="${left(t)}" ${s} /><polygon points="${right(t)}" ${s} /></g>`
    );
  };
  const D = [];
  D.push(`    <pattern id="${P}-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" className="text-fig-ramp-4"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.9" /></pattern>`);
  D.push(`    <filter id="${P}-shadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="380" height="366"><feGaussianBlur stdDeviation="3" /></filter>`);
  D.push(`    <filter id="${P}-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="380" height="366"><feGaussianBlur stdDeviation="5" /></filter>`);

  const XF = 125;
  const rows = [
    { y0: 0, head: "(a) Pre-tape-out ECO", kind: ["none", "none", "none", "none"], lift: 0, text: ["Edit the netlist and layout", "database. No masks exist yet.", "Cost: engineering time to", "re-verify. No wafers to scrap."] },
    { y0: 101, head: "(b) Metal-only respin", kind: ["held", "held", "new", "new"], lift: LIFT, text: ["New masks for some metal and", "via layers only. Spare cells", "placed before tape-out are", "wired in. Held wafers: weeks."] },
    { y0: 202, head: "(c) Full respin", kind: ["new", "new", "new", "new"], lift: 0, text: ["New masks for the base layers", "too, usually most of the set.", "New wafers start from the", "beginning: months."] },
  ];
  const wells = [], shadows = [], glows = [], body = [];
  for (const row of rows) {
    const y0 = row.y0;
    wells.push(`  <rect x="2" y="${y0 + 2}" width="172" height="98" rx="9" className="fig-well stroke-fig-generic" strokeOpacity="0.85" />`);
    // Plate positions (top-front corner), bottom to top. A new layer on a held wafer lifts clear of it.
    const yBase = y0 + 81;
    const ys = [yBase, yBase - GAP - TM, yBase - GAP - TM - (GAP + TM) - row.lift, yBase - GAP - TM - 2 * (GAP + TM) - row.lift];
    // A stack that exists casts a shadow; the wireframe of (a) does not, because no mask exists yet.
    if (row.kind[0] !== "none") shadows.push(`<polygon transform="translate(${XF} ${yBase + TB + 3})" points="${top}" className="fig-shadow" stroke="none" />`);
    ys.forEach((y, i) => {
      const t = i === 0 ? TB : TM;
      if (row.kind[i] === "new") glows.push(`<polygon transform="translate(${XF} ${y})" points="${sil(t)}" className="fill-fig-ramp-4" stroke="none" />`);
      body.push(plate(row.kind[i], t, XF, y, i === 3));
    });
    // Layer labels beside the stack, on leader lines.
    const lx = XF + Lc[0]; // x of the left corners
    const mTop = ys[3] + Lc[1], mBot = ys[1] + Lc[1] + TM;
    body.push(`  <path d="M${r(lx - 4)},${r(mTop)} h-3.5 V${r(mBot)} h3.5 M${r(lx - 7.5)},${r((mTop + mBot) / 2)} H44" fill="none" className="stroke-fig-generic" strokeWidth="1" />`);
    body.push(`  <text x="8" y="${r((mTop + mBot) / 2 - 2.5)}" fontSize="10.5" fill="currentColor">${T("metal")}</text>`);
    body.push(`  <text x="8" y="${r((mTop + mBot) / 2 + 9.5)}" fontSize="10.5" fill="currentColor">${T("+ vias")}</text>`);
    const bMid = yBase + Lc[1] + TB / 2;
    body.push(`  <path d="M${r(lx - 3)},${r(bMid)} H37" fill="none" className="stroke-fig-generic" strokeWidth="1" />`);
    body.push(`  <text x="8" y="${r(bMid + 3.6)}" fontSize="10.5" fill="currentColor">${T("base")}</text>`);
    if (row.head.startsWith("(b)")) {
      // The spare cell on the cut face of the base, and the via that wires it in.
      const lb = [lx, yBase + Lc[1] + TB]; // bottom-left corner of the base's left face
      const at = (s, z) => [lb[0] + s * ux, lb[1] + s * uy - z];
      const cell = [at(24, 2.5), at(32, 2.5), at(32, 10.5), at(24, 10.5)];
      const vx = at(28, 0)[0];
      const vTop = ys[2] + Lc[1] + 28 * uy + TM / 2; // mid-face of the lower new-metal plate
      const vBot = (cell[2][1] + cell[3][1]) / 2;
      body.push(`  <polygon points="${cell.map((p) => `${r(p[0])},${r(p[1])}`).join(" ")}" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />`);
      body.push(`  <line x1="${r(vx)}" y1="${r(vTop)}" x2="${r(vx)}" y2="${r(vBot)}" stroke="currentColor" strokeWidth="2" />`);
      body.push(`  <path d="M58,${r(y0 + 88.5)} L${r(cell[0][0] - 1.5)},${r(cell[0][1] + 1)}" fill="none" className="stroke-fig-generic" strokeWidth="1" />`);
      body.push(`  <text x="8" y="${y0 + 92}" fontSize="10.5" fill="currentColor">${T("spare cell")}</text>`);
    }
    body.push(`  <text x="184" y="${y0 + 23}" fontSize="12" fill="currentColor" fontWeight="600">${T(row.head)}</text>`);
    row.text.forEach((s, i) => body.push(`  <text x="184" y="${y0 + 42 + i * 14}" fontSize="10.5" fill="currentColor">${T(s)}</text>`));
  }
  const legend = [
    `  <g className="text-fig-ramp-4"><rect x="4" y="309" width="16" height="12" rx="2" className="fig-face-left" stroke="none" /><rect x="4" y="309" width="16" height="12" rx="2" fill="url(#${P}-hatch)" stroke="currentColor" strokeWidth="1.2" /></g>`,
    `  <text x="25" y="319" fontSize="10.5" fill="currentColor">${T("new mask")}</text>`,
    `  <rect x="92" y="309" width="16" height="12" rx="2" className="fig-face-top text-fig-generic" stroke="currentColor" strokeWidth="1" />`,
    `  <text x="113" y="319" fontSize="10.5" fill="currentColor">${T("reused (held wafer)")}</text>`,
    `  <rect x="226" y="309" width="16" height="12" rx="2" fill="none" className="stroke-fig-generic" strokeWidth="1" strokeDasharray="3 2.4" />`,
    `  <text x="247" y="319" fontSize="10.5" fill="currentColor">${T("no mask yet")}</text>`,
  ];
  return [
    `<figure>`,
    `<div className="glass-liquid fig-panel">`,
    `<div className="fig-titlebar" aria-hidden="true" data-fig-title><span>${f.titleText}</span></div>`,
    `<div className="fig-stage">`,
    f.svgOpen.replace(`style={{ width: "100%", maxWidth: 520 }}`, `style={{ display: "block", width: "100%", maxWidth: 520, margin: "0 auto" }}`),
    `  ${f.title}`,
    `  ${f.desc}`,
    `  <defs>`,
    ...D,
    `  </defs>`,
    ...wells,
    `  <g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow)" aria-hidden="true">${shadows.join("")}</g>`,
    `  <g className="fig-fx fig-fx-blur fig-glow" filter="url(#${P}-glow)" aria-hidden="true">${glows.join("")}</g>`,
    ...body,
    ...legend,
    `</svg>`,
    `</div>`,
    `</div>`,
    f.figcaption,
    `</figure>`,
  ].join("\n");
}

let cur = fs.readFileSync(`${WT}/${REL}`, "utf8");
for (const [id, make] of [["f1a-journey-title", journey], ["f1a-respin-title", respin]]) {
  const re = new RegExp(`<figure>(?:(?!</figure>)[\\s\\S])*?${id}[\\s\\S]*?</figure>`);
  if (!re.test(cur)) throw new Error("cannot find " + id + " in the worktree lesson");
  cur = cur.replace(re, () => make());
}
fs.writeFileSync(`${WT}/${REL}`, cur);
console.log("written");
