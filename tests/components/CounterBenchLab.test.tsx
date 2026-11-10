import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CounterBenchLab from "@/components/curriculum/f1/CounterBenchLab";
import { HOLE_FILL_EDGE, LESSON_CONFIG, explainCheck, mutantVerdict, runBench } from "@/lib/counter-bench-model";

/** Picks an option in the open prediction prompt and locks it in. */
function predict(option: RegExp | string) {
  const legend = Array.from(document.querySelectorAll("legend")).find((l) => /Predict/.test(l.textContent ?? ""));
  if (!legend) throw new Error("No open prediction prompt");
  const fieldset = legend.closest("fieldset") as HTMLElement;
  fireEvent.click(within(fieldset).getByLabelText(option));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
}

const radio = (group: string, name: string | RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

describe("CounterBenchLab (mutation mode)", () => {
  it("starts on the WRAP_AT(6) mutant with !==, and hides every result until the prediction", () => {
    render(<CounterBenchLab />);
    expect(screen.getByRole("region", { name: /Counter bench lab: can this check fail/ })).toBeInTheDocument();
    expect(radio("DUT variant", "Mutant: WRAP_AT(6)")).toHaveAttribute("aria-checked", "true");
    expect((screen.getByRole("combobox", { name: "Compare form" }) as HTMLSelectElement).value).toBe("case-ne");
    expect(screen.queryByTestId("check-narration")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Check playback controls/ })).not.toBeInTheDocument();
    // The options include the true output, but nothing marks it before the commit.
    expect(screen.getByLabelText("PASS=7 FAIL=13 / COVERAGE seen_max=0")).toBeInTheDocument();
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
  });

  it("reveals the run after a correct prediction, and stepping narrates each check from the model", () => {
    render(<CounterBenchLab />);
    predict("PASS=7 FAIL=13 / COVERAGE seen_max=0");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("check-narration")).toHaveTextContent("Check 0 at 10 ns");
    const next = screen.getByRole("button", { name: "Next check" });
    for (let i = 0; i < 7; i += 1) fireEvent.click(next);
    const run = runBench({ ...LESSON_CONFIG, dut: "wrap6" });
    expect(screen.getByTestId("check-narration")).toHaveTextContent(explainCheck(run.checks[7], "case-ne"));
    expect(screen.getByTestId("check-narration")).toHaveTextContent("Check 7 at 80 ns: count = 0, expected = 7");
    expect(screen.getByTestId("bench-live")).toHaveTextContent("Check 7 at 80 ns");
    // The broken part shows now; the mutant verdict (which carries the PASS/FAIL numbers) waits for the last check.
    expect(within(screen.getByRole("list", { name: "Broken parts" })).getByText(/dut/)).toBeInTheDocument();
    expect(screen.queryByTestId("mutant-verdicts")).not.toBeInTheDocument();
    expect(screen.queryByText(mutantVerdict("wrap6", "case-ne").text)).not.toBeInTheDocument();
    expect(screen.getByText(/Step to the last check to see the two printed lines and whether the check caught the mutant/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: /Check scrubber/ }), { target: { value: "19" } });
    expect(within(screen.getByTestId("mutant-verdicts")).getByText(mutantVerdict("wrap6", "case-ne").text)).toBeInTheDocument();
  });

  it("the printed lines appear only at the last check", () => {
    render(<CounterBenchLab />);
    predict("PASS=7 FAIL=13 / COVERAGE seen_max=0");
    expect(screen.queryByTestId("printed-lines")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: /Check scrubber/ }), { target: { value: "19" } });
    expect(screen.getByTestId("printed-lines")).toHaveTextContent("PASS=7 FAIL=13");
    expect(screen.getByTestId("printed-lines")).toHaveTextContent("COVERAGE seen_max=0");
  });

  it("x-blind preset: a wrong prediction is explained, and the X check narrates 1'bx, the else and pass_cnt++", () => {
    render(<CounterBenchLab preset="x-blind" />);
    expect(radio("DUT variant", "Mutant: rst never reaches the DUT")).toHaveAttribute("aria-checked", "true");
    expect((screen.getByRole("combobox", { name: "Compare form" }) as HTMLSelectElement).value).toBe("logic-ne");
    predict("PASS=0 FAIL=20 / COVERAGE seen_max=0");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/That is what the bench prints for rst never asserted with count !== expected/)).toBeInTheDocument();
    const narration = screen.getByTestId("check-narration");
    expect(narration).toHaveTextContent("count != expected gives 1'bx");
    expect(narration).toHaveTextContent("takes the else (§12.4): pass_cnt++");
    expect(within(screen.getByRole("list", { name: "Broken parts" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("changing the compare form in the code line resets the prediction and the code", () => {
    render(<CounterBenchLab />);
    predict("PASS=7 FAIL=13 / COVERAGE seen_max=0");
    fireEvent.change(screen.getByRole("combobox", { name: "Compare form" }), { target: { value: "self-copy" } });
    expect(screen.queryByTestId("check-narration")).not.toBeInTheDocument();
    expect(screen.getByText(/expected = count;/)).toBeInTheDocument();
    predict("PASS=20 FAIL=0 / COVERAGE seen_max=0");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("check-narration")).toHaveTextContent("expected = count copies the DUT's value");
  });

  it("is keyboard operable: the DUT group moves with arrow keys", () => {
    render(<CounterBenchLab />);
    const current = radio("DUT variant", "Mutant: WRAP_AT(6)");
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(radio("DUT variant", "Mutant: rst never reaches the DUT")).toHaveAttribute("aria-checked", "true");
  });
});

describe("CounterBenchLab (matrix mode)", () => {
  it("hides results and plan hits until the reveal, then grades predictions", () => {
    render(<CounterBenchLab mode="matrix" />);
    expect(screen.queryByText("caught")).not.toBeInTheDocument();
    expect(screen.getByTestId("predicted-count")).toHaveTextContent("0 of 12 predicted; cells you skip are revealed without a grade");
    const planTable = screen.getByRole("table", { name: "Plan rows with coverage counts" });
    expect(within(planTable).getAllByText("?")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /count != expected against rst never asserted: no prediction yet/ }));
    fireEvent.click(screen.getByRole("button", { name: /count !== expected against reset ignored mid-count: no prediction yet/ }));
    expect(screen.getByTestId("predicted-count")).toHaveTextContent("2 of 12 predicted");
    fireEvent.click(screen.getByRole("button", { name: /Run all 12 benches and reveal/ }));

    expect(screen.getByRole("button", { name: /count != expected against rst never asserted: survived, PASS=20 FAIL=0, you said will catch, prediction wrong/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /count !== expected against reset ignored mid-count: survived, PASS=20 FAIL=0, you said will catch, prediction wrong/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /count !== expected against WRAP_AT\(6\): caught, PASS=7 FAIL=13/ })).toBeInTheDocument();
    const midRow = within(planTable).getByRole("row", { name: /reset mid-count/ });
    expect(midRow).toHaveTextContent("0");
    expect(midRow).toHaveTextContent("reset ignored mid-count (survives)");
  });

  it("selecting a result shows its run, and filling the hole kills the reset-ignored mutant", () => {
    render(<CounterBenchLab mode="matrix" />);
    fireEvent.click(screen.getByRole("button", { name: /Run all 12 benches and reveal/ }));
    fireEvent.click(screen.getByRole("button", { name: /compare commented out against WRAP_AT\(6\): survived/ }));
    expect(screen.getByTestId("matrix-detail")).toHaveTextContent(mutantVerdict("wrap6", "commented").text);
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`assert rst again at edge ${HOLE_FILL_EDGE}`) }));
    const list = screen.getByRole("list", { name: /with the hole filled/ });
    expect(list).toHaveTextContent(mutantVerdict("reset-ignored", "case-ne", 20, HOLE_FILL_EDGE).text);
    const planTable = screen.getByRole("table", { name: "Plan rows with coverage counts" });
    const midRow = within(planTable).getByRole("row", { name: /reset mid-count/ });
    expect(midRow).toHaveTextContent("1");
    // The mutant column follows the same bench as the hit counts.
    expect(midRow).toHaveTextContent("reset ignored mid-count (caught)");
    expect(within(planTable).getByRole("row", { name: /reset to 0/ })).toHaveTextContent("2");
    expect(screen.getByText(`The plan, with coverage counts with rst asserted again at edge ${HOLE_FILL_EDGE}`)).toBeInTheDocument();
    expect(screen.queryByText("The plan, with coverage counts on the lesson bench")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`assert rst again at edge ${HOLE_FILL_EDGE}`) }));
    expect(within(planTable).getByRole("row", { name: /reset mid-count/ })).toHaveTextContent("reset ignored mid-count (survives)");
    expect(screen.getByText("The plan, with coverage counts on the lesson bench")).toBeInTheDocument();
  });
});

