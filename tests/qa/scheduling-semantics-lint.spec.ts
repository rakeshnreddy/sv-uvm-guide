import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against scheduling misconceptions that previously appeared in
 * lessons, flashcards, interview banks and visual data. Each rule cites the
 * IEEE 1800-2023 clause that contradicts it.
 */
const ROOTS = ["content/curriculum", "content/flashcards", "content/interview-questions", "src/components/visuals", "src/components/visualizers", "src/content"];

const forbidden: { pattern: RegExp; why: string }[] = [
  { pattern: /assertions?[^.\n]{0,40}\bsample[ds]?\b[^.\n]{0,15}\bin (the )?Observed/i, why: "Concurrent assertions sample in Preponed and evaluate in Observed (§16.5.1)." },
  { pattern: /\binputs? sample[ds]? in (the )?Observed/i, why: "Default #1step clocking inputs sample in Preponed (§14.13)." },
  { pattern: /\bRe-Active\b/, why: "There is no Re-Active region; clocking drives land in Re-NBA (§14.16)." },
  { pattern: /NBA region \(or Re-NBA|NBA or Re-NBA region|NBA\/Re-NBA region/i, why: "Clocking-block drives always mature in Re-NBA (§14.16)." },
  { pattern: /\bfinal\b[^|\n]{0,60}\bPostponed\b|\bPostponed\b[^|\n]{0,20}\|\s*`?final/i, why: "final blocks run at end of simulation (§9.2.3), not in the Postponed region." },
];

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(mdx?|json|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

describe("scheduling semantics content lint", () => {
  it("contains none of the known IEEE 1800 scheduling misconceptions", () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const rule of forbidden) {
          if (rule.pattern.test(line)) offenders.push(`${file}:${i + 1} — ${rule.why}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
