import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LogicStateDiagram from "@/components/visuals/LogicStateDiagram";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const tab = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));

describe("LogicStateDiagram (four-state explorer)", () => {
  it("shows the four-value picture and declares itself a model", () => {
    render(<LogicStateDiagram />);
    expect(screen.getByRole("region", { name: /four-state value explorer/i })).toBeInTheDocument();
    expect(screen.getByText(/The simulator cannot tell 0 from 1/)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
  });

  it("hides the operator result until a prediction is locked in, then diagnoses 'x & 0 = x'", () => {
    render(<LogicStateDiagram />);
    // Default case: a = x, b = 0, operator &.
    expect(screen.queryByText(/controlling value of &/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Table 11-11/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/decides the result on its own/)).toBeInTheDocument();
    expect(screen.getAllByText(/controlling value of &/).length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: /Table 11-11/ });
    const current = table.querySelector('[aria-current="true"]');
    expect(current?.textContent).toContain("0");
  });

  it("changing an operand with the keyboard re-asks the prediction", () => {
    render(<LogicStateDiagram />);
    fireEvent.click(screen.getByLabelText(/y = 1'b0/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Value of b" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "0" }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "1" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("== with a known differing bit is 0, while === and ==? are shown after the reveal", () => {
    render(<LogicStateDiagram />);
    tab(/== vs ===/);
    fireEvent.click(screen.getByLabelText(/a == b is 1'bx/));
    lockIn();
    expect(screen.getByText(/does not automatically poison/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bit 3 is known in both operands and differs/).length).toBeGreaterThan(0);
    expect(screen.getByText(/=== compares x and z literally/)).toBeInTheDocument();
  });

  it("bit editors keep keyboard focus on the bit while it cycles", () => {
    render(<LogicStateDiagram />);
    tab(/== vs ===/);
    const bit = screen.getByRole("button", { name: /^a\[2\] is x/ });
    bit.focus();
    fireEvent.click(bit);
    const after = screen.getByRole("button", { name: /^a\[2\] is z/ });
    expect(after).toBe(bit);
    expect(document.activeElement).toBe(after);
  });

  it("if (a) and if (!a) both take the else branch when a is x", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByLabelText(/y = 1'b0/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/X-optimism/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "if (!a)" }));
    fireEvent.click(screen.getByLabelText(/y = 1'b1/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/!x is x|!x is still x/).length).toBeGreaterThan(0);
  });

  it("?: with an x condition gives x, not a branch", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByRole("radio", { name: "a ? 1 : 0" }));
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/Table 11-20/).length).toBeGreaterThan(0);
  });

  it("casex lets an x select run branch A, while case falls to default", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByRole("radio", { name: "casex" }));
    fireEvent.click(screen.getByLabelText(/Branch A/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/casex treats x in the case expression as a do-not-care/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "case" }));
    fireEvent.click(screen.getByLabelText(/Branch A/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/compares x and z literally/).length).toBeGreaterThan(0);
  });

  it("assigning 4'b1x0z to bit [3:0] gives 4'b1000 and explains §6.11.2", () => {
    render(<LogicStateDiagram />);
    tab(/Into 2-state/);
    expect(screen.queryByText(/became 0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/t = 4'b1x0z/));
    lockIn();
    expect(screen.getByText(/A 2-state variable has no encoding for x or z/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bits 2, 0 became 0/).length).toBeGreaterThan(0);
    expect(screen.getByText(/After the copy the evidence is gone/)).toBeInTheDocument();
  });

  it("int targets are 32 bits wide", () => {
    render(<LogicStateDiagram />);
    tab(/Into 2-state/);
    fireEvent.click(screen.getByRole("radio", { name: "int" }));
    expect(screen.getByLabelText(/t = 32'b0…01000 \(8\)/)).toBeInTheDocument();
  });
});
