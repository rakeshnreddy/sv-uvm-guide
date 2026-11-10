import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import VerificationMethodsExplorer, { CUSTOM_TEST_NAME } from "@/components/curriculum/f1/VerificationMethodsExplorer";
import {
  BUCKET_LABELS,
  BUG_HUNT_STEPS,
  COVER_LD_EN,
  FORMAL_SLICE_NOTE,
  LESSON_RANDOM,
  LESSON_TESTS,
  UNKNOWN_COUNT_RULES,
  cellShares,
  coverWarning,
  directedVerdict,
  formalCheck,
  formatShare,
  maskedAtDZeroText,
  randomCellText,
  randomExplanation,
  runDirected,
  seededRunText,
  simulateRandom,
  stepsText,
} from "@/lib/verification-methods-model";

const radio = (group: string, name: string | RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const cell = (grid: string, key: string) => screen.getByTestId(grid).querySelector(`[data-cell="${key}"]`) as HTMLButtonElement;

describe("VerificationMethodsExplorer: shell", () => {
  it("names itself, declares a deterministic model, and starts on the Directed tab", () => {
    render(<VerificationMethodsExplorer />);
    expect(screen.getByRole("region", { name: "Verification methods explorer" })).toBeInTheDocument();
    expect(screen.getByText("Deterministic educational model")).toBeInTheDocument();
    expect(radio("Method", "Directed")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("directed-grid")).toBeVisible();
  });

  it("the d slice at 0 explains, from the model, why the bug is invisible there", () => {
    render(<VerificationMethodsExplorer />);
    fireEvent.click(radio("d slice", "d = 0"));
    expect(screen.getByText(maskedAtDZeroText())).toBeInTheDocument();
  });

  it("the grid is a table of buttons with arrow-key navigation and a visual status line that is not announced twice", () => {
    render(<VerificationMethodsExplorer />);
    const grid = screen.getByTestId("directed-grid");
    const start = cell("directed-grid", "loadInc:7");
    expect(start).toHaveAttribute("tabindex", "0");
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cell("directed-grid", "loadInc:6"));
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(cell("directed-grid", "load:6"));
    fireEvent.click(document.activeElement as Element);
    const status = screen.getByTestId("directed-grid-status");
    expect(status).toHaveTextContent("hidden until you predict");
    expect(status.textContent).toBe(cell("directed-grid", "load:6").getAttribute("aria-label"));
    // The cell's own name carries the sentence; the echo is not a live region.
    expect(status).not.toHaveAttribute("aria-live");
    expect(within(grid).queryByRole("status")).not.toBeInTheDocument();
  });

  it("the d slice note under Formal says the slice is a view filter, and appears only on that tab", () => {
    render(<VerificationMethodsExplorer />);
    expect(screen.queryByTestId("formal-slice-note")).not.toBeInTheDocument();
    fireEvent.click(radio("Method", "Formal"));
    expect(screen.getByTestId("formal-slice-note")).toHaveTextContent(FORMAL_SLICE_NOTE);
  });

  describe("prefers-reduced-motion", () => {
    const original = window.matchMedia;
    afterEach(() => {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    });
    const mock = (reduce: boolean) =>
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: (query: string) => ({ matches: reduce && query.includes("prefers-reduced-motion: reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }),
      });

    it("turns every transition off under reduce, and leaves them on otherwise", () => {
      mock(false);
      const first = render(<VerificationMethodsExplorer />);
      expect(screen.getByRole("region", { name: "Verification methods explorer" }).className).not.toContain("[&_*]:!transition-none");
      first.unmount();
      mock(true);
      render(<VerificationMethodsExplorer />);
      expect(screen.getByRole("region", { name: "Verification methods explorer" }).className).toContain("[&_*]:!transition-none");
    });
  });
});

describe("VerificationMethodsExplorer: directed", () => {
  it("hides visited cells and the verdict until a prediction is locked in", () => {
    render(<VerificationMethodsExplorer />);
    expect(cell("directed-grid", "inc:3")).toHaveTextContent("");
    expect(screen.queryByTestId("directed-result")).not.toBeInTheDocument();
  });

  it("predicting 'found' for the lesson's three tests is diagnosed, and the reveal lights the increment row only", () => {
    render(<VerificationMethodsExplorer />);
    lockIn(/Found: some test drives the bug/);
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    const verdict = directedVerdict(LESSON_TESTS.map((t) => ({ name: t.name, run: runDirected(t.steps) })));
    expect(within(screen.getByTestId("directed-result")).getByText(verdict.text)).toBeInTheDocument();
    expect(cell("directed-grid", "inc:5")).toHaveTextContent("●");
    expect(cell("directed-grid", "loadInc:7")).toHaveTextContent("✕");
    expect(cell("directed-grid", "loadInc:7").getAttribute("aria-label")).toMatch(/not visited/);
  });

  it("building test 4 (reset, load 7, ld+en d = 3) resets the prediction and, once predicted, finds the bug with a step trace", () => {
    render(<VerificationMethodsExplorer />);
    lockIn(/Missed: the bug escapes/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Example: ${stepsText(BUG_HUNT_STEPS)}` }));
    expect(screen.getByTestId("custom-steps")).toHaveTextContent(stepsText(BUG_HUNT_STEPS));
    // A new selection asks again, and hides the answer.
    expect(screen.queryByTestId("directed-result")).not.toBeInTheDocument();
    expect(cell("directed-grid", "inc:5")).toHaveTextContent("");
    lockIn(/Found: some test drives the bug/);
    const verdict = directedVerdict([...LESSON_TESTS.map((t) => ({ name: t.name, run: runDirected(t.steps) })), { name: CUSTOM_TEST_NAME, run: runDirected(BUG_HUNT_STEPS) }]);
    expect(verdict.found).toBe(true);
    expect(within(screen.getByTestId("directed-result")).getAllByText(verdict.text).length).toBeGreaterThan(0);
    expect(cell("directed-grid", "loadInc:7")).toHaveTextContent("●");
    fireEvent.change(screen.getByRole("combobox", { name: /Trace of/ }), { target: { value: "3" } });
    const trace = screen.getByRole("table", { name: `Step-by-step trace of ${CUSTOM_TEST_NAME}` });
    expect(within(trace).getAllByRole("row")).toHaveLength(BUG_HUNT_STEPS.length + 1);
    expect(within(trace).getByText("0 ✕")).toBeInTheDocument();
  });

  it("a custom step list can be built step by step from the builder buttons", () => {
    render(<VerificationMethodsExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "+ reset" }));
    fireEvent.click(screen.getByRole("button", { name: "+ increment" }));
    fireEvent.click(screen.getByRole("button", { name: "+ increment" }));
    expect(screen.getByTestId("custom-steps")).toHaveTextContent("reset, increment ×2");
    fireEvent.click(screen.getByRole("button", { name: "Remove last" }));
    expect(screen.getByTestId("custom-steps")).toHaveTextContent("reset, increment");
  });

  it("unticking a test and ticking it again asks again: the old reveal never comes back", () => {
    render(<VerificationMethodsExplorer />);
    lockIn(/Missed: the bug escapes/);
    expect(cell("directed-grid", "inc:5")).toHaveTextContent("●");
    const t1 = screen.getByRole("checkbox", { name: new RegExp(LESSON_TESTS[0].name) });
    fireEvent.click(t1);
    fireEvent.click(t1);
    expect(t1).toBeChecked();
    expect(screen.queryByTestId("directed-result")).not.toBeInTheDocument();
    expect(cell("directed-grid", "inc:5")).toHaveTextContent("");
    expect(cell("directed-grid", "loadInc:7").getAttribute("aria-label")).toMatch(/hidden until you predict/);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("shows the unknown-count rules from the model (until a reset or a load)", () => {
    render(<VerificationMethodsExplorer />);
    expect(screen.getByTestId("unknown-count-rules")).toHaveTextContent(UNKNOWN_COUNT_RULES);
  });

  it("a test 4 with no reset (load 7, then ld+en d = 3) finds the bug at step 2", () => {
    render(<VerificationMethodsExplorer />);
    fireEvent.change(screen.getByRole("combobox", { name: "d for the next load step" }), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "+ load d" }));
    fireEvent.change(screen.getByRole("combobox", { name: "d for the next load step" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ld+en d" }));
    expect(screen.getByTestId("custom-steps")).toHaveTextContent("load 7, ld+en with d = 3");
    lockIn(/Found: some test drives the bug/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const custom = runDirected([{ kind: "load", d: 7 }, { kind: "loadInc", d: 3 }]);
    const verdict = directedVerdict([...LESSON_TESTS.map((t) => ({ name: t.name, run: runDirected(t.steps) })), { name: CUSTOM_TEST_NAME, run: custom }]);
    expect(verdict.text).toMatch(/at step 2/);
    expect(within(screen.getByTestId("directed-result")).getAllByText(verdict.text).length).toBeGreaterThan(0);
  });
});

describe("VerificationMethodsExplorer: random", () => {
  it("asks 'found within 20 cycles?' before showing shares, then reveals the model's exact figures", () => {
    render(<VerificationMethodsExplorer initialTab="random" />);
    expect(cell("random-grid", "hold:2")).toHaveTextContent("");
    expect(screen.queryByText(/7\.7%/)).not.toBeInTheDocument();
    lockIn(BUCKET_LABELS["almost-always"]);
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(cell("random-grid", "hold:2")).toHaveTextContent("5.6");
    expect(cell("random-grid", "loadInc:7")).toHaveTextContent("0.6");
    expect(screen.getByTestId("random-explanation")).toHaveTextContent(randomExplanation(LESSON_RANDOM, 20));
    expect(screen.getByRole("img", { name: /7\.7% within 20 cycles, 40\.3% within 100 cycles, 99\.56% within 1,000 cycles/ })).toBeInTheDocument();
  });

  it("the correct bucket is 'rarely', and the budget and seed controls update the model text", () => {
    render(<VerificationMethodsExplorer initialTab="random" />);
    lockIn(BUCKET_LABELS.rare);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("seeded-run")).toHaveTextContent(seededRunText(simulateRandom(LESSON_RANDOM, 20, 1)));
    fireEvent.click(radio("Cycle budget", "1,000 cycles"));
    expect(screen.getByTestId("random-explanation")).toHaveTextContent(randomExplanation(LESSON_RANDOM, 1000));
    expect(screen.getByTestId("seeded-run")).toHaveTextContent(seededRunText(simulateRandom(LESSON_RANDOM, 1000, 1)));
    fireEvent.click(screen.getByRole("button", { name: "Next seed" }));
    expect(screen.getByTestId("seeded-run")).toHaveTextContent(seededRunText(simulateRandom(LESSON_RANDOM, 1000, 2)));
    fireEvent.change(screen.getByRole("combobox", { name: "P(ld)" }), { target: { value: "0" } });
    expect(screen.getByTestId("random-explanation")).toHaveTextContent(/ld is never 1/);
  });

  it("the seed field is named 'Seed' alone, can be cleared and retyped, and commits on Enter or blur", () => {
    render(<VerificationMethodsExplorer initialTab="random" />);
    lockIn(BUCKET_LABELS.rare);
    const seed = screen.getByRole("textbox", { name: "Seed" });
    fireEvent.change(seed, { target: { value: "" } });
    expect(seed).toHaveValue("");
    fireEvent.change(seed, { target: { value: "42" } });
    fireEvent.keyDown(seed, { key: "Enter" });
    expect(seed).toHaveValue("42");
    expect(screen.getByTestId("seeded-run")).toHaveTextContent(seededRunText(simulateRandom(LESSON_RANDOM, 20, 42)));
    // An invalid entry is not applied: the field returns to the current seed.
    fireEvent.change(seed, { target: { value: "0" } });
    fireEvent.blur(seed);
    expect(seed).toHaveValue("42");
    fireEvent.click(screen.getByRole("button", { name: "Next seed" }));
    expect(seed).toHaveValue("43");
  });

  it("the d slice filters the random grid: load rows show 1/8 of their share, hold and increment are unchanged", () => {
    render(<VerificationMethodsExplorer initialTab="random" />);
    lockIn(BUCKET_LABELS.rare);
    expect(cell("random-grid", "load:2")).toHaveTextContent("0.6");
    fireEvent.click(radio("d slice", "d = 3"));
    const shares = cellShares(LESSON_RANDOM, 3);
    expect(cell("random-grid", "load:2")).toHaveTextContent(formatShare(shares.load[2]));
    expect(formatShare(shares.load[2])).toBe("0.08");
    expect(cell("random-grid", "hold:2")).toHaveTextContent("5.6");
    const run = simulateRandom(LESSON_RANDOM, 20, 1);
    expect(cell("random-grid", "load:2").getAttribute("aria-label")).toBe(randomCellText(LESSON_RANDOM, "load", 2, 3, run, 20));
  });
});

describe("VerificationMethodsExplorer: formal", () => {
  it("without an assumption: predict, then the 3-edge counterexample is drawn as a waveform", () => {
    render(<VerificationMethodsExplorer initialTab="formal" />);
    expect(screen.queryByTestId("formal-result")).not.toBeInTheDocument();
    lockIn(/A counterexample/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const r = formalCheck("none");
    expect(within(screen.getByTestId("formal-result")).getByText(r.text)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Shortest counterexample\. 4 clock edges/ })).toBeInTheDocument();
  });

  it("the f1b-assumptions preset starts on !(ld && en): proof passes, the row is greyed, and the cover guard warns", () => {
    render(<VerificationMethodsExplorer preset="f1b-assumptions" />);
    expect(radio("Method", "Formal")).toHaveAttribute("aria-checked", "true");
    expect(radio("Assumption", "assume !(ld && en)")).toHaveAttribute("aria-checked", "true");
    expect(cell("formal-grid", "loadInc:3")).not.toHaveAttribute("data-excluded");
    lockIn(/A counterexample/);
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    const result = within(screen.getByTestId("formal-result"));
    expect(result.getByText(/^Proof passes, bug hidden/)).toBeInTheDocument();
    expect(result.getByText(coverWarning("noLdEn") as string)).toBeInTheDocument();
    expect(coverWarning("noLdEn")).toContain(COVER_LD_EN);
    expect(cell("formal-grid", "loadInc:3")).toHaveAttribute("data-excluded", "true");
    expect(cell("formal-grid", "inc:3")).not.toHaveAttribute("data-excluded");
    expect(screen.queryByRole("group", { name: /Shortest counterexample/ })).not.toBeInTheDocument();
  });

  it("changing the assumption asks again; 'inconclusive' is explained as tool-dependent", () => {
    render(<VerificationMethodsExplorer initialTab="formal" />);
    lockIn(/Inconclusive/);
    expect(screen.getAllByText(/tool-dependent/).length).toBeGreaterThan(0);
    fireEvent.click(radio("Assumption", "assume d != 7"));
    expect(screen.queryByTestId("formal-result")).not.toBeInTheDocument();
    lockIn(/A counterexample/);
    expect(within(screen.getByTestId("formal-result")).getByText((formalCheck("dNot7") as { text: string }).text)).toBeInTheDocument();
  });

  it("assume d != 7: the counterexample is 4 edges (reset, load 6, increment, ld+en), drawn over 5 clock edges", () => {
    render(<VerificationMethodsExplorer initialTab="formal" />);
    fireEvent.click(radio("Assumption", "assume d != 7"));
    lockIn(/A counterexample/);
    const r = formalCheck("dNot7");
    expect(r.kind === "counterexample" && r.edges).toBe(4);
    expect(within(screen.getByTestId("formal-result")).getByText(r.text)).toBeInTheDocument();
    expect(r.text).toMatch(/reset, then load 6, then increment, then ld\+en/);
    expect(screen.getByRole("group", { name: /Shortest counterexample\. 5 clock edges/ })).toBeInTheDocument();
  });

  it("switching the assumption away and back asks again: the old reveal never comes back", () => {
    render(<VerificationMethodsExplorer initialTab="formal" />);
    lockIn(/A counterexample/);
    expect(cell("formal-grid", "inc:3")).toHaveTextContent("");
    expect(cell("formal-grid", "inc:3").getAttribute("aria-label")).toMatch(/reachable from reset/);
    fireEvent.click(radio("Assumption", "assume !(ld && en)"));
    fireEvent.click(radio("Assumption", "no assumption"));
    expect(screen.queryByTestId("formal-result")).not.toBeInTheDocument();
    expect(cell("formal-grid", "inc:3").getAttribute("aria-label")).toMatch(/hidden until you predict/);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("the d slice filters the formal grid's load rows but not the search's verdict", () => {
    render(<VerificationMethodsExplorer initialTab="formal" />);
    fireEvent.click(radio("Assumption", "assume d != 7"));
    lockIn(/A counterexample/);
    expect(cell("formal-grid", "load:2")).not.toHaveAttribute("data-excluded");
    fireEvent.click(radio("d slice", "d = 7"));
    expect(cell("formal-grid", "load:2")).toHaveAttribute("data-excluded", "true");
    expect(cell("formal-grid", "loadInc:2")).toHaveAttribute("data-excluded", "true");
    expect(cell("formal-grid", "inc:2")).not.toHaveAttribute("data-excluded");
    // The verdict is still the counterexample: the slice is a view filter.
    expect(within(screen.getByTestId("formal-result")).getByText(/^Counterexample in 4 edges/)).toBeInTheDocument();
    fireEvent.click(radio("d slice", "d = 0"));
    expect(cell("formal-grid", "load:2")).not.toHaveAttribute("data-excluded");
    expect(within(screen.getByTestId("formal-result")).getByText(/^Counterexample in 4 edges/)).toBeInTheDocument();
  });
});
