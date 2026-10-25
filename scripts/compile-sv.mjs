// Compiles the curriculum's SystemVerilog with Verilator (TRUST-1, spine §5.2):
// - every lesson code block tagged `// compile` (fenced systemverilog blocks and
//   InteractiveCode bodies), and
// - every lab compile unit listed in content/curriculum/labs/compile-units.json.
//
// Lesson units are built from the tags:
// - `// compile` alone is one self-contained unit. If Verilator reports a missing
//   package, module, interface or class, the unit borrows the nearest block of
//   the same lesson that defines it (a compile block if there is one, else a
//   snippet; for example "needs bus_pkg from Make It Work") and compiles again.
//   A unit with no module or program (only packages, classes or interfaces) gets
//   an empty top module, so Verilator has something to elaborate.
// - `// compile: <file>.sv|.svh ...` names one file of the lesson's bench. The
//   named files compile together; .svh files are only `include`d. A file name
//   seen again starts a new bench that keeps the other files and replaces that
//   one (for example a second, standalone tb_top.sv).
// - `// compile: add to <file>, ...` appends the block to that bench file, and
//   `// compile (add to <package>, ...)` compiles the nearest earlier block that
//   declares that package with this block inserted before its endpackage.
// - A bench that builds on another lesson's bench ("replaces I-UVM-3C's
//   version") names it under "inherit" in scripts/sv-compile.config.json and
//   takes the files it does not show from there.
//
// Failures listed under "known" in scripts/sv-compile.config.json, each with a
// kind and a reason, are reported but do not fail the run; a listed unit that
// now compiles does, so the list cannot go stale.
//
// Usage: node scripts/compile-sv.mjs [--only <substring>] [--report <file.json>] [--verbose]
// Needs Verilator (or SV_COMPILER, for example scripts/verilator-docker.sh in CI)
// and UVM_HOME pointing at uvm-core 2020.3.1 for the UVM units.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const curriculumRoot = path.join(root, "content", "curriculum");
const labsRoot = path.join(curriculumRoot, "labs");
const labUnitsFile = path.join(labsRoot, "compile-units.json");
const configFile = path.join(root, "scripts", "sv-compile.config.json");

const argv = process.argv.slice(2);
const option = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const only = option("--only");
const reportFile = option("--report");
const verbose = argv.includes("--verbose");

const SV_LANGS = new Set(["systemverilog", "sv", "verilog"]);
const FILE_NAME = /^([\w-]+\.(?:sv|svh|v))\b/;
const UVM_USE = /\buvm_pkg\b|uvm_macros\.svh|`uvm_|\buvm_(?:component|object|test|env|agent|driver|monitor|sequencer|sequence|sequence_item|scoreboard|subscriber|reg)\b/;
const DEFINITION = /^\s*(?:virtual\s+)?(module|macromodule|interface|package|program|class|checker)\s+(?:automatic\s+|static\s+)?(\w+)/gm;

function walk(directory, skip = []) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return skip.includes(candidate) ? [] : walk(candidate, skip);
    return entry.isFile() ? [candidate] : [];
  });
}

/** Code blocks of one lesson: fenced blocks and InteractiveCode code={`...`} bodies, with the lesson line of their first body line. */
export function extractBlocks(source) {
  const blocks = [];
  const lines = source.split("\n");
  let open = null;
  lines.forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+-]*)/);
    if (!open && fence) {
      open = { fence: fence[1], lang: fence[2].toLowerCase(), line: index + 2, body: [] };
      return;
    }
    if (open && line.trim().startsWith(open.fence) && line.trim().replace(/[`~]/g, "") === "") {
      blocks.push({ lang: open.lang, line: open.line, code: open.body.join("\n") });
      open = null;
      return;
    }
    if (open) open.body.push(line);
  });

  const interactive = /<InteractiveCode\b([^]*?)code=\{`((?:\\[^]|[^`\\])*)`\}/g;
  for (const match of source.matchAll(interactive)) {
    const lang = (match[1].match(/language="([\w+-]+)"/) ?? [])[1] ?? "";
    const raw = match[2];
    const leading = raw.match(/^\n*/)[0].length;
    const before = source.slice(0, match.index + match[0].indexOf("code={`") + "code={`".length);
    blocks.push({
      lang: lang.toLowerCase(),
      line: before.split("\n").length + leading,
      code: raw.slice(leading).replace(/\\([`$\\])/g, "$1"),
    });
  }
  return blocks.sort((a, b) => a.line - b.line);
}

