"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const ts = require("typescript");
const git = (...args) =>
  cp.execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 48 * 1024 * 1024,
  });
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? files(f) : [f];
  });
}
function repoAt(ref) {
  const paths = new Set(
    ref
      ? git("ls-tree", "-r", "--name-only", ref, "--", "src")
          .trimEnd()
          .split("\n")
      : files("src"),
  );
  const cache = new Map();
  function read(f) {
    if (!cache.has(f))
      cache.set(
        f,
        ref ? git("show", ref + ":" + f) : fs.readFileSync(f, "utf8"),
      );
    return cache.get(f);
  }
  function resolve(base) {
    return [
      base,
      ...[".ts", ".tsx", ".js", ".jsx", ".json", "/index.ts", "/index.tsx"].map(
        (ext) => base + ext,
      ),
    ].find((p) => paths.has(p));
  }
  function dependencies(entry) {
    const seen = new Set();
    function visit(f) {
      if (!f || seen.has(f)) return;
      seen.add(f);
      if (f.endsWith(".json")) return;
      for (const imp of ts.preProcessFile(read(f), true, true).importedFiles) {
        const name = imp.fileName;
        if (name.startsWith("@/")) visit(resolve("src/" + name.slice(2)));
        if (name.startsWith("."))
          visit(resolve(path.join(path.dirname(f), name)));
      }
    }
    visit(resolve(entry));
    return seen;
  }
  return { dependencies };
}
function run(exe, args, env = {}) {
  return new Promise((resolve) => {
    const child = cp.spawn(exe, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    const chunks = [];
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (b) => chunks.push(b));
    child.on("error", (err) =>
      resolve({ status: -1, command: [exe, ...args], output: err.message }),
    );
    child.on("close", (status) =>
      resolve({
        status,
        command: [exe, ...args],
        output: Buffer.concat(chunks)
          .toString()
          .replace(/\u001b\[[\d;]*m/g, "")
          .trim(),
      }),
    );
  });
}
module.exports = { git, files, repoAt, run };
