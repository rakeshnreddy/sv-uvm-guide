// Generates the last four hand-drawn figures of F1A and splices them into the lesson:
//   life      "The verification lifecycle and who owns each step"            two feedback loops over a column of plates
//   shift     "Shift left: the same activities, moved earlier in the schedule" two lanes on one time axis, the tape-out line of figure A
//   ladder    "The DV career ladder: four rungs and what each one owns"       an isometric step ladder, rungs in ramp steps
//   coverage  "100% coverage of an incomplete plan"                            the full plan beside the part it never listed
// Usage: [ONLY=life,shift,ladder,coverage] node gen4.cjs
// <title>, <desc> and <figcaption> are read from the lesson at cb80965f (base-index.mdx); every <text> string is the
// original, in the original order (texts4.cjs proves it).
const fs = require("fs");
const path = require("path");
const WT = "<repo>";
const REL = "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx";
const base = fs.readFileSync(path.join(__dirname, "base-index.mdx"), "utf8");
const r = (n) => String(Math.round(n * 10) / 10);
const T = (s) => `{${JSON.stringify(s)}}`;
const FIGURE = (id) => new RegExp(`<figure>(?:(?!</figure>)[\\s\\S])*?${id}[\\s\\S]*?</figure>`);
const words = (id) => {
  const block = FIGURE(id).exec(base)[0];
  return {
    titleText: /<title [^>]*>([\s\S]*?)<\/title>/.exec(block)[1],
    descText: /<desc [^>]*>([\s\S]*?)<\/desc>/.exec(block)[1],
    figcaption: /<figcaption>[\s\S]*?<\/figcaption>/.exec(block)[0],
  };
};

/* ------------------------------------------------------------------ shared parts (the construction of figures A and B) */
const text = (x, y, s, { size = 10.5, weight, anchor, cls, op } = {}) =>
  `<text x="${r(x)}" y="${r(y)}" fontSize="${size}"${cls ? "" : ` fill="currentColor"`}${op ? ` fillOpacity="${op}"` : ""}${weight ? ` fontWeight="${weight}"` : ""}${anchor ? ` textAnchor="${anchor}"` : ""}${cls ? ` className="${cls}"` : ""}>${T(s)}</text>`;
