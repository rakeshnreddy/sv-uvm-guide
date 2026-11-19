// Generates two more hand-drawn figures of F1A and splices them into the lesson:
//   the recap strip inside <VisualRecap> ("The cost ladder with the three fix routes after tape-out"), drawn with the
//   plates, ramp steps, trays and tape-out line of the journey strip (figure A), and
//   the four decisions ("Which masks change for each of the four decisions"), drawn with the cut blocks and the three
//   textures of the mask stacks (figure B).
// Usage: node gen3.cjs   (reads <title>, <desc> and <figcaption> from the lesson at cb80965f, saved as base-index.mdx)
const fs = require("fs");
const path = require("path");
const WT = "<repo>";
const REL = "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx";
const base = fs.readFileSync(path.join(__dirname, "base-index.mdx"), "utf8");
const r = (n) => String(Math.round(n * 10) / 10);
const T = (s) => `{${JSON.stringify(s)}}`;
const FIGURE = (id) => new RegExp(`<figure>(?:(?!</figure>)[\\s\\S])*?${id}[\\s\\S]*?</figure>`);
const RECAP_SVG = /<svg\b[^>]*aria-labelledby="f1a-recap-title"[\s\S]*?<\/svg>/;
const words = (block) => ({
  titleText: /<title [^>]*>([\s\S]*?)<\/title>/.exec(block)[1],
  descText: /<desc [^>]*>([\s\S]*?)<\/desc>/.exec(block)[1],
});

