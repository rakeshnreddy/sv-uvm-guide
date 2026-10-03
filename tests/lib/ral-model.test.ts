import { describe, expect, it } from "vitest";

import {
  ACCESS_POLICIES,
  AUTO_PREDICT_ENV,
  DEFAULT_UVM_ENV,
  EXPLICIT_ENV,
  I2C_BLOCK,
  RAL_CHALLENGES,
  TRAFFIC,
  TRAFFIC_KINDS,
  applyOp,
  busWriteCount,
  challengeAnswer,
  checkMask,
  countErrors,
  dutReadField,
  effectiveAccess,
  fieldConfigureLine,
  fieldIsCompared,
  fieldNeedsUpdate,
  initialState,
  mirroredChoices,
  parseRegValue,
  predictReadValue,
  predictWriteValue,
  predictionPath,
  regNeedsUpdate,
  regValue,
  runOps,
  runPredictionProbes,
  setDesiredValue,
  showHex,
  updateWriteValue,
  uvmHex,
  withFieldConfig,
  withPolicyLab,
  type AccessPolicy,
  type RalEnv,
  type RalOp,
} from "@/lib/ral-model";

const B = I2C_BLOCK;
const mirrored = (run: ReturnType<typeof runOps>, reg: string) => regValue(B, run.final, reg, "mirrored");
const desired = (run: ReturnType<typeof runOps>, reg: string) => regValue(B, run.final, reg, "desired");
const dut = (run: ReturnType<typeof runOps>, reg: string) => regValue(B, run.final, reg, "dut");