const grad = (id, cls) => `  <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1" className="${cls}"><stop offset="0" className="fig-stop-top" /><stop offset="1" className="fig-stop-bottom" /></linearGradient>`;
const defs = (P, sfx, W, H, extra = [], blur = { shadow: 2.4, glow: 4.5 }) => [
  `<defs>`,
  ...extra,
  grad(`${P}-quiet${sfx}`, "fig-grad-quiet"),
  `  <linearGradient id="${P}-rim${sfx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="fig-rim-top" /><stop offset="0.6" className="fig-rim-end" /></linearGradient>`,
  `  <filter id="${P}-shadow${sfx}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="${blur.shadow}" /></filter>`,
  `  <filter id="${P}-glow${sfx}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><feGaussianBlur stdDeviation="${blur.glow}" /></filter>`,
  `</defs>`,
];
// A tray. Its border is quiet (0.55, as in figures A and B) unless the box is itself a subject of the figure (full).
const well = ({ x, y, w, h }, rx = 9, full = false) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rx}" className="fig-well stroke-fig-generic" strokeWidth="${full ? 1.2 : 1}"${full ? "" : ` strokeOpacity="0.55"`} />`;
// A plate: an opaque card base, the body gradient, an optional solid cap, the outline and the lit rim.
function plate(P, sfx, { x, y, w, h, rx = 6, body = "quiet", stroke = "stroke-fig-generic", sw = 1.5, cap = null, rim = true }) {
  const box = `x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rx}"`;
  const o = [`<rect ${box} className="fill-card" stroke="none" />`, `<rect ${box} fill="url(#${P}-${body}${sfx})" stroke="none" className="fig-fx" />`];
  if (cap) o.push(`<path d="M${r(x)},${r(y + rx)} A${rx},${rx} 0 0 1 ${r(x + rx)},${r(y)} H${r(x + w - rx)} A${rx},${rx} 0 0 1 ${r(x + w)},${r(y + rx)} Z" className="fig-solid ${cap}" stroke="none" />`);
  o.push(`<rect ${box} fill="none" className="${stroke}" strokeWidth="${sw}" />`);
  if (rim) o.push(`<rect x="${r(x + 1.3)}" y="${r(y + 1.25)}" width="${r(w - 2.6)}" height="${r(h - 2.5)}" rx="${r(rx - 1.25)}" fill="none" stroke="url(#${P}-rim${sfx})" strokeWidth="1" className="fig-fx" />`);
  return o;
}
const shadowOf = ({ x, y, w, h, rx = 6 }, dy = 3) => `<rect x="${r(x + 1)}" y="${r(y + dy)}" width="${r(w - 2)}" height="${r(h)}" rx="${rx}" className="fig-shadow" stroke="none" />`;
const svgOpen = (id, sfx, W, H, f, wide) => [
  `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title${sfx}" aria-describedby="${id}-desc${sfx}" className="${wide ? "hidden h-auto w-full sm:block" : "block h-auto w-full sm:hidden"}">`,
  `  <title id="${id}-title${sfx}">${f.titleText}</title>`,
  `  <desc id="${id}-desc${sfx}">${f.descText}</desc>`,
];
const figure = (f, svgs) => [
  `<figure>`,
  `<div className="glass-liquid fig-panel">`,
  `<div className="fig-titlebar" aria-hidden="true" data-fig-title><span>${f.titleText}</span></div>`,
  `<div className="fig-stage">`,
  ...svgs,
  `</div>`,
  `</div>`,
  f.figcaption,
  `</figure>`,
].join("\n");
const indent = (lines) => lines.map((l) => (l.startsWith("  ") ? l : `  ${l}`));

