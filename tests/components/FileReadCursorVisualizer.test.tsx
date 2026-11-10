import React from "react";
import { cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FileReadCursorVisualizer, { BENCH_LAYOUT } from "@/components/visuals/FileReadCursorVisualizer";
import { benchRunFor, runBench, DEBUG_CASES, runCursor } from "@/lib/sv-file-io-model";

afterEach(cleanup);

const lock = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
const pick = (name: string | RegExp) => fireEvent.click(screen.getByRole("radio", { name }));
const scrubToEnd = () => {
  const slider = screen.getByRole("slider", { name: /scrubber/i });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
};
/** Log lines keep their padding ("[  4 ns]"), so match them without collapsing white space. */
const exact = { normalizer: getDefaultNormalizer({ collapseWhitespace: false, trim: false }) };
/** Accessible names collapse runs of spaces. */
const collapsed = (s: string) => s.replace(/ +/g, " ");
const scrubTo = (v: number) => fireEvent.change(screen.getByRole("slider", { name: /scrubber/i }), { target: { value: String(v) } });

describe("FileReadCursorVisualizer · cursor", () => {
  it("hides the run until both predictions are committed, then explains each answer", () => {
    render(<FileReadCursorVisualizer />);
    expect(screen.getByRole("region", { name: "File reading lab: the read cursor" })).toBeInTheDocument();
    // Before the reveal: code and file are visible; no return code, no log, no stepper.
    expect(screen.getByTestId("tape-preview")).toBeInTheDocument();
    expect(screen.queryByTestId("return-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("log")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();

    pick("2 checks");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    pick(/Yes: some check reuses/);
    // The live regions exist, empty, before the reveal, so the verdict is announced when it fills in.
    expect(screen.getByTestId("feedback-checks")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("feedback-checks")).toBeEmptyDOMElement();
    lock();
    expect(screen.getByTestId("feedback-checks")).toHaveTextContent(/Correct\./);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/The reads returned 2, 2, -1; 2 checks ran\./).length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: /Call scrubber/ })).toBeInTheDocument();
  });

  it("steps call by call: consumed characters, return chips, unchanged values on -1, and the final log", () => {
    render(<FileReadCursorVisualizer mode="cursor" preset="feeding-files" />);
    reveal();
    const run = runCursor("in-txt", "forever-break");
    const reads = run.steps.map((s, i) => [s, i] as const).filter(([s]) => s.kind === "read");
    // First read: 0a 05 consumed, x and y just changed.
    scrubTo(reads[0][1]);
    expect(screen.getByTestId("return-chip")).toHaveTextContent("2");
    expect(screen.getByLabelText("x = 8'h0a, just changed")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /This call consumed "0a␠05"\. \$feof is 0\./ })).toBeInTheDocument();
    // Third read: -1, values stay and are not marked changed; $feof turns nonzero.
    scrubTo(reads[2][1]);
    expect(screen.getByTestId("return-chip")).toHaveTextContent("-1");
    expect(screen.getByLabelText("x = 8'hff")).toBeInTheDocument();
    expect(screen.getByLabelText("y = 8'h01")).toBeInTheDocument();
    expect(screen.getByTestId("narration")).toHaveTextContent(/returned EOF \(-1\) and assigned nothing \(§21\.3\.4\.3\)/);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("check 2: ff 01")).toBeInTheDocument();
    expect(screen.getByTestId("run-summary")).toHaveTextContent(run.summary);
  });

  it("grades the 'next return code' prediction when the learner steps onto the call", () => {
    render(<FileReadCursorVisualizer />);
    reveal();
    const group = screen.getByRole("group", { name: "Predict what the next call returns" });
    fireEvent.click(within(group).getByRole("button", { name: "fd ≠ 0" }));
    fireEvent.click(screen.getByRole("button", { name: /next call/i }));
    expect(screen.getByTestId("guess-feedback")).toHaveTextContent("✓ You predicted fd ≠ 0; the call returned fd ≠ 0.");
    // Next is the first $fscanf: predict -1 (wrong).
    fireEvent.click(within(screen.getByRole("group", { name: "Predict what the next call returns" })).getByRole("button", { name: "-1" }));
    fireEvent.click(screen.getByRole("button", { name: /next call/i }));
    expect(screen.getByTestId("guess-feedback")).toHaveTextContent("✕ You predicted -1; the call returned 2.");
  });

  it("while (!$feof) on vectors.txt: the answer is 5 checks and the last vector is checked twice", () => {
    render(<FileReadCursorVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "vectors.txt: four clean vectors" }));
    fireEvent.click(screen.getByRole("radio", { name: "while (!$feof) + void'" }));
    pick("4 checks");
    pick(/No: every check uses freshly read values/);
    lock();
    expect(screen.getByText(/the final newline is still unread then \(§21\.3\.8\)/)).toBeInTheDocument();
    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("check 4: 7f 01 080")).toBeInTheDocument();
    expect(within(log).getByText("check 5: 7f 01 080")).toBeInTheDocument();
  });

  it("robust-parsing preset: the short line misaligns the stream; $fgets + $sscanf shows the line tape and reports it", () => {
    render(<FileReadCursorVisualizer preset="robust-parsing" />);
    expect(screen.getByRole("radio", { name: "vectors_short.txt: line 1 has only two fields" })).toHaveAttribute("aria-checked", "true");
    reveal();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("check 2: 01 00 080")).toBeInTheDocument();
    // Changing the loop re-runs the model and re-asks the question.
    fireEvent.click(screen.getByRole("radio", { name: "$fgets + $sscanf" }));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    reveal();
    scrubTo(3);
    const lineTape = screen.getByTestId("line-tape");
    expect(lineTape).toHaveTextContent(/the string \$sscanf parses/);
    expect(lineTape).not.toHaveTextContent(/\$feof/);
    expect(within(lineTape).getByRole("img", { name: /^line, 6 characters: the string \$sscanf parses/ })).toBeInTheDocument();
    expect(within(lineTape).getByRole("img").getAttribute("aria-label")).not.toMatch(/\$feof|cursor/);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("line 1: 2 of 3 fields")).toBeInTheDocument();
  });

  it("a missing file: no tape, and the run is $fatal with no read", () => {
    render(<FileReadCursorVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "nope.txt: does not exist" }));
    expect(screen.getByText(/there is no such file/)).toBeInTheDocument();
    // "0 checks" would be a second right answer next to the $fatal option, so it is not offered.
    expect(screen.queryByRole("radio", { name: "0 checks" })).not.toBeInTheDocument();
    pick("No checks: $fatal ends the run before any read");
    pick(/No: every check uses freshly read values/);
    lock();
    expect(screen.getAllByText(/Correct\./)).toHaveLength(2);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("<Fatal prefix, 0 ns> cannot open nope.txt")).toBeInTheDocument();
  });

  it("garbled + while (!$feof): the model shows the loop never ends", () => {
    render(<FileReadCursorVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "vectors_garbled.txt: line 2 holds g00, which is not hex" }));
    fireEvent.click(screen.getByRole("radio", { name: "while (!$feof) + void'" }));
    pick("The loop never ends");
    pick(/Yes: some check reuses/);
    lock();
    scrubToEnd();
    expect(screen.getByTestId("narration")).toHaveTextContent(/never turns nonzero and the loop never ends/);
  });
});