describe("access policies (uvm_reg_field.svh m_predefine_policies, XpredictX)", () => {
  it("defines exactly the 25 predefined policies; NOACCESS is not configurable", () => {
    expect(ACCESS_POLICIES).toHaveLength(25);
    expect(ACCESS_POLICIES as readonly string[]).not.toContain("NOACCESS");
  });

  // (access, current mirror, written) → predicted mirror, 8-bit field. Each row is the XpredictX case.
  const table: [AccessPolicy, number, number, number][] = [
    ["RW", 0x0f, 0xa5, 0xa5],
    ["RO", 0x0f, 0xa5, 0x0f],
    ["WO", 0x0f, 0xa5, 0xa5],
    ["RC", 0x0f, 0xa5, 0x0f],
    ["RS", 0x0f, 0xa5, 0x0f],
    ["WRC", 0x0f, 0xa5, 0xa5],
    ["WRS", 0x0f, 0xa5, 0xa5],
    ["WC", 0x0f, 0xa5, 0x00],
    ["WS", 0x0f, 0xa5, 0xff],
    ["WSRC", 0x0f, 0x00, 0xff],
    ["WCRS", 0x0f, 0xff, 0x00],
    ["W1C", 0x0f, 0x05, 0x0a],
    ["W1S", 0x0f, 0x50, 0x5f],
    ["W1T", 0x0f, 0x11, 0x1e],
    ["W0C", 0x0f, 0xfe, 0x0e],
    ["W0S", 0x0f, 0xef, 0x1f],
    ["W0T", 0x0f, 0xfe, 0x0e],
    ["W1SRC", 0x01, 0x10, 0x11],
    ["W1CRS", 0x11, 0x10, 0x01],
    ["W0SRC", 0x01, 0xef, 0x11],
    ["W0CRS", 0x11, 0xef, 0x01],
    ["WOC", 0x0f, 0xa5, 0x00],
    ["WOS", 0x0f, 0x00, 0xff],
  ];
  it.each(table)("%s: mirror %i, write %i → %i", (access, cur, wr, expected) => {
    expect(predictWriteValue(access, cur, wr, 8, false)).toBe(expected);
  });

  it("W1 and WO1: only the first write after a hard reset takes effect (m_written)", () => {
    expect(predictWriteValue("W1", 0x00, 0x3c, 8, false)).toBe(0x3c);
    expect(predictWriteValue("W1", 0x3c, 0xff, 8, true)).toBe(0x3c);
    expect(predictWriteValue("WO1", 0x3c, 0xff, 8, true)).toBe(0x3c);
  });

  it("predicted read (do_predict UVM_PREDICT_READ): RC family → 0, RS family → all ones, WO family → no update", () => {
    for (const a of ["RC", "WRC", "WSRC", "W1SRC", "W0SRC"] as const) expect(predictReadValue(a, 0x5a, 8)).toBe(0);
    for (const a of ["RS", "WRS", "WCRS", "W1CRS", "W0CRS"] as const) expect(predictReadValue(a, 0x5a, 8)).toBe(0xff);
    for (const a of ["WO", "WOC", "WOS", "WO1", "NOACCESS"] as const) expect(predictReadValue(a, 0x5a, 8)).toBeNull();
    expect(predictReadValue("RO", 0x5a, 8)).toBe(0x5a);
    expect(predictReadValue("W1C", 0x5a, 8)).toBe(0x5a);
  });

  it("get_access(map) narrows the policy by the map's rights", () => {
    expect(effectiveAccess("W1C", "RO")).toBe("RO");
    expect(effectiveAccess("WRC", "RO")).toBe("RC");
    expect(effectiveAccess("WO", "RO")).toBe("NOACCESS");
    expect(effectiveAccess("RW", "WO")).toBe("WO");
    expect(effectiveAccess("W1SRC", "WO")).toBe("W1S");
    expect(effectiveAccess("RO", "WO")).toBe("NOACCESS");
    expect(effectiveAccess("W1T", "RW")).toBe("W1T");
  });

  it("set() models the write's effect on the desired value (W1C clears, RO keeps)", () => {
    expect(setDesiredValue("RW", 0x00, 0x5, 8, false)).toBe(0x5);
    expect(setDesiredValue("RO", 0x3, 0xff, 8, false)).toBe(0x3);
    expect(setDesiredValue("W1C", 0x3, 0x1, 8, false)).toBe(0x2);
    expect(setDesiredValue("W1T", 0x3, 0x1, 8, false)).toBe(0x2);
    expect(setDesiredValue("WC", 0x3, 0x1, 8, false)).toBe(0x0);
  });

  it("XupdateX: W1C writes ~desired, W1T writes desired ^ mirrored", () => {
    expect(updateWriteValue("W1C", 0x0, 0x1, 1)).toBe(0x1);
    expect(updateWriteValue("W1T", 0x6, 0x3, 4)).toBe(0x5);
    expect(updateWriteValue("RW", 0x5, 0x0, 4)).toBe(0x5);
  });

  it("needs_update(): never for RO/RC/RS; (mirrored != desired) | volatile otherwise", () => {
    expect(fieldNeedsUpdate("RO", 1, 0, false)).toBe(false);
    expect(fieldNeedsUpdate("RC", 1, 0, true)).toBe(false);
    expect(fieldNeedsUpdate("RW", 1, 1, false)).toBe(false);
    expect(fieldNeedsUpdate("RW", 1, 0, false)).toBe(true);
    expect(fieldNeedsUpdate("W1C", 0, 0, true)).toBe(true);
  });

  it("DUT read: RC clears after returning the value; write-only fields read as 0", () => {
    expect(dutReadField("RC", 5, 8)).toEqual({ returned: 5, next: 0 });
    expect(dutReadField("RS", 0, 4)).toEqual({ returned: 0, next: 0xf });
    expect(dutReadField("WO", 0x42, 8)).toEqual({ returned: 0, next: 0x42 });
  });

  it("do_check() compares only UVM_CHECK fields whose access does not start with WO", () => {
    expect(fieldIsCompared("RW", "UVM_CHECK")).toBe(true);
    expect(fieldIsCompared("RO", "UVM_NO_CHECK")).toBe(false);
    expect(fieldIsCompared("WOC", "UVM_CHECK")).toBe(false);
  });
});

describe("configure() and the block", () => {
  it("volatile=1 gives the field UVM_NO_CHECK (uvm_reg_field::configure m_check)", () => {
    const s = initialState(B);
    expect(s.regs.STATUS.every((f) => f.compare === "UVM_NO_CHECK")).toBe(true);
    expect(s.regs.CTRL.every((f) => f.compare === "UVM_CHECK")).toBe(true);
    expect(checkMask(B, s, "STATUS")).toBe(0);
    expect(checkMask(B, s, "CTRL")).toBe(0xffffffff);
    expect(checkMask(B, s, "TX_DATA")).toBe(0);
  });

  it("generates the 9-argument configure() call", () => {
    const busy = B.regs[1].fields[0];
    expect(fieldConfigureLine(busy)).toBe('BUSY.configure(this, 1, 0, "RO", 1, 1\'h0, 1, 0, 0);');
  });

  it("reset values concatenate per field (STATUS.TX_EMPTY resets to 1)", () => {
    expect(regValue(B, initialState(B), "STATUS", "mirrored")).toBe(0x2);
  });
});

