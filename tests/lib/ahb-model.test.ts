import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  AHB_PRESETS,
  HBURST_CODE,
  HTRANS_CODE,
  buildPrediction,
  burstAddresses,
  checkBurst,
  evaluateAhbProperty,
  getPreset,
  lessonFigure,
  simulateAhb,
  toWaveDrom,
  wrapBoundaryBytes,
  type AhbConfig,
  type AhbPresetId,
  type AhbTrace,
  type LessonFigureId,
} from "@/lib/ahb-model";

// All section numbers refer to Arm IHI0033B.b (AMBA 5 AHB, AHB5 and AHB-Lite).

const run = (id: AhbPresetId, patch: Partial<AhbConfig> = {}) => {
  const preset = getPreset(id);
  return simulateAhb(preset.build({ ...preset.defaults, ...patch }));
};
const beat = (t: AhbTrace, label: string) => {
  const b = t.beats.find((x) => x.label === label);
  if (!b) throw new Error(`no beat ${label}`);
  return b;
};
const clone = (t: AhbTrace): AhbTrace => ({ cycles: t.cycles.map((c) => ({ ...c, cancelled: [...c.cancelled] })), beats: t.beats });

describe("encodings", () => {
  it("HTRANS follows §3.2 Table 3-1", () => {
    expect(HTRANS_CODE).toEqual({ IDLE: 0, BUSY: 1, NONSEQ: 2, SEQ: 3 });
  });
  it("HBURST follows §3.5 Table 3-3", () => {
    expect(HBURST_CODE).toEqual({ SINGLE: 0, INCR: 1, WRAP4: 2, INCR4: 3, WRAP8: 4, INCR8: 5, WRAP16: 6, INCR16: 7 });
  });
});

describe("burst address math (§3.5)", () => {
  it("§3.5: a WRAP4 of words from 0x34 is 0x34, 0x38, 0x3C, 0x30", () => {
    expect(burstAddresses(0x34, "WRAP4", 2)).toEqual([0x34, 0x38, 0x3c, 0x30]);
    expect(wrapBoundaryBytes("WRAP4", 2)).toBe(16);
  });
  it("§3.5 Figure 3-10: a WRAP8 of words wraps at 32 bytes, 0x3C is followed by 0x20", () => {
    expect(burstAddresses(0x34, "WRAP8", 2)).toEqual([0x34, 0x38, 0x3c, 0x20, 0x24, 0x28, 0x2c, 0x30]);
  });
  it("§3.5 Figure 3-9: an INCR4 does not wrap at 16 bytes, 0x3C is followed by 0x40", () => {
    expect(burstAddresses(0x38, "INCR4", 2)).toEqual([0x38, 0x3c, 0x40, 0x44]);
    expect(wrapBoundaryBytes("INCR4", 2)).toBeNull();
  });
  it("§3.5 Figure 3-11: an INCR8 of halfwords from 0x34 increments by two", () => {
    expect(burstAddresses(0x34, "INCR8", 1)).toEqual([0x34, 0x36, 0x38, 0x3a, 0x3c, 0x3e, 0x40, 0x42]);
  });
  it("§3.5 Figure 3-12: an undefined-length INCR of three words from 0x5C", () => {
    expect(burstAddresses(0x5c, "INCR", 2, 3)).toEqual([0x5c, 0x60, 0x64]);
  });
});

describe("burst legality (§3.4, §3.5)", () => {
  it("§3.5: an INCR4 of words from 0x3F4 crosses the 1KB boundary; from 0x3F0 it does not", () => {
    expect(checkBurst(0x3f4, "INCR4", 2).issues.map((i) => i.rule)).toEqual(["1kb"]);
    expect(checkBurst(0x3f0, "INCR4", 2).legal).toBe(true);
  });
  it("§3.5: the 1KB rule is for incrementing bursts; a WRAP4 at 0x3F8 stays inside 0x3F0-0x3FF and is legal", () => {
    const c = checkBurst(0x3f8, "WRAP4", 2);
    expect(c.addresses).toEqual([0x3f8, 0x3fc, 0x3f0, 0x3f4]);
    expect(c.legal).toBe(true);
  });
  it("§3.5: an undefined-length INCR is also bound by the 1KB rule", () => {
    expect(checkBurst(0x3f0, "INCR", 2, 8).legal).toBe(false);
  });
  it("§3.5: every transfer must be aligned to its size", () => {
    expect(checkBurst(0x42, "SINGLE", 2).issues.map((i) => i.rule)).toEqual(["alignment"]);
    expect(checkBurst(0x42, "SINGLE", 1).legal).toBe(true);
  });
  it("§3.4: HSIZE must not exceed the data bus width (32-bit bus in this model)", () => {
    expect(checkBurst(0x40, "SINGLE", 3).issues.map((i) => i.rule)).toContain("size");
  });
});

