import React from "react";
import { act, configure, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SVSchedulerRegionVisualizerDefault, { SVSchedulerRegionVisualizer } from "@/components/visualizers/SVSchedulerRegionVisualizer";
import { DELTA_DEFINITION } from "@/lib/sv-region-map-model";
import { allRegionMapScenarioPresets, type AnyRegionMapScenarioId } from "@/lib/sv-region-map-scenarios-extra";
import { simulateTimeSlot } from "@/lib/sv-scheduler-model";

// The Continue button's description lives in a hidden element that repeats the gate's feedback; text queries are about what a reader sees.
configure({ defaultIgnore: "script, style, [hidden]" });

/** A rung of the region map, found the way a reader finds it: by the region's name. */
const regionRow = (name: string) => {
  const items = within(screen.getByRole("list", { name: "Where each event landed" })).getAllByRole("listitem");
  const row = items.find((li) => li.querySelector("p")?.textContent === name);
  if (!row) throw new Error(`no region row ${name}`);
  return row;
};

/** A queue row at the gate, found by its name including the screen-reader text. */
const queueRow = (name: string) => {
  const items = within(screen.getByRole("list", { name: "Queued events by region" })).getAllByRole("listitem");
  const row = items.find((li) => li.textContent?.startsWith(`${name} queue:`));
  if (!row) throw new Error(`no queue row ${name}`);
  return row;
};

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

  it("shows the code and the region names, but hides the trace, log, map and ladder until a prediction is committed", () => {
    render(<SVSchedulerRegionVisualizer />);
    expect(within(screen.getByRole("list", { name: /A flop feeds a continuous assignment/ })).getByText("assign y = q;")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Regions of one time slot, in order" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Preponed",
      "Active",
      "Inactive",
      "NBA",
      "Observed",
      "Reactive",
      "Re-Inactive",
      "Re-NBA",
      "Postponed",
    ]);
    expect(screen.queryByRole("group", { name: /One time slot/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /scrubber/i })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("diagnoses the 'runs in NBA' misconception, then shows q landing in NBA and assign y re-running in Active at Δ1", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/In NBA, together with the update of q/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/NBA only applies the scheduled updates/).length).toBeGreaterThan(0);
    expect(regionRow("NBA")).toHaveTextContent("q ← 1 (q <= d;)");
    const active = regionRow("Active");
    expect(within(active).getByRole("button", { name: /run assign y, delta 1/ })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: /run always_ff, delta 0/ })).toBeInTheDocument();
    expect(regionRow("Observed")).toHaveTextContent("nothing landed here");
  });

  it("selecting a map entry moves the synchronized trace to that step", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/Back in Active, in a second pass/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(regionRow("Active")).getByRole("button", { name: /assign y = q; updates now/ }));
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
    expect(regionRow("Inactive")).toHaveTextContent("$display: q=0");
    expect(regionRow("Postponed")).toHaveTextContent("$strobe: q=5");
  });

  it("program block: wrapper code is shown and its thread lands in Reactive, its <= in Re-NBA", () => {
    render(<SVSchedulerRegionVisualizer scenario="program-reactive" />);
    expect(screen.getByText("program tb;")).toBeInTheDocument();
    commit(/0: the value before the edge/);
    expect(screen.getAllByText(/clocking-block input/).length).toBeGreaterThan(0);
    expect(regionRow("Reactive")).toHaveTextContent("run program thread");
    expect(regionRow("Re-NBA")).toHaveTextContent("cmd ← 1 (cmd <= 1;)");
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
// Predict-then-reveal: nothing on screen may give the answer before a commit
// ---------------------------------------------------------------------------

/** Everything the frame shows except the prompts, whose options name every answer by design. */
const textOutsidePrompts = () => {
  const frame = screen.getByRole("region", { name: "Scheduler region map" }).cloneNode(true) as HTMLElement;
  frame.querySelectorAll("fieldset").forEach((f) => f.remove());
  return frame.textContent ?? "";
};

const correctLabels = (id: AnyRegionMapScenarioId) => {
  const preset = allRegionMapScenarioPresets.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  const scenario = preset.build();
  return preset.predictions(scenario, simulateTimeSlot(scenario)).flatMap((p) => p.options.filter((o) => o.correct).map((o) => o.label));
};

const revealAll = () => {
  for (let i = 0; i < 2; i += 1) {
    const skip = screen.queryAllByRole("button", { name: /reveal without predicting/i })[0];
    if (skip) fireEvent.click(skip);
  }
};

describe.each<"log" | "next-region">(["log", "next-region"])("SVSchedulerRegionVisualizer · before the commit, %s mode", (mode) => {
  it.each(allRegionMapScenarioPresets.map((p) => p.id))("%s: nothing outside the prompts names the correct option", (id) => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario={id} />);
    const text = textOutsidePrompts();
    for (const label of correctLabels(id)) expect(text).not.toContain(label);
    expect(text).not.toMatch(/second pass|runs again in Active/);
  });

  it("the ladder's tags and the answering assumptions wait for the reveal, on the default scenario and on clocking-drive", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="clocking-drive" />);
    const hidden = /clocking drives|program <=|drives in Re-NBA|samples in Preponed|one legal order each/;
    expect(textOutsidePrompts()).not.toMatch(hidden);
    expect(screen.getByText(/The assumptions that say where events land appear once you commit/)).toBeInTheDocument();
    revealAll();
    expect(screen.getByText("clocking drives · program <=")).toBeInTheDocument();
    expect(screen.getByText(/#1step input skew samples in Preponed \(§14\.13, §4\.4\.2\.1\)/)).toBeInTheDocument();
    expect(screen.getByText(/one legal order each/)).toBeInTheDocument();
    expect(screen.queryByText(/The assumptions that say where events land appear/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Regions of one time slot, in order" })).not.toBeInTheDocument();
  });

  it("the default scenario's setup is neutral, and its summary with the answer appears on the reveal", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} />);
    expect(screen.getByText("A flop's q feeds a continuous assignment, whose y feeds an always_comb.")).toBeInTheDocument();
    expect(screen.queryByText(/runs again in Active/)).not.toBeInTheDocument();
    revealAll();
    expect(screen.getByText(/runs again in Active: a second pass of the same time slot/)).toBeInTheDocument();
    expect(screen.queryByText(/A flop's q feeds/)).not.toBeInTheDocument();
  });
});

describe("SVSchedulerRegionVisualizer · frame summary", () => {
  it("log mode leaves out the return to Active until the reveal", () => {
    render(<SVSchedulerRegionVisualizer />);
    expect(screen.queryByText(/watch the ladder return to Active/)).not.toBeInTheDocument();
    revealAll();
    expect(screen.getByText(/watch the ladder return to Active whenever a later region creates new work/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The reveal: verdict, diagnosis and focus, in the mode lessons use and the gated one
// ---------------------------------------------------------------------------

const verdictLine = () => screen.getAllByRole("status")[0];

describe.each<"log" | "next-region">(["log", "next-region"])("SVSchedulerRegionVisualizer · the reveal, %s mode", (mode) => {
  it.each<[AnyRegionMapScenarioId, RegExp]>([
    ["comb-after-nba", /Back in Active, in a second pass/],
    ["zero-delay-prints", /^\$display: q=0\s+→\s+\$display: q=0\s+→\s+\$strobe: q=5$/],
    ["program-watcher", /The watcher: the reactive set drains completely/],
  ])("%s: locking in the last prediction moves focus to Next, and the verdict sits above the narration", (scenario, answer) => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario={scenario} scenarios={[scenario]} />);
    const status = verdictLine();
    expect(status).toBeEmptyDOMElement();
    commit(answer);
    expect(next()).toHaveFocus();
    expect(status).toHaveTextContent(/^Your prediction was right\. Answer: /);
    expect(status.compareDocumentPosition(next()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The prompt's feedback follows the transport, so Tab reaches it next and collapsing it never moves Next.
    expect(next().compareDocumentPosition(screen.getByText(/^Correct\./)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("'Reveal without predicting' also moves focus to Next, and the verdict scores nothing", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(next()).toHaveFocus();
    expect(verdictLine()).toHaveTextContent(/^Answer: Back in Active, in a second pass of the same time slot\.$/);
  });

  it("a wrong pick's diagnosis is in the verdict line, and it stays there after the first Next collapses the prompt", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/In NBA, together with the update of q/);
    const diagnosis = /Your pick "In NBA, together with the update of q": NBA only applies the scheduled updates\./;
    expect(verdictLine()).toHaveTextContent(/^Your prediction was not right\. Answer: Back in Active/);
    expect(verdictLine()).toHaveTextContent(diagnosis);
    fireEvent.click(next());
    expect(screen.getByRole("button", { name: "Show your prediction" })).toBeInTheDocument();
    expect(within(verdictLine()).getByText(diagnosis)).toBeVisible();
  });

  it("a right pick has nothing to diagnose", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(verdictLine()).not.toHaveTextContent(/Your pick/);
  });

  it("the locked predictions step aside once the learner moves on, and Show / Hide brings them back", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(screen.queryByRole("button", { name: /your prediction/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Correct\./)).toBeVisible();
    fireEvent.click(next());
    const toggle = screen.getByRole("button", { name: "Show your prediction" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/^Correct\./)).not.toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide your prediction" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/^Correct\./)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide your prediction" }));
    expect(screen.getByText(/^Correct\./)).not.toBeVisible();
  });

  it("clocking-drive: Show / Hide is plural, because two predictions are locked", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    revealAll();
    fireEvent.click(next());
    const toggle = screen.getByRole("button", { name: "Show your predictions" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide your predictions" })).toHaveAttribute("aria-expanded", "true");
  });

  it("clocking-drive: focus goes to the next open prompt, then to Next, and each commit is announced before the reveal", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    const status = verdictLine();
    fireEvent.click(screen.getByLabelText(/NBA, like any <= executed by module code/));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
    expect(screen.getByLabelText(/the Preponed sample/)).toHaveFocus();
    expect(screen.queryByRole("slider", { name: /scrubber/i })).not.toBeInTheDocument();
    // Mounted before the commit, so it is announced; hidden from sight, because the prompt shows the same words.
    expect(status).toHaveTextContent(/^Prediction 1 of 2: not quite\. That is where a plain din <= 7 from module code would land/);
    expect(status).toHaveTextContent(/A zero-skew synchronous drive with no cycle delay schedules its update in the Re-NBA region/);
    expect(status.querySelector("p")).toHaveClass("sr-only");
    fireEvent.click(screen.getByLabelText(/the Preponed sample/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(next()).toHaveFocus();
    expect(status).toHaveTextContent(/^1 of 2 predictions right\. Answers: Re-NBA, after the design NBA updates queued for this edge; 1: the Preponed sample \(#1step\)\./);
    expect(status).toHaveTextContent(/Your pick "NBA, like any <= executed by module code": That is where a plain din <= 7/);
  });

  it("clocking-drive: skipping the first question and answering the second scores only the answered one, and the skip is announced", () => {
    render(<SVSchedulerRegionVisualizer mode={mode} scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    const status = verdictLine();
    fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[0]);
    expect(status).toHaveTextContent(/^Prediction 1 of 2 revealed\. A zero-skew synchronous drive/);
    fireEvent.click(screen.getByLabelText(/the Preponed sample/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(next()).toHaveFocus();
    expect(status).toHaveTextContent(/^1 of 1 answered predictions right\. Answers: /);
  });
});

describe("SVSchedulerRegionVisualizer · log-mode transport", () => {
  it("has no gate and no queue chips, and the log fills in as it steps", () => {
    render(<SVSchedulerRegionVisualizer scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(screen.queryByRole("list", { name: "Queued events by region" })).not.toBeInTheDocument();
    for (let i = 0; i < 40 && !next().hasAttribute("disabled"); i += 1) fireEvent.click(next());
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
  });

  it("Next reaching the last step hands focus to the scrubber, and Reset hands it back to Next", () => {
    render(<SVSchedulerRegionVisualizer scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(next()).toHaveFocus();
    for (let i = 0; i < 40 && !next().hasAttribute("disabled"); i += 1) fireEvent.click(next());
    expect(next()).toBeDisabled();
    const scrubber = screen.getByRole("slider", { name: /scrubber/i });
    expect(scrubber).toHaveFocus();
    const reset = screen.getByRole("button", { name: /reset to the initial state/i });
    reset.focus();
    fireEvent.click(reset);
    expect(reset).toBeDisabled();
    expect(next()).toHaveFocus();
  });

  it("a move step's caption says the queues are from before the move and where the events are going", () => {
    render(<SVSchedulerRegionVisualizer scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    for (let i = 0; i < 40 && !screen.queryByText(/1 NBA event moves to Active/); i += 1) fireEvent.click(next());
    expect(screen.getByText("The queues show the moment before this move. ▶ marks NBA, whose events are moving up to Active.")).toBeInTheDocument();
    fireEvent.click(next());
    expect(screen.queryByText(/The queues show the moment before this move/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Badges count queued events\. ▶ marks the region executing now; ↺ marks NBA, where this event was scheduled\.$/)).toBeInTheDocument();
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
    expect(regionRow("Reactive")).toHaveTextContent("run watcher");
    expect(regionRow("Active")).toHaveTextContent("run assign led");
    jumpToEnd();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("$display: cmd=1 led=0");
  });

  it("clocking-drive: both questions gate the reveal; din lands in Re-NBA and the @(cb) event in Observed", () => {
    render(<SVSchedulerRegionVisualizer scenario="clocking-drive" scenarios={["clocking-drive"]} />);
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/Re-NBA, after the design NBA updates queued for this edge/));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/the value after the flop's NBA update/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/#1step sample taken in Preponed/).length).toBeGreaterThan(0);
    expect(regionRow("Re-NBA")).toHaveTextContent("din ← 7 (cb.din <= 7;)");
    expect(regionRow("Observed")).toHaveTextContent("@(cb) event triggers");
    expect(regionRow("Preponed")).toHaveTextContent("sample clk=0 din=3 q=1");
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
    expect(queueRow("NBA")).toHaveTextContent("q ← 1");
    expect(queueRow("Inactive")).toHaveTextContent("empty");

    answerGate("Inactive");
    expect(within(g).getByText(/Not quite/)).toBeInTheDocument();
    expect(within(g).getByText(/Inactive holds no events at this point/)).toBeInTheDocument();
    expect(g).toHaveTextContent(/Why the answer holds:.*NBA is the first region with events/);
    expect(g).toHaveTextContent(/Δ is now 1\./);
    expect(g).toHaveTextContent(/Δ is a model count of moves back to Active or Reactive, not a term of the standard\./);
    // The full definition is shown once, under the region map.
    expect(g.textContent).not.toContain(DELTA_DEFINITION);
    expect(screen.getAllByText((_, el) => el?.tagName === "P" && Boolean(el.textContent?.includes(DELTA_DEFINITION)))).toHaveLength(1);
    expect(g.textContent).not.toMatch(/first nonempty region|move events in R/);

    fireEvent.click(within(g).getByRole("button", { name: /continue stepping/i }));
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
    expect(screen.getByText(/Active is empty\. 1 NBA event moves to Active: q ← 1/)).toBeInTheDocument();
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
    expect(queueRow("Postponed")).toHaveTextContent("empty");
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
    expect(queueRow("Reactive")).toHaveTextContent("run program thread");
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
      fireEvent.click(screen.getByLabelText(/Re-NBA, after the design NBA updates queued for this edge/));
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
    expect(queueRow("Re-NBA")).toHaveTextContent("din ← 7");
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
    expect(screen.getByText(/1 Re-NBA event moves to Reactive: din ← 7/)).toBeInTheDocument();
  });

  it("moves focus to the gate when a decision opens and names the region after the question", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(document.activeElement?.getAttribute("data-testid")).not.toBe("next-region-gate");
    const g = stepToGate();
    expect(g).toHaveFocus();
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
    expect(regionRow("NBA")).toHaveTextContent("nothing landed here yet");
    expect(within(regionRow("Active")).queryByRole("button", { name: /run assign y/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Later landings stay hidden until you answer the pending decision/)).toBeInTheDocument();
    stepToGate();
    answerGate("NBA");
    expect(regionRow("NBA")).toHaveTextContent("nothing landed here yet");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(regionRow("NBA")).toHaveTextContent("q ← 1");
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(regionRow("Active")).toHaveTextContent("run assign y");
    expect(regionRow("Observed")).toHaveTextContent("nothing landed here");
    expect(screen.queryByText(/Later landings stay hidden/)).not.toBeInTheDocument();
  });

  it("hides the step's explanation while a decision is open, because it can name the answer, and shows it once the learner commits", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(screen.queryByText(/Answer the decision below first/)).not.toBeInTheDocument();
    stepToGate();
    expect(screen.getByText(/Answer the decision below first; the explanation of this step appears once you commit/)).toBeInTheDocument();
    answerGate("NBA");
    expect(screen.queryByText(/Answer the decision below first/)).not.toBeInTheDocument();
  });

  it("'Reveal without predicting' at a gate shows the answer's reason and scores nothing in the recap", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    for (let i = 0; i < 2; i += 1) {
      const g = stepToGate();
      fireEvent.click(within(g).getByRole("button", { name: /reveal without predicting/i }));
      expect(within(g).getByText(/Why the answer holds:/)).toBeInTheDocument();
      expect(within(g).queryByText(/Not quite/)).not.toBeInTheDocument();
      fireEvent.click(within(g).getByRole("button", { name: /continue stepping/i }));
    }
    expect(screen.getByText("No decision answered; the loop went Active → NBA → slot end.")).toBeInTheDocument();
    expect(screen.queryByText(/0 of 2/)).not.toBeInTheDocument();
  });

  it("an answer changed by going back and forward does not score: the first answer stands", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    stepToGate();
    answerGate("Inactive");
    fireEvent.click(screen.getByRole("button", { name: /previous scheduler step/i }));
    expect(screen.queryByTestId("next-region-gate")).not.toBeInTheDocument();
    fireEvent.click(next());
    answerGate("NBA");
    expect(within(gate()).getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText("1 of 2 right; the loop went Active → NBA → slot end.")).toBeInTheDocument();
  });

  it("an answer given after 'Reveal without predicting' does not score: the decision stays revealed", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    const first = stepToGate();
    fireEvent.click(within(first).getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous scheduler step/i }));
    fireEvent.click(next());
    answerGate("NBA");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText("1 of 1 answered right, 1 revealed without predicting; the loop went Active → NBA → slot end.")).toBeInTheDocument();
  });

  it("retrying forgets the revealed decisions too", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    for (let i = 0; i < 2; i += 1) {
      fireEvent.click(within(stepToGate()).getByRole("button", { name: /reveal without predicting/i }));
      fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /try the decisions again/i }));
    stepToGate();
    answerGate("NBA");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText("2 of 2 right; the loop went Active → NBA → slot end.")).toBeInTheDocument();
  });

  it("the verdict line steps aside while a gate is unanswered, because a gate can ask what the prediction asked", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="program-watcher" scenarios={["program-watcher"]} />);
    commit(/The watcher: the reactive set drains completely/);
    expect(verdictLine()).toHaveTextContent(/^Your prediction was right\. Answer: The watcher/);
    for (const correct of ["NBA", "The reactive set (Reactive)", "Re-NBA"]) {
      stepToGate();
      expect(verdictLine()).toBeEmptyDOMElement();
      answerGate(correct);
      expect(verdictLine()).toHaveTextContent(/^Your prediction was right\. Answer: The watcher/);
      fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
      expect(verdictLine()).toHaveTextContent(/^Your prediction was right\. Answer: The watcher/);
    }
    const priority = stepToGate();
    expect(priority).toHaveTextContent(/Decision 4 of \d+: Active and Reactive both hold work/);
    expect(verdictLine()).toBeEmptyDOMElement();
    expect(screen.queryByText(/The watcher: the reactive set drains completely/)).not.toBeVisible();
  });

  describe("playback against a pending decision", () => {
    it("Play stops on the step before the decision: focus moves to the gate and Next is disabled", () => {
      vi.useFakeTimers();
      try {
        render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
        commit(/Back in Active, in a second pass/);
        fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
        expect(screen.getByRole("button", { name: /^Pause$/ })).toBeInTheDocument();
        for (let i = 0; i < 40 && !screen.queryByTestId("next-region-gate"); i += 1) {
          act(() => {
            vi.advanceTimersByTime(1400);
          });
        }
        const g = gate();
        expect(g).toHaveFocus();
        expect(next()).toBeDisabled();
        expect(screen.getByRole("button", { name: /^Play$/ })).toBeDisabled();
        const slider = screen.getByRole("slider", { name: /scrubber/i });
        const at = slider.getAttribute("value");
        act(() => {
          vi.advanceTimersByTime(14000);
        });
        expect(slider.getAttribute("value")).toBe(at);
        expect(screen.getByText(/Answer the decision below first/)).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("ArrowRight on the transport cannot pass a pending decision", () => {
      render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
      commit(/Back in Active, in a second pass/);
      const group = screen.getByRole("group", { name: /scheduler step playback controls/i });
      for (let i = 0; i < 40; i += 1) fireEvent.keyDown(group, { key: "ArrowRight" });
      expect(gate()).toHaveTextContent(/Decision 1 of 2/);
      const slider = within(group).getByRole("slider");
      const at = slider.getAttribute("value");
      fireEvent.keyDown(group, { key: "ArrowRight" });
      expect(slider.getAttribute("value")).toBe(at);
      expect(screen.getByText(/Later landings stay hidden/)).toBeInTheDocument();
      expect(regionRow("NBA")).toHaveTextContent("nothing landed here yet");
    });
  });

  it("the closing recap scores the first answer of each decision and traces the path, and retrying starts the decisions over", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    stepToGate();
    answerGate("Inactive");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText("1 of 2 right; the loop went Active → NBA → slot end.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try the decisions again/i }));
    expect(screen.queryByText(/of 2 right/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try the decisions again/i })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /scrubber/i })).toHaveValue("0");
    expect(next()).toHaveFocus();
    const g = stepToGate();
    expect(g).toHaveTextContent(/Decision 1 of 2/);
    expect(within(g).getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    answerGate("NBA");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    stepToGate();
    answerGate("Postponed is empty: the slot ends");
    fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    expect(screen.getByText("2 of 2 right; the loop went Active → NBA → slot end.")).toBeInTheDocument();
  });

  it("program-watcher: the priority gate grades Reactive right and tells 'Back to Active' why it must wait", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="program-watcher" scenarios={["program-watcher"]} />);
    commit(/The watcher: the reactive set drains completely/);
    for (const correct of ["NBA", "The reactive set (Reactive)", "Re-NBA"]) {
      stepToGate();
      answerGate(correct);
      expect(within(gate()).getByText(/^Correct\./)).toBeInTheDocument();
      fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    }
    const g = stepToGate();
    expect(g).toHaveTextContent(/Decision 4 of \d+: Active and Reactive both hold work after step \d+\. Which runs next\?/);
    expect(queueRow("Active")).toHaveTextContent("run assign led");
    expect(queueRow("Reactive")).toHaveTextContent("run watcher");
    answerGate("Back to Active");
    expect(within(g).getByText(/Not quite/)).toBeInTheDocument();
    expect(g).toHaveTextContent(/Active does hold work, but the scheduler is still inside the reactive loop/);
    expect(g).toHaveTextContent(/Why the answer holds:.*Reactive runs next and Active waits for the outer loop/);
  });

  it("the key reveal of program-watcher says what is really queued, not a pending NBA update", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="program-watcher" scenarios={["program-watcher"]} />);
    commit(/The watcher: the reactive set drains completely/);
    for (const correct of ["NBA", "The reactive set (Reactive)", "Re-NBA", "The reactive set (Reactive)"]) {
      stepToGate();
      answerGate(correct);
      fireEvent.click(within(gate()).getByRole("button", { name: /continue stepping/i }));
    }
    for (let i = 0; i < 10 && !screen.queryByText(/^Prints cmd=1 led=0 immediately\.$/); i += 1) fireEvent.click(next());
    expect(screen.getByText(/Active still holds run assign led, which waits until the reactive set has drained/)).toBeInTheDocument();
    expect(screen.queryByText(/pending NBA updates/)).not.toBeInTheDocument();
  });

  it("between decisions the full chips are off the phone layout; the gate keeps them everywhere", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="comb-after-nba" scenarios={["comb-after-nba"]} />);
    commit(/Back in Active, in a second pass/);
    expect(screen.getByRole("list", { name: "Queued events by region" })).toHaveClass("max-sm:hidden");
    stepToGate();
    expect(screen.getByRole("list", { name: "Queued events by region" })).not.toHaveClass("max-sm:hidden");
  });

  it("the Continue button that takes focus after a gate is described by the feedback, for right, wrong and skipped answers", () => {
    render(<SVSchedulerRegionVisualizer mode="next-region" scenario="zero-delay-prints" scenarios={["zero-delay-prints"]} />);
    commit(/^\$display: q=0\s+→\s+\$display: q=0\s+→\s+\$strobe: q=5$/);
    const cont = () => within(gate()).getByRole("button", { name: /continue stepping/i });

    stepToGate();
    answerGate("Inactive");
    expect(cont()).toHaveFocus();
    expect(cont()).toHaveAccessibleDescription(expect.stringMatching(/^Correct\. .*processes that executed #0 move up into Active/));
    fireEvent.click(cont());

    stepToGate();
    answerGate("Observed");
    expect(cont()).toHaveFocus();
    expect(cont()).toHaveAccessibleDescription(expect.stringMatching(/^Not quite\. Observed holds no events at this point.*NBA is the first region with events/));
    fireEvent.click(cont());

    const g = stepToGate();
    fireEvent.click(within(g).getByRole("button", { name: /reveal without predicting/i }));
    expect(cont()).toHaveFocus();
    expect(cont()).toHaveAccessibleDescription(expect.stringMatching(/^No region from Active to Re-NBA holds anything/));
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