describe("frontdoor write and prediction (uvm_reg::write/do_write, uvm_reg_predictor::write)", () => {
  it("explicit predictor: writing all ones to CTRL predicts 0x0000_000F (RSVD is RO)", () => {
    const run = runOps(B, EXPLICIT_ENV, [{ kind: "write", reg: "CTRL", value: 0xffffffff }]);
    expect(mirrored(run, "CTRL")).toBe(0xf);
    expect(dut(run, "CTRL")).toBe(0xf);
    expect(run.steps[0].predictions.map((p) => p.source)).toEqual(["uvm_reg_predictor"]);
  });

  it("write() calls set() first, so get() returns the policy-adjusted value even when nothing predicts", () => {
    const run = runOps(B, DEFAULT_UVM_ENV, [{ kind: "write", reg: "CTRL", value: 0x5 }]);
    expect(desired(run, "CTRL")).toBe(0x5);
    expect(mirrored(run, "CTRL")).toBe(0x0);
    expect(dut(run, "CTRL")).toBe(0x5);
    expect(run.steps[0].predictions).toHaveLength(0);
  });

  it("auto-predict is off by default (uvm_reg_map::new) — DEFAULT_UVM_ENV has no prediction path", () => {
    expect(DEFAULT_UVM_ENV.autoPredict).toBe(false);
    expect(DEFAULT_UVM_ENV.predictor).toBe("absent");
  });

  it("implicit prediction (set_auto_predict(1)) predicts RAL writes with the frontdoor door", () => {
    const run = runOps(B, AUTO_PREDICT_ENV, [{ kind: "write", reg: "CTRL", value: 0xffffffff }]);
    expect(mirrored(run, "CTRL")).toBe(0xf);
    expect(run.steps[0].predictions).toEqual([{ source: "auto-predict", kind: "UVM_PREDICT_WRITE", value: 0xffffffff }]);
  });

  it("a predictor whose bus_in was never connected leaves a stale mirror, with no error at all", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, predictor: "unconnected" };
    const run = runOps(B, env, [{ kind: "write", reg: "CTRL", value: 0x5 }]);
    expect(mirrored(run, "CTRL")).toBe(0);
    expect(dut(run, "CTRL")).toBe(5);
    expect(run.steps[0].messages).toHaveLength(0);
    expect(run.steps[0].why).toMatch(/never connected/);
  });

  it("auto-predict cannot see writes from another initiator; an explicit predictor can", () => {
    const fw: RalOp = { kind: "busWrite", reg: "CTRL", value: 0x9, initiator: "firmware" };
    const auto = runOps(B, AUTO_PREDICT_ENV, [fw]);
    expect(mirrored(auto, "CTRL")).toBe(0);
    expect(dut(auto, "CTRL")).toBe(9);
    const explicit = runOps(B, EXPLICIT_ENV, [fw]);
    expect(mirrored(explicit, "CTRL")).toBe(9);
    expect(desired(explicit, "CTRL")).toBe(9);
  });

  it("predictor + auto-predict predict one write twice: a W1T toggle cancels out in the mirror", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, autoPredict: true };
    const run = runOps(B, env, [{ kind: "write", reg: "GPIO", value: 0x1 }]);
    expect(run.steps[0].predictions.map((p) => p.source)).toEqual(["uvm_reg_predictor", "auto-predict"]);
    expect(dut(run, "GPIO")).toBe(0x1);
    expect(mirrored(run, "GPIO")).toBe(0x0);
    expect(run.steps[0].why).toMatch(/twice/);
  });

  it("double prediction is harmless for idempotent policies (RW)", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, autoPredict: true };
    const run = runOps(B, env, [{ kind: "write", reg: "CTRL", value: 0x5 }]);
    expect(mirrored(run, "CTRL")).toBe(dut(run, "CTRL"));
  });

  it("a null predictor.adapter is UVM_FATAL REG/WRITE/NULL and ends the run", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, predictorAdapterSet: false };
    const run = runOps(B, env, [
      { kind: "write", reg: "CTRL", value: 0x5 },
      { kind: "write", reg: "CTRL", value: 0x6 },
    ]);
    expect(run.steps[0].messages[0]).toMatchObject({ severity: "UVM_FATAL", id: "REG/WRITE/NULL", text: "write: adapter handle is null" });
    expect(run.steps[1].noEffect).toBe(true);
    expect(dut(run, "CTRL")).toBe(5);
  });

  it("W1C write of 'hFF after the mirror learned 'h3 predicts 0", () => {
    const run = runOps(B, EXPLICIT_ENV, [
      { kind: "hw", reg: "INT_STATUS", field: "DONE", value: 1 },
      { kind: "hw", reg: "INT_STATUS", field: "ERR", value: 1 },
      { kind: "read", reg: "INT_STATUS" },
      { kind: "write", reg: "INT_STATUS", value: 0xff },
    ]);
    expect(run.steps[2].after.regs.INT_STATUS.map((f) => f.mirrored)).toEqual([1, 1]);
    expect(mirrored(run, "INT_STATUS")).toBe(0);
    expect(dut(run, "INT_STATUS")).toBe(0);
  });
});

