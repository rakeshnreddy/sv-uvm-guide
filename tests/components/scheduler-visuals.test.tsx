import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RaceConditionDebugger from "@/components/visuals/RaceConditionDebugger";
import RaceDebugChallenge from "@/components/visuals/RaceDebugChallenge";
import TestbenchDriveComparison from "@/components/visuals/TestbenchDriveComparison";
import TimeSlotRegionMap from "@/components/visuals/TimeSlotRegionMap";
import TimeSlotTraceVisualizer from "@/components/visuals/TimeSlotTraceVisualizer";

const valueChip = (name: string) => screen.getAllByLabelText(new RegExp(`^${name} = `))[0];

describe("TimeSlotTraceVisualizer", () => {
  it("keeps code, narration and values on the same step and restores state on step back", () => {
    render(<TimeSlotTraceVisualizer scenario="shift-blocking" scenarios={["shift-blocking", "shift-nba"]} />);
    expect(screen.getByText(/Race — 2 different results/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /next scheduler step/i });
    const initialQ1 = valueChip("q1").getAttribute("aria-label");

    // Advance until a statement line is highlighted.
    let guard = 0;
    while (!document.querySelector('[aria-current="step"]') && guard < 20) {
      fireEvent.click(next);
      guard += 1;
    }
    const active = document.querySelector('[aria-current="step"]');
    expect(active?.textContent).toMatch(/q1 = d;|q2 = q1;/);

    // Step back to the very first step restores the initial values exactly.
    const back = screen.getByRole("button", { name: /previous scheduler step/i });
    for (let i = 0; i < guard; i += 1) fireEvent.click(back);
    expect(valueChip("q1").getAttribute("aria-label")).toBe(initialQ1);
    expect(screen.getByText(/Time slot begins/)).toBeInTheDocument();
  });

  it("changing the simulator's process order changes the settled q2 for the blocking version", () => {
    render(<TimeSlotTraceVisualizer scenario="shift-blocking" scenarios={["shift-blocking"]} />);
    const scrubber = screen.getByRole("slider", { name: /scrubber/i });
    const max = Number(scrubber.getAttribute("max"));
    fireEvent.change(scrubber, { target: { value: max } });
    const first = valueChip("q2").getAttribute("aria-label");
    fireEvent.click(screen.getByLabelText(/Stage B → Stage A/));
    const after = screen.getByRole("slider", { name: /scrubber/i });
    fireEvent.change(after, { target: { value: Number(after.getAttribute("max")) } });
    expect(valueChip("q2").getAttribute("aria-label")).not.toBe(first);
  });

  it("supports keyboard stepping inside the playback group", () => {
    render(<TimeSlotTraceVisualizer scenario="shift-nba" scenarios={["shift-nba"]} />);
    const group = screen.getByRole("group", { name: /scheduler step playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next scheduler step/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);
  });
});

describe("RaceConditionDebugger", () => {
  it("hides results until a prediction is locked in, then diagnoses it", () => {
    render(<RaceConditionDebugger />);
    expect(screen.queryByText(/legal orderings agree|different results from/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Yes — the result is the same in every order/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/2 different results from 2 legal orderings/)).toBeInTheDocument();
    expect(screen.getByText(/Compare two executions/)).toBeInTheDocument();
  });

  it("re-asks for a prediction after the code changes and reports determinism with <=", () => {
    render(<RaceConditionDebugger />);
    fireEvent.click(screen.getByRole("button", { name: /Change always @\(posedge clk\) q1 = d; to a nonblocking/ }));
    fireEvent.click(screen.getByRole("button", { name: /Change always @\(posedge clk\) q2 = q1; to a nonblocking/ }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Yes — the result is the same in every order/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic: all 2 legal orderings agree/)).toBeInTheDocument();
    expect(screen.getByText(/Matches real flip-flop hardware/)).toBeInTheDocument();
  });
});

describe("TestbenchDriveComparison", () => {
  it("shows one racing style and two deterministic styles after the prediction", () => {
    render(<TestbenchDriveComparison />);
    fireEvent.click(screen.getByLabelText(/and the clocking block/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getAllByText("⚠ race")).toHaveLength(1);
    expect(screen.getAllByText("✓ deterministic")).toHaveLength(2);
  });
});

describe("RaceDebugChallenge", () => {
  it("grades suspects and fixes with the model", () => {
    render(<RaceDebugChallenge />);
    expect(screen.getAllByText(/UVM_ERROR \[SCB\] mismatch: expected q=3, actual q=7/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: always_ff @\(posedge clk\) q <= din;/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: din = 7;/ }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Add #0 at the start of the DUT flop/));
    expect(screen.getByText(/✕ not what hardware does/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Drive through a clocking block/));
    expect(screen.getByText(/✓ matches hardware/)).toBeInTheDocument();
    expect(screen.getByText(/Accepted — preferred/)).toBeInTheDocument();
  });
});

describe("TimeSlotRegionMap", () => {
  it("is keyboard selectable and describes the selected region", () => {
    render(<TimeSlotRegionMap />);
    const reNba = screen.getByRole("button", { name: /^Re-NBA/ });
    fireEvent.keyDown(reNba, { key: "Enter" });
    expect(reNba).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Clocking-block synchronous drives/)).toBeInTheDocument();
  });
});

describe("TimeSlotTraceVisualizer: folded view and the F3A, F3B, F3C presets", () => {
  const lock = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
  const toEnd = () => {
    const slider = screen.getByRole("slider", { name: /scrubber/i });
    fireEvent.change(slider, { target: { value: Number(slider.getAttribute("max")) } });
  };

  it("f3a-one-edge hides the trace until both printed lines are predicted, then folds the slot into the lesson's eight events", () => {
    render(<TimeSlotTraceVisualizer scenario="f3a-one-edge" scenarios={["f3a-one-edge", "f3a-one-edge-zero-delay"]} regionView="folded" />);
    // Nothing that answers the prediction is on the page yet.
    expect(screen.queryByRole("group", { name: /event playback controls/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Simulation log")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /this time slot/i })).not.toBeInTheDocument();
    expect(screen.getByText(/The initial prints two lines at t = 5 ns/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^5 display q=0 q_n=1 · 5 strobe q=1 q_n=0$/));
    lock();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    const slot = screen.getByRole("region", { name: "This time slot, t = 5 ns" });
    const events = within(slot).getAllByRole("button");
    expect(events.map((b) => b.getAttribute("aria-label")?.split(",")[0])).toEqual([
      "entering the slot",
      "Event 1: ▶ clock",
      "Event 2: ◆ clk 0 → 1",
      "Event 3: ▶ always_ff",
      "Event 4: ▶ initial",
      "Event 5: ◆ q 0 → 1",
      "Event 6: ▶ assign q_n",
      "Event 7: ◆ q_n 1 → 0",
      "Event 8: end of slot",
    ]);
    expect(screen.getByLabelText("$time is 5 ns for every event of this slot")).toBeInTheDocument();

    toEnd();
    expect(screen.getByLabelText("Simulation log").textContent?.replace(/\s+/g, " ")).toBe("$display: 5 display q=0 q_n=1$strobe: 5 strobe q=1 q_n=0");
    expect(screen.getByLabelText(/^Δ 1, model count/)).toBeInTheDocument();
  });

  it("the Scheduler choice toggle swaps events 3 and 4 and leaves the output unchanged", () => {
    render(<TimeSlotTraceVisualizer scenario="f3a-one-edge" scenarios={["f3a-one-edge"]} regionView="folded" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/Deterministic — all 2 legal orderings end the same way/)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Scheduler choice" });
    fireEvent.click(within(group).getByRole("radio", { name: /initial first/ }));
    const slot = screen.getByRole("region", { name: /this time slot/i });
    const labels = within(slot).getAllByRole("button").map((b) => b.getAttribute("aria-label")?.split(",")[0]);
    expect(labels.slice(3, 5)).toEqual(["Event 3: ▶ initial", "Event 4: ▶ always_ff"]);
    toEnd();
    const log = screen.getByLabelText("Simulation log").textContent?.replace(/\s+/g, " ");
    expect(log).toBe("$display: 5 display q=0 q_n=1$strobe: 5 strobe q=1 q_n=0");
  });

  it("the #0 variant sits behind Show advanced and explains why $display still prints q=0", () => {
    render(<TimeSlotTraceVisualizer scenario="f3a-one-edge" scenarios={["f3a-one-edge", "f3a-one-edge-zero-delay"]} regionView="folded" />);
    expect(screen.queryByRole("tab", { name: "#0 before $display" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced" }));
    fireEvent.click(screen.getByRole("tab", { name: "#0 before $display" }));
    expect(screen.getByText("With #0 before $display, does $display now print q=1?")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^Yes: #0 waits/));
    lock();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/Inactive \(§4\.4\.2\.3\).*before NBA events/).length).toBeGreaterThan(0);
  });

  it("comb-after-nba gates y, z, Δ and $time behind one prediction", () => {
    render(<TimeSlotTraceVisualizer scenario="comb-after-nba" scenarios={["comb-after-nba", "program-drive"]} />);
    expect(screen.queryByText(/^Δ \d/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/; \$time moves on by one Δ$/));
    lock();
    expect(screen.getByText(/Δ is not a unit of time/)).toBeInTheDocument();
    toEnd();
    expect(screen.getByText("Δ 1")).toBeInTheDocument();
    expect(valueChip("z").getAttribute("aria-label")).toBe("z = 1");
  });

  it("program-drive needs no prediction, and its Δ goes past 1 by the end of the slot", () => {
    render(<TimeSlotTraceVisualizer scenario="program-drive" scenarios={["comb-after-nba", "program-drive"]} />);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    toEnd();
    expect(screen.getByText("Δ 2")).toBeInTheDocument();
  });

  it("gclk-interleave asks old, new or either first, then shows two outcome groups that load into the scrubber", () => {
    render(<TimeSlotTraceVisualizer scenario="gclk-interleave" scenarios={["gclk-interleave", "gclk-enable"]} />);
    expect(screen.queryByText(/different outcomes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Race —/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^The old a \(0\)$/));
    lock();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText("2 different outcomes from 3 legal orders: the result depends on the scheduler's choice.")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /^b = 0, 1 of 3 orders/ });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    toEnd();
    expect(screen.getAllByLabelText(/^b = 0(, just changed)?$/).length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/^b = 1(, just changed)?$/)).toHaveLength(0);
  });

  it("gclk-enable gives one group: b captures the old a in every order", () => {
    render(<TimeSlotTraceVisualizer scenario="gclk-enable" scenarios={["gclk-interleave", "gclk-enable"]} />);
    fireEvent.click(screen.getByLabelText(/^The old a \(0\)$/));
    lock();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/^1 outcome from 6 legal orders/)).toBeInTheDocument();
    expect(screen.getByText(/Model limit: The model does not evaluate if/)).toBeInTheDocument();
  });

  it("existing presets keep their ungated ladder view", () => {
    render(<TimeSlotTraceVisualizer scenario="display-vs-strobe" scenarios={["display-vs-strobe"]} />);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.getByText(/t = 10 ns \(fixed\)/)).toBeInTheDocument();
  });
});

describe("RaceConditionDebugger: nba-writers bench (§4.6 vs §4.7)", () => {
  it("one process is defined; two processes are not, even with <=", () => {
    render(<RaceConditionDebugger bench="nba-writers" />);
    expect(screen.queryByText(/outcome/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^Defined: every legal order/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/a ← 0, then a ← 1 is applied\. a = 1 at the end of the slot/)).toBeInTheDocument();
    expect(screen.getByText(/^1 outcome from 1 legal order/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /two processes woken by one edge/ }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/^Defined: every legal order/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/a = 0 or 1/).length).toBeGreaterThan(0);
    expect(screen.getByText("2 different outcomes from 2 legal orders: the result depends on the scheduler's choice.")).toBeInTheDocument();
    // No operator switches on this bench: the point is the writers, not = versus <=.
    expect(screen.queryByRole("button", { name: /to a blocking/ })).not.toBeInTheDocument();
  });
});
