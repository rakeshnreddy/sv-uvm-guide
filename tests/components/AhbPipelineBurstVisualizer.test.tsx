import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AhbPipelineBurstVisualizer from "../../src/components/visualizers/AhbPipelineBurstVisualizer";

const waveform = () => screen.queryByRole("group", { name: /AHB signals per cycle/ });
const scenarioGroup = () => screen.getByRole("radiogroup", { name: "Scenario" });

const choose = (scenario: string) => fireEvent.click(within(scenarioGroup()).getByRole("radio", { name: scenario }));

const commit = (optionLabel: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(optionLabel));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
};

describe("AhbPipelineBurstVisualizer", () => {
  afterEach(() => cleanup());

  it("keeps the lesson test id and opens on the wait-state scenario with a model fidelity badge", () => {
    render(<AhbPipelineBurstVisualizer />);
    expect(screen.getByTestId("ahb-pipeline-burst-visualizer")).toBeInTheDocument();
    expect(within(scenarioGroup()).getByRole("radio", { name: "Wait state" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Deterministic educational model/i)).toBeInTheDocument();
  });

  it("hides the waveform until the learner commits a prediction", () => {
    render(<AhbPipelineBurstVisualizer />);
    expect(screen.getByText(/At which edge does the slave sample B's write data\?/)).toBeInTheDocument();
    expect(waveform()).toBeNull();
    commit("Edge 4");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(waveform()).not.toBeNull();
  });

  it("diagnoses the 'address phase is always one cycle' misconception", () => {
    render(<AhbPipelineBurstVisualizer />);
    commit("Edge 3");
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getByText(/address phase started in cycle 2 but was extended until edge 3/)).toBeInTheDocument();
  });

  it("recomputes the question from the model and re-locks the reveal when the learner changes the wait states", () => {
    render(<AhbPipelineBurstVisualizer />);
    commit("Edge 4");
    expect(waveform()).not.toBeNull();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Wait states on A" })).getByRole("radio", { name: "2" }));
    expect(waveform()).toBeNull();
    expect(screen.getByText(/A has 2 wait states and B has 0/)).toBeInTheDocument();
    commit("Edge 5");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("steps through cycles from the keyboard with a narrated why", () => {
    render(<AhbPipelineBurstVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const controls = screen.getByRole("group", { name: "Cycle playback controls" });
    expect(screen.getByText("Cycle 0 → edge 0")).toBeInTheDocument();
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    expect(screen.getByText("Cycle 2 → edge 2")).toBeInTheDocument();
    expect(screen.getByText(/A's data phase is waited: HREADY is low with OKAY/)).toBeInTheDocument();
    expect(screen.getByText(/NONSEQ B \(0x80\) is held on the address bus/)).toBeInTheDocument();
    fireEvent.keyDown(controls, { key: "Home" });
    expect(screen.getByText("Cycle 0 → edge 0")).toBeInTheDocument();
  });

  it("moves between scenarios with the arrow keys", () => {
    render(<AhbPipelineBurstVisualizer />);
    const wait = within(scenarioGroup()).getByRole("radio", { name: "Wait state" });
    fireEvent.keyDown(wait, { key: "ArrowRight" });
    expect(within(scenarioGroup()).getByRole("radio", { name: "Read with waits" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/At which edge does the master sample A's read data\?/)).toBeInTheDocument();
  });

  it("two-cycle ERROR: a cancelling master drives IDLE, B is cancelled, and the old stability check false-fires", () => {
    render(<AhbPipelineBurstVisualizer />);
    choose("Two-cycle ERROR");
    expect(screen.getByText(/What does the master drive on HTRANS in cycle 4, the second ERROR cycle\?/)).toBeInTheDocument();
    commit("IDLE");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText("◇ cancelled")).toBeInTheDocument();
    const oldCheck = screen.getByRole("button", { name: /p_ctrl_stable \(old\)/ });
    expect(oldCheck).toHaveTextContent("fails at edge 4");
    expect(screen.getByRole("button", { name: /p_hold_in_wait/ })).toHaveTextContent("holds");
  });

  it("two-cycle ERROR: a continuing master keeps B, so the held transfer is the right answer", () => {
    render(<AhbPipelineBurstVisualizer />);
    choose("Two-cycle ERROR");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Master after ERROR" })).getByRole("radio", { name: "continues" }));
    commit("NONSEQ B, unchanged");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.queryByText("◇ cancelled")).toBeNull();
  });

  it("debug: the original ERROR assertion is vacuous on a one-cycle ERROR; the new one fails", () => {
    render(<AhbPipelineBurstVisualizer />);
    choose("Debug: one-cycle ERROR");
    expect(screen.getByRole("button", { name: /Need a hint/ })).toBeInTheDocument();
    commit("Only p_error_second_needs_first");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /p_error_first_then_second/ })).toHaveTextContent("never triggered (vacuous)");
    const fixed = screen.getByRole("button", { name: /p_error_second_needs_first/ });
    expect(fixed).toHaveTextContent("fails at edge 3");
    fireEvent.click(fixed);
    expect(fixed).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/\(HRESP && HREADY\) \|-> \$past\(HRESP && !HREADY\);/)).toBeInTheDocument();
  });

  it("WRAP vs INCR: flags the INCR4 that crosses 1KB and shows the old 1KB check firing on a legal WRAP4", () => {
    render(<AhbPipelineBurstVisualizer />);
    choose("WRAP vs INCR");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Start address" })).getByRole("radio", { name: "0x3F8" }));
    commit("0x3F4");
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText(/✓ Legal burst\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /p_1kb_boundary \(old\)/ })).toHaveTextContent("fails at edge 1");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "HBURST" })).getByRole("radio", { name: "INCR4" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByText(/✕ INCR4 from 0x3F8 crosses the 1KB boundary at 0x400/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /p_incr_no_1kb_cross/ })).toHaveTextContent("fails at edge 4");
  });
});
