#!/usr/bin/env node
"use strict";

// Run at the repository root. Capture a baseline BEFORE editing a lesson:
// node scripts/figure-gates.cjs content/curriculum/.../index.mdx --base HEAD --capture-base
const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const {
  inspectSource,
  compareWords,
  loadEmbeds,
  literalColours,
} = require("./figure-gates/source.cjs");
const { inspectBrowser } = require("./figure-gates/browser.cjs");
const { git, files, repoAt, run } = require("./figure-gates/repository.cjs");

const plan = "docs/planning/site-design-refresh-2026-11-10";
const fixedTests = [
  "tests/app/theme-contrast.test.ts",
  "tests/components/DiagramKit.test.tsx",
  "tests/lib/diagram-layout.test.ts",
  "tests/components/lazy-mdx-heights.test.ts",
  "tests/scripts/figure-gates.test.ts",
];
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
const result = (pass, summary, details) => ({
  status: pass ? "PASS" : "FAIL",
  summary,
  details,
});
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
    run("npx", ["--no-install", "vitest", "--run", ...tests]),
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
function samples(matrix) {
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
      for (const [kind, items] of [
        ["text", r.texts],
        ["mark", r.marks],
      ])
        for (const item of items) {
          const e = { width: v.width, theme: v.theme, figure: r.name, ...item };
          (kind === "text" ? text : marks).push(e);
          if (item.ratio == null) unmeasured.push(e);
          if (kind === "text" && v.width === 390 && !r.kit && item.size < 11)
            small.push(e);
          count++;
        }
    }
    perView.push({ width: v.width, theme: v.theme, samples: count });
  }
  const bad = [
    ...text.filter((e) => e.ratio != null && e.ratio < 4.5),
    ...marks.filter((e) => e.ratio != null && e.ratio < 3),
  ];
  const floor = (entries) =>
    entries.some((e) => e.ratio != null)
      ? Math.min(
          ...entries.filter((e) => e.ratio != null).map((e) => e.ratio),
        ).toFixed(2)
      : "unmeasured";
  const complete =
    matrix.length === 4 &&
    matrix.every((v) => !v.measurementError) &&
    perView.every((v) => v.samples > 0);
  return {
    G5: result(
      complete && !bad.length && !unmeasured.length,
      `${text.length} texts (min ${floor(text)}:1), ${marks.length} marks (min ${floor(marks)}:1), ${bad.length} below floor, ${unmeasured.length} unmeasured`,
      { perView, bad, unmeasured },
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
      "capture-base": { type: "boolean" },
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
      "Usage: node scripts/figure-gates.cjs <lesson.mdx> --base <ref> [--url URL] [--capture-base] [--skip G3]",
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
  const reports = path.join(plan, "reports"),
    art = path.join("test-results/design-previews/codex", slug);
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
  const names = [
    ...new Set(
      [...original.visuals, ...current.visuals]
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
    };
    if (
      fs.existsSync(baseline) &&
      fs.readFileSync(baseline, "utf8") !==
        JSON.stringify(evidence, null, 2) + "\n"
    )
      throw Error(
        "Existing base capture differs. Investigate before replacing it.",
      );
    write(baseline, evidence);
    console.log(
      `CAPTURED ${views[0].texts.length} default states in both themes at ${base}; ${baseline}; crops in ${art}/before`,
    );
    return;
  }
  const G = {};
  const words = compareWords(original, current);
  G.G2 = result(
    !words.length,
    `${current.visuals.length} source instances, ${words.length} differences`,
    words,
  );
  const literal = [];
  for (const i of current.visuals)
    for (const m of literalColours(i.raw))
      literal.push({ file: lesson, ...m, line: i.line + m.line - 1 });
  const components = [...related].filter(
    (f) => f.startsWith("src/components/") && fs.existsSync(f),
  );
  for (const file of components)
    for (const m of literalColours(fs.readFileSync(file, "utf8")))
      literal.push({ file, ...m });
  G.G7 = result(
    !literal.length,
    `${literal.length} literal paints in lesson visuals and ${components.length} changed component files`,
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
    Object.entries(jobs).map(async ([id, job]) => {
      try {
        G[id] = await job();
      } catch (e) {
        G[id] = result(false, e.message, []);
      }
    }),
  );
  try {
    const matrix = await inspectBrowser({
      visuals: current.visuals,
      route,
      url,
      capture: false,
    });
    const inventory = matrix.map(({ width, theme, rows }) => ({
      width,
      theme,
      rows,
    }));
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
      !old.length && matrix.length === 4,
      `${current.visuals.length} source instances, ${matrix[0].rows.length} rendered; ${old.length} old` +
        (old.length ? " — " + old.join(", ") : ""),
      inventory,
    );
    if (!v.skip) {
      const saved = fs.existsSync(baseline)
        ? JSON.parse(fs.readFileSync(baseline, "utf8"))
        : null;
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
            for (let i = 0; i < Math.max(current.length, before.length); i++) {
              if (JSON.stringify(current[i]) !== JSON.stringify(before[i]))
                words.push(
                  `${view.theme} ${state}: interactive ${current[i]?.name ?? before[i]?.name} #${i + 1} figure text or aria changed`,
                );
            }
          }
        }
        G.G2 = result(
          !words.length,
          `${current.visuals.length} source instances, default and revealed interactive figure strings, ${words.length} differences`,
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
    Object.assign(G, samples(matrix));
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
    for (const id of ["G1", "G3", "G5", "G6", "G10"])
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
  const gates = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => ["G" + (i + 1), G["G" + (i + 1)]]),
  );
  for (const [id, g] of Object.entries(gates))
    console.log(g.status + " " + id + " " + g.summary);
  const failed = Object.values(gates).filter((g) => g.status === "FAIL").length;
  const summary = failed
    ? `FAIL — ${failed} of 10 gates failed`
    : "PASS — every required gate passed";
  const report = path.join(reports, slug + ".json");
  write(report, {
    lesson,
    base,
    head: git("rev-parse", "HEAD").trim(),
    gates,
    summary,
  });
  console.log(summary + "; " + report);
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 2;
});