/* ------------------------------------------------------------------ the recap strip */
function recap() {
  const f = words(RECAP_SVG.exec(base)[0]);
  const P = "f1a-recap";
  // One composition, 300 units wide. The drawing asks the recap card for the wide picture cell
  // (data-recap-picture="wide": the two cells sit side by side only when each is 360 px), so the picture is 316 px at
  // 390 and 320 to 360 px above that, and its text is never under 11 px from 390 up.
  // Spacing as in the strip (figure A): a plate sits the same 6 units from its tray on every side, and the tape-out
  // line has a gutter three times the gap between plates. The widest label ("×10,000", 40.9 units) keeps 4.5 a side.
  // Where the card stacks, the picture's cell is wider than the picture (360 px in a cell of up to 718): centre it there. Side by
  // side the cell is never wider than 392 px, and there the picture stays under the "Mental picture" label as before.
  const CENTRE_WHEN_STACKED = "clamp(0px, (100% - 440px) * 9999, (100% - 360px) / 2)";
  const W = 300, H = 236;
  const m = 1, pad = 6, gap = 4, tapeGap = 12, PW = 50, RX = 6, CAP = 6;
  const stages = [
    { name: ["spec"], cost: "×1" },
    { name: ["RTL"], cost: "×10" },
    { name: ["full-chip"], cost: "×100" },
    { name: ["post-", "silicon"], cost: "×1,000" },
    { name: ["field"], cost: "×10,000" },
  ];
  const px = [];
  let x = m + pad;
  for (let i = 0; i < 3; i++) { px.push(x); x += PW + gap; }
  const well1 = { x: m, w: pad + 3 * PW + 2 * gap + pad };
  const TX = m + well1.w + tapeGap / 2; // the tape-out line
  const well2 = { x: m + well1.w + tapeGap, w: pad + 2 * PW + gap + pad };
  x = well2.x + pad;
  for (let i = 0; i < 2; i++) { px.push(x); x += PW + gap; }
  if (Math.abs(well2.x + well2.w + m - W) > 0.01) throw new Error(`recap: width ${well2.x + well2.w + m} != ${W}`);
  // The ladder: every plate stands on one line and each is one step taller than the last (one step per ×10).
  const WELL_Y = 26, TOP = 32, H1 = 38, STEP = 9;
  const hOf = (i) => H1 + STEP * i;
  const BY = TOP + hOf(4); // the line the plates stand on
  const WELL_H = BY + 6 - WELL_Y;
  // Under the strip: one quiet sign to the left of the line, three lit signs leaving it to the right.
  const SY = WELL_Y + WELL_H + 9, SH = 17, PITCH = 39;
  const sx = TX + 2, tip = px[4] + PW + 1, neck = tip - 8.5; // a route sign: from the line to a point
  const signAt = (k) => SY + k * PITCH;
  const signPath = (y) => `M${r(sx)},${r(y)} H${r(neck)} L${r(tip)},${r(y + SH / 2)} L${r(neck)},${r(y + SH)} H${r(sx)} Z`;
  const lineEnd = signAt(2) + SH + 3;
  const before = { x: px[0], w: px[2] + PW - px[0] };
  const routes = [
    ["→ metal-only respin", "rewiring + spare cells"],
    ["→ full respin", "needs new transistors"],
    ["→ workaround now", "firmware, defeature bit"],
  ];
  const L = [];
  L.push(`<defs>`);
  for (let i = 1; i <= 5; i++) {
    L.push(`  <linearGradient id="${P}-body-${i}" x1="0" y1="0" x2="0" y2="1" className="text-fig-ramp-${i}-body"><stop offset="0" className="fig-stop-top" /><stop offset="1" className="fig-stop-bottom" /></linearGradient>`);
  }
  L.push(`  <linearGradient id="${P}-quiet" x1="0" y1="0" x2="0" y2="1" className="fig-grad-quiet"><stop offset="0" className="fig-stop-top" /><stop offset="1" className="fig-stop-bottom" /></linearGradient>`);
  L.push(`  <linearGradient id="${P}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="fig-rim-top" /><stop offset="0.6" className="fig-rim-end" /></linearGradient>`);
  L.push(`  <filter id="${P}-shadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="2.4" /></filter>`);
  L.push(`  <filter id="${P}-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="4.5" /></filter>`);
  L.push(`</defs>`);
  // The two trays of the strip, one each side of the line.
  for (const well of [well1, well2]) L.push(`<rect x="${r(well.x)}" y="${WELL_Y}" width="${r(well.w)}" height="${WELL_H}" rx="9" className="fig-well stroke-fig-generic" strokeWidth="1" strokeOpacity="0.55" />`);
  // The focal part: the tape-out line of the strip, lit, and the three routes that leave it to the right.
  L.push(`<g className="fig-fx fig-fx-blur fig-glow" filter="url(#${P}-glow)" aria-hidden="true"><rect x="${r(TX - 3.5)}" y="4" width="7" height="${r(lineEnd - 2)}" rx="3.5" className="fill-tier-current" stroke="none" />${routes.map((_, k) => `<path d="${signPath(signAt(k))}" className="fill-tier-current" stroke="none" />`).join("")}</g>`);
  L.push(`<line x1="${r(TX)}" y1="20" x2="${r(TX)}" y2="${r(lineEnd)}" className="stroke-tier-current" strokeWidth="2.5" strokeDasharray="5 3" />`);
  L.push(`<rect x="${r(TX - 32)}" y="2" width="64" height="18" rx="6" className="fill-card stroke-tier-current" strokeWidth="1.5" />`);
  L.push(`<rect x="${r(TX - 32)}" y="2" width="64" height="18" rx="6" className="fig-fx fill-tier-current" fillOpacity="0.16" stroke="none" />`);
  L.push(`<text x="${r(TX)}" y="15" fontSize="11.5" fill="currentColor" fontWeight="600" textAnchor="middle">${T("tape-out")}</text>`);
  // One blurred pass of shadows: the plates and the four signs.
  const shadows = [
    ...px.map((p, i) => `<rect x="${r(p + 1)}" y="${BY - hOf(i) + 3}" width="${r(PW - 2)}" height="${hOf(i)}" rx="${RX}" className="fig-shadow" stroke="none" />`),
    `<rect x="${r(before.x + 1)}" y="${SY + 3}" width="${r(before.w - 2)}" height="${SH}" rx="6" className="fig-shadow" stroke="none" />`,
    ...routes.map((_, k) => `<path d="${signPath(signAt(k) + 3)}" className="fig-shadow" stroke="none" />`),
  ];
  L.push(`<g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow)" aria-hidden="true">${shadows.join("")}</g>`);
  // Stage plates, as in the strip (a body in the step's hue, a solid cap in the full step, the ramp outline, a rim);
  // here each carries its number, on one line across the five.
  px.forEach((p, i) => {
    const n = i + 1, h = hOf(i), y = BY - h, cx = p + PW / 2;
    L.push(`<rect x="${r(p)}" y="${y}" width="${PW}" height="${h}" rx="${RX}" className="fill-card" stroke="none" />`);
    L.push(`<rect x="${r(p)}" y="${y}" width="${PW}" height="${h}" rx="${RX}" fill="url(#${P}-body-${n})" stroke="none" className="fig-fx" />`);
    L.push(`<path d="M${r(p)},${y + CAP} A${RX},${RX} 0 0 1 ${r(p + RX)},${y} H${r(p + PW - RX)} A${RX},${RX} 0 0 1 ${r(p + PW)},${y + CAP} Z" className="fig-solid fill-fig-ramp-${n}" stroke="none" />`);
    L.push(`<rect x="${r(p)}" y="${y}" width="${PW}" height="${h}" rx="${RX}" fill="none" className="stroke-fig-ramp-${n}" strokeWidth="1.5" />`);
    L.push(`<rect x="${r(p + 1.25)}" y="${y + 1.25}" width="${r(PW - 2.5)}" height="${h - 2.5}" rx="${RX - 1.25}" fill="none" stroke="url(#${P}-rim)" strokeWidth="1" className="fig-fx" />`);
    stages[i].name.forEach((s, k) => L.push(`<text x="${r(cx)}" y="${y + 17 + k * 12}" fontSize="10.5" fill="currentColor" textAnchor="middle">${T(s)}</text>`));
    L.push(`<text x="${r(cx)}" y="${BY - 7}" fontSize="10.5" fill="currentColor" fontWeight="600" textAnchor="middle">${T(stages[i].cost)}</text>`);
  });
  // Before the line: one kind of fix, a quiet sign that points nowhere.
  L.push(`<rect x="${r(before.x)}" y="${SY}" width="${r(before.w)}" height="${SH}" rx="6" className="fill-card" stroke="none" />`);
  L.push(`<rect x="${r(before.x)}" y="${SY}" width="${r(before.w)}" height="${SH}" rx="6" fill="url(#${P}-quiet)" stroke="none" className="fig-fx" />`);
  L.push(`<rect x="${r(before.x)}" y="${SY}" width="${r(before.w)}" height="${SH}" rx="6" fill="none" className="stroke-fig-generic" strokeWidth="1.2" />`);
  L.push(`<text x="${r(before.x + 8)}" y="${r(SY + 12.2)}" fontSize="10.5" fill="currentColor" fontWeight="600">${T("before: pre-tape-out ECO")}</text>`);
  L.push(`<text x="${r(before.x + 8)}" y="${r(SY + 30)}" fontSize="10.5" className="fill-muted-foreground">${T("edits the design database;")}</text>`);
  L.push(`<text x="${r(before.x + 8)}" y="${r(SY + 43)}" fontSize="10.5" className="fill-muted-foreground">${T("no masks exist yet")}</text>`);
  // After it: three routes, each a sign on the line that points away from it.
  routes.forEach(([name, why], k) => {
    const y = signAt(k);
    L.push(`<path d="${signPath(y)}" className="fill-card stroke-tier-current" strokeWidth="1.5" strokeLinejoin="round" />`);
    L.push(`<path d="${signPath(y)}" className="fig-fx fill-tier-current" fillOpacity="0.16" stroke="none" />`);
    L.push(`<text x="${r(sx + 6)}" y="${r(y + 12.2)}" fontSize="10.5" fill="currentColor" fontWeight="600">${T(name)}</text>`);
    L.push(`<text x="${r(sx + 6)}" y="${r(y + 30)}" fontSize="10.5" className="fill-muted-foreground">${T(why)}</text>`);
  });
  return [
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${P}-title" aria-describedby="${P}-desc" data-recap-picture="wide" style={{ display: "block", width: "100%", maxWidth: 360, marginLeft: ${JSON.stringify(CENTRE_WHEN_STACKED)} }}>`,
    `    <title id="${P}-title">${f.titleText}</title>`,
    `    <desc id="${P}-desc">${f.descText}</desc>`,
    ...L.map((s) => `    ${s}`),
    `  </svg>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ the four decisions */
const CASES = [
  { head: "1 · ECO", kind: ["none", "none", "none", "none"], lift: 0, text: ["database only;", "no masks yet"] },
  { head: "2 · metal-only", kind: ["held", "held", "new", "new"], lift: 5, text: ["upper metal + vias;", "held wafers"] },
  { head: "3 · full respin", kind: ["new", "new", "new", "new"], lift: 0, text: ["every mask;", "new wafers"] },
  { head: "4 · firmware now", kind: ["held", "held", "held", "held"], lift: 0, text: ["silicon unchanged;", "masks later"] },
];

function decisionsSvg(f, lay) {
  const { sfx, W, H, wide, place } = lay;
  const P = `f1a-decisions${sfx}`;
  // The cut block of the respin figure, to the unit: the wide left face is the cross-section, under a shallow top.
  const w = 52, d = 14, TM = 7, TB = 13, GAP = 4;
  const ux = 0.866, uy = 0.5;
  const R = [d * ux, -d * uy];
  const Lc = [-w * ux, -w * uy];
  const B = [(d - w) * ux, -(w + d) * uy];
  const pt = (p, dy = 0) => `${r(p[0])},${r(p[1] + dy)}`;
  const top = [[0, 0], R, B, Lc].map((p) => pt(p)).join(" ");
  const left = (t) => [pt(Lc), pt([0, 0]), pt([0, 0], t), pt(Lc, t)].join(" ");
  const right = (t) => [pt([0, 0]), pt(R), pt(R, t), pt([0, 0], t)].join(" ");
  const sil = (t) => [pt(Lc), pt(B), pt(R), pt(R, t), pt([0, 0], t), pt(Lc, t)].join(" ");
  const wire = (t, back) => `M${pt(Lc)} L${pt([0, 0])} L${pt(R)} M${pt(Lc, t)} L${pt([0, 0], t)} L${pt(R, t)} M${pt(Lc)} v${t} M${pt(R)} v${t}` + (back ? ` M${pt(Lc)} L${pt(B)} L${pt(R)}` : "");
  // One plate, drawn in place (no <use>: rules that reach into a figure by its ancestors, forced colours among them, do not reach a <use> copy).
  const plate = (kind, t, x, y, topmost) => {
    const at = `transform="translate(${r(x)} ${r(y)})"`;
    if (kind === "none") return `  <path ${at} d="${wire(t, topmost)}" fill="none" className="stroke-fig-generic" strokeWidth="1.1" strokeDasharray="4 3" strokeLinejoin="round" />`;
    const under = `<polygon points="${sil(t)}" className="fill-card" stroke="none" />`;
    if (kind === "held") {
      const s = `stroke="currentColor" strokeWidth="1" strokeLinejoin="round"`;
      return `  <g ${at} className="text-fig-generic">${under}<polygon points="${top}" className="fig-solid fig-face-top" ${s} /><polygon points="${left(t)}" className="fig-face-left" ${s} /><polygon points="${right(t)}" className="fig-face-right" ${s} /></g>`;
    }
    const s = `fill="url(#${P}-hatch)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"`;
    return (
      `  <g ${at} className="text-fig-ramp-4">${under}<polygon points="${top}" className="fig-face-top" stroke="none" /><polygon points="${left(t)}" className="fig-face-left" stroke="none" /><polygon points="${right(t)}" className="fig-face-right" stroke="none" />` +
      `<polygon points="${top}" ${s} /><polygon points="${left(t)}" ${s} /><polygon points="${right(t)}" ${s} /></g>`
    );
  };
  const D = [];
  D.push(`    <pattern id="${P}-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" className="text-fig-ramp-4"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.5" /></pattern>`);
  D.push(`    <filter id="${P}-shadow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="3" /></filter>`);
  D.push(`    <filter id="${P}-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="5" /></filter>`);
  const wells = [], shadows = [], glows = [], body = [];
  CASES.forEach((c, k) => {
    const g = place(k); // { well, cx, yBase, headY, textY }
    // The block is centred in its well: its outline runs from the left corners to the right corner.
    const XF = g.cx - (Lc[0] + R[0]) / 2;
    wells.push(`  <rect x="${r(g.well.x)}" y="${r(g.well.y)}" width="${r(g.well.w)}" height="${r(g.well.h)}" rx="9" className="fig-well stroke-fig-generic" strokeWidth="1" strokeOpacity="0.55" />`);
    body.push(`  <text x="${r(g.cx)}" y="${r(g.headY)}" fontSize="12" fill="currentColor" fontWeight="600" textAnchor="middle">${T(c.head)}</text>`);
    const yBase = g.yBase;
    const ys = [yBase, yBase - GAP - TM, yBase - GAP - TM - (GAP + TM) - c.lift, yBase - GAP - TM - 2 * (GAP + TM) - c.lift];
    // Silicon that exists casts a shadow; the wireframe of bug 1 does not, because no mask exists yet.
    if (c.kind[0] !== "none") shadows.push(`<polygon transform="translate(${r(XF)} ${r(yBase + TB + 3)})" points="${top}" className="fig-shadow" stroke="none" />`);
    ys.forEach((y, i) => {
      const t = i === 0 ? TB : TM;
      if (c.kind[i] === "new") glows.push(`<polygon transform="translate(${r(XF)} ${r(y)})" points="${sil(t)}" className="fill-fig-ramp-4" stroke="none" />`);
      body.push(plate(c.kind[i], t, XF, y, i === 3));
    });
    c.text.forEach((s, i) => body.push(`  <text x="${r(g.cx)}" y="${r(g.textY + i * 14)}" fontSize="10.5" fill="currentColor" textAnchor="middle">${T(s)}</text>`));
  });
  return [
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="f1a-decisions-title${sfx}" aria-describedby="f1a-decisions-desc${sfx}" className="${wide ? "hidden h-auto w-full sm:block" : "block h-auto w-full sm:hidden"}">`,
    `  <title id="f1a-decisions-title${sfx}">${f.titleText}</title>`,
    `  <desc id="f1a-decisions-desc${sfx}">${f.descText}</desc>`,
    `  <defs>`,
    ...D,
    `  </defs>`,
    ...wells,
    `  <g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow)" aria-hidden="true">${shadows.join("")}</g>`,
    `  <g className="fig-fx fig-fx-blur fig-glow-soft" filter="url(#${P}-glow)" aria-hidden="true">${glows.join("")}</g>`,
    ...body,
    `</svg>`,
  ];
}

