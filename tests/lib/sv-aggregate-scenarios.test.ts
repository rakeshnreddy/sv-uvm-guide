import { describe, expect, it } from "vitest";

import {
  enumMemberReadout,
  enumName,
  formatH,
  formatSizedHex,
  hexAligned,
  memberRanges,
  readMember,
  readUnionPath,
  setMemberWidth,
  structBits,
  svHex,
  unionProblems,
  unionWidth,
  writeUnionPath,
} from "@/lib/sv-aggregate-layout-model";
import {
  CLINIC_FIXES,
  CLINIC_SCENARIOS,
  CMD_U,
  LESSON_BUS_WORD,
  PKT_HDR_T,
  STRUCT_PRESETS,
  TAGGED_READ_PREDICTION,
  UNION_PRESETS,
  VINT,
  VINT_THIRD_MEMBER,
  clinicScenario,
  currentVarName,
  runStructStatements,
  runWholeAction,
  structPreset,
  taggedAssignStatement,
  taggedAssignValue,
  unionPreset,
  type ClinicScenario,
  type FixId,
} from "@/lib/sv-aggregate-scenarios";

const correctOf = (options: readonly { correct: boolean; label: string }[]) => {
  const correct = options.filter((o) => o.correct);
  expect(correct).toHaveLength(1);
  return correct[0].label;
};

