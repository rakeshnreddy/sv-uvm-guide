import { describe, expect, it } from "vitest";

import {
  BENCH_FILE_CHOICES,
  CURSOR_FILES,
  CURSOR_LOOPS,
  DEBUG_CASES,
  GUARDED_BENCH,
  NO_SUMMARY,
  addBits,
  benchRunFor,
  caseNotEqual,
  checkOutcomeOptions,
  chipValue,
  cursorSource,
  debugCaseNote,
  decFieldToBits,
  describeLineTape,
  describeTape,
  explainScan,
  fgets,
  fieldOverflows,
  formatHex,
  formatNs,
  hexFieldToBits,
  judgeRun,
  lineRan,
  looseNotEqual,
  looseNotEqualValue,
  parseFormat,
  runBench,
  runCursor,
  scan,
  staleOptions,
  suspectFeedback,
  summaryOptions,
  type VarDecl,
} from "@/lib/sv-file-io-model";

const XY: VarDecl[] = [
  { name: "x", width: 8 },
  { name: "y", width: 8 },
];
const ABE: VarDecl[] = [
  { name: "a_v", width: 8 },
  { name: "b_v", width: 8 },
  { name: "exp_v", width: 9 },
];

describe("§21.3.4.3 $fscanf on a character stream", () => {
  const inTxt = "0a 05\nff 01\n";

  it("§21.3.4.3 returns the number of items assigned and leaves the trailing newline unread", () => {
    const r = scan(inTxt, 0, "%h %h", XY);
    expect(r.code).toBe(2);
    expect(r.end).toBe(5);
    expect(inTxt[r.end]).toBe("\n");
    expect(r.assigned).toEqual({ x: "00001010", y: "00000101" });
    expect(r.eofHit).toBe(false);
  });

  it("§21.3.4.3 a conversion skips leading white space, newlines included", () => {
    const r = scan(inTxt, 5, "%h %h", XY);
    expect(r.code).toBe(2);
    expect(r.start).toBe(5);
    expect(r.end).toBe(11);
    expect(formatHex(r.assigned.x)).toBe("ff");
  });

  it("§21.3.4.3 EOF (-1) only when the input ends before the first conversion; nothing is assigned", () => {
    const r = scan(inTxt, 11, "%h %h", XY);
    expect(r.code).toBe(-1);
    expect(r.assigned).toEqual({});
    expect(r.eofHit).toBe(true);
    expect(scan("", 0, "%h", XY).code).toBe(-1);
  });

  it("§21.3.4.3 0 on an early mismatch, with the offending character left unread", () => {
    const r = scan("g00\n", 0, "%h %h", XY);
    expect(r.code).toBe(0);
    expect(r.stop).toBe("matching-failure");
    expect(r.offendingAt).toBe(0);
    expect(r.end).toBe(0);
  });

  it("§21.3.4.3 a later mismatch returns the items already assigned (g00: code 2, g unread)", () => {
    const text = "01 02 003\nff 01 g00\n";
    const r = scan(text, 9, "%h %h %h", ABE);
    expect(r.code).toBe(2);
    expect(text[r.offendingAt as number]).toBe("g");
    expect(Object.keys(r.assigned)).toEqual(["a_v", "b_v"]);
    expect(r.failedWhat).toBe("conversion 3 (%h)");
    expect(explainScan(r, text, "$fscanf", 3)).toBe('"g" does not match conversion 3 (%h), so that directive fails; "g" is left unread and $fscanf returned the 2 items it assigned (§21.3.4.3).');
  });

  it("§21.3.4.3 input that ends after some conversions returns the count, not -1", () => {
    const r = scan("80 80\n", 0, "%h %h %h", ABE);
    expect(r.code).toBe(2);
    expect(r.stop).toBe("input-failure");
  });

  it("§21.3.4.3 with %h %h %h a short line takes its missing field from the next line", () => {
    const r = scan("01 02\nff 01 100\n", 0, "%h %h %h", ABE);
    expect(r.code).toBe(3);
    expect(r.crossedNewline).toBe(true);
    expect(formatHex(r.assigned.exp_v)).toBe("0ff");
  });

  it("§21.3.4.3 a suppressed conversion still counts as a conversion, so a later EOF returns 0, not -1", () => {
    expect(parseFormat("%*h %h")).toEqual([{ kind: "conv", code: "h", suppress: true, text: "%*h" }, { kind: "space" }, { kind: "conv", code: "h", suppress: false, text: "%h" }]);
    expect(scan("ab", 0, "%*h %h", XY).code).toBe(0);
  });

  it("§21.3.4.3 ordinary characters must match the next input character", () => {
    expect(scan("1,2", 0, "%h,%h", XY).code).toBe(2);
    expect(scan("1;2", 0, "%h,%h", XY)).toMatchObject({ code: 1, stop: "matching-failure", offendingAt: 1 });
  });

  it("§21.3.4.3 for $sscanf a null character is white space too", () => {
    expect(scan("1\u00002", 0, "%h %h", XY, { sscanf: true }).code).toBe(2);
    expect(scan("1\u00002", 0, "%h %h", XY).code).toBe(1);
  });

  it("§21.3.4.3 Table 21-7: %h accepts x, z, ? and _, and too-wide fields keep their LSBs", () => {
    expect(hexFieldToBits("x5", 8)).toBe("xxxx0101");
    expect(hexFieldToBits("?", 4)).toBe("zzzz");
    expect(hexFieldToBits("f_f", 8)).toBe("11111111");
    expect(hexFieldToBits("1ff", 8)).toBe("11111111");
    expect(hexFieldToBits("1", 9)).toBe("000000001");
  });

  it("§21.3.4.3 Table 21-7: %d accepts a sign and digits, or a single x/z/?; negatives keep their LSBs", () => {
    expect(decFieldToBits("12", 8)).toBe("00001100");
    expect(decFieldToBits("-1", 8)).toBe("11111111");
    expect(decFieldToBits("x", 4)).toBe("xxxx");
    expect(decFieldToBits("?", 4)).toBe("zzzz");
    expect(decFieldToBits("300", 8)).toBe("00101100");
    const r = scan("-3 7\n", 0, "%d %d", XY);
    expect(r.code).toBe(2);
    expect(r.assigned.x).toBe("11111101");
    expect(scan("xx", 0, "%d %d", XY)).toMatchObject({ code: 2 });
    expect(scan("+q", 0, "%d", XY)).toMatchObject({ code: 0, stop: "matching-failure", offendingAt: 0 });
  });

  it("§21.3.4.3 an argument too small for the converted input keeps its LSBs, and the narration says so", () => {
    expect(fieldOverflows("100", "h", 8)).toBe(true);
    expect(fieldOverflows("003", "h", 9)).toBe(false);
    expect(fieldOverflows("0ff", "h", 8)).toBe(false);
    expect(fieldOverflows("300", "d", 8)).toBe(true);
    expect(fieldOverflows("255", "d", 8)).toBe(false);
    expect(fieldOverflows("-1", "d", 8)).toBe(false);
    const text = "01 100 80\n";
    const r = scan(text, 0, "%h %h %h", ABE);
    expect(r.assigned.b_v).toBe("00000000");
    expect(explainScan(r, text, "$fscanf", 3)).toMatch(/The field "100" is too wide for the 8-bit b_v, so only its LSBs are kept: b_v = 8'h00 \(§21\.3\.4\.3\)\.$/);
    const clean = scan("01 02 003\n", 0, "%h %h %h", ABE);
    expect(explainScan(clean, "01 02 003\n", "$fscanf", 3)).not.toMatch(/too wide/);
  });

  it("§21.3.4.3 formats outside %h and %d are rejected rather than guessed", () => {
    expect(() => parseFormat("%s")).toThrow(/outside the model/);
  });
});

describe("§21.3.4.2 $fgets and §21.3.8 $feof", () => {
  it("§21.3.4.2 $fgets reads one line, newline included, and returns its length; 0 at the end", () => {
    expect(fgets("0a 05\nff 01\n", 0)).toMatchObject({ code: 6, line: "0a 05\n", eofHit: false });
    expect(fgets("0a 05\nff 01\n", 12)).toMatchObject({ code: 0, eofHit: true });
    expect(fgets("7f", 0)).toMatchObject({ code: 2, eofHit: true });
  });

  it("§21.3.4.2 / §21.3.7 the 0 at the end of the file is the character count; the narration notes that an error also returns 0", () => {
    const run = runCursor("in-txt", "fgets-sscanf");
    const last = run.steps.filter((s) => s.kind === "fgets").pop();
    expect(last?.returns).toBe("0");
    expect(last?.why).toMatch(/0 is also what an error returns; \$ferror \(§21\.3\.7\) tells the two apart/);
  });

  it("§21.3.8 $feof is 0 after the last vector (its newline is unread) and nonzero only after the -1 read", () => {
    const run = runCursor("in-txt", "forever-break");
    const reads = run.steps.filter((s) => s.kind === "read");
    expect(reads.map((s) => s.returns)).toEqual(["2", "2", "-1"]);
    expect(reads.map((s) => s.eof)).toEqual([false, false, true]);
  });
});

describe("§21.3.4.3 / §21.3.8 read loops on the lesson's files (cursor mode)", () => {
  it("§21.3.4.3 in.txt with forever/break: 3 calls, 2 checks, x and y unchanged on -1", () => {
    const run = runCursor("in-txt", "forever-break");
    expect(run.outcome).toEqual({ kind: "count", n: 2 });
    expect(run.readCodes).toEqual([2, 2, -1]);
    const last = run.steps.filter((s) => s.kind === "read")[2];
    expect(last.changed).toEqual([]);
    expect(chipValue(last.values.x)).toBe("8'hff");
    expect(chipValue(last.values.y)).toBe("8'h01");
    expect(run.steps[run.steps.length - 1].log).toEqual(["check 1: 0a 05", "check 2: ff 01"]);
  });

  it("§21.3.8 while (!$feof) checks the last vector twice, the second time on stale values", () => {
    const run = runCursor("vectors", "while-feof");
    expect(run.outcome).toEqual({ kind: "count", n: 5 });
    expect(run.staleChecks).toBe(1);
    const log = run.steps[run.steps.length - 1].log;
    expect(log.slice(-2)).toEqual(["check 4: 7f 01 080", "check 5: 7f 01 080"]);
    expect(staleOptions(run).find((o) => o.correct)?.id).toBe("yes");
  });

  it("§21.3.8 while (!$feof) on an empty file runs once and checks X: $feof is 0 before any read", () => {
    const run = runCursor("empty", "while-feof");
    expect(run.outcome).toEqual({ kind: "count", n: 1 });
    expect(run.steps[run.steps.length - 1].log).toEqual(["check 1: xx xx xxx"]);
    expect(checkOutcomeOptions(run).find((o) => o.label === "0 checks")?.feedback).toMatch(/^Before the first read \$feof is 0/);
    expect(checkOutcomeOptions(runCursor("vectors", "while-feof")).find((o) => o.label === "4 checks")?.feedback).toMatch(/final newline is still unread/);
  });

  it("§21.3.8 / §21.3.4.3 while (!$feof) on a short line: the third read returns 2 and sets EOF; the 'final newline' story does not apply", () => {
    const run = runCursor("short-line", "while-feof");
    expect(run.readCodes).toEqual([3, 3, 2]);
    expect(run.outcome).toEqual({ kind: "count", n: 3 });
    const reads = run.steps.filter((s) => s.kind === "read");
    expect(reads.map((s) => s.eof)).toEqual([false, false, true]);
    const two = checkOutcomeOptions(run).find((o) => o.label === "2 checks");
    expect(two?.correct).toBe(false);
    expect(two?.feedback).not.toMatch(/final newline/);
    expect(two?.feedback).toMatch(/^That would be right if \$feof turned nonzero after read 2, but "␠80␠100⏎" is still unread then, so \$feof is 0 \(§21\.3\.8\) and read 3 runs\. It assigns 2 of 3 fields/);
    const check3 = run.steps.filter((s) => s.kind === "check")[2];
    expect(check3.why).toMatch(/^exp_v was not assigned by the read just before this check \(it returned 2 of 3\): exp_v still holds 9'h080/);
  });

  it("§21.3.4.3 a stale check names only the variables its read left unassigned (garbled + while (!$feof))", () => {
    const run = runCursor("garbled", "while-feof");
    const reads = run.steps.filter((s) => s.kind === "read");
    expect(reads[1].changed).toEqual(["a_v", "b_v"]);
    const checks = run.steps.filter((s) => s.kind === "check");
    expect(checks[1].stale).toBe(true);
    expect(checks[1].why).toBe("exp_v was not assigned by the read just before this check (it returned 2 of 3): exp_v still holds 9'h003, left over from before. a_v and b_v are fresh, so this check mixes new and old values.");
    expect(checks[1].why).not.toMatch(/a_v (was|were) not assigned|These values were not assigned/);
    // Read 3 returns 0 and assigns nothing: the whole-row wording applies.
    expect(checks[2].why).toMatch(/^None of these values was assigned by the read just before this check \(it returned 0\)/);
    expect(staleOptions(run).find((o) => o.id === "yes")?.feedback).toMatch(/even when the read assigned fewer than all of them \(or none\)/);
  });

  it("§21.3.4.3 a -1 read leaves the whole row stale (vectors + while (!$feof), check 5)", () => {
    const run = runCursor("vectors", "while-feof");
    const last = run.steps.filter((s) => s.kind === "check").pop();
    expect(last?.why).toMatch(/^None of these values was assigned by the read just before this check \(it returned -1\)/);
  });

  it("§21.3.4.3 while (!$feof) on g00 never ends: the read returns 0 and cannot move past g", () => {
    const run = runCursor("garbled", "while-feof");
    expect(run.outcome).toEqual({ kind: "endless", afterChecks: 3 });
    expect(run.readCodes).toEqual([3, 2, 0]);
    expect(run.steps[run.steps.length - 1].kind).toBe("endless");
  });

  it("§21.3.4.3 forever/break on g00 stops at code 2", () => {
    expect(runCursor("garbled", "forever-break")).toMatchObject({ outcome: { kind: "count", n: 1 }, readCodes: [3, 2] });
  });

  it("§21.3.4.3 a short line misaligns a stream read but not a line read", () => {
    const stream = runCursor("short-line", "forever-break");
    expect(stream.readCodes).toEqual([3, 3, 2]);
    expect(stream.steps[stream.steps.length - 1].log).toEqual(["check 1: 01 02 0ff", "check 2: 01 00 080"]);
    const lines = runCursor("short-line", "fgets-sscanf");
    expect(lines.readCodes).toEqual([2, 3, 3]);
    expect(lines.steps[lines.steps.length - 1].log).toEqual(["line 1: 2 of 3 fields", "check 1: ff 01 100", "check 2: 80 80 100"]);
  });

  it("§21.3.1 a missing file: $fopen returns 0 and $fatal ends the run with no read", () => {
    for (const loop of CURSOR_LOOPS) {
      const run = runCursor("missing", loop.id);
      expect(run.outcome).toEqual({ kind: "fatal" });
      expect(run.readCodes).toEqual([]);
      expect(run.steps.find((s) => s.kind === "fopen")?.returns).toBe("0");
      // Only one option means "no check runs": the $fatal one, and it is the correct one.
      const opts = checkOutcomeOptions(run);
      const zero = opts.filter((o) => o.label === "0 checks" || o.label.startsWith("No checks"));
      expect(zero.map((o) => [o.label, o.correct])).toEqual([["No checks: $fatal ends the run before any read", true]]);
    }
  });

  it("§21.3.4.3 every step names a line of the generated source", () => {
    for (const f of CURSOR_FILES) {
      for (const loop of CURSOR_LOOPS) {
        const run = runCursor(f.id, loop.id);
        const keys = new Set(cursorSource(f, loop.id).map((l) => l.key));
        for (const s of run.steps) expect(keys.has(s.codeKey)).toBe(true);
      }
    }
  });

  it("§21.3.4.3 prediction options: exactly one correct, and it is the model's outcome", () => {
    for (const f of CURSOR_FILES) {
      for (const loop of CURSOR_LOOPS) {
        const run = runCursor(f.id, loop.id);
        expect(checkOutcomeOptions(run).filter((o) => o.correct)).toHaveLength(1);
        expect(staleOptions(run).filter((o) => o.correct)).toHaveLength(1);
      }
    }
  });

  it("§21.3.4.3 the $fgets line buffer is described as the string $sscanf parses, with no cursor or $feof", () => {
    const d = describeLineTape("01 02\n", [0, 5], null);
    expect(d).toBe('line, 6 characters: the string $sscanf parses, "01␠02⏎". This $sscanf call consumed "01␠02".');
    expect(d).not.toMatch(/\$feof|cursor/);
  });

  it("§21.3.8 the tape description states the cursor and $feof", () => {
    const run = runCursor("in-txt", "forever-break");
    const s = run.steps.filter((x) => x.kind === "read")[1];
    expect(describeTape("in.txt", "0a 05\nff 01\n", s)).toBe('in.txt, 12 characters. Read cursor before "⏎" (character 12 of 12). This call consumed "⏎ff␠01". $feof is 0.');
  });
});

describe("§11.4.3 / §11.4.5 / §21.2.1.3 values", () => {
  it("§11.4.3 an x operand bit makes the whole sum x", () => {
    expect(addBits("0000000x", "00000001", 9)).toBe("xxxxxxxxx");
    expect(addBits("11111111", "00000001", 9)).toBe("100000000");
  });
  it("§11.4.5 !== compares x and z bit for bit", () => {
    expect(caseNotEqual("xxxxxxxxx", "000000011")).toBe(true);
    expect(caseNotEqual("xxxxxxxxx", "xxxxxxxxx")).toBe(false);
    expect(caseNotEqual("00000011", "000000011")).toBe(false);
  });
  it("§11.4.5 != is x only when x/z bits make the relation ambiguous; a known differing bit gives 1; §12.4 if treats x as false", () => {
    expect(looseNotEqualValue("xxxxxxxxx", "000000011")).toBe("x");
    expect(looseNotEqual("xxxxxxxxx", "000000011")).toBe(false);
    expect(looseNotEqualValue("00001xxxx", "000000011")).toBe("1");
    expect(looseNotEqual("00001xxxx", "000000011")).toBe(true);
    expect(looseNotEqualValue("000000011", "00000011")).toBe("0");
    expect(looseNotEqual("000000011", "00000011")).toBe(false);
    expect(looseNotEqual("000000100", "000000011")).toBe(true);
  });
  it("§11.4.5 / §12.4 an all-x sum compared with != takes the pass branch and says why; !== catches it", () => {
    const contents = "x1 01 002\n";
    const loose = runBench({ ...GUARDED_BENCH, contents, compare: "!=" });
    expect(loose.summary).toBe("[  1 ns] PASS=1 FAIL=0");
    const step = loose.steps.find((s) => s.codeKey === "compare" && /n_pass\+\+/.test(s.what));
    expect(step?.what).toBe("sum != exp_v is x, which the if treats as false: n_pass++ (now 1).");
    expect(step?.why).toMatch(/!= returned x: .*ambiguous \(§11\.4\.5\).*treats an x condition as false \(§12\.4\)/);
    expect(runBench({ ...GUARDED_BENCH, contents, compare: "!==" }).summary).toBe("[  1 ns] PASS=0 FAIL=1");
    const known = runBench({ ...GUARDED_BENCH, contents: "01 02 003\n", compare: "!=" });
    expect(known.steps.find((s) => s.codeKey === "compare")?.why).toBe("!= compares bit for bit (§11.4.5); no bit is x or z and none differs, so it returns 0.");
  });
  it("§21.2.1.3 %h prints x, X, z and Z digits", () => {
    expect(formatHex("xxxx0101")).toBe("x5");
    expect(formatHex("x1010101")).toBe("X5");
    expect(formatHex("zzzzz101")).toBe("zZ");
    expect(formatHex("xxxxxxxxx")).toBe("xxx");
  });
});

describe("§20.10 / §20.2 the plusarg-selected, file-driven bench reproduces the lesson's summary lines", () => {
  it("§21.3.4.3 vectors.txt: [  4 ns] PASS=4 FAIL=0", () => {
    const run = benchRunFor("vectors.txt");
    expect(run.summary).toBe("[  4 ns] PASS=4 FAIL=0");
    expect(run.log[0]).toBe("vectors=vectors.txt dump=0");
    expect(run.endedBy).toBe("finish");
  });

  it("§20.10 vectors_bad.txt: one $error at 2 ns, then [  4 ns] PASS=3 FAIL=1", () => {
    const run = benchRunFor("vectors_bad.txt");
    expect(run.log).toEqual(["vectors=vectors_bad.txt dump=0", "<Error prefix, 2 ns> vector 2: ff + 01 = 100, expected 000", "[  4 ns] PASS=3 FAIL=1"]);
  });

  it("§21.3.4.3 vectors_garbled.txt: code 2, unparsable input at 1 ns, [  1 ns] PASS=1 FAIL=1", () => {
    const run = benchRunFor("vectors_garbled.txt");
    expect(run.log).toEqual(["vectors=vectors_garbled.txt dump=0", "<Error prefix, 1 ns> vector 2: unparsable input (2 of 3 fields)", "[  1 ns] PASS=1 FAIL=1"]);
  });

  it("§21.3.1 + §20.10 nope.txt: $fatal at 0 ns and no summary line", () => {
    const run = benchRunFor("nope.txt");
    expect(run.summary).toBeNull();
    expect(run.endedBy).toBe("fatal");
    expect(run.log).toEqual(["vectors=nope.txt dump=0", "<Fatal prefix, 0 ns> cannot open vector file nope.txt"]);
  });

  it("§21.3.4.3 an empty file: [  0 ns] PASS=0 FAIL=1", () => {
    const run = benchRunFor("empty.txt");
    expect(run.summary).toBe("[  0 ns] PASS=0 FAIL=1");
    expect(run.log).toContain("<Error prefix, 0 ns> no vectors in empty.txt: nothing was checked");
  });

  it("§21.6 +DUMP sets dump=1 and adds the dump step without changing the summary", () => {
    const run = benchRunFor("vectors.txt", true);
    expect(run.cmdline).toEqual(["+VECTORS=vectors.txt", "+DUMP"]);
    expect(run.log[0]).toBe("vectors=vectors.txt dump=1");
    expect(run.steps.some((s) => s.edge === "vcd")).toBe(true);
    expect(run.summary).toBe("[  4 ns] PASS=4 FAIL=0");
  });

  it("§20.4.3 %t after $timeformat(-9, 0, \" ns\", 6) is at least 6 characters", () => {
    expect(formatNs(4)).toBe("  4 ns");
    expect(formatNs(1234)).toBe("1234 ns");
  });

  it("§20.10 summary options come from the model's own runs; exactly one is correct for every file", () => {
    for (const f of BENCH_FILE_CHOICES) {
      const opts = summaryOptions(f.name, false);
      expect(opts.map((o) => o.label)).toEqual(["[  4 ns] PASS=4 FAIL=0", "[  4 ns] PASS=3 FAIL=1", "[  1 ns] PASS=1 FAIL=1", NO_SUMMARY, "[  0 ns] PASS=0 FAIL=1"]);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it("§21.3.4.3 every bench step names a line of the generated source", () => {
    for (const f of BENCH_FILE_CHOICES) {
      for (const dump of [false, true]) {
        const run = benchRunFor(f.name, dump);
        const keys = new Set(run.source.map((l) => l.key));
        for (const s of run.steps) expect(keys.has(s.codeKey)).toBe(true);
      }
    }
  });
});

describe("§21.3.1 / §21.3.8 / §20.10 debug: the log that lies", () => {
  it("§21.3.1 case 2: an unchecked $fopen gives PASS=0 FAIL=0 at 0 ns", () => {
    const run = runBench(DEBUG_CASES[0].config);
    expect(run.summary).toBe("[  0 ns] PASS=0 FAIL=0");
    expect(run.checks).toBe(0);
    expect(judgeRun(run).honesty).toBe("lies");
  });

  it("§21.3.8 case 3: while (!$feof) checks the last vector twice: check 5 repeats check 4", () => {
    const run = runBench(DEBUG_CASES[1].config);
    expect(run.log).toEqual(["vectors=vectors.txt", "check 1: 01 02 003", "check 2: ff 01 100", "check 3: 80 80 100", "check 4: 7f 01 080", "check 5: 7f 01 080", "[  5 ns] PASS=5 FAIL=0"]);
    expect(judgeRun(run).honesty).toBe("lies");
  });

  it("§20.10 case 4: $error without a counter: the error is in the log, the summary says FAIL=0", () => {
    const run = runBench(DEBUG_CASES[2].config);
    expect(run.log).toEqual(["vectors=vectors_bad.txt", "<Error prefix, 2 ns> vector 2: ff + 01 = 100, expected 000", "[  4 ns] PASS=4 FAIL=0"]);
    expect(judgeRun(run).honesty).toBe("lies");
  });

  it("§20.10 every fix's declared outcome is what the model's rerun gives; only root-cause fixes are marked so", () => {
    for (const c of DEBUG_CASES) {
      expect(c.fixes.filter((f) => f.rootCause)).toHaveLength(1);
      for (const fix of c.fixes) expect({ fix: fix.id, honesty: judgeRun(runBench(fix.config)).honesty }).toEqual({ fix: fix.id, honesty: fix.expect });
    }
  });

  it("§21.3.8 deleting the final newline makes $feof turn nonzero on the fourth read (a fix for this file only)", () => {
    const fix = DEBUG_CASES[1].fixes.find((f) => f.id === "newline");
    const run = runBench(fix!.config);
    expect(run.summary).toBe("[  4 ns] PASS=4 FAIL=0");
  });

  it("§20.10 every line of each buggy bench has diagnostic feedback; culprits are the only correct suspects", () => {
    for (const c of DEBUG_CASES) {
      const keys = [...new Set(runBench(c.config).source.map((l) => l.key).filter((k): k is string => Boolean(k)))];
      for (const k of keys) {
        const fb = suspectFeedback(c, k);
        expect(fb.correct).toBe(c.culprits.includes(k));
        expect(fb.text.length).toBeGreaterThan(20);
      }
    }
    expect(suspectFeedback(DEBUG_CASES[0], "summary").text).toMatch(/n_pass=0 and n_fail=0/);
  });

  it("§20.10 'did not even run' is said only of lines that did not run", () => {
    const [c2, c3, c4] = DEBUG_CASES;
    // Lines without steps of their own: declarations and loop structure.
    expect(suspectFeedback(c3, "echo").text).toBe("Not this line: it prints the values it was given and did what it says in this run. Ask which line makes the summary disagree with what really happened.");
    expect(suspectFeedback(c4, "loop").text).not.toMatch(/did not even run/);
    for (const c of DEBUG_CASES) expect(suspectFeedback(c, "decl").text).not.toMatch(/did not even run/);
    expect(suspectFeedback(c3, "line-no").text).not.toMatch(/did not even run/);
    expect(suspectFeedback(c3, "loop-end").text).not.toMatch(/did not even run/);
    // Case 2 checks nothing, so the loop body really did not run.
    expect(suspectFeedback(c2, "drive").text).toMatch(/did not even run here/);
    expect(suspectFeedback(c2, "line-no").text).toMatch(/did not even run here/);
    // Every line that has a step of its own is reported as run.
    for (const c of DEBUG_CASES) {
      const run = runBench(c.config);
      for (const s of run.steps) expect({ key: s.codeKey, ran: lineRan(run, s.codeKey) }).toEqual({ key: s.codeKey, ran: true });
    }
    // fd = 0: $fclose has nothing to close, and the text does not claim it closed a file.
    expect(suspectFeedback(c2, "fclose").text).toMatch(/passes fd = 0 to \$fclose.*does not define/);
  });

  it("§21.6 the role sentences read cleanly", () => {
    expect(suspectFeedback(DEBUG_CASES[1], "plusarg-vectors").text).toMatch(/^Not this line: it reads \+VECTORS and did what it says in this run\. The first log line, "vectors=vectors\.txt"/);
    expect(suspectFeedback(DEBUG_CASES[1], "config").text).toMatch(/^Not this line: it prints the configuration and did what it says in this run\./);
  });

  it("§20.10 the case 4 texts claim no more than the clause: no counter is defined for $error, and only $fatal ends the run", () => {
    const c4 = DEBUG_CASES[2];
    expect(c4.hints[2]).toBe("The standard defines no counter that $error updates; only $fatal ends the run (§20.10).");
    expect(suspectFeedback(c4, "error").text).toMatch(/The standard defines no counter that \$error updates \(§20\.10\)/);
    for (const t of [...c4.hints, suspectFeedback(c4, "error").text]) expect(t).not.toMatch(/never touches|does not touch/);
  });

  it("§21.3.1 case 2 states how the visual's run differs from the lesson's snippet, from the model's own run", () => {
    const run = runBench(DEBUG_CASES[0].config);
    const note = debugCaseNote(DEBUG_CASES[0]);
    expect(note).toContain(run.cmdline.join(" "));
    expect(note).toContain(run.summary as string);
    expect(note).toContain('$fopen("vectros.txt", "r")');
    expect(debugCaseNote(DEBUG_CASES[1])).toBeNull();
  });
});
