import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CycleSignal } from "@/components/visual-system/CycleWaveform";
import SelfCheckBenchLab, { QueueStrip } from "@/components/visuals/SelfCheckBenchLab";
import { clinicCase, runBench, type EdgeStep } from "@/lib/selfcheck-bench-model";

// Records what every render passed to the waveform, so a test can see a state that lasts for one commit only.
const waveRenders = vi.hoisted(() => [] as { title: string; signals: string[] }[]);
vi.mock("@/components/visual-system/CycleWaveform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/visual-system/CycleWaveform")>();
  return {
    ...actual,
    CycleWaveform: (props: React.ComponentProps<typeof actual.CycleWaveform>) => {
      waveRenders.push({ title: props.title, signals: props.signals.map((sig: CycleSignal) => sig.name) });
      return actual.CycleWaveform(props);
    },
  };
});

const lockIn = (label: string | RegExp, promptIndex = 0) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[promptIndex]);
};
const status = () => screen.getAllByRole("status").map((el) => el.textContent ?? "").join(" | ");
const playbackGroup = () => screen.getByRole("group", { name: /step playback controls/i });
const scrubber = () => screen.getByRole("slider", { name: /step scrubber/i });
const stepTo = (index: number) => fireEvent.change(scrubber(), { target: { value: String(index) } });
const revealEdge = () => fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[0]);
/** Stubs a layout read for the length of one test (jsdom lays nothing out). */
const stubLayout = (prop: "clientWidth" | "clientHeight" | "scrollHeight", value: number) => vi.spyOn(HTMLElement.prototype, prop, "get").mockReturnValue(value);

afterEach(() => {
  vi.restoreAllMocks();
  waveRenders.length = 0;
});

