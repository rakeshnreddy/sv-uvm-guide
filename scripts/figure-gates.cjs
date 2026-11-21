#!/usr/bin/env node
"use strict";

// Run at the repository root. Capture a baseline BEFORE editing a lesson:
// node scripts/figure-gates.cjs content/curriculum/.../index.mdx --base HEAD --capture-base
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");
const {
  inspectSource,
  compareWords,
  loadEmbeds,
  literalColours,
} = require("./figure-gates/source.cjs");
const { inspectBrowser } = require("./figure-gates/browser.cjs");
const { allWidths, auditGates, auditResults, requireServer, selectVisuals } =
  require("./figure-gates/audit.cjs");
const { git, files, repoAt, run } = require("./figure-gates/repository.cjs");
const { releaseStatus, releasedFindings, releasedRoutes, writeReleasedBaseline } = require("./figure-gates/released.cjs");

const plan = "docs/planning/site-design-refresh-2026-11-10";
const fixedTests = [
  "tests/app/theme-contrast.test.ts",
  "tests/components/DiagramKit.test.tsx",
  "tests/lib/diagram-layout.test.ts",
  "tests/components/lazy-mdx-heights.test.ts",
  "tests/scripts/figure-gates.test.ts",
];
// Reports are committed to a public repository: never store this machine's folders in them.
const portable = (text) => text
  .split(process.execPath).join("node")
  .split(process.cwd()).join("<repo>")
  .split(os.homedir()).join("<home>");
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, portable(JSON.stringify(value, null, 2)) + "\n");
  fs.renameSync(tmp, file);
}
const result = (pass, summary, details) => ({
  status: pass ? "PASS" : "FAIL",
  summary,
  details,
});
async function testWithRetry(tests) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figure-g9-"));
  const json = path.join(dir, "vitest.json");
  const args = ["--no-install", "vitest", "--run"];
  const env = { NODE_OPTIONS: "--require @prisma/client" };
  try {
    const initial = await run("npx", [...args, "--maxWorkers", "2", "--reporter=default", "--reporter=json", "--outputFile.json", json, ...tests], env);
    if (initial.status === 0 || !fs.existsSync(json)) return initial;
    const report = JSON.parse(fs.readFileSync(json, "utf8"));
    const failed = report.testResults.filter(file => file.status === "failed")
      .map(file => path.relative(process.cwd(), file.name));
    if (!failed.length || failed.some(file => !tests.includes(file))) return initial;
    const retries = [];
    for (const file of failed) retries.push(await run("npx", [...args, "--maxWorkers", "1", file], env));
    return { ...initial, status: retries.every(retry => retry.status === 0) ? 0 : initial.status,
      retried: retries.length, retries };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
async function checks(lesson, changed, names, taskFiles) {
  const terms = [
    ...names,
    ...changed.map((f) => path.basename(f, path.extname(f))),
    path.basename(path.dirname(lesson)),
    path.basename(path.dirname(lesson)).split("_")[0],
    path.basename(lesson, ".mdx"),
  ].filter((x) => x !== "index");
  const tests = [
    ...new Set([
      ...fixedTests,
      ...files("tests").filter((f) => {
        if (!/\.(spec|test)\.tsx?$/.test(f) || f.startsWith("tests/e2e/"))
          return false;
        const source = fs.readFileSync(f, "utf8");
        return terms.some((t) => source.includes(t));
      }),
    ]),
  ].sort();
  const targets = [
    ...new Set([
      ...changed,
      lesson,
      ...taskFiles,
      "scripts/figure-gates.cjs",
      ...files("scripts/figure-gates"),
      fixedTests.at(-1),
    ]),
  ].filter((f) => fs.existsSync(f) && /\.(?:[cm]?js|tsx?|jsx|mdx)$/.test(f));
  const mdxTargets = targets.filter((f) => f.endsWith(".mdx"));
  const codeTargets = targets.filter((f) => !f.endsWith(".mdx"));
  const registry = fs
    .readFileSync("src/generated/mdx-component-registry.tsx", "utf8")
    .split("export const mdxComponents = {")[1]
    .split("\n};")[0];
  const mdxGlobals = [...registry.matchAll(/^  ([A-Z]\w*)[:,]/gm)]
    .map((m) => m[1])
    .concat([...loadEmbeds().keys()]);
  // These JSX identifiers are provided by the lesson renderer, not imported
  // by an MDX author. Keep jsx-no-undef enabled for all unregistered names.
  const logs = await Promise.all([
    run("npx", ["--no-install", "tsc", "--noEmit"]),
    testWithRetry(tests),
    run("npx", [
      "--no-install",
      "eslint",
      "--max-warnings",
      "0",
      ...codeTargets,
    ]),
    run("npx", [
      "--no-install",
      "eslint",
      "--max-warnings",
      "0",
      "--global",
      mdxGlobals.join(","),
      "--rule",
      "react/jsx-no-undef: [error, {allowGlobals: true}]",
      ...mdxTargets,
    ]),
  ]);
  return result(
    logs.every((l) => l.status === 0),
    (logs[1].status === 0 && logs[1].retried ? `PASS (${logs[1].retried} ${logs[1].retried === 1 ? "file" : "files"} retried serially); ` : "") +
      `tsc ${logs[0].status}, Vitest ${logs[1].status} (${tests.length} files), ESLint ${logs[2].status}/${logs[3].status} (${targets.length} files)`,
    logs,
  );
}
async function heights(names, url, art) {
  if (!names.length)
    return result(true, "0 changed interactives, 0 affected embeds", []);
  const pattern = new RegExp("<(?:" + names.join("|") + ")(?=[\\s/>])");
  const lessons = files("content/curriculum").filter(
    (f) => f.endsWith(".mdx") && pattern.test(fs.readFileSync(f, "utf8")),
  );
  const routes = lessons.map((f) => f.slice("content/curriculum/".length, -4));
  const out = path.join(art, "heights-" + process.pid + ".json");
  fs.mkdirSync(art, { recursive: true });
  const cmd = await run(process.execPath, [
    "scripts/measure-lazy-interactive-heights.cjs",
    "--lessons",
    routes.join(","),
    "--bands",
    "desktop,mid,phone",
    "--base",
    url,
    "--out",
    out,
    "--scroll-step",
    "900",
    "--scroll-interval",
    "16",
  ]);
  if (!fs.existsSync(out)) return result(false, "No height measurements", cmd);
  const data = JSON.parse(fs.readFileSync(out, "utf8"));
  const bad = data.instances.filter(
    (v) =>
      !Number.isFinite(v.delta) ||
      v.state !== "rendered" ||
      Math.abs(v.delta) > 4,
  );
  const missing = routes.flatMap((lesson) =>
    ["desktop", "mid", "phone"]
      .filter(
        (b) => !data.instances.some((v) => v.lesson === lesson && v.band === b),
      )
      .map((b) => lesson + " " + b),
  );
  return result(
    cmd.status === 0 &&
      !missing.length &&
      !data.failedPages.length &&
      !bad.length,
    `${data.instances.length} embeds across ${data.pages} pages, ${bad.length} outside ±4 px, ${data.failedPages.length + missing.length} missing/failed`,
    {
      routes,
      missing,
      bad,
      failedPages: data.failedPages,
      maximum: Math.max(0, ...data.instances.map((v) => Math.abs(v.delta))),
    },
  );
}
function changedLines(base, file) {
  if (!git("ls-tree", base, "--", file).trim()) return () => true;
  const ranges = [
    ...git("diff", "--no-ext-diff", "--unified=0", base, "--", file).matchAll(
      /^@@ .*? \+(\d+)(?:,(\d+))? @@/gm,
    ),
  ].map(([, start, length]) => [Number(start), Number(length ?? 1)]);
  return (line) =>
    ranges.some(([start, length]) => line >= start && line < start + length);
}

function samples(matrix, acknowledge, kitNotes, isolated = false) {
  const perFigure = [];
  const text = [],
    marks = [],
    small = [],
    unmeasured = [],
    perView = [];
  for (const v of matrix) {
    let count = 0;
    if (v.measurementError)
      unmeasured.push({
        width: v.width,
        theme: v.theme,
        error: v.measurementError,
      });
    for (const r of v.pixels) {
      const minimum = (items) =>
        items
          .filter((item) => item.ratio != null && !item.kit)
          .reduce(
            (min, item) => (!min || item.ratio < min.ratio ? item : min),
            null,
          );
      if (!r.kit)
        perFigure.push({
          figure: r.name,
          width: v.width,
          theme: v.theme,
          text: minimum(
            r.texts.filter((item) => /[\p{L}\p{N}]/u.test(item.label)),
          ),
          mark: minimum([
            ...r.marks,
            ...r.texts.filter((item) => !/[\p{L}\p{N}]/u.test(item.label)),
          ]),
        });
      for (const [kind, items] of [
        ["text", r.texts],
        ["mark", r.marks],
      ])
        for (const item of items) {
          const e = { width: v.width, theme: v.theme, figure: r.name, line: r.line, ...item };
          const kit = r.kit || item.kit;
          const glyph = kind === "text" && !/[\p{L}\p{N}]/u.test(item.label);
          const floor = kind === "mark" || glyph ? 3 : 4.5;
          if (kit) {
            if (item.ratio == null || item.ratio < floor)
              kitNotes.push({
                gate: "G5",
                ...e,
                line: r.line,
                value: item.ratio,
              });
            if (kind === "text" && !glyph && v.width === 390 && item.size < 11)
              kitNotes.push({
                gate: "G6",
                ...e,
                line: r.line,
                value: item.size,
              });
            count++;
            continue;
          }
          (kind === "text" && !glyph ? text : marks).push(e);
          if (item.ratio == null) unmeasured.push(e);
          if (
            kind === "text" &&
            v.width === 390 &&
            !glyph &&
            item.size < 11 &&
            !acknowledge("G6", e, item.size)
          )
            small.push(e);
          count++;
        }
    }
    perView.push({ width: v.width, theme: v.theme, samples: count });
  }
  const bad = [
    ...text.filter((e) => e.ratio != null && e.ratio < 4.5),
    ...marks.filter((e) => e.ratio != null && e.ratio < 3),
  ].filter((e) => !acknowledge("G5", e, e.ratio));
  const floor = (entries) =>
    entries.some((e) => e.ratio != null)
      ? Math.min(
          ...entries.filter((e) => e.ratio != null).map((e) => e.ratio),
        ).toFixed(2)
      : "unmeasured";
  const complete =
    matrix.length === 4 &&
    matrix.every((v) => !v.measurementError) &&
    (isolated || perView.every((v) => v.samples > 0));
  return {
    G5: result(
      complete && !bad.length && !unmeasured.length,
      `${text.length} texts (min ${floor(text)}:1), ${marks.length} marks (min ${floor(marks)}:1), ${bad.length} below floor, ${unmeasured.length} unmeasured`,
      { perView, perFigure, bad, unmeasured },
    ),
    G6: result(
      complete && !small.length,
      `${small.length} phone text samples under 11 px` +
        (small.length
          ? `; smallest ${Math.min(...small.map((e) => e.size)).toFixed(2)} px (${small.reduce((a, b) => (a.size < b.size ? a : b)).figure})`
          : ""),
      small,
    ),
  };
}
async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string" },
      url: { type: "string", default: "http://localhost:3000" },
      skip: { type: "string" },
      only: { type: "string" },
      "capture-base": { type: "boolean" },
      "write-released-baseline": { type: "boolean" },
    },
  });
  const lesson = path.relative(
    process.cwd(),
    path.resolve(positionals[0] || ""),
  );
  if (
    positionals.length !== 1 ||
    !v.base ||
    !/^content\/curriculum\/.+\.mdx$/.test(lesson)
  )
    throw Error(
      "Usage: node scripts/figure-gates.cjs <lesson.mdx> --base <ref> [--url URL] [--capture-base] [--skip G3] [--only <visual[@line]>] [--write-released-baseline]",
    );
  const route = lesson.slice("content/curriculum/".length, -4);
  const slug = route
    .split("/")
    .slice(1)
    .filter((s) => s !== "index")
    .join("--");
  const base = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    v.base + "^{commit}",
  ).trim();
  if (
    v.skip &&
    !(
      v.skip === "G3" &&
      route === "T1_Foundational/F1A_The_Cost_of_Bugs/index" &&
      base === git("rev-parse", "cb80965f").trim()
    )
  )
    throw Error(
      "--skip G3 applies only to the documented historical F1A comparison",
    );
  const capture = !!v["capture-base"],
    url = new URL(v.url).origin;
  if (capture && v.only) throw Error("--capture-base captures the whole lesson");
  const reports = path.join(plan, "reports"),
    art = path.join("test-results/design-previews/codex", slug);
  const released = releasedRoutes.has(route);
  const f1aReference = route === "T1_Foundational/F1A_The_Cost_of_Bugs/index";
  const releaseFile = path.join(reports, slug + ".released-baseline.json");
  const recordRelease = !!v["write-released-baseline"];
  if (recordRelease && (!released || v.only || capture))
    throw Error("--write-released-baseline requires a full run on one of the five frozen lessons");
  if (recordRelease && fs.existsSync(releaseFile))
    throw Error("Released baseline already exists: " + releaseFile);
  await requireServer(url);
  const baseline = path.join(
    reports,
    slug + "." + base.slice(0, 12) + ".base.json",
  );
  const loaders = loadEmbeds();
  const current = await inspectSource(fs.readFileSync(lesson, "utf8"), loaders);
  const original = await inspectSource(
    git("show", base + ":" + lesson),
    loaders,
  );
  const indexes = selectVisuals(current.visuals, v.only);
  const selected = new Set(indexes);
  const scopedVisuals = current.visuals.filter((_, index) => selected.has(index));
  const scopedBefore = original.visuals.filter((_, index) => selected.has(index));
  const relevant = (source) => new Set(source.visuals.flatMap((item, index) =>
    item.kind === "interactive" ? [index] : []));
  const activeEmbeds = [...relevant(current)].flatMap((sourceIndex, embedIndex) =>
    selected.has(sourceIndex) ? [embedIndex] : []);
  const names = [
    ...new Set(
      [...scopedBefore, ...scopedVisuals]
        .filter((i) => i.kind === "interactive")
        .map((i) => i.tag),
    ),
  ];
  const changed = new Set(
    [
      ...git("diff", "--name-only", "--no-renames", base, "--", "src")
        .trim()
        .split("\n"),
      ...git("ls-files", "--others", "--exclude-standard", "src")
        .trim()
        .split("\n"),
    ].filter(Boolean),
  );
  const oldRepo = repoAt(base),
    newRepo = repoAt(null),
    related = new Set(),
    models = new Set(),
    impacted = [];
  for (const name of names) {
    const entry = loaders.get(name);
    const dependencies = new Set([
      ...oldRepo.dependencies(entry),
      ...newRepo.dependencies(entry),
    ]);
    if (!dependencies.size) throw Error("Unresolved interactive " + name);
    let dirty = false;
    for (const f of dependencies) {
      if (f.startsWith("src/lib/")) models.add(f);
      if (changed.has(f)) {
        related.add(f);
        dirty = true;
      }
    }
    if (dirty) impacted.push(name);
  }
  const taskFiles = [
    ...git("diff", "--name-only", "HEAD").split("\n"),
    ...git("ls-files", "--others", "--exclude-standard").split("\n"),
  ];
  if (capture) {
    if (
      related.size ||
      fs.readFileSync(lesson, "utf8") !== git("show", base + ":" + lesson)
    )
      throw Error(
        "Base capture requires the lesson and its dependencies at " + base,
      );
    const views = await inspectBrowser({
      visuals: current.visuals,
      route,
      url,
      capture,
      images: path.join(art, "before"),
    });
    const texts = Object.fromEntries(
      views.map((view) => [view.theme, view.texts]),
    );
    if (
      views.some(
        (view) =>
          view.texts.length !==
            current.visuals.filter((i) => i.kind === "interactive").length ||
          view.texts.some((t) => !t.text),
      )
    )
      throw Error("Base capture missing interactive instance or default text");
    const evidence = {
      base,
      lesson,
      texts,
      figures: Object.fromEntries(
        views.map((s) => [
          s.theme,
          { initial: s.defaultWords, revealed: s.revealedWords },
        ]),
      ),
      artwork: Object.fromEntries(views.map(view => [view.theme, view.artwork])),
    };
    if (fs.existsSync(baseline)) {
      const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
      const { artwork: priorArt, ...priorWords } = prior;
      const { artwork: newArt, ...newWords } = evidence;
      const images = (artwork) => Object.fromEntries(Object.entries(artwork).map(([theme, rows]) =>
        [theme, Object.fromEntries(Object.entries(rows).map(([index, { kitOnly, parts }]) =>
          [index, { kitOnly, parts }]))]));
      if (JSON.stringify(priorWords) !== JSON.stringify(newWords) ||
        (priorArt && JSON.stringify(images(priorArt)) !== JSON.stringify(images(newArt))))
        throw Error("Existing base capture differs. Investigate before replacing it.");
    }
    write(baseline, evidence);
    console.log(
      `CAPTURED ${views[0].texts.length} default states in both themes at ${base}; ${baseline}; crops in ${art}/before`,
    );
    return;
  }
  const G = {};
  const known = [],
    kitNotes = [],
    decisions = [],
    existingPalette = [];
  const exceptions = require("./figure-gates.exceptions.json");
  function acknowledge(gate, finding, value) {
    const entry = exceptions.find(
      (e) =>
        e.gate === gate &&
        e.lesson === slug &&
        e.base === base &&
        e.element === (finding.label ?? finding.token) &&
        e.figure === finding.figure &&
        e.file === finding.file &&
        (e.line === finding.line || (e.line == null && (gate === "G5" || gate === "G6"))) &&
        e.width === finding.width &&
        e.theme === finding.theme &&
        (typeof value === "number"
          ? Math.abs(e.value - value) < 0.025
          : e.value === value),
    );
    if (entry) known.push({ ...entry, measured: value });
    return Boolean(entry);
  }
  const words = v.only
    ? compareWords(
      await inspectSource(scopedBefore[0]?.raw || "", loaders),
      await inspectSource(scopedVisuals[0].raw, loaders),
    )
    : compareWords(original, current);
  G.G2 = result(
    !words.length,
    `${scopedVisuals.length} source instances, ${words.length} differences`,
    words,
  );
  const literal = [];
  for (const i of scopedVisuals)
    for (const m of literalColours(i.raw)) {
      const finding = { file: lesson, ...m, line: i.line + m.line - 1 };
      if (i.kind === "kit")
        kitNotes.push({ ...finding, gate: "G7", value: m.token });
      else literal.push(finding);
    }
  const components = [...related].filter(
    (f) => f.startsWith("src/components/") && fs.existsSync(f),
  );
  for (const file of components) {
    const changed = changedLines(base, file);
    const shared = /^src\/components\/(visual-system\/|mdx\/DiagramKit\.)/.test(
      file,
    );
    for (const m of literalColours(fs.readFileSync(file, "utf8"))) {
      const finding = { file, ...m };
      if (shared) kitNotes.push({ ...finding, gate: "G7", value: m.token });
      else if (!changed(m.line)) existingPalette.push(finding);
      else if (!acknowledge("G7", finding, m.token)) literal.push(finding);
    }
  }
  G.G7 = result(
    !literal.length,
    `${literal.length} new literal paints in lesson visuals and ${components.length} changed component files`,
    literal,
  );
  const jobs = {
    G4: async () => {
      const log = await run(process.execPath, [
        "scripts/check-mdx.mjs",
        "--render",
        lesson,
      ]);
      return result(
        log.status === 0,
        `render exit ${log.status}; ${
          log.output
            .split("\n")
            .filter((l) => /errors?/i.test(l))
            .at(-1) || "see render log"
        }`,
        log,
      );
    },
    G8: () => heights(impacted, url, art),
    G9: () => checks(lesson, components, impacted, taskFiles),
  };
  const commands = Promise.all(
    (v.only ? [] : Object.entries(jobs)).map(async ([id, job]) => {
      try {
        G[id] = await job();
      } catch (e) {
        G[id] = result(false, e.message, []);
      }
    }),
  );
  let incomplete = false;
  const saved = fs.existsSync(baseline)
    ? JSON.parse(fs.readFileSync(baseline, "utf8"))
    : null;
  // A shared-component retest can use its current word/model base while the
  // release's redesign is still compared with its original artwork.
  const releasedBase = released && fs.existsSync(releaseFile)
    ? JSON.parse(fs.readFileSync(releaseFile, "utf8")).base : base;
  const releasedArt = path.join(reports, slug + "." + releasedBase.slice(0, 12) + ".base.json");
  const designBase = releasedBase !== base && fs.existsSync(releasedArt)
    ? JSON.parse(fs.readFileSync(releasedArt, "utf8")) : saved;
  const reportText = path.join(reports, slug + ".md");
  const crops = new Map();
  try {
    const matrix = await inspectBrowser({
      visuals: current.visuals,
      route,
      url,
      capture: false,
      indexes,
      skipPixels: f1aReference,
      reviewImages: recordRelease ? path.join("test-results/design-previews/codex/released", slug) : undefined,
      decisionImages: path.join(art, "review-decisions"),
    });
    incomplete = matrix.some(view => view.measurementError);
    const inventory = matrix.map(({ width, theme, rows }) => ({
      width,
      theme,
      rows,
    }));
    for (const view of matrix)
      for (const [index, row] of view.rows.entries()) {
        if (!selected.has(index)) continue;
        if (row.kitColours?.length)
          kitNotes.push({
            gate: "G7",
            figure: row.name,
            line: row.line,
            width: view.width,
            theme: view.theme,
            value: row.kitColours.join(", "),
          });
      }
    const old = [
      ...new Set(
        matrix.flatMap((s) =>
          s.rows
            .filter((r) => r.look === "old")
            .map((r) => r.name + " @" + (r.line || "DOM")),
        ),
      ),
    ];
    G.G1 = result(
      !old.length && matrix.length === allWidths.length * 2,
      `${current.visuals.length} source instances, ${matrix[0].rows.length} rendered; ${old.length} old` +
        (old.length ? " — " + old.join(", ") : ""),
      inventory,
    );
    if (!v.skip) {
      const mismatches = [];
      if (!saved || saved.lesson !== lesson || saved.base !== base)
        mismatches.push("Missing matching --capture-base");
      else
        for (const view of matrix.filter((s) => s.width === 1440))
          if (
            JSON.stringify(saved.texts[view.theme]) !==
            JSON.stringify(view.texts)
          ) {
            mismatches.push(
              ...view.texts
                .map((t, i) =>
                  JSON.stringify(t) ===
                  JSON.stringify(saved.texts[view.theme]?.[i])
                    ? null
                    : `${view.theme} ${t.name} #${i + 1}`,
                )
                .filter(Boolean),
            );
            if (view.texts.length !== saved.texts[view.theme]?.length)
              mismatches.push("Embed count changed");
          }
      if (saved?.base === base && saved.lesson === lesson) {
        for (const view of matrix.filter((s) => s.width === 1440)) {
          for (const [state, current] of [
            ["initial", view.defaultWords],
            ["revealed", view.revealedWords],
          ]) {
            const before = saved.figures?.[view.theme]?.[state] || [];
            const compare = v.only ? activeEmbeds :
              Array.from({ length: Math.max(current.length, before.length) }, (_, index) => index);
            for (const i of compare) {
              if (JSON.stringify(current[i]) !== JSON.stringify(before[i]))
                words.push(
                  `${view.theme} ${state}: interactive ${current[i]?.name ?? before[i]?.name} #${i + 1} figure text or aria changed`,
                );
            }
          }
        }
        G.G2 = result(
          !words.length,
          `${scopedVisuals.length} source instances, default and revealed interactive figure strings, ${words.length} differences`,
          words,
        );
      }
      const changedModels = [...models].filter((f) => changed.has(f));
      G.G3 = result(
        !changedModels.length && !mismatches.length,
        `${models.size} model/data dependencies, ${changedModels.length} changed; ${mismatches.length} capture discrepancies`,
        { changedModels, mismatches },
      );
    }
    Object.assign(G, samples(matrix.filter(view => [1440, 390].includes(view.width)), acknowledge, kitNotes, !!v.only));
    Object.assign(G, auditResults(matrix, designBase, fs.existsSync(reportText) ? fs.readFileSync(reportText, "utf8") : "", kitNotes,
      { released, skipPixels: f1aReference, decisions }));
    for (const view of matrix) {
      for (const [index, row] of view.rows.entries()) {
        const images = [view.reviewCrops.default[index], view.reviewCrops.revealed[index]].filter(Boolean);
        if (images.length) crops.set(JSON.stringify([row.line, view.width, view.theme]), images);
      }
    }
    if (incomplete) {
      const errors = matrix.filter(view => view.measurementError)
        .map(({ width, theme, measurementError }) => ({ width, theme, measurementError }));
      for (const id of auditGates)
        if (G[id].status === "PASS")
          G[id] = result(false, "Browser measurement incomplete: " + errors[0].measurementError, errors);
    }
    const issues = matrix.flatMap((s) =>
      [
        ...s.errors,
        ...(s.overflow > 0
          ? ["Horizontal overflow " + s.overflow + " px"]
          : []),
      ].map((error) => ({ width: s.width, theme: s.theme, error })),
    );
    G.G10 = result(
      !issues.length,
      `${matrix.length} theme/width pairs, ${issues.length} page errors or overflows`,
      issues,
    );
  } catch (e) {
    incomplete = true;
    for (const id of ["G1", "G3", "G5", "G6", "G10", ...auditGates])
      G[id] ??= result(
        false,
        "Browser measurement incomplete: " + e.message.split("\n")[0],
        e.stack,
      );
  }
  if (v.skip)
    G.G3 = {
      status: "SKIPPED",
      summary:
        "Historical F1A interactive base capture unavailable (--skip G3)",
      details: [],
    };
  await commands;
  const required = v.only
    ? ["G2", "G5", "G6", "G7", ...auditGates]
    : Array.from({ length: 17 }, (_, i) => "G" + (i + 1));
  const gates = Object.fromEntries(
    required.map(id => [id, G[id]]),
  );
  const findings = released ? releasedFindings(gates, crops) : [];
  if (recordRelease && writeReleasedBaseline(releaseFile, {
    lesson, base, head: git("rev-parse", "HEAD").trim(), gates, findings, decisions, kitNotes, incomplete,
  })) {
    console.log("Recorded released baseline: " + releaseFile);
  }
  const release = released && fs.existsSync(releaseFile) && !incomplete
    ? releaseStatus(gates, findings, JSON.parse(fs.readFileSync(releaseFile, "utf8")).findings,
      v.only ? `${scopedVisuals[0].name}@${scopedVisuals[0].line}` : undefined)
    : null;
  for (const finding of release?.newFindings || [])
    console.log(`NEW ${finding.gate} ${finding.visual} ${finding.theme} ${finding.width} ${finding.label}: ${finding.value}`);
  for (const finding of release?.cleared || [])
    console.log(`cleared ${finding.gate} ${finding.visual} ${finding.theme} ${finding.width} ${finding.label}`);
  for (const finding of decisions)
    console.log(`REVIEW G14 ${finding.figure} @${finding.line} ${finding.theme} ${finding.width}: ${finding.reason}${finding.crop ? " — " + finding.crop : ""}`);
  for (const {
    gate,
    figure,
    file,
    line,
    width,
    theme,
    element,
    measured,
  } of known)
    console.log(
      `KNOWN ${gate} ${figure ?? file} ${line ?? ""} ${theme ?? ""} ${width ?? ""} ${element}: ${measured} (reviewer)`,
    );
  for (const note of kitNotes)
    console.log(
      `KIT NOTE ${note.gate} ${note.figure ?? note.file} @${note.line ?? "DOM"} ${note.theme ?? ""} ${note.width ?? ""} ${note.label ?? ""}: ${note.value ?? "unmeasured"}`,
    );
  if (existingPalette.length)
    console.log(
      `NOTE G7 existing palette classes: ${existingPalette.length} on untouched lines (see JSON)`,
    );
  if (f1aReference && gates.G14?.status === "FAIL")
    console.log("SKIPPED G14 pixels — F1A is the approved reference without a before capture");
  for (const [id, g] of Object.entries(gates))
    console.log(g.status + " " + id + " " + g.summary);
  const failed = Object.values(gates).filter((g) => g.status === "FAIL").length;
  const summary = failed
    ? `FAIL — ${failed} of ${required.length} gates failed`
    : release ? `PASS (${release.retained} baseline, 0 new)` : "PASS — every required gate passed";
  const qualifier = v.only ? ".only-" + (indexes[0] + 1) : "";
  const report = path.join(recordRelease ? path.join("test-results/design-previews/codex/released", slug) : v.only ? art : reports,
    slug + qualifier + (failed || incomplete ? ".partial" : "") + ".json");
  write(report, {
    lesson,
    base,
    head: git("rev-parse", "HEAD").trim(),
    ...(v.only ? { only: v.only } : {}),
    incomplete,
    gates,
    ...(release ? { release } : {}),
    decisions,
    known,
    kitNotes,
    existingPalette,
    summary,
  });
  console.log(summary + "; " + report);
  process.exitCode = incomplete ? 2 : failed ? 1 : 0;
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 2;
});
