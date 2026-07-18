import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const labsRoot = path.join(root, "content", "curriculum", "labs");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(candidate) : entry.isFile() ? [candidate] : [];
  });
}

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

const solutionFiles = walk(labsRoot).filter((file) =>
  /(?:^|[/_-])solution(?:[/_.-]|$)/i.test(file) && /\.svh?$/i.test(file),
);
const compiler = process.env.SV_COMPILER || (commandExists("verilator") ? "verilator" : commandExists("iverilog") ? "iverilog" : null);

if (!compiler) {
  const message = `No SystemVerilog compiler found; discovered ${solutionFiles.length} reference files. Install Verilator or Icarus, or set SV_COMPILER.`;
  if (process.env.CI) {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
  process.exit(0);
}

const uvmHome = process.env.UVM_HOME;
const failures = [];
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sv-uvm-solutions-"));

try {
  for (const solution of solutionFiles) {
    const source = fs.readFileSync(solution, "utf8");
    const usesUvm = /\buvm_|uvm_macros\.svh/.test(source);
    if (usesUvm && !uvmHome) {
      failures.push(`${path.relative(root, solution)}: UVM_HOME is required`);
      continue;
    }

    const output = path.join(temporaryRoot, `${path.basename(solution)}.out`);
    const args = compiler.includes("verilator")
      ? ["--lint-only", "--timing", "-Wall", "-Wno-fatal", ...(uvmHome ? [`-I${path.join(uvmHome, "src")}`, path.join(uvmHome, "src", "uvm_pkg.sv")] : []), solution]
      : ["-g2012", "-t", "null", "-o", output, ...(uvmHome ? ["-I", path.join(uvmHome, "src"), path.join(uvmHome, "src", "uvm_pkg.sv")] : []), solution];
    const result = spawnSync(compiler, args, { cwd: path.dirname(solution), encoding: "utf8" });
    if (result.status !== 0) {
      failures.push(`${path.relative(root, solution)}:\n${result.stderr || result.stdout}`);
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log(`Compiled ${solutionFiles.length} SystemVerilog reference files with ${compiler}.`);
