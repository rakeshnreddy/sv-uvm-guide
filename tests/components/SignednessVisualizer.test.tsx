import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignednessVisualizer from "@/components/visuals/SignednessVisualizer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
const steps = () => screen.queryByRole("list", { name: "Evaluation steps" });
const code = () => within(screen.getByRole("list", { name: "The code" }));

describe("SignednessVisualizer (expression trap lab)", () => {
  it("hides the trace until a prediction is locked in, then diagnoses the ordinary-math answer", () => {
    render(<SignednessVisualizer />);
    expect(code().getByText("r = a + u;")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("r = 6"));
    lockIn();

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/ordinary integer math/).length).toBeGreaterThan(0);
    const list = steps();
    expect(list).toBeInTheDocument();
    // §11.8.2: a is zero-extended because u makes the expression unsigned.
    expect(within(list as HTMLElement).getByText(/Zero-extend/)).toBeInTheDocument();
    expect(within(list as HTMLElement).getByRole("img", { name: /a in context: 8-bit value 8'b0000_1100; bits 7 to 4 added by extension/ })).toBeInTheDocument();
    expect(screen.getByText(/ACT r = 22/)).toBeInTheDocument();
    expect(screen.getByText(/Differs from what the author meant/)).toBeInTheDocument();
  });

  it("the fix variant sign-extends a and matches the author's intent", () => {
    render(<SignednessVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "a + $signed(u)" }));
    expect(code().getByText("r = a + $signed(u);")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("r = 6"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(steps() as HTMLElement).getByText(/Sign-extend/)).toBeInTheDocument();
    expect(screen.getByText(/Matches what the author meant/)).toBeInTheDocument();
  });

  it("switches scenarios with the keyboard and re-asks for a prediction", () => {
    render(<SignednessVisualizer />);
    reveal();
    expect(steps()).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Trap scenario" });
    const checked = within(group).getByRole("radio", { checked: true });
    checked.focus();
    fireEvent.keyDown(checked, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("signed vs unsigned compare");
    expect(code().getByText("pos = a > 4'd0;")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
  });

  it("a > 4'd0 is true for a = -4 because the comparison is unsigned", () => {
    render(<SignednessVisualizer scenario="signed-compare" />);
    fireEvent.click(screen.getByLabelText("pos = 0"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Unsigned comparison: 12 > 0 is true/)).toBeInTheDocument();
  });

  it("the LHS width is part of the context: a 9-bit s keeps the carry", () => {
    render(<SignednessVisualizer scenario="lost-carry" />);
    fireEvent.click(screen.getByRole("radio", { name: "9-bit s = a8 + b8" }));
    expect(screen.getByText(/logic \[8:0\] s;/)).toBeInTheDocument();
    reveal();
    expect(screen.getByText(/ACT s = 300/)).toBeInTheDocument();
    expect(screen.getAllByText(/Zero-extend/).length).toBe(2);
  });

  it("editing an operand re-runs the model, regenerates the code and resets the prediction", () => {
    render(<SignednessVisualizer />);
    reveal();
    fireEvent.change(screen.getByLabelText(/Value of a/), { target: { value: "-1" } });
    expect(screen.getByText(/logic signed \[3:0\] a = -1;/)).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    // a = 4'b1111 zero-extends to 15, so 15 + 10 = 25 (ordinary math would say 9).
    expect(screen.getByLabelText("r = 25")).toBeInTheDocument();
    expect(screen.getByLabelText("r = 9")).toBeInTheDocument();
  });

  it("changing the operand width updates the declaration", () => {
    render(<SignednessVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "8-bit a" }));
    expect(screen.getByText(/logic signed \[7:0\] a = -4;/)).toBeInTheDocument();
  });

  it("int vs logic [31:0]: explains the unsigned 32-bit comparison", () => {
    render(<SignednessVisualizer scenario="int-vs-logic" />);
    reveal();
    expect(screen.getByText(/Unsigned comparison: 4294967295 < 1 is false/)).toBeInTheDocument();
  });

  it("x in arithmetic poisons the whole sum", () => {
    render(<SignednessVisualizer scenario="x-arith" />);
    fireEvent.click(screen.getByLabelText("r = 4'b1xx0"));
    lockIn();
    expect(screen.getAllByText(/pessimistic/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ACT r = 4'bxxxx/)).toBeInTheDocument();
  });
});
