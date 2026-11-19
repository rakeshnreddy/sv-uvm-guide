// Proof that the words of the eight hand-drawn figures of F1A are unchanged. Compares the lesson at cb80965f
// (base-index.mdx, the live commit) with the worktree. (texts3.cjs covered the first four; this adds the lifecycle,
// shift left, the career ladder and coverage of an incomplete plan.)
//   Figures in a <figure> (journey strip, mask stacks, four decisions, lifecycle, shift left, career ladder, coverage):
//   each composition (column and phone) must carry exactly the strings of the original drawing, in the original order;
//   <title>, <desc> and <figcaption> must be identical; the only visible text outside the drawings is the figure's own
//   title (the strip) and, for the mask figure, its three key entries, which moved from the drawing into the legend strip.
//   The recap strip (inside <VisualRecap>, one composition, no panel of its own): the strings of the original drawing in
//   the original order; <title>, <desc>, the svg's role and aria attributes and every prop of <VisualRecap> identical;
//   no visible text outside the drawing.
// The rest of the lesson must be byte-identical once the kit's focus key is removed.
const fs = require("fs");
const path = require("path");
const WT = "<repo>";
const REL = "content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx";
const before = fs.readFileSync(path.join(__dirname, "base-index.mdx"), "utf8");
const after = fs.readFileSync(`${WT}/${REL}`, "utf8");
const figure = (src, id) => new RegExp(`<figure>(?:(?!</figure>)[\\s\\S])*?${id}[\\s\\S]*?</figure>`).exec(src)[0];
const recapBlock = (src) => /<VisualRecap\b[\s\S]*?<\/VisualRecap>/.exec(src)[0];
const texts = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => JSON.parse(/^\{(".*")\}$/s.exec(m[1].trim())[1]));
const one = (block, tag) => [...block.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1].trim());
const attr = (open, name) => new RegExp(`${name}="([^"]*)"`).exec(open)?.[1];
const KEY = { "f1a-respin-title": ["new mask", "reused (held wafer)", "no mask yet"] };
const FIGURES = ["f1a-journey-title", "f1a-respin-title", "f1a-decisions-title", "f1a-life-title", "f1a-shift-title", "f1a-ladder-title", "f1a-signoff-title"];
let ok = true;
const say = (good, line) => { ok = ok && good; console.log(`${good ? "ok  " : "FAIL"} ${line}`); };
for (const id of FIGURES) {
  const b = figure(before, id), a = figure(after, id);
  const want = texts(b);
  const svgs = [...a.matchAll(/<svg\b[^>]*role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  const key = KEY[id] ?? [];
  const chips = [...a.matchAll(/<span className="fig-chip">[\s\S]*?<span>\{("[^"]*")\}<\/span><\/span>/g)].map((m) => JSON.parse(m[1]));
  say(svgs.length === 2, `${id}: two compositions (column and phone)`);
  svgs.forEach((svg, i) => {
    const got = [...texts(svg), ...chips];
    say(JSON.stringify(got) === JSON.stringify(want), `${id} composition ${i + 1}: ${got.length} strings, the original ${want.length} in the original order (key entries ${key.length ? "in the legend strip" : "none"})`);
    if (JSON.stringify(got) !== JSON.stringify(want)) console.log("   want", want, "\n   got ", got);
    const open = /<svg\b[^>]*>/.exec(svg)[0];
    const lab = attr(open, "aria-labelledby"), des = attr(open, "aria-describedby");
    say(new RegExp(`<title id="${lab}">`).test(svg) && new RegExp(`<desc id="${des}">`).test(svg) && /role="img"/.test(open), `${id} composition ${i + 1}: role img, named by its own <title> (${lab}) and described by its own <desc> (${des})`);
  });
  say(JSON.stringify(chips) === JSON.stringify(key), `${id}: legend strip entries ${JSON.stringify(chips)}`);
  for (const tag of ["title", "desc", "figcaption"]) {
    const bw = one(b, tag), aw = one(a, tag);
    say(aw.length >= 1 && aw.every((s) => s === bw[0]) && bw.length === 1, `${id}: <${tag}> identical to the original${aw.length > 1 ? ` (${aw.length} copies, one per composition)` : ""}`);
  }
  const strip = /<div className="fig-titlebar"[^>]*><span>([\s\S]*?)<\/span><\/div>/.exec(a)[1];
  say(strip === one(b, "title")[0], `${id}: the title strip shows the figure's own title and nothing else`);
  // Everything a reader can see outside <text>, <title>, <desc>, <figcaption>: the title strip and the key entries.
  const stripped = a.replace(/<(text|title|desc|figcaption)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  const loose = [...stripped.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  say(JSON.stringify(loose) === JSON.stringify([strip]), `${id}: no other visible text outside the drawings (${JSON.stringify(loose)})`);
  const ids = [...a.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  say(new Set(ids).size === ids.length, `${id}: ${ids.length} ids, all distinct`);
}
{
  const id = "f1a-recap-title";
  const b = recapBlock(before), a = recapBlock(after);
  const bs = /<svg\b[\s\S]*?<\/svg>/.exec(b)[0], as = /<svg\b[\s\S]*?<\/svg>/.exec(a)[0];
  say((a.match(/<svg\b/g) || []).length === 1, `${id}: one composition, as before`);
  const want = texts(bs), got = texts(as);
  say(JSON.stringify(got) === JSON.stringify(want), `${id}: ${got.length} strings, the original ${want.length} in the original order`);
  if (JSON.stringify(got) !== JSON.stringify(want)) console.log("   want", want, "\n   got ", got);
  for (const tag of ["title", "desc"]) say(JSON.stringify(one(as, tag)) === JSON.stringify(one(bs, tag)) && one(bs, tag).length === 1, `${id}: <${tag}> identical to the original`);
  const bo = /<svg\b[^>]*>/.exec(bs)[0], ao = /<svg\b[^>]*>/.exec(as)[0];
  for (const name of ["role", "aria-labelledby", "aria-describedby"]) say(attr(ao, name) === attr(bo, name), `${id}: svg ${name} unchanged (${attr(ao, name)})`);
  say(new RegExp(`<title id="${attr(ao, "aria-labelledby")}">`).test(as) && new RegExp(`<desc id="${attr(ao, "aria-describedby")}">`).test(as), `${id}: named by its own <title> and described by its own <desc>`);
  say(a.replace(as, "") === b.replace(bs, ""), `${id}: every prop of <VisualRecap> and everything else in it byte-identical`);
  const loose = [...as.replace(/<(text|title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, "").matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  say(loose.length === 0, `${id}: no visible text outside <text> (${JSON.stringify(loose)})`);
  const ids = [...as.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  say(new Set(ids).size === ids.length, `${id}: ${ids.length} ids, all distinct`);
}
const allIds = [...after.matchAll(/\bid="(f1a-[^"]+)"/g)].map((m) => m[1]);
say(new Set(allIds).size === allIds.length, `the lesson: ${allIds.length} f1a- ids, all distinct across figures`);
const cut = (src) => FIGURES.reduce((s, id) => s.replace(figure(s, id), `[[${id}]]`), src).replace(recapBlock(src), "[[recap]]");
say(cut(before) === cut(after).replace(/\n  focus="[\w.-]+"/g, ""), "the rest of the lesson is byte-identical once the kit's focus key is removed");
process.exit(ok ? 0 : 1);
