import { describe, expect, it } from "vitest";

import {
  VC_CFG_CYCLES,
  VC_ITEMS,
  runCoordination,
  vseqSource,
  type CoordConfig,
  type VseqVariant,
} from "@/lib/vseq-coordination-model";

const run = (variant: VseqVariant, over: Partial<CoordConfig> = {}) => runCoordination({ variant, reset: false, resetHandling: "none", ...over });

describe("vseq-coordination-model: ordering between agents", () => {
  it("cfg_seq then data_seq: every item reaches a configured DUT", () => {
    const r = run("sequential");
    expect(r.outcome).toBe("pass");
    const firstDrive = Math.min(...r.items.map((i) => i.driven ?? Infinity));
    expect(firstDrive).toBe(1 + VC_CFG_CYCLES);
  });

  it("fork cfg | data join: data sent before CTRL.EN = 1 is dropped by the DUT and reported MISSING", () => {
    const r = run("fork-join");
    expect(r.outcome).toBe("missing");
    expect(r.items.filter((i) => i.fate === "dropped-en").map((i) => i.name)).toEqual(["D0", "D1", "D2", "D3"]);
    expect(r.why).toMatch(/configure first/);
  });

  it("fork with a uvm_event (wait_on) keeps the data thread behind the config thread", () => {
    expect(run("fork-event").outcome).toBe("pass");
  });
});

describe("vseq-coordination-model: termination (IEEE 1800-2023 §9.3.2 join semantics)", () => {
  it("fork…join with a never-ending background branch never returns: PH_TIMEOUT at the 9200 s default", () => {
    const r = run("background-join");
    expect(r.outcome).toBe("hang");
    expect(r.bodyEnd).toBeNull();
    expect(r.errors[0]).toEqual({ t: "9200 s", id: "PH_TIMEOUT", text: "Default timeout of 9200s hit, indicating a probable testbench issue" });
  });

  it("join_any returns when the config thread finishes, and the run ends while data_seq is still sending", () => {
    const r = run("background-join-any");
    expect(r.bodyEnd).toBe(5);
    expect(r.outcome).toBe("count");
    expect(r.items.filter((i) => i.fate === "cut")).toHaveLength(1);
  });

  it("join_none returns at once: the test drops its objection and nothing is ever sent", () => {
    const r = run("background-join-none");
    expect(r.bodyEnd).toBe(1);
    expect(r.items.every((i) => i.fate === "cut")).toBe(true);
    expect(r.errors.find((e) => e.id === "SCB/COUNT")?.text).toBe(`only 0 of ${VC_ITEMS} planned items were sent`);
  });

  it("background traffic in its own fork…join_none, foreground in fork…join: passes", () => {
    expect(run("background-isolated").outcome).toBe("pass");
  });
});

describe("vseq-coordination-model: passive agent", () => {
  it("a sequence started on a passive agent's null sequencer fatals at its first start_item (uvm_sequence_base.svh)", () => {
    const r = run("passive-irq-seq");
    expect(r.outcome).toBe("fatal");
    expect(r.fatalAt).toBe(11);
    expect(r.errors[0].id).toBe("SEQ");
    expect(r.errors[0].text).toMatch(/^neither the item's sequencer nor dedicated sequencer has been supplied/);
  });
});

describe("vseq-coordination-model: reset in the middle of traffic", () => {
  it("ignoring reset: in-flight items are discarded and later items hit an unconfigured DUT", () => {
    const r = run("sequential", { reset: true, resetHandling: "none" });
    expect(r.outcome).toBe("missing");
    expect(r.items.filter((i) => i.fate === "dropped-reset").map((i) => i.name)).toEqual(["D1", "D2", "D3", "D4"]);
    expect(r.items.find((i) => i.name === "D5")!.fate).toBe("dropped-en");
  });

  it("flushing the scoreboard accounts for in-flight items but not for data sent after reset", () => {
    const r = run("sequential", { reset: true, resetHandling: "flush" });
    expect(r.items.filter((i) => i.fate === "flushed").map((i) => i.name)).toEqual(["D1", "D2"]);
    expect(r.outcome).toBe("missing");
  });

  it("flush + restart: the vseq reconfigures, then sends only the remaining items", () => {
    const r = run("sequential", { reset: true, resetHandling: "restart" });
    expect(r.outcome).toBe("pass");
    expect(r.items.find((i) => i.name === "D3")!.driven).toBe(14);
    expect(r.cycles[10].apb).toBe("SRC");
  });
});

describe("vseq-coordination-model: generated code", () => {
  it("declarations come before the first statement in body()", () => {
    const lines = vseqSource("fork-event").map((l) => l.text.trim());
    const decl = lines.findIndex((l) => l.startsWith("uvm_event"));
    const firstStatement = lines.findIndex((l) => l.includes("::type_id::create") || l.startsWith("fork"));
    expect(decl).toBeGreaterThan(0);
    expect(decl).toBeLessThan(firstStatement);
  });

  it("the isolated fix forks the background sequence with join_none before the foreground join", () => {
    const text = vseqSource("background-isolated").map((l) => l.text.trim());
    expect(text.indexOf("join_none")).toBeGreaterThan(-1);
    expect(text.indexOf("join_none")).toBeLessThan(text.lastIndexOf("join"));
  });
});