/** The `// compile` header of a block, or null for a snippet or an untagged block. */
export function compileHeader(code) {
  const first = code.split("\n").find((line) => line.trim()) ?? "";
  const tag = first.trim().match(/^\/\/\s*compile\b:?\s*(.*)$/);
  if (!tag) return null;
  const rest = tag[1].trim().replace(/^\(/, "");
  const addTo = rest.match(/^add to ([\w-]+\.(?:sv|svh|v))\b/);
  if (addTo) return { kind: "add", file: addTo[1] };
  const addToPackage = rest.match(/^add to (\w+)\b/);
  if (addToPackage) return { kind: "add-package", name: addToPackage[1] };
  const named = rest.match(FILE_NAME);
  if (named) return { kind: "file", file: named[1] };
  return { kind: "unit" };
}

function definitions(code) {
  return [...code.matchAll(DEFINITION)].map((match) => match[2]);
}

/** Compile units of one lesson. */
export function lessonUnits(relative, source) {
  const id = relative.replace(/\.mdx$/, "");
  const blocks = extractBlocks(source).filter((block) => SV_LANGS.has(block.lang));
  const compiled = blocks.filter((block) => compileHeader(block.code));
  const snippets = blocks.filter((block) => !compileHeader(block.code));
  const units = [];
  const benches = [];
  let bench = null;
  let ordinal = 0;
  for (const block of compiled) {
    const header = compileHeader(block.code);
    if (header.kind === "unit") {
      ordinal += 1;
      units.push({ id: `${id}#${ordinal}`, lesson: relative, files: [{ name: "block.sv", code: block.code, line: block.line }] });
      continue;
    }
    if (header.kind === "add-package") {
      ordinal += 1;
      const host = compiled.filter((other) => other.line < block.line && new RegExp(`^\\s*package\\s+${header.name}\\b`, "m").test(other.code)).pop();
      const end = host ? host.code.indexOf("endpackage", host.code.search(new RegExp(`\\bpackage\\s+${header.name}\\b`))) : -1;
      units.push(end < 0
        ? { id: `${id}#${ordinal}`, lesson: relative, files: [], problem: `"add to ${header.name}" has no earlier block that declares package ${header.name}` }
        : { id: `${id}#${ordinal}`, lesson: relative, files: [{ name: "block.sv", line: host.line, code: `${host.code.slice(0, end)}\n${block.code}\n${host.code.slice(end)}` }] });
      continue;
    }
    if (header.kind === "add") {
      const target = bench?.files.find((file) => file.name === header.file);
      if (target) target.additions.push({ code: block.code, line: block.line });
      else units.push({ id: `${id}#add-${header.file}`, lesson: relative, files: [], problem: `"add to ${header.file}" has no earlier ${header.file} block` });
      continue;
    }
    if (!bench || bench.files.some((file) => file.name === header.file)) {
      bench = { files: bench ? bench.files.map((file) => ({ ...file })) : [] };
      benches.push(bench);
    }
    const existing = bench.files.findIndex((file) => file.name === header.file);
    const entry = { name: header.file, code: block.code, line: block.line, additions: [] };
    if (existing >= 0) bench.files[existing] = entry;
    else bench.files.push(entry);
  }
  benches.forEach((entry, index) => {
    units.push({
      id: `${id}#bench${index ? `-${index + 1}` : ""}`,
      lesson: relative,
      files: entry.files.map((file) => ({
        name: file.name,
        line: file.line,
        code: [file.code, ...file.additions.map((addition) => addition.code)].join("\n\n"),
        additions: file.additions,
      })),
    });
  });
  // Blocks a unit may borrow when Verilator reports a missing definition: compile blocks first, then snippets.
  const library = [...compiled, ...snippets].map((block) => ({ code: block.code, line: block.line, defines: definitions(block.code), snippet: snippets.includes(block) }));
  units.forEach((unit) => { unit.library = library; });
  return units;
}

/**
 * A bench's files plus files it does not show from the bench it builds on (all of
 * them, or only `names`), in that bench's order. Borrowed files remember their lesson.
 */
export function inheritFiles(files, parent, names) {
  const own = new Map(files.map((file) => [file.name, file]));
  const borrowed = parent.files.filter((file) => own.has(file.name) || !names || names.includes(file.name));
  const merged = borrowed.map((file) => own.get(file.name) ?? { ...file, from: parent.lesson });
  return [...merged, ...files.filter((file) => !borrowed.some((entry) => entry.name === file.name))];
}

function labUnits() {
  if (!fs.existsSync(labUnitsFile)) return [];
  const config = JSON.parse(fs.readFileSync(labUnitsFile, "utf8"));
  return Object.entries(config.labs).flatMap(([lab, units]) =>
    units.map((unit) => ({
      id: `labs/${lab}#${unit.name}`,
      lab,
      cwd: path.join(labsRoot, lab),
      labFiles: unit.files,
      includeDirs: unit.includeDirs ?? [],
      defines: unit.defines ?? [],
      uvm: Boolean(unit.uvm),
      expect: unit.expect ?? "compiles",
    })),
  );
}

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, output });
    });
  });
}

