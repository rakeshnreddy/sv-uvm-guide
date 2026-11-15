import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoopTracer from "@/components/visuals/LoopTracer";
import {
  DEFAULT_INPUTS,
  LOOP_PRESETS,
  MISCONCEPTION_FEEDBACK,
  PASS_DEFINITION,
  ZERO_DELAY_BUDGET,
  buildProgram,
  presetById,
  presetInputs,
  runLoop,
  summarizeRun,
  type LoopPresetId,
} from "@/lib/sv-loop-model";

const answerFor = (id: LoopPresetId) => {
  const p = presetById(id);
  return summarizeRun(runLoop(p.program, presetInputs(p)));
};
const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
const scrubber = () => screen.getByRole("slider", { name: "Loop step scrubber" });
const seekEnd = () => {
  const s = scrubber();
  fireEvent.change(s, { target: { value: s.getAttribute("max") } });
};
const chooseLoop = (id: LoopPresetId) => fireEvent.change(screen.getByLabelText("Loop"), { target: { value: id } });

describe("LoopTracer", () => {
  it("renders inside a named frame and hides the trace until a prediction is committed", () => {
    render(<LoopTracer />);
    expect(screen.getByRole("region", { name: "Loop tracer: counting loop passes" })).toBeInTheDocument();
    expect(screen.queryByTestId("loop-trace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pass-counter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
    // The code is visible, the answer is not.
    expect(screen.getByText("for (int i = 0; i < 5; i++) begin")).toBeInTheDocument();
  });

  it("reveals the trace after a correct prediction, with feedback from the model's verdict", () => {
    render(<LoopTracer />);
    lockIn(answerFor("for-continue-break"));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("loop-trace")).toBeInTheDocument();
    expect(screen.getByTestId("flow-init")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("pass-counter")).toHaveTextContent("Passes0");
  });

  it("explains a wrong prediction with the rule it breaks", () => {
    render(<LoopTracer />);
    lockIn("Never ends, and time stays at t = 0");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(MISCONCEPTION_FEEDBACK["continue-skips-step"])).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/)).toBeInTheDocument();
  });

  it("steps through the lesson's for loop: continue tag, console, pass counter and result", () => {
    render(<LoopTracer />);
    skip();
    const s = scrubber();
    const steps = runLoop("for-jumps", DEFAULT_INPUTS).steps;
    const continueAt = steps.findIndex((st) => st.jump === "continue");
    fireEvent.change(s, { target: { value: String(continueAt) } });
    expect(screen.getByTestId("jump-tag")).toHaveTextContent("continue");
    expect(screen.getByTestId("current-line")).toHaveTextContent("if (i == 1) continue;");
    expect(screen.getByTestId("console")).toHaveTextContent("i = 0");
    seekEnd();
    expect(screen.getByTestId("flow-exit")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("pass-counter")).toHaveTextContent("Passes4");
    expect(screen.getByTestId("console")).toHaveTextContent("i = 0i = 2");
    expect(screen.getByTestId("loop-result")).toHaveTextContent(`Result: ${answerFor("for-continue-break")}.`);
  });

  it("is keyboard operable: arrow keys step the trace and the live region follows", () => {
    render(<LoopTracer />);
    skip();
    const group = screen.getByRole("group", { name: "Loop step playback controls" });
    fireEvent.keyDown(within(group).getByRole("button", { name: "Next loop step" }), { key: "ArrowRight" });
    const steps = runLoop("for-jumps", DEFAULT_INPUTS).steps;
    expect(screen.getByTestId("trace-live")).toHaveTextContent(`Step 2 of ${steps.length}. ${steps[1].what}`);
    expect(screen.getByTestId("flow-test")).toHaveAttribute("aria-current", "step");
  });

  it("changing an input resets the prediction and rewrites the code", () => {
    render(<LoopTracer />);
    skip();
    fireEvent.change(screen.getByLabelText("N in i < N"), { target: { value: "2" } });
    expect(screen.queryByTestId("loop-trace")).not.toBeInTheDocument();
    expect(screen.getByText("for (int i = 0; i < 2; i++) begin")).toBeInTheDocument();
    expect(screen.getByLabelText(summarizeRun(runLoop("for-jumps", { ...DEFAULT_INPUTS, bound: 2 })))).toBeInTheDocument();
  });

  it("repeat (n): switching n from logic [3:0] to logic signed [3:0] changes the answer for 4'b1101", () => {
    render(<LoopTracer preset="repeat-1101" />);
    expect(screen.getByText("logic [3:0] n = 4'b1101;")).toBeInTheDocument();
    lockIn(answerFor("repeat-1101"));
    seekEnd();
    expect(screen.getByTestId("pass-counter")).toHaveTextContent("Passes13");
    fireEvent.click(screen.getByRole("radio", { name: "logic signed [3:0]" }));
    expect(screen.getByText("logic signed [3:0] n = 4'b1101;")).toBeInTheDocument();
    skip();
    seekEnd();
    expect(screen.getByTestId("pass-counter")).toHaveTextContent("Passes0");
    expect(screen.getByTestId("step-what")).toHaveTextContent(/-3/);
  });

  it("repeat (n): x bits are accepted, a bad entry shows an error and hides the prediction", () => {
    render(<LoopTracer preset="repeat-1101" />);
    const bits = screen.getByLabelText(/Bits of n/);
    fireEvent.change(bits, { target: { value: "1x" } });
    expect(screen.getByTestId("input-error")).toHaveTextContent(/exactly four bits/);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    fireEvent.change(bits, { target: { value: "1x01" } });
    expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
    expect(screen.getByText("logic [3:0] n = 4'b1x01;")).toBeInTheDocument();
  });

  it("repeat (n) with int n: shows the 2-state note and rejects values outside the lab's range", () => {
    render(<LoopTracer preset="repeat-negative-int" />);
    expect(screen.getByText(/int is a 2-state type/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Value of int n/), { target: { value: "40" } });
    expect(screen.getByTestId("input-error")).toHaveTextContent(/whole number/);
  });

  it("while (0) and do … while (0): the flowchart puts the test before or after the body", () => {
    render(<LoopTracer preset="while-zero" />);
    skip();
    expect(screen.getByTestId("test-placement")).toHaveTextContent(/Test before the body/);
    expect(screen.getByTestId("flow-test")).toHaveAttribute("aria-current", "step");
    chooseLoop("do-while-zero");
    expect(screen.getByText(/Only 0 and 1 here/)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "1'bx" })).not.toBeInTheDocument();
    skip();
    expect(screen.getByTestId("test-placement")).toHaveTextContent(/Test after the body/);
    expect(screen.getByTestId("flow-body")).toHaveAttribute("aria-current", "step");
    seekEnd();
    expect(screen.getByTestId("pass-counter")).toHaveTextContent("Passes1");
  });

  it("forever x = ~x: the statement count climbs while t stays 0, ending with 'time never advances'", () => {
    render(<LoopTracer preset="forever-zero-delay" />);
    lockIn(answerFor("forever-zero-delay"));
    fireEvent.change(scrubber(), { target: { value: "9" } });
    expect(screen.getByTestId("statement-count")).toHaveTextContent("Statements at t = 010");
    expect(screen.getByTestId("sim-time")).toHaveTextContent("t = 0");
    seekEnd();
    expect(screen.getByTestId("sim-time")).toHaveTextContent("t = 0");
    expect(screen.getByTestId("step-what")).toHaveTextContent(/^Time never advances/);
  });

  it("forever #5 clk = ~clk: opens at t = 0 with clk = 0, then time advances by 5 each pass", () => {
    render(<LoopTracer preset="forever-clock" />);
    skip();
    expect(screen.getByTestId("sim-time")).toHaveTextContent("t = 0");
    expect(screen.getByLabelText("clk = 0")).toBeInTheDocument();
    expect(screen.getByTestId("step-what")).toHaveTextContent(/The first #5 starts waiting/);
    fireEvent.change(scrubber(), { target: { value: "1" } });
    expect(screen.getByTestId("sim-time")).toHaveTextContent("t = 5");
    expect(screen.getByTestId("statement-count")).toHaveTextContent("Statements at t = 50");
    fireEvent.change(scrubber(), { target: { value: "3" } });
    expect(screen.getByTestId("sim-time")).toHaveTextContent("t = 10");
    expect(screen.getByTestId("test-placement")).toHaveTextContent(/No test/);
  });

  it("forever x = ~x: after the reveal, the pass counter and statement chip read the budget the verdict states", () => {
    render(<LoopTracer preset="forever-zero-delay" />);
    skip();
    seekEnd();
    expect(screen.getByTestId("pass-counter")).toHaveTextContent(`Passes${ZERO_DELAY_BUDGET}`);
    expect(screen.getByTestId("statement-count")).toHaveTextContent(`Statements at t = 0${ZERO_DELAY_BUDGET}`);
    expect(screen.getByTestId("step-what")).toHaveTextContent(`${ZERO_DELAY_BUDGET} statements ran at t = 0`);
  });

  it("flowchart: no in-loop box has an arrow into the exit; the exit branches off the test, and a marker shows the way back", () => {
    for (const p of LOOP_PRESETS) {
      const program = buildProgram(p.program, presetInputs(p));
      const { unmount, container } = render(<LoopTracer preset={p.id} />);
      skip();
      expect(container.querySelector('[data-testid$="-exit"][data-testid^="flow-arrow-"]'), p.id).toBeNull();
      const back = screen.getByTestId("flow-loopback");
      expect(back).toHaveTextContent(program.edges.loopBackLabel);
      expect(back).toHaveAttribute("data-to", program.edges.loopBackTo);
      if (program.edges.exitFrom.length > 0) {
        const branch = screen.getByTestId("flow-exit-branch");
        for (const from of program.edges.exitFrom) expect(branch).toHaveTextContent(`Exit from ${from}`);
      } else {
        expect(screen.queryByTestId("flow-exit-branch")).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it("flowchart: the for loop's step goes back to the test, and break is a way out", () => {
    render(<LoopTracer />);
    skip();
    expect(screen.queryByTestId("flow-arrow-step-exit")).not.toBeInTheDocument();
    expect(screen.getByTestId("flow-arrow-body-step")).toBeInTheDocument();
    expect(screen.getByTestId("flow-loopback")).toHaveTextContent("back to the test");
    expect(screen.getByTestId("flow-exit-branch")).toHaveTextContent(/break in the body/);
  });

  it("flowchart: the way-back marker is read out, with only its arrow glyph hidden", () => {
    render(<LoopTracer />);
    skip();
    const back = screen.getByTestId("flow-loopback");
    expect(back).not.toHaveAttribute("aria-hidden");
    expect(back.querySelector("[aria-hidden]")).toHaveTextContent("↑");
    expect(screen.getByTestId("test-placement")).toHaveTextContent("(§12.7.1)");
  });

  it("a loop variable chip exposes its label as an image name, so the x and z cues are read", () => {
    render(<LoopTracer preset="repeat-x" />);
    skip();
    expect(screen.getByRole("img", { name: /^n = 4'bxxxx, has x or z bits/ })).toBeInTheDocument();
  });

  it("the console can take keyboard focus and is not a second live region", () => {
    render(<LoopTracer />);
    skip();
    const log = screen.getByTestId("console");
    expect(log).toHaveAttribute("tabindex", "0");
    expect(log).toHaveAttribute("aria-live", "off");
  });

  it("the question says early-ending passes count", () => {
    render(<LoopTracer />);
    const legend = screen.getByText((_, el) => el?.tagName === "LEGEND");
    expect(legend).toHaveTextContent(PASS_DEFINITION);
  });

  it("a repeat loop, with no continue or break, leaves the pass definition out", () => {
    render(<LoopTracer preset="repeat-1101" />);
    const legend = screen.getByText((_, el) => el?.tagName === "LEGEND");
    expect(legend).not.toHaveTextContent(PASS_DEFINITION);
  });

  it("an n with x bits shows each bit with the four-state encoding", () => {
    render(<LoopTracer preset="repeat-x" />);
    skip();
    const bits = within(screen.getByTestId("loop-vars")).getByTestId("literal-bits");
    expect(Array.from(bits.querySelectorAll("[data-bit]")).map((b) => b.getAttribute("data-bit"))).toEqual(["x", "x", "x", "x"]);
    expect(screen.getByLabelText(/^n = 4'bxxxx, has x or z bits/)).toBeInTheDocument();
  });

  it("an invalid input points at its error message", () => {
    render(<LoopTracer preset="repeat-1101" />);
    const bits = screen.getByLabelText(/Bits of n/);
    expect(bits).not.toHaveAttribute("aria-describedby");
    fireEvent.change(bits, { target: { value: "1x" } });
    expect(bits).toHaveAttribute("aria-describedby", screen.getByTestId("input-error").id);
    expect(bits).toHaveAccessibleDescription(/exactly four bits/);
  });

  it("foreach: break leaves the whole loop after one printed line", () => {
    render(<LoopTracer preset="foreach-visit-order" />);
    skip();
    seekEnd();
    expect(screen.getByTestId("console")).toHaveTextContent("k=1 m=2");
    expect(screen.getByTestId("console")).not.toHaveTextContent("k=2");
  });

  it("limits the picker to the presets a lesson asks for, keeping the opening one", () => {
    render(<LoopTracer preset="repeat-x" presets={["repeat-1101", "for-x-condition"]} />);
    const picker = screen.getByLabelText("Loop") as HTMLSelectElement;
    expect(Array.from(picker.options).map((o) => o.value)).toEqual(["repeat-x", "repeat-1101", "for-x-condition"]);
  });

  it("every preset renders its prediction with exactly one correct option", () => {
    for (const p of LOOP_PRESETS) {
      const { unmount } = render(<LoopTracer preset={p.id} />);
      expect(screen.getByLabelText(answerFor(p.id))).toBeInTheDocument();
      unmount();
    }
  });
});
