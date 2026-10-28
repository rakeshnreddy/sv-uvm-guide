import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FirstBugHuntGame from "@/components/curriculum/f1/FirstBugHuntGame";

const selectEdge = (k: number) => fireEvent.click(screen.getByRole("button", { name: `Select edge ${k}` }));

const solveStep1 = () => selectEdge(8);
const solveStep2 = () => fireEvent.click(screen.getByRole("button", { name: /Suspect line: else if \(count == 3'd6\)/ }));
const commitStep3 = (name: RegExp = /count == 3'd6 \|=> count == 3'd7/) => {
  fireEvent.click(screen.getByRole("radio", { name }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const reachStep4 = (name?: RegExp) => {
  solveStep1();
  solveStep2();
  commitStep3(name);
  return screen.getByTestId("first-bug-hunt-tally");
};
const commitTally = (step4: HTMLElement, name: RegExp) => {
  fireEvent.click(within(step4).getByRole("radio", { name }));
  fireEvent.click(within(step4).getByRole("button", { name: /lock in prediction/i }));
};
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

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
    expect(screen.getAllByText(/vacuous success: not a pass or a failure \(§16\.14\.8\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Model result for every option/)).toBeInTheDocument();
    // The correct property fails at the same edge the learner found in step 1.
    const catchRow = screen.getByRole("row", { name: /count == 3'd6 \|=> count == 3'd7/ });
    expect(catchRow).toHaveTextContent(/fails at edge 8/);
    const sameCycleRow = screen.getByRole("row", { name: /count == 3'd6 \|-> count == 3'd7/ });
    expect(sameCycleRow).toHaveTextContent(/false alarm/);
  });

  it("a failure on the buggy counter is not called a catch unless it is the bug: the same-cycle check fires at edge 7, where 6 is still correct", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    commitStep3();

    const catchCell = screen.getByTestId("bug-catch-catch");
    expect(catchCell).toHaveTextContent(/fails at edge 8 \(catches the bug\)/);
    expect(catchCell).toHaveClass("text-emerald-700");

    const sameCycleCell = screen.getByTestId("bug-catch-same-cycle");
    expect(sameCycleCell).toHaveTextContent(/fails at edge 7 \(at edge 7 the sample, 6, still matches the spec: not the bug\)/);
    expect(sameCycleCell).not.toHaveTextContent(/catches the bug/);
    expect(sameCycleCell).toHaveClass("text-rose-700");
    const sameCycleRow = screen.getByRole("row", { name: /count == 3'd6 \|-> count == 3'd7/ });
    expect(sameCycleRow).not.toHaveTextContent(/catches the bug/);

    // Only the row that is graded as catching the bug says so.
    expect(screen.getAllByText(/catches the bug/)).toHaveLength(1);
  });

  it("the tautology feedback keeps the X nuance: only disable iff (rst) hides the X before reset", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    commitStep3(/disable iff \(rst\) count <= 3'd7\);/);
    expect(screen.getByText(/Every known 3-bit value is at most 7, and disable iff \(rst\) masks the X before reset, so this property can never fail here\./)).toBeInTheDocument();
    expect(screen.queryByText(/restates what the type already guarantees/)).not.toBeInTheDocument();
  });

  it("start over resets every step", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByText("up_counter.sv (design under test)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Which concurrent assertion/)).not.toBeInTheDocument();
  });

  it("never calls a vacuous success a pass anywhere in the game (IEEE 1800-2023 §16.14.8)", () => {
    render(<FirstBugHuntGame />);
    const step4 = reachStep4(/count == 3'd7 \|=> count == 3'd0/);
    commitTally(step4, /^None\./);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/passes vacuously|passed vacuously|vacuous pass/);
    expect(text).toMatch(/vacuous success: not a pass or a failure \(§16\.14\.8\)/);
  });

  it("step 4 unlocks only after step 3 is revealed, and keeps the tally hidden until the learner predicts", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    expect(screen.queryByTestId("first-bug-hunt-tally")).not.toBeInTheDocument();
    expect(screen.getByText(/Step 4 \(did the check ever run\?\) unlocks/)).toBeInTheDocument();

    commitStep3();
    const step4 = screen.getByTestId("first-bug-hunt-tally");
    expect(within(step4).getByText(/how many/)).toBeInTheDocument();
    expect(within(step4).getByText("assert property (@(posedge clk) disable iff (rst) count == 3'd7 |=> count == 3'd0);")).toBeInTheDocument();
    expect(within(step4).queryByText(/Attempt tally/)).not.toBeInTheDocument();
    expect(within(step4).queryByRole("table")).not.toBeInTheDocument();
    // Step 3 states the verdict of the vacuous rule without leaking its tally.
    const wrapRow = screen.getByRole("row", { name: /count == 3'd7 \|=> count == 3'd0/ });
    expect(wrapRow).toHaveTextContent(/never fails\. Did it ever check anything\?/);
    expect(wrapRow).not.toHaveTextContent(/nonvacuous|vacuous success/);
  });

  it("'every attempt' gets diagnostic feedback, then the tally and the antecedent cover are revealed", () => {
    render(<FirstBugHuntGame />);
    const step4 = reachStep4();
    expect(within(step4).getByText(/Step 3 also offered this rule/)).toBeInTheDocument();
    commitTally(step4, /^Every attempt\./);

    expect(within(step4).getByText(/Not quite/)).toBeInTheDocument();
    expect(within(step4).getByText(/No failures does not mean every attempt passed\. 11 of the 12 attempts are vacuous successes/)).toBeInTheDocument();

    const table = within(step4).getByRole("table", { name: /Attempt tally, 12 edges per run/ });
    const row = (name: RegExp) => cellsOf(within(table).getByRole("row", { name }));
    expect(row(/^Attempts/)).toEqual(["12", "12"]);
    expect(row(/Nonvacuous successes/)).toEqual(["0", "1"]);
    expect(row(/^○ Vacuous successes|Vacuous successes: not a pass or a failure/)).toEqual(["11", "10"]);
    expect(row(/Failures/)).toEqual(["0", "0"]);
    expect(row(/Disabled by rst/)).toEqual(["1", "1"]);
    expect(within(table).queryByRole("row", { name: /Still open/ })).not.toBeInTheDocument();
    // Companion cover row: 0 hits on the buggy counter, 1 (edge 8) on the fixed one.
    expect(row(/cover property \(@\(posedge clk\) count == 3'd7\);/)).toEqual(["0", "1edge 8"]);
  });

  it("'same as fixed' and 'none' get their own feedback; 'none' is the correct answer", () => {
    const { unmount } = render(<FirstBugHuntGame />);
    let step4 = reachStep4();
    commitTally(step4, /^The same number as on the fixed counter/);
    expect(within(step4).getByText(/The tally depends on the run, not only on the assertion text\. The fixed counter matches the antecedent at edge 8/)).toBeInTheDocument();
    unmount();

    render(<FirstBugHuntGame />);
    step4 = reachStep4(/count == 3'd7 \|=> count == 3'd0/);
    expect(within(step4).getByText(/You chose this rule in step 3/)).toBeInTheDocument();
    commitTally(step4, /^None\./);
    expect(within(step4).getByText(/Correct\./)).toBeInTheDocument();
    expect(within(step4).getByText(/which leaves 0 nonvacuous successes/)).toBeInTheDocument();
  });

  it("the run switch moves the waveform and its live summary between counters, from the keyboard too", () => {
    render(<FirstBugHuntGame />);
    const step4 = reachStep4();
    commitTally(step4, /^None\./);

    const summary = within(step4).getByText(/The check never ran\./);
    expect(summary).toHaveAttribute("aria-live", "polite");
    expect(summary).toHaveTextContent(/Buggy counter: never fails, but no attempt completed a real check \(11 vacuous successes, 1 disabled, 0 nonvacuous\)\./);
    expect(summary).toHaveTextContent(/cover property \(@\(posedge clk\) count == 3'd7\); hits 0 times\./);
    const waveTable = () => within(step4).getByRole("table", { name: /attempts of the rule and hits of its cover: value sampled at each edge/ });
    const coverRowBuggy = within(waveTable()).getByRole("row", { name: /^cover/ });
    expect(cellsOf(coverRowBuggy).every((v) => v === "0")).toBe(true);

    const group = within(step4).getByRole("radiogroup", { name: "Show the run on" });
    const buggyRadio = within(group).getByRole("radio", { name: "Buggy counter" });
    fireEvent.keyDown(buggyRadio, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "Fixed counter" })).toHaveAttribute("aria-checked", "true");

    expect(within(step4).getByText(/hits 1 time \(edge 8\)\. The check ran 1 time\./)).toBeInTheDocument();
    expect(within(step4).getByRole("group", { name: /Fixed counter: attempts of the rule and hits of its cover/ })).toBeInTheDocument();
    const coverRowFixed = within(waveTable()).getByRole("row", { name: /^cover/ });
    expect(cellsOf(coverRowFixed)).toEqual(["0", "0", "0", "0", "0", "0", "0", "0", "1", "0", "0", "0"]);
  });

  it("the step-4 caption says the markers show one event per edge while the tally counts every attempt", () => {
    render(<FirstBugHuntGame />);
    const step4 = reachStep4();
    commitTally(step4, /^None\./);
    const vacuousMarkers = () => Array.from(step4.querySelectorAll("svg title")).filter((t) => /is a vacuous success/.test(t.textContent ?? "")).length;
    const caption = () => step4.querySelector("figcaption")?.textContent ?? "";

    // Buggy counter: every vacuous attempt has its own ○ marker.
    expect(vacuousMarkers()).toBe(11);
    expect(caption()).toMatch(/One marker per edge, the most important event wins\. The tally counts every attempt\./);

    // Fixed counter: the ✓ at edge 9 hides that edge's own vacuous attempt, so 9 markers stand for 10 vacuous successes.
    fireEvent.click(within(step4).getByRole("radio", { name: "Fixed counter" }));
    expect(vacuousMarkers()).toBe(9);
    expect(caption()).toMatch(/this run shows 9 ○ markers for 10 vacuous successes, because one shares its edge with a more important marker\. The tally counts every attempt\./);
    const table = within(step4).getByRole("table", { name: /Attempt tally/ });
    expect(cellsOf(within(table).getByRole("row", { name: /Vacuous successes: not a pass or a failure/ }))).toEqual(["11", "10"]);
  });

  it("revealing step 3 without predicting also unlocks step 4", () => {
    render(<FirstBugHuntGame />);
    solveStep1();
    solveStep2();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("first-bug-hunt-tally")).toBeInTheDocument();
  });

  it("start over also resets step 4", () => {
    render(<FirstBugHuntGame />);
    const step4 = reachStep4();
    commitTally(step4, /^None\./);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("first-bug-hunt-tally")).not.toBeInTheDocument();
    reachStep4();
    expect(within(screen.getByTestId("first-bug-hunt-tally")).queryByRole("table")).not.toBeInTheDocument();
  });
});