describe("SelfCheckBenchLab step mode", () => {
  it("hides out_valid, sum and the checker's log until the edge prediction is locked in, then reveals them", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    expect(screen.getByRole("region", { name: "The self-checking loop, edge by edge" })).toBeInTheDocument();
    expect(screen.getByText(/send\(1, 2\) runs on edge 2\. On which edge does the checker see the result of send\(1, 2\)/)).toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: "sum" })).not.toBeInTheDocument();
    expect(screen.queryByText("PASS=3 FAIL=0")).not.toBeInTheDocument();
    expect(status()).toMatch(/hidden until you predict/);

    lockIn("Edge 4 (45 ns)");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/one for the checker to read the registered result/)).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "sum" })).toBeInTheDocument();
    expect(status()).not.toMatch(/hidden until you predict/);
  });

  it("diagnoses the 'same edge as the DUT samples' misconception", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    lockIn("Edge 3 (35 ns)");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/schedules out_valid <= 1 and sum <= 3/).length).toBeGreaterThan(0);
  });

  it("keeps the exp_q strip behind the second prediction and shows it after", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 4 (45 ns)");
    expect(screen.queryByRole("list", { name: /exp_q after this step/ })).not.toBeInTheDocument();
    expect(screen.getByText(/what does exp_q hold after edge 6\?/)).toBeInTheDocument();
    lockIn("{15, 19}", 0);
    expect(screen.getAllByText(/Correct\./)).toHaveLength(2);
    expect(screen.getByRole("list", { name: /exp_q after this step/ })).toBeInTheDocument();
    stepTo(6);
    expect(screen.getByRole("list", { name: /exp_q after this step, oldest first: 15, 19/ })).toBeInTheDocument();
  });

  it("steps edge by edge with the keyboard and narrates each edge from the model", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    revealEdge();
    revealEdge();
    expect(status()).toMatch(/Edge 0 \(5 ns\)/);
    const next = within(playbackGroup()).getByRole("button", { name: /next step/i });
    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(status()).toMatch(/Edge 1 \(15 ns\)/);
    expect(status()).toMatch(/releases reset with rst_n <= 1/);
    fireEvent.click(next);
    expect(status()).toMatch(/send\(5, 5\) drives in_valid, a and b with <= and pushes 10 onto exp_q/);
    stepTo(4);
    expect(status()).toMatch(/pops 10 from exp_q: a match, pass_cnt\+\+/);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/actual !== e\.sum/);
  });

  it("the gate holds in the anatomy and code panes: stepping to edge 4 before predicting lights no checker and highlights no compare", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    stepTo(4);
    expect(status()).toMatch(/Edge 4 \(45 ns\)/);
    expect(status()).not.toMatch(/pops 10 from exp_q/);
    expect(screen.queryByRole("group", { name: /checker is active/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /in flight/ })).not.toBeInTheDocument();
    const anatomy = screen.getByRole("group", { name: /^Anatomy of tb_top at Edge 4 \(45 ns\)/ });
    // Edge 4 of gaps also runs idle(), so the gated pane may name the bench's own action, never the checker's verdict.
    expect(anatomy).toHaveAttribute("aria-label", expect.stringMatching(/send\(\) \/ idle\(\) is active$/));
    expect(within(anatomy).queryByRole("button", { name: /checker.*(ok|error|active)/ })).not.toBeInTheDocument();
    const current = Array.from(document.querySelectorAll('[aria-current="step"]')).map((el) => el.textContent ?? "");
    expect(current.some((t) => /actual !== e\.sum/.test(t))).toBe(false);
    expect(current.some((t) => /check_result|\$isunknown|if \(rst_n\)/.test(t))).toBe(false);

    // Edge 10 is the checker's alone (it pops 23; the bench drives nothing): no block is lit and no line is current.
    stepTo(10);
    expect(status()).toMatch(/Edge 10 \(105 ns\)/);
    expect(status()).not.toMatch(/pops 23/);
    expect(screen.getByRole("group", { name: /^Anatomy of tb_top at Edge 10 \(105 ns\): the bench is waiting on this edge; the DUT and the checker are hidden until you predict$/ })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();

    // Edge 2 is the bench's own action: send() may light up, with its line, but still without result tokens.
    stepTo(2);
    const sendGroup = screen.getByRole("group", { name: /Anatomy of tb_top at Edge 2 \(25 ns\): send\(\) \/ idle\(\) is active$/ });
    expect(sendGroup).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/in_valid <= 1'b1; a <= a_val; b <= b_val;/);

    // Stepping to the end before predicting keeps report()'s counters out of the narration.
    stepTo(Number(scrubber().getAttribute("max")));
    expect(status()).toMatch(/counters are hidden until you predict/);
    expect(screen.queryByText(/PASS=4 FAIL=0/)).not.toBeInTheDocument();

    // Once the edge prediction is locked in, the checker's verdict and compare line appear at edge 4.
    stepTo(4);
    lockIn("Edge 4 (45 ns)");
    expect(screen.getByRole("group", { name: /checker is active/ })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/actual !== e\.sum/);
  });

  it("the exp_q gate drops the queue's tokens from the anatomy until the second prediction", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 4 (45 ns)");
    stepTo(6);
    // Two transactions are in flight at edge 6 (15 waiting, 19 just sent); only their a+b tokens show, not the sums in exp_q.
    expect(screen.getByRole("group", { name: /Anatomy of tb_top at Edge 6 \(65 ns\).*; 2 tokens in flight/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^(15|19) on (push_back|pop_front)$/)).not.toBeInTheDocument();
    expect(screen.getByText(/expected sums travelling through exp_q open with the second prediction/)).toBeInTheDocument();
    lockIn("{15, 19}", 0);
    // 19 is on its way in; 15 waits in exp_q, on no wire, as the strip below shows.
    expect(screen.getByRole("group", { name: /Anatomy of tb_top at Edge 6 \(65 ns\).*; 3 tokens in flight/ })).toBeInTheDocument();
    expect(screen.getByLabelText("19 on push_back")).toBeInTheDocument();
    expect(screen.queryByLabelText("15 on pop_front")).not.toBeInTheDocument();
    // At the check, 15 leaves the queue and the sampled sum meets it.
    stepTo(7);
    expect(screen.getByLabelText("15 on pop_front")).toBeInTheDocument();
    expect(screen.getByLabelText("15 on out_valid, sum")).toBeInTheDocument();
  });

  it("a committed answer stays on the fold line when a run under the same key drops that option", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" ask="queue" />);
    lockIn("{19}", 0);
    expect(screen.getByLabelText("your answer, incorrect")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "DUT" })).getByRole("radio", { name: "extra stage" }));
    // Same question, same answer: the gate stays open. {19} is no longer an option for this DUT, and the learner still said it.
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("{19}")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fold this prediction to one line" }));
    expect(screen.getByRole("button", { name: /You said \{19\}; the answer is \{15, 19\}/ })).toBeInTheDocument();
  });

  it("comparing DUTs keeps the edge; a new test starts over", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    revealEdge();
    revealEdge();
    stepTo(7);
    expect(status()).toMatch(/Edge 7 \(75 ns\)/);
    const dut = () => within(screen.getByRole("radiogroup", { name: "DUT" }));
    fireEvent.click(dut().getByRole("radio", { name: "BUG=2" }));
    expect(status()).toMatch(/Edge 7 \(75 ns\)/);
    expect(status()).toMatch(/a mismatch/);
    fireEvent.click(dut().getByRole("radio", { name: "BUG=0" }));
    expect(status()).toMatch(/Edge 7 \(75 ns\)/);
    // The end of a run is no edge: comparing there stays at the end.
    stepTo(Number(scrubber().getAttribute("max")));
    fireEvent.click(dut().getByRole("radio", { name: "BUG=1" }));
    expect(status()).toMatch(/Run ends \(130 ns\)/);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "smoke" }));
    expect(status()).toMatch(/Edge 0 \(5 ns\)/);
  });

  it("the strip says its state is the one after this edge", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" ask="edge" />);
    lockIn("Edge 4 (45 ns)");
    stepTo(6);
    expect(screen.getByText(/oldest first · after this edge · 2 waiting/)).toBeInTheDocument();
    stepTo(Number(scrubber().getAttribute("max")));
    expect(screen.getByText(/oldest first · after this step · 0 waiting/)).toBeInTheDocument();
  });

  it("a popped chip keeps its text at full opacity: only the tag and operands are muted, once", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" ask="edge" />);
    lockIn("Edge 4 (45 ns)");
    stepTo(7);
    const chip = screen.getByRole("listitem", { name: /→ 15, popped and matched/ });
    expect(chip.className).not.toMatch(/opacity-/);
    expect(document.querySelector("style")?.textContent).not.toMatch(/opacity:\.8/);
  });

  it("an X result popped and counted is labelled as counted, with its own glyph, not as matched", () => {
    const run = runBench(clinicCase("neq").config);
    const step = run.steps.find((s): s is EdgeStep => s.kind === "edge" && s.checker.kind === "x-pass") as EdgeStep;
    render(<QueueStrip step={step} />);
    const chip = screen.getByRole("listitem", { name: /popped, counted as a pass/ });
    expect(chip).toHaveTextContent("pop_front ○");
    expect(chip).not.toHaveTextContent("✓");
    expect(screen.queryByRole("listitem", { name: /popped and matched/ })).not.toBeInTheDocument();
  });

  it("+TEST=hold shows a note that the kata's bench is running, and its code carries the kata's additions", () => {
    render(<SelfCheckBenchLab mode="step" preset="hold" />);
    expect(screen.getByRole("note")).toHaveTextContent(/\+TEST=hold runs the kata's bench: the hold check is on\./);
    expect(screen.getByText(/logic \[W:0\] last_sum;/)).toBeInTheDocument();
    expect(screen.getByText(/task automatic send_invalid/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "smoke" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("a new test re-arms the gates; the queue question waits for the edge answer again", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    lockIn("Edge 4 (45 ns)");
    lockIn("{}", 0);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "corners" }));
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(1);
    expect(screen.getByText(/send\(0, 0\) runs on edge 2/)).toBeInTheDocument();
    expect(screen.queryByText(/what does exp_q hold/)).not.toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: "sum" })).not.toBeInTheDocument();
  });

  it("a DUT that moves no result keeps both gates open; the extra stage changes the answers, so it re-arms them", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 4 (45 ns)");
    lockIn("{15, 19}", 0);
    const dut = within(screen.getByRole("radiogroup", { name: "DUT" }));
    fireEvent.click(dut.getByRole("radio", { name: "BUG=1" }));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "sum" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /exp_q after this step/ })).toBeInTheDocument();
    fireEvent.click(dut.getByRole("radio", { name: "BUG=2" }));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    // The open prompt's feedback follows the current run.
    expect(screen.getByText(/The expected value is 10 and the actual value is 11/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show advanced" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /kata hold check/ }));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "DUT" })).getByRole("radio", { name: "extra stage" }));
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(1);
    expect(screen.queryByRole("rowheader", { name: "sum" })).not.toBeInTheDocument();
  });

  it("the exp_q question stays out of the page until the edge question is answered, so its feedback cannot give that answer away", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(1);
    expect(screen.queryByText(/what does exp_q hold/)).not.toBeInTheDocument();
    revealEdge();
    expect(screen.getByText(/what does exp_q hold after edge 6\?/)).toBeInTheDocument();
    expect(screen.queryByText(/exp_q strip is now shown/)).not.toBeInTheDocument();
  });

  it("ask='edge' asks only the edge question; the strip opens with the outputs", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" ask="edge" />);
    expect(screen.queryByRole("list", { name: /exp_q after this step/ })).not.toBeInTheDocument();
    expect(status()).toMatch(/hidden until you predict/);
    lockIn("Edge 4 (45 ns)");
    expect(screen.queryByText(/what does exp_q hold/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /exp_q after this step/ })).toBeInTheDocument();
  });

  it("ask='queue' opens the outputs and asks only about exp_q, whose answer stays hidden until committed", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" ask="queue" />);
    expect(screen.queryByText(/On which edge does the checker see/)).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "sum" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /exp_q after this step/ })).not.toBeInTheDocument();
    stepTo(6);
    expect(status()).toMatch(/the queue is hidden until you predict/);
    expect(document.body.textContent).not.toMatch(/pushes 19/);
    lockIn("{15, 19}", 0);
    expect(screen.getByRole("list", { name: /exp_q after this step, oldest first: 15, 19/ })).toBeInTheDocument();
  });

  it("keyboard focus lands on the feedback when a prediction is locked in or skipped, not on the page", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 4 (45 ns)");
    const edgeFeedback = document.activeElement as HTMLElement;
    expect(edgeFeedback).not.toBe(document.body);
    expect(edgeFeedback).toHaveAttribute("aria-live", "polite");
    expect(edgeFeedback).toHaveAttribute("tabindex", "-1");
    expect(edgeFeedback.textContent).toMatch(/^Correct\./);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    const queueFeedback = document.activeElement as HTMLElement;
    expect(queueFeedback).not.toBe(edgeFeedback);
    expect(queueFeedback.textContent).toMatch(/Why the answer holds/);
  });

  it("an answered prediction folds to one line and unfolds to its feedback, with focus kept on both moves", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 3 (35 ns)");
    const question = screen.getByText(/On which edge does the checker see/);
    fireEvent.click(screen.getAllByRole("button", { name: "Fold this prediction to one line" })[0]);
    const unfold = screen.getByRole("button", { name: /You said Edge 3 \(35 ns\); the answer is Edge 4 \(45 ns\)/ });
    expect(document.activeElement).toBe(unfold);
    expect(unfold).toHaveAttribute("aria-expanded", "false");
    expect(question.closest("[hidden]")).not.toBeNull();
    // The gate stays open while folded.
    expect(screen.getByRole("rowheader", { name: "sum" })).toBeInTheDocument();
    fireEvent.click(unfold);
    expect(question.closest("[hidden]")).toBeNull();
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^Not quite\./);
  });

  it("the rule line names every test +TEST=all runs, including hold when the kata registers it", () => {
    render(<SelfCheckBenchLab mode="step" preset="all" />);
    expect(screen.getByText(/R3 for ordinary values, then corners and gaps\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show advanced" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /kata hold check/ }));
    expect(screen.getByText(/R3 for ordinary values, then corners, gaps and hold\./)).toBeInTheDocument();
  });

  it("the model's assumptions say same-time lines from different processes may print in either order", () => {
    render(<SelfCheckBenchLab mode="step" preset="all" />);
    expect(screen.getByText(/may appear in either order in a simulator \(§4\.7\)/)).toBeInTheDocument();
  });

  it("the x-carry DUT is the clinic's alone: the bug prop falls back to BUG=0 rather than showing a DUT with no option", () => {
    render(<SelfCheckBenchLab mode="step" preset="corners" bug="x-carry" />);
    expect(within(screen.getByRole("radiogroup", { name: "DUT" })).getByRole("radio", { name: "BUG=0" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("group", { name: /tb_top waveform, \+TEST=corners, BUG=0/ })).toBeInTheDocument();
  });

  it("during Play the narration is not a live region; the step playback stops at is announced once", () => {
    vi.useFakeTimers();
    try {
      render(<SelfCheckBenchLab mode="step" preset="gaps" focus="anatomy" />);
      const narration = screen.getAllByRole("status").find((el) => /Edge 0/.test(el.textContent ?? "")) as HTMLElement;
      expect(narration).toHaveAttribute("aria-live", "polite");
      const live = () => screen.getAllByRole("status").find((el) => el.className.includes("sr-only")) as HTMLElement;
      expect(live()).toBeEmptyDOMElement();
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      expect(narration).toHaveAttribute("aria-live", "off");
      act(() => {
        vi.advanceTimersByTime(1400);
      });
      expect(narration.textContent).toMatch(/Edge 1 \(15 ns\)/);
      expect(live()).toBeEmptyDOMElement();
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(narration).toHaveAttribute("aria-live", "polite");
      expect(live().textContent).toMatch(/^Stopped at Edge 1 \(15 ns\)\. /);
      // Stepping by hand speaks through the narration again, so the pause line goes.
      fireEvent.click(screen.getByRole("button", { name: /next step/i }));
      expect(live()).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it("at phone width one pane shows, chosen beside the transport; from md up the chooser is hidden and every pane shows", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    revealEdge();
    const chooser = screen.getByRole("radiogroup", { name: "Pane shown on a phone" });
    expect(chooser.className).toMatch(/md:hidden/);
    const paneOf = (el: Element, cls = "max-md:hidden") => el.closest(`[class*="${cls}"]`);
    const code = screen.getByRole("list", { name: /tb_top \(generated/ });
    const wave = screen.getByRole("group", { name: /tb_top waveform/ });
    expect(paneOf(wave)).toBeNull();
    expect(paneOf(code)).not.toBeNull();
    fireEvent.click(within(chooser).getByRole("radio", { name: "Code" }));
    expect(paneOf(code)).toBeNull();
    expect(paneOf(wave)).not.toBeNull();
    // Keeps its place in the page: the chooser comes right after the narration, before any pane.
    expect(chooser.compareDocumentPosition(wave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a code pane opened on a phone scrolls to the active line then, because a hidden pane has no size to scroll", () => {
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    let shown = false;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (!shown) return rect(0, 0);
      return this.getAttribute("aria-current") === "step" ? rect(500, 24) : rect(0, 100);
    });
    stubLayout("clientHeight", 100);
    render(<SelfCheckBenchLab mode="step" preset="gaps" focus="anatomy" />);
    stepTo(2);
    const panel = screen.getByRole("region", { name: /^Scrollable code: tb_top/ });
    expect(panel.scrollTop).toBe(0);
    shown = true;
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Pane shown on a phone" })).getByRole("radio", { name: "Code" }));
    expect(panel.scrollTop).toBe(500 - (100 - 24) / 2);
  });

  it("queue chips animate on push and pop only under motion-safe, with keyframes on the page", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    lockIn("Edge 4 (45 ns)");
    lockIn("{15, 19}", 0);
    expect(document.querySelector("style")?.textContent).toMatch(/@keyframes selfcheck-push.*@keyframes selfcheck-pop/);
    stepTo(6);
    const strip = screen.getByRole("list", { name: /exp_q after this step, oldest first: 15, 19/ });
    const chip = (name: RegExp) => within(strip).getByRole("listitem", { name });
    expect(chip(/19, just pushed|→ 19, just pushed/).className).toMatch(/motion-safe:animate-\[selfcheck-push/);
    expect(chip(/→ 15$/).className).not.toMatch(/animate-/);
    stepTo(7);
    const after = screen.getByRole("list", { name: /exp_q after this step, oldest first: 19/ });
    expect(within(after).getByRole("listitem", { name: /→ 15, popped and matched/ }).className).toMatch(/motion-safe:animate-\[selfcheck-pop/);
  });

  it("bug prop selects the mutant: corners against BUG=1 logs the three carry failures and ends PASS=4 FAIL=3", () => {
    render(<SelfCheckBenchLab mode="step" preset="corners" bug={1} />);
    expect(within(screen.getByRole("radiogroup", { name: "DUT" })).getByRole("radio", { name: "BUG=1" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[0]);
    stepTo(Number(scrubber().getAttribute("max")));
    const log = screen.getByRole("list", { name: "Simulation log" });
    expect(within(log).getByText("[error @ 75 ns] CHK a=255 b=1: sum=0, expected 256")).toBeInTheDocument();
    expect(within(log).getByText("PASS=4 FAIL=3")).toBeInTheDocument();
    expect(status()).toMatch(/\$finish ended the run/);
  });

  it("BUG=2: the prediction's feedback states the value on the wire and the expected value separately", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" bug={2} />);
    expect(screen.getByText(/On which edge does the checker see the result of send\(5, 5\)/)).toBeInTheDocument();
    lockIn("Edge 3 (35 ns)");
    expect(screen.getByText(/schedules out_valid <= 1 and sum <= 11 with <= \(the expected value is 10/)).toBeInTheDocument();
    expect(screen.getByText(/the checker reads out_valid = 1 and sum = 11 as they were .*pops 10 from exp_q\. The expected value is 10 and the actual value is 11: a mismatch/)).toBeInTheDocument();
  });

  it("the narration leaks nothing about exp_q until the queue prediction opens, not even in the waveform's marker titles", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    stepTo(6);
    // Both gates closed.
    expect(status()).toMatch(/send\(9, 10\) drives in_valid, a and b with <=; the queue is hidden until you predict/);
    expect(document.body.textContent).not.toMatch(/pushes 19/);
    lockIn("Edge 4 (45 ns)");
    // Only the queue gate closed.
    expect(status()).toMatch(/the queue is hidden until you predict/);
    expect(document.body.textContent).not.toMatch(/pushes \d/);
    stepTo(7);
    expect(status()).toMatch(/pops the oldest expectation/);
    expect(document.body.textContent).not.toMatch(/pops 15/);
    lockIn("{15, 19}", 0);
    expect(status()).toMatch(/pops 15 from exp_q/);
    stepTo(6);
    expect(status()).toMatch(/pushes 19 onto exp_q/);
  });

  it("no render shows a new run through a gate opened for the old one, and returning to the old run keeps the gate closed", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    lockIn("Edge 4 (45 ns)");
    expect(screen.getByRole("rowheader", { name: "sum" })).toBeInTheDocument();
    waveRenders.length = 0;
    const tests = within(screen.getByRole("radiogroup", { name: "Test" }));
    fireEvent.click(tests.getByRole("radio", { name: "corners" }));
    const corners = waveRenders.filter((r) => /\+TEST=corners/.test(r.title));
    expect(corners.length).toBeGreaterThan(0);
    corners.forEach((r) => expect(r.signals).not.toContain("sum"));
    fireEvent.click(tests.getByRole("radio", { name: "smoke" }));
    expect(screen.queryByRole("rowheader", { name: "sum" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(1);
  });

  it("the waveform's own box follows the cursor, and the page does not scroll", () => {
    stubLayout("clientWidth", 300);
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    render(<SelfCheckBenchLab mode="step" preset="corners" />);
    const box = screen.getByRole("group", { name: /tb_top waveform/ }).parentElement as HTMLElement;
    expect(box.className).toMatch(/overflow-x-auto/);
    stepTo(2);
    expect(box.scrollLeft).toBe(0); // edge 2 is at 176 px: already in view
    stepTo(7);
    expect(box.scrollLeft).toBe(76 + 40 * 7 + 20 - 150);
    stepTo(1);
    expect(box.scrollLeft).toBe(0);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a matrix cell's waveform opens with its first failing edge in view", () => {
    stubLayout("clientWidth", 300);
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    fireEvent.click(screen.getByRole("button", { name: /\+TEST=corners against BUG=1, carry stuck at 0: caught/ }));
    const box = screen.getByRole("group", { name: /tb_top waveform/ }).parentElement as HTMLElement;
    expect(box.scrollLeft).toBe(76 + 40 * 7 + 20 - 150);
  });

  it("the code panel is a named, focusable scroller in step mode and scrolls itself to the active line", () => {
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("aria-current") === "step" ? rect(500, 24) : rect(0, 100);
    });
    stubLayout("clientHeight", 100);
    render(<SelfCheckBenchLab mode="step" preset="gaps" focus="anatomy" />);
    const panel = screen.getByRole("region", { name: /^Scrollable code: tb_top/ });
    expect(panel).toHaveAttribute("tabindex", "0");
    panel.scrollTop = 0;
    stepTo(2);
    expect(panel.scrollTop).toBe(500 - 0 - (100 - 24) / 2);
  });

  it("the log follows its newest line inside its own panel and takes keyboard focus", () => {
    stubLayout("scrollHeight", 900);
    render(<SelfCheckBenchLab mode="step" preset="corners" bug={1} />);
    revealEdge();
    const log = screen.getByRole("region", { name: "Scrollable log: Simulation log" });
    expect(log).toHaveAttribute("tabindex", "0");
    log.scrollTop = 0;
    stepTo(Number(scrubber().getAttribute("max")));
    expect(log.scrollTop).toBe(900);
    expect(within(log).getByRole("list", { name: "Simulation log" })).toBeInTheDocument();
  });

  it("the anatomy diagram keeps its readable width (never below 0.9 scale) and takes a full row at phone width", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    const svg = screen.getByRole("group", { name: /^Anatomy of tb_top/ }) as unknown as SVGElement;
    expect(svg.style.minWidth).toBe("420px");
    const grid = svg.closest('[class*="grid-cols"]') as HTMLElement;
    expect(grid.className).toMatch(/minmax\(min\(100%,420px\),1fr\)/);
  });

  it("the scrubber names steps, not edges: step index and edge number differ", () => {
    render(<SelfCheckBenchLab mode="step" preset="gaps" />);
    stepTo(2);
    expect(scrubber()).toHaveAttribute("aria-valuetext", expect.stringMatching(/^Step 3 of \d+: Edge 2 \(25 ns\)$/));
    stepTo(Number(scrubber().getAttribute("max")));
    expect(scrubber()).toHaveAttribute("aria-valuetext", expect.stringMatching(/: Run ends \(130 ns\)$/));
  });

  it("a hold check left on behind the collapsed panel is called out", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    const toggle = screen.getByRole("button", { name: "Show advanced" });
    expect(toggle.className).toMatch(/min-h-10/);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("checkbox", { name: /kata hold check/ }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide advanced" }));
    expect(screen.getByRole("note")).toHaveTextContent(/hold check is still on/);
  });

  it("with no preset the lab opens on the lesson's +TEST=gaps, and the anatomy view on smoke", () => {
    const { unmount } = render(<SelfCheckBenchLab />);
    expect(screen.getByText(/send\(5, 5\) runs on edge 2/)).toBeInTheDocument();
    unmount();
    render(<SelfCheckBenchLab focus="anatomy" />);
    expect(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "smoke" })).toHaveAttribute("aria-checked", "true");
  });

  it("anatomy: the DUT lights on the edge it samples, with the bench lit beside it, and the code highlights the flop", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" focus="anatomy" />);
    stepTo(3);
    const group = screen.getByRole("group", { name: /Anatomy of tb_top at Edge 3 \(35 ns\): dut is active, along with send\(\) \/ idle\(\)/ });
    expect(within(group).getByRole("button", { name: /dut, adder_reg, active/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /send\(\) \/ idle\(\), drive with <=, active/ })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/if \(in_valid\) sum <= next_sum/);
    expect(screen.getByText(/The lit blocks are the parts of tb_top acting at this step/)).toBeInTheDocument();
  });

  it("the gate still hides the DUT: before predicting, the sampling edge lights the bench alone", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    stepTo(3);
    const group = screen.getByRole("group", { name: /^Anatomy of tb_top at Edge 3 \(35 ns\): send\(\) \/ idle\(\) is active$/ });
    expect(within(group).queryByRole("button", { name: /dut, adder_reg, active/ })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/in_valid <= 1'b1; a <= a_val; b <= b_val;/);
  });

  it("selecting a block on a phone opens the code pane and moves focus into it, because the block is now hidden", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" focus="anatomy" />);
    const code = screen.getByRole("region", { name: /^Scrollable code: tb_top/ });
    const paneOf = (el: Element) => el.closest('[class*="max-md:hidden"]');
    expect(paneOf(code)).not.toBeNull();
    const anatomy = screen.getByRole("group", { name: /^Anatomy of tb_top/ });
    expect(paneOf(anatomy)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^REF model_add\(\)/ }));
    expect(paneOf(code)).toBeNull();
    expect(paneOf(anatomy)).not.toBeNull();
    expect(within(screen.getByRole("radiogroup", { name: "Pane shown on a phone" })).getByRole("radio", { name: "Code" })).toHaveAttribute("aria-checked", "true");
    // jsdom lays nothing out, so offsetParent is null, as for a pane hidden by CSS.
    expect(document.activeElement).toBe(code);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/function automatic logic \[W:0\] model_add/);
  });

  it("from md up the block stays on screen, so it keeps focus and the code is brought into view instead", () => {
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    revealEdge();
    const before = document.activeElement;
    fireEvent.click(screen.getByRole("button", { name: /^REF model_add\(\)/ }));
    expect(document.activeElement).toBe(before);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("anatomy focus: the active block follows the step and selecting a block jumps to its code line", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" focus="anatomy" />);
    expect(screen.getByRole("region", { name: "Anatomy of the self-checking testbench, step by step" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    stepTo(2);
    expect(screen.getByRole("group", { name: /Anatomy of tb_top at Edge 2 \(25 ns\): send\(\) \/ idle\(\) is active; 2 tokens in flight/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^REF model_add\(\)/ }));
    expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/function automatic logic \[W:0\] model_add/);
    stepTo(4);
    expect(screen.getByRole("group", { name: /checker is active/ })).toBeInTheDocument();
  });
});

describe("SelfCheckBenchLab matrix mode", () => {
  const cell = (name: RegExp) => screen.getByRole("button", { name });

  it("collects predictions per cell, then reveals the model's summary lines and grades them", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    expect(screen.queryByText("PASS=3 FAIL=0")).not.toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=smoke against BUG=1, carry stuck at 0: no prediction yet/));
    expect(cell(/\+TEST=smoke against BUG=1, carry stuck at 0: predicted will catch/)).toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=corners against BUG=1, carry stuck at 0: no prediction yet/));
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(cell(/\+TEST=smoke against BUG=1, carry stuck at 0: survived, PASS=3 FAIL=0, you said will catch, prediction wrong/)).toBeInTheDocument();
    expect(cell(/\+TEST=corners against BUG=1, carry stuck at 0: caught, PASS=4 FAIL=3, you said will catch, prediction right/)).toBeInTheDocument();
    expect(cell(/\+TEST=gaps against BUG=2, off by one: caught, PASS=0 FAIL=4/)).toBeInTheDocument();
    expect(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: survived, PASS=1 FAIL=0/)).toBeInTheDocument();
    expect(screen.getByText(/No test can kill an equivalent mutant/)).toBeInTheDocument();
  });

  it("selecting a survived cell explains the escape; a caught cell opens the stepper at the first failing edge", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    fireEvent.click(cell(/\+TEST=smoke against BUG=1, carry stuck at 0: survived/));
    expect(screen.getByText(/No smoke result reaches 256 \(the largest is 127\)/)).toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=corners against BUG=1, carry stuck at 0: caught/));
    expect(screen.getByText(/First failing edge: 7 \(75 ns\)/)).toBeInTheDocument();
    expect(status()).toMatch(/Edge 7 \(75 ns\)/);
    expect(status()).toMatch(/sum = 0, pops 256 from exp_q: a mismatch/);
    fireEvent.click(cell(/\+TEST=gaps against an extra pipeline stage: survived/));
    expect(screen.getByText(/values in order, not timing/)).toBeInTheDocument();
  });

  it("the hold row without the toggle runs the kata's stimulus against the original checker: its caught cell opens a stepper whose tb_top has test_hold", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(screen.getByText(/The hold row is the kata's stimulus against the original checker/)).toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=hold against BUG=2, off by one: caught, PASS=0 FAIL=1/));
    expect(status()).toMatch(/Edge 4 \(45 ns\)/);
    expect(status()).toMatch(/send_invalid\(70, 80\) drives new a and b with in_valid <= 0/);
    const code = screen.getByRole("list", { name: /tb_top \(generated from the model's data\)/ });
    expect(within(code).getByText(/task automatic test_hold\(\);/)).toBeInTheDocument();
    expect(within(code).getByText(/send_invalid\(8'd50, 8'd60\);/)).toBeInTheDocument();
    expect(within(code).getByText(/"hold": test_hold\(\);/)).toBeInTheDocument();
    expect(within(code).queryByText(/last_sum/)).not.toBeInTheDocument();
  });

  it("focus never drops: Reveal hands it to the hold-check question, and selecting a cell moves it to the detail panel, which describes the escape", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    const live = screen.getAllByText((_, el) => el?.getAttribute("aria-live") === "polite" && el.textContent === "");
    expect(live.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "No row" }));
    expect(live.some((el) => /no test catches it/.test(el.textContent ?? ""))).toBe(true);

    fireEvent.click(cell(/\+TEST=smoke against BUG=1, carry stuck at 0: survived/));
    const heading = document.activeElement as HTMLElement;
    expect(heading.textContent).toMatch(/\+TEST=smoke against BUG=1, carry stuck at 0/);
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(document.getElementById(heading.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(/Why it escaped: No smoke result reaches 256/);

    fireEvent.click(cell(/\+TEST=corners against BUG=1, carry stuck at 0: caught/));
    expect((document.activeElement as HTMLElement).textContent).toMatch(/\+TEST=corners against BUG=1/);
    expect(document.activeElement).not.toHaveAttribute("aria-describedby");
  });

  it("the summary says the hold row is not part of the Make It Work bench", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    expect(screen.getByText(/one run of the Make It Work bench by the model \(the hold row adds the kata's test\)/)).toBeInTheDocument();
  });

  it("scope='plan' keeps to what the test-plan section has taught: three tests, BUG=1 and BUG=2, no hold, and focus still lands somewhere", () => {
    render(<SelfCheckBenchLab mode="matrix" scope="plan" />);
    expect(screen.queryByText(/\+TEST=hold/)).not.toBeInTheDocument();
    expect(screen.queryByText(/BUG=3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a\/b swapped/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hold row/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/kata/)).not.toBeInTheDocument();
    const note = document.activeElement as HTMLElement;
    expect(note).toHaveAttribute("tabindex", "-1");
    expect(note.textContent).toMatch(/BUG=1, carry stuck at 0: caught by \+TEST=corners, and no other test\./);
    expect(note.textContent).toMatch(/BUG=2, off by one: every test catches it\./);
    expect(cell(/\+TEST=corners against BUG=1, carry stuck at 0: caught, PASS=4 FAIL=3/)).toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=gaps against BUG=1, carry stuck at 0: survived/));
    expect(screen.getByText(/No gaps result reaches 256/)).toBeInTheDocument();
    fireEvent.click(cell(/\+TEST=smoke against BUG=2, off by one: caught/));
    expect(status()).toMatch(/Edge 4 \(45 ns\)/);
  });

  it("the hold-check toggle waits behind a prediction, and committing one moves focus to its feedback", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(screen.getByText("With the hold check on, which rows catch BUG=3?")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    lockIn("Every row");
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^Not quite\. The check is in every test's bench, but smoke, corners and gaps never change a or b on an idle cycle/);
    expect(screen.getByRole("checkbox", { name: /Add the kata's hold check/ })).toBeInTheDocument();
    // Folding the question keeps the toggle in reach.
    fireEvent.click(screen.getByRole("button", { name: "Fold this prediction to one line" }));
    expect(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }).closest("[hidden]")).toBeNull();
  });

  it("with the hold check on, the status grades the learner's own predictions, never 'Revealed without predictions'", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(cell(/\+TEST=corners against BUG=1, carry stuck at 0: no prediction yet/));
    fireEvent.click(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: no prediction yet/));
    fireEvent.click(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: predicted will catch/));
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    // Said "will miss" for hold x BUG=3 with the original checker, and that was right.
    expect(screen.getByText(/You predicted 2 of 2 cells right\. 18 had no prediction\./)).toBeInTheDocument();
    lockIn("+TEST=hold only");
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(screen.queryByText(/Revealed without predictions/)).not.toBeInTheDocument();
    // corners x BUG=1 carries over; the four BUG=3 cells are the answer above.
    expect(screen.getByText(/You predicted 5 of 5 cells right\. 15 had no prediction\./)).toBeInTheDocument();
    expect(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: caught, PASS=1 FAIL=3, you said will catch, prediction right/)).toBeInTheDocument();
    expect(cell(/\+TEST=gaps against BUG=3, sum moves on idle cycles: survived, PASS=4 FAIL=0, you said will miss, prediction right/)).toBeInTheDocument();
    expect(screen.getByText(/Your predictions carry over, because no other cell changes with the check/)).toBeInTheDocument();
    // Off again: the first predictions are back.
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(screen.getByText(/You predicted 2 of 2 cells right\./)).toBeInTheDocument();
  });

  it("a wrong answer to the hold-check question is graded as wrong on the cells it covers", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    lockIn("Every row");
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(screen.getByText(/You predicted 1 of 4 cells right\. 16 had no prediction\./)).toBeInTheDocument();
  });

  it("skipping the hold-check question leaves the cell that flips ungraded and keeps the rest", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: no prediction yet/));
    fireEvent.click(cell(/\+TEST=gaps against BUG=3, sum moves on idle cycles: no prediction yet/));
    fireEvent.click(cell(/\+TEST=gaps against BUG=3, sum moves on idle cycles: predicted will catch/));
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(screen.getByText(/You predicted 1 of 1 cell right\. 19 had no prediction\./)).toBeInTheDocument();
    expect(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: caught, PASS=1 FAIL=3$/)).toBeInTheDocument();
  });

  it("the hold-check toggle shows BUG=3 needs both test_hold and the check", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(screen.getByText(/no test catches it, however the stimulus looks/)).toBeInTheDocument();
    lockIn("+TEST=hold only");
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: caught, PASS=1 FAIL=3/)).toBeInTheDocument();
    expect(cell(/\+TEST=gaps against BUG=3, sum moves on idle cycles: survived, PASS=4 FAIL=0/)).toBeInTheDocument();
    expect(screen.getByText(/with the hold check, \+TEST=hold catches it/)).toBeInTheDocument();
  });
});