/* ------------------------------------------------------------------ the lifecycle: two loops */
function lifeSvg(f, wide) {
  const P = "f1a-life", sfx = wide ? "" : "-s";
  const steps = [
    ["1 · Spec", "architects; reviewed by all"],
    ["2 · Verification plan", "DV lead"],
    ["3 · Testbench", "DV engineers"],
    ["4 · Regression", "DV runs it; design fixes RTL"],
    ["5 · Sign-off review", "DV lead and project leads"],
    ["Tape-out", "layout goes to the fab"],
    ["Post-silicon validation", "validation engineers, lab"],
  ];
  // Column: one-line plates, the step on the left and its owner on the right of one spine. Phone: two-line plates.
  const G = wide
    ? { W: 552, H: 296, px: 12, pw: 291, ph: 28, ys: [12, 52, 92, 132, 172, 220, 260], tray: { x: 4, y: 4, w: 414, h: 204 }, spineX: 156, loopX: 532, labX: 436, labY: 146.5, pitch: 13.5 }
    : { W: 332, H: 392, px: 8, pw: 180, ph: 40, ys: [10, 64, 118, 172, 226, 288, 342], tray: { x: 2, y: 2, w: 296, h: 272 }, spineX: 98, loopX: 314, labX: 199, labY: 292, pitch: 13 };
  const E = G.px + G.pw; // the right edge of the plates: both loops leave and return here
  const mid = (i) => G.ys[i] + G.ph / 2;
  // The short loop: a ring on Regression. It leaves the plate, turns once and comes back.
  const cy = mid(3), cx = E + 30, rr = 15, dy = 6, xj = cx - Math.sqrt(rr * rr - dy * dy);
  const ring = `M${r(E)},${r(cy - dy)} H${r(xj)} A${rr},${rr} 0 1 1 ${r(xj)},${r(cy + dy)} H${r(E + 8)}`;
  const ringHead = `${r(E + 8.5)},${r(cy + dy - 4.5)} ${r(E + 0.5)},${r(cy + dy)} ${r(E + 8.5)},${r(cy + dy + 4.5)}`;
  // The long loop: out of Post-silicon validation, round the outside of everything, back into the Verification plan.
  const y7 = mid(6), y2 = mid(1), LX = G.loopX, R = 12;
  const loop = `M${r(E)},${r(y7)} H${r(LX - R)} A${R},${R} 0 0 0 ${r(LX)},${r(y7 - R)} V${r(y2 + R)} A${R},${R} 0 0 0 ${r(LX - R)},${r(y2)} H${r(E + 9)}`;
  const loopHead = `${r(E + 10.5)},${r(y2 - 5.5)} ${r(E + 0.5)},${r(y2)} ${r(E + 10.5)},${r(y2 + 5.5)}`;
  const boxes = steps.map((_, i) => ({ x: G.px, y: G.ys[i], w: G.pw, h: G.ph }));
  const L = [];
  L.push(...defs(P, sfx, G.W, G.H));
  // The tray: the five numbered steps are verification before tape-out, and the daily loop turns inside it.
  L.push(well(G.tray));
  L.push(`<g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow${sfx})" aria-hidden="true">${boxes.slice(0, 5).map((b) => shadowOf(b)).join("")}</g>`);
  // The focal part: the long loop glows. The short loop is a lit trace (a band under its line).
  L.push(`<g className="fig-fx fig-fx-blur fig-glow" filter="url(#${P}-glow${sfx})" aria-hidden="true"><path d="${loop}" fill="none" className="stroke-tier-current" strokeWidth="7" /></g>`);
  L.push(`<path d="${ring}" className="fig-fx fig-trace stroke-tier-current" strokeWidth="7" />`);
  steps.forEach(([name, owner], i) => {
    const b = boxes[i];
    L.push(...plate(P, sfx, i < 5 ? b : { ...b, sw: 1, rim: false }));
    if (wide) {
      L.push(`<line x1="${G.spineX}" y1="${r(b.y + 5)}" x2="${G.spineX}" y2="${r(b.y + b.h - 5)}" className="fig-fx stroke-fig-generic" strokeWidth="1" strokeOpacity="0.55" />`);
      L.push(text(b.x + 12, b.y + b.h / 2 + 4.2, name, { size: 12, weight: 600 }));
      L.push(text(G.spineX + 10, b.y + b.h / 2 + 3.8, owner, { op: 0.8 }));
    } else {
      L.push(text(b.x + 10, b.y + 17, name, { size: 12, weight: 600 }));
      L.push(text(b.x + 10, b.y + 31, owner, { op: 0.8 }));
    }
    if (i > 0) {
      const y0 = boxes[i - 1].y + G.ph, y1 = b.y;
      L.push(`<line x1="${G.spineX}" y1="${r(y0 + 0.75)}" x2="${G.spineX}" y2="${r(y1 - 6)}" className="stroke-fig-generic" strokeWidth="1.5" />`);
      L.push(`<polygon points="${r(G.spineX - 4)},${r(y1 - 7)} ${r(G.spineX + 4)},${r(y1 - 7)} ${G.spineX},${r(y1 - 0.75)}" className="fig-solid fill-fig-generic" stroke="none" />`);
    }
  });
  L.push(`<path d="${ring}" fill="none" className="stroke-tier-current" strokeWidth="2" />`);
  L.push(`<circle cx="${r(E)}" cy="${r(cy - dy)}" r="2.6" className="fig-solid fill-tier-current" stroke="none" />`);
  L.push(`<polygon points="${ringHead}" className="fig-solid fill-tier-current" stroke="none" />`);
  L.push(text(cx + rr + 9, cy - 2.6, "bug: fix the"));
  L.push(text(cx + rr + 9, cy + 10.4, "RTL, rerun"));
  L.push(`<path d="${loop}" fill="none" className="stroke-tier-current" strokeWidth="2.5" strokeDasharray="5 3" />`);
  L.push(`<polygon points="${loopHead}" className="fig-solid fill-tier-current" stroke="none" />`);
  L.push(`<circle cx="${r(E)}" cy="${r(y7)}" r="3.2" className="fig-solid fill-tier-current" stroke="none" />`);
  ["escape found", "late: add the", "missing scenario,", "check and", "coverage item"].forEach((s, i) => L.push(text(G.labX, G.labY + i * G.pitch, s)));
  return [...svgOpen(P, sfx, G.W, G.H, f, wide), ...indent(L), `</svg>`];
}

