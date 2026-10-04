import { describe, expect, it } from "vitest";

import {
  arbitrationScenario,
  buildHookTrace,
  childHookSequence,
  createRng,
  DEFAULT_DRIVER,
  driverSource,
  firstContestedDecision,
  handshakeScenario,
  runVirtualSequence,
  sampleDecisionWinners,
  simulateSequencer,
  type SeqOp,
  type SequencerScenario,
  type SequenceSpec,
} from "@/lib/uvm-sequencer-model";

const items = (n: number): SeqOp[] => Array.from({ length: n }, () => ({ kind: "item" as const }));
const seq = (id: string, priority: number, startAt: number, ops: SeqOp[]): SequenceSpec => ({ id, name: `seq_${id.toLowerCase()}`, priority, startAt, ops });
const grantOrder = (scenario: SequencerScenario) => simulateSequencer(scenario).decisions.map((d) => d.item);

describe("uvm-sequencer-model: handshake (uvm_sequence_base start_item/finish_item, uvm_sqr_if_base 15.2.1.2)", () => {
  it("finish_item blocks until item_done: the sequence is in finish_item while the driver drives (14.2.6.3)", () => {
    const run = simulateSequencer(handshakeScenario("basic"));
    const driving = run.steps.find((s) => s.time === 0 && s.driver.status === "driving");
    expect(driving).toBeDefined();
    expect(driving?.sequences[0].status).toBe("wait-item-done");
    expect(driving?.sequences[0].where).toContain("finish_item(A1)");
  });

  it("the next start_item is only granted after item_done, when the driver calls get_next_item again", () => {
    const run = simulateSequencer(handshakeScenario("basic"));
    expect(run.decisions.map((d) => d.time)).toEqual([0, 10, 20]);
    expect(run.driven.map((d) => [d.item, d.start, d.end])).toEqual([
      ["A1", 0, 10],
      ["A2", 10, 20],
      ["A3", 20, 30],
    ]);
    expect(run.outcome.kind).toBe("complete");
    expect(run.outcome.time).toBe(30);
  });

  it("item_done(rsp) with set_id_info routes the response so get_response returns at once", () => {
    const run = simulateSequencer(handshakeScenario("responses"));
    expect(run.outcome.kind).toBe("complete");
    expect(run.responses.A).toEqual({ received: 2, dropped: 0, collected: 2 });
  });

  it("missing item_done: get_next_item reports 'called twice' and returns the SAME item; the sequence hangs in finish_item (uvm_sequencer::get_next_item, m_safe_select_item)", () => {
    const run = simulateSequencer(handshakeScenario("missing_item_done"));
    const errors = run.log.filter((l) => l.text === "Get_next_item called twice without item_done or get in between");
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(new Set(run.driven.map((d) => d.item))).toEqual(new Set(["A1"]));
    expect(run.driven.length).toBeGreaterThanOrEqual(3);
    expect(run.driven.map((d) => d.pass)).toEqual(run.driven.map((_, i) => i + 1));
    expect(errors).toHaveLength(run.driven.length - 1);
    expect(run.outcome.kind).toBe("timeout");
    expect(run.outcome.blocked[0].where).toContain("finish_item(A1)");
    expect(run.decisions).toHaveLength(1);
  });

  it("get_next_item twice per loop returns the same handle with an error, so each item is driven twice", () => {
    const run = simulateSequencer(handshakeScenario("double_get"));
    expect(run.driven.map((d) => d.item)).toEqual(["A1", "A1", "A2", "A2"]);
    expect(run.log.filter((l) => l.severity === "ERROR")).toHaveLength(2);
    expect(run.outcome.kind).toBe("complete");
  });

  it("a response without set_id_info has sequence_id -1: fatal SQRPUT (uvm_sequencer_param_base::put_response)", () => {
    const run = simulateSequencer(handshakeScenario("rsp_no_id"));
    expect(run.outcome.kind).toBe("fatal");
    expect(run.log.at(-1)).toMatchObject({ severity: "FATAL", id: "SQRPUT" });
  });

  it("uncollected responses: the queue keeps 8 (response_queue_depth) and drops the rest silently by default (put_base_response)", () => {
    const run = simulateSequencer(handshakeScenario("rsp_overflow"));
    expect(run.responses.A).toEqual({ received: 10, dropped: 2, collected: 0 });
    expect(run.log.some((l) => l.text.includes("Response queue overflow"))).toBe(false);
    expect(run.outcome.kind).toBe("complete");
  });

  it("with set_response_queue_error_report_enabled(1) the drop is reported as an error", () => {
    const run = simulateSequencer({ ...handshakeScenario("rsp_overflow"), responseQueueErrorReport: true });
    expect(run.log.filter((l) => l.text === "Response queue overflow, response was dropped")).toHaveLength(2);
  });

  it("get_response with a driver that never responds hangs in get_response after item 1", () => {
    const run = simulateSequencer(handshakeScenario("response_hang"));
    expect(run.outcome.kind).toBe("hang");
    expect(run.outcome.blocked[0].where).toContain("get_response");
    expect(run.driven).toHaveLength(1);
  });

  it("generated driver source reflects the bug being modelled", () => {
    expect(driverSource({ ...DEFAULT_DRIVER, completion: "none" }).some((l) => l.text.includes("item_done();  <- missing"))).toBe(true);
    expect(driverSource({ ...DEFAULT_DRIVER, completion: "item_done_rsp", setIdInfo: true }).some((l) => l.text.includes("rsp.set_id_info(req)"))).toBe(true);
  });
});

