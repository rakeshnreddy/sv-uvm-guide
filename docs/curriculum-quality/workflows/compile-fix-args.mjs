// Builds the args for compile-fix.js from a fresh compile report:
//   UVM_HOME=<uvm-core> node scripts/compile-sv.mjs --report /tmp/sv-report.json
//   node docs/curriculum-quality/workflows/compile-fix-args.mjs /tmp/sv-report.json > args.json
// One group per lesson file or lab folder. The arbiter lab compiles the common
// lab's arbiter.sv, so those two labs form one group.
import fs from "node:fs";
import path from "node:path";

const [reportFile] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const known = JSON.parse(fs.readFileSync("scripts/sv-compile.config.json", "utf8")).known;

const groupOf = (id) => {
  const source = id.split("#")[0];
  return source === "labs/arbiter" ? "labs/common" : source;
};

const groups = new Map();
for (const entry of report) {
  if (entry.status !== "fail" || !known[entry.id]) continue;
  const key = groupOf(entry.id);
  if (!groups.has(key)) {
    const files = key.startsWith("labs/")
      ? [`content/curriculum/${key}/`, ...(key === "labs/common" ? ["content/curriculum/labs/arbiter/"] : [])]
      : [`content/curriculum/${key}.mdx`];
    groups.set(key, { source: key, files, units: [] });
  }
  groups.get(key).units.push({ id: entry.id, kind: known[entry.id].kind, reason: known[entry.id].reason, errors: entry.errors });
}

const notes = {
  "labs/common": "The arbiter and common labs are coming soon and phase 6a rebuilds them. Fix only the illegal code in content/curriculum/labs/common/rtl/arbiter.sv now; leave the arbiter lab's missing DUT to phase 6a and say so in the unit reason.",
};
for (const group of groups.values()) if (notes[group.source]) group.note = notes[group.source];

process.stdout.write(`${JSON.stringify([...groups.values()], null, 2)}\n`);
console.error(`${groups.size} groups, ${[...groups.values()].reduce((n, group) => n + group.units.length, 0)} units (from ${path.basename(reportFile)})`);
