import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  BitStrip,
  EXPLORED_SCOPE,
  MutationMatrix,
  OutcomeGroups,
  ReorderList,
  SCHEDULER_CLAUSE_NOTE,
  SCHEDULER_CLAUSE_NOTES,
  binaryText,
  bitValueText,
  cellKey,
  columnVerdict,
  describeBits,
  findFirstDivergentLine,
  gradePrediction,
  matrixProblems,
  moveInOrder,
  nextPrediction,
  normalizeOrder,
  notGradedText,
  outcomeProblems,
  outcomeSummary,
  predictionStatus,
  revealSummary,
  scorePredictions,
  type MutationCell,
  type MutationPrediction,
  type OutcomeGroup,
  type ReorderItem,
  type ReorderMark,
} from "@/components/visual-system";

// ---------------------------------------------------------------------------
// ReorderList
// ---------------------------------------------------------------------------

const steps: ReorderItem[] = [
  { id: "a", label: "Reproduce the failure" },
  { id: "b", label: "Find the first wrong value", description: "Walk back from the mismatch." },
  { id: "c", label: "Fix and rerun" },
];

function ReorderHarness({ lockedIds, marks, initial = ["a", "b", "c"] }: { lockedIds?: string[]; marks?: Record<string, ReorderMark>; initial?: string[] }) {
  const [order, setOrder] = useState(initial);
  return (
    <>
      <ReorderList items={steps} order={order} onChange={setOrder} label="Order the debug steps" lockedIds={lockedIds} marks={marks} />
      <p data-testid="order">{order.join(",")}</p>
    </>
  );
}

const rowTexts = () => within(screen.getByRole("list", { name: "Order the debug steps" })).getAllByRole("listitem").map((li) => li.textContent ?? "");

