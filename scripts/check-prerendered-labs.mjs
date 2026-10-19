#!/usr/bin/env node
/**
 * Checks a finished `next build` for the static pages the anonymous deploy
 * relies on (npm run check:prerender, after the build in test:ci):
 * - every available lab in content/curriculum/labs/** /lab.json is
 *   prerendered at /practice/lab/<id>;
 * - no coming-soon or archived lab is prerendered;
 * - /practice/lab/[labId] has no fallback (dynamicParams = false), so unknown
 *   ids answer 404 instead of rendering on the Worker;
 * - the learner pages /dashboard, /dashboard/review, /dashboard/notebook and
 *   /settings are prerendered.
 *
 * It only reads .next/prerender-manifest.json and the lab manifests; it never
 * builds. Exits 1 and lists what is missing.
 *
 * Usage: node scripts/check-prerendered-labs.mjs [--next-dir <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const labsRoot = path.join(repositoryRoot, "content", "curriculum", "labs");
const LAB_ROUTE = "/practice/lab/[labId]";
const LEARNER_PAGES = ["/dashboard", "/dashboard/review", "/dashboard/notebook", "/settings"];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const nextDir = path.resolve(repositoryRoot, argument("--next-dir") ?? ".next");
const manifestPath = path.join(nextDir, "prerender-manifest.json");

function walk(directory, fileName) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(candidate, fileName);
    return entry.isFile() && entry.name === fileName ? [candidate] : [];
  });
}

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

if (!fs.existsSync(nextDir) || !fs.existsSync(manifestPath)) {
  fail([
    `check-prerendered-labs: ${path.relative(repositoryRoot, manifestPath) || manifestPath} was not found.`,
    "Hint: run it after a production build (npm run build, or ANALYZE=true npm run build in test:ci). It only reads the build output.",
  ]);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail([`check-prerendered-labs: ${manifestPath} is not valid JSON (${error instanceof Error ? error.message : error}).`]);
}

const routes = new Set(Object.keys(manifest?.routes ?? {}));
const labs = walk(labsRoot, "lab.json").sort().map((manifestFile) => {
  const lab = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  return { id: lab.id, status: lab.status, file: path.relative(repositoryRoot, manifestFile) };
});
const available = labs.filter((lab) => lab.status === "available");
const unavailable = labs.filter((lab) => lab.status !== "available");

const problems = [];
for (const lab of available) {
  const route = `/practice/lab/${lab.id}`;
  if (!routes.has(route)) problems.push(`missing prerendered lab page ${route} (${lab.file})`);
}
for (const lab of unavailable) {
  const route = `/practice/lab/${lab.id}`;
  if (routes.has(route)) problems.push(`unexpected prerendered page ${route}: the lab is ${lab.status} (${lab.file})`);
}
const labRoute = manifest?.dynamicRoutes?.[LAB_ROUTE];
if (labRoute && labRoute.fallback !== false) {
  problems.push(`${LAB_ROUTE} has fallback ${JSON.stringify(labRoute.fallback)}; expected false (dynamicParams = false)`);
}
for (const page of LEARNER_PAGES) {
  if (!routes.has(page)) problems.push(`missing prerendered learner page ${page}`);
}

if (problems.length > 0) {
  fail([
    `check-prerendered-labs: ${problems.length} problem(s) in ${path.relative(repositoryRoot, manifestPath)}:`,
    ...problems.map((problem) => `  - ${problem}`),
  ]);
}

console.log(
  `check-prerendered-labs: ${available.length} lab pages and ${LEARNER_PAGES.length} learner pages are prerendered; `
    + `${unavailable.length} unavailable labs are not.`,
);