describe("struct presets: one per lesson use, each prediction agreeing with the model", () => {
  it("lists the seven presets named in the spec and defaults to cmd_t", () => {
    expect(STRUCT_PRESETS.map((p) => p.id)).toEqual(["cmd_t", "ctrl_reg_t", "frame_t", "pkt_hdr_t", "reversed", "narrow-assign", "enum-field"]);
    expect(structPreset().id).toBe("cmd_t");
    expect(structPreset("nonsense").id).toBe("cmd_t");
    for (const p of STRUCT_PRESETS) expect(structBits(p.members), p.id).toBe(32);
  });

  it("cmd_t: op[31:28], addr[27:16], data[15:0] and three gated statements", () => {
    const p = structPreset("cmd_t");
    expect(memberRanges(p.members).map((r) => `${r.name}[${r.hi}:${r.lo}]`)).toEqual(["op[31:28]", "addr[27:16]", "data[15:0]"]);
    expect(p.statements.every((s) => s.prediction)).toBe(true);
    // Step 1: c.op after c = 32'h5ABC_0042.
    const c1 = runStructStatements(p, 1);
    expect(correctOf(p.statements[0].prediction!.options)).toBe(formatSizedHex(readMember(p.members, c1, "op")));
    expect(p.statements[0].prediction!.options.find((o) => o.label === "4'h2")!.feedback).toMatch(/C bit-fields/);
    // Step 2: the whole value after c.addr = 12'h0FF.
    const c2 = runStructStatements(p, 2);
    expect(correctOf(p.statements[1].prediction!.options)).toBe(formatSizedHex(c2));
    // Step 3: op and addr after c = 16'hBEEF.
    const c3 = runStructStatements(p, 3);
    expect(correctOf(p.statements[2].prediction!.options)).toBe(`op = ${formatSizedHex(readMember(p.members, c3, "op"))}, addr = ${formatSizedHex(readMember(p.members, c3, "addr"))}`);
    expect(p.statements[2].prediction!.options.find((o) => o.id === "error")!.feedback).toMatch(/§6\.22\.3/);
  });

  it("ctrl_reg_t: the three writes give the lesson's 32'h0000_0641", () => {
    const p = structPreset("ctrl_reg_t");
    expect(formatSizedHex(runStructStatements(p, 3))).toBe("32'h0000_0641");
    expect(memberRanges(p.members).map((r) => `${r.name}${r.hi}:${r.lo}`)).toEqual(["rsvd31:16", "prescale15:12", "thresh11:4", "mode3:2", "irq_en1:1", "en0:0"]);
    // The gated question is the register after the thresh write.
    expect(correctOf(p.statements[2].prediction!.options)).toBe(formatSizedHex(runStructStatements(p, 3)));
  });

  it("ctrl_reg_t: ctrl = '0 is a fill literal, so a width edit neither truncates nor extends it (§5.7.1)", () => {
    const p = structPreset("ctrl_reg_t");
    const action = p.statements[0].action;
    expect(action).toMatchObject({ kind: "whole", fill: true });
    if (action.kind !== "whole") throw new Error("expected a whole-vector action");
    const narrow = setMemberWidth(p.members, "rsvd", 4);
    const a = runWholeAction(narrow, action);
    expect(a.value.width).toBe(20);
    expect(a.extendedFrom).toBeUndefined();
    expect(a.droppedFrom).toBeUndefined();
    expect(a.note).toMatch(/fill literal/);
  });

  it("frame_t: the interview question's correct option is the top byte", () => {
    const p = structPreset("frame_t");
    const f = runStructStatements(p, 1);
    expect(correctOf(p.statements[0].prediction!.options)).toBe(formatSizedHex(readMember(p.members, f, "hdr")));
    expect(correctOf(p.statements[0].prediction!.options)).toBe("8'hAB");
  });

  it("pkt_hdr_t: hdr prints 4540cafe, rx decodes to PKT_PING / 1 / 255, and kind and seq share a hex digit", () => {
    const p = structPreset("pkt_hdr_t");
    // The kata declares `pkt_hdr_t hdr, rx;`: statement 1 writes hdr, statement 2 writes rx, and the strip's name follows.
    expect(p.varName).toBe("hdr");
    expect(p.statements[0].code).toMatch(/^hdr = /);
    expect(p.statements[1]).toMatchObject({ varName: "rx" });
    expect([currentVarName(p, 0), currentVarName(p, 1), currentVarName(p, 2)]).toEqual(["hdr", "hdr", "rx"]);
    const hdr = runStructStatements(p, 1);
    expect(formatH(hdr)).toBe("4540cafe");
    expect(correctOf(p.statements[0].prediction!.options)).toBe(formatH(hdr));
    const rx = runStructStatements(p, 2);
    expect(formatH(rx)).toBe("c1ff0000");
    const kind = enumMemberReadout(PKT_HDR_T, rx, "kind");
    expect(kind.name).toBe("PKT_PING");
    expect(formatSizedHex(readMember(PKT_HDR_T, rx, "seq"))).toBe("6'h01");
    expect(formatSizedHex(readMember(PKT_HDR_T, rx, "len"))).toBe("8'hFF");
    expect(memberRanges(PKT_HDR_T).map((r) => hexAligned(PKT_HDR_T, r.name))).toEqual([false, false, true, true]);
  });

  it("reversed addr/data re-reads 32'h5ABC_0042 as data = ABC0 and addr = 042, and asks about addr first", () => {
    const p = structPreset("reversed");
    const c = runStructStatements(p, 1);
    expect(formatSizedHex(readMember(p.members, c, "data"))).toBe("16'hABC0");
    expect(formatSizedHex(readMember(p.members, c, "addr"))).toBe("12'h042");
    expect(correctOf(p.statements[0].prediction!.options)).toBe(formatSizedHex(readMember(p.members, c, "addr")));
  });

  it("narrow assign zero-extends 16'hBEEF, and asks what op and addr read first", () => {
    const p = structPreset("narrow-assign");
    const c = runStructStatements(p, 1);
    expect(formatSizedHex(c)).toBe("32'h0000_BEEF");
    expect(correctOf(p.statements[0].prediction!.options)).toBe(`op = ${formatSizedHex(readMember(p.members, c, "op"))}, addr = ${formatSizedHex(readMember(p.members, c, "addr"))}`);
  });

  it("before any statement a preset's variable is its Table 6-7 default: all x for these 4-state types", () => {
    for (const p of STRUCT_PRESETS) expect(formatSizedHex(runStructStatements(p, 0)), p.id).toBe("32'hxxxx_xxxx");
  });

  it("the enum's own write note keeps the explicit-cast exception of §6.19.3", () => {
    const note = structPreset("enum-field").statements[1].note ?? "";
    expect(note).toMatch(/without an explicit cast, only a value of the enum type gets in \(§6\.19\.3\)/);
  });


  it("enum field: the whole-vector write stores a non-member opcode, so name() is \"\"; a member write is type-checked", () => {
    const p = structPreset("enum-field");
    const c1 = runStructStatements(p, 1);
    const readout = enumMemberReadout(p.members, c1, "op");
    expect(readout.name).toBe("");
    expect(correctOf(p.statements[0].prediction!.options)).toBe('"" (empty string)');
    const c2 = runStructStatements(p, 2);
    expect(enumMemberReadout(p.members, c2, "op").name).toBe("OP_WRITE");
  });

  it("every prediction option has feedback and exactly one correct answer", () => {
    for (const p of STRUCT_PRESETS) {
      for (const s of p.statements) {
        if (!s.prediction) continue;
        correctOf(s.prediction.options);
        for (const o of s.prediction.options) expect(o.feedback.length, `${p.id}: ${o.label}`).toBeGreaterThan(20);
      }
    }
  });

  it("a statement that names its own variable writes the whole value, so nothing of the previous variable carries over", () => {
    for (const p of STRUCT_PRESETS) {
      for (const s of p.statements) {
        if (!s.varName) continue;
        expect(s.action.kind, `${p.id}: ${s.code}`).not.toBe("member");
        expect(s.code.startsWith(`${s.varName} = `), `${p.id}: ${s.code}`).toBe(true);
      }
      for (const s of p.statements.filter((x) => !x.varName)) expect(s.code.startsWith(p.varName), `${p.id}: ${s.code}`).toBe(true);
    }
  });
});