describe("pipeline and wait states (§3.1)", () => {
  it("with zero waits, B's address phase overlaps A's data phase", () => {
    const t = run("pipeline");
    expect(beat(t, "A").acceptEdge).toBe(1);
    expect(beat(t, "B").firstAddrCycle).toBe(2);
    expect(beat(t, "A").dataCycles).toEqual([2]);
    expect(beat(t, "B").acceptEdge).toBe(2);
    expect(beat(t, "B").completeEdge).toBe(3);
  });

  it("§3.1: a wait state on A extends A's data phase AND B's address phase", () => {
    const t = run("wait");
    expect(beat(t, "A").dataCycles).toEqual([2, 3]);
    expect(beat(t, "B").firstAddrCycle).toBe(2);
    expect(beat(t, "B").acceptEdge).toBe(3);
    expect(beat(t, "B").completeEdge).toBe(4);
  });

  it("the HREADY-low cycle coincides with A's data phase, while B sits on the address bus", () => {
    const t = run("wait");
    const low = t.cycles.filter((c) => c.hready === 0);
    expect(low).toHaveLength(1);
    expect(low[0].dataBeat).toBe("A");
    expect(low[0].addrBeat).toBe("B");
    expect(low[0].hresp).toBe("OKAY"); // §5.1.2: wait states use OKAY
  });

  it("§6.1.1: the master holds write data for the whole waited data phase", () => {
    const t = run("wait", { waitsA: 2 });
    expect(beat(t, "A").dataCycles.map((k) => t.cycles[k].hwdata)).toEqual(["A", "A", "A"]);
  });

  it("each extra wait state on A delays B's data by one edge", () => {
    expect(beat(run("wait", { waitsA: 0 }), "B").completeEdge).toBe(3);
    expect(beat(run("wait", { waitsA: 3 }), "B").completeEdge).toBe(6);
  });

  it("§6.1.2: read data is only valid in the cycle that completes with OKAY (Figure 3-3)", () => {
    const t = run("read");
    const a = beat(t, "A");
    expect(a.dataCycles).toEqual([2, 3, 4]);
    expect(a.dataCycles.map((k) => t.cycles[k].hrdata)).toEqual([null, null, "A"]);
  });
});

describe("BUSY (§3.2, §3.6.1)", () => {
  it("Figure 3-6: NONSEQ, BUSY, SEQ, SEQ, SEQ with a wait on the third beat", () => {
    const t = run("busy");
    expect(t.cycles.map((c) => c.htrans)).toEqual(["IDLE", "NONSEQ", "BUSY", "SEQ", "SEQ", "SEQ", "SEQ", "IDLE", "IDLE"]);
    expect(["A0", "A1", "A2", "A3"].map((l) => beat(t, l).completeEdge)).toEqual([2, 4, 6, 7]);
  });

  it("§3.2: BUSY carries the next beat's address and gets a zero-wait OKAY that the slave ignores", () => {
    const t = run("busy");
    const busy = t.cycles.find((c) => c.htrans === "BUSY");
    expect(busy?.haddr).toBe(0x24);
    const busyData = t.cycles.find((c) => c.dataPhase === "busy");
    expect(busyData).toMatchObject({ hready: 1, hresp: "OKAY", hrdata: null, completed: null });
  });

  it("§3.6.1 Figure 3-14: a waited BUSY may change to SEQ; the flawed stability check calls it a violation", () => {
    const t = run("busy", { waitsA0: 2 });
    const k = t.cycles.findIndex((c) => c.htrans === "BUSY");
    expect(t.cycles[k].hready).toBe(0);
    expect(t.cycles[k + 1]).toMatchObject({ htrans: "SEQ", haddr: 0x24 });
    expect(evaluateAhbProperty("busy-in-wait", t).failures).toHaveLength(0);
    expect(evaluateAhbProperty("busy-in-wait", t).vacuous).toBe(false);
    expect(evaluateAhbProperty("hold-naive", t).failures.map((f) => f.edge)).toEqual([k]);
  });

  it("§3.6.1: a waited BUSY of a fixed-length burst may not jump to a new address", () => {
    const t = clone(run("busy", { waitsA0: 2 }));
    const k = t.cycles.findIndex((c) => c.htrans === "BUSY");
    t.cycles[k + 1] = { ...t.cycles[k + 1], haddr: 0x28 };
    expect(evaluateAhbProperty("busy-in-wait", t).failures).toHaveLength(1);
  });
});

