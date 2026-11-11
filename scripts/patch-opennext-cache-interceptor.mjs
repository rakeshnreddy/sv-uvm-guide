#!/usr/bin/env node
/**
 * Patch @opennextjs/aws so the home page "/" is served by OpenNext's cache
 * interception like every other prerendered page.
 *
 * Why: in @opennextjs/aws 3.9.12 (pulled in by @opennextjs/cloudflare 1.15.1),
 * dist/core/routing/cacheInterceptor.js strips the trailing slash, so "/"
 * becomes "". The fallbacks that follow use `??`, which keeps "" (it is not
 * null), so "" is looked up in the prerender manifest, is not found, and the
 * request falls through to the full Next.js server (18 MB) on every view.
 * Replacing `??` with `||` makes "" fall back to "/" for the manifest lookup
 * and to "/index" for the cache key (the key Next uses for the root page).
 *
 * Usage:
 *   node scripts/patch-opennext-cache-interceptor.mjs          apply (idempotent), then verify
 *   node scripts/patch-opennext-cache-interceptor.mjs --check  verify node_modules only; never writes
 *   node scripts/patch-opennext-cache-interceptor.mjs --check-output
 *                                                              verify the built .open-next/middleware/handler.mjs
 *
 * Both modes exit 1 with a clear message when the expected source text is not
 * found (for example after a dependency update), so a build can never silently
 * ship without the patch. Apply mode exits 0 with a warning when the package is
 * not installed at all (a production install without devDependencies).
 *
 * Run from: postinstall, `npm run cf:build`, and the OpenNext `buildCommand`
 * in open-next.config.ts (which Workers Builds uses through
 * `npx opennextjs-cloudflare build`). See docs/deploy/cloudflare.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TARGET_RELATIVE_PATH = "@opennextjs/aws/dist/core/routing/cacheInterceptor.js";

/** Each replacement: the upstream text and the patched text. */
export const REPLACEMENTS = [
  {
    name: "prerender-manifest lookup",
    original: '.includes(localizedPath ?? "/")',
    patched: '.includes(localizedPath || "/")',
  },
  {
    name: "incremental-cache key",
    original: 'incrementalCache.get(localizedPath ?? "/index")',
    patched: 'incrementalCache.get(localizedPath || "/index")',
  },
];

export class PatchSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "PatchSourceError";
  }
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * Pure transform. Returns { code, changed, applied } where `applied` lists the
 * replacements made on this call. Throws PatchSourceError when a replacement is
 * neither in its original nor its patched form, or is ambiguous.
 */
export function patchSource(source) {
  let code = source;
  const applied = [];
  for (const { name, original, patched } of REPLACEMENTS) {
    const originals = countOccurrences(code, original);
    const patches = countOccurrences(code, patched);
    if (originals === 0 && patches === 1) continue;
    if (originals === 1 && patches === 0) {
      code = code.replace(original, patched);
      applied.push(name);
      continue;
    }
    throw new PatchSourceError(
      `expected exactly one of \`${original}\` or \`${patched}\` (${name}); ` +
        `found ${originals} original and ${patches} patched occurrence(s). ` +
        "The @opennextjs/aws source changed: re-check the home-page cache interception fix.",
    );
  }
  return { code, changed: applied.length > 0, applied };
}

/** True when every replacement is in its patched form (and none in the original). */
export function isPatched(source) {
  return REPLACEMENTS.every(
    ({ original, patched }) =>
      countOccurrences(source, original) === 0 && countOccurrences(source, patched) === 1,
  );
}

export function resolveTarget(fromDir = process.cwd()) {
  const require = createRequire(path.join(fromDir, "package.json"));
  try {
    // The package's exports map does not expose dist/core/**, so resolve its
    // package.json and build the path from there.
    const pkgJson = require.resolve("@opennextjs/aws/package.json");
    return path.join(path.dirname(pkgJson), "dist/core/routing/cacheInterceptor.js");
  } catch {
    const fallback = path.join(fromDir, "node_modules", TARGET_RELATIVE_PATH);
    return existsSync(fallback) ? fallback : null;
  }
}

function fail(message) {
  console.error(`\n[patch-opennext-cache-interceptor] ERROR: ${message}\n`);
  process.exit(1);
}

export const BUNDLED_MIDDLEWARE = ".open-next/middleware/handler.mjs";

/** Verify the built Worker middleware carries the patched code (after `opennextjs-cloudflare build`). */
function checkOutput() {
  const bundle = path.resolve(BUNDLED_MIDDLEWARE);
  if (!existsSync(bundle)) fail(`${BUNDLED_MIDDLEWARE} not found. Run \`opennextjs-cloudflare build\` first.`);
  if (!isPatched(readFileSync(bundle, "utf8"))) {
    fail(
      `${BUNDLED_MIDDLEWARE} does not contain the cache interception patch, so "/" would load the full server.\n` +
        "Apply the patch (node scripts/patch-opennext-cache-interceptor.mjs) and rebuild.",
    );
  }
  console.log(`[patch-opennext-cache-interceptor] OK: ${BUNDLED_MIDDLEWARE} contains the patch.`);
}

function main(argv) {
  if (argv.includes("--check-output")) return checkOutput();
  const checkOnly = argv.includes("--check");
  const target = resolveTarget();
  if (!target || !existsSync(target)) {
    if (checkOnly) {
      fail(`${TARGET_RELATIVE_PATH} not found. Install dependencies (npm ci) before building for Cloudflare.`);
    }
    console.warn(`[patch-opennext-cache-interceptor] ${TARGET_RELATIVE_PATH} not installed; nothing to patch.`);
    return;
  }

  const source = readFileSync(target, "utf8");
  if (checkOnly) {
    if (!isPatched(source)) {
      fail(
        `${target} is not patched, so "/" would bypass cache interception and load the full server.\n` +
          "Run `node scripts/patch-opennext-cache-interceptor.mjs` (or `npm run cf:build`, which applies it).",
      );
    }
    console.log("[patch-opennext-cache-interceptor] OK: cache interception patch is in place.");
    return;
  }

  let result;
  try {
    result = patchSource(source);
  } catch (error) {
    fail(`${target}: ${error.message}`);
  }
  if (result.changed) {
    writeFileSync(target, result.code);
    console.log(`[patch-opennext-cache-interceptor] patched ${target} (${result.applied.join(", ")}).`);
  }
  const after = readFileSync(target, "utf8");
  if (!isPatched(after)) fail(`${target}: patch did not stick.`);
  if (!result.changed) console.log("[patch-opennext-cache-interceptor] OK: already patched.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
