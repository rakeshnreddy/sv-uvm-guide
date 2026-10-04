import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConstraintSolverHeatmapVisualizer } from "@/components/visualizers/ConstraintSolverHeatmapVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const scenario = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));

describe("ConstraintSolverHeatmapVisualizer", () => {
  it("hides the solution space until a prediction is locked in, then diagnoses the independent-variable misconception", () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByText("constraint c_sum { x + y < 8; }", { exact: false })).toBeInTheDocument();

    lockIn(/12\.5%: x has 8 values/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/x = 0 owns 8 of the 36 pairs/)).toBeInTheDocument();
    expect(screen.getByText(/36 of 64 pairs are legal\. P\(x = 0\) = 22\.2% \(2\/9\)/)).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("solve x before y changes the odds but not the legal cells, and re-asks for a prediction", () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    const order = screen.getByRole("button", { name: "Constraint c_order" });
    expect(order).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("p.c_order.constraint_mode(0);", { exact: false })).toBeInTheDocument();
    fireEvent.click(order);
    expect(order).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("p.c_order.constraint_mode(0);", { exact: false })).not.toBeInTheDocument();

    lockIn(/22\.2%: count x = 0's share/);
    expect(screen.getByText(/That is the joint-uniform answer/)).toBeInTheDocument();
    expect(screen.getByText(/36 of 64 pairs are legal\. P\(x = 0\) = 12\.5% \(1\/8\)/)).toBeInTheDocument();

    // Changing the code resets the prediction gate.
    fireEvent.click(order);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("lets keyboard users read every cell's exact probability", () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    const grid = screen.getByRole("grid");
    const start = within(grid).getAllByRole("gridcell").find((c) => c.getAttribute("tabindex") === "0") as HTMLElement;
    expect(start).toHaveAccessibleName("x = 0, y = 7: legal, P = 2.8% (1/36)");
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(document.activeElement).toHaveAccessibleName("x = 1, y = 7: illegal pair");
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toHaveAccessibleName("x = 1, y = 6: legal, P = 2.8% (1/36)");
    expect(screen.getByText(/Selected:/).parentElement).toHaveTextContent("x = 1, y = 6: legal");
  });

  it("samples N randomize() calls beside the exact distribution, deterministically", () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByRole("table")).toHaveTextContent("22.2%");
    fireEvent.click(screen.getByRole("button", { name: /Run randomize\(\) 1,000 times/ }));
    expect(screen.getByText(/0 of 1,000 calls returned 0/)).toBeInTheDocument();
    expect(screen.getByText("seed 2027")).toBeInTheDocument();
  });

  it("teaches := vs :/ and that dist is a membership test", () => {
    render(<ConstraintSolverHeatmapVisualizer initialScenario="dist" />);
    expect(screen.getByText("x dist { 0 := 4, [1:3] := 4 };", { exact: false })).toBeInTheDocument();
    lockIn(/50\.0%: the :\/ reading/);
    expect(screen.getByText(/That is how :\/ would read it/)).toBeInTheDocument();
    expect(screen.getByText(/P\(x = 0\) = 25\.0% \(1\/4\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /:\/ shares the weight/ }));
    expect(screen.getByText("x dist { 0 := 4, [1:3] :/ 4 };", { exact: false })).toBeInTheDocument();
    lockIn(/50\.0% \(1\/2\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Constraint c_big" }));
    lockIn(/randomize\(\) fails/);
    expect(screen.getByText(/randomize\(\) returns 0: no \(x, y\) pair/)).toBeInTheDocument();
    expect(screen.getAllByText("✕ conflict")).toHaveLength(2);
  });

  it("treats soft as a priority, not a probability", () => {
    render(<ConstraintSolverHeatmapVisualizer initialScenario="soft" />);
    lockIn(/About 90%/);
    expect(screen.getByText(/soft is a priority, not a probability/)).toBeInTheDocument();
    expect(screen.getByText(/P\(x = 0\) = 100\.0%/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Constraint c_late" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/c_late is declared later, so it outranks c_def/)).toBeInTheDocument();
    expect(screen.getByText(/discarded: outranked by soft x == 5;/)).toBeInTheDocument();
  });

  it("debug mode finds the minimal conflict and clears an innocent constraint", () => {
    render(<ConstraintSolverHeatmapVisualizer initialScenario="debug" />);
    lockIn(/Yes: it returns 1/);
    expect(screen.getByText(/these cannot hold together: x \+ y < 6;/)).toBeInTheDocument();
    expect(screen.getByText(/Not part of this conflict: y % 2 == 1;/)).toBeInTheDocument();
    expect(screen.getAllByText("✕ conflict")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Constraint c_x" }));
    lockIn(/Yes: it returns 1/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("scenario picker is a keyboard radio group", () => {
    render(<ConstraintSolverHeatmapVisualizer />);
    const coupled = screen.getByRole("radio", { name: /Coupled variables/ });
    fireEvent.keyDown(coupled, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /Implication/ })).toHaveAttribute("aria-checked", "true");
    scenario(/Debug a failure/);
    expect(screen.getByText(/Will/)).toBeInTheDocument();
  });
});
