import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DeferredReportVisualizer from "@/components/visuals/DeferredReportVisualizer";
import { buildDeferredScenario, buildPrediction, exploreDeferred, type DeferredPresetId, type PresetOptions } from "@/lib/sv-deferred-report-model";

const predict = (label: RegExp | string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const narration = () => screen.getByTestId("deferred-narration");
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
/** Steps forward until the narration matches, or fails after the last step. */
const stepUntil = (pattern: RegExp) => {
  for (let i = 0; i < 40; i += 1) {
    if (pattern.test(narration().textContent ?? "")) return;
    const button = screen.getByRole("button", { name: "Next step" });
    if ((button as HTMLButtonElement).disabled) break;
    next();
  }
  throw new Error(`No step matching ${pattern}; last: ${narration().textContent}`);
};
const toEnd = () => stepUntil(/^Time slot .* ends/);
/** The ticket chip in a queue whose visible text holds `text`, with its status word. */
const chip = (queueName: string, status: string) => {
  const queue = screen.getByRole("list", { name: queueName });
  const items = within(queue).getAllByRole("listitem");
  const found = items.find((li) => li.getAttribute("data-status") !== null && within(li).queryByText(status, { exact: true }));
  if (!found) throw new Error(`No ${status} ticket in ${queueName}`);
  return found;
};
const answerOf = (id: DeferredPresetId, options: PresetOptions = {}, focus?: string) => {
  const scenario = buildDeferredScenario(id, options);
  return buildPrediction(scenario, exploreDeferred(scenario), focus);
};

describe("DeferredReportVisualizer", () => {
  it("has an accessible name, declares itself a model, labels itself an F3B preview in F2C, and hides the trace until the prediction is in", () => {
    render(<DeferredReportVisualizer preset="reset-nba-flush" />);
    expect(screen.getByRole("region", { name: /Deferred report visualizer/ })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
    expect(screen.getByText(/F3B preview/)).toBeInTheDocument();
    expect(screen.getByText(answerOf("reset-nba-flush").question)).toBeInTheDocument();
    // Nothing that answers the question is on screen yet.
    expect(screen.queryByRole("group", { name: /Step playback controls/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("deferred-narration")).not.toBeInTheDocument();
    expect(screen.queryByText(/flushed/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Outcomes across/ })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("reset-nba-flush: a correct prediction reveals the trace, and stepping shows the report queued, then flushed, then nothing in Observed", () => {
    render(<DeferredReportVisualizer preset="reset-nba-flush" />);
    predict("No violation report");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Step playback controls/ })).toBeInTheDocument();
    expect(narration()).toHaveTextContent(/^Time slot t = 0 ns begins/);

    stepUntil(/joins next-state decoder's own queue/);
    const queued = chip("next-state decoder's report queue", "queued");
    // The chip's name is its visible text, with no aria-label override.
    expect(queued).not.toHaveAttribute("aria-label");
    expect(queued).toHaveTextContent(/unique case \(state\).*state = x.*queued/);
    // The executing line is highlighted in the code.
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("unique case (state)");

    stepUntil(/joins output decoder's own queue/);
    expect(chip("output decoder's report queue", "queued")).toHaveTextContent(/state = x/);

    stepUntil(/reaches a flush point/);
    expect(chip("next-state decoder's report queue", "flushed")).toBeInTheDocument();

    stepUntil(/^Observed region/);
    expect(narration()).toHaveTextContent("Observed region: no report is pending, so nothing matures and nothing is reported.");
    const observedCell = within(screen.getByRole("list", { name: "Regions of the time slot" })).getByText("Observed").closest("li")!;
    expect(observedCell).toHaveAttribute("aria-current", "step");
    // At phone width the strip shows a short label; the full name stays for screen readers, and the ▶ glyph shows only from sm up.
    expect(within(observedCell).getByText("Obs.")).toHaveAttribute("aria-hidden");
    expect(within(observedCell).getByText("Observed")).toHaveClass("sr-only", "sm:not-sr-only");
    expect(within(observedCell).getByText(/▶/)).toHaveClass("hidden", "sm:inline");
    toEnd();
    expect(screen.getByText("Nothing printed yet.")).toBeInTheDocument();
    expect(screen.getByTestId("deferred-run-summary")).toHaveTextContent(/gives no violation report/);
  });

  it("reset-delayed-matures: the lesson's two decoders give 2 reports; a wrong '1' names the per-process queues; both matured reports are printed in Observed", () => {
    render(<DeferredReportVisualizer preset="reset-delayed-matures" />);
    predict("1 violation report");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Too few: each process has its own violation report queue/)).toBeInTheDocument();
    cleanup();
    render(<DeferredReportVisualizer preset="reset-delayed-matures" />);
    predict("No violation report");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Too few: a pending report that no flush point reaches before it matures is reported/)).toBeInTheDocument();
    stepUntil(/^Observed region/);
    expect(chip("next-state decoder's report queue", "matured")).toBeInTheDocument();
    expect(chip("output decoder's report queue", "matured")).toBeInTheDocument();
    const printed = within(screen.getByRole("list", { name: "Reports printed so far" }));
    expect(printed.getByText(/next-state decoder: unique case \(state\) violation, state = x/)).toBeInTheDocument();
    expect(printed.getByText(/output decoder: unique case \(state\) violation, state = x/)).toBeInTheDocument();
  });

  it("is keyboard operable: arrow keys inside the playback group step through the trace", () => {
    render(<DeferredReportVisualizer preset="reset-nba-flush" />);
    predict("No violation report");
    const group = screen.getByRole("group", { name: /Step playback controls/ });
    const first = narration().textContent;
    fireEvent.keyDown(within(group).getByRole("button", { name: "Next step" }), { key: "ArrowRight" });
    expect(narration().textContent).not.toBe(first);
    fireEvent.keyDown(within(group).getByRole("button", { name: "Next step" }), { key: "Home" });
    expect(narration().textContent).toBe(first);
  });

  it("assertcontrol-race: Off gives two outcomes; loading the other order shows the kept report as possible; switching to Kill resets the prediction", () => {
    render(<DeferredReportVisualizer preset="assertcontrol-race" presets={["assertcontrol-race"]} />);
    expect(screen.queryByRole("radiogroup", { name: "Scenario" })).not.toBeInTheDocument();
    predict("It depends on the order the scheduler picks");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const outcomes = screen.getByRole("group", { name: /Outcomes across the orders the model ran/ });
    const cards = within(outcomes).getAllByRole("button");
    expect(cards).toHaveLength(4);
    expect(within(outcomes).getByText(/4 different outcomes from 6 legal orders/)).toBeInTheDocument();
    const maybeCard = cards.find((c) => /may print/.test(c.textContent ?? ""))!;
    fireEvent.click(maybeCard);
    expect(maybeCard).toHaveAttribute("aria-pressed", "true");
    stepUntil(/stays and "may still mature"/);
    toEnd();
    expect(within(screen.getByRole("list", { name: "Reports printed so far" })).getByText(/possibly:/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("radiogroup", { name: /control_type/ })).getByRole("radio", { name: "5 · Kill" }));
    expect(screen.queryByTestId("deferred-narration")).not.toBeInTheDocument();
    expect(document.querySelector("code")?.closest("ol")?.textContent).toContain("$assertcontrol(5, 224);");
    predict("No violation report");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // Kill opens on an order where it flushes a queued report (§20.11).
    expect(screen.getByTestId("deferred-run-summary")).toHaveTextContent("was flushed by $assertcontrol Kill before it matured (§20.11)");
    stepUntil(/Kill flushes queued reports that have not matured/);
    expect(chip("next-state decoder's report queue", "flushed by Kill")).toBeInTheDocument();
  });

  it("assert-forms-glitch: labelled as an F3B experiment; the Reactive toggle and the assertion choice change the answer, each resetting the prediction", () => {
    render(<DeferredReportVisualizer preset="assert-forms-glitch" />);
    expect(screen.getByText(/Experiment · Deferred reports/)).toBeInTheDocument();
    expect(screen.queryByText(/F3B preview/)).not.toBeInTheDocument();
    expect(screen.getByText(answerOf("assert-forms-glitch", {}, "a2").question)).toBeInTheDocument();
    predict("No failure report");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    // The toggle's name is its words only; the checkbox glyph is hidden and aria-pressed carries the state.
    const toggle = screen.getByRole("button", { name: "Program writes a (Reactive) instead of <=" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Program writes a (Reactive) instead of <=" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("deferred-narration")).not.toBeInTheDocument();
    predict("1 failure report");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    stepUntil(/^Reactive region: the matured #0 report of a2 runs its \$error now/);
    expect(within(screen.getByRole("list", { name: "Reports printed so far" })).getByText(/a2 failed: \$error in Reactive/)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Assertion to predict" })).getByRole("radio", { name: /a3: final deferred/ }));
    expect(screen.getByText(answerOf("assert-forms-glitch", { reactiveWritesA: true }, "a3").question)).toBeInTheDocument();
    predict("No failure report");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Assertion to predict" })).getByRole("radio", { name: /a1: immediate/ }));
    predict("It depends on the order the scheduler picks");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("the scenario picker switches between the F2C presets and resets the prediction", () => {
    render(<DeferredReportVisualizer preset="reset-nba-flush" />);
    const picker = screen.getByRole("radiogroup", { name: "Scenario" });
    expect(within(picker).getAllByRole("radio")).toHaveLength(6);
    predict("No violation report");
    fireEvent.click(within(picker).getByRole("radio", { name: "One function, two callers" }));
    expect(screen.queryByTestId("deferred-narration")).not.toBeInTheDocument();
    expect(screen.getByText(answerOf("two-callers").question)).toBeInTheDocument();
    predict("2 violation reports");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    toEnd();
    const printed = within(screen.getByRole("list", { name: "Reports printed so far" }));
    expect(printed.getByText(/b1: a1 in f1 violation/)).toBeInTheDocument();
    expect(printed.getByText(/b2: a1 in f1 violation/)).toBeInTheDocument();
  });

  it("lrm-unique-glitch: opens on the order that queues the glitch report, and the order picker loads the order that never queues one", () => {
    render(<DeferredReportVisualizer preset="lrm-unique-glitch" presets={["lrm-unique-glitch"]} />);
    predict("No violation report");
    const orders = screen.getByRole("radiogroup", { name: "Order to step through" });
    expect(within(orders).getByRole("radio", { name: "a1 before not_a block" })).toHaveAttribute("aria-checked", "true");
    stepUntil(/they overlap/);
    stepUntil(/1 pending report is discarded/);
    fireEvent.click(within(orders).getByRole("radio", { name: "not_a block before a1" }));
    expect(narration()).toHaveTextContent(/^Time slot t = 10 ns begins/);
    toEnd();
    expect(screen.getByTestId("deferred-run-summary")).toHaveTextContent("No check found a violation, so nothing was queued.");
  });

  it("revealing without predicting still shows the explanation from the model", () => {
    render(<DeferredReportVisualizer preset="loop-flush" presets={["loop-flush"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const correct = answerOf("loop-flush").options.find((o) => o.correct)!;
    expect(screen.getByText(correct.feedback)).toBeInTheDocument();
    stepUntil(/2 pending reports are discarded/);
  });
});