describe("set() / update() (uvm_reg::update, uvm_reg_field::needs_update)", () => {
  it("set() changes only the desired value: no bus, mirror and DUT unchanged", () => {
    const run = runOps(B, EXPLICIT_ENV, [{ kind: "set", reg: "CTRL", value: 0x5 }]);
    expect(desired(run, "CTRL")).toBe(5);
    expect(mirrored(run, "CTRL")).toBe(0);
    expect(dut(run, "CTRL")).toBe(0);
    expect(run.steps[0].bus).toBeNull();
  });

  it("update() writes only when desired != mirrored: set(5); update(); set(5); update() is one bus write", () => {
    const run = runOps(B, EXPLICIT_ENV, [
      { kind: "set", reg: "CTRL", value: 0x5 },
      { kind: "update", reg: "CTRL" },
      { kind: "set", reg: "CTRL", value: 0x5 },
      { kind: "update", reg: "CTRL" },
    ]);
    expect(busWriteCount(run.steps)).toBe(1);
    expect(run.steps[3].noEffect).toBe(true);
    expect(run.steps[3].why).toMatch(/needs_update\(\) is 0/);
  });

  it("without prediction the second update() writes again, because the mirror never caught up", () => {
    const run = runOps(B, DEFAULT_UVM_ENV, [
      { kind: "set", reg: "CTRL", value: 0x5 },
      { kind: "update", reg: "CTRL" },
      { kind: "update", reg: "CTRL" },
    ]);
    expect(busWriteCount(run.steps)).toBe(2);
  });

  it("a volatile writable field always needs an update, so update() writes even when nothing changed", () => {
    expect(regNeedsUpdate(B, initialState(B), "INT_STATUS")).toBe(true);
    expect(regNeedsUpdate(B, initialState(B), "STATUS")).toBe(false);
    const run = runOps(B, EXPLICIT_ENV, [{ kind: "update", reg: "INT_STATUS" }]);
    expect(run.steps[0].bus).toMatchObject({ kind: "WRITE", data: 0x3 });
    expect(run.steps[0].why).toMatch(/volatile/);
  });

  it("update() on a W1C field writes ~desired, which clears the bits the DUT has set", () => {
    const run = runOps(B, EXPLICIT_ENV, [
      { kind: "hw", reg: "INT_STATUS", field: "DONE", value: 1 },
      { kind: "read", reg: "INT_STATUS" },
      { kind: "set", reg: "INT_STATUS", value: 0x1 },
      { kind: "update", reg: "INT_STATUS" },
    ]);
    expect(run.steps[2].after.regs.INT_STATUS[0].desired).toBe(0);
    expect(dut(run, "INT_STATUS")).toBe(0);
    expect(mirrored(run, "INT_STATUS")).toBe(0);
  });
});

