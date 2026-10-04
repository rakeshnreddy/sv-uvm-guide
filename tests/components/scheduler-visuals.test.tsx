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
