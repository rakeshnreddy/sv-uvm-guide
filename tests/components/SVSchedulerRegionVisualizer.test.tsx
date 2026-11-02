import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SVSchedulerRegionVisualizerDefault, { SVSchedulerRegionVisualizer } from "@/components/visualizers/SVSchedulerRegionVisualizer";

const regionRow = (name: string) => within(screen.getByRole("list", { name: "Where each event landed" })).getByLabelText(new RegExp(`^${name}:`));

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const jumpToEnd = () => {
  const scrubber = screen.getByRole("slider", { name: /scrubber/i });
  fireEvent.change(scrubber, { target: { value: scrubber.getAttribute("max") } });
};

describe("SVSchedulerRegionVisualizer (F3B region map, model-driven)", () => {
  it("keeps the named export the lesson registry loads, and the default export", () => {
    expect(SVSchedulerRegionVisualizerDefault).toBe(SVSchedulerRegionVisualizer);
  });

  it("shows the code and the empty ladder, but hides the trace, log and map until a prediction is committed", () => {
    render(<SVSchedulerRegionVisualizer />);
    expect(within(screen.getByRole("list", { name: /A flop feeds a continuous assignment/ })).getByText("assign y = q;")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /scrubber/i })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("diagnoses the 'runs in NBA' misconception, then shows q landing in NBA and assign y re-running in Active at Δ1", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/In NBA, together with the update of q/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/NBA only applies the scheduled updates/).length).toBeGreaterThan(0);
    expect(regionRow("NBA")).toHaveAttribute("aria-label", expect.stringContaining("q ← 1 (q <= d;)"));
    const active = regionRow("Active");
    expect(within(active).getByRole("button", { name: /run assign y, delta 1/ })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: /run always_ff, delta 0/ })).toBeInTheDocument();
    expect(regionRow("Observed")).toHaveAttribute("aria-label", "Observed: nothing landed here");
  });

  it("selecting a map entry moves the synchronized trace to that step", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/Back in Active, in a second pass/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(regionRow("Active")).getByRole("button", { name: /y = q; writes now/ }));
    const current = document.querySelector('li[aria-current="step"]');
    expect(current?.textContent).toContain("assign y = q;");
    expect(screen.getByLabelText(/^y = 1, just changed$/)).toBeInTheDocument();
  });

  it("#0 and $strobe: the log fills in step by step and ends with the settled value", () => {
    render(<SVSchedulerRegionVisualizer scenario="zero-delay-prints" />);
    commit(/^\$display: q=0\s+→\s+\$display: q=0\s+→\s+\$strobe: q=5$/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("(no output yet)");
    jumpToEnd();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("$display: q=0$display: q=0$strobe: q=5");
    expect(regionRow("Inactive")).toHaveAttribute("aria-label", expect.stringContaining("$display: q=0"));
    expect(regionRow("Postponed")).toHaveAttribute("aria-label", expect.stringContaining("$strobe: q=5"));
  });

  it("program block: wrapper code is shown and its thread lands in Reactive, its <= in Re-NBA", () => {
    render(<SVSchedulerRegionVisualizer scenario="program-reactive" />);
    expect(screen.getByText("program tb;")).toBeInTheDocument();
    commit(/0: the value before the edge/);
    expect(screen.getAllByText(/clocking-block input/).length).toBeGreaterThan(0);
    expect(regionRow("Reactive")).toHaveAttribute("aria-label", expect.stringContaining("run program thread"));
    expect(regionRow("Re-NBA")).toHaveAttribute("aria-label", expect.stringContaining("cmd ← 1 (cmd <= 1;)"));
  });

  it("is keyboard operable: arrow keys switch scenario (resetting the prediction) and step the trace", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/Back in Active/);
    const group = screen.getByRole("group", { name: /scheduler step playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next scheduler step/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);

    fireEvent.keyDown(screen.getByRole("radio", { name: "NBA → combinational" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "$display · #0 · $strobe" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// scheduler-model-v2: extra presets and next-region mode
// ---------------------------------------------------------------------------

const next = () => screen.getByRole("button", { name: /next scheduler step/i });
const gate = () => screen.getByTestId("next-region-gate");

/** Clicks Next until playback pauses at a decision (or gives up). */
const stepToGate = () => {
  for (let i = 0; i < 40 && !screen.queryByTestId("next-region-gate"); i += 1) fireEvent.click(next());
  return gate();
};

const answerGate = (label: string) => {
  const g = gate();
  fireEvent.click(within(g).getByLabelText(label));
  fireEvent.click(within(g).getByRole("button", { name: /lock in prediction/i }));
  return g;
};

describe("SVSchedulerRegionVisualizer · extra presets (sv-region-map-scenarios-extra)", () => {
  it("program-watcher: the watcher thread lands in Reactive before assign led, and its print proves led was still 0", () => {
    render(<SVSchedulerRegionVisualizer scenario="program-watcher" scenarios={["program-reactive", "program-watcher"]} />);
    expect(screen.getByText('initial forever @(cmd) $display("cmd=%0d led=%0d", cmd, led);')).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    commit(/assign led = cmd: design code resumes/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/reactive set must drain first/).length).toBeGreaterThan(0);
    expect(regionRow("Reactive")).toHaveAttribute("aria-label", expect.stringContaining("run watcher"));
    expect(regionRow("Active")).toHaveAttribute("aria-label", expect.stringContaining("run assign led"));
    jumpToEnd();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("$display: cmd=1 led=0");
  });

  it("clocking-drive: both questions gate the reveal; din lands in Re-NBA and the @(cb) event in Observed", () => {
    render(<SVSchedulerRegionVisualizer scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/Re-NBA, after every design NBA update/));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/the value after the flop's NBA update/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/#1step sample taken in Preponed/).length).toBeGreaterThan(0);
    expect(regionRow("Re-NBA")).toHaveAttribute("aria-label", expect.stringContaining("din ← 7 (cb.din <= 7;)"));
    expect(regionRow("Observed")).toHaveAttribute("aria-label", expect.stringContaining("@(cb) event triggers"));
    expect(regionRow("Preponed")).toHaveAttribute("aria-label", expect.stringContaining("sample clk=0 din=3 q=1"));
  });
});

describe("SVSchedulerRegionVisualizer · next-region mode", () => {
  it("pauses when Active runs dry, shows the queues on every rung, grades the pick and paraphrases the §4.5 step with Δ", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    expect(screen.getByText("Where does the scheduler loop go next?")).toBeInTheDocument();
    commit(/Back in Active, in a second pass/);
    expect(screen.getByRole("list", { name: "Queued events by region" })).toBeInTheDocument();
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
    const g = stepToGate();
    expect(g).toHaveTextContent(/Active is empty after step \d+\. Where does the scheduler go next\?/);
    expect(next()).toBeDisabled();
    expect(within(g).getAllByRole("radio")).toHaveLength(9);
    expect(screen.getByLabelText(/^NBA queue: q ← 1$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Inactive queue: empty$/)).toBeInTheDocument();

    answerGate("Inactive");
    expect(within(g).getByText(/Not quite/)).toBeInTheDocument();
    expect(within(g).getByText(/Inactive holds no events at this point/)).toBeInTheDocument();
    expect(g).toHaveTextContent(/Why the answer holds:.*NBA is the first region with events/);
    expect(g).toHaveTextContent(/Δ is now 1: the model's count of moves back into Active or Reactive/);
    expect(g).toHaveTextContent(/model count of moves back to Active/);
    expect(g.textContent).not.toMatch(/first nonempty region|move events in R/);

    fireEvent.click(within(g).getByRole("button", { name: /continue stepping/i }));
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
    expect(screen.getByText(/Active is empty\. 1 NBA event move to Active: q ← 1/)).toBeInTheDocument();
    expect(next()).not.toBeDisabled();
  });

  it("ends with 'the slot ends' when nothing is queued anywhere, and then the trace runs out", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    stepToGate();
    answerGate("NBA");
    expect(within(gate()).getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    const second = stepToGate();
    expect(second).toHaveTextContent(/Decision 2 of 2/);
    expect(screen.getByLabelText(/^Postponed queue: empty$/)).toBeInTheDocument();
    answerGate("Postponed, which has output to print");
    expect(within(second).getByText(/Postponed has nothing queued here/)).toBeInTheDocument();
    expect(within(second).getByLabelText(/^Postponed is empty: the slot ends/)).toBeInTheDocument();
    fireEvent.click(within(second).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText(/Time slot settles/)).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it("program block: the second pause asks about the switch to the reactive set, and a seek cannot jump past a pending decision", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="program-reactive" scenarios={["program-reactive"]} />);
    commit(/1: the new q/);
    expect(screen.getByText(/5 decisions in this slot/)).toBeInTheDocument();
    jumpToEnd();
    // The scrubber was clamped to the step before the first decision.
    const g = gate();
    expect(g).toHaveTextContent(/Decision 1 of 5/);
    answerGate("NBA");
    fireEvent.click(within(g).getByRole("button", { name: /continue stepping/i }));
    const second = stepToGate();
    expect(second).toHaveTextContent(/Decision 2 of 5/);
    expect(screen.getByLabelText(/^Reactive queue: run program thread$/)).toBeInTheDocument();
    answerGate("The reactive set (Reactive)");
    expect(within(second).getByText(/^Correct\./)).toBeInTheDocument();
    expect(second).toHaveTextContent(/turns to the reactive set/);
  });

  it("program block: 'Back to Active' while Re-NBA is pending is told the reactive set must drain first", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="program-reactive" scenarios={["program-reactive"]} />);
    commit(/1: the new q/);
    for (const correct of ["NBA", "The reactive set (Reactive)"]) {
      stepToGate();
      answerGate(correct);
      fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    }
    const third = stepToGate();
    expect(third).toHaveTextContent(/Decision 3 of 5: Reactive is empty after step \d+/);
    answerGate("Back to Active");
    expect(third).toHaveTextContent(/Reactive ran dry, but the reactive set is not finished: Re-NBA still holds events/);
  });

  it("clocking drive: entering the reactive set through an empty Reactive is one pause, and either answer is correct", () => {
    const answerClockingPredictions = () => {
      fireEvent.click(screen.getByLabelText(/Re-NBA, after every design NBA update/));
      fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
      fireEvent.click(screen.getByLabelText(/the Preponed sample/));
      fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    };
    const toEntry = () => {
      for (const correct of ["NBA", "Observed"]) {
        stepToGate();
        answerGate(correct);
        fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
      }
      return stepToGate();
    };
    const { unmount } = render(<SVSchedulerRegionVisualizer mode="next-region" scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    answerClockingPredictions();
    expect(screen.getByText(/4 decisions in this slot/)).toBeInTheDocument();
    let entry = toEntry();
    expect(entry).toHaveTextContent(/Decision 3 of 4: Active is empty after step \d+/);
    expect(screen.getByLabelText(/^Re-NBA queue: din ← 7$/)).toBeInTheDocument();
    answerGate("Re-NBA");
    expect(within(entry).getByText(/^Correct\./)).toBeInTheDocument();
    expect(entry).toHaveTextContent(/turned to the reactive set\. Reactive itself holds nothing/);
    unmount();

    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    answerClockingPredictions();
    entry = toEntry();
    answerGate("The reactive set (Reactive)");
    expect(within(entry).getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(entry).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText(/1 Re-NBA event move to Reactive: din ← 7/)).toBeInTheDocument();
  });

  it("moves focus to the gate when a decision opens and names the region after the question", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(document.activeElement?.getAttribute("data-testid")).not.toBe("next-region-gate");
    const g = stepToGate();
    expect(g).toHaveFocus();
    expect(g).toHaveAttribute("aria-live", "polite");
    expect(g).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("region", { name: /Decision 1 of 2: Active is empty after step \d+\. Where does the scheduler go next\?/ })).toBe(g);
  });

  it("after Continue, focus lands on Next, on the next gate, or on the scrubber when Next is disabled", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    stepToGate();
    answerGate("NBA");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(next()).toHaveFocus();
    const second = stepToGate();
    expect(second).toHaveFocus();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(second).getByRole("button", { name: /continue stepping/i }));
    expect(next()).toBeDisabled();
    expect(screen.getByRole("slider", { name: /scrubber/i })).toHaveFocus();
  });

  it("hides later landings while a decision is pending, so the map does not give the answer away", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(regionRow("NBA")).toHaveAttribute("aria-label", "NBA: nothing landed here yet");
    expect(within(regionRow("Active")).queryByRole("button", { name: /run assign y/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Later landings stay hidden until you answer the pending decision/)).toBeInTheDocument();
    stepToGate();
    answerGate("NBA");
    expect(regionRow("NBA")).toHaveAttribute("aria-label", "NBA: nothing landed here yet");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(regionRow("NBA")).toHaveAttribute("aria-label", expect.stringContaining("q ← 1"));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(regionRow("Active")).toHaveAttribute("aria-label", expect.stringContaining("run assign y"));
    expect(regionRow("Observed")).toHaveAttribute("aria-label", "Observed: nothing landed here");
    expect(screen.queryByText(/Later landings stay hidden/)).not.toBeInTheDocument();
  });

  it("switching scenario resets the decisions and the prediction", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba", "zero-delay-prints"]} />);
    commit(/Back in Active, in a second pass/);
    stepToGate();
    fireEvent.click(screen.getByRole("radio", { name: "$display · #0 · $strobe" }));
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    commit(/^\$display: q=0\s+→\s+\$display: q=0\s+→\s+\$strobe: q=5$/);
    expect(screen.getByText(/3 decisions in this slot/)).toBeInTheDocument();
    stepToGate();
    answerGate("Inactive");
    expect(within(gate()).getByText(/^Correct\./)).toBeInTheDocument();
    expect(gate()).toHaveTextContent(/processes that executed #0 move up into Active/);
  });
});
