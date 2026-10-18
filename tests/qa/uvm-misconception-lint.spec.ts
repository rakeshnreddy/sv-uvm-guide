import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against UVM misconceptions and wrong citations that the G29 interview
 * bank review removed from the banks, so they do not return there or spread to
 * lessons and flashcards. Each rule is matched one sentence at a time and
 * skips sentences that negate it ("is not a safety net", "do not each receive
 * a copy"), because lessons name these misconceptions in order to correct them.
 */
const ROOTS = ["content/curriculum", "content/flashcards", "content/interview-questions"];

const NEGATION = /\b(?:not|no|never|n't|nor|instead of|rather than|myth|misconception|wrong|incorrect|mistake)\b/i;

const forbidden: { pattern: RegExp; why: string; negatable: boolean }[] = [
  {
    pattern: /analysis[^.\n]{0,80}\b(?:each|every)\s+(?:subscriber|export|imp|listener)[^.\n]{0,40}\b(?:receives?|gets?)\s+(?:its own\s+)?(?:a\s+)?(?:copy|clone)\b/i,
    why: "write() passes the same object handle to every subscriber; nothing is copied (IEEE 1800.2-2020 12.2.10.1).",
    negatable: true,
  },
  {
    pattern: /drain[ -]time[^.\n]{0,60}\b(?:is|as|acts as|serves as)\s+(?:a|an|the)\s+(?:hang\s+)?safety net/i,
    why: "Drain time starts only after the objection count reaches zero, so it cannot rescue a hang (IEEE 1800.2-2020 10.5.1.3.7).",
    negatable: true,
  },
  {
    pattern: /1800\.2[^.\n]{0,30}§\s?3\s*\(Factory\)/i,
    why: "The UVM factory is IEEE 1800.2-2020 clause 8.3, not 3.",
    negatable: false,
  },
  {
    pattern: /§\s?9\.4\s*\(Objections?\)/i,
    why: "Objections are IEEE 1800.2-2020 clause 10.5 (9.4 is uvm_domain).",
    negatable: false,
  },
  {
    pattern: /Accellera UVM debug guide/i,
    why: "No such Accellera publication exists; cite the standard or label the advice as practice.",
    negatable: false,
  },
];

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(mdx?|json)$/.test(entry.name) ? [full] : [];
  });
}

/** Sentences on one line: split at ., ! or ? followed by a space, so file:line stays exact. */
function sentences(line: string): string[] {
  return line.split(/(?<=[.!?])\s+/);
}

describe("UVM misconception lint", () => {
  it("contains none of the known-wrong UVM claims or citations", () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const sentence of sentences(line)) {
            for (const rule of forbidden) {
              if (!rule.pattern.test(sentence)) continue;
              if (rule.negatable && NEGATION.test(sentence)) continue;
              offenders.push(`${file}:${index + 1}: ${rule.why}\n    ${sentence.trim().slice(0, 160)}`);
            }
          }
        });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("catches each rule and lets a correcting sentence through", () => {
    const hit = (text: string) =>
      forbidden.some((rule) => rule.pattern.test(text) && !(rule.negatable && NEGATION.test(text)));
    expect(hit("With an analysis port, each subscriber receives a copy of the item.")).toBe(true);
    expect(hit("With an analysis port, each subscriber does not receive a copy of the item.")).toBe(false);
    expect(hit("Set a drain time as a safety net for hangs.")).toBe(true);
    expect(hit("Drain time is not a hang safety net.")).toBe(false);
    expect(hit("IEEE 1800.2 §3 (Factory)")).toBe(true);
    expect(hit("see §9.4 (Objections)")).toBe(true);
    expect(hit("per the Accellera UVM debug guide")).toBe(true);
  });
});