describe("read() and mirror() (uvm_reg::do_read, uvm_reg::mirror, do_check)", () => {
  it("RC read: rdata is the old value, the DUT clears, and the prediction is 0", () => {
    const run = runOps(B, EXPLICIT_ENV, [
      { kind: "hw", reg: "NACK_CNT", field: "COUNT", value: 5 },
      { kind: "read", reg: "NACK_CNT" },
    ]);
    expect(run.steps[1].returned?.value).toBe(5);
    expect(mirrored(run, "NACK_CNT")).toBe(0);
    expect(dut(run, "NACK_CNT")).toBe(0);
  });

  it("mirror(UVM_CHECK) compares against the mirror captured before the read and prints the do_check_error text", () => {
    const block = withFieldConfig(B, "STATUS", "BUSY", { volatile: false });
    const run = runOps(block, EXPLICIT_ENV, [
      { kind: "hw", reg: "STATUS", field: "BUSY", value: 1 },
      { kind: "mirror", reg: "STATUS", check: true },
    ]);
    const msgs = run.steps[1].messages.filter((m) => m.severity !== "UVM_INFO" || m.id === "RegModel");
    expect(msgs[0]).toEqual({
      severity: "UVM_ERROR",
      id: "RegModel",
      text: `Register "ral.STATUS" value read from DUT (0x${uvmHex(3)}) does not match mirrored value (0x${uvmHex(2)}) (valid bit mask = 0x${uvmHex(1)})`,
    });
    expect(msgs[1].text).toBe("Field BUSY (ral.STATUS[0:0]) mismatch read=1'h1 mirrored=1'h0");
    // The predictor still updates the mirror from the read.
    expect(regValue(block, run.final, "STATUS", "mirrored")).toBe(0x3);
  });

  it("a volatile field is skipped by mirror(UVM_CHECK) unless set_compare(UVM_CHECK)", () => {
    const quiet = runOps(B, EXPLICIT_ENV, [
      { kind: "hw", reg: "STATUS", field: "BUSY", value: 1 },
      { kind: "mirror", reg: "STATUS", check: true },
    ]);
    expect(countErrors(quiet.steps)).toBe(0);
    const loud = runOps(B, EXPLICIT_ENV, [
      { kind: "setCompare", reg: "STATUS", field: "BUSY", check: true },
      { kind: "hw", reg: "STATUS", field: "BUSY", value: 1 },
      { kind: "mirror", reg: "STATUS", check: true },
    ]);
    expect(countErrors(loud.steps)).toBe(1);
  });

  it("frontdoor mirror() does not refresh the mirror when nothing predicts reads", () => {
    const run = runOps(B, DEFAULT_UVM_ENV, [
      { kind: "write", reg: "CTRL", value: 0x5 },
      { kind: "mirror", reg: "CTRL", check: false },
      { kind: "mirror", reg: "CTRL", check: true },
    ]);
    expect(mirrored(run, "CTRL")).toBe(0);
    expect(countErrors(run.steps)).toBe(1);
  });

  it("write-only fields are never predicted on read and never compared", () => {
    const run = runOps(B, EXPLICIT_ENV, [
      { kind: "write", reg: "TX_DATA", value: 0x42 },
      { kind: "mirror", reg: "TX_DATA", check: true },
    ]);
    expect(run.steps[1].bus?.data).toBe(0);
    expect(mirrored(run, "TX_DATA")).toBe(0x42);
    expect(countErrors(run.steps)).toBe(0);
  });

  it("provides_responses = 0 with read data in a separate response: read() returns 0, auto-predict copies 0, the predictor sees the real value", () => {
    const setup: RalOp[] = [{ kind: "hw", reg: "NACK_CNT", field: "COUNT", value: 3 }, { kind: "read", reg: "NACK_CNT" }];
    const auto = runOps(B, { ...AUTO_PREDICT_ENV, readDataFromRequest: true }, [{ kind: "write", reg: "CTRL", value: 0x5 }, { kind: "read", reg: "CTRL" }, ...setup]);
    expect(auto.steps[1].returned?.value).toBe(0);
    expect(mirrored(auto, "CTRL")).toBe(0);
    const explicit = runOps(B, { ...EXPLICIT_ENV, readDataFromRequest: true }, [{ kind: "write", reg: "CTRL", value: 0x5 }, { kind: "read", reg: "CTRL" }]);
    expect(explicit.steps[1].returned?.value).toBe(0);
    expect(mirrored(explicit, "CTRL")).toBe(5);
  });
});

