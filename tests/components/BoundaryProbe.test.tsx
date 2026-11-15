import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BoundaryProbe from "@/components/curriculum/f1/BoundaryProbe";
import { comparisonStyles } from "@/components/visual-system/visual-language";
import { FAIL_GLYPH, PASS_GLYPH, axisFraction, bandSentence, bandTickLabel, explainRun, markerLayout, nextStep, runChecks, xNote } from "@/lib/boundary-probe-model";

const onScreen = { ignore: 'script, style, [role="status"]' };

const lockIn = (summary: string) => {
  fireEvent.click(screen.getByLabelText(summary));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const chooseValues = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));

describe("BoundaryProbe", () => {
  it("renders inside a named frame with the typical preset and its text alternative", () => {
    render(<BoundaryProbe />);
    expect(screen.getByRole("region", { name: /Boundary probe/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Typical values \(50, 150\)/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Remove 50" })).toBeInTheDocument();
    expect(screen.getByText(/Test values: 50, 150/)).toBeInTheDocument();
    expect(screen.getByTestId("x-note")).toHaveTextContent(xNote());
  });

  it("hides the counts, the verdicts and the band until the learner commits", () => {
    render(<BoundaryProbe preset="boundary" />);
    expect(screen.queryByTestId("probe-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("band-lens")).not.toBeInTheDocument();
    expect(screen.queryByTestId("run-output")).not.toBeInTheDocument();
    expect(screen.getByTestId("value-markers")).not.toHaveTextContent(/[✓✕]/);
  });

  it("reveals the lesson's PASS=2 FAIL=1 for the boundary test, with FAIL temp=100 and a one-value band", () => {
    render(<BoundaryProbe preset="boundary" />);
    lockIn("PASS=2 FAIL=1");
    expect(screen.getByText(/^Correct\./, onScreen)).toBeInTheDocument();
    expect(screen.getAllByText(explainRun([99, 100, 101], false), onScreen).length).toBeGreaterThan(0);
    expect(screen.getByTestId("run-output")).toHaveTextContent("FAIL temp=100 alarm=0 expected=1");
    expect(screen.getByTestId("run-output")).toHaveTextContent("PASS=2 FAIL=1");
    expect(screen.getByTestId("band-lens")).toHaveTextContent("1 value wide (100)");
    expect(screen.getByTestId("band-sentence")).toHaveTextContent(bandSentence(false));
    const table = screen.getByTestId("results-table");
    expect(within(table).getAllByText("fail")).toHaveLength(1);
    expect(within(table).getAllByText("pass")).toHaveLength(2);
    expect(screen.getByTestId("value-markers")).toHaveTextContent("100 ✕");
    expect(screen.getByTestId("probe-live")).toHaveTextContent("Correct. The test prints PASS=2 FAIL=1.");
  });

  it("explains a wrong prediction and shows why the right one holds", () => {
    render(<BoundaryProbe preset="typical" />);
    lockIn("PASS=1 FAIL=1");
    expect(screen.getByText(/^Not quite\./, onScreen)).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/, onScreen)).toBeInTheDocument();
    expect(screen.getByTestId("run-output")).toHaveTextContent(runChecks([50, 150], false).summary);
    expect(screen.getByTestId("run-output")).toHaveTextContent("PASS=2 FAIL=0");
  });

  it("fixing the RTL re-arms the prediction and gives PASS=3 FAIL=0", () => {
    render(<BoundaryProbe preset="boundary" />);
    lockIn("PASS=2 FAIL=1");
    const fix = screen.getByRole("button", { name: /Fix the RTL/ });
    fireEvent.click(fix);
    expect(fix).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("probe-reveal")).not.toBeInTheDocument();
    expect(screen.getByTestId("code-lines")).toHaveTextContent("assign alarm = (temp >= 8'd100);");
    lockIn("PASS=3 FAIL=0");
    expect(screen.getByTestId("run-output")).toHaveTextContent(/^PASS=3 FAIL=0$/);
    expect(screen.getByTestId("band-lens")).toHaveTextContent("0 values wide");
  });

  it("switching presets resets the prediction", () => {
    render(<BoundaryProbe preset="typical" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("probe-reveal")).toBeInTheDocument();
    chooseValues(/Boundary values/);
    expect(screen.queryByTestId("probe-reveal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("PASS=2 FAIL=1")).toBeInTheDocument();
  });

  it("adds and removes custom values with the keyboard-friendly form and refuses bad input", () => {
    render(<BoundaryProbe preset="typical" />);
    const input = screen.getByLabelText(/Add a value \(0 to 255\)/);
    fireEvent.change(input, { target: { value: "100" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Remove 100" })).toBeInTheDocument();
    expect(screen.getByLabelText("PASS=2 FAIL=1")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "256" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent("256 does not fit in logic [7:0]");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent("X and Z are left out");

    fireEvent.click(screen.getByRole("button", { name: "Remove 100" }));
    expect(screen.queryByRole("button", { name: "Remove 100" })).not.toBeInTheDocument();
  });

  it("an empty test shows no prediction", () => {
    render(<BoundaryProbe preset="typical" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove 50" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove 150" }));
    expect(screen.getByText(/No values yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
  });

  it("the test-values control is operable with arrow keys", () => {
    render(<BoundaryProbe preset="typical" />);
    const typical = screen.getByRole("radio", { name: /Typical values/ });
    fireEvent.keyDown(typical, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /Boundary values/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Remove 101" })).toBeInTheDocument();
  });

  it("start over returns to the opening preset and the bug", () => {
    render(<BoundaryProbe preset="boundary" />);
    fireEvent.click(screen.getByRole("button", { name: /Fix the RTL/ }));
    chooseValues(/Typical values/);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("radio", { name: /Boundary values/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Fix the RTL/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("opens on the fix with the fixed prop, and start over keeps it fixed", () => {
    render(<BoundaryProbe preset="boundary" fixed />);
    const fix = screen.getByRole("button", { name: /Fix the RTL/ });
    expect(fix).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("code-lines")).toHaveTextContent("assign alarm = (temp >= 8'd100);");
    lockIn("PASS=3 FAIL=0");
    expect(screen.getByText(/^Correct\./, onScreen)).toBeInTheDocument();
    expect(screen.getByTestId("run-output")).toHaveTextContent(/^PASS=3 FAIL=0$/);
    fireEvent.click(fix);
    expect(fix).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("button", { name: /Fix the RTL/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the number line's height when the reveal adds glyphs to dense labels", () => {
    render(<BoundaryProbe preset="typical" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove 50" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove 150" }));
    const input = screen.getByLabelText(/Add a value \(0 to 255\)/);
    const dense = [90, 100, 110, 120];
    // Without the reserved rows these labels need 3 rows hidden and 4 revealed.
    expect(markerLayout(dense, null).rows).toBeLessThan(markerLayout(dense, runChecks(dense, false)).rows);
    for (const v of dense) {
      fireEvent.change(input, { target: { value: String(v) } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    }
    const before = screen.getByTestId("value-markers").style.height;
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("value-markers")).toHaveTextContent("100 ✕");
    expect(screen.getByTestId("value-markers").style.height).toBe(before);
  });

  it("draws every spread-out custom value at its own true place on the axis", () => {
    render(<BoundaryProbe preset="typical" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove 50" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove 150" }));
    const input = screen.getByLabelText(/Add a value \(0 to 255\)/);
    const spread = [0, 30, 60, 90, 120, 150, 180, 210];
    for (const v of spread) {
      fireEvent.change(input, { target: { value: String(v) } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    }
    const layout = markerLayout(spread, null);
    for (const v of spread) {
      expect(screen.getByTestId(`marker-${v}`).style.left).toBe(`${axisFraction(v) * 100}%`);
      const placed = layout.markers.find((m) => m.value === v);
      expect(screen.getByTestId(`marker-label-${v}`).style.left).toBe(`${(placed?.labelLeft ?? -1) * 100}%`);
      expect(screen.getByTestId(`marker-label-${v}`)).toHaveTextContent(String(v));
    }
  });

  it("uses the visual language's verdict glyphs and the danger token for the band emphasis", () => {
    expect(PASS_GLYPH).toBe(comparisonStyles.match.glyph);
    expect(FAIL_GLYPH).toBe(comparisonStyles.mismatch.glyph);
    render(<BoundaryProbe preset="boundary" />);
    lockIn("PASS=2 FAIL=1");
    const lens = screen.getByTestId("band-lens");
    expect(lens.innerHTML).not.toMatch(/rose-500/);
    expect(lens.querySelectorAll(".ring-danger")).toHaveLength(2);
    expect(within(lens).getAllByText("differ: fail")).toHaveLength(1);
    expect(within(lens).getAllByText("equal: pass")).toHaveLength(6);
  });

  it("marks the band on the RTL row only after the reveal, and not after the fix", () => {
    render(<BoundaryProbe preset="boundary" />);
    expect(screen.queryByTestId("band-tick")).not.toBeInTheDocument();
    lockIn("PASS=2 FAIL=1");
    expect(screen.getByTestId("band-tick")).toHaveTextContent(bandTickLabel(false) ?? "missing");
    expect(screen.getByTestId("band-tick").firstElementChild).toHaveStyle({ left: `${axisFraction(100) * 100}%` });
    fireEvent.click(screen.getByRole("button", { name: /Fix the RTL/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.queryByTestId("band-tick")).not.toBeInTheDocument();
  });

  it("walks the junior path: typical, then boundary, then the fix", () => {
    render(<BoundaryProbe preset="typical" />);
    expect(screen.queryByTestId("next-step")).not.toBeInTheDocument();
    lockIn("PASS=2 FAIL=0");
    expect(screen.getByTestId("next-step")).toHaveTextContent(nextStep([50, 150], false).text);
    fireEvent.click(within(screen.getByTestId("next-step")).getByRole("button", { name: "Try boundary values" }));
    expect(screen.getByRole("radio", { name: /Boundary values/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Boundary values/ })).toHaveFocus();
    expect(screen.queryByTestId("probe-reveal")).not.toBeInTheDocument();

    lockIn("PASS=2 FAIL=1");
    expect(screen.getByTestId("next-step")).toHaveTextContent(nextStep([99, 100, 101], false).text);
    fireEvent.click(within(screen.getByTestId("next-step")).getByRole("button", { name: "Apply the fix" }));
    const fix = screen.getByRole("button", { name: /Fix the RTL/ });
    expect(fix).toHaveAttribute("aria-pressed", "true");
    expect(fix).toHaveFocus();

    lockIn("PASS=3 FAIL=0");
    expect(screen.getByTestId("next-step")).toHaveTextContent(nextStep([99, 100, 101], true).text);
    expect(within(screen.getByTestId("next-step")).queryByRole("button")).not.toBeInTheDocument();
  });
});