describe("SelfCheckBenchLab debug mode", () => {
  const pickCase = (n: number) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Case" })).getByRole("radio", { name: new RegExp(`^Case ${n}:`) }));
  const suspect = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
  const rerun = (name: RegExp) => {
    fireEvent.click(screen.getByRole("radio", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Rerun with this fix" }));
  };

  it("case 1: the log and raw counters show a vacuous pass; a wrong suspect is diagnosed, hints fade in, the culprit unlocks the fixes", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    const log = screen.getByRole("list", { name: "Simulation log" });
    expect(within(log).getByText(/CHK 14 result\(s\) never arrived/)).toBeInTheDocument();
    expect(within(log).getByText("PASS=0 FAIL=14")).toBeInTheDocument();
    expect(screen.getByText("PASS=0 FAIL=0")).toBeInTheDocument();
    expect(screen.queryByText(/reset_dut\(\) deleted/)).not.toBeInTheDocument();

    suspect(/Suspect line: if \(rst_n\) begin/);
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    expect(screen.getByText(/the guard is correct\. Ask why rst_n is x/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Need a hint\? \(0\/3\)/ }));
    expect(screen.getByText(/What condition sits around every compare\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Another hint \(1\/3\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint \(2\/3\)/ }));
    expect(screen.getByText(/Who drives rst_n in this bench/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Another hint/ })).not.toBeInTheDocument();

    expect(screen.queryByText(/Step 2 — choose a fix/)).not.toBeInTheDocument();
    suspect(/Suspect line: if \(test_name == "all"\)/);
    expect(screen.getByText(/nothing drives rst_n before this line, so it stays at its initial x/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 — choose a fix/)).toBeInTheDocument();
  });

  it("every case opens on tb_top with its suspect controls in view: the DUT's source is behind a disclosure", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    [1, 2, 3, 4, 5, 6, 7].forEach((n) => {
      pickCase(n);
      const bench = screen.getByRole("list", { name: /^The broken bench/ });
      const rows = within(bench).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("module tb_top;");
      expect(within(bench).queryByText(/module adder_reg/)).not.toBeInTheDocument();
      // The first control sits within the first few rows of the 480 px scroller.
      expect(rows.slice(0, 8).some((r) => within(r).queryByRole("button", { name: /^Suspect line:/ }))).toBe(true);
      const dut = screen.getByText("Source of the DUT, adder_reg").closest("details") as HTMLDetailsElement;
      expect(dut.open).toBe(false);
      expect(within(dut).getByText(/module adder_reg/)).toBeInTheDocument();
    });
  });

  it("a new case opens at the top of its own scroller, wherever the last one was left", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    const scroller = () => screen.getByRole("list", { name: /^The broken bench/ }).closest('[class*="max-h-"]') as HTMLElement;
    scroller().scrollTop = 300;
    pickCase(2);
    expect(scroller().scrollTop).toBe(0);
  });

  it("Step 1 is worded for a deleted statement too, in every case", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    expect(screen.getByText(/Step 1 — select the tb_top line that causes the symptom, or the line where something is missing/)).toBeInTheDocument();
    pickCase(4);
    expect(screen.getByText(/or the line where something is missing/)).toBeInTheDocument();
  });

  it("case 6: the last send() of test_smoke is accepted as the line where something is missing, and every stimulus line has a control", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(6);
    expect(screen.getAllByRole("button", { name: "Suspect line: send(8'd1, 8'd2);" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Suspect line: send(8'd10, 8'd20);" })).toBeInTheDocument();
    suspect(/Suspect line: send\(8'd10, 8'd20\);/);
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    suspect(/Suspect line: send\(8'd100, 8'd27\);/);
    expect(screen.getByText(/test_smoke\(\) ends on its last send\(\)/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 — choose a fix/)).toBeInTheDocument();
  });

  it("suspect feedback is scrolled into view without moving past it", () => {
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    render(<SelfCheckBenchLab mode="debug" />);
    expect(scrollSpy).not.toHaveBeenCalled();
    suspect(/Suspect line: if \(rst_n\) begin/);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollSpy.mock.contexts[0] as HTMLElement).toHaveTextContent(/Not this one\./);
  });

  it("case 7's log gives the cause and not the remedy before a suspect is picked", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(7);
    const log = screen.getByRole("list", { name: "Simulation log" });
    expect(within(log).getByText(/the free-running clock keeps the simulation busy \(§9\.6\.1\)/)).toBeInTheDocument();
    expect(log.textContent).not.toMatch(/\$finish/);
  });

  it("case 5's code does not promise rising edges next to logic clk;", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(5);
    expect(screen.getByRole("button", { name: "Suspect line: always #5 clk = ~clk;" })).toBeInTheDocument();
    expect(screen.queryByText(/rising edges at 5, 15, 25 ns/)).not.toBeInTheDocument();
  });

  it("case 1: the model reruns each fix: initialising rst_n high is rejected with its log, restoring reset_dut() is accepted", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    rerun(/Initialise the variable/);
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getAllByText(/CHK out_valid is x after reset/).length).toBeGreaterThan(0);
    rerun(/Restore reset_dut\(\)/);
    expect(screen.getByText(/Fix accepted/)).toBeInTheDocument();
    expect(screen.getByText(/correct DUT, no plusargs \(all tests\): PASS=14 FAIL=0/)).toBeInTheDocument();
    expect(screen.getByText(/BUG=1 on \+TEST=corners: PASS=4 FAIL=3 — still caught/)).toBeInTheDocument();
  });

  it("case 2: an X that passes through != is only fixed by a compare that fails on x", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(2);
    expect(within(screen.getByRole("list", { name: "Simulation log" })).getByText("PASS=7 FAIL=0")).toBeInTheDocument();
    suspect(/Suspect line: if \(actual != e\.sum\)/);
    expect(screen.getByText(/pass_cnt\+\+\. Every X result was counted as a pass/)).toBeInTheDocument();
    rerun(/Copy sum into an int first/);
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getByText(/4 X result\(s\) still pass/)).toBeInTheDocument();
    rerun(/Compare with !== instead of !=/);
    expect(screen.getByText(/Fix accepted/)).toBeInTheDocument();
    expect(screen.getByText(/every X result fails/)).toBeInTheDocument();
  });

  it("the code carries no label for the culprit: the deleted statements' lines read as ordinary code", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    expect(screen.queryByRole("button", { name: /Suspect line: \/\/ \(no/ })).not.toBeInTheDocument();
    pickCase(5);
    expect(screen.getByRole("button", { name: "Suspect line: logic clk;" })).toBeInTheDocument();
    pickCase(2);
    expect(screen.getByRole("button", { name: "Suspect line: if (actual != e.sum) begin" })).toBeInTheDocument();
    pickCase(7);
    expect(screen.queryByRole("button", { name: /Suspect line: \/\/ \(no/ })).not.toBeInTheDocument();
  });

  it("the dead clock's explanation stays out of the waveform panel until the culprit is found", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(5);
    expect(screen.getByRole("img", { name: /clk stays x/ })).not.toHaveTextContent(/starts at x/);
    suspect(/Suspect line: logic clk;/);
    expect(screen.getByRole("img", { name: /clk stays x/ })).toHaveTextContent(/starts at x/);
  });

  it("the regression line tells a hung run from a caught one, and a caught run that never ends from one that does", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(5);
    suspect(/Suspect line: logic clk;/);
    rerun(/Raise TIMEOUT to 100us/);
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=0 FAIL=1 — run hung, BUG=1 never exercised/)).toBeInTheDocument();
    rerun(/Toggle with logical not/);
    expect(screen.getByText(/run hung, BUG=1 never exercised/)).toBeInTheDocument();
    expect(screen.queryByText(/still caught/)).not.toBeInTheDocument();

    pickCase(7);
    suspect(/Suspect line: report\(\);/);
    rerun(/Add \$stop; after report\(\)/);
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=4 FAIL=3 — caught, but \$stop leaves the run suspended/)).toBeInTheDocument();
    rerun(/Rely on the watchdog/);
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=4 FAIL=3 — caught, but the run never ends/)).toBeInTheDocument();
    expect(screen.queryByText(/escapes/)).not.toBeInTheDocument();

    pickCase(3);
    suspect(/Suspect line: if \(sum !== model_add/);
    rerun(/Compare with model_add\(a, b\)/);
    expect(screen.getByText(/✕ BUG=1 on \+TEST=corners: PASS=2 FAIL=5 — not caught: the correct DUT fails just as often/)).toBeInTheDocument();
  });

  it("the clean-run line names plusargs only: gradeFix runs it on the correct DUT, not the case's x-carry one", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(2);
    suspect(/Suspect line: if \(actual != e\.sum\)/);
    rerun(/Compare with !== instead of !=/);
    expect(screen.getByText(/✓ correct DUT, \+TEST=corners: PASS=7 FAIL=0/)).toBeInTheDocument();
    expect(screen.queryByText(/correct DUT, .*against a DUT/)).not.toBeInTheDocument();
  });

  it("choosing a fix only selects it: arrowing through the options grades nothing and solves nothing until the rerun", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    const button = screen.getByRole("button", { name: "Rerun with this fix" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Restore reset_dut\(\)/ }));
    expect(screen.queryByText(/Fix accepted/)).not.toBeInTheDocument();
    expect(screen.getByText("0 of 7 solved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Initialise the variable/ }));
    fireEvent.click(button);
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    // Choosing another fix withdraws the grade of the last one.
    fireEvent.click(screen.getByRole("radio", { name: /Restore reset_dut\(\)/ }));
    expect(screen.queryByText(/Fix rejected by the model/)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByText(/Fix accepted/)).toBeInTheDocument();
    expect(screen.getByText("1 of 7 solved")).toBeInTheDocument();
  });

  it("the next-case button meets AA contrast: white on emerald-700, not emerald-600", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    rerun(/Restore reset_dut\(\)/);
    expect(screen.getByRole("button", { name: "Next case" }).className).toMatch(/bg-emerald-700/);
  });

  it("the clinic's waveform has edge selectors, which give the keyboard a way in, and each reads out what that edge sampled", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(2);
    const edge = screen.getByRole("button", { name: "Select edge 7" });
    expect(edge).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(edge, { key: "Enter" });
    expect(edge).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/^Edge 7 \(75 ns\): rst_n=1 in_valid=1 a=255 b=255 out_valid=1 sum=X$/, { selector: "p" })).toBeInTheDocument();
    pickCase(3);
    expect(screen.queryByText(/^Edge 7 \(75 ns\): rst_n=/, { selector: "p" })).not.toBeInTheDocument();
  });

  it("the grade arrives in a live region that was already mounted", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    const region = screen.getByRole("group", { name: /Step 2/ }).querySelector('[aria-live="polite"]') as HTMLElement;
    expect(region).toBeEmptyDOMElement();
    rerun(/Restore reset_dut\(\)/);
    expect(region).toHaveTextContent(/Fix accepted/);
    expect(region.isConnected).toBe(true);
  });

  it("an accepted fix marks the case solved and offers the next unsolved case; focus moves to its heading", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    expect(screen.getByText("0 of 7 solved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next case" })).not.toBeInTheDocument();
    suspect(/Suspect line: if \(test_name == "all"\)/);
    rerun(/Initialise the variable/);
    expect(screen.queryByRole("button", { name: "Next case" })).not.toBeInTheDocument();
    expect(screen.getByText("0 of 7 solved")).toBeInTheDocument();
    rerun(/Restore reset_dut\(\)/);
    expect(screen.getByText("1 of 7 solved")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Case 1: .*\(solved\)$/ })).toHaveTextContent("Case 1 ✓");
    fireEvent.click(screen.getByRole("button", { name: "Next case" }));
    expect(screen.getByRole("radio", { name: /^Case 2:/ })).toHaveAttribute("aria-checked", "true");
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^Case 2: /);
    expect(screen.getByRole("radio", { name: /^Case 1: .*\(solved\)$/ })).toBeInTheDocument();
  });

  it("the suspect controls meet the 40 px touch target at phone width", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    expect(screen.getByRole("button", { name: /Suspect line: if \(test_name == "all"\)/ }).className).toMatch(/(^|\s)min-h-10(\s|$)/);
  });

  it("case 7: no $finish shows a run that never ends; $stop is rejected, $finish accepted; switching cases resets the clinic", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(7);
    expect(screen.getByText(/never \(still running at the horizon\)/)).toBeInTheDocument();
    suspect(/Suspect line: report\(\);/);
    rerun(/Add \$stop; after report\(\)/);
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getByText(/suspended by \$stop/)).toBeInTheDocument();
    rerun(/Add \$finish; after report\(\)/);
    expect(screen.getByText(/Fix accepted/)).toBeInTheDocument();
    pickCase(5);
    expect(screen.queryByText(/Step 2 — choose a fix/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /clk stays x/ })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Simulation log" })).getByText(/WDOG test 'all' still running at 10000 ns/)).toBeInTheDocument();
    // The counters report() found include the watchdog's own fail_cnt++.
    expect(screen.getByText(/Counters when report\(\) ran, before its guards/)).toBeInTheDocument();
    expect(screen.getByText("PASS=0 FAIL=1", { selector: "span" })).toBeInTheDocument();
  });
});