describe("ReorderList", () => {
  it("moves with the keyboard, announces the new position and keeps focus on the moved row", async () => {
    const user = userEvent.setup();
    render(<ReorderHarness />);
    const down = screen.getByRole("button", { name: "Move down: Reproduce the failure" });
    down.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("order")).toHaveTextContent("b,a,c");
    expect(screen.getByRole("status")).toHaveTextContent("Reproduce the failure moved to position 2 of 3");
    expect(screen.getByRole("button", { name: "Move down: Reproduce the failure" })).toHaveFocus();

    // Space moves again; at the bottom the Move down button disables and focus moves to Move up.
    await user.keyboard(" ");
    expect(screen.getByTestId("order")).toHaveTextContent("b,c,a");
    expect(screen.getByRole("status")).toHaveTextContent("Reproduce the failure moved to position 3 of 3");
    expect(screen.getByRole("button", { name: "Move down: Reproduce the failure" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move up: Reproduce the failure" })).toHaveFocus();
    expect(rowTexts()[2]).toContain("Reproduce the failure");
  });

  it("a rejected move is never announced, even when a later order change equals the order it asked for", () => {
    const onChange = vi.fn();
    const props = { items: steps, onChange, label: "Order the debug steps" };
    const { rerender } = render(<ReorderList {...props} order={["a", "b", "c"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move down: Reproduce the failure" }));
    expect(onChange).toHaveBeenCalledWith(["b", "a", "c"]);
    // The caller rejected the move: the order is unchanged and nothing is announced.
    expect(screen.getByRole("status").textContent).toBe("");

    // The next order change, a reset that happens to give the rejected move's order, is not that move:
    // it neither announces the stale move nor pulls focus to its row.
    screen.getByRole("button", { name: "Move up: Fix and rerun" }).focus();
    rerender(<ReorderList {...props} order={["b", "a", "c"]} />);
    expect(rowTexts()[1]).toContain("Reproduce the failure");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Move up: Fix and rerun" })).toHaveFocus();

    // Nor does any later order change.
    rerender(<ReorderList {...props} order={["a", "c", "b"]} />);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Move up: Fix and rerun" })).toHaveFocus();
  });

  it("a shuffle after a rejected move does not announce it, while an applied move still is", async () => {
    const user = userEvent.setup();
    function RejectingHarness() {
      const [order, setOrder] = useState(["a", "b", "c"]);
      const [accept, setAccept] = useState(false);
      return (
        <>
          <ReorderList items={steps} order={order} onChange={(next) => (accept ? setOrder(next) : undefined)} label="Order the debug steps" />
          <button type="button" onClick={() => setOrder(["b", "a", "c"])}>
            Shuffle
          </button>
          <button type="button" onClick={() => setAccept(true)}>
            Accept moves
          </button>
        </>
      );
    }
    render(<RejectingHarness />);
    await user.click(screen.getByRole("button", { name: "Move down: Reproduce the failure" }));
    expect(screen.getByRole("status").textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(rowTexts()[1]).toContain("Reproduce the failure");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveFocus();

    // Once the caller applies moves in the same update, they are announced and focus follows the row.
    await user.click(screen.getByRole("button", { name: "Accept moves" }));
    await user.click(screen.getByRole("button", { name: "Move up: Fix and rerun" }));
    expect(screen.getByRole("status")).toHaveTextContent("Fix and rerun moved to position 2 of 3");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Fix and rerun moved to position 1 of 3");
    // Move up is disabled at the top, so focus lands on the row's Move down.
    expect(screen.getByRole("button", { name: "Move up: Fix and rerun" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: Fix and rerun" })).toHaveFocus();
  });

  it("disables Move up on the first row and Move down on the last, with 40 px targets and no drag-only path", () => {
    render(<ReorderHarness />);
    expect(screen.getByRole("button", { name: "Move up: Reproduce the failure" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: Reproduce the failure" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move down: Fix and rerun" })).toBeDisabled();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("h-10", "w-10");
      expect(button).not.toHaveAttribute("draggable", "true");
    }
  });

  it("locked rows stay put and other rows move past them", () => {
    render(<ReorderHarness lockedIds={["b"]} />);
    expect(screen.queryByRole("button", { name: /Find the first wrong value/ })).not.toBeInTheDocument();
    expect(screen.getByText("Fixed position")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move down: Reproduce the failure" }));
    expect(screen.getByTestId("order")).toHaveTextContent("c,b,a");
    expect(screen.getByRole("status")).toHaveTextContent("Reproduce the failure moved to position 3 of 3");
  });

  it("shows marks with a glyph and text, not colour alone, only when the caller passes them", () => {
    const { rerender } = render(<ReorderHarness />);
    expect(screen.queryByText(/correct position|wrong position/)).not.toBeInTheDocument();
    rerender(<ReorderHarness marks={{ a: "correct", b: "wrong" }} />);
    expect(rowTexts()[0]).toContain("✓ correct position");
    expect(rowTexts()[1]).toContain("✕ wrong position");
  });

  it("moveInOrder swaps with the nearest unlocked neighbour and refuses moves off the ends", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b", "c"], "c", "down")).toBeNull();
    expect(moveInOrder(["a", "b", "c"], "a", "down", ["b"])).toEqual(["c", "b", "a"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down", ["b"])).toBeNull();
    expect(moveInOrder(["a", "b", "c"], "a", "down", ["b", "c"])).toBeNull();
    expect(normalizeOrder(steps, ["c", "zz", "c", "a"])).toEqual(["c", "a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// OutcomeGroups
// ---------------------------------------------------------------------------

const raceGroups: OutcomeGroup[] = [
  {
    id: "g1",
    title: "Outcome 1",
    runCount: 1,
    lines: [
      { time: "t = 10 ns", text: "q1 = d" },
      { time: "t = 10 ns", text: "q2 = q1" },
    ],
    endState: "q1 = 1, q2 = 1",
    badge: "✕ differs from flip-flop hardware",
  },
  {
    id: "g2",
    title: "Outcome 2",
    runCount: 1,
    lines: [
      { time: "t = 10 ns", text: "q2 = q1" },
      { time: "t = 10 ns", text: "q1 = d" },
    ],
    endState: "q1 = 1, q2 = 0",
    badge: "✓ matches flip-flop hardware",
  },
];

describe("OutcomeGroups", () => {
  const oneGroup: OutcomeGroup[] = [{ id: "only", title: "q = 1", runCount: 6, lines: [{ text: "q <= d" }], endState: "q = 1" }];

  it("one group in the default region-order mode claims only the orders of the ready processes, citing IEEE 1800-2023 §4.7", () => {
    render(<OutcomeGroups runCount={6} groups={oneGroup} />);
    expect(screen.getByText("Same outcome in every order of the ready processes (6 orders run)")).toBeInTheDocument();
    expect(screen.queryByText("Scheduler choice")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 outcome from 6 legal orders: no order of the ready processes changes the result.");
    expect(screen.getByText(/IEEE 1800-2023 §4\.7/)).toHaveTextContent("§4.7 also allows interleaving, which this model does not run.");
    expect(screen.getByText(/IEEE 1800-2023 §4\.7/)).toHaveTextContent("Here no order of the ready processes changes the result.");
    // A model that does not interleave has not run every legal order (§4.7), so no text claims it did.
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("no legal order changes");
    expect(text).not.toContain("every legal order");
    expect(text).not.toMatch(/random/i);
  });

  it("one group in interleaving mode claims only the interleavings explored", () => {
    render(<OutcomeGroups runCount={6} groups={oneGroup} nondeterminism="interleaving" />);
    expect(screen.getByText("Same outcome in every interleaving explored (6 orders run)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 outcome from 6 legal orders: no interleaving explored changes the result.");
    expect(screen.getByText(/IEEE 1800-2023 §4\.7/)).toHaveTextContent("so other legal orders may exist");
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("no legal order changes");
    expect(text).not.toContain("every legal order");
  });

  it("only a model that explores both §4.7 sources says 'every legal order'", () => {
    render(<OutcomeGroups runCount={6} groups={oneGroup} nondeterminism="both" />);
    expect(screen.getByText("Same outcome in every legal order (6 orders run)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 outcome from 6 legal orders: no legal order changes the result.");
    expect(screen.getByText(/IEEE 1800-2023 §4\.7/)).toHaveTextContent("Here no legal order changes the result.");

    expect(outcomeSummary(1, 6)).toBe("1 outcome from 6 legal orders: no order of the ready processes changes the result.");
    expect(outcomeSummary(1, 6, false, "interleaving")).toBe("1 outcome from 6 legal orders: no interleaving explored changes the result.");
    expect(outcomeSummary(1, 6, false, "both")).toBe("1 outcome from 6 legal orders: no legal order changes the result.");
    expect(outcomeSummary(1, 6, true, "both")).toBe("1 outcome from the 6 legal orders run.");
    expect(outcomeSummary(2, 6)).toBe("2 different outcomes from 6 legal orders: the result depends on the scheduler's choice.");
    expect(EXPLORED_SCOPE.both.every).toBe("every legal order");
    expect(EXPLORED_SCOPE["region-order"].every).not.toContain("legal");
    expect(EXPLORED_SCOPE.interleaving.every).not.toContain("legal");
  });

  it("two outcomes sit under the Scheduler choice badge, mark the first differing line in each card, and load a run on select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OutcomeGroups runCount={2} groups={raceGroups} onSelect={onSelect} selectedId="g1" />);
    expect(screen.getByText("Scheduler choice")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 different outcomes from 2 legal orders: the result depends on the scheduler's choice.");

    const first = screen.getByRole("button", { name: /^Outcome 1, 1 of 2 orders/ });
    const second = screen.getByRole("button", { name: /^Outcome 2, 1 of 2 orders/ });
    expect(first).toHaveAccessibleName(expect.stringContaining("first difference at line 1"));
    expect(first).toHaveAccessibleDescription(expect.stringContaining("q1 = d"));
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");
    for (const card of [first, second]) {
      const marked = within(card).getByText("≠ first difference");
      expect(marked.parentElement).toHaveTextContent(card === first ? "q1 = d" : "q2 = q1");
    }

    second.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("g2");
  });

  it("finds the first divergent line from the data when the caller does not pass it", () => {
    expect(findFirstDivergentLine(raceGroups)).toBe(0);
    const same = [{ text: "a" }, { text: "b" }];
    expect(findFirstDivergentLine([{ lines: same }, { lines: [...same, { text: "c" }] }])).toBe(2);
    expect(findFirstDivergentLine([{ lines: same }, { lines: [{ text: "a" }, { time: "t = 5 ns", text: "b" }] }])).toBe(1);
    expect(findFirstDivergentLine([{ lines: same }])).toBeUndefined();
  });

  it("a capped run shows the notice instead of throwing and does not claim every legal order", () => {
    render(<OutcomeGroups runCount={120} capped groups={[{ id: "only", title: "done", runCount: 120, lines: [{ text: "all threads finish" }] }]} />);
    expect(screen.getByText(/Capped at 120 orders; more legal orders exist/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Capped at 120 orders; more legal orders exist");
    expect(screen.getByText("Same outcome in all 120 legal orders run")).toBeInTheDocument();
    expect(screen.queryByText(/every legal order/)).not.toBeInTheDocument();
  });

  it("a cap of one order reads 'Capped at 1 order', not '1 orders'", () => {
    render(<OutcomeGroups runCount={1} capped groups={[{ id: "only", title: "done", runCount: 1, lines: [{ text: "t1 finishes" }] }]} />);
    expect(screen.getByText(/Capped at 1 order; more legal orders exist/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/1 orders/);
  });

  it("reports group counts that do not add up to runCount instead of showing them silently", () => {
    const { rerender } = render(<OutcomeGroups runCount={6} groups={[{ id: "only", title: "q = 1", runCount: 4, lines: [{ text: "q <= d" }] }]} />);
    expect(screen.getByRole("note")).toHaveTextContent("Outcome data error: the groups count 4 orders but runCount is 6.");

    rerender(<OutcomeGroups runCount={3} groups={raceGroups} />);
    expect(screen.getByRole("note")).toHaveTextContent("the groups count 2 orders but runCount is 3");

    rerender(<OutcomeGroups runCount={2} groups={raceGroups} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    expect(outcomeProblems(raceGroups, 2)).toEqual([]);
    expect(outcomeProblems([{ id: "a", runCount: 0 }, { id: "a", runCount: 1 }], 1)).toEqual([
      'group "a" has runCount 0; each group needs at least 1 order',
      'group id "a" is used twice',
    ]);
    expect(outcomeProblems([], 1)).toEqual(["the groups count 0 orders but runCount is 1"]);
  });

  it("cites the §4.7 source of nondeterminism the caller explored", () => {
    expect(SCHEDULER_CLAUSE_NOTE).toBe(SCHEDULER_CLAUSE_NOTES["region-order"]);
    expect(SCHEDULER_CLAUSE_NOTES["region-order"]).toMatch(/Active or Reactive region in any order/);
    expect(SCHEDULER_CLAUSE_NOTES.interleaving).toMatch(/no time control \(# or @\)/);
    expect(SCHEDULER_CLAUSE_NOTES.both).toMatch(/Active or Reactive region.*no time control/);
    // The modes that explore one source say which legal orders they leave out.
    expect(SCHEDULER_CLAUSE_NOTES["region-order"]).toContain("without being interleaved; §4.7 also allows interleaving, which this model does not run.");
    expect(SCHEDULER_CLAUSE_NOTES.interleaving).toContain("suspend a process at any point while it evaluates a statement");
    expect(SCHEDULER_CLAUSE_NOTES.both).not.toMatch(/not run|may exist/);
    for (const text of Object.values(SCHEDULER_CLAUSE_NOTES)) {
      expect(text).toMatch(/^IEEE 1800-2023 §4\.7/);
      expect(text).not.toMatch(/random/i);
    }

    const { rerender } = render(<OutcomeGroups runCount={2} groups={raceGroups} />);
    expect(screen.getByText(SCHEDULER_CLAUSE_NOTES["region-order"])).toBeInTheDocument();
    rerender(<OutcomeGroups runCount={2} groups={raceGroups} nondeterminism="interleaving" />);
    expect(screen.getByText(SCHEDULER_CLAUSE_NOTES.interleaving)).toBeInTheDocument();
    expect(screen.queryByText(SCHEDULER_CLAUSE_NOTES["region-order"])).not.toBeInTheDocument();
  });

  it("cards are plain groups, not buttons, when there is no onSelect", () => {
    render(<OutcomeGroups runCount={2} groups={raceGroups} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("group", { name: /^Outcome 2/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MutationMatrix
// ---------------------------------------------------------------------------

const tests = [
  { id: "smoke", label: "smoke_test" },
  { id: "wrap", label: "wrap_test" },
];
const mutants = [
  { id: "m1", label: "M1: count + 2" },
  { id: "m2", label: "M2: reset ignored" },
];
const results: Record<string, MutationCell> = {
  [cellKey("smoke", "m1")]: { state: "caught", summary: "PASS=4 FAIL=3" },
  [cellKey("smoke", "m2")]: { state: "survived", summary: "PASS=7 FAIL=0" },
  [cellKey("wrap", "m1")]: { state: "caught", summary: "PASS=1 FAIL=6" },
  [cellKey("wrap", "m2")]: { state: "not-run" },
};

function MatrixHarness() {
  const [predictions, setPredictions] = useState<Record<string, MutationPrediction>>({});
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <MutationMatrix
        label="Which test catches which mutant"
        rows={tests}
        columns={mutants}
        cells={results}
        predictions={predictions}
        onPredict={(r, c, v) => setPredictions((p) => ({ ...p, [cellKey(r, c)]: v }))}
        revealed={revealed}
        columnTotals
      />
      <button type="button" onClick={() => setRevealed(true)}>
        Run the mutants
      </button>
    </>
  );
}

describe("MutationMatrix", () => {
  it("is a real table with column and row headers", () => {
    render(<MatrixHarness />);
    const table = screen.getByRole("table", { name: "Which test catches which mutant" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Test", "M1: count + 2", "M2: reset ignored"]);
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["smoke_test", "wrap_test"]);
  });

  it("hides every result until reveal, toggles predictions, then grades them with glyph and text", () => {
    render(<MatrixHarness />);
    const table = screen.getByRole("table");
    expect(within(table).queryByText(/caught|survived/)).not.toBeInTheDocument();
    expect(screen.queryByText("PASS=4 FAIL=3")).not.toBeInTheDocument();

    const cell = screen.getByRole("button", { name: "smoke_test against M1: count + 2: no prediction yet" });
    expect(screen.getByRole("status")).toHaveTextContent(/^0 of 4 cells predicted\.$/);
    fireEvent.click(cell);
    expect(screen.getByRole("button", { name: "smoke_test against M1: count + 2: predicted will catch" })).toBeInTheDocument();
    // The status names the value the pressed cell now holds, not just the count.
    expect(screen.getByRole("status")).toHaveTextContent(/^smoke_test against M1: count \+ 2: will catch\. 1 of 4 cells predicted\.$/);
    fireEvent.click(screen.getByRole("button", { name: "smoke_test against M1: count + 2: predicted will catch" }));
    expect(screen.getByRole("button", { name: "smoke_test against M1: count + 2: predicted will miss" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^smoke_test against M1: count \+ 2: will miss\. 1 of 4 cells predicted\.$/);
    fireEvent.click(screen.getByRole("button", { name: /smoke_test against M2: reset ignored/ }));
    fireEvent.click(screen.getByRole("button", { name: /smoke_test against M2: reset ignored/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/^smoke_test against M2: reset ignored: will miss\. 2 of 4 cells predicted\.$/);

    fireEvent.click(screen.getByRole("button", { name: "Run the mutants" }));
    expect(screen.queryByRole("button", { name: /no prediction yet|predicted will/ })).not.toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // smoke × M1: caught, but the learner switched to "will miss".
    expect(rows[1]).toHaveTextContent("✕ caught");
    expect(rows[1]).toHaveTextContent("PASS=4 FAIL=3");
    expect(screen.getByText("smoke_test against M1: count + 2: caught, PASS=4 FAIL=3, you said will miss, prediction wrong")).toBeInTheDocument();
    // smoke × M2: survived, predicted "will miss".
    expect(rows[1]).toHaveTextContent("○ survived");
    expect(screen.getByText("smoke_test against M2: reset ignored: survived, PASS=7 FAIL=0, you said will miss, prediction right")).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent("– not run");
    // Totals: M1 caught by some test; M2 caught by none, and wrap_test never ran against it.
    expect(rows[3]).toHaveTextContent("Caught by any test✕ caught○ survived (1 not run)");
    expect(screen.getByRole("status")).toHaveTextContent("You predicted 1 of 2 cells right. 2 had no prediction.");
  });

  it("draws caught in a neutral colour so ✕ caught never shares the rose of ✕ prediction wrong", () => {
    render(<MutationMatrix label="Grid" rows={tests} columns={mutants} cells={results} predictions={{ [cellKey("smoke", "m1")]: "miss" }} revealed />);
    const caughtCell = screen.getByText("smoke_test against M1: count + 2: caught, PASS=4 FAIL=3, you said will miss, prediction wrong").parentElement as HTMLElement;
    expect(caughtCell).toHaveTextContent("✕ caught");
    expect(caughtCell).toHaveTextContent("✕ prediction wrong");
    expect(caughtCell.className).not.toMatch(/emerald|rose/);
    expect(caughtCell.className).toMatch(/slate/);
  });

  it("says when no predicted cell ran instead of 'You predicted 0 of 0 cells right'", () => {
    render(<MutationMatrix label="Grid" rows={tests} columns={mutants} cells={results} predictions={{ [cellKey("wrap", "m2")]: "catch" }} revealed />);
    expect(screen.getByRole("status")).toHaveTextContent("None of your predicted cells were run, so none could be graded. 3 had no prediction.");
    expect(screen.getByRole("status")).not.toHaveTextContent("0 of 0");
    expect(revealSummary({ predicted: 3, graded: 2, correct: 1, total: 4 }, 2, 1)).toBe("You predicted 1 of 2 cells right. 1 predicted cell was not run. 1 had no prediction.");
    expect(revealSummary({ predicted: 0, graded: 0, correct: 0, total: 4 }, 2, 1)).toBe("Revealed without predictions: 2 caught, 1 survived.");
  });

  it("after reveal, a predicted cell that did not run keeps the prediction and says it was not graded", () => {
    const predictions: Record<string, MutationPrediction> = { [cellKey("wrap", "m2")]: "catch", [cellKey("smoke", "m1")]: "catch" };
    render(<MutationMatrix label="Grid" rows={tests} columns={mutants} cells={results} predictions={predictions} revealed />);
    const name = "wrap_test against M2: reset ignored: not run, you said will catch, not graded (not run)";
    const hidden = screen.getByText(name);
    const notRunCell = hidden.parentElement as HTMLElement;
    expect(notRunCell).toHaveTextContent("– not run");
    expect(within(notRunCell).getByText("you said will catch, not graded (not run)")).toBeInTheDocument();
    expect(notGradedText("miss")).toBe("you said will miss, not graded (not run)");
    // A cell with no prediction carries no prediction text.
    expect(screen.getByText("smoke_test against M2: reset ignored: survived, PASS=7 FAIL=0")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You predicted 1 of 1 cell right. 1 predicted cell was not run. 2 had no prediction.");
  });

  it("a press the caller ignores is reported as the cell stands", () => {
    render(<MutationMatrix label="Grid" rows={tests} columns={mutants} cells={results} predictions={{}} onPredict={() => undefined} revealed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "wrap_test against M1: count + 2: no prediction yet" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^wrap_test against M1: count \+ 2: no prediction\. 0 of 4 cells predicted\.$/);
    expect(predictionStatus({ predicted: 2, total: 4 })).toBe("2 of 4 cells predicted.");
    expect(predictionStatus({ predicted: 2, total: 4 }, { where: "smoke_test against M1", prediction: "miss" })).toBe("smoke_test against M1: will miss. 2 of 4 cells predicted.");
  });

  it("column verdicts count not-run tests, and colliding or duplicate ids are reported", () => {
    expect(columnVerdict(["survived", "not-run"])).toEqual({ state: "survived", notRun: 1 });
    expect(columnVerdict(["caught", "not-run"])).toEqual({ state: "caught", notRun: 1 });
    expect(columnVerdict(["not-run", "not-run"])).toEqual({ state: "not-run", notRun: 2 });

    expect(matrixProblems(tests, mutants)).toEqual([]);
    const rows = [
      { id: "a:b", label: "A" },
      { id: "a", label: "B" },
    ];
    const columns = [
      { id: "c", label: "C" },
      { id: "b:c", label: "D" },
    ];
    expect(matrixProblems(rows, columns)).toEqual(['cells "a:b" × "c" and "a" × "b:c" share the key "a:b:c"; ids must not contain ":"']);
    expect(matrixProblems([...tests, tests[0]], mutants)).toEqual(['row id "smoke" is used twice']);

    render(<MutationMatrix label="Grid" rows={rows} columns={columns} cells={{}} revealed={false} />);
    expect(screen.getByRole("note")).toHaveTextContent('Mutation matrix data error: cells "a:b" × "c" and "a" × "b:c" share the key "a:b:c"');
  });

  it("after reveal, cells select a run when the caller asks for it", () => {
    const onCellSelect = vi.fn();
    render(<MutationMatrix label="Grid" rows={tests} columns={mutants} cells={results} revealed onCellSelect={onCellSelect} selectedCell={cellKey("wrap", "m1")} />);
    const cell = screen.getByRole("button", { name: "wrap_test against M1: count + 2: caught, PASS=1 FAIL=6" });
    expect(cell).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(cell);
    expect(onCellSelect).toHaveBeenCalledWith("wrap", "m1");
  });

  it("grading helpers: the first press predicts catch, not-run cells are not graded", () => {
    expect(nextPrediction(undefined)).toBe("catch");
    expect(nextPrediction("catch")).toBe("miss");
    expect(nextPrediction("miss")).toBe("catch");
    expect(gradePrediction("catch", "caught")).toBe(true);
    expect(gradePrediction("miss", "caught")).toBe(false);
    expect(gradePrediction("miss", "survived")).toBe(true);
    expect(gradePrediction("catch", "not-run")).toBeNull();
    expect(gradePrediction(undefined, "caught")).toBeNull();
    expect(scorePredictions(tests, mutants, results, { [cellKey("smoke", "m1")]: "catch", [cellKey("wrap", "m2")]: "miss" })).toEqual({
      predicted: 2,
      graded: 1,
      correct: 1,
      total: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// BitStrip
// ---------------------------------------------------------------------------

const cellsOf = (strip: HTMLElement) => Array.from(strip.querySelectorAll<HTMLElement>("span.h-6"));

describe("BitStrip", () => {
  it("keeps SignednessVisualizer's description and markings: extension, sign and discarded bits", () => {
    render(<BitStrip bits={["0", "0", "0", "0", "1", "1", "0", "0"]} label="a in context" extendedFrom={4} />);
    const strip = screen.getByRole("img", { name: "a in context: 8-bit value 8'b0000_1100; bits 7 to 4 added by extension" });
    const cells = cellsOf(strip);
    expect(cells.map((c) => c.textContent).join("")).toBe("00001100");
    expect(cells.slice(0, 4).every((c) => c.classList.contains("border-dashed"))).toBe(true);
    expect(cells[4]).not.toHaveClass("border-dashed");
    expect(strip.textContent).toBe("0+0+0+0+1100");

    render(<BitStrip bits={["1", "1", "0", "0"]} label="s" signBit={3} droppedFrom={2} valueText="4'sb1100" />);
    const signed = screen.getByRole("img", { name: "s: 4-bit value 4'sb1100; sign bit is bit 3; bits 3 to 2 discarded" });
    expect(cellsOf(signed)[0]).toHaveClass("ring-violet-500", "line-through");
    expect(cellsOf(signed)[2]).not.toHaveClass("line-through");
  });

  it("encodes x as the rose hatch with 'unknown (X)' and z as amber dashed with 'high impedance (Z)'", () => {
    render(<BitStrip bits={["1", "x", "z", "z"]} label="bus" />);
    const strip = screen.getByRole("img", { name: "bus: 4-bit value 4'b1xzz; bit 2 unknown (X); bits 1 to 0 high impedance (Z)" });
    const [one, x, z] = cellsOf(strip);
    expect(x).toHaveTextContent("x");
    expect(x.className).toMatch(/repeating-linear-gradient\(135deg/);
    expect(x).toHaveClass("border-rose-500/80");
    expect(z).toHaveTextContent("z");
    expect(z).toHaveClass("border-dashed", "border-amber-500/80");
    expect(one.className).not.toMatch(/repeating-linear-gradient/);
  });

  it("undefined bits get their own dotted texture, never the X hatch, and are left out of the announced literal", () => {
    render(<BitStrip bits={["x", "0", "1", "0"]} label="pad" undefinedBits={[3]} />);
    const strip = screen.getByRole("img", { name: "pad: 4-bit value, bit 3 undefined (no defined value), bits 2 to 0 = 3'b010" });
    // No x (unknown) and no ? (z, IEEE 1800-2023 §5.7.1) is announced for a bit with no defined value.
    expect(strip.getAttribute("aria-label")).not.toMatch(/x|\?/i);
    const cell = cellsOf(strip)[0];
    expect(cell).toHaveTextContent("–");
    expect(cell).toHaveClass("border-dotted");
    expect(cell.className).not.toMatch(/repeating-linear-gradient/);

    // A defined-looking raw bit is not announced either, and each defined run gets its own literal.
    render(<BitStrip bits={["1", "1", "0", "1"]} label="flags" undefinedBits={[2]} />);
    expect(screen.getByRole("img", { name: "flags: 4-bit value, bit 3 = 1'b1, bit 2 undefined (no defined value), bits 1 to 0 = 2'b01" })).toBeInTheDocument();

    // A caller valueText is used as given, and the undefined bits keep their note.
    render(<BitStrip bits={["1", "0"]} label="cv" undefinedBits={[1]} valueText="bit 0 is 0" />);
    expect(screen.getByRole("img", { name: "cv: 2-bit value bit 0 is 0; bit 1 undefined (no defined value)" })).toBeInTheDocument();

    expect(bitValueText(["0", "1"], [], (p) => 1 - p)).toBe("2'b01");
    expect(bitValueText(["0", "1", "1"], [0, 1, 2], (p) => 2 - p)).toBe("bits 2 to 0 undefined (no defined value)");
  });

  it("an undefined bit inside the extension range keeps its dotted border", () => {
    render(<BitStrip bits={["0", "0", "1", "1"]} label="e" extendedFrom={2} undefinedBits={[3]} />);
    const [undefinedCell, extendedCell] = cellsOf(screen.getByRole("img"));
    expect(undefinedCell).toHaveClass("border-dotted");
    expect(undefinedCell).not.toHaveClass("border-dashed");
    expect(extendedCell).toHaveClass("border-dashed");
  });

  it("numbers ascending declarations from the left and labels segments, highlights and changes", () => {
    render(
      <BitStrip
        bits={["1", "0", "1", "1", "0", "0", "1", "0"]}
        label="v[0:7]"
        ascending
        bitNumbers
        segments={[
          { hi: 0, lo: 3, label: "hi nibble", tone: "violet" },
          { hi: 4, lo: 7, label: "lo nibble", tone: "amber" },
        ]}
        highlight={[0, 1]}
        highlightLabel="read by v[0:1]"
        changed={new Set([7])}
      />,
    );
    const strip = screen.getByRole("img", {
      name: "v[0:7]: 8-bit value 8'b1011_0010; hi nibble is bits 0 to 3; lo nibble is bits 4 to 7; bit 7 just changed; bits 0 to 1 read by v[0:1]",
    });
    expect(strip.textContent).toMatch(/^0/);
    expect(strip).toHaveTextContent("hi nibble [0:3]");
    expect(strip).toHaveTextContent("lo nibble [4:7]");
    expect(cellsOf(strip)[7]).toHaveClass("ring-cyan-400");
    expect(strip.textContent).toContain("▲");
  });

  it("reports bad segment data on the page instead of drawing it silently", () => {
    render(<BitStrip bits={["0", "0", "0", "0"]} label="w" segments={[{ hi: 7, lo: 4, label: "byte1" }]} />);
    expect(screen.getByRole("note")).toHaveTextContent('Bit strip data error: segment "byte1" [7:4] is outside the strip.');
  });

  it("reports a segment that names its less significant bit first (IEEE 1800-2023 §11.5.1) and does not draw it", () => {
    const { unmount } = render(<BitStrip bits={["0", "0", "0", "0", "0", "0", "0", "0"]} label="d" segments={[{ hi: 0, lo: 3, label: "low" }]} />);
    expect(screen.getByRole("note")).toHaveTextContent('segment "low" [0:3] names its less significant bit first');
    expect(screen.getByRole("note")).toHaveTextContent("so write [3:0]");
    expect(screen.getByRole("img")).not.toHaveTextContent("[0:3]");
    unmount();

    // On an ascending [0:7] strip, bit 0 is the more significant end, so [3:0] is the reversed one.
    render(<BitStrip bits={["0", "0", "0", "0", "0", "0", "0", "0"]} label="u" ascending segments={[{ hi: 3, lo: 0, label: "first" }]} />);
    expect(screen.getByRole("note")).toHaveTextContent('segment "first" [3:0] names its less significant bit first');
    expect(screen.getByRole("note")).toHaveTextContent("so write [0:3]");
  });

  it("an empty strip announces 'no bits', never the illegal literal 0'b (IEEE 1800-2023 §5.7.1), and reports a data error", () => {
    expect(binaryText([])).toBe("no bits");
    expect(bitValueText([], [], (p) => p)).toBe("no bits");
    render(<BitStrip bits={[]} label="empty" signBit={0} extendedFrom={0} />);
    const strip = screen.getByRole("img", { name: "empty: no bits" });
    expect(strip.getAttribute("aria-label")).not.toContain("0'b");
    expect(cellsOf(strip)).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent("Bit strip data error: bits is empty, so there is no value to draw.");
  });

  it("a marker beyond the least significant end is reported and not drawn, so the drawing and description agree", () => {
    const { unmount } = render(<BitStrip bits={["0", "0", "1", "1"]} label="e" extendedFrom={-1} droppedFrom={-1} />);
    const strip = screen.getByRole("img", { name: "e: 4-bit value 4'b0011" });
    for (const cell of cellsOf(strip)) {
      expect(cell).not.toHaveClass("border-dashed");
      expect(cell).not.toHaveClass("line-through");
    }
    expect(strip.textContent).not.toMatch(/[+✕]/);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Bit strip data error: extendedFrom -1 is beyond the least significant end of the strip [3:0]; droppedFrom -1 is beyond the least significant end of the strip [3:0].",
    );
    unmount();

    // Beyond the most significant end nothing is marked (nothing was added), and that is not an error.
    const { unmount: unmountWide } = render(<BitStrip bits={["0", "0", "1", "1"]} label="w" extendedFrom={4} droppedFrom={4} />);
    const wide = screen.getByRole("img", { name: "w: 4-bit value 4'b0011" });
    expect(cellsOf(wide).some((c) => c.classList.contains("border-dashed") || c.classList.contains("line-through"))).toBe(false);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    unmountWide();

    // On an ascending [0:7] strip the least significant end is bit 7.
    const { unmount: unmountAscending } = render(<BitStrip bits={["0", "0", "0", "0", "0", "0", "0", "0"]} label="u" ascending extendedFrom={8} />);
    expect(screen.getByRole("img", { name: "u: 8-bit value 8'b0000_0000" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("extendedFrom 8 is beyond the least significant end of the strip [0:7]");
    unmountAscending();

    // A sign bit outside the strip gets no ring and no "sign bit" note, only the error.
    render(<BitStrip bits={["1", "0", "0", "0"]} label="s" signBit={5} />);
    const signed = screen.getByRole("img", { name: "s: 4-bit value 4'b1000" });
    expect(cellsOf(signed).some((c) => c.classList.contains("ring-violet-500"))).toBe(false);
    expect(screen.getByRole("note")).toHaveTextContent("signBit 5 is outside the strip [3:0]");
  });

  it("formatting helpers", () => {
    expect(binaryText(["1", "0", "1", "0", "1"])).toBe("5'b1_0101");
    expect(describeBits([0, 1, 2, 5], (p) => 7 - p)).toBe("bits 7 to 5 and 2");
    expect(describeBits([3], (p) => p)).toBe("bit 3");
  });
});
