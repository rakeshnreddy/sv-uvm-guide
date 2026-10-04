import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DynamicStructureVisualizer from "@/components/curriculum/f2/DynamicStructureVisualizer";

const stateBox = () => screen.getByTestId("container-state");
const codeBox = () => screen.getByTestId("container-code");
const op = (code: RegExp) => within(screen.getByRole("group", { name: "Operations" })).getByRole("button", { name: code });
const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("DynamicStructureVisualizer (container lab)", () => {
  it("§7.5.1: gates `buffer = new[6]` behind a prediction, then shows x-filled elements", () => {
    render(<DynamicStructureVisualizer />);
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();

    fireEvent.click(op(/^buffer = new\[6\]$/));
    // Prediction gate: the result is hidden until the learner commits.
    expect(screen.queryByText(/Apply and continue/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    // Operations are locked while a prediction is pending.
    expect(op(/^buffer\.delete\(\)$/)).toBeDisabled();

    lockIn(/^'\{0, 10, 20, 30\}$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/new\[N\] without \(buffer\) is destructive/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    const strip = within(stateBox()).getByRole("group", { name: /^buffer:/ });
    expect(strip.getAttribute("aria-label")).toBe("buffer: [0] x, [1] x, [2] x, [3] x, [4] x, [5] x");
    expect(within(codeBox()).getByText(/buffer = new\[6\];/)).toBeInTheDocument();
  });

  it("§7.5: push_back on a dynamic array is a compile error chip, not an append", () => {
    render(<DynamicStructureVisualizer />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^buffer\.push_back\(5\)/));
    const result = screen.getByTestId("container-result");
    expect(within(result).getByText(/Compile error: push_back\(\) is not a dynamic-array method/)).toBeInTheDocument();
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();
  });

  it("§7.10.5: push_front on a full q[$:3] discards the old tail with a required warning", () => {
    render(<DynamicStructureVisualizer initialKind="queue" />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^q\.push_back\(5\)$/)); // fills the queue: '{10, 20, 30, 5}
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^q\.push_front\(5\)$/));
    lockIn(/^'\{5, 10, 20, 30\}$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(screen.getByTestId("container-result")).getByText(/Warning \(required\):/)).toBeInTheDocument();
    expect(within(stateBox()).getByRole("group", { name: /^q:/ }).getAttribute("aria-label")).toMatch(/discarded 5$/);
  });

  it("§7.8.2: string keys iterate in character-code order, and a missing-key read warns without allocating", () => {
    render(<DynamicStructureVisualizer initialKind="assoc" />);
    fireEvent.click(op(/^found = scores\.first\(key\)$/));
    lockIn(/^"Gamma"$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(stateBox()).getByText(/key = "Gamma"/)).toBeInTheDocument();

    fireEvent.click(op(/^v = scores\["eve"\]$/));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(screen.getByTestId("container-result")).getByText(/Read of nonexistent key "eve"/)).toBeInTheDocument();
    expect(within(stateBox()).getByText(/num\(\) = 3/)).toBeInTheDocument();
  });

  it("is keyboard operable: arrow keys switch the structure", () => {
    render(<DynamicStructureVisualizer />);
    const dyn = screen.getByRole("radio", { name: "Dynamic array" });
    fireEvent.keyDown(dyn, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true");
    expect(op(/^q\.push_back\(5\)$/)).toBeInTheDocument();
  });

  it("undo restores the previous state", () => {
    render(<DynamicStructureVisualizer />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^buffer\.delete\(\)$/));
    expect(within(stateBox()).getByText(/Elements · size\(\) = 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Undo last operation/ }));
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();
  });
});