describe("CounterBenchLab (coverage mode)", () => {
  it("asks for a prediction before the first run, then shows the lesson's hit counts", () => {
    render(<CounterBenchLab mode="coverage" />);
    expect(screen.queryByTestId("coverage-results")).not.toBeInTheDocument();
    expect(screen.getByText(/How many times does the increment line run in 20 cycles/)).toBeInTheDocument();
    predict("17");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    for (const n of [20, 1, 2, 17]) expect(screen.getByLabelText(`${n} hits`)).toBeInTheDocument();
    expect(screen.getByTestId("statement-coverage")).toHaveTextContent("Statements 3 of 3 (100%)");
    expect(screen.getByTestId("branch-coverage")).toHaveTextContent("tool-defined");
    expect(screen.getByTestId("functional-coverage")).toHaveTextContent("Scenarios 3 of 4");
  });

  it("a mid-count reset: results hide, the prediction is graded, and 'reset mid-count' reaches 1", () => {
    render(<CounterBenchLab mode="coverage" />);
    predict("17");
    fireEvent.change(screen.getByRole("combobox", { name: /Assert rst again at rising edge/ }), { target: { value: "10" } });
    expect(screen.queryByTestId("coverage-results")).not.toBeInTheDocument();
    expect(screen.getByText(/rst is asserted again at edge 10/)).toBeInTheDocument();
    predict("Code coverage stays the same; functional coverage changes");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("functional-coverage")).toHaveTextContent("Scenarios 4 of 4");
    const rstLine = Array.from(document.querySelectorAll("li")).find((li) => li.textContent?.includes("if (rst)"));
    expect(rstLine?.textContent).toContain("2×");
  });

  it("shortening the run clears a second reset that no longer fits, and two changes get a neutral question", () => {
    render(<CounterBenchLab mode="coverage" />);
    predict("17");
    const edgeSelect = () => screen.getByRole("combobox", { name: /Assert rst again at rising edge/ }) as HTMLSelectElement;
    fireEvent.change(edgeSelect(), { target: { value: "10" } });
    predict("Code coverage stays the same; functional coverage changes");
    fireEvent.click(radio("Run length", "5 cycles"));
    expect(edgeSelect().value).toBe("none");
    expect(screen.getByText(/Several things changed since the last run: the run goes from 20 to 5 cycles; the second reset at edge 10 is removed/)).toBeInTheDocument();
    fireEvent.click(radio("Run length", "20 cycles"));
    // Back at 20 cycles the reset stays cleared: this is the lesson bench, already seen.
    expect(edgeSelect().value).toBe("none");
    expect(screen.getByTestId("coverage-results")).toBeInTheDocument();
    expect(screen.getByTestId("functional-coverage")).toHaveTextContent("Scenarios 3 of 4");
  });

  it("disabling the compare keeps coverage and gives 'no evidence'", () => {
    render(<CounterBenchLab mode="coverage" />);
    predict("17");
    fireEvent.click(radio("The compare", "// disabled"));
    predict("Coverage stays the same, checks drop to 0: no evidence");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("evidence-verdict")).toHaveTextContent(/^No evidence: .*0 checks ran/);
    expect(screen.getByTestId("statement-coverage")).toHaveTextContent("3 of 3");
  });

  it("a 5-cycle run separates the wrap statement from its evaluated condition; a seen config shows without asking again", () => {
    render(<CounterBenchLab mode="coverage" />);
    predict("17");
    fireEvent.click(radio("Run length", "5 cycles"));
    predict("statements 3 of 3, branches 3 of 4");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("statement-coverage")).toHaveTextContent("Statements 2 of 3");
    expect(screen.getByTestId("branch-coverage")).toHaveTextContent("Branches 3 of 4");
    fireEvent.click(radio("Run length", "20 cycles"));
    expect(screen.getByTestId("coverage-results")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
  });
});
