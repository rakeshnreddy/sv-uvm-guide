import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ClockingBlockSkewVisualizer from "@/components/visuals/ClockingBlockSkewVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const inputSkew = (name: string) => within(screen.getByRole("radiogroup", { name: "Input skew" })).getByRole("radio", { name });

const timelineLabel = () => screen.getByRole("img", { name: /Timeline from 0/ }).getAttribute("aria-label") ?? "";

describe("ClockingBlockSkewVisualizer", () => {
  it("hides the cb.dout row and the comparison until a prediction is locked in", () => {
    render(<ClockingBlockSkewVisualizer />);
    expect(timelineLabel()).not.toMatch(/cb\.dout holds/);
    expect(screen.queryByText(/cb\.dout = 2/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    lockIn(/^2: what dout holds after edge 2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/cb\.dout = 2/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(timelineLabel()).toMatch(/cb\.dout holds/);
  });

  it("diagnoses the 'new value' misconception with the default #1step skew", () => {
    render(<ClockingBlockSkewVisualizer />);
    lockIn(/^3: the value the DUT produces at edge 3/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/after the sample point/).length).toBeGreaterThan(0);
  });

  it("explicit #0 input skew samples in Observed and returns the value updated at the edge", () => {
    render(<ClockingBlockSkewVisualizer />);
    fireEvent.click(inputSkew("#0"));
    lockIn(/^3: the value the DUT produces at edge 3/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/Observed/).length).toBeGreaterThan(0);
  });

  it("a #2ns input skew misses a +9 ns path and returns the stale value", () => {
    render(<ClockingBlockSkewVisualizer />);
    fireEvent.click(inputSkew("#2ns"));
    fireEvent.click(screen.getByRole("radio", { name: "+9 ns path" }));
    lockIn(/^1: what dout holds after edge 1/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/cb\.dout = 1/)).toBeInTheDocument();
  });

  it("changing a control resets the prediction", () => {
    render(<ClockingBlockSkewVisualizer />);
    lockIn(/^2: what dout holds after edge 2/);
    expect(screen.getByRole("table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "+4 ns path" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("supports keyboard selection of the input skew", () => {
    render(<ClockingBlockSkewVisualizer />);
    const oneStep = inputSkew("#1step");
    oneStep.focus();
    fireEvent.keyDown(oneStep, { key: "ArrowRight" });
    expect(inputSkew("#0")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(inputSkew("#0"));
    expect(screen.getByText(/default input #0 output #0;/)).toBeInTheDocument();
  });

  it("shows the race of a raw read when the DUT updates with a blocking assignment", () => {
    render(<ClockingBlockSkewVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "blocking = at the edge" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getAllByText(/2 or 3 \(race\)/).length).toBeGreaterThan(0);
  });

  it("reports the compile error for ##1 without a default clocking (§14.11)", () => {
    render(<ClockingBlockSkewVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /show advanced/i }));
    fireEvent.click(screen.getByRole("radio", { name: "##1 cb.din <= v;" }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("alert")).toHaveTextContent(/§14\.11/);
  });
});