function decisions() {
  const block = FIGURE("f1a-decisions-title").exec(base)[0];
  const f = { ...words(block), figcaption: /<figcaption>[\s\S]*?<\/figcaption>/.exec(block)[0] };
  // Column: the four cases side by side on one ground line, one well each. Phone: two rows of two.
  const cols = (k) => { const x0 = 4 + k * 138; return { well: { x: x0, y: 4, w: 130, h: 158 }, cx: x0 + 65, yBase: 84, headY: 122, textY: 139 }; };
  const grid = (k) => { const x0 = 1 + (k % 2) * 167, y0 = 2 + Math.floor(k / 2) * 160; return { well: { x: x0, y: y0, w: 163, h: 154 }, cx: x0 + 81.5, yBase: y0 + 80, headY: y0 + 118, textY: y0 + 135 }; };
  return [
    `<figure>`,
    `<div className="glass-liquid fig-panel">`,
    `<div className="fig-titlebar" aria-hidden="true" data-fig-title><span>${f.titleText}</span></div>`,
    `<div className="fig-stage">`,
    ...decisionsSvg(f, { sfx: "", wide: true, W: 552, H: 166, place: cols }),
    ...decisionsSvg(f, { sfx: "-s", wide: false, W: 332, H: 318, place: grid }),
    `</div>`,
    `</div>`,
    f.figcaption,
    `</figure>`,
  ].join("\n");
}

let cur = fs.readFileSync(`${WT}/${REL}`, "utf8");
if (!RECAP_SVG.test(cur)) throw new Error("cannot find the recap drawing in the worktree lesson");
cur = cur.replace(RECAP_SVG, () => recap());
if (!FIGURE("f1a-decisions-title").test(cur)) throw new Error("cannot find f1a-decisions-title in the worktree lesson");
cur = cur.replace(FIGURE("f1a-decisions-title"), () => decisions());
fs.writeFileSync(`${WT}/${REL}`, cur);
console.log("written");