describe("two-cycle ERROR (§5.1.3, Table 5-2) and cancellation (§3.5.2)", () => {
  it("Figure 5-1: OKAY wait, then ERROR with HREADY low, then ERROR with HREADY high", () => {
    const t = run("error");
    const a = beat(t, "A");
    expect(a.dataCycles.map((k) => [t.cycles[k].hresp, t.cycles[k].hready])).toEqual([
      ["OKAY", 0],
      ["ERROR", 0],
      ["ERROR", 1],
    ]);
    expect(a.resp).toBe("ERROR");
  });

  it("§3.5.2/§5.1.3: a cancelling master drives IDLE in the second ERROR cycle and B is never accepted", () => {
    const t = run("error", { errorPolicy: "cancel" });
    const second = t.cycles.find((c) => c.dataPhase === "error2");
    expect(second?.htrans).toBe("IDLE");
    expect(beat(t, "B")).toMatchObject({ status: "cancelled", acceptEdge: null });
  });

  it("§3.5.2: a master may instead continue; B stays on the bus and is accepted when HREADY rises", () => {
    const t = run("error", { errorPolicy: "continue" });
    const second = t.cycles.find((c) => c.dataPhase === "error2");
    expect(second).toMatchObject({ htrans: "NONSEQ", addrBeat: "B", accepted: "B" });
    expect(beat(t, "B").status).toBe("done");
  });

  it("§3.5.2: on ERROR mid-burst, cancel drops the remaining beats; the next burst still runs", () => {
    const t = run("error", { errorInBurst: true, errorPolicy: "cancel" });
    expect(beat(t, "A1").resp).toBe("ERROR");
    expect(beat(t, "A2").status).toBe("cancelled");
    expect(beat(t, "A3").status).toBe("cancelled");
    expect(beat(t, "B").status).toBe("done");
    const cont = run("error", { errorInBurst: true, errorPolicy: "continue" });
    expect(["A2", "A3", "B"].map((l) => beat(cont, l).status)).toEqual(["done", "done", "done"]);
  });

  it("§5.1: with a one-cycle ERROR the master is too late: B is accepted at the ERROR edge", () => {
    const t = run("bug");
    const a = beat(t, "A");
    expect(beat(t, "B").acceptEdge).toBe(a.completeEdge);
    expect(beat(t, "B").status).toBe("done");
  });
});

describe("checker properties", () => {
  it("X5: the original check is vacuous on a one-cycle ERROR; the new one fails at the ERROR edge", () => {
    const t = run("bug");
    const errEdge = t.cycles.findIndex((c) => c.hresp === "ERROR");
    expect(evaluateAhbProperty("error-first-then-second", t).vacuous).toBe(true);
    expect(evaluateAhbProperty("error-second-needs-first", t).failures.map((f) => f.decidedAt)).toEqual([errEdge]);
  });

  it("both ERROR properties pass, non-vacuously, on a legal two-cycle ERROR", () => {
    const t = run("error");
    for (const id of ["error-first-then-second", "error-second-needs-first"] as const) {
      const r = evaluateAhbProperty(id, t);
      expect(r.vacuous).toBe(false);
      expect(r.failures).toHaveLength(0);
    }
  });

  it("the first-then-second property catches an ERROR that keeps HREADY low for two cycles", () => {
    const t = clone(run("error"));
    const k = t.cycles.findIndex((c) => c.dataPhase === "error2");
    t.cycles[k] = { ...t.cycles[k], hready: 0 };
    expect(evaluateAhbProperty("error-first-then-second", t).failures[0]?.decidedAt).toBe(k);
  });

  it("X6: cancel-after-ERROR is legal; the flawed stability check fires, p_hold_in_wait does not", () => {
    const t = run("error", { errorPolicy: "cancel" });
    expect(evaluateAhbProperty("hold-naive", t).failures).toHaveLength(1);
    expect(evaluateAhbProperty("hold-in-wait", t).failures).toHaveLength(0);
  });

  it("X6: changing NONSEQ to SEQ with a new address during a wait state fails p_hold_in_wait", () => {
    const t = clone(run("wait"));
    t.cycles[3] = { ...t.cycles[3], htrans: "SEQ", haddr: 0x84 };
    expect(evaluateAhbProperty("hold-in-wait", t).failures.map((f) => f.decidedAt)).toEqual([3]);
  });

  it("X6: switching to IDLE during a wait with no ERROR is not a legal cancel", () => {
    const t = clone(run("wait"));
    t.cycles[3] = { ...t.cycles[3], htrans: "IDLE", haddr: null };
    expect(evaluateAhbProperty("hold-in-wait", t).failures).toHaveLength(1);
  });

  it("X4: the old 1KB check fires on a legal WRAP4 at 0x3F8; the per-beat check stays silent", () => {
    const t = run("wrap", { wrapBurst: "WRAP4", wrapStart: 0x3f8 });
    expect(evaluateAhbProperty("incr-1kb-naive", t).failures).toHaveLength(1);
    expect(evaluateAhbProperty("incr-1kb-per-beat", t).attempts).toHaveLength(0);
  });

  it("§3.5: the per-beat check fails exactly at the beat that enters the next 1KB region", () => {
    const t = run("wrap", { wrapBurst: "INCR4", wrapStart: 0x3f8 });
    const r = evaluateAhbProperty("incr-1kb-per-beat", t);
    expect(r.failures).toHaveLength(1);
    expect(t.cycles[r.failures[0].decidedAt].haddr).toBe(0x400);
  });

  it("§3.5: an undefined-length INCR crossing 1KB slips past the old check but not the per-beat one", () => {
    const t = simulateAhb({ bursts: [{ id: "A", write: true, burst: "INCR", incrBeats: 6, hsize: 2, start: 0x3f0, idleBefore: 1 }] });
    expect(evaluateAhbProperty("incr-1kb-naive", t).failures).toHaveLength(0);
    expect(evaluateAhbProperty("incr-1kb-per-beat", t).failures).toHaveLength(1);
  });
});

