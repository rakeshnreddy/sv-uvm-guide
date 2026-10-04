import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SvaSequenceWaveformVisualizer } from "@/components/visualizers/SvaSequenceWaveformVisualizer";

const predictionButton = (k: number) => screen.getByRole("button", { name: new RegExp(`^Attempt starting at edge ${k}: your prediction`) });
const attemptsGroup = () => screen.queryByRole("group", { name: "Attempts" });

describe("SvaSequenceWaveformVisualizer (SVA trace lab)", () => {
  it("hides results until the learner predicts and evaluates", () => {
    render(<SvaSequenceWaveformVisualizer />);
    expect(screen.getByTestId("sva-waveform-visualizer")).toBeInTheDocument();
    expect(attemptsGroup()).not.toBeInTheDocument();
    expect(screen.queryByText(/real pass/)).not.toBeInTheDocument();
    const evaluate = screen.getByRole("button", { name: /^Evaluate/ });
    expect(evaluate).toBeDisabled();

    fireEvent.click(predictionButton(1)); // PASS
    expect(evaluate).toBeEnabled();
    fireEvent.click(evaluate);

    expect(attemptsGroup()).toBeInTheDocument();
    expect(screen.getByText(/1 real pass · 1 fail · 9 vacuous · 1 pending · 0 disabled/)).toBeInTheDocument();
    expect(screen.getByText(/You predicted 1 attempt; 1 correct/)).toBeInTheDocument();
  });

  it("diagnoses a wrong prediction: a vacuous success is not a real pass", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(predictionButton(0)); // PASS, but req is 0 at edge 0 → vacuous
    fireEvent.click(screen.getByRole("button", { name: /^Evaluate/ }));
    expect(screen.getByText(/Your prediction \(PASS\)/)).toBeInTheDocument();
    expect(screen.getByText(/only a vacuous success/)).toBeInTheDocument();
  });

  it("explains a selected attempt step by step: which edge matched which element", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    fireEvent.click(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A6: FAIL at edge 8/ }));
    const steps = screen.getByRole("list", { name: /Step-by-step match for attempt A6/ });
    const items = within(steps).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/^edge 6.*matched:req.*req=1/);
    expect(items[1]).toMatch(/consequent starts at the same edge 6/);
    expect(items[items.length - 1]).toMatch(/^edge 8.*failed:##2 ack.*ack=0/);
  });

  it("toggling a trace cell from the keyboard re-runs the model and re-asks for predictions", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(predictionButton(6));
    const cell = screen.getByRole("button", { name: "ack at edge 8: 0. Toggle." });
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(screen.getByRole("button", { name: "ack at edge 8: 1. Toggle." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Evaluate/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A6: PASS at edge 8/ })).toBeInTheDocument();
  });

  it("switches presets with the arrow keys", () => {
    render(<SvaSequenceWaveformVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Property preset" });
    const current = within(group).getByRole("radio", { checked: true });
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("req |-> ##[1:3] ack");
  });

  it("debug mode: a bare sequence fails on idle edges until the implication is restored", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Debug: spot the bug/ }));
    expect(screen.getByText(/a_check: 2 real passes · 10 fails · 0 vacuous/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/The property is a bare sequence/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply the fix" }));
    expect(screen.getByText(/after the fix, a_check: 2 real passes · 0 fails · 10 vacuous/)).toBeInTheDocument();
  });

  it("custom mode reports parse errors instead of evaluating them as false", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Write your own/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Property/ }), { target: { value: "req |--> ack" } });
    fireEvent.click(screen.getByRole("button", { name: "Check property" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/is not an SVA operator/);
    expect(screen.queryByRole("button", { name: /^Evaluate/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /Property/ }), { target: { value: "req ##2 ack" } });
    fireEvent.click(screen.getByRole("button", { name: "Check property" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A0: FAIL at edge 0/ })).toBeInTheDocument();
  });
});
