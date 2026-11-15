import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ReadmemLoader, { READMEM_ASSUMPTIONS, cellTone } from "@/components/visuals/ReadmemLoader";
import { READMEM_PRESETS, START_ONLY_RANGE_NOTE, getReadmemPreset, gradePrediction, memorySummary, runPreset } from "@/lib/sv-readmem-model";

const pick = (address: number, hex: string) => fireEvent.click(screen.getByRole("button", { name: `Address ${address}, @${hex}` }));
const check = () => fireEvent.click(screen.getByRole("button", { name: "Check my prediction" }));
const verdict = () => screen.getByTestId("readmem-verdict");
const stepPanel = () => screen.getByTestId("readmem-step");
const live = () => screen.getByTestId("readmem-live");

describe("ReadmemLoader", () => {
  it("renders inside a named frame with the model fidelity and its assumptions", () => {
    render(<ReadmemLoader />);
    expect(screen.getByRole("region", { name: /Readmem loader/ })).toBeInTheDocument();
    expect(READMEM_ASSUMPTIONS).toContain(START_ONLY_RANGE_NOTE);
    expect(screen.getByTestId("readmem-call")).toHaveTextContent('$readmemh("rom.hex", rom);');
  });

  it("hides the answer until the learner commits: no step, verdict or diagnostic before the reveal", () => {
    render(<ReadmemLoader preset="sized" />);
    expect(screen.queryByTestId("readmem-verdict")).toBeNull();
    expect(screen.queryByTestId("readmem-step")).toBeNull();
    expect(screen.queryByTestId("readmem-diagnostics")).toBeNull();
    expect(screen.queryByText(/✓ picked|✕ loaded|✕ picked/)).toBeNull();
    // Every cell still shows its initial x before the reveal.
    expect(screen.getAllByRole("button", { name: /^Address \d+, @/ })).toHaveLength(16);
  });

  it("lets the learner pick cells as toggle buttons and grades a right prediction", () => {
    render(<ReadmemLoader preset="rom-hex" />);
    pick(0, "0");
    pick(1, "1");
    pick(8, "8");
    expect(screen.getByRole("button", { name: "Address 8, @8" })).toHaveAttribute("aria-pressed", "true");
    check();
    const expected = gradePrediction(runPreset(getReadmemPreset("rom-hex")), new Set([0, 1, 8]));
    expect(within(verdict()).getByText(expected.headline)).toBeInTheDocument();
    expect(within(screen.getByTestId("cell-8")).getByText("✓ picked, loaded")).toBeInTheDocument();
  });

  it("explains why @10 means address 16 when the learner picks 10", () => {
    render(<ReadmemLoader preset="at10" />);
    expect(screen.getAllByRole("button", { name: /^Address \d+, @/ })).toHaveLength(32);
    pick(10, "a");
    check();
    expect(within(verdict()).getByText(/Not quite: values land at 16\./)).toBeInTheDocument();
    expect(within(verdict()).getByText(/@10 is hexadecimal, so it means address 16, not 10/)).toBeInTheDocument();
    expect(within(screen.getByTestId("cell-10")).getByText("✕ picked, not loaded")).toBeInTheDocument();
    expect(within(screen.getByTestId("cell-16")).getByText("✕ loaded, not picked")).toBeInTheDocument();
  });

  it("steps the pointer token by token, with the memory summary and live region following the model", () => {
    const run = runPreset(getReadmemPreset("at4"));
    render(<ReadmemLoader preset="at4" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(within(stepPanel()).getByText(run.steps[0].message)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next token" }));
    expect(within(stepPanel()).getByText(run.steps[1].message)).toBeInTheDocument();
    expect(within(stepPanel()).getByText(/Pointer: address 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next token" }));
    expect(screen.getByTestId("readmem-memory-summary")).toHaveTextContent(memorySummary(run, 2));
    expect(live()).toHaveTextContent(run.steps[2].message);
    fireEvent.click(screen.getByRole("button", { name: "Jump to the end" }));
    expect(screen.getByRole("slider", { name: "Load step" })).toHaveValue(String(run.steps.length - 1));
    expect(screen.getByTestId("cell-0")).toHaveAccessibleName(/not written, xx/);
  });

  it("keeps the downward direction after an @ line when start is above finish", () => {
    render(<ReadmemLoader preset="at4" />);
    fireEvent.click(screen.getByRole("radio", { name: "Start above finish: rom, 7, 0" }));
    expect(screen.getByTestId("readmem-call")).toHaveTextContent('$readmemh("rom.hex", rom, 7, 0);');
    pick(4, "4");
    pick(5, "5");
    check();
    expect(within(verdict()).getByText("Not quite: values land at 3 and 4.")).toBeInTheDocument();
  });

  it("shows the out-of-range error with its clause, and nothing lands", () => {
    render(<ReadmemLoader preset="out-of-range" />);
    check();
    expect(within(verdict()).getByText("Right: no value lands anywhere.")).toBeInTheDocument();
    const diags = screen.getByTestId("readmem-diagnostics");
    expect(within(diags).getByText(/outside the call's range 4 to 7/)).toBeInTheDocument();
    expect(within(diags).getByText("(IEEE 1800-2023 §21.4)")).toBeInTheDocument();
  });

  it("shows the word-count warning for the short Kata 2 file with start and finish", () => {
    render(<ReadmemLoader preset="short" mode="ascending" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const diags = screen.getByTestId("readmem-diagnostics");
    expect(within(diags).getByText(/Warning/)).toBeInTheDocument();
    expect(within(diags).getByText(/holds 3 data words and the range 0 to 3 holds 4/)).toBeInTheDocument();
  });

  it("flags a sized number as not allowed and says the tool reaction is not set by the standard", () => {
    render(<ReadmemLoader preset="sized" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(within(screen.getByTestId("readmem-diagnostics")).getByText(/does not say how a tool reacts/)).toBeInTheDocument();
  });

  it("resets the prediction when the file or the arguments change", () => {
    render(<ReadmemLoader />);
    pick(3, "3");
    check();
    fireEvent.click(screen.getByRole("radio", { name: "Start only: rom, 2" }));
    expect(screen.queryByTestId("readmem-verdict")).toBeNull();
    expect(screen.getByRole("button", { name: "Address 3, @3" })).toHaveAttribute("aria-pressed", "false");
    pick(3, "3");
    check();
    fireEvent.change(screen.getByRole("combobox", { name: /File/ }), { target: { value: "data-hex" } });
    expect(screen.getByTestId("readmem-call")).toHaveTextContent('$readmemh("data.hex", rom);');
    expect(screen.queryByTestId("readmem-verdict")).toBeNull();
    for (const b of screen.getAllByRole("button", { name: /^Address \d+, @/ })) expect(b).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByRole("slider", { name: "Load step" })).toHaveValue("0");
  });

  it("shows every step's message from the model as the learner steps through", () => {
    const run = runPreset(getReadmemPreset("rom-hex"));
    render(<ReadmemLoader preset="rom-hex" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    for (let i = 0; i < run.steps.length; i += 1) {
      expect(within(stepPanel()).getByText(run.steps[i].message)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next token" }));
    }
  });

  it("shows no verdict marks when the learner reveals without predicting, even with cells picked", () => {
    render(<ReadmemLoader preset="rom-hex" />);
    pick(3, "3");
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.queryByText(/✓ picked|✕ loaded|✕ picked/)).toBeNull();
    expect(screen.getByTestId("cell-0")).not.toHaveAccessibleName(/loaded, not picked/);
  });

  it("keeps the verdict out of the live region once revealed, since the focused heading reads it", () => {
    const run = runPreset(getReadmemPreset("rom-hex"));
    render(<ReadmemLoader preset="rom-hex" />);
    check();
    const headline = gradePrediction(run, new Set()).headline;
    expect(live()).not.toHaveTextContent(headline);
    expect(live()).toHaveTextContent(`Step 1 of ${run.steps.length}: ${run.steps[0].message}`);
  });

  it("preset labels name the file only, never the outcome", () => {
    render(<ReadmemLoader />);
    const options = within(screen.getByRole("combobox", { name: /File/ })).getAllByRole("option");
    expect(options).toHaveLength(READMEM_PRESETS.length);
    for (const o of options) expect(o.textContent).not.toMatch(/error|warning|hexadecimal|outside|lands?/i);
  });

  it("moves the focus to the verdict on check or reveal, and back to the prompt on predict again", () => {
    render(<ReadmemLoader preset="rom-hex" />);
    screen.getByRole("button", { name: "Check my prediction" }).focus();
    check();
    expect(document.activeElement).toBe(screen.getByTestId("readmem-verdict-heading"));
    fireEvent.click(screen.getByRole("button", { name: "Predict again" }));
    expect(document.activeElement).toBe(screen.getByTestId("readmem-prompt"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(document.activeElement).toBe(screen.getByTestId("readmem-verdict-heading"));
    expect(screen.getByTestId("readmem-verdict-heading")).toHaveTextContent("Revealed without a prediction.");
  });

  it("leaves the focus on the file picker when the file changes after a reveal", () => {
    render(<ReadmemLoader />);
    check();
    const select = screen.getByRole("combobox", { name: /File/ });
    select.focus();
    fireEvent.change(select, { target: { value: "at4" } });
    expect(document.activeElement).toBe(select);
  });

  it("step buttons at the end of their range stay focusable and do nothing", () => {
    const run = runPreset(getReadmemPreset("at4"));
    render(<ReadmemLoader preset="at4" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const back = screen.getByRole("button", { name: "Previous token" });
    expect(back).toHaveAttribute("aria-disabled", "true");
    expect(back).not.toBeDisabled();
    fireEvent.click(back);
    expect(screen.getByRole("slider", { name: "Load step" })).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Jump to the end" }));
    fireEvent.click(screen.getByRole("button", { name: "Next token" }));
    expect(screen.getByRole("slider", { name: "Load step" })).toHaveValue(String(run.steps.length - 1));
  });

  it("the slider names only the step; the live region carries the message, so nothing is read twice", () => {
    const run = runPreset(getReadmemPreset("at4"));
    render(<ReadmemLoader preset="at4" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "Next token" }));
    const slider = screen.getByRole("slider", { name: "Load step" });
    expect(slider).toHaveAttribute("aria-valuetext", `Step 2 of ${run.steps.length}`);
    expect(live()).toHaveTextContent(run.steps[1].message);
  });

  it("labels the sized-number landing set as the model's, with the rule and the stop shown separately", () => {
    const run = runPreset(getReadmemPreset("sized"));
    render(<ReadmemLoader preset="sized" />);
    pick(0, "0");
    pick(2, "2");
    check();
    expect(within(verdict()).getByText("Not quite. In this model: values land at 0.")).toBeInTheDocument();
    expect(gradePrediction(run, new Set([0, 2])).headline).toBe("Not quite. In this model: values land at 0.");
    expect(within(verdict()).getByText(/Address 2: the model stops at 8'h34, before reaching it/)).toBeInTheDocument();
    const diags = screen.getByTestId("readmem-diagnostics");
    expect(within(diags).getByText(/shall have neither the length nor the base format specified/)).toBeInTheDocument();
    expect(within(diags).getAllByText(/the model's reading: the standard does not settle this/)).toHaveLength(1);
  });

  it("says the out-of-range @2 ended the load for picks 2 and 3", () => {
    render(<ReadmemLoader preset="out-of-range" />);
    pick(2, "2");
    pick(3, "3");
    check();
    expect(within(verdict()).getByText("Address 3: the load ended at @2, before reaching it (IEEE 1800-2023 §21.4).")).toBeInTheDocument();
    expect(within(verdict()).queryByText(/the file never reaches it/)).toBeNull();
  });

  it("makes the call and file panes keyboard-scrollable regions, and the legend covers x digits from the file", () => {
    render(<ReadmemLoader preset="short" mode="descending" />);
    expect(screen.getByTestId("readmem-call")).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("region", { name: "The call" })).toHaveTextContent('$readmemh("sums_short.hex", sum_mem, 3, 0);');
    expect(screen.getByRole("region", { name: "Contents of sums_short.hex" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByTestId("readmem-legend")).toHaveTextContent(/or a number written from the file with x digits/);
    expect(screen.getByTestId("readmem-legend")).toHaveTextContent(/Dashed cells hold a number from the file with z digits and no x/);
  });

  it("draws an x word with the X hatch and a z word with the Z dash of the visual language", () => {
    const cell = { address: 0, written: true, writtenAt: 1, tokenIndex: 0 };
    expect(cellTone({ ...cell, digits: "zz" })).toBe("highz");
    expect(cellTone({ ...cell, digits: "z1" })).toBe("highz");
    expect(cellTone({ ...cell, digits: "xz" })).toBe("unknown");
    expect(cellTone({ ...cell, digits: "12" })).toBe("known");
    expect(cellTone({ ...cell, digits: "xx", written: false })).toBe("unknown");
  });

  it("marks unreached file tokens without lowering their opacity", () => {
    render(<ReadmemLoader preset="at4" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const file = screen.getByTestId("readmem-file");
    for (const t of file.querySelectorAll("[data-token]")) expect(t.className).not.toMatch(/opacity/);
  });

  it("marks the pointer and picked cells with a 2 px accent edge", () => {
    render(<ReadmemLoader preset="at4" />);
    pick(4, "4");
    expect(screen.getByRole("button", { name: "Address 4, @4" }).className).toMatch(/border-l-2 border-l-primary/);
  });

  it("hides the picker when showPresetPicker is false", () => {
    render(<ReadmemLoader preset="at4" showPresetPicker={false} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