describe("waveform export", () => {
  it("WaveDrom slots line up: the HREADY=0 slot is A's extended data phase with B held on HADDR", () => {
    const spec = toWaveDrom(run("wait"), ["HCLK", "HADDR", "HWDATA", "HREADY"], { addr: "label", dataPrefix: "Data " });
    const byName = Object.fromEntries(spec.signal.map((s) => [s.name, s]));
    const lowSlot = byName.HREADY.wave.indexOf("0");
    expect(lowSlot).toBeGreaterThan(0);
    // HWDATA "Data A" spans the low slot and the slot after it.
    expect(byName.HWDATA.wave[lowSlot]).toBe("=");
    expect(byName.HWDATA.wave[lowSlot + 1]).toBe(".");
    expect(byName.HWDATA.data?.[0]).toBe("Data A");
    // HADDR changed to B in the low slot and is held one more slot.
    expect(byName.HADDR.wave.slice(lowSlot, lowSlot + 2)).toBe("=.");
    expect(byName.HADDR.data).toEqual(["A", "B"]);
  });

  it("every signal wave has one character per cycle", () => {
    for (const p of AHB_PRESETS) {
      const t = simulateAhb(p.build(p.defaults));
      for (const s of toWaveDrom(t, p.rows).signal) expect(s.wave).toHaveLength(t.cycles.length);
    }
  });
});

describe("lesson figures are generated from the model", () => {
  const lessons: Record<LessonFigureId, { file: string; title: string }> = {
    "ahb1-pipeline": { file: "B-AHB-1_AHB_Design_Timing_Mechanics", title: "AHB Basic Pipelining" },
    "ahb1-wait-state": { file: "B-AHB-1_AHB_Design_Timing_Mechanics", title: "Wait-State Insertion" },
    "ahb2-two-cycle-error": { file: "B-AHB-2_AHB_Pitfalls_and_Deadlocks", title: "Two-Cycle ERROR Response" },
  };

  const extract = (mdx: string, title: string) => {
    const start = mdx.indexOf(`title="${title}"`);
    expect(start, `ProtocolWaveform "${title}" not found`).toBeGreaterThan(-1);
    const block = mdx.slice(start, mdx.indexOf("/>", start));
    const re = /\{\s*name:\s*"([^"]+)",\s*wave:\s*"([^"]+)"(?:,\s*data:\s*\[([^\]]*)\])?\s*\}/g;
    return Array.from(block.matchAll(re)).map((m) => {
      const data = m[3] ? Array.from(m[3].matchAll(/"([^"]*)"/g)).map((d) => d[1]) : undefined;
      return data ? { name: m[1], wave: m[2], data } : { name: m[1], wave: m[2] };
    });
  };

  for (const [id, { file, title }] of Object.entries(lessons) as [LessonFigureId, { file: string; title: string }][]) {
    it(`${file} "${title}" matches lessonFigure("${id}")`, () => {
      const mdx = readFileSync(path.join(process.cwd(), "content", "curriculum", "T3_Advanced", file, "index.mdx"), "utf8");
      expect(extract(mdx, title)).toEqual(lessonFigure(id).signal);
    });
  }
});

