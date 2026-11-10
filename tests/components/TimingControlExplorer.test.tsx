import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TimingControlExplorer, { TIMING_ASSUMPTIONS } from "@/components/visuals/TimingControlExplorer";
import {
  NO_REPEAT_NOTE,
  WAIT_LOOP_CAUTION,
  WAKE_ARMING_NOTE,
  drillSummary,
  evaluateControl,
  evaluateIntra,
  findEventPreset,
  intraSummary,
  wakeOutcome,
  wakeSteps,
} from "@/lib/sv-intra-assignment-model";

const live = () => screen.getByTestId("timing-live");
const lockIn = () => fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);

/** Answers the radio prompt whose question matches, then locks it in. */
function predict(question: RegExp, option: RegExp | string) {
  const legend = Array.from(document.querySelectorAll("legend")).find((l) => question.test(l.textContent ?? ""));
  if (!legend) throw new Error(`No prompt matching ${question}`);
  const fieldset = legend.closest("fieldset") as HTMLElement;
  fireEvent.click(within(fieldset).getByLabelText(option));
  const prompt = fieldset.parentElement as HTMLElement;
  fireEvent.click(within(prompt).getByRole("button", { name: /lock in prediction/i }));
}

const radio = (group: string, name: string | RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

describe("TimingControlExplorer: events mode", () => {
  it("has an accessible name, declares itself a model, and hides Table 9-2 and the verdicts until the prediction is locked", () => {
    render(<TimingControlExplorer />);
    expect(screen.getByRole("region", { name: /Timing control explorer: which value changes are events/ })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
    expect(TIMING_ASSUMPTIONS.some((a) => a.includes("§9.4.5"))).toBe(true);
    expect(screen.queryByRole("table", { name: /Table 9-2/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/does not wake\./)).not.toBeInTheDocument();
    expect(live()).toHaveTextContent("");
    // The first preset is the active-low reset.
    expect(screen.getByText(/rst_n: 1'bx → 1'b0/)).toBeInTheDocument();
  });

  it("x → 0 reset: ticking the right controls scores 5 of 5 and lights the x → 0 negedge cell", () => {
    render(<TimingControlExplorer preset="f2c-timing-controls" />);
    fireEvent.click(screen.getByLabelText("@(negedge rst_n)"));
    fireEvent.click(screen.getByLabelText("@(edge rst_n)"));
    fireEvent.click(screen.getByLabelText("@(rst_n)"));
    lockIn();
    expect(screen.getByText(/5 of 5 controls predicted right/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Table 9-2/ });
    const cell = table.querySelector('[aria-current="true"]');
    expect(cell?.textContent).toContain("negedge");
    // The highlighted cell is row x, column 0.
    const row = cell?.closest("tr");
    expect(within(row as HTMLElement).getByRole("rowheader")).toHaveTextContent("x");
    const drill = findEventPreset("x-to-0-reset")!.drill;
    expect(live()).toHaveTextContent(drillSummary(drill));
    expect(screen.getByText(evaluateControl(drill, "negedge").reason)).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "What this preset shows" })).toHaveTextContent(/negedge/);
  });

  it("a wrong tick is graded and explained", () => {
    render(<TimingControlExplorer preset="f2c-timing-controls" />);
    fireEvent.click(screen.getByLabelText("@(posedge rst_n)"));
    lockIn();
    expect(screen.getByText(/1 of 5 controls predicted right/)).toBeInTheDocument();
    expect(screen.getAllByText(/your tick ✕/).length).toBe(4);
  });

  it("bus 4'b0001 → 4'b0011 (sensitivity-lists preset): @(bus) wakes, @(posedge bus) does not, LSB rule stated", () => {
    render(<TimingControlExplorer preset="f2c-sensitivity-lists" />);
    lockIn();
    const drill = findEventPreset("bus-lsb-unchanged")!.drill;
    expect(screen.getByText(evaluateControl(drill, "posedge").reason)).toHaveTextContent(/least significant bit only/);
    expect(screen.getByText(evaluateControl(drill, "change").reason)).toHaveTextContent(/@\(bus\) wakes\./);
  });

  it("switching presets re-arms the prediction; the iff-or preset adds its control", () => {
    render(<TimingControlExplorer />);
    lockIn();
    expect(screen.getByRole("table", { name: /Table 9-2/ })).toBeInTheDocument();
    fireEvent.click(radio("Preset", "iff binds tighter than or"));
    expect(screen.queryByRole("table", { name: /Table 9-2/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("@(posedge s iff en or negedge s)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/so the list is \(posedge s iff en\) or \(negedge s\)/)).toBeInTheDocument();
  });

  it("@(a & b) preset hides the value of a & b before the reveal", () => {
    render(<TimingControlExplorer preset="and-unchanged" />);
    expect(screen.getByText(/a: 1'b0 → 1'b0, b: 1'b0 → 1'b1/)).toBeInTheDocument();
    expect(screen.queryByText(/a & b was/)).not.toBeInTheDocument();
    lockIn();
    expect(screen.getAllByText(/b changed, but the expression's value did not/).length).toBeGreaterThan(0);
    expect(screen.getByText(/5 of 5/)).toBeInTheDocument();
  });

  it("editing a bit with the keyboard-operable bit buttons re-arms the drill and marks it as your own", () => {
    render(<TimingControlExplorer preset="iff-en-x" />);
    fireEvent.click(screen.getByRole("button", { name: "Change the values" }));
    fireEvent.click(screen.getByRole("button", { name: /^en is x\. Activate to change it to z\./ }));
    expect(radio("Preset", /Your own/)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/s: 1'b0 → 1'b1, en = z/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("@(posedge s iff en)"));
    lockIn();
    expect(screen.getByText(/1 of 5 controls/)).toBeInTheDocument();
    expect(screen.getAllByText(/x and z count as false/).length).toBeGreaterThan(0);
  });

  it("choosing 'Your own' selects it, keeps the values and opens the editor", () => {
    render(<TimingControlExplorer preset="one-to-z" />);
    const toggle = screen.getByRole("button", { name: "Change the values" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(radio("Preset", /Your own/));
    expect(radio("Preset", /Your own/)).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /^s after is z\./ })).toBeVisible();
    expect(screen.getByText(/s: 1'b1 → 1'bz/)).toBeInTheDocument();
  });
});

describe("TimingControlExplorer: wake mode", () => {
  const steps = wakeSteps();

  it("f3a preset starts on @(a & b) and steps through the script with a prediction before each write", () => {
    render(<TimingControlExplorer mode="wake" preset="f3a-wake-rules" />);
    expect(screen.getByRole("region", { name: /what wakes a waiting process/ })).toBeInTheDocument();
    expect(radio("Waiter", "@(a & b)")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(/x & 0 = 0/)).not.toBeInTheDocument();
    predict(/Does @\(a & b\) wake/, "stays asleep");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(wakeOutcome("change-and", steps[0]).rule)).toBeInTheDocument();
    expect(live()).toHaveTextContent(/Write 1: a = 1'b0/);
    fireEvent.click(screen.getByRole("button", { name: /Next write/ }));
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(screen.getByText(/Write 2 of 4/)).toBeInTheDocument();
  });

  it("wait (a) offers 'passes at once', and after the last write the full matrix appears", () => {
    render(<TimingControlExplorer mode="wake" preset="wait-a" />);
    expect(screen.getByLabelText("never blocks: passes at once")).toBeInTheDocument();
    const answers = ["stays asleep", "stays asleep", "wakes", "never blocks: passes at once"];
    answers.forEach((a, i) => {
      expect(screen.queryByRole("table", { name: /Every waiter/ })).not.toBeInTheDocument();
      predict(/Does wait \(a\) wake/, a);
      expect(screen.getAllByText(/Correct\./).length).toBe(1);
      if (i < answers.length - 1) fireEvent.click(screen.getByRole("button", { name: /Next write/ }));
    });
    expect(screen.getByText(wakeOutcome("wait-a", steps[3]).rule)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Every waiter/ });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /Start again/ }));
    expect(screen.queryByRole("table", { name: /Every waiter/ })).not.toBeInTheDocument();
  });

  it("write 4 (b 0 → 1) under @(a) says b was written, not a, in the feedback and the live region", () => {
    render(<TimingControlExplorer mode="wake" preset="change-a" />);
    const answers = ["wakes", "stays asleep", "wakes"];
    answers.forEach((a) => {
      predict(/Does @\(a\) wake/, a);
      fireEvent.click(screen.getByRole("button", { name: /Next write/ }));
    });
    predict(/Does @\(a\) wake/, "stays asleep");
    expect(screen.getByText(wakeOutcome("change-a", steps[3]).rule)).toHaveTextContent("Write 4 is to b; a is not written");
    expect(live()).toHaveTextContent("Write 4 is to b; a is not written and stays 1'b1");
    expect(screen.queryByText(/writing the value it already has/)).not.toBeInTheDocument();
  });

  it("the arming note is not a forever loop; wait (a) adds the zero-delay loop caution", () => {
    render(<TimingControlExplorer mode="wake" />);
    expect(screen.getByTestId("wake-arming-note")).toHaveTextContent(WAKE_ARMING_NOTE);
    expect(screen.getByTestId("wake-arming-note")).not.toHaveTextContent(/forever/);
    fireEvent.click(radio("Waiter", "wait (a)"));
    expect(screen.getByTestId("wake-arming-note")).toHaveTextContent(WAIT_LOOP_CAUTION);
  });

  it("@ waiters offer only wakes / stays asleep; changing the waiter restarts the script", () => {
    render(<TimingControlExplorer mode="wake" />);
    expect(screen.queryByLabelText("never blocks: passes at once")).not.toBeInTheDocument();
    predict(/Does @\(a\) wake/, "stays asleep");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next write/ }));
    fireEvent.click(radio("Waiter", "@(posedge a)"));
    expect(screen.getByText(/Write 1 of 4/)).toBeInTheDocument();
  });
});

