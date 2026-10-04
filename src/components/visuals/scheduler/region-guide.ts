import type { RegionId } from "@/lib/sv-scheduler-model";

export interface RegionGuideEntry {
  id: RegionId;
  /** Few-word tag drawn on the ladder rung. */
  tag: string;
  /** §4.4.1: Observed is an iterative region but belongs to neither region set. */
  family: "readOnly" | "activeSet" | "observed" | "reactiveSet";
  holds: string;
  example: string;
  inTestbench: string;
}

/**
 * Plain-language region guide (IEEE 1800 Clause 4, scheduling semantics;
 * Clause 14 for clocking blocks). Wording is deliberately conservative:
 * it describes what the standard schedules, not vendor optimisations.
 */
export const regionGuide: RegionGuideEntry[] = [
  {
    id: "preponed",
    tag: "sample values",
    family: "readOnly",
    holds: "The values every signal had before anything in this time slot changed. Concurrent assertions and clocking-block inputs with the default #1step skew read these samples. Nothing may write here.",
    example: "@(posedge clk) assert property (req |-> ##1 gnt);  // req sampled here",
    inTestbench: "A monitor that reads vif.cb.data sees the Preponed sample, so it never observes a value the DUT changed on this same edge.",
  },
  {
    id: "active",
    tag: "= writes · process wake-ups",
    family: "activeSet",
    holds: "Processes woken by an event, blocking assignments, continuous-assignment updates, and the right-hand side evaluation of nonblocking assignments. Ready processes may run in any order.",
    example: "always @(posedge clk) q1 = d;   // runs and writes here",
    inTestbench: "UVM drivers and monitors are class code called from module processes, so they run in the active set too — they are not program blocks.",
  },
  {
    id: "inactive",
    tag: "#0 resumes",
    family: "activeSet",
    holds: "Processes that executed #0. They resume only after the Active region is empty.",
    example: "#0 q2 = q1;   // waits until Active drains",
    inTestbench: "#0 is a common race 'fix' that only moves the problem: two #0 processes race again here.",
  },
  {
    id: "nba",
    tag: "<= updates",
    family: "activeSet",
    holds: "The left-hand side updates of nonblocking assignments, applied in the order they were executed. A changed value can wake more processes, which sends the scheduler back to Active — another delta in the same time.",
    example: "q <= d;   // RHS read in Active, q written here",
    inTestbench: "Driving DUT inputs with <= (or a clocking block) means the DUT's flops capture the pre-edge value, just like hardware.",
  },
  {
    id: "observed",
    tag: "assertions · @(cb) events",
    family: "observed",
    holds: "Concurrent assertion properties are evaluated, using the values sampled in Preponed; their pass/fail action blocks are scheduled into Reactive. Clocking-block events such as @(cb) are also triggered here (§14.10), so code waiting on @(cb) runs after the design's NBA updates.",
    example: "assert property (@(posedge clk) a |=> b) else $error(...);",
    inTestbench: "Assertion checks see stable sampled values even though design flops update in NBA on the same edge.",
  },
  {
    id: "reactive",
    tag: "program code · action blocks",
    family: "reactiveSet",
    holds: "Code in program blocks and assertion action blocks. Writes from here to design signals can wake design processes, which restarts the active set.",
    example: "program tb; initial @(posedge clk) $display(dut.q); endprogram",
    inTestbench: "Program blocks were designed to separate testbench from design timing; most UVM benches use clocking blocks instead.",
  },
  {
    id: "reInactive",
    tag: "#0 in programs",
    family: "reactiveSet",
    holds: "Program-block processes resumed after #0.",
    example: "program p; initial begin #0; ... end endprogram",
    inTestbench: "Rarely needed; mirrors Inactive for the reactive set.",
  },
  {
    id: "reNba",
    tag: "clocking drives · program <=",
    family: "reactiveSet",
    holds: "Clocking-block synchronous drives (default output skew #0) and nonblocking assignments made from program code. They land after all design NBA updates of the slot.",
    example: "vif.cb.din <= 7;   // applied in Re-NBA",
    inTestbench: "This is why a UVM driver that writes vif.cb.signal never races the DUT flops it feeds.",
  },
  {
    id: "postponed",
    tag: "$strobe · $monitor",
    family: "readOnly",
    holds: "$strobe and $monitor output with the final values of the time slot. Read-only: nothing may change a value here.",
    example: "$strobe(\"q=%0d\", q);   // prints the settled q",
    inTestbench: "Use $strobe (or log from a later time) when a debug print must show post-NBA values.",
  },
];

export const regionGuideById = Object.fromEntries(regionGuide.map((r) => [r.id, r])) as Record<RegionId, RegionGuideEntry>;