/* ------------------------------------------------------------------ shift left: two lanes, one time axis */
function shiftSvg(f, wide) {
  const P = "f1a-shift", sfx = wide ? "" : "-s";
  const G = wide
    ? {
        W: 552, TX: 410, lane: { x: 4, w: 544 }, hx: 16, pad: 8,
        late: [{ s: "testbench + sim", x: 262, w: 136 }, { s: "software", x: 422, w: 116 }],
        early: [{ s: "plan", x: 20, w: 76, row: 0 }, { s: "lint + block sim", x: 104, w: 148, row: 0 }, { s: "formal (blocks)", x: 130, w: 122, row: 1 }, { s: "emulation", x: 262, w: 136, row: 0 }],
        lateX: [292, 322, 352, 382, 438, 468, 498, 528], earlyX: [58, 124, 152, 180, 208, 236, 330, 480],
        rail: { x0: 12, x1: 530 }, ticks: [100, 256], labels: [58, 178, 328, null, 480], moves: [[330, 184], [480, 336]],
      }
    : {
        W: 332, TX: 246, lane: { x: 2, w: 328 }, hx: 10, pad: 7,
        late: [{ s: "testbench + sim", x: 150, w: 90 }, { s: "software", x: 252, w: 74 }],
        early: [{ s: "plan", x: 8, w: 46, row: 0 }, { s: "lint + block sim", x: 58, w: 88, row: 0 }, { s: "formal (blocks)", x: 62, w: 84, row: 1 }, { s: "emulation", x: 150, w: 90, row: 0 }],
        lateX: [176, 194, 212, 230, 264, 282, 300, 318], earlyX: [31, 66, 84, 102, 120, 138, 195, 289],
        rail: { x0: 6, x1: 318 }, ticks: [56, 148], labels: [31, 102, 195, null, 289], moves: [[195, 108], [289, 201]],
      };
  const H = 256, BH = 18, D = 6; // D: lane 2 and the axis sit this much lower than a 22-unit gutter would put them
  const lane1 = { x: G.lane.x, y: 26, w: G.lane.w, h: 72 }, lane2 = { x: G.lane.x, y: 120 + D, w: G.lane.w, h: 96 };
  const lateBars = G.late.map((b) => ({ ...b, y: 52, h: BH, rx: 5 }));
  const earlyBars = G.early.map((b) => ({ ...b, y: 146 + D + b.row * 22, h: BH, rx: 5 }));
  const X1 = 90, X2 = 206 + D, RY = 228 + D, TX = G.TX;
  const cross = (x, y) => text(x, y + 0.5, "✕", { size: 14.5, weight: 700, anchor: "middle", cls: "fill-fig-rose-text" });
  const L = [];
  L.push(...defs(P, sfx, G.W, H));
  L.push(well(lane1), well(lane2));
  L.push(`<g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow${sfx})" aria-hidden="true">${[...lateBars, ...earlyBars].map((b) => shadowOf(b, 2.5)).join("")}</g>`);
  // One blurred pass: the tape-out line of figure A, and the bugs, which are the focal marks. The halo of a bug is
  // half strength: at full strength a rose cross on its own rose halo measured 4.1:1 in light mode (5.3:1 now).
  L.push(`<g className="fig-fx fig-fx-blur fig-glow" filter="url(#${P}-glow${sfx})" aria-hidden="true"><rect x="${r(TX - 3.5)}" y="4" width="7" height="${RY + 6}" rx="3.5" className="fill-tier-current" stroke="none" fillOpacity="0.5" />${[...G.lateX.map((x) => [x, X1]), ...G.earlyX.map((x) => [x, X2])].map(([x, y]) => `<circle cx="${x}" cy="${r(y - 4.6)}" r="6.5" className="fill-fig-rose" stroke="none" fillOpacity="0.5" />`).join("")}</g>`);
  // The movement: each late activity slides left as it drops into the lower lane (software crosses the line).
  for (const [x0, x1] of G.moves) {
    const y0 = lane1.y + lane1.h + 2.5, y1 = lane2.y - 2.5, len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const bx = x1 - ux * 9, by = y1 - uy * 9; // the base of the head
    L.push(`<path d="M${r(x0)},${r(y0)} L${r(bx)},${r(by)}" className="fig-fx fig-trace stroke-fig-generic" strokeWidth="7" />`);
    L.push(`<line x1="${r(x0)}" y1="${r(y0)}" x2="${r(bx)}" y2="${r(by)}" className="stroke-fig-generic" strokeWidth="2" />`);
    L.push(`<polygon points="${r(bx - uy * 5)},${r(by + ux * 5)} ${r(x1)},${r(y1)} ${r(bx + uy * 5)},${r(by - ux * 5)}" className="fig-solid fill-fig-generic" stroke="none" />`);
  }
  // The time axis.
  L.push(`<rect x="${G.rail.x0}" y="${RY - 1.5}" width="${G.rail.x1 - G.rail.x0}" height="3" className="fig-solid fill-fig-generic" stroke="none" />`);
  L.push(`<polygon points="${G.rail.x1 - 0.5},${RY - 5.5} ${G.rail.x1 + 10},${RY} ${G.rail.x1 - 0.5},${RY + 5.5}" className="fig-solid fill-fig-generic" stroke="none" />`);
  for (const x of G.ticks) L.push(`<line x1="${x}" y1="${RY - 5}" x2="${x}" y2="${RY + 5}" className="stroke-fig-generic" strokeWidth="1.5" />`);
  // The tape-out line and its flag, as in figure A.
  L.push(`<line x1="${TX}" y1="20" x2="${TX}" y2="${RY + 8}" className="stroke-tier-current" strokeWidth="2.5" strokeDasharray="5 3" />`);
  L.push(`<rect x="${TX - 32}" y="2" width="64" height="18" rx="6" className="fill-card stroke-tier-current" strokeWidth="1.5" />`);
  L.push(`<rect x="${TX - 32}" y="2" width="64" height="18" rx="6" className="fig-fx fill-tier-current" fillOpacity="0.16" stroke="none" />`);
  // Lane 1.
  L.push(text(G.hx, 44, "Late discovery", { size: 12, weight: 600 }));
  for (const b of lateBars) { L.push(...plate(P, sfx, { ...b, sw: 1.2 })); L.push(text(b.x + G.pad, b.y + 12.7, b.s)); }
  for (const x of G.lateX) L.push(cross(x, X1));
  // Lane 2.
  L.push(text(G.hx, 138 + D, "Shift left", { size: 12, weight: 600 }));
  for (const b of earlyBars) { L.push(...plate(P, sfx, { ...b, sw: 1.2 })); L.push(text(b.x + G.pad, b.y + 12.7, b.s)); }
  for (const x of G.earlyX) L.push(cross(x, X2));
  ["spec", "RTL", "integration", "tape-out", "silicon"].forEach((s, i) => {
    if (s === "tape-out") L.push(text(TX, 15, s, { size: 11.5, weight: 600, anchor: "middle" }));
    else L.push(text(G.labels[i], 244 + D, s, { anchor: "middle", cls: "fill-muted-foreground" }));
  });
  return [...svgOpen(P, sfx, G.W, H, f, wide), ...indent(L), `</svg>`];
}

