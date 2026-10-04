import { describe, expect, it } from "vitest";

import {
  DEFAULT_CB_CONFIG,
  DRIVERS,
  callbackSource,
  cbAdd,
  cbCallbackMode,
  cbDelete,
  cbIterate,
  cbQueueFor,
  emptyCallbackState,
  runCallbackScenario,
  type CbConfig,
} from "@/lib/uvm-callback-model";

const [D0, D1] = DRIVERS;
const scenario = (over: Partial<CbConfig>) => runCallbackScenario({ ...DEFAULT_CB_CONFIG, ...over });

describe("uvm-callback-model: registration rules (uvm-core src/base/uvm_callback.svh)", () => {
  it("add(null, cb) is type-wide: every instance without its own queue runs it (m_get_q falls back to the type-wide queue)", () => {
    const s = cbAdd(emptyCallbackState(), null, "a").state;
    expect(cbIterate(s, D0)).toEqual(["a"]);
    expect(cbIterate(s, D1)).toEqual(["a"]);
    expect(cbQueueFor(s, D0).source).toBe("type-wide");
  });

  it("the first instance add copies the type-wide queue, then appends (uvm_callbacks::add)", () => {
    let s = cbAdd(emptyCallbackState(), null, "log").state;
    s = cbAdd(s, D0, "err").state;
    expect(cbQueueFor(s, D0)).toEqual({ source: "instance", queue: ["log", "err"] });
    expect(cbIterate(s, D1)).toEqual(["log"]);
  });

  it("UVM_PREPEND puts the callback in front of earlier ones", () => {
    let s = cbAdd(emptyCallbackState(), null, "log").state;
    s = cbAdd(s, D0, "err", "UVM_PREPEND").state;
    expect(cbIterate(s, D0)).toEqual(["err", "log"]);
  });

  it("a type-wide add after an instance queue exists is also appended to that queue (m_add_tw_cbs)", () => {
    let s = cbAdd(emptyCallbackState(), D0, "err").state;
    s = cbAdd(s, null, "log").state;
    expect(cbIterate(s, D0)).toEqual(["err", "log"]);
    expect(cbIterate(s, D1)).toEqual(["log"]);
  });

  it("adding the same callback twice warns CBPREG and does not duplicate it", () => {
    let s = cbAdd(emptyCallbackState(), D0, "err").state;
    const again = cbAdd(s, D0, "err");
    s = again.state;
    expect(again.message?.id).toBe("CBPREG");
    expect(cbIterate(s, D0)).toEqual(["err"]);
  });

  it("callback_mode(0) is a property of the callback object: iteration skips it in every queue; it returns the previous mode", () => {
    let s = cbAdd(emptyCallbackState(), null, "err").state;
    s = cbAdd(s, D0, "log").state;
    const off = cbCallbackMode(s, "err", 0);
    expect(off.previous).toBe(true);
    expect(cbIterate(off.state, D0)).toEqual(["log"]);
    expect(cbIterate(off.state, D1)).toEqual([]);
    expect(cbCallbackMode(off.state, "err", 1).previous).toBe(false);
  });

  it("delete(null, cb) removes it from the type-wide queue and every instance queue; a miss warns CBUNREG", () => {
    let s = cbAdd(emptyCallbackState(), null, "log").state;
    s = cbAdd(s, D0, "err").state;
    s = cbDelete(s, null, "log").state;
    expect(cbIterate(s, D0)).toEqual(["err"]);
    expect(cbIterate(s, D1)).toEqual([]);
    expect(cbDelete(s, D1, "err").message?.id).toBe("CBUNREG");
  });
});

describe("uvm-callback-model: when the add() runs (top-down build)", () => {
  it("test build_phase: env.agt0 is still null, so reading env.agt0.drv is a null-object access (IEEE 1800-2023 §8.4)", () => {
    const r = scenario({ location: "test-build", target: "handle" });
    expect(r.outcome).toBe("null-access");
    expect(r.fatal?.text).toMatch(/env\.agt0 is null/);
    expect(r.runs).toHaveLength(0);
  });

  it("env build_phase: agt0 exists but agt0.drv is null, so add() silently registers type-wide and BOTH drivers corrupt", () => {
    const r = scenario({ location: "env-build", target: "handle" });
    expect(r.handleValue).toBe("null");
    expect(r.outcome).toBe("both");
    expect(r.queues.every((q) => q.source === "type-wide" && q.queue.includes("err_cb"))).toBe(true);
  });

  it("add_by_name during build finds no component: CBNOMTC warning and nothing registered", () => {
    const r = scenario({ location: "env-build", target: "by-name" });
    expect(r.addMessage?.id).toBe("CBNOMTC");
    expect(r.outcome).toBe("neither");
  });

  it.each(["env-connect", "test-connect", "test-eoe"] as const)("%s: the real handle reaches only agt0's instance queue", (location) => {
    const r = scenario({ location, target: "handle" });
    expect(r.outcome).toBe("only-agt0");
    expect(r.queues.find((q) => q.driver === D1)!.queue).not.toContain("err_cb");
  });

  it("add(null, …) is type-wide wherever it is called", () => {
    expect(scenario({ location: "test-eoe", target: "null" }).outcome).toBe("both");
  });
});

describe("uvm-callback-model: order and callback_mode at run time", () => {
  it("APPEND after a type-wide log_cb: log_cb runs first and logs the ORIGINAL crc", () => {
    const r = scenario({ location: "test-connect", ordering: "UVM_APPEND", logCb: "base-build" });
    expect(r.agt0Order).toEqual(["log_cb", "err_cb"]);
    expect(r.runs[0].executed[0].effect).toBe("logs crc=0x5A");
    expect(r.runs[0].crcOut).toBe(0xa5);
  });

  it("PREPEND puts err_cb first, so log_cb logs the corrupted crc", () => {
    const r = scenario({ location: "test-connect", ordering: "UVM_PREPEND", logCb: "base-build" });
    expect(r.agt0Order).toEqual(["err_cb", "log_cb"]);
    expect(r.runs[0].executed[1].effect).toBe("logs crc=0xA5");
  });

  it("a type-wide log_cb registered later (start_of_simulation) lands after err_cb in agt0's queue", () => {
    expect(scenario({ location: "test-connect", logCb: "start-of-sim" }).agt0Order).toEqual(["err_cb", "log_cb"]);
  });

  it("callback_mode(0) at 20 ns stops corruption on the second packet for every driver that had it", () => {
    const r = scenario({ location: "env-build", disableAt20ns: true });
    expect(r.runs.filter((x) => x.packet === 1).every((x) => x.corrupted)).toBe(true);
    expect(r.runs.filter((x) => x.packet === 2).some((x) => x.corrupted)).toBe(false);
  });

  it("the code panel shows the exact add() call the model evaluated", () => {
    const text = callbackSource({ ...DEFAULT_CB_CONFIG, location: "env-build" }).map((l) => l.text).join("\n");
    expect(text).toContain("uvm_callbacks#(my_driver, drv_cb)::add(agt0.drv, err_cb);");
    expect(callbackSource({ ...DEFAULT_CB_CONFIG, ordering: "UVM_PREPEND", location: "test-connect" }).find((l) => l.key === "add")!.text).toContain(
      "add(env.agt0.drv, err_cb, UVM_PREPEND)",
    );
  });
});
