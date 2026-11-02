import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CycleSignal } from "@/components/visual-system/CycleWaveform";
import SelfCheckBenchLab from "@/components/visuals/SelfCheckBenchLab";

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
    expect(screen.getByRole("group", { name: /Anatomy of tb_top at Edge 6 \(65 ns\).*; 4 tokens in flight/ })).toBeInTheDocument();
    expect(screen.getByLabelText("19 on push_back")).toBeInTheDocument();
    expect(screen.getByLabelText("15 on pop_front")).toBeInTheDocument();
  });

  it("+TEST=hold shows a note that the kata's bench is running, and its code carries the kata's additions", () => {
    render(<SelfCheckBenchLab mode="step" preset="hold" />);
    expect(screen.getByRole("note")).toHaveTextContent(/\+TEST=hold runs the kata's bench: the hold check is on\./);
    expect(screen.getByText(/logic \[W:0\] last_sum;/)).toBeInTheDocument();
    expect(screen.getByText(/task automatic send_invalid/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "smoke" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("changing the test or the DUT re-arms both predictions and reruns the model", () => {
    render(<SelfCheckBenchLab mode="step" preset="smoke" />);
    lockIn("Edge 4 (45 ns)");
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(1);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Test" })).getByRole("radio", { name: "corners" }));
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(2);
    expect(screen.getByText(/send\(0, 0\) runs on edge 2/)).toBeInTheDocument();
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
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })).toHaveLength(2);
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

  it("focus never drops: Reveal hands it to the toggle, and selecting a cell moves it to the detail panel, which describes the escape", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    const live = screen.getAllByText((_, el) => el?.getAttribute("aria-live") === "polite" && el.textContent === "");
    expect(live.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
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

  it("the hold-check toggle shows BUG=3 needs both test_hold and the check", () => {
    render(<SelfCheckBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal the runs" }));
    expect(screen.getByText(/no test catches it, however the stimulus looks/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the kata's hold check/ }));
    expect(cell(/\+TEST=hold against BUG=3, sum moves on idle cycles: caught, PASS=1 FAIL=3/)).toBeInTheDocument();
    expect(cell(/\+TEST=gaps against BUG=3, sum moves on idle cycles: survived, PASS=4 FAIL=0/)).toBeInTheDocument();
    expect(screen.getByText(/with the hold check, \+TEST=hold catches it/)).toBeInTheDocument();
  });
});

describe("SelfCheckBenchLab debug mode", () => {
  const pickCase = (n: number) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Case" })).getByRole("radio", { name: new RegExp(`^Case ${n}:`) }));
  const suspect = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

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
    expect(screen.getByText(/nothing calls reset_dut\(\) before this line\. Without reset_dut\(\), rst_n is never driven/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 — choose a fix/)).toBeInTheDocument();
  });

  it("case 1: the model reruns each fix: initialising rst_n high is rejected with its log, restoring reset_dut() is accepted", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    fireEvent.click(screen.getByRole("radio", { name: /Initialise the variable/ }));
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getAllByText(/CHK out_valid is x after reset/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: /Restore reset_dut\(\)/ }));
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
    fireEvent.click(screen.getByRole("radio", { name: /Copy sum into an int first/ }));
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getByText(/4 X result\(s\) still pass/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Compare with !== instead of !=/ }));
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
    fireEvent.click(screen.getByRole("radio", { name: /Raise TIMEOUT to 100us/ }));
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=0 FAIL=1 — run hung, BUG=1 never exercised/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Toggle with logical not/ }));
    expect(screen.getByText(/run hung, BUG=1 never exercised/)).toBeInTheDocument();
    expect(screen.queryByText(/still caught/)).not.toBeInTheDocument();

    pickCase(7);
    suspect(/Suspect line: report\(\);/);
    fireEvent.click(screen.getByRole("radio", { name: /Add \$stop; after report\(\)/ }));
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=4 FAIL=3 — caught, but \$stop leaves the run suspended/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Rely on the watchdog/ }));
    expect(screen.getByText(/△ BUG=1 on \+TEST=corners: PASS=4 FAIL=3 — caught, but the run never ends/)).toBeInTheDocument();
    expect(screen.queryByText(/escapes/)).not.toBeInTheDocument();

    pickCase(3);
    suspect(/Suspect line: if \(sum !== model_add/);
    fireEvent.click(screen.getByRole("radio", { name: /Compare with model_add\(a, b\)/ }));
    expect(screen.getByText(/✕ BUG=1 on \+TEST=corners: PASS=2 FAIL=5 — not caught: the correct DUT fails just as often/)).toBeInTheDocument();
  });

  it("the clean-run line names plusargs only: gradeFix runs it on the correct DUT, not the case's x-carry one", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    pickCase(2);
    suspect(/Suspect line: if \(actual != e\.sum\)/);
    fireEvent.click(screen.getByRole("radio", { name: /Compare with !== instead of !=/ }));
    expect(screen.getByText(/✓ correct DUT, \+TEST=corners: PASS=7 FAIL=0/)).toBeInTheDocument();
    expect(screen.queryByText(/correct DUT, .*against a DUT/)).not.toBeInTheDocument();
  });

  it("the grade arrives in a live region that was already mounted", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    suspect(/Suspect line: if \(test_name == "all"\)/);
    const region = screen.getByRole("group", { name: /Step 2/ }).querySelector('[aria-live="polite"]') as HTMLElement;
    expect(region).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("radio", { name: /Restore reset_dut\(\)/ }));
    expect(region).toHaveTextContent(/Fix accepted/);
    expect(region.isConnected).toBe(true);
  });

  it("an accepted fix marks the case solved and offers the next unsolved case; focus moves to its heading", () => {
    render(<SelfCheckBenchLab mode="debug" />);
    expect(screen.getByText("0 of 7 solved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next case" })).not.toBeInTheDocument();
    suspect(/Suspect line: if \(test_name == "all"\)/);
    fireEvent.click(screen.getByRole("radio", { name: /Initialise the variable/ }));
    expect(screen.queryByRole("button", { name: "Next case" })).not.toBeInTheDocument();
    expect(screen.getByText("0 of 7 solved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Restore reset_dut\(\)/ }));
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
    fireEvent.click(screen.getByRole("radio", { name: /Add \$stop; after report\(\)/ }));
    expect(screen.getByText(/Fix rejected by the model/)).toBeInTheDocument();
    expect(screen.getByText(/suspended by \$stop/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Add \$finish; after report\(\)/ }));
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