const errorLines = (output) => output.split("\n").filter((line) => /^%Error/.test(line));

/** Names Verilator could not find, so a lesson unit can borrow their definitions. */
function missingNames(output) {
  const pattern = /(?:not found|missing [\w/]+|Cannot find[^:'\n]*|Can't find[^:'\n]*): '(\w+)'/g;
  return [...new Set([...output.matchAll(pattern)].map((match) => match[1]))];
}

const uvmHome = process.env.UVM_HOME;
let compiler = null;
let tempBase = "";

function verilatorArgs({ uvm, includeDirs, defines, files }) {
  return [
    "--lint-only", "--timing", "-Wall", "-Wno-fatal",
    ...defines.map((define) => `+define+${define}`),
    ...(uvm ? [`-I${path.join(uvmHome, "src")}`, path.join(uvmHome, "src", "uvm_pkg.sv")] : []),
    ...includeDirs.map((dir) => `-I${dir}`),
    ...files,
  ];
}

/** Writes a lesson unit to its own folder and returns the files to pass, packages first. */
function writeLessonUnit(unit, extra, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = [
    ...extra.map((block, index) => ({ name: `dep${index + 1}.sv`, code: block.code })),
    ...unit.files,
  ];
  if (!/^\s*(?:module|macromodule|program)\s+\w+/m.test(files.map((file) => file.code).join("\n"))) {
    files.push({ name: "sv_compile_top.sv", code: "module sv_compile_top;\nendmodule" });
  }
  files.forEach((file) => fs.writeFileSync(path.join(dir, file.name), `${file.code}\n`));
  const included = new Set(files.flatMap((file) => [...file.code.matchAll(/`include\s+"([^"]+)"/g)].map((match) => path.basename(match[1]))));
  const passed = files.filter((file) => !file.name.endsWith(".svh") && !included.has(file.name));
  const isPackage = (file) => /^\s*package\s+\w+/m.test(file.code);
  return [...passed.filter(isPackage), ...passed.filter((file) => !isPackage(file))].map((file) => path.join(dir, file.name));
}

async function compileLessonUnit(unit, index) {
  if (unit.problem) return { status: "fail", errors: [unit.problem] };
  const dir = path.join(tempBase, `u${index}`);
  const code = unit.files.map((file) => file.code).join("\n");
  const extra = [];
  const own = new Set(definitions(code));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const all = [code, ...extra.map((block) => block.code)].join("\n");
    const uvm = UVM_USE.test(all);
    if (uvm && !uvmHome) return { status: "fail", errors: ["UVM_HOME is required"] };
    const files = writeLessonUnit(unit, extra, dir);
    const result = await run(compiler, verilatorArgs({ uvm, includeDirs: [dir], defines: [], files }), dir);
    if (result.status === 0) return { status: "pass", borrowed: extra.map((block) => block.line) };
    const firstLine = unit.files[0]?.line ?? 0;
    const missing = missingNames(result.output).filter((name) => !own.has(name));
    // Borrow the nearest earlier block of the lesson that defines a missing name (or else the nearest later one).
    const candidates = unit.library.filter((block) => !extra.includes(block) && !unit.files.some((file) => file.line === block.line));
    const additions = missing.flatMap((name) => {
      const nearest = (pool) => pool.filter((block) => block.line < firstLine).pop() ?? pool[0];
      const defining = candidates.filter((block) => block.defines.includes(name));
      return nearest(defining.filter((block) => !block.snippet)) ?? nearest(defining.filter((block) => block.snippet)) ?? [];
    });
    if (additions.length === 0) return { status: "fail", errors: errorLines(result.output), output: result.output, borrowed: extra.map((block) => block.line) };
    for (const block of new Set(additions)) {
      extra.push(block);
      block.defines.forEach((name) => own.add(name));
    }
    // Keep borrowed definitions ahead of the blocks that use them.
    extra.sort((a, b) => a.line - b.line);
  }
  return { status: "fail", errors: ["gave up borrowing definitions after 4 attempts"] };
}

async function compileLabUnit(unit) {
  const missing = unit.labFiles.filter((file) => !fs.existsSync(path.join(unit.cwd, file)));
  if (missing.length) return { status: "fail", errors: missing.map((file) => `missing file ${file}`) };
  const usesUvm = unit.uvm || unit.labFiles.some((file) => UVM_USE.test(fs.readFileSync(path.join(unit.cwd, file), "utf8")));
  if (usesUvm && !uvmHome) return { status: "fail", errors: ["UVM_HOME is required"] };
  const result = await run(compiler, verilatorArgs({
    uvm: usesUvm,
    includeDirs: [".", ...unit.includeDirs],
    defines: unit.defines,
    files: unit.labFiles,
  }), unit.cwd);
  return result.status === 0 ? { status: "pass" } : { status: "fail", errors: errorLines(result.output), output: result.output };
}

/** Maps "<dir>/<file>:<line>" in an error to the lesson line the block came from. */
function lessonLocation(unit, error) {
  const match = error.match(/([\w.-]+\.(?:sv|svh|v)):(\d+):/);
  if (!match || !unit.files) return "";
  const file = unit.files.find((entry) => entry.name === match[1]);
  if (!file) return "";
  return ` (${file.from ? `${file.from} ` : "lesson "}line ${file.line + Number(match[2]) - 1})`;
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function main() {
  const lessonFiles = walk(curriculumRoot, [labsRoot]).filter((file) => file.endsWith(".mdx"));
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {};
  const lessons = lessonFiles.flatMap((file) => lessonUnits(path.relative(curriculumRoot, file), fs.readFileSync(file, "utf8")));
  for (const [id, spec] of Object.entries(config.inherit ?? {})) {
    const { from, files } = typeof spec === "string" ? { from: spec } : spec;
    const unit = lessons.find((entry) => entry.id === id);
    const parent = lessons.find((entry) => entry.id === from);
    if (!unit || !parent) throw new Error(`sv-compile.config.json inherit: unknown unit ${unit ? from : id}`);
    unit.files = inheritFiles(unit.files, parent, files);
  }
  const allUnits = [...lessons, ...labUnits()];
  const units = allUnits.filter((unit) => !only || unit.id.includes(only));
  const missing = Object.keys(config.known ?? {}).filter((id) => !allUnits.some((unit) => unit.id === id));
  if (missing.length) {
    console.error(`sv-compile.config.json lists units that no longer exist; remove or rename them:\n${missing.map((id) => `  ${id}`).join("\n")}`);
    process.exit(1);
  }

  compiler = process.env.SV_COMPILER || (commandExists("verilator") ? "verilator" : null);

  if (!compiler) {
    const message = `No SystemVerilog compiler found for ${units.length} compile units. Install Verilator 5.050 or later, or set SV_COMPILER.`;
    if (process.env.CI) {
      console.error(message);
      process.exit(1);
    }
    console.warn(message);
    process.exit(0);
  }

  tempBase = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "sv-compile-"));
  const known = config.known ?? {};
  const limit = Math.max(1, Math.min(Number(process.env.SV_COMPILE_JOBS) || os.availableParallelism(), 8));
  const results = await pool(units, limit, async (unit, index) => {
    const result = unit.lab ? await compileLabUnit(unit) : await compileLessonUnit(unit, index);
    if (verbose) console.log(`${result.status === "pass" ? "ok  " : "FAIL"} ${unit.id}`);
    return { unit, ...result };
  });
  fs.rmSync(tempBase, { recursive: true, force: true });

  const unexpected = [];
  const knownFailing = [];
  const stale = [];
  for (const result of results) {
    const entry = known[result.unit.id];
    const failed = result.status === "fail" && result.unit.expect !== "incomplete-by-design";
    if (failed && !entry) unexpected.push(result);
    else if (failed && entry) knownFailing.push(result);
    else if (!failed && entry && !only) stale.push(result);
  }

  if (reportFile) {
    fs.writeFileSync(reportFile, `${JSON.stringify(results.map(({ unit, status, errors, borrowed }) => ({
      id: unit.id,
      source: unit.lesson ? `content/curriculum/${unit.lesson}` : `content/curriculum/labs/${unit.lab}`,
      files: unit.files ? unit.files.map((file) => ({ name: file.name, line: file.line })) : unit.labFiles,
      status,
      known: Boolean(known[unit.id]),
      borrowed,
      errors: (errors ?? []).slice(0, 12).map((error) => `${error}${lessonLocation(unit, error)}`),
    })), null, 2)}\n`);
  }

  const lessonCount = results.filter((result) => result.unit.lesson).length;
  const describe = (result) => `${result.unit.id}\n${(result.errors ?? []).slice(0, 8).map((error) => `  ${error.replace(tempBase, "")}${lessonLocation(result.unit, error)}`).join("\n")}`;
  if (unexpected.length) console.error(`\n${unexpected.length} compile units failed:\n\n${unexpected.map(describe).join("\n\n")}`);
  if (stale.length) console.error(`\n${stale.length} units listed as known in scripts/sv-compile.config.json now compile; remove them:\n${stale.map((result) => `  ${result.unit.id}`).join("\n")}`);
  if (unexpected.length || stale.length) process.exit(1);
  console.log(`Checked ${results.length} SystemVerilog units (${lessonCount} from lessons, ${results.length - lessonCount} from labs) with ${path.basename(compiler)}: ${results.length - knownFailing.length} compile, ${knownFailing.length} known failures (see "known" in scripts/sv-compile.config.json).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    if (tempBase) fs.rmSync(tempBase, { recursive: true, force: true });
    console.error(error);
    process.exit(1);
  });
}