describe("predictions are computed from the run", () => {
  it("every preset has exactly one correct option, each with its own feedback", () => {
    for (const p of AHB_PRESETS) {
      const pr = buildPrediction(p.id, p.defaults, simulateAhb(p.build(p.defaults)));
      expect(pr.options.filter((o) => o.correct), p.id).toHaveLength(1);
      expect(new Set(pr.options.map((o) => o.feedback)).size, p.id).toBe(pr.options.length);
      expect(new Set(pr.options.map((o) => o.label)).size, p.id).toBe(pr.options.length);
    }
  });

  it("every reachable control setting yields a finished run and a well-formed prediction", () => {
    const values: Record<string, unknown[]> = {
      waitsA: [0, 1, 2, 3],
      waitsB: [0, 1, 2, 3],
      busyCycles: [0, 1, 2],
      waitsA0: [0, 1, 2],
      waitsA2: [0, 1, 2],
      wrapBurst: ["WRAP4", "INCR4"],
      wrapStart: [0x30, 0x34, 0x38, 0x3c, 0x3f8],
      errorPolicy: ["cancel", "continue"],
      errorWaits: [0, 1, 2],
      errorInBurst: [false, true],
      slaveStyle: ["two-cycle", "one-cycle-bug"],
    };
    let runs = 0;
    for (const p of AHB_PRESETS) {
      let configs: AhbConfig[] = [p.defaults];
      for (const c of p.controls) configs = configs.flatMap((cfg) => values[c].map((v) => ({ ...cfg, [c]: v }) as AhbConfig));
      for (const cfg of configs) {
        const t = simulateAhb(p.build(cfg));
        runs += 1;
        expect(t.cycles.length).toBeLessThan(30);
        expect(t.beats.every((b) => b.status !== "pending"), `${p.id} ${JSON.stringify(cfg)}`).toBe(true);
        const pr = buildPrediction(p.id, cfg, t);
        expect(pr.options.filter((o) => o.correct), `${p.id} ${JSON.stringify(cfg)}`).toHaveLength(1);
        expect(new Set(pr.options.map((o) => o.label)).size).toBe(pr.options.length);
        expect(pr.options.length).toBeGreaterThanOrEqual(3);
      }
    }
    expect(runs).toBeGreaterThan(50);
  });

  it("wait preset: the correct edge follows the wait-state count", () => {
    const answer = (waitsA: number) => {
      const preset = getPreset("wait");
      const cfg = { ...preset.defaults, waitsA };
      return buildPrediction("wait", cfg, simulateAhb(preset.build(cfg))).options.find((o) => o.correct)?.label;
    };
    expect(answer(1)).toBe("Edge 4");
    expect(answer(2)).toBe("Edge 5");
  });

  it("error preset: IDLE is right for a cancelling master, the held transfer for a continuing one", () => {
    const answer = (errorPolicy: "cancel" | "continue") => {
      const preset = getPreset("error");
      const cfg = { ...preset.defaults, errorPolicy };
      return buildPrediction("error", cfg, simulateAhb(preset.build(cfg))).options.find((o) => o.correct)?.id;
    };
    expect(answer("cancel")).toBe("idle");
    expect(answer("continue")).toBe("held");
  });

  it("bug preset: only the new property fails on the broken slave; neither fails on a legal one", () => {
    const answer = (slaveStyle: "two-cycle" | "one-cycle-bug") => {
      const preset = getPreset("bug");
      const cfg = { ...preset.defaults, slaveStyle };
      return buildPrediction("bug", cfg, simulateAhb(preset.build(cfg))).options.find((o) => o.correct)?.id;
    };
    expect(answer("one-cycle-bug")).toBe("fixed");
    expect(answer("two-cycle")).toBe("neither");
  });

  it("wrap preset: the last WRAP4 beat from 0x34 is 0x30, and 0x40 for INCR4", () => {
    const answer = (wrapBurst: "WRAP4" | "INCR4") => {
      const preset = getPreset("wrap");
      const cfg = { ...preset.defaults, wrapBurst };
      return buildPrediction("wrap", cfg, simulateAhb(preset.build(cfg))).options.find((o) => o.correct)?.label;
    };
    expect(answer("WRAP4")).toBe("0x30");
    expect(answer("INCR4")).toBe("0x40");
  });
});
