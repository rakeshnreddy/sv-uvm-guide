import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FirstBugHuntGame from "@/components/curriculum/f1/FirstBugHuntGame";

const selectEdge = (k: number) => fireEvent.click(screen.getByRole("button", { name: `Select edge ${k}` }));

const solveStep1 = () => selectEdge(8);
const solveStep2 = () => fireEvent.click(screen.getByRole("button", { name: /Suspect line: else if \(count == 3'd6\)/ }));

describe("FirstBugHuntGame", () => {
  it("shows code that matches the waveform: the wrap branch compares with 3'd6 and count never reaches 7", () => {
    render(<FirstBugHuntGame />);
    // The screen-reader table repeats the sampled values of the waveform.
    const table = screen.getAllByRole("table")[0];
    const countRow = within(table).getByRole("row", { name: /^count/ });
    const cells = within(countRow).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["X", "0", "1", "2", "3", "4", "5", "6", "0", "1", "2", "3"]);
    expect(cells).not.toContain("7");
  });

  it("gives diagnostic feedback for wrong edges and unlocks step 2 only on the first failing edge", () => {
    render(<FirstBugHuntGame />);
    expect(screen.queryByText("up_counter.sv (design under test)")).not.toBeInTheDocument();

    selectEdge(7);
    expect(screen.getByText(/Edge 7: Not this one/)).toBeInTheDocument();
    expect(screen.getByText(/Look one edge later/)).toBeInTheDocument();
    expect(screen.queryByText("up_counter.sv (design under test)")).not.toBeInTheDocument();

    selectEdge(10);
    expect(screen.getByText(/not the first one/)).toBeInTheDocument();

    solveStep1();
    expect(screen.getByText(/Edge 8: Found it/)).toBeInTheDocument();
    expect(screen.getByText(/The spec expects 7 \(one more than 6\), but the counter shows 0/)).toBeInTheDocument();
    expect(screen.getByText("up_counter.sv (design under test)")).toBeInTheDocument();
  });

  it("edge selection works from the keyboard", () => {
    render(<FirstBugHuntGame />);
    const edge8 = screen.getByRole("button", { name: "Select edge 8" });
    expect(edge8).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(edge8, { key: "Enter" });
    expect(screen.getByText(/Edge 8: Found it/)).toBeInTheDocument();
  });

  it("diagnoses wrong suspect lines, accepts the wrap comparison, and the fix makes the model match the spec", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: else\s+count <= count \+ 3'd1;/ }));
    expect(screen.getByText(/Not this line/)).toBeInTheDocument();
    expect(screen.getByText(/the branch above it wins/)).toBeInTheDocument();
    expect(screen.queryByText(/Which concurrent assertion/)).not.toBeInTheDocument();

    solveStep2();
    expect(screen.getByText(/off by one/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Apply the fix/ }));
    expect(screen.getByText(/all 11 checked edges match the spec/)).toBeInTheDocument();
  });

  it("hides the assertion results until the learner commits, then explains a vacuous choice", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    expect(screen.getByText(/Which concurrent assertion/)).toBeInTheDocument();
    expect(screen.queryByText(/Model result for every option/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /count == 3'd7 \|=> count == 3'd0/ }));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/passes vacuously/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Model result for every option/)).toBeInTheDocument();
    // The correct property fails at the same edge the learner found in step 1.
    const catchRow = screen.getByRole("row", { name: /count == 3'd6 \|=> count == 3'd7/ });
    expect(catchRow).toHaveTextContent(/fails at edge 8/);
    const sameCycleRow = screen.getByRole("row", { name: /count == 3'd6 \|-> count == 3'd7/ });
    expect(sameCycleRow).toHaveTextContent(/false alarm/);
  });

  it("start over resets every step", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByText("up_counter.sv (design under test)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Which concurrent assertion/)).not.toBeInTheDocument();
  });
});
