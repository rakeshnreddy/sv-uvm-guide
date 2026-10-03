import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConstraintSolverVisualizer from "@/components/curriculum/interactives/ConstraintSolverVisualizer";

const next = () => fireEvent.click(screen.getByRole("button", { name: /next step/i }));

describe("ConstraintSolverVisualizer", () => {
  it("has a labelled scenario select and describes simultaneous, not sequential, solving", () => {
    render(<ConstraintSolverVisualizer />);
    expect(screen.getByLabelText("Scenario")).toBeInTheDocument();
    next();
    expect(screen.getByText(/There is no "first c_sum, then c_ne"/)).toBeInTheDocument();
    expect(screen.getByLabelText("A = 3, B = 1: removed, fails c_sum")).toBeInTheDocument();
    expect(screen.getByLabelText("A = 1, B = 1: removed, fails c_ne")).toBeInTheDocument();
    next();
    next();
    expect(screen.getByText(/P\(A = 0\) = 3\/8/)).toBeInTheDocument();
  });

  it("solve before: same legal cells, 1/13 joint vs 25% ordered, both from the model", () => {
    render(<ConstraintSolverVisualizer />);
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "solve_before" } });
    next();
    expect(screen.getByText(/13 legal pairs remain/)).toBeInTheDocument();
    next();
    expect(screen.getByLabelText("A = 0, B = 3: legal, probability 7.7%")).toBeInTheDocument();
    next();
    expect(screen.getByLabelText("A = 0, B = 3: legal, probability 25.0%")).toBeInTheDocument();
    expect(screen.getByLabelText("A = 1, B = 0: legal, probability 6.3%")).toBeInTheDocument();
  });

  it("soft example uses a real inline with constraint and drops the soft one", () => {
    render(<ConstraintSolverVisualizer />);
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "soft_hard" } });
    expect(screen.getByText("ok = p.randomize() with { B == 3; };")).toBeInTheDocument();
    expect(screen.queryByText(/From inline randomize with/)).not.toBeInTheDocument();
    next();
    next();
    next();
    expect(screen.getByLabelText("A = 3, B = 3: legal, probability 50.0%")).toBeInTheDocument();
  });

  it("the embedded interview answer comes from the model: P(A = 0) = 1/3", () => {
    render(<ConstraintSolverVisualizer />);
    expect(screen.getByText("33.3%, because there are 3 legal combinations.")).toBeInTheDocument();
  });
});