describe("backdoor peek/poke and predict() (uvm_reg::poke/peek/predict)", () => {
  it("poke() deposits the raw value (policies ignored) and predicts it itself — no predictor needed", () => {
    const run = runOps(B, DEFAULT_UVM_ENV, [{ kind: "poke", reg: "CTRL", value: 0xffffffff }]);
    expect(dut(run, "CTRL")).toBe(0xffffffff);
    expect(mirrored(run, "CTRL")).toBe(0xffffffff);
    expect(desired(run, "CTRL")).toBe(0xffffffff);
    expect(run.steps[0].bus).toBeNull();
    expect(run.steps[0].predictions).toEqual([{ source: "backdoor do_predict", kind: "UVM_PREDICT_WRITE", value: 0xffffffff }]);
  });

  it("peek() returns the DUT value without RC side effects and syncs the mirror", () => {
    const run = runOps(B, DEFAULT_UVM_ENV, [
      { kind: "hw", reg: "NACK_CNT", field: "COUNT", value: 7 },
      { kind: "peek", reg: "NACK_CNT" },
    ]);
    expect(run.steps[1].returned?.value).toBe(7);
    expect(dut(run, "NACK_CNT")).toBe(7);
    expect(mirrored(run, "NACK_CNT")).toBe(7);
  });

  it("peek/poke without an HDL path: UVM_ERROR, UVM_NOT_OK, nothing changes", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, hdlPath: false };
    const step = applyOp(B, env, initialState(B), { kind: "poke", reg: "CTRL", value: 3 });
    expect(step.status).toBe("UVM_NOT_OK");
    expect(step.messages[0].text).toBe("No backdoor access available to poke register 'ral.CTRL'");
    expect(regValue(B, step.after, "CTRL", "dut")).toBe(0);
    const peek = applyOp(B, env, initialState(B), { kind: "peek", reg: "CTRL" });
    expect(peek.messages[0].text).toBe('No backdoor access available to peek register "ral.CTRL"');
  });

  it("predict() defaults to UVM_PREDICT_DIRECT: mirror and desired take the value, no policy, DUT untouched", () => {
    const run = runOps(B, EXPLICIT_ENV, [{ kind: "predict", reg: "INT_STATUS", value: 0x1 }]);
    expect(mirrored(run, "INT_STATUS")).toBe(1);
    expect(desired(run, "INT_STATUS")).toBe(1);
    expect(dut(run, "INT_STATUS")).toBe(0);
  });

  it("reset() resets the model only", () => {
    const run = runOps(B, EXPLICIT_ENV, [{ kind: "write", reg: "CTRL", value: 5 }, { kind: "reset" }]);
    expect(mirrored(run, "CTRL")).toBe(0);
    expect(dut(run, "CTRL")).toBe(5);
  });
});

describe("policy lab register", () => {
  it.each(["RW", "RO", "WO", "W1C", "W1S", "RC", "RS", "WC", "WS", "W1T"] as AccessPolicy[])("%s: the frontdoor mirror tracks the DUT through write and read", (access) => {
    const block = withPolicyLab(B, access, false, 0x0f);
    const run = runOps(block, EXPLICIT_ENV, [
      { kind: "write", reg: "LAB", value: 0x3c },
      { kind: "read", reg: "LAB" },
    ]);
    const m = regValue(block, run.final, "LAB", "mirrored");
    const d = regValue(block, run.final, "LAB", "dut");
    if (access === "WO") expect(m).toBe(0x3c);
    else expect(m).toBe(d);
  });
});

describe("challenges (graded by the model)", () => {
  const expected: Record<string, string> = {
    "ro-bits": showHex(0xf),
    w1c: showHex(0),
    "update-twice": "1",
    volatile: "ok:1",
    poke: showHex(0xffffffff),
    "rc-read": "5:0:0",
    "default-env": "5:0",
  };
  it.each(RAL_CHALLENGES.map((c) => [c.id, c] as const))("%s has exactly one correct option, the expected one", (id, ch) => {
    const { answer } = challengeAnswer(B, ch);
    expect(answer).toBe(expected[id]);
    expect(ch.options.filter((o) => o.answer === answer)).toHaveLength(1);
  });
});