/* ------------------------------------------------------------------ the career ladder: an isometric step ladder */
function ladderSvg(f, wide) {
  const P = "f1a-ladder", sfx = wide ? "" : "-s";
  // d: length of a rung (x), a: its depth (y), t: its thickness; w: run and h: rise of one step; rw, b: a rail.
  const G = wide
    ? { W: 552, d: 100, a: 26, t: 6, w: 32, h: 20, z1: 12, rw: 6, b: 10, over: 11, RX: 252 }
    : { W: 332, d: 30, a: 16, t: 5, w: 14, h: 32, z1: 20, rw: 4, b: 7, over: 10 };
  const C = 0.866;
  const raw = ([x, y, z]) => [C * (x - y), 0.5 * (x + y) - z];
  let pr = raw;
  const poly = (ps) => ps.map((p) => pr(p).map(r).join(",")).join(" ");
  const rungs = [1, 2, 3, 4].map((k) => ({ k, y0: -(k - 1) * G.w, z: G.z1 + (k - 1) * G.h }));
  const yc1 = -G.a / 2, zc1 = G.z1 - G.t / 2, zt = G.z1 + 3 * G.h + G.over;
  const yAt = (z) => yc1 - ((z - zc1) * G.w) / G.h;
  const yF = yAt(0), yT = yAt(zt), hb = G.b / 2;
  const rail = (x0) => {
    const x1 = x0 + G.rw;
    return [
      `<g className="text-fig-generic">`,
      `<polygon points="${poly([[x0, yF + hb, 0], [x1, yF + hb, 0], [x1, yF - hb, 0], [x1, yT - hb, zt], [x0, yT - hb, zt], [x0, yT + hb, zt]])}" className="fill-card" stroke="none" />`,
      `<polygon points="${poly([[x0, yF + hb, 0], [x1, yF + hb, 0], [x1, yT + hb, zt], [x0, yT + hb, zt]])}" className="fig-face-left" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `<polygon points="${poly([[x1, yF + hb, 0], [x1, yF - hb, 0], [x1, yT - hb, zt], [x1, yT + hb, zt]])}" className="fig-face-right" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `<polygon points="${poly([[x0, yT - hb, zt], [x1, yT - hb, zt], [x1, yT + hb, zt], [x0, yT + hb, zt]])}" className="fig-face-top" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `</g>`,
    ].join("");
  };
  const rung = ({ k, y0, z }) => {
    const { d, a, t } = G;
    return [
      `<g className="text-fig-ramp-${k}">`,
      `<polygon points="${poly([[0, y0 - a, z], [d, y0 - a, z], [d, y0 - a, z - t], [d, y0, z - t], [0, y0, z - t], [0, y0, z]])}" className="fill-card" stroke="none" />`,
      `<polygon points="${poly([[0, y0, z], [d, y0, z], [d, y0, z - t], [0, y0, z - t]])}" className="fig-face-left" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `<polygon points="${poly([[d, y0, z], [d, y0 - a, z], [d, y0 - a, z - t], [d, y0, z - t]])}" className="fig-face-right" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `<polygon points="${poly([[0, y0 - a, z], [d, y0 - a, z], [d, y0, z], [0, y0, z]])}" className="fig-solid fig-ramp-mark fill-fig-ramp-${k}" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />`,
      `</g>`,
    ].join("");
  };
  const labels = [
    ["4 · DV architect", "methodology and reuse across teams"],
    ["3 · Verification lead", "owns the plan and sign-off"],
    ["2 · Senior engineer", "plans complex blocks, integrates verification IP"],
    ["1 · Verification engineer", "writes tests, builds environments, closes coverage"],
  ];
  // Fit: the ladder's box decides the height; in the column it stands at the right edge, on a phone at the left.
  const corners = [];
  for (const x of [-G.rw, 0, G.d, G.d + G.rw]) for (const [y, z] of [[yF + hb, 0], [yF - hb, 0], [yT + hb, zt], [yT - hb, zt]]) corners.push(raw([x, y, z]));
  for (const g of rungs) for (const x of [0, G.d]) for (const y of [g.y0, g.y0 - G.a]) for (const z of [g.z, g.z - G.t]) corners.push(raw([x, y, z]));
  const minX = Math.min(...corners.map((c) => c[0])), maxX = Math.max(...corners.map((c) => c[0]));
  const minY = Math.min(...corners.map((c) => c[1])), maxY = Math.max(...corners.map((c) => c[1]));
  const M = 8;
  const ox = wide ? G.W - M - 2 - maxX : M - minX, oy = M - minY;
  G.H = Math.ceil(maxY - minY + 2 * M + 2);
  pr = (p) => { const [X, Y] = raw(p); return [X + ox, Y + oy]; };
  const L = [];
  L.push(...defs(P, sfx, G.W, G.H, [], { shadow: wide ? 5 : 3.5, glow: 4.5 }));
  // The floor under the ladder: one soft shadow.
  L.push(`<g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow${sfx})" aria-hidden="true" opacity="0.6"><polygon points="${poly([[0, yT + 2 * G.w, 0], [G.d, yT + 2 * G.w, 0], [G.d, yF, 0], [0, yF, 0]])}" className="fig-shadow" stroke="none" /></g>`);
  L.push(rail(-G.rw));
  for (const g of [...rungs].reverse()) L.push(rung(g));
  L.push(rail(G.d));
  // Labels beside the ladder, top rung first (the order of the original), each at the height of its rung.
  [...rungs].reverse().forEach((g, i) => {
    if (wide) {
      const [X, Y] = pr([-G.rw, g.y0 - G.a / 2 + hb, g.z - G.t / 2]);
      L.push(`<path d="M${r(G.RX + 9)},${r(Y)} H${r(X - 4.5)}" fill="none" className="stroke-fig-generic" strokeWidth="1" />`);
      L.push(`<circle cx="${r(X - 4.5)}" cy="${r(Y)}" r="1.8" className="fig-solid fill-fig-generic" stroke="none" />`);
      L.push(text(G.RX, Y + 1, labels[i][0], { size: 11.5, weight: 600, anchor: "end" }));
      L.push(text(G.RX, Y + 14.5, labels[i][1], { anchor: "end" }));
    } else {
      const [X, Y] = pr([G.d + G.rw, g.y0 - G.a / 2, g.z - G.t / 2]);
      const x = X + C * hb + 9;
      L.push(text(x, Y + 1, labels[i][0], { size: 11.5, weight: 600 }));
      L.push(text(x, Y + 14.5, labels[i][1]));
    }
  });
  return [...svgOpen(P, sfx, G.W, G.H, f, wide), ...indent(L), `</svg>`];
}

/* ------------------------------------------------------------------ coverage of an incomplete plan: the gap */
function coverageSvg(f, wide) {
  const P = "f1a-signoff", sfx = wide ? "" : "-s";
  const G = wide
    ? { W: 552, H: 112, tray: { x: 4, y: 4, w: 544, h: 104 }, head: [16, 22, 11], plan: { x: 14, y: 32, w: 252, h: 66 }, gap: { x: 276, y: 32, w: 262, h: 66 },
        planText: [[26, 55], [26, 69], [26, 83], [150, 55], [150, 69], [150, 83]],
        q1: { cx: 293, cy: 56, x: 305, ys: [55, 69, 83] }, q2: { cx: 424, cy: 63, x: 436, ys: [62, 76] } }
    : { W: 332, H: 148, tray: { x: 2, y: 2, w: 328, h: 144 }, head: [10, 19, 10.5], plan: { x: 8, y: 28, w: 156, h: 110 }, gap: { x: 170, y: 28, w: 154, h: 110 },
        planText: [[18, 52], [18, 66], [18, 79], [18, 98], [18, 112], [18, 128]],
        q1: { cx: 183, cy: 53, x: 194, ys: [52, 65, 78] }, q2: { cx: 183, cy: 103, x: 194, ys: [102, 115] } };
  const cross = (q) => text(q.cx, q.cy + 0.5, "✕", { size: 14.5, weight: 700, anchor: "middle", cls: "fill-fig-rose-text" });
  const gapBox = (extra) => `<rect x="${G.gap.x}" y="${G.gap.y}" width="${G.gap.w}" height="${G.gap.h}" rx="6" fill="none" className="stroke-fig-rose" ${extra} />`;
  const L = [];
  L.push(...defs(P, sfx, G.W, G.H, [grad(`${P}-ok${sfx}`, "text-fig-emerald-body")]));
  // The outer box: everything the chip must do. A tray, so what is in it sits on it. The description names this box,
  // so its border is drawn at full strength (a tray border at 0.55 measures 2.5:1 in light mode).
  L.push(well(G.tray, 10, true));
  L.push(`<g className="fig-fx fig-fx-blur" filter="url(#${P}-shadow${sfx})" aria-hidden="true">${shadowOf(G.plan)}</g>`);
  // The focal part: the gap. Its outline and its two crosses share one soft glow.
  L.push(`<g className="fig-fx fig-fx-blur fig-glow-soft" filter="url(#${P}-glow${sfx})" aria-hidden="true">${gapBox(`strokeWidth="5"`)}${[G.q1, G.q2].map((q) => `<circle cx="${q.cx}" cy="${r(q.cy - 4.6)}" r="7" className="fill-fig-rose" stroke="none" />`).join("")}</g>`);
  L.push(text(G.head[0], G.head[1], "what the chip must do, including what the spec forgot", { size: G.head[2], weight: 600 }));
  // The plan: full, and in the colour of a match.
  L.push(...plate(P, sfx, { ...G.plan, body: "ok", stroke: "stroke-fig-emerald", cap: "fill-fig-emerald" }));
  const planWords = [
    ["the verification plan", { size: 11.5, weight: 600 }],
    ["scenarios, checks,", {}],
    ["coverage items", {}],
    ["coverage 100% ✓", { cls: "fill-fig-emerald-text", weight: 600 }],
    ["regression PASS ✓", { cls: "fill-fig-emerald-text", weight: 600 }],
    ["what sign-off can see", { op: 0.8 }],
  ];
  planWords.forEach(([s, o], i) => L.push(text(G.planText[i][0], G.planText[i][1], s, o)));
  // What the plan never listed: dashed and empty.
  L.push(gapBox(`strokeWidth="2.5" strokeDasharray="5 4"`));
  L.push(cross(G.q1));
  ["the question the plan", "never asked: is every", "table entry correct?"].forEach((s, i) => L.push(text(G.q1.x, G.q1.ys[i], s)));
  L.push(cross(G.q2));
  ["what does cache", "timing reveal?"].forEach((s, i) => L.push(text(G.q2.x, G.q2.ys[i], s)));
  return [...svgOpen(P, sfx, G.W, G.H, f, wide), ...indent(L), `</svg>`];
}

const MAKE = {
  life: ["f1a-life-title", lifeSvg],
  shift: ["f1a-shift-title", shiftSvg],
  ladder: ["f1a-ladder-title", ladderSvg],
  coverage: ["f1a-signoff-title", coverageSvg],
};
const only = (process.env.ONLY || "life,shift,ladder,coverage").split(",");
let cur = fs.readFileSync(`${WT}/${REL}`, "utf8");
for (const key of only) {
  const [id, make] = MAKE[key];
  if (!FIGURE(id).test(cur)) throw new Error(`cannot find ${id} in the worktree lesson`);
  const f = words(id);
  const block = figure(f, [...make(f, true), ...make(f, false)]);
  cur = cur.replace(FIGURE(id), () => block);
}
// Written to a candidate first (OUT), checked there, then moved into place in one rename (apply4.sh), so the dev
// server never reads a half-written or broken lesson.
const out = process.env.OUT;
if (!out) throw new Error("set OUT to the candidate path; apply4.sh checks it and moves it into place");
fs.writeFileSync(out, cur);
console.log("candidate written", only.join(", "));
