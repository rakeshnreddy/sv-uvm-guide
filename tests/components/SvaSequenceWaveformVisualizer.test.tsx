import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SvaSequenceWaveformVisualizer } from "@/components/visualizers/SvaSequenceWaveformVisualizer";
import { statusText } from "@/lib/sva-model";

const predictionButton = (k: number) => screen.getByRole("button", { name: new RegExp(`^Attempt starting at edge ${k}: your prediction`) });
const attemptsGroup = () => screen.queryByRole("group", { name: "Attempts" });

describe("SvaSequenceWaveformVisualizer (SVA trace lab)", () => {
  it("hides results until the learner predicts and evaluates", () => {
    render(<SvaSequenceWaveformVisualizer />);
    expect(screen.getByTestId("sva-waveform-visualizer")).toBeInTheDocument();
    expect(attemptsGroup()).not.toBeInTheDocument();
    expect(screen.queryByText(/real pass/)).not.toBeInTheDocument();
    const evaluate = screen.getByRole("button", { name: /^Evaluate/ });
    expect(evaluate).toBeDisabled();

    fireEvent.click(predictionButton(1)); // PASS
    expect(evaluate).toBeEnabled();
    fireEvent.click(evaluate);

    expect(attemptsGroup()).toBeInTheDocument();
    expect(screen.getByText(/1 real pass · 1 fail · 9 vacuous · 1 pending · 0 disabled/)).toBeInTheDocument();
    expect(screen.getByText(/You predicted 1 attempt; 1 correct/)).toBeInTheDocument();
  });

  it("diagnoses a wrong prediction: a vacuous success is not a real pass", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(predictionButton(0)); // PASS, but req is 0 at edge 0 → vacuous
    fireEvent.click(screen.getByRole("button", { name: /^Evaluate/ }));
    expect(screen.getByText(/Your prediction \(pass\)/)).toBeInTheDocument();
    expect(screen.getByText(/only a vacuous success/)).toBeInTheDocument();
  });

  it("explains a selected attempt step by step: which edge matched which element", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    fireEvent.click(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A6: fail at edge 8/ }));
    const steps = screen.getByRole("list", { name: /Step-by-step match for attempt A6/ });
    const items = within(steps).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/^edge 6.*matched:req.*req=1/);
    expect(items[1]).toMatch(/consequent starts at the same edge 6/);
    expect(items[items.length - 1]).toMatch(/^edge 8.*failed:##2 ack.*ack=0/);
  });

  it("toggling a trace cell from the keyboard re-runs the model and re-asks for predictions", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(predictionButton(6));
    const cell = screen.getByRole("button", { name: "ack at edge 8: 0. Toggle." });
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(screen.getByRole("button", { name: "ack at edge 8: 1. Toggle." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Evaluate/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A6: pass at edge 8/ })).toBeInTheDocument();
  });

  it("switches presets with the arrow keys", () => {
    render(<SvaSequenceWaveformVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Property preset" });
    const current = within(group).getByRole("radio", { checked: true });
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("req |-> ##[1:3] ack");
  });

  it("debug mode: a bare sequence fails on idle edges until the implication is restored", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Debug: spot the bug/ }));
    expect(screen.getByText(/a_check: 2 real passes · 10 fails · 0 vacuous/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/The property is a bare sequence/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply the fix" }));
    expect(screen.getByText(/after the fix, a_check: 2 real passes · 0 fails · 10 vacuous/)).toBeInTheDocument();
  });

  it("custom mode reports parse errors instead of evaluating them as false", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Write your own/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Property/ }), { target: { value: "req |--> ack" } });
    fireEvent.click(screen.getByRole("button", { name: "Check property" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/is not an SVA operator/);
    expect(screen.queryByRole("button", { name: /^Evaluate/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /Property/ }), { target: { value: "req ##2 ack" } });
    fireEvent.click(screen.getByRole("button", { name: "Check property" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(within(attemptsGroup()!).getByRole("button", { name: /^Attempt A0: fail at edge 0/ })).toBeInTheDocument();
  });
});

describe("SvaSequenceWaveformVisualizer: lesson props", () => {
  it("legend calls a vacuous result a vacuous success, not a pass", () => {
    render(<SvaSequenceWaveformVisualizer />);
    expect(screen.getByText(/vacuous success \(not a pass or a failure\)/)).toBeInTheDocument();
    expect(screen.queryByText(/vacuous pass/)).not.toBeInTheDocument();
  });

  it("is the default export too", async () => {
    const mod = await import("@/components/visualizers/SvaSequenceWaveformVisualizer");
    expect(mod.default).toBe(mod.SvaSequenceWaveformVisualizer);
  });

  it("req-gnt-2, learn only: no tabs or preset picker, and the challenge is graded only after the reveal", () => {
    render(<SvaSequenceWaveformVisualizer initialPreset="req-gnt-2" modes={["learn"]} />);
    expect(screen.queryByRole("radiogroup", { name: "Mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Property preset" })).not.toBeInTheDocument();
    expect(screen.getByText(/Make the assertion fail while gnt is 1 at some edge/)).toBeInTheDocument();
    expect(screen.queryByTestId("sva-challenge-result")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Attempt starting at edge/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByText(/1 real pass · 1 fail · 6 vacuous · 0 pending · 0 disabled/)).toBeInTheDocument();
    expect(screen.getByTestId("sva-challenge-result")).toHaveTextContent(/not yet.*Attempt A4 fails at edge 6, but gnt is 0 at edge 5/);

    // Give the grant one edge early: the reveal is withdrawn until the learner evaluates again.
    fireEvent.keyDown(screen.getByRole("button", { name: "gnt at edge 5: 0. Toggle." }), { key: "Enter" });
    expect(screen.queryByTestId("sva-challenge-result")).not.toBeInTheDocument();
    expect(attemptsGroup()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("sva-challenge-result")).toHaveTextContent(/Challenge met.*gnt is 1 at edge 5: one edge early/);
  });

  it("a wrong per-attempt prediction on req-gnt-2 is explained as a vacuous success", () => {
    render(<SvaSequenceWaveformVisualizer initialPreset="req-gnt-2" modes={["learn"]} />);
    fireEvent.click(predictionButton(0)); // PASS
    fireEvent.click(screen.getByRole("button", { name: /^Evaluate/ }));
    expect(screen.getByText(/only a vacuous success/)).toBeInTheDocument();
  });

  it("signalNames renames ack to gnt in the presets and the trace", () => {
    render(<SvaSequenceWaveformVisualizer signalNames={{ ack: "gnt" }} />);
    const group = screen.getByRole("radiogroup", { name: "Property preset" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("req |-> ##2 gnt");
    expect(screen.getByRole("button", { name: "gnt at edge 8: 0. Toggle." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ack at edge/ })).not.toBeInTheDocument();
  });

  it("signalNames entries that are rejected are reported in development, and the lab keeps the original name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<SvaSequenceWaveformVisualizer signalNames={{ req: "logic", ack: "gnt" }} />);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/signalNames entries ignored: req -> logic/));
      expect(screen.getByTestId("sva-waveform-visualizer")).toHaveAttribute("data-ignored-signal-names", "req -> logic");
      const group = screen.getByRole("radiogroup", { name: "Property preset" });
      expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("req |-> ##2 gnt");
    } finally {
      warn.mockRestore();
    }
  });

  it("a valid map raises no warning and sets no hint", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<SvaSequenceWaveformVisualizer signalNames={{ ack: "gnt" }} />);
      expect(warn).not.toHaveBeenCalled();
      expect(screen.getByTestId("sva-waveform-visualizer")).not.toHaveAttribute("data-ignored-signal-names");
    } finally {
      warn.mockRestore();
    }
  });

  it("attempt labels, chips and the prediction feedback use the §16.14.8 wording, never the raw status name", () => {
    render(<SvaSequenceWaveformVisualizer />);
    fireEvent.click(predictionButton(0)); // PASS
    expect(predictionButton(0)).toHaveAccessibleName(/your prediction is pass\./);
    fireEvent.click(screen.getByRole("button", { name: /^Evaluate/ }));
    const a0 = within(attemptsGroup()!).getByRole("button", { name: /^Attempt A0: / });
    expect(a0).toHaveAccessibleName(`Attempt A0: ${statusText.VACUOUS}; you predicted ${statusText.PASS}, mismatch. Show explanation.`);
    expect(a0).toHaveTextContent(statusText.VACUOUS);
    const names = within(attemptsGroup()!)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "");
    for (const n of names) expect(n).not.toMatch(/VACUOUS|PASS|FAIL|PENDING/);
  });

  it("initialPreset picks an existing preset, and modes hides the other tabs", () => {
    render(<SvaSequenceWaveformVisualizer initialPreset="window" modes={["learn", "write"]} />);
    const group = screen.getByRole("radiogroup", { name: "Property preset" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("req |-> ##[1:3] ack");
    const tabs = screen.getByRole("radiogroup", { name: "Mode" });
    expect(within(tabs).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Learn: presets", "Write your own"]);
  });

  it("modes without learn opens on the first allowed tab", () => {
    render(<SvaSequenceWaveformVisualizer modes={["debug"]} />);
    expect(screen.queryByRole("radiogroup", { name: "Mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Debug case" })).toBeInTheDocument();
    expect(screen.getByText(/a_check: 2 real passes · 10 fails · 0 vacuous/)).toBeInTheDocument();
  });
});

describe("SvaSequenceWaveformVisualizer: flop-output-low sampling lab", () => {
  const renderLab = () => render(<SvaSequenceWaveformVisualizer initialPreset="flop-output-low" modes={["learn"]} />);
  const lockIn = () => screen.getByRole("button", { name: /^Lock in edge/ });
  const next = () => fireEvent.click(screen.getByRole("button", { name: /Next edge/ }));

  it("hides every verdict and print until the learner locks in a prediction", () => {
    renderLab();
    expect(screen.getByRole("region", { name: "Sampling and regions lab" })).toBeInTheDocument();
    expect(screen.queryByTestId("sva-sampling-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(/pass: \$sampled\(q\)=[01x]/)).not.toBeInTheDocument();
    expect(screen.getByTestId("sva-region-lane").textContent).toMatch(/^PreponedObservedReactive(\?)+$/);
    expect(lockIn()).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "pass" }));
    expect(lockIn()).toBeDisabled(); // the print values are part of the prediction
  });

  it("edge 2: a pass whose message prints q = 1 while $sampled(q) = 0, with feedback that names the Reactive region", () => {
    renderLab();
    next();
    next();
    expect(screen.getByRole("slider", { name: "Edge" })).toHaveValue("2");
    fireEvent.click(screen.getByRole("radio", { name: "pass" }));
    fireEvent.click(screen.getByRole("radio", { name: "The pass message prints $sampled(q) = 0" }));
    fireEvent.click(screen.getByRole("radio", { name: "The pass message prints q = 0" }));
    fireEvent.click(lockIn());
    const reveal = screen.getByTestId("sva-sampling-reveal");
    expect(reveal).toHaveTextContent(/Your prediction ✕/);
    expect(reveal).toHaveTextContent(/runs in Reactive with current values \(§4\.4\.2\.6\), so q prints 1/);
    expect(reveal).toHaveTextContent('Reactive: the pass statement prints "pass: $sampled(q)=0 q=1"');
    expect(reveal).toHaveTextContent(/▼ Preponed: q sampled = 0/);
    expect(screen.getByTestId("sva-region-lane").textContent).toContain("0|1");
  });

  it("predicting a failure at the copy edge is corrected: the failure comes one edge later", () => {
    renderLab();
    fireEvent.change(screen.getByRole("slider", { name: "Edge" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("radio", { name: "fail" }));
    fireEvent.click(lockIn());
    expect(screen.getByTestId("sva-sampling-reveal")).toHaveTextContent(/reads the Preponed sample q = 0 \(§16\.5\.1\), so it passes\. The failure shows up one edge later/);
  });

  it("disable iff (rst): the edge where rst rises is disabled although its sample is 0", () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Add disable iff (rst)" }));
    expect(screen.getByText(/disable iff \(rst\) q == 1'b0\)/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Edge" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("radio", { name: "fail" }));
    fireEvent.click(lockIn());
    const reveal = screen.getByTestId("sva-sampling-reveal");
    expect(reveal).toHaveTextContent(/Edge 3: DISABLED/);
    expect(reveal).toHaveTextContent(/Its sample is 0, but disable iff reads the current value, 1, in Observed \(§16\.12\)/);
  });

  it("editing the trace withdraws the reveal; reveal-every-edge gives the model's summary", () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("sva-sampling-reveal")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "d at edge 0: 0. Toggle." }), { key: "Enter" });
    expect(screen.queryByTestId("sva-sampling-reveal")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "d at edge 0: 1. Toggle." }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Reveal every edge" }));
    expect(screen.getByText(/4 passes · 2 fails · 0 disabled; the pass message prints q different from \$sampled\(q\) at edge 2/)).toBeInTheDocument();
  });

  it("q before edge 0 = x: the first attempt fails and the explanation cites §16.6", () => {
    renderLab();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "q before edge 0" })).getByRole("radio", { name: "x" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("sva-sampling-reveal")).toHaveTextContent(/Edge 0: FAIL.*counts as false \(§16\.6\)/);
  });
});