/**
 * The frame's summary and the typedef label are on screen above the gate, so
 * neither may state the answer to the first prediction: not its value, and not
 * the rule that decides it.
 */
describe("the header does not give away a prediction", () => {
  const OUTCOME_RULES = /most significant|first member|right-justif|zero-extend|zero-fill|silent|share.{0,12}digit|stores|returns|leaves|bit 0|top \d+ bits|empty/i;
  const answerTokens = (label: string) => Array.from(label.matchAll(/\d+'h([0-9A-Fa-f_]+)/g)).flatMap((m) => [m[1], m[1].replace(/_/g, "")]);
  const gated = [
    ...STRUCT_PRESETS.map((p) => ({ id: p.id, summary: p.summary, source: p.source, prediction: p.statements.find((s) => s.prediction)?.prediction })),
    ...UNION_PRESETS.map((p) => ({ id: p.id, summary: p.summary, source: p.source, prediction: p.statements.find((s) => s.prediction)?.prediction })),
  ];

  it("every lesson-facing preset has a prediction", () => {
    expect(gated.filter((p) => !p.prediction).map((p) => p.id)).toEqual([]);
  });

  it.each(gated.map((p) => [p.id, p] as const))("%s", (_, p) => {
    const header = `${p.summary} ${p.source}`;
    expect(header).not.toMatch(OUTCOME_RULES);
    const correct = p.prediction!.options.find((o) => o.correct)!;
    for (const token of answerTokens(correct.label)) expect(header).not.toMatch(new RegExp(`\\b${token}\\b`, "i"));
    if (!/\d+'h/.test(correct.label) && !correct.label.startsWith('"')) expect(header).not.toContain(correct.label);
  });
});

describe("union presets", () => {
  it("cmd_u is hard packed with equal 32-bit members; word_u and nest_u are soft", () => {
    expect(unionPreset().id).toBe("cmd_u");
    expect(unionProblems(CMD_U)).toEqual([]);
    expect(unionWidth(CMD_U)).toBe(32);
    expect(unionPreset("word_u").union.packing).toBe("soft");
    expect(unionPreset("nest_u").summary).toMatch(/not the standard's Figure 7-1/);
  });

  it("cmd_u: the prediction's correct option matches u.f.addr and u.bytes[3] after the raw write", () => {
    const p = unionPreset("cmd_u");
    const s = p.statements[0];
    const u = writeUnionPath(p.union, svHex(32, "0"), s.path, s.value).value;
    const label = `${formatSizedHex(readUnionPath(p.union, u, "f.addr"))} and ${formatSizedHex(readUnionPath(p.union, u, "bytes[3]"))}`;
    expect(correctOf(s.prediction!.options)).toBe(label);
  });

  it("word_u: the prediction's correct option matches w.word after both writes (§7.3.1)", () => {
    const p = unionPreset("word_u");
    let w = svHex(32, "0");
    for (const s of p.statements) w = writeUnionPath(p.union, w, s.path, s.value).value;
    expect(correctOf(p.statements[1].prediction!.options)).toBe(formatSizedHex(readUnionPath(p.union, w, "word")));
    expect(correctOf(p.statements[1].prediction!.options)).toBe("32'hAAAA_1234");
  });

  it("nest_u: the nested write lands at bit 0 of the whole union", () => {
    const p = unionPreset("nest_u");
    let n = svHex(12, "0");
    for (const s of p.statements) n = writeUnionPath(p.union, n, s.path, s.value).value;
    expect(correctOf(p.statements[1].prediction!.options)).toBe(formatSizedHex(readUnionPath(p.union, n, "a")));
  });

  it("the narrowing control targets a vector member of each preset", () => {
    for (const p of UNION_PRESETS) {
      const m = p.union.members.find((x) => x.id === p.narrowMember);
      expect(m?.shape.kind, p.id).toBe("vector");
    }
  });
});

describe("tagged preset", () => {
  it("a button's statement is the log's statement, in the same radix", () => {
    expect(taggedAssignStatement(VINT_THIRD_MEMBER)).toBe("v = tagged Small (8'hA5);");
    expect(taggedAssignValue(VINT_THIRD_MEMBER)).toBe(0xa5);
    expect(VINT.members.map(taggedAssignStatement)).toEqual(["v = tagged Invalid;", "v = tagged Valid (23);"]);
    expect(VINT.members.map(taggedAssignValue)).toEqual([undefined, 23]);
  });

  it("VInt is the standard's example; the third member is ours and 8 bits wide", () => {
    expect(VINT.members.map((m) => m.name)).toEqual(["Invalid", "Valid"]);
    expect(VINT_THIRD_MEMBER).toMatchObject({ name: "Small", width: 8 });
  });

  it("the read prediction is 'legal' when the tag matches, a run-time error for another defined tag, and undefined before any assignment (§11.9)", () => {
    expect(correctOf(TAGGED_READ_PREDICTION("v.Valid", "Valid").options)).toBe("Legal: prints the value");
    expect(correctOf(TAGGED_READ_PREDICTION("v.Valid", "Invalid").options)).toBe("Run-time error: the tag is another member");
    // §11.9 defines the run-time error only for a read inconsistent with a defined tag; an uninitialized union, tag included, is undefined.
    const undefinedRead = TAGGED_READ_PREDICTION("v.Valid", null);
    expect(correctOf(undefinedRead.options)).toBe("Undefined: never assigned, no defined result (§11.9)");
    expect(undefinedRead.options.find((o) => o.id === "error")!.feedback).toMatch(/no defined result rather than a defined error/);
    expect(TAGGED_READ_PREDICTION("v.Valid", "Valid").options.find((o) => o.id === "undefined")!.feedback).toMatch(/the read is legal/);
  });
});

describe("debug clinic: the model regenerates the log, so a wrong fix keeps the symptom", () => {
  const fixIds = CLINIC_FIXES.map((f) => f.id);

  it("has the five scenarios of the spec plus the struct back-door variant of the empty name, each with three hints, one suspect line and one correct cause", () => {
    expect(CLINIC_SCENARIOS.map((s) => s.id)).toEqual(["swapped-fields", "idle-without-reset", "empty-name", "empty-name-struct", "two-typedefs", "rand-packed-member"]);
    expect(clinicScenario().id).toBe("swapped-fields");
    for (const s of CLINIC_SCENARIOS) {
      expect(s.hints).toHaveLength(3);
      expect(s.suspectKeys.length).toBeGreaterThan(0);
      for (const key of s.suspectKeys) expect(s.lines.map((l) => l.key)).toContain(key);
      correctOf(s.causes);
      expect(fixIds).toContain(s.correctFix);
      for (const f of fixIds) {
        expect(s.fixFeedback[f], `${s.id}/${f}`).toBeTruthy();
        expect(s.fixCode[f], `${s.id}/${f}`).toBeTruthy();
      }
      for (const l of s.lines) expect(l.whenPicked.length, `${s.id}/${l.key}`).toBeGreaterThan(10);
    }
  });

  it("as found, every scenario shows its symptom; only the correct fix removes it", () => {
    for (const s of CLINIC_SCENARIOS) {
      expect(s.run(null).fixed, `${s.id} as found`).toBe(false);
      for (const f of fixIds) expect(s.run(f).fixed, `${s.id} with ${f}`).toBe(f === s.correctFix);
    }
  });

  const logOf = (s: ClinicScenario, fix: FixId | null) => s.run(fix).log.join("\n");

  it("swapped fields: op reads f and data 2123 until the members are reordered (§7.2.1)", () => {
    const s = clinicScenario("swapped-fields");
    // Wrong order data, addr, op: op reads [3:0] = f, addr reads [15:4] = bee, data reads [31:16] = 2123.
    expect(logOf(s, null)).toMatch(/op = f, addr = bee, data = 2123/);
    expect(logOf(s, null)).toMatch(/MISMATCH/);
    expect(logOf(s, "reorder")).toMatch(/op = 2, addr = 123, data = beef/);
    expect(logOf(s, "logic-base")).toMatch(/MISMATCH/);
    expect(LESSON_BUS_WORD).toBe("32'h2123_BEEF");
  });

  it("IDLE without reset: the int base starts at 0 = IDLE; a logic base starts at x with an empty name (Table 6-7)", () => {
    const s = clinicScenario("idle-without-reset");
    expect(logOf(s, null)).toMatch(/state\.name\(\) = "IDLE" \(value 0\)/);
    expect(logOf(s, "logic-base")).toMatch(/state\.name\(\) = "" \(value 'bxx\)/);
    expect(logOf(s, "reorder")).toMatch(/state\.name\(\) = "IDLE"/);
  });

  it("IDLE without reset: the post-edge line comes from the code shown, so nothing moves to RUN and x stays x (§6.19.5.6)", () => {
    const s = clinicScenario("idle-without-reset");
    expect(logOf(s, null)).not.toMatch(/RUN/);
    expect(logOf(s, "logic-base")).not.toMatch(/RUN/);
    expect(logOf(s, null)).toMatch(/@10 posedge clk: rst_n = 1, so nothing assigns state; state\.name\(\) = "IDLE"/);
    expect(logOf(s, "logic-base")).toMatch(/@10 posedge clk: rst_n = 1, so nothing assigns state; state\.name\(\) = "" \(value 'bxx\)/);
  });

  it("empty name: the static cast stores 7; $cast rejects it and leaves op unchanged (§6.19.4, §6.24.2)", () => {
    const s = clinicScenario("empty-name");
    expect(logOf(s, null)).toMatch(/op = $/m);
    expect(logOf(s, "cast-check")).toMatch(/ERROR: bad opcode 7 \(\$cast returned 0\)/);
    expect(logOf(s, "cast-check")).toMatch(/op = OP_NOP \(unchanged\)/);
    expect(enumName).toBeTypeOf("function");
  });

  it("empty name: the fix gives op a known default before the $cast, since a failed $cast does not assign and op would otherwise stay x (§6.24.2, Table 6-7)", () => {
    const code = clinicScenario("empty-name").fixCode["cast-check"];
    expect(code.indexOf("op = OP_NOP;")).toBeGreaterThanOrEqual(0);
    expect(code.indexOf("op = OP_NOP;")).toBeLessThan(code.indexOf("$cast"));
    expect(clinicScenario("empty-name").fixFeedback["cast-check"]).toMatch(/known default/);
  });

  it("no scenario's log gives away the root cause before the prediction: the rand log is a short diagnostic", () => {
    const s = clinicScenario("rand-packed-member");
    const log = logOf(s, null);
    expect(log).not.toMatch(/unpacked/);
    expect(log).not.toMatch(/class/);
    expect(log).toMatch(/rand not allowed on this member/);
    expect(s.run(null).verdict).toMatch(/legal only within an unpacked structure/);
  });

  it("rand-whole: the verdict names what the fix does; the unpacked rule is not why it now compiles", () => {
    const { verdict, fixed } = clinicScenario("rand-packed-member").run("rand-whole");
    expect(fixed).toBe(true);
    expect(verdict).not.toMatch(/unpacked/);
    expect(verdict).toMatch(/still packed/);
    expect(verdict).toMatch(/rand as a whole/);
  });

  it("each scenario's fix snippets name its own types, so the right fix cannot be found by matching names", () => {
    for (const s of CLINIC_SCENARIOS) {
      const text = Object.values(s.fixCode);
      expect(new Set(text).size, s.id).toBeGreaterThan(1);
    }
    expect(clinicScenario("idle-without-reset").fixCode["rand-whole"]).toMatch(/st_e/);
    expect(clinicScenario("two-typedefs").fixCode["rand-whole"]).toMatch(/cmd_rec_t/);
    expect(clinicScenario("two-typedefs").fixCode["cast-check"]).toMatch(/mon\.rec/);
  });

  it("titles name the symptom, not the cause", () => {
    expect(clinicScenario("empty-name-struct").title).not.toMatch(/back door|struct/i);
    expect(clinicScenario("rand-packed-member").title).not.toMatch(/packed/i);
  });

  it("empty name via the struct back door: the whole-vector write stores 7 in op; $cast on the decoded field reports it (derived from §7.2.1, §6.24.2)", () => {
    const s = clinicScenario("empty-name-struct");
    expect(s.suspectKeys).toEqual(["l5"]);
    expect(s.lines.find((l) => l.key === "l5")!.text).toMatch(/^cmd = bus_word;/);
    expect(logOf(s, null)).toMatch(/\[mon\] op = , addr = abc, data = 0042/);
    expect(s.run(null).verdict).toMatch(/not a member of opcode_e.*derived from §7\.2\.1/);
    expect(logOf(s, "cast-check")).toMatch(/ERROR: bad opcode 7 \(\$cast returned 0\)/);
    expect(logOf(s, "cast-check")).toMatch(/op = OP_NOP \(unchanged\), addr = abc, data = 0042/);
    expect(s.fixCode["cast-check"]).toMatch(/\$cast\(cmd\.op, bus_word\[31:28\]\)/);
    expect(logOf(s, "logic-base")).toMatch(/op = , addr/);
    expect(logOf(s, "reorder")).toMatch(/op = , addr/);
  });

  it("two typedefs: a compile error until one typedef lives in a package (§6.22.1)", () => {
    const s = clinicScenario("two-typedefs");
    expect(logOf(s, null)).toMatch(/compile error.*incompatible types: mon\.cmd_rec_t to scb\.cmd_rec_t/);
    expect(logOf(s, "package-typedef")).toMatch(/compile: ok/);
    expect(logOf(s, "cast-check")).toMatch(/compile error/);
  });

  it("two typedefs: both typedef lines count as the suspect and each names the other; the citation is §6.22.1 (d), not §6.22.2 (b)", () => {
    const s = clinicScenario("two-typedefs");
    expect(s.suspectKeys).toEqual(["l2", "l5"]);
    expect(s.lines.find((l) => l.key === "l2")!.whenPicked).toMatch(/one of the two, with line 5.*§6\.22\.1 d/);
    expect(s.lines.find((l) => l.key === "l5")!.whenPicked).toMatch(/one of the two, with line 2.*§6\.22\.1 d/);
    const cited = [...s.lines.map((l) => l.whenPicked), ...s.causes.map((c) => c.feedback), s.run(null).verdict].join(" ");
    expect(cited).not.toMatch(/§6\.22\.2 \(?b\)?/);
  });

  it("rand on a packed member: a compile error until rand moves to the whole struct in a class (Syntax 7-1 footnote 20)", () => {
    const s = clinicScenario("rand-packed-member");
    expect(logOf(s, null)).toMatch(/compile error: rand logic \[3:0\] op;/);
    expect(s.run(null).verdict).toMatch(/footnote 20/);
    expect(logOf(s, "rand-whole")).toMatch(/randomize\(\) returned 1/);
  });
});
