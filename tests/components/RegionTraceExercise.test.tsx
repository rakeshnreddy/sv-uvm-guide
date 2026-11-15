import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RegionTraceExercise from "@/components/visuals/RegionTraceExercise";
import {
  WORKED_PRINTS,
  kataExplanation,
  kataLineCode,
  legalOrdersText,
  legalPrintOrders,
  traceRowSummary,
  variantOutcomeText,
  workedExampleScenario,
  workedTraceRows,
} from "@/lib/sv-region-trace-exercises";
import { REGION_LABELS } from "@/lib/sv-scheduler-model";

/** Labels of the rows of a ReorderList, top to bottom. */
const orderOf = (list: HTMLElement) => within(list).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent ?? "");

/** Moves rows with the Move up buttons until the list reads `target`. */
function arrange(listName: string, target: string[]) {
  const list = () => screen.getByRole("list", { name: listName });
  target.forEach((name, i) => {
    let guard = 10;
    while (orderOf(list()).indexOf(name) > i && guard-- > 0) fireEvent.click(within(list()).getByRole("button", { name: `Move up: ${name}` }));
  });
  expect(orderOf(list())).toEqual(target);
}

const live = () => screen.getByTestId("trace-live");

describe("RegionTraceExercise, preset f3b-worked-example", () => {
  it("renders in a named frame with the code, and shows no printed value, trace or outcome before the prediction", () => {
    render(<RegionTraceExercise preset="f3b-worked-example" />);
    expect(screen.getByRole("region", { name: "Worked example: one time slot, region by region" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Order the printed lines" })).toBeInTheDocument();
    expect(screen.queryByText(/q=0 y=0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/q=1 y=1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Trace step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Outcomes of the worked example" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Change to try" })).not.toBeInTheDocument();
  });

  it("accepts REACT before ACTION, and ACTION before REACT, as correct (§4.7)", () => {
    for (const target of [
      ["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"],
      ["ACTIVE", "INACT", "ACTION", "REACT", "POSTP"],
    ]) {
      const { unmount } = render(<RegionTraceExercise />);
      arrange("Order the printed lines", target);
      fireEvent.click(screen.getByRole("button", { name: "Check my order" }));
      expect(within(screen.getByTestId("order-feedback")).getByText(/^Correct\. The model finds two legal print orders/)).toBeInTheDocument();
      expect(live()).toHaveTextContent(/^Correct\./);
      unmount();
    }
  });

  it("marks only the misplaced chip, explains it from its region, and locks the list", () => {
    render(<RegionTraceExercise />);
    arrange("Order the printed lines", ["ACTIVE", "POSTP", "INACT", "REACT", "ACTION"]);
    fireEvent.click(screen.getByRole("button", { name: "Check my order" }));
    expect(within(screen.getByTestId("order-feedback")).getByText(/^Not quite: POSTP is out of place\. POSTP prints in Postponed, the last region of the slot \(§4\.4\.2\.9\)/)).toBeInTheDocument();
    expect(screen.getAllByText("wrong position")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Move up: REACT" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("button", { name: "Check my order" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Trace step" })).not.toBeInTheDocument();
  });

  it("the scrubber walks the lesson's eleven rows: region, code line, values and prints move together", () => {
    render(<RegionTraceExercise />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const rows = workedTraceRows();
    const slider = screen.getByRole("slider", { name: "Trace step" });
    rows.forEach((row, i) => {
      fireEvent.change(slider, { target: { value: String(i) } });
      expect(screen.getByText(`Step ${row.step}: ${REGION_LABELS[row.region]}`)).toBeInTheDocument();
      expect(slider).toHaveAttribute("aria-valuetext", traceRowSummary(row));
      expect(screen.getByRole("group", { name: new RegExp(`Executing ${REGION_LABELS[row.region]}\\.`) })).toBeInTheDocument();
      // The slider's value text reads the row; the live region does not repeat it.
      expect(live().textContent).not.toBe(traceRowSummary(row));
      expect(within(screen.getByTestId("step-excerpt")).getAllByText(/./).length).toBeGreaterThan(0);
    });
    // Step 5 (NBA): q becomes 1, y is still 0, and the always_ff line is marked.
    fireEvent.change(slider, { target: { value: "5" } });
    expect(screen.getByLabelText("q = 1, just changed")).toBeInTheDocument();
    expect(screen.getByLabelText("y = 0")).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("q <= d;");
    // Step 10 (Postponed): the full log, in the lesson's order.
    fireEvent.change(slider, { target: { value: "10" } });
    expect(screen.getByRole("region", { name: "Log so far" }).textContent).toBe(
      ["5 ACTIVE q=0 y=0", "5 INACT  q=0 y=0", "5 REACT  q=1 y=1", "5 ACTION $sampled(q)=0 q=1", "5 POSTP  q=1 y=1"].join("\n"),
    );
  });

  it("the previous and next buttons step one row and stop at the ends", () => {
    render(<RegionTraceExercise />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 1: Active")).toBeInTheDocument();
    expect(live().textContent).toBe(traceRowSummary(workedTraceRows()[1]));
    for (let i = 0; i < 12; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 10: Postponed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("reveal without predicting shows the answer: the trace's legal order in the list and the legal orders in words", () => {
    render(<RegionTraceExercise />);
    const list = () => screen.getByRole("list", { name: "Order the printed lines" });
    expect(orderOf(list())).not.toEqual(["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(orderOf(list())).toEqual(["ACTIVE", "INACT", "REACT", "ACTION", "POSTP"]);
    expect(screen.getByTestId("order-answer")).toHaveTextContent(legalOrdersText(legalPrintOrders(workedExampleScenario()), WORKED_PRINTS));
    expect(screen.queryAllByText("wrong position")).toHaveLength(0);
  });

  it("moves focus to the feedback after a check or a reveal, and back to the check button after start over", () => {
    render(<RegionTraceExercise />);
    fireEvent.click(screen.getByRole("button", { name: "Check my order" }));
    expect(document.activeElement).toBe(screen.getByTestId("order-feedback"));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Check my order" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(document.activeElement).toBe(screen.getByTestId("order-feedback"));
  });

  it("shows the two legal outcomes as groups after the reveal", () => {
    render(<RegionTraceExercise />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const groups = screen.getByRole("group", { name: "Outcomes of the worked example" });
    expect(within(groups).getByText("2 different outcomes from 4 legal orders: the result depends on the scheduler's choice.")).toBeInTheDocument();
    expect(within(groups).getByText("ACTION first")).toBeInTheDocument();
    expect(within(groups).getByText("REACT first")).toBeInTheDocument();
  });

  it("each change asks 'which lines survive?' and hides the answer until the learner commits", () => {
    render(<RegionTraceExercise />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.queryByTestId("variant-outcome")).not.toBeInTheDocument();
    expect(screen.getByText("Step 5: change #1 $finish; to $finish;.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "ACTIVE and INACT" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("variant-outcome")).toHaveTextContent(variantOutcomeText("finish-now"));

    // Switching the change resets the prediction.
    fireEvent.click(screen.getByRole("radio", { name: "No second @(posedge clk) in tb_prog" }));
    expect(screen.queryByTestId("variant-outcome")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "All five lines" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("variant-outcome")).toHaveTextContent(variantOutcomeText("no-second-wait"));
    expect(screen.getByText("REACT first; POSTP and ACTION do not print")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Plain q in the pass action" }));
    expect(screen.getByText("changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: 'All five lines; the ACTION line reads "5 ACTION q=1"' }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByTestId("variant-outcome")).toHaveTextContent("The pass action prints 5 ACTION q=1");
  });
});

describe("RegionTraceExercise, preset f3b-kata", () => {
  const pick = (line: string, regions: string[]) => {
    const group = screen.getByRole("group", { name: new RegExp(`^${line}: `) });
    regions.forEach((r) => fireEvent.click(within(group).getByRole("button", { name: new RegExp(`^${r}$`) })));
  };

  const solve = () => {
    pick("L1", ["Active", "NBA"]);
    pick("L2", ["Active"]);
    pick("L3", ["Active"]);
    pick("L4", ["Inactive"]);
    pick("L5", ["Postponed"]);
    pick("L6", ["Preponed", "Observed", "Reactive"]);
    arrange("Order the kata's printed lines", ["A", "B", "D", "C"]);
    fireEvent.click(screen.getByRole("radio", { name: "D y=0" }));
  };

  it("renders a region picker for each of L1 to L6 with all nine regions, and no log before the check", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    expect(screen.getByRole("region", { name: "Kata: label the region" })).toBeInTheDocument();
    ["L1", "L2", "L3", "L4", "L5", "L6"].forEach((id) => {
      expect(within(screen.getByRole("group", { name: new RegExp(`^${id}: `) })).getAllByRole("button")).toHaveLength(9);
    });
    expect(screen.queryByRole("region", { name: "The log, from the model" })).not.toBeInTheDocument();
    expect(screen.queryByText(/C q=1 y=0/)).not.toBeInTheDocument();
  });

  it("each picker is a fieldset named by its legend; L6 shows its assert property line too", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    const l6 = screen.getByRole("group", { name: /^L6: / });
    expect(l6.tagName).toBe("FIELDSET");
    kataLineCode("L6").forEach((line) => expect(within(l6).getByText(line)).toBeInTheDocument());
    expect(l6).toHaveAccessibleName(`L6: ${kataLineCode("L6").join(" ")}`);
    expect(within(l6).queryByRole("group")).not.toBeInTheDocument();
  });

  it("the frame summary does not say how many regions a line needs", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    expect(screen.queryByText(/need more than one/)).not.toBeInTheDocument();
  });

  it("moves focus to the score after the check, and back to the check button after start over", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    expect(document.activeElement).toBe(screen.getByTestId("kata-score"));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Check my answers" }));
  });

  it("region buttons toggle, so a line can take several regions", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    const group = screen.getByRole("group", { name: /^L1: / });
    const active = within(group).getByRole("button", { name: /^Active$/ });
    expect(active).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(active);
    fireEvent.click(within(group).getByRole("button", { name: /^NBA$/ }));
    expect(active).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(active);
    expect(active).toHaveAttribute("aria-pressed", "false");
  });

  it("grades the lesson's solution as full marks: A, B, D, C with D y=0", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    solve();
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    expect(screen.getByText("8 of 8 right.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The log, from the model" }).textContent).toBe(["A q=0 y=1", "B q=0 y=1", "D y=0", "C q=1 y=0"].join("\n"));
    expect(screen.getByText("D prints in Reactive and C in Postponed, and Reactive comes first in the slot (§4.4.2.6, §4.4.2.9).")).toBeInTheDocument();
    expect(live()).toHaveTextContent(/^8 of 8 right\./);
  });

  it("explains a wrong line with the model's regions", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    pick("L1", ["Active"]);
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    const verdict = screen.getByTestId("kata-verdict-L1");
    expect(within(verdict).getByText("You picked Active.")).toBeInTheDocument();
    expect(within(verdict).getByText(kataExplanation("L1"))).toBeInTheDocument();
    expect(within(screen.getByTestId("kata-verdict-L2")).getByText("You picked no region.")).toBeInTheDocument();
    expect(screen.getByText(/^D prints y=0\./)).toBeInTheDocument();
  });

  it("after the check, the $sampled(y) change is a prediction that flips D to y=1", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    solve();
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    expect(screen.queryByRole("region", { name: "Log with $sampled(y), from the model" })).not.toBeInTheDocument();
    const prompt = screen.getByText("What does the D line print now?").closest("div") as HTMLElement;
    fireEvent.click(within(prompt).getByRole("radio", { name: "D y=1" }));
    fireEvent.click(within(prompt).getByRole("button", { name: "Lock in prediction" }));
    expect(within(prompt).getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Log with $sampled(y), from the model" }).textContent).toContain("D y=1");
  });

  it("start over clears every answer", () => {
    render(<RegionTraceExercise preset="f3b-kata" />);
    solve();
    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("button", { name: "Check my answers" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: /^L1: / })).getByRole("button", { name: /^Active$/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("radio", { name: "D y=0" })).not.toBeChecked();
  });
});