describe("FileReadCursorVisualizer · bench", () => {
  it("the diagram mirrors the lesson's ArchitectureDiagram without layout problems", () => {
    expect(BENCH_LAYOUT.problems).toEqual([]);
    expect(BENCH_LAYOUT.warnings).toEqual([]);
    expect(BENCH_LAYOUT.width).toBeLessThanOrEqual(400);
  });

  it("gates the summary prediction; options are the model's summaries; stepping shows each arrow and the counters", () => {
    render(<FileReadCursorVisualizer mode="bench" preset="worked-example" />);
    expect(screen.getByRole("region", { name: "File reading lab: the plusarg-selected, file-driven bench" })).toBeInTheDocument();
    expect(screen.queryByTestId("bench-run")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "vectors_bad.txt: line 2 expects the wrong sum" }));
    expect(screen.getByTestId("bench-cmdline")).toHaveTextContent("+VECTORS=vectors_bad.txt");
    for (const label of ["[  4 ns] PASS=4 FAIL=0", "[  4 ns] PASS=3 FAIL=1", "[  1 ns] PASS=1 FAIL=1", "No summary line: the run ends in $fatal", "[  0 ns] PASS=0 FAIL=1"]) {
      expect(screen.getByRole("radio", { name: collapsed(label) })).toBeInTheDocument();
    }
    pick(collapsed("[  4 ns] PASS=4 FAIL=0"));
    lock();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(collapsed(benchRunFor("vectors_bad.txt").story).replace(/[[\]$().*+?]/g, "\\$&"))).length).toBeGreaterThan(0);
    // Step 2 is the +VECTORS lookup: its arrow is active.
    scrubTo(1);
    expect(screen.getByRole("group", { name: /the \$value\$plusargs arrow is active/ })).toBeInTheDocument();
    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("<Error prefix, 2 ns> vector 2: ff + 01 = 100, expected 000")).toBeInTheDocument();
    expect(within(log).getByText("[  4 ns] PASS=3 FAIL=1", exact)).toBeInTheDocument();
    expect(screen.getByLabelText("n_fail = 1")).toBeInTheDocument();
  });

  it("a missing file ends in $fatal at 0 ns with no summary; +DUMP lights the waves.vcd arrow", () => {
    render(<FileReadCursorVisualizer mode="bench" />);
    fireEvent.click(screen.getByRole("radio", { name: "nope.txt: missing" }));
    pick("No summary line: the run ends in $fatal");
    lock();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("<Fatal prefix, 0 ns> cannot open vector file nope.txt")).toBeInTheDocument();
    expect(within(screen.getByTestId("log")).queryByText(/PASS=/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "vectors.txt: clean" }));
    fireEvent.click(screen.getByRole("radio", { name: "with +DUMP" }));
    expect(screen.getByTestId("bench-cmdline")).toHaveTextContent("+VECTORS=vectors.txt +DUMP");
    reveal();
    const run = benchRunFor("vectors.txt", true);
    scrubTo(run.steps.findIndex((s) => s.edge === "vcd"));
    expect(screen.getByRole("group", { name: /the \$dumpvars arrow is active/ })).toBeInTheDocument();
  });
});