describe("uvm-sequencer-model: arbitration modes (uvm_sequencer_base::m_choose_next_request, 15.3.2.19)", () => {
  it("FIFO is the default rule and ignores priority: round-robin by request age", () => {
    expect(grantOrder(arbitrationScenario("fifo"))).toEqual(["A1", "B1", "C1", "A2", "B2", "C2"]);
  });

  it("arbitration only chooses among queued requests: grant #1 goes to A even under STRICT_FIFO with C at priority 300", () => {
    const run = simulateSequencer(arbitrationScenario("strict_fifo"));
    expect(run.decisions[0]).toMatchObject({ item: "A1", available: 1 });
  });

  it("STRICT_FIFO grants the highest priority first, FIFO among equals", () => {
    expect(grantOrder(arbitrationScenario("strict_fifo"))).toEqual(["A1", "C1", "C2", "B1", "A2", "B2"]);
  });

  it("STRICT_FIFO is not 'strict order across locks': equal priorities fall back to FIFO order", () => {
    const run = simulateSequencer({
      ...arbitrationScenario("fifo"),
      mode: "UVM_SEQ_ARB_STRICT_FIFO",
      sequences: [seq("A", 100, 0, items(2)), seq("B", 100, 1, items(2))],
    });
    expect(run.decisions.map((d) => d.item)).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("WEIGHTED is random: different seeds give different orders, the same seed repeats exactly", () => {
    const base = arbitrationScenario("weighted");
    const orders = new Set(Array.from({ length: 12 }, (_, i) => grantOrder({ ...base, seed: i + 1 }).join(",")));
    expect(orders.size).toBeGreaterThan(1);
    expect(grantOrder({ ...base, seed: 5 })).toEqual(grantOrder({ ...base, seed: 5 }));
  });

  it("WEIGHTED chance equals priority / sum of waiting priorities (B 300 of 500 = 60%)", () => {
    const base = arbitrationScenario("weighted");
    const contested = firstContestedDecision(simulateSequencer(base));
    expect(contested?.index).toBe(2);
    const chances = Object.fromEntries(contested!.candidates.map((c) => [c.seqId, c.chance]));
    expect(chances.B).toBeCloseTo(0.6, 5);
    expect(chances.C).toBeCloseTo(0.2, 5);
    const counts = sampleDecisionWinners(base, 2, 600);
    expect(counts.B / 600).toBeGreaterThan(0.5);
    expect(counts.B / 600).toBeLessThan(0.7);
  });

  it("RANDOM ignores priority: each waiting request has the same chance", () => {
    const base = { ...arbitrationScenario("weighted"), mode: "UVM_SEQ_ARB_RANDOM" as const };
    const contested = firstContestedDecision(simulateSequencer(base));
    for (const c of contested!.candidates.filter((x) => x.outcome !== "absent")) expect(c.chance).toBeCloseTo(1 / contested!.available, 5);
  });

  it("STRICT_RANDOM never picks a lower priority while a higher one waits", () => {
    const base: SequencerScenario = {
      ...arbitrationScenario("weighted"),
      mode: "UVM_SEQ_ARB_STRICT_RANDOM",
      sequences: [seq("A", 100, 0, items(1)), seq("B", 300, 1, items(1)), seq("C", 300, 2, items(1)), seq("D", 100, 3, items(1))],
    };
    for (let seedValue = 1; seedValue <= 30; seedValue += 1) {
      const order = grantOrder({ ...base, seed: seedValue });
      expect(order.slice(1, 3).sort()).toEqual(["B1", "C1"]);
    }
  });

  it("a single available request is granted without consuming a random draw", () => {
    const run = simulateSequencer({ ...arbitrationScenario("weighted"), sequences: [seq("A", 100, 0, items(3))] });
    expect(run.rngDraws).toBe(0);
  });

  it("the LCG is deterministic and stays inside $urandom_range bounds", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i += 1) {
      const v = a.urandomRange(4, 1);
      expect(v).toBe(b.urandomRange(4, 1));
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
});

describe("uvm-sequencer-model: lock and grab (m_lock_req, grant_queued_locks, is_blocked)", () => {
  it("lock() is granted as soon as no other lock blocks it, even ahead of C's older request (uvm-core 2020.3.1)", () => {
    const run = simulateSequencer(arbitrationScenario("lock"));
    expect(run.decisions[1]).toMatchObject({ item: "B1", time: 10 });
    const c = run.decisions[1].candidates.find((x) => x.seqId === "C");
    expect(c?.outcome).toBe("blocked");
    expect(run.decisions.map((d) => d.item)).toEqual(["A1", "B1", "B2", "C1", "A2", "C2", "A3"]);
  });

  it("a lock is held until unlock(): it does not auto-release when the owner has nothing queued", () => {
    const run = simulateSequencer(arbitrationScenario("forgot_unlock"));
    expect(run.decisions.map((d) => [d.item, d.time])).toEqual([
      ["A1", 0],
      ["B1", 10],
      ["B2", 20],
      ["C1", 70],
      ["A2", 80],
      ["C2", 90],
    ]);
  });

  it("a sequence that finishes while holding the lock gets SEQFINERR and loses the lock (remove_sequence_from_queues)", () => {
    const run = simulateSequencer(arbitrationScenario("forgot_unlock"));
    const err = run.log.find((l) => l.id === "SEQFINERR");
    expect(err).toMatchObject({ severity: "ERROR", time: 70 });
    expect(run.lockSpans).toEqual([{ seqId: "B", kind: "lock", start: 1, end: 70 }]);
  });

  it("a second lock() queues behind the holder instead of stealing it", () => {
    const run = simulateSequencer(arbitrationScenario("grab_vs_lock"));
    const bLock = run.lockSpans.find((s) => s.seqId === "B");
    expect(bLock?.start).toBeGreaterThanOrEqual(30);
  });

  it("grab() goes to the front of the queue: a waiting grab beats an older waiting lock (push_front)", () => {
    const run = simulateSequencer(arbitrationScenario("grab_vs_lock"));
    expect(run.lockSpans.map((s) => [s.seqId, s.kind, s.start, s.end])).toEqual([
      ["A", "lock", 0, 30],
      ["C", "grab", 30, 40],
      ["B", "lock", 40, 50],
    ]);
    expect(run.decisions.map((d) => d.item)).toEqual(["A1", "C1", "B1"]);
  });

  it("lock and grab are never held by two sequences at once", () => {
    const run = simulateSequencer(arbitrationScenario("grab_vs_lock"));
    for (const step of run.steps) expect(step.lockList.length).toBeLessThanOrEqual(1);
  });

  it("unlock() without a lock reports SQRUNL", () => {
    const run = simulateSequencer({ ...arbitrationScenario("fifo"), sequences: [seq("A", 100, 0, [{ kind: "unlock" }, ...items(1)])] });
    expect(run.log[0]).toMatchObject({ severity: "ERROR", id: "SQRUNL" });
  });

  it("blocked candidates are explained as blocked, not as having lost the rule", () => {
    const run = simulateSequencer(arbitrationScenario("forgot_unlock"));
    const d = run.decisions[1];
    expect(d.candidates.find((c) => c.seqId === "C")?.reason).toMatch(/blocked/);
    expect(d.candidates.find((c) => c.seqId === "A")?.outcome).toBe("blocked");
  });
});

describe("uvm-sequencer-model: start() hooks (uvm_sequence_base::start 14.2.3, `uvm_do → uvm_rand_send)", () => {
  it("child.start(sqr, this) runs pre_body/post_body and the parent's pre_do/mid_do/post_do around body", () => {
    expect(childHookSequence("c", "p", "start_with_parent")).toEqual([
      "c.pre_start()",
      "c.pre_body()",
      "p.pre_do(0)",
      "p.mid_do(c)",
      "c.body()",
      "p.post_do(c)",
      "c.post_body()",
      "c.post_start()",
    ]);
  });

  it("`uvm_do(child) passes call_pre_post = 0, so pre_body/post_body are skipped", () => {
    const calls = childHookSequence("c", "p", "uvm_do");
    expect(calls).not.toContain("c.pre_body()");
    expect(calls).not.toContain("c.post_body()");
    expect(calls).toContain("p.mid_do(c)");
  });

  it("child.start(sqr) without a parent skips the parent's hooks", () => {
    const calls = childHookSequence("c", "p", "start_no_parent");
    expect(calls.some((c) => c.startsWith("p."))).toBe(false);
    expect(calls).toContain("c.pre_body()");
  });

  it("item detail: wait_for_grant, then pre_do(1), randomize, mid_do, send_request, post_do", () => {
    const trace = buildHookTrace({ root: "top", children: [{ name: "w", style: "start_with_parent", items: 1 }], itemDetail: true, rootLocks: false });
    const calls = trace.events.map((e) => e.call);
    const order = ["w.start_item(req)", "m_sequencer.wait_for_grant(w, priority)", "w.pre_do(1)", "req.randomize()", "w.finish_item(req)", "w.mid_do(req)", "m_sequencer.send_request(w, req)", "w.post_do(req)"];
    const idx = order.map((c) => calls.indexOf(c));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it("a parent that holds lock() deadlocks a child started without a parent (is_child is false)", () => {
    const trace = buildHookTrace({ root: "top", children: [{ name: "w", style: "start_no_parent", items: 1 }], itemDetail: true, rootLocks: true });
    expect(trace.deadlock).toBe(true);
    const ok = buildHookTrace({ root: "top", children: [{ name: "w", style: "start_with_parent", items: 1 }], itemDetail: true, rootLocks: true });
    expect(ok.deadlock).toBe(false);
  });
});

describe("uvm-sequencer-model: virtual sequence dispatch", () => {
  it("ordered starts data only after cfg_seq returns", () => {
    const run = runVirtualSequence({ dispatch: "ordered", dataHandleAssigned: true });
    expect(run.cfgDoneAt).toBe(40);
    expect(run.firstDataAt).toBe(40);
    expect(run.outcome.kind).toBe("ok");
    expect(run.vseqReturnsAt).toBe(70);
  });

  it("fork…join runs both children at once and returns when the slower one finishes", () => {
    const run = runVirtualSequence({ dispatch: "fork_join", dataHandleAssigned: true });
    expect(run.firstDataAt).toBe(0);
    expect(run.outcome.kind).toBe("order-violation");
    expect(run.vseqReturnsAt).toBe(40);
  });

  it("fork…join_none returns at 0 ns, so the test ends before any item completes", () => {
    const run = runVirtualSequence({ dispatch: "fork_join_none", dataHandleAssigned: true });
    expect(run.vseqReturnsAt).toBe(0);
    expect(run.bars).toHaveLength(0);
    expect(run.outcome.kind).toBe("killed");
  });

  it("an unassigned p_sequencer.data_sqr handle makes data_seq's start_item fatal (SEQ: null sequencer)", () => {
    const run = runVirtualSequence({ dispatch: "ordered", dataHandleAssigned: false });
    expect(run.outcome.kind).toBe("fatal");
    expect(run.log[0]).toMatchObject({ severity: "FATAL", id: "SEQ", time: 40 });
  });
});

describe("uvm-sequencer-model: virtual sequence corner case", () => {
  it("join_none with a missing handle is reported as the early end of test, with the null handle noted", () => {
    const run = runVirtualSequence({ dispatch: "fork_join_none", dataHandleAssigned: false });
    expect(run.outcome.kind).toBe("killed");
    expect(run.events.some((e) => e.what.includes("also null"))).toBe(true);
  });
});