describe("generated prediction choices", () => {
  it("offers the correct mirror plus misconception values with diagnostic feedback", () => {
    const step = applyOp(B, EXPLICIT_ENV, initialState(B), { kind: "write", reg: "CTRL", value: 0xffffffff });
    const choices = mirroredChoices(B, step);
    expect(choices.find((c) => c.correct)?.value).toBe(0xf);
    const naive = choices.find((c) => c.value === 0xffffffff);
    expect(naive?.correct).toBe(false);
    expect(naive?.feedback).toMatch(/access policy/);
    expect(choices.some((c) => c.value === 0)).toBe(true);
  });
});

describe("prediction path beats", () => {
  it("names the predictor path explicitly and flags the missing connection", () => {
    const env: RalEnv = { ...EXPLICIT_ENV, predictor: "unconnected" };
    const step = applyOp(B, env, initialState(B), { kind: "write", reg: "CTRL", value: 5 });
    const beats = predictionPath(B, env, step);
    const pred = beats.find((b) => b.id === "pred");
    expect(pred?.tone).toBe("error");
    expect(pred?.what).toMatch(/never connected/);
    expect(beats.find((b) => b.id === "auto")?.what).toMatch(/Auto-predict is off \(the default\)/);
  });

  it("auto-predict beat appears only for RAL-initiated accesses", () => {
    const step = applyOp(B, AUTO_PREDICT_ENV, initialState(B), { kind: "busWrite", reg: "CTRL", value: 9 });
    const auto = predictionPath(B, AUTO_PREDICT_ENV, step).find((b) => b.id === "auto");
    expect(auto?.tone).toBe("skip");
    expect(auto?.what).toMatch(/never sees this write/);
  });
});

describe("debug probes", () => {
  it("missing connect(): RAL and firmware writes leave a stale mirror", () => {
    const probes = runPredictionProbes(B, { ...EXPLICIT_ENV, predictor: "unconnected" });
    expect(probes.map((p) => p.ok)).toEqual([false, false, false]);
  });
  it("connected predictor, auto-predict off: every probe passes", () => {
    expect(runPredictionProbes(B, EXPLICIT_ENV).every((p) => p.ok)).toBe(true);
  });
  it("auto-predict alone: RAL traffic passes, firmware traffic is missed", () => {
    expect(runPredictionProbes(B, AUTO_PREDICT_ENV).map((p) => p.ok)).toEqual([true, false, true]);
  });
  it("both paths: the W1T probe fails from double prediction", () => {
    const probes = runPredictionProbes(B, { ...EXPLICIT_ENV, autoPredict: true });
    expect(probes.map((p) => p.ok)).toEqual([true, true, false]);
    expect(probes[2].note).toMatch(/twice/);
  });
  it("adding mirror() after each write does not help without a prediction path", () => {
    const probes = runPredictionProbes(B, { ...EXPLICIT_ENV, predictor: "unconnected" }, (reg) => [{ kind: "mirror", reg, check: false }]);
    expect(probes[0].ok).toBe(false);
  });
});

describe("formatting and parsing", () => {
  it("formats register and UVM values", () => {
    expect(showHex(0xf)).toBe("0x0000_000F");
    expect(uvmHex(0x5)).toBe("0000000000000005");
  });
  it("parses hex input and rejects garbage or values wider than the register", () => {
    expect(parseRegValue("'hFF")).toBe(0xff);
    expect(parseRegValue("0xFFFF_FFFF")).toBe(0xffffffff);
    expect(parseRegValue("'d10")).toBe(10);
    expect(parseRegValue("hello")).toBeNull();
    expect(parseRegValue("1FFFFFFFF")).toBeNull();
  });
});

describe("prediction experiment coverage", () => {
  it("every (auto-predict × predictor × traffic) combination offers at least two distinct mirror values to predict", () => {
    for (const autoPredict of [false, true]) {
      for (const predictor of ["connected", "unconnected", "absent"] as const) {
        for (const kind of TRAFFIC_KINDS) {
          const env: RalEnv = { ...EXPLICIT_ENV, autoPredict, predictor };
          const step = applyOp(B, env, initialState(B), TRAFFIC[kind].op);
          const choices = mirroredChoices(B, step);
          expect(choices.length, `${autoPredict}/${predictor}/${kind}`).toBeGreaterThan(1);
          expect(choices.filter((c) => c.correct)).toHaveLength(1);
        }
      }
    }
  });
});