describe("TimingControlExplorer: intra mode", () => {
  it("asks for the time first, then the value, and only then draws the timeline overlay", () => {
    render(<TimingControlExplorer mode="intra" preset="f2c-intra-assignment" />);
    expect(screen.getByRole("region", { name: /when an assignment reads and writes/ })).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(/What value does/)).not.toBeInTheDocument();
    predict(/next statement, run/, "t = 5");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // The time feedback never states the value a gets.
    expect(screen.queryByText(/a gets|ends at/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-reveal")).not.toBeInTheDocument();
    predict(/What value does/, "a = 1");
    expect(screen.getByTestId("timeline-reveal")).toBeInTheDocument();
    const r = evaluateIntra("blocking-intra");
    expect(live()).toHaveTextContent(intraSummary(r));
    expect(screen.getByRole("img", { name: intraSummary(r) })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Table 9-3/ })).toHaveTextContent("temp = b;");
  });

  it("a wrong value is explained with when the signal held it", () => {
    render(<TimingControlExplorer mode="intra" />);
    predict(/next statement, run/, "t = 0");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    predict(/What value does/, "a = 2");
    expect(screen.getAllByText(/2 is the value b holds from t = 2/).length).toBe(1);
  });

  it("#5 a = b reads b after the delay", () => {
    render(<TimingControlExplorer mode="intra" />);
    fireEvent.click(radio("Form", "#5 a = b;"));
    predict(/next statement, run/, "t = 5");
    predict(/What value does/, "a = 2");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
  });

  it("the repeat form shows the count control; unsigned -3 is computed, capped and not drawn", () => {
    render(<TimingControlExplorer mode="intra" />);
    expect(screen.queryByRole("radiogroup", { name: "Repeat count n" })).not.toBeInTheDocument();
    fireEvent.click(radio("Form", "a <= repeat (n) @(posedge clk) d;"));
    fireEvent.click(radio("Repeat count n", "-3 (int unsigned)"));
    expect(screen.getByText("int unsigned n = -3;")).toBeInTheDocument();
    predict(/next statement, run/, "t = 0");
    predict(/What value does/, "a = 10");
    expect(screen.getByRole("note", { name: "Display cap" })).toHaveTextContent("repeats 4294967293 times");
    expect(screen.getByRole("note", { name: "Display cap" })).toHaveTextContent("t = 12884901879");
  });

  it("a count of x gives the no-repeat note; changing the count re-arms both predictions", () => {
    render(<TimingControlExplorer mode="intra" preset="nonblocking-repeat" />);
    fireEvent.click(radio("Repeat count n", "x (integer)"));
    predict(/next statement, run/, "t = 0");
    predict(/What value does/, "a = 10");
    expect(screen.getByRole("note", { name: /About a count/ })).toHaveTextContent(NO_REPEAT_NOTE);
    fireEvent.click(radio("Repeat count n", "3"));
    expect(screen.queryByTestId("timeline-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(/What value does/)).not.toBeInTheDocument();
  });

  it("a <= 0; a <= 1; ends at 1, and 'either' is diagnosed with §4.6 b)", () => {
    render(<TimingControlExplorer mode="intra" preset="nba-order" />);
    predict(/next statement, run/, "t = 0");
    predict(/What value does/, "either: the order is not defined");
    expect(screen.getAllByText(/§4\.6 b\)/).length).toBeGreaterThan(0);
    // The two same-time writes share one marker, so their labels cannot overlap.
    const markers = screen.getAllByTestId("write-marker");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveTextContent("a = 0, then 1 (NBA)");
  });

  it("for a count of x, the time feedback already carries the no-repeat reading", () => {
    render(<TimingControlExplorer mode="intra" preset="nonblocking-repeat" />);
    fireEvent.click(radio("Repeat count n", "x (integer)"));
    predict(/next statement, run/, "t = 0");
    // The value prompt is not answered yet, so the only copy of the note is in the time feedback.
    expect(screen.queryByRole("note", { name: /About a count/ })).not.toBeInTheDocument();
    expect(screen.getByText((text) => text.includes(NO_REPEAT_NOTE))).toBeInTheDocument();
    expect(screen.getByText(/What value does/)).toBeInTheDocument();
  });

  it("form radios are keyboard operable (arrow keys move the selection)", () => {
    render(<TimingControlExplorer mode="intra" />);
    const first = radio("Form", "a = #5 b;");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(radio("Form", "a <= #5 b;")).toHaveAttribute("aria-checked", "true");
  });
});