describe("FileReadCursorVisualizer · debug", () => {
  it("case 2: the log comes from the model; every wrong suspect gets a diagnosis; the right fix tells the truth, a wrong one still lies", () => {
    render(<FileReadCursorVisualizer mode="debug" preset="case-2" />);
    expect(screen.getByRole("region", { name: "File reading lab: the log that lies" })).toBeInTheDocument();
    const buggy = runBench(DEBUG_CASES[0].config);
    expect(within(screen.getByTestId("debug-log")).getByText(buggy.summary as string, exact)).toBeInTheDocument();
    // The visual's case 2 differs from the lesson's snippet (plusarg, %t stamp); the note says so.
    expect(screen.getByTestId("case-note")).toHaveTextContent(/runs this case on the worked example's bench: the misspelt name arrives as \+VECTORS=vectros\.txt/);
    expect(screen.queryByRole("button", { name: /rerun/i })).not.toBeInTheDocument();

    const lines = within(screen.getByRole("list", { name: /choose the suspect line/ })).getAllByRole("button");
    const summaryLine = lines.find((b) => /PASS=%0d/.test(b.getAttribute("aria-label") ?? "")) as HTMLElement;
    fireEvent.click(summaryLine);
    expect(screen.getByTestId("suspect-feedback")).toHaveTextContent(/Not the cause\..*n_pass=0 and n_fail=0/);
    const fopen = lines.find((b) => /\$fopen/.test(b.getAttribute("aria-label") ?? "")) as HTMLElement;
    fireEvent.click(fopen);
    expect(screen.getByTestId("suspect-feedback")).toHaveTextContent(/Found it\..*\$fopen returned 0 \(§21\.3\.1\)/);

    pick("Switch to forever with break on code != 3");
    expect(screen.getByTestId("rerun-verdict")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("rerun-verdict")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Rerun with this fix" }));
    expect(within(screen.getByTestId("rerun-verdict")).getByTestId("verdict")).toBeInTheDocument();
    expect(screen.getByTestId("verdict")).toHaveTextContent(/still lies/);
    expect(within(screen.getByTestId("rerun-log")).getByText("[  0 ns] PASS=0 FAIL=0", exact)).toBeInTheDocument();

    pick(/Add if \(fd == 0\) \$fatal/);
    fireEvent.click(screen.getByRole("button", { name: "Rerun with this fix" }));
    expect(screen.getByTestId("verdict")).toHaveTextContent(/tells the truth/);
    expect(within(screen.getByTestId("rerun-log")).getByText("<Fatal prefix, 0 ns> cannot open vector file vectros.txt")).toBeInTheDocument();
    expect(screen.getByText(/This removes the root cause\./)).toBeInTheDocument();
  });

  it("case 3 and case 4 logs match the lesson; hints come one at a time, three in all", () => {
    render(<FileReadCursorVisualizer mode="debug" preset="case-3" />);
    expect(within(screen.getByTestId("debug-log")).getAllByText("check 5: 7f 01 080")).toHaveLength(1);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: /hint/i }));
    expect(screen.queryByRole("button", { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.getByText(/§21\.3\.8/, { selector: "li" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Case 4/ }));
    const log = screen.getByTestId("debug-log");
    expect(within(log).getByText("<Error prefix, 2 ns> vector 2: ff + 01 = 100, expected 000")).toBeInTheDocument();
    expect(within(log).getByText("[  4 ns] PASS=4 FAIL=0", exact)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the fixes" }));
    pick("Add n_fail++ to the failing branch only");
    fireEvent.click(screen.getByRole("button", { name: "Rerun with this fix" }));
    expect(screen.getByTestId("verdict")).toHaveTextContent(/The verdict is right .* PASS=4 FAIL=1, while the fully guarded bench gives \[ 4 ns\] PASS=3 FAIL=1/);
  });
});

describe("FileReadCursorVisualizer · plusargs", () => {
  it("lesson preset: predicts $test$plusargs(\"V\"), then slides the query across the tokens", () => {
    render(<FileReadCursorVisualizer mode="plusargs" preset="lesson" />);
    expect(screen.getByRole("region", { name: "File reading lab: plusarg lookups" })).toBeInTheDocument();
    expect(within(screen.getByTestId("tokens")).getByText("+VECTORS=vectors_bad.txt")).toBeInTheDocument();
    expect(screen.queryByTestId("plusarg-scan")).not.toBeInTheDocument();
    pick("0");
    lock();
    expect(screen.getByText(/^A plusarg matched, so the function does not return 0\./)).toBeInTheDocument();
    expect(screen.getByTestId("narration")).toHaveTextContent(/all 1 characters of "V" match its beginning/);
    expect(screen.getByTestId("scan-token-1")).toHaveTextContent(/not examined: an earlier plusarg matched/);
    scrubToEnd();
    expect(screen.getByTestId("plusarg-result")).toHaveTextContent(/nonzero/);
    expect(screen.getByLabelText("v_found = 1, just changed")).toBeInTheDocument();
  });

  it("regression-scale preset: +SEED=7 +SEED=2 gives 7 (not the default 1); moving +SEED=2 left re-asks and gives 2", () => {
    render(<FileReadCursorVisualizer mode="plusargs" preset="regression-scale" />);
    pick("a nonzero integer");
    pick("7");
    lock();
    expect(screen.getAllByText(/Correct\./)).toHaveLength(2);
    scrubToEnd();
    expect(screen.getByLabelText("seed = 7, just changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move +SEED=2 left" }));
    expect(screen.queryByTestId("plusarg-scan")).not.toBeInTheDocument();
    reveal();
    scrubToEnd();
    expect(screen.getByLabelText("seed = 2, just changed")).toBeInTheDocument();
  });

  it("+SEED=12x: an int silently becomes 0, a logic [31:0] reads X", () => {
    render(<FileReadCursorVisualizer mode="plusargs" preset="regression-scale" />);
    fireEvent.click(screen.getByRole("button", { name: "+SEED=12x" }));
    pick("a nonzero integer");
    pick("12");
    lock();
    expect(screen.getByText(/'bx into the variable/)).toBeInTheDocument();
    scrubToEnd();
    expect(screen.getByLabelText("seed = 0, just changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "logic [31:0]" }));
    reveal();
    scrubToEnd();
    expect(screen.getByLabelText("seed = X, unknown (X), just changed")).toBeInTheDocument();
  });

  it("the command line is editable: remove and add tokens; a miss leaves the default and returns 0", () => {
    render(<FileReadCursorVisualizer mode="plusargs" preset="regression-scale" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove +SEED=7" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove +SEED=2" }));
    fireEvent.change(screen.getByLabelText("Add a plusarg"), { target: { value: "+TESTNAME=t1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(within(screen.getByTestId("tokens")).getByText("+TESTNAME=t1")).toBeInTheDocument();
    reveal();
    scrubToEnd();
    expect(screen.getByTestId("narration")).toHaveTextContent(/No plusarg begins with "SEED=".*leaves seed at 1 and prints no warning/);
    expect(screen.getByLabelText("seed = 1")).toBeInTheDocument();
  });
});
