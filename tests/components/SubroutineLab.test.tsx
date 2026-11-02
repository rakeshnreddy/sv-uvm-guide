import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SubroutineLab from "@/components/visuals/SubroutineLab";
import { compileBench, exploreBench, pulseBench, sendBench, sendVerdict, simulateBench, type Direction, type Lifetime, type SecondCallAt } from "@/lib/sv-subroutine-model";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const scrubToEnd = () => {
  const slider = screen.getByRole("slider", { name: /scrubber/i });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
  return slider;
};

const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));

/** Every prediction, once revealed, marks exactly one option as the answer. Returns that option's text. */
const onlyAnswer = () => {
  const marks = screen.getAllByLabelText("correct answer");
  expect(marks).toHaveLength(1);
  return (marks[0].closest("label") as HTMLElement).textContent ?? "";
};

const scrubTo = (value: number) => {
  const slider = screen.getByRole("slider", { name: /scrubber/i });
  fireEvent.change(slider, { target: { value: String(value) } });
};

describe("SubroutineLab · lifetime (send)", () => {
  it("hides the run until a prediction is locked in, then diagnoses the static bug", () => {
    render(<SubroutineLab />);
    expect(screen.getByRole("region", { name: "Subroutine lab: Where a task's variables live" })).toBeInTheDocument();
    // The code and its switch are visible before the prediction; the run is not.
    expect(screen.getByRole("switch", { name: "send is automatic" })).toBeInTheDocument();
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /playback controls/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("log")).not.toBeInTheDocument();

    lockIn(/t=10 id=1/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/no lifetime keyword, so in a module it is static/)).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/)).toBeInTheDocument();
    expect(screen.getByTestId("trace-body")).toBeInTheDocument();

    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("t=10 id=2")).toBeInTheDocument();
    expect(within(log).getByText("t=12 id=2")).toBeInTheDocument();
    expect(screen.getByTestId("box-static:send")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Call lanes/ })).toBeInTheDocument();
  });

  it("the lifetime switch lives in the code line, re-runs the model and re-asks the question", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    const lifetime = screen.getByRole("switch", { name: "send is automatic" });
    expect(lifetime).toHaveAttribute("aria-checked", "false");
    fireEvent.click(lifetime);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();

    lockIn(/t=10 id=1/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/replicates id for every activation/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "send is automatic" })).toHaveAttribute("aria-checked", "true");

    // Scrub to the step where call 2 enters (t = 2): both activations have their own box, and no shared one exists.
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    let entered = false;
    for (let i = 0; i <= max && !entered; i += 1) {
      scrubTo(i);
      entered = screen.queryByTestId("box-act:2") !== null;
    }
    expect(entered).toBe(true);
    expect(screen.getByTestId("box-act:1")).toBeInTheDocument();
    expect(screen.queryByTestId("box-static:send")).not.toBeInTheDocument();
    expect(screen.getByTestId("narration")).toHaveTextContent(/gets its own storage: id ← 2/);
  });

  it("#10 explores both legal orders and offers two outcome groups to step through", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: /#10: call 2 starts at t = 10 ns/ }));
    lockIn(/Either: it depends on the order/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/2 different outcomes/)).toBeInTheDocument();
    const cards = within(screen.getByRole("group", { name: "Outcomes across orders" })).getAllByRole("button");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(cards[1]);
    expect(cards[1]).toHaveAttribute("aria-pressed", "true");
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText(/t=10 id=[12]/)).toBeInTheDocument();
  });

  it("#12 prints correctly even when static, and says why the bug is intermittent", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: /#12/ }));
    lockIn(/t=10 id=1/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/comes and goes with timing/)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("t=22 id=2")).toBeInTheDocument();
  });

  it("adds the enter/use debug prints on request", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
    lockIn(/t=10 id=2/);
    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("t=0 enter id=1")).toBeInTheDocument();
    expect(within(log).getByText("t=10 use id=2")).toBeInTheDocument();
  });

  it("playback is keyboard operable: arrow keys step inside the controls group", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=2/);
    const group = screen.getByRole("group", { name: /playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next simulation step/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);
    fireEvent.keyDown(within(group).getByRole("button", { name: /next simulation step/i }), { key: "Home" });
    expect(slider.getAttribute("aria-valuetext")).toBe(before);
  });
});

describe("SubroutineLab · lifetime preset initializers", () => {
  it("count_ones: predicts 9 for the static function and 1 once it is automatic", () => {
    render(<SubroutineLab mode="lifetime" preset="initializers" />);
    lockIn(/^1: it counts/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/keeps the 8 the first call left behind/)).toBeInTheDocument();
    const onesSection = screen.getByRole("region", { name: "count_ones called twice" });
    const slider = within(onesSection).getByRole("slider", { name: /scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    expect(within(onesSection).getByText("count_ones(8'h01) = 9")).toBeInTheDocument();

    fireEvent.click(within(onesSection).getByRole("switch", { name: "count_ones is automatic" }));
    lockIn(/^1: it counts/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("count_calls shows the static total and the automatic this_call side by side", () => {
    render(<SubroutineLab mode="lifetime" preset="initializers" />);
    const section = screen.getByRole("region", { name: "count_calls called three times" });
    const slider = within(section).getByRole("slider", { name: /scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    expect(within(section).getByText("total=3 this_call=1")).toBeInTheDocument();
    expect(within(section).getByTestId("box-static:count_calls")).toHaveTextContent("total");
  });

  it("flags `int calls = 0;` in a static task with §6.21 and accepts static or automatic", () => {
    render(<SubroutineLab mode="lifetime" preset="initializers" />);
    const verdict = screen.getByTestId("initializer-verdict");
    expect(verdict).toHaveTextContent("int calls = 0;");
    expect(verdict).toHaveTextContent(/Compile error/);
    expect(verdict).toHaveTextContent("§6.21");
    fireEvent.change(screen.getByTestId("qualifier-select"), { target: { value: "static" } });
    expect(screen.getByTestId("initializer-verdict")).toHaveTextContent(/once, at time 0/);
    fireEvent.change(screen.getByTestId("qualifier-select"), { target: { value: "none" } });
    fireEvent.click(screen.getByRole("switch", { name: "count_calls is automatic" }));
    expect(screen.getByTestId("initializer-verdict")).toHaveTextContent(/automatic by default/);
  });
});

describe("SubroutineLab · recursion", () => {
  it("fact_static(4): predict 1, then the activation cards and the trace table follow the scrubber", () => {
    render(<SubroutineLab mode="recursion" />);
    expect(screen.getByText(/What does/)).toHaveTextContent("fact_static(4)");
    lockIn(/^24 \(4!\)/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/one shared n, overwritten by every inner call/)).toBeInTheDocument();

    const table = screen.getByTestId("recursion-table");
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    expect(within(table).getByText("copies 4 into n, calls fact_static(3)")).toBeInTheDocument();
    scrubToEnd();
    expect(within(table).getByText(/rest = 1, returns rest \* n = 1 \* 1 = 1/, { selector: "tr[aria-current='step'] td" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^box-static:fact_static/)).toHaveLength(1);
    expect(within(screen.getByTestId("log")).getByText("fact_static(4) = 1")).toBeInTheDocument();
  });

  it("automatic: four cards with their own n, and 24", () => {
    render(<SubroutineLab mode="recursion" />);
    lockIn(/^1$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "fact_static is automatic" }));
    expect(screen.getByText(/What does/)).toHaveTextContent("fact_auto(4)");
    lockIn(/^24 \(4!\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // Four activations of n = 4: at the deepest step each has its own box, and there are never more.
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    let most = 0;
    for (let i = 0; i <= max; i += 1) {
      scrubTo(i);
      most = Math.max(most, screen.queryAllByTestId(/^box-act:/).length);
    }
    expect(most).toBe(4);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("fact_auto(4) = 24")).toBeInTheDocument();
  });

  it("n = 1 is the base case: static and automatic agree, and the merged option says no inner call runs", () => {
    render(<SubroutineLab mode="recursion" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: "1" }));
    expect(screen.getByText(/What does/)).toHaveTextContent("fact_static(1)");
    expect(screen.queryByLabelText(/^1 \(1!\)/)).not.toBeInTheDocument();
    lockIn(/^1$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const staticFeedback = screen.getByText(/n = 1 is the base case/);
    expect(staticFeedback).toHaveTextContent(/fact_static\(1\) returns 1 without any recursive call/);
    expect(staticFeedback).toHaveTextContent(/lifetime makes no difference/);
    expect(staticFeedback).not.toHaveTextContent(/shared n/);

    fireEvent.click(screen.getByRole("switch", { name: "fact_static is automatic" }));
    expect(screen.getByText(/What does/)).toHaveTextContent("fact_auto(1)");
    lockIn(/^1$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/n = 1 is the base case/)).toHaveTextContent(/fact_auto\(1\) returns 1 without any recursive call/);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("fact_auto(1) = 1")).toBeInTheDocument();
  });

  it("n = 2: the first level with an inner call separates the lifetimes, and the feedback follows the lifetime", () => {
    render(<SubroutineLab mode="recursion" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: "2" }));
    lockIn(/^2 \(2!\)/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/fact_static is static: one shared n, overwritten by every inner call/)).toBeInTheDocument();
    expect(screen.getByText(/innermost call has set n to 1, so each return is rest × 1 = 1/)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("fact_static(2) = 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "fact_static is automatic" }));
    lockIn(/^2 \(2!\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Each activation keeps its own n and rest, so the returns build up to 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Why the answer holds/)).not.toBeInTheDocument();
    // Under automatic the static value 1 is the wrong answer, and its feedback names the automatic rule.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: "3" }));
    lockIn(/^1$/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/That is the static result\. An automatic function gives every activation its own n/)).toBeInTheDocument();
  });

  it("the sum_to preset returns 0 instead of 6", () => {
    render(<SubroutineLab mode="recursion" preset="sum_to" />);
    expect(screen.getByText(/What does/)).toHaveTextContent("sum_to(3)");
    lockIn(/^6 \(1/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("sum_to(3) = 0")).toBeInTheDocument();
  });
});

describe("SubroutineLab · directions", () => {
  it("predicts the lesson's two prints and draws caller and task side by side", () => {
    render(<SubroutineLab mode="directions" />);
    expect(screen.getByTestId("direction-a")).toHaveValue("input");
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();
    lockIn(/t=5 during: v_in=15 v_out=25/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Only ref aliases the caller's variable/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Caller and task storage/ })).toBeInTheDocument();
    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("t=5 during: v_in=5 v_out=5 v_io=5 v_ref=45")).toBeInTheDocument();
    expect(within(log).getByText("t=10 after: v_in=5 v_out=20 v_io=35 v_ref=45")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Caller and task storage/ })).toHaveAttribute("aria-label", expect.stringContaining("v_ref = 45"));
  });

  it("illegal choices turn rose with their clause: ref in a static task, a write to a const ref, <= to an automatic formal", () => {
    render(<SubroutineLab mode="directions" />);
    lockIn(/t=5 during: v_in=5 v_out=5 v_io=5 v_ref=45\s*t=10 after: v_in=5 v_out=20/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
    expect(screen.getByRole("alert")).toHaveTextContent("§13.5.2");
    expect(screen.getByRole("alert")).toHaveTextContent(/illegal in a subroutine with static lifetime/);
    expect(screen.getByTestId("direction-d")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "const ref" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/const ref: the subroutine may read it but a write is a compile error/);

    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "ref" } });
    fireEvent.click(screen.getByRole("switch", { name: "b uses a nonblocking assignment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("§13.3.2");
    expect(screen.getByRole("switch", { name: "b uses a nonblocking assignment" })).toHaveAttribute("aria-invalid", "true");

    // §13.5.2: <= through a ref formal is also illegal (the bound variable may be automatic), with its own clause.
    fireEvent.change(screen.getByTestId("direction-b"), { target: { value: "ref" } });
    expect(screen.getByRole("alert")).toHaveTextContent("§13.5.2");
    expect(screen.getByRole("alert")).not.toHaveTextContent("§13.3.2");
    expect(screen.getByRole("alert")).toHaveTextContent(/no nonblocking assignment through b unless the formal is declared ref static/);
    expect(screen.getByRole("switch", { name: "b uses a nonblocking assignment" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("direction-b")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "b uses a nonblocking assignment" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("decoy feedback follows the directions on screen and names each formal's current direction", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "output" } });
    // d is now an output: v_ref = 45 at t = 10 ns would need d copied in, which an output is not.
    lockIn(/t=5 during: v_in=5 v_out=5 v_io=5 v_ref=5\s*t=10 after: v_in=5 v_out=25 v_io=35 v_ref=45/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    const outputFeedback = screen.getByText(/d is output, and an output is not copied in/);
    expect(outputFeedback).toHaveTextContent(/v_ref becomes 40 at t = 10 ns, not 45/);
    expect(outputFeedback).toHaveTextContent(/b is output, and an output is not copied in/);
    expect(outputFeedback).not.toHaveTextContent(/d is v_ref itself/);
    expect(screen.queryByText(/ref is not copied/)).not.toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/).parentElement).toHaveTextContent(/d is output: it starts at the int default 0/);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("t=10 after: v_in=5 v_out=20 v_io=35 v_ref=40")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("direction-b"), { target: { value: "input" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    // b is now an input: v_out = 25 would need b copied back, which an input never is.
    lockIn(/t=10 after: v_in=15 v_out=25 v_io=35 v_ref=40/);
    expect(screen.getByText(/An input is a one-way copy\. a is input: .*; b is input: v_out is copied into b at the call and never copied back, so v_out stays 5 after the return/)).toBeInTheDocument();
    expect(screen.queryByText(/an output is not copied in/)).not.toBeInTheDocument();
    // No formal is a ref any more, so the "ref seen late" decoy is gone: the answer plus three decoys remain.
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("'Reset to the lesson's code' restores the directions, the lifetime, the operator and the single call", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "inout" } });
    fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
    fireEvent.click(screen.getByRole("switch", { name: "b uses a nonblocking assignment" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /second time/ }));
    expect(screen.getByRole("switch", { name: "show_dirs is automatic" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "b uses a nonblocking assignment" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Reset to the lesson's code" }));
    expect(screen.getByTestId("direction-a")).toHaveValue("input");
    expect(screen.getByTestId("direction-b")).toHaveValue("output");
    expect(screen.getByTestId("direction-c")).toHaveValue("inout");
    expect(screen.getByTestId("direction-d")).toHaveValue("ref");
    expect(screen.getByRole("switch", { name: "show_dirs is automatic" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "b uses a nonblocking assignment" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: /second time/ })).not.toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    lockIn(/t=5 during: v_in=5 v_out=5 v_io=5 v_ref=45\s*t=10 after: v_in=5 v_out=20/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.queryByTestId("second-call-note")).not.toBeInTheDocument();
  });

  it("a static task called twice keeps its output from the previous call", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "inout" } });
    fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /second time/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    lockIn(/t=5 during: v_in=5 v_out=5 v_io=5 v_ref=5\s*t=10 after: v_in=5 v_out=20 v_io=35 v_ref=45/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("second-call-note")).toHaveTextContent("v_out=40");
    expect(screen.getByTestId("second-call-note")).toHaveTextContent(/kept the previous call's value/);
  });

  it("preset pulse: output shows no pulse, ref shows busy=1 at 13 ns and busy=0 at 23 ns", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    lockIn(/t=23 busy=0\s*only/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/writing the value a variable already holds is no event/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Waveform of busy/ })).toBeInTheDocument();
    scrubToEnd();
    expect(screen.getByTestId("log")).toHaveTextContent("(no output yet)");

    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "ref" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/t=13 busy=1\s*then\s*t=23 busy=0/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd();
    const log = screen.getByTestId("log");
    expect(within(log).getByText("t=13 busy=1")).toBeInTheDocument();
    expect(within(log).getByText("t=23 busy=0")).toBeInTheDocument();

    // §13.5.2: `flag <= 1'b1` through the ref formal is a compile error, shown on the operator switch.
    fireEvent.click(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("§13.5.2");
    expect(screen.getByRole("alert")).toHaveTextContent(/ref static/);
    expect(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();
  });
});

describe("SubroutineLab · formals", () => {
  it("split: lo resolves to output logic [7:0], inherited from hi", () => {
    render(<SubroutineLab mode="formals" />);
    expect(screen.getByText("task automatic split(input logic [15:0] word, output logic [7:0] hi, lo);")).toBeInTheDocument();
    expect(screen.queryByTestId("resolution-strip")).not.toBeInTheDocument();
    lockIn(/^input logic \[7:0\] lo$/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/takes hi's output, not input/)).toBeInTheDocument();
    const lo = screen.getByTestId("resolved-lo");
    expect(lo).toHaveTextContent("output logic [7:0] lo");
    expect(lo).toHaveTextContent(/direction: inherited.*from hi/);
    expect(lo).toHaveTextContent(/type: inherited.*from hi/);
    // The wait-cycles strip describes a one-formal task; split has three formals and no repeat body.
    expect(screen.queryByTestId("wait-cycles-strip")).not.toBeInTheDocument();
    expect(screen.queryByText(/split\(4\)/)).not.toBeInTheDocument();
  });

  it("editing a formal re-resolves and re-asks; giving lo its own direction makes it one-bit logic", () => {
    render(<SubroutineLab mode="formals" />);
    lockIn(/^output logic \[7:0\] lo$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of lo" }), { target: { value: "output" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/^output logic lo$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("resolved-lo")).toHaveTextContent(/type: the §13.3 default/);
  });

  it("wait_cycles: n is a one-bit input logic, so 4 waits 0 cycles and 5 waits 1", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles" />);
    lockIn(/^input logic n$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const strip = screen.getByTestId("wait-cycles-strip");
    expect(strip).toHaveTextContent(/wait_cycles\(4\).*n = 0, so it waits 0 cycles/);
    expect(strip).toHaveTextContent(/wait_cycles\(5\).*n = 1, so it waits 1 cycle/);
    fireEvent.click(screen.getByRole("radio", { name: "wait_cycles_ok" }));
    lockIn(/^input int unsigned n$/);
    expect(screen.getByTestId("wait-cycles-strip")).toHaveTextContent(/wait_cycles_ok\(5\).*waits 5 cycles/);
  });

  it("add with no return type returns 1'b1 for add(2, 3)", () => {
    render(<SubroutineLab mode="formals" preset="add" />);
    lockIn(/^input int b$/);
    const strip = screen.getByTestId("return-type-strip");
    expect(strip).toHaveTextContent(/no return type written, so a one-bit logic, §13.4/);
    expect(strip).toHaveTextContent("1'b1");
    fireEvent.change(screen.getByRole("combobox", { name: "Written return type" }), { target: { value: "int" } });
    expect(screen.getByTestId("return-type-strip")).toHaveTextContent(/returns 5/);
  });
});

describe("SubroutineLab · debug (the kata)", () => {
  it("shows the lying log, diagnoses wrong suspects and confirms the right ones", () => {
    render(<SubroutineLab mode="debug" />);
    const buggy = screen.getByTestId("buggy-log");
    expect(buggy).toHaveTextContent("t=10 second");
    expect(buggy).toHaveTextContent("sum_to(3) = 0");
    const first = screen.getByTestId("symptom-second-twice");
    fireEvent.click(within(first).getByRole("button", { name: /always @\(busy\)/ }));
    expect(within(first).getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { name: /^task log_after/ }));
    expect(within(first).getByText(/Found it\./)).toBeInTheDocument();
    expect(within(first).getByText(/§13.3.2/)).toBeInTheDocument();
    const third = screen.getByTestId("symptom-no-busy");
    fireEvent.click(within(third).getByRole("button", { name: /^#1 pulse/ }));
    expect(within(third).getByText(/The direction it is received with is the problem/)).toBeInTheDocument();
  });

  it("grades the rerun against the corrected log, including decoy fixes", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for sum_to" })).getByRole("radio", { name: "add automatic" }));
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    let grade = screen.getByTestId("grade");
    expect(grade).toHaveTextContent(/Not yet/);
    expect(within(grade).getAllByText("differs")).toHaveLength(3);
    expect(within(grade).getAllByText("matches")).toHaveLength(2);

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "use <= for the write" }));
    expect(screen.queryByTestId("grade")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    grade = screen.getByTestId("grade");
    expect(grade).toHaveTextContent(/Does not compile/);
    expect(within(grade).getByTestId("grade-issues")).toHaveTextContent("§13.3.2");

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "ref instead of output" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for log_after" })).getByRole("radio", { name: "add a return type" }));
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    grade = screen.getByTestId("grade");
    expect(grade).toHaveTextContent(/A task has no return type. Nothing changes./);
    expect(grade).toHaveTextContent(/Not yet/);

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for log_after" })).getByRole("radio", { name: "add automatic" }));
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    grade = screen.getByTestId("grade");
    expect(grade).toHaveTextContent(/Passes: the log matches the corrected log/);
    expect(within(grade).getAllByText("matches")).toHaveLength(5);
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("t=23 busy=0")).toBeInTheDocument();
  });

  it("offers three hints and keeps the worked solution inside its details", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Need a hint\? \(0\/3\)/ }));
    expect(screen.getByText(/Two of the three subroutines have no lifetime keyword/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Another hint \(1\/3\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint \(2\/3\)/ }));
    expect(screen.queryByRole("button", { name: /Another hint/ })).not.toBeInTheDocument();
    const details = screen.getByText("Show the worked solution").closest("details") as HTMLDetailsElement;
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("task automatic pulse(ref logic flag);");
  });
});

describe("SubroutineLab · every prediction has exactly one right answer", () => {
  const lifetimes: Lifetime[] = ["static", "automatic"];

  it("send: lifetime × start time × debug prints, and the answer agrees with the model", () => {
    const answerPattern = { "id=1": /t=10 id=1/, "id=2": /t=10 id=2/, either: /^Either/ };
    for (const lifetime of lifetimes) {
      for (const at of [2, 10, 12] as SecondCallAt[]) {
        for (const debugPrints of [false, true]) {
          const { unmount } = render(<SubroutineLab mode="lifetime" />);
          if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
          fireEvent.click(screen.getByRole("radio", { name: new RegExp(`#${at}: call 2 starts`) }));
          if (debugPrints) fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
          reveal();
          const verdict = sendVerdict(exploreBench(sendBench({ lifetime, secondCallAt: at, debugPrints })));
          expect(onlyAnswer()).toMatch(answerPattern[verdict]);
          unmount();
        }
      }
    }
  });

  it("pulse: lifetime × direction × operator, each with feedback written for that direction", () => {
    const answerPattern = (log: string[]) => (log.length === 0 ? /^Nothing/ : log.length === 2 ? /t=13 busy=1\s*then/ : /t=23 busy=1\s*only/);
    let legal = 0;
    for (const lifetime of lifetimes) {
      for (const direction of ["input", "output", "inout", "ref", "const ref"] as Direction[]) {
        for (const nba of [false, true]) {
          const { unmount } = render(<SubroutineLab mode="directions" preset="pulse" />);
          if (lifetime === "static") fireEvent.click(screen.getByRole("switch", { name: "pulse is automatic" }));
          fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: direction } });
          if (nba) fireEvent.click(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" }));
          const bench = pulseBench({ lifetime, direction, nba });
          if (compileBench(bench).length) {
            expect(screen.getByRole("alert")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /reveal without predicting/i })).not.toBeInTheDocument();
          } else {
            legal += 1;
            reveal();
            expect(onlyAnswer()).toMatch(answerPattern(simulateBench(bench).log.map((l) => l.text)));
            const why = screen.getByText(/Why the answer holds/).parentElement as HTMLElement;
            if (direction === "input") expect(why).toHaveTextContent(/flag is an input/);
            if (direction === "input") expect(why).not.toHaveTextContent(/copied out at t = 23/);
          }
          unmount();
        }
      }
    }
    // input, output and inout under = in both lifetimes, ref under = when automatic, and input, output and inout under <= when static.
    expect(legal).toBe(10);
  });

  it("recursion: preset × lifetime × n", () => {
    for (const preset of ["fact", "sum_to"]) {
      for (const lifetime of lifetimes) {
        for (const n of [1, 2, 3, 4, 5]) {
          const { unmount } = render(<SubroutineLab mode="recursion" preset={preset} />);
          fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: String(n) }));
          if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: /is automatic$/ }));
          reveal();
          onlyAnswer();
          unmount();
        }
      }
    }
  });

  it("directions: lifetime × each formal's direction × operator", () => {
    for (const lifetime of lifetimes) {
      for (const formal of ["a", "b", "c", "d"]) {
        for (const direction of ["input", "output", "inout", "ref"] as Direction[]) {
          for (const nba of [false, true]) {
            const { unmount } = render(<SubroutineLab mode="directions" />);
            // ref is illegal in a static task, so d steps aside for this sweep unless it is the formal under test.
            if (formal !== "d") fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "inout" } });
            fireEvent.change(screen.getByTestId(`direction-${formal}`), { target: { value: direction } });
            if (lifetime === "static") fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
            if (nba) fireEvent.click(screen.getByRole("switch", { name: "b uses a nonblocking assignment" }));
            if (screen.queryByRole("alert")) {
              expect(screen.queryByRole("button", { name: /reveal without predicting/i })).not.toBeInTheDocument();
            } else {
              reveal();
              onlyAnswer();
            }
            unmount();
          }
        }
      }
    }
  });

  it("count_ones: both lifetimes", () => {
    for (const lifetime of lifetimes) {
      const { unmount } = render(<SubroutineLab mode="lifetime" preset="initializers" />);
      const section = screen.getByRole("region", { name: "count_ones called twice" });
      if (lifetime === "automatic") fireEvent.click(within(section).getByRole("switch", { name: "count_ones is automatic" }));
      reveal();
      expect(onlyAnswer()).toMatch(lifetime === "static" ? /^9/ : /^1/);
      unmount();
    }
  });

  it("formals: every signature and every formal", () => {
    for (const preset of ["split", "wait_cycles", "wait_cycles_ok", "add"]) {
      const { unmount } = render(<SubroutineLab mode="formals" preset={preset} />);
      const formals = within(screen.getByRole("radiogroup", { name: "Formal to predict" })).getAllByRole("radio");
      formals.forEach((formal) => {
        fireEvent.click(formal);
        reveal();
        onlyAnswer();
      });
      unmount();
    }
  });
});

describe("SubroutineLab · send with the debug prints", () => {
  const automaticTieWithDebug = () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
    fireEvent.click(screen.getByRole("radio", { name: /#10: call 2 starts/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
  };

  it("automatic, #10, debug: id=1 is right, and the outcome cards say only the log order differs", () => {
    automaticTieWithDebug();
    lockIn(/t=10 id=1/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const cards = within(screen.getByRole("group", { name: "Outcomes across orders" })).getAllByRole("button");
    expect(cards).toHaveLength(2);
    cards.forEach((card) => {
      expect(card).toHaveTextContent(/call 1 prints id=1 \(log order only/);
      expect(card).not.toHaveTextContent(/call 1 prints id=2/);
    });
    const group = screen.getByRole("group", { name: "Outcomes across orders" });
    expect(group).toHaveTextContent(/Only the order of the log lines differs/);
    expect(group).not.toHaveTextContent(/shared id/);
  });

  it("the 'Either' feedback for automatic does not call itself right or contradict the answer", () => {
    automaticTieWithDebug();
    lockIn(/^Either/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/can change which log line comes first, but not what call 1 prints/)).toBeInTheDocument();
  });

  it("static, #10, debug: the shared-id note stays, and the cards name id=1 and id=2", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: /#10: call 2 starts/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
    lockIn(/^Either/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Outcomes across orders" });
    expect(group).toHaveTextContent(/copies 2 into the shared id/);
    const names = within(group).getAllByRole("button").map((card) => card.textContent ?? "");
    expect(names.some((n) => n.includes("call 1 prints id=1"))).toBe(true);
    expect(names.some((n) => n.includes("call 1 prints id=2"))).toBe(true);
    expect(names.some((n) => n.includes("log order only"))).toBe(false);
  });

  it("ticking the debug prints re-asks a locked-in prediction", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=2/);
    expect(screen.getByTestId("trace-body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
    expect(screen.queryByTestId("trace-body")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("the log keeps the lesson's spacing", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
    lockIn(/t=10 id=2/);
    scrubToEnd();
    const line = within(screen.getByTestId("log")).getByText("t=10 use id=2");
    expect(line.textContent).toBe("t=10 use   id=2");
    expect(line).toHaveClass("whitespace-pre-wrap");
  });
});

describe("SubroutineLab · nothing before the reveal gives the answer away", () => {
  const code = () => screen.getAllByRole("list", { name: "Code under simulation" })[0];

  it.each([
    ["recursion", undefined, ["reads n after the call", "every return multiplies", "Static (module default)", "one shared n"]],
    ["directions", undefined, ["d IS the caller", "b starts at 0", "c is a copy", "never sees this"]],
    ["lifetime", "initializers", ["set to 0 once", "remembers", "a fresh 0"]],
    ["directions", "pulse", ["Raises flag"]],
    ["lifetime", undefined, ["while call 1 is still waiting"]],
  ] as const)("%s %s", (mode, preset, leaks) => {
    const { container } = render(<SubroutineLab mode={mode} preset={preset} />);
    leaks.forEach((leak) => expect(container.textContent).not.toContain(leak));
    // The first code panel has a prediction under it; the initializers preset's later count_calls panel has none and keeps its comments.
    expect(code()).not.toHaveTextContent("//");
  });

  it("the code's comments appear on a commit and on a skip, and leave when the prompt re-arms", () => {
    render(<SubroutineLab mode="recursion" />);
    expect(code()).not.toHaveTextContent("reads n after the call");
    lockIn(/^1$/);
    expect(code()).toHaveTextContent("reads n after the call");
    // A new n is a new question.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: "3" }));
    expect(code()).not.toHaveTextContent("reads n after the call");
    reveal();
    expect(code()).toHaveTextContent("reads n after the call");
    // Back to a key answered before: asked again, so hidden again.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: "4" }));
    expect(code()).not.toHaveTextContent("reads n after the call");
  });

  it("a lab with no prediction keeps its comments", () => {
    render(<SubroutineLab mode="lifetime" preset="initializers" />);
    const section = screen.getByRole("region", { name: "count_calls called three times" });
    expect(section).toHaveTextContent("initialized once, at time 0; keeps counting");
  });
});

describe("SubroutineLab · focus stays on the control that was used", () => {
  const stays = (control: HTMLElement, use: () => void) => {
    control.focus();
    use();
    expect(control).toBeInTheDocument();
    expect(document.activeElement).toBe(control);
  };

  it("show_dirs: the lifetime switch, across legal and illegal", () => {
    render(<SubroutineLab mode="directions" />);
    const lifetime = screen.getByRole("switch", { name: "show_dirs is automatic" });
    stays(lifetime, () => fireEvent.click(lifetime));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    stays(lifetime, () => fireEvent.click(lifetime));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("show_dirs: a direction select moved to const ref, and the <= switch", () => {
    render(<SubroutineLab mode="directions" />);
    const select = screen.getByTestId("direction-d");
    stays(select, () => fireEvent.change(select, { target: { value: "const ref" } }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "ref" } });
    const operator = screen.getByRole("switch", { name: "b uses a nonblocking assignment" });
    stays(operator, () => fireEvent.click(operator));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("pulse: the direction select and the <= switch", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    const select = screen.getByTestId("direction-flag");
    stays(select, () => fireEvent.change(select, { target: { value: "const ref" } }));
    fireEvent.change(select, { target: { value: "output" } });
    const operator = screen.getByRole("switch", { name: "flag uses a nonblocking assignment" });
    stays(operator, () => fireEvent.click(operator));
  });

  it("recursion: the switch keeps focus even though the function changes its name", () => {
    render(<SubroutineLab mode="recursion" />);
    const lifetime = screen.getByRole("switch", { name: "fact_static is automatic" });
    stays(lifetime, () => fireEvent.click(lifetime));
    expect(lifetime).toHaveAccessibleName("fact_auto is automatic");
    expect(lifetime).toHaveAttribute("aria-checked", "true");
    lockIn(/^24/);
    stays(lifetime, () => fireEvent.click(lifetime));
  });

  it("a revealed lab: comments returning do not remount the line above them", () => {
    render(<SubroutineLab mode="recursion" />);
    const lifetime = screen.getByRole("switch", { name: "fact_static is automatic" });
    lifetime.focus();
    reveal();
    expect(screen.getByRole("switch", { name: "fact_static is automatic" })).toBe(lifetime);
  });
});

describe("SubroutineLab · screen readers", () => {
  it("stepping is announced by a region mounted before the reveal", () => {
    render(<SubroutineLab mode="lifetime" />);
    const live = screen.getByTestId("step-live");
    expect(live).toHaveAttribute("role", "status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    lockIn(/t=10 id=2/);
    expect(screen.getByTestId("step-live")).toBe(live);
    expect(live).toHaveTextContent(/t = 0 ns/);
    expect(live).toHaveTextContent(/Why:/);
    const before = live.textContent;
    fireEvent.click(screen.getByRole("button", { name: /next simulation step/i }));
    expect(screen.getByTestId("step-live")).toBe(live);
    expect(live.textContent).not.toBe(before);
    expect(live.textContent).toContain(screen.getByTestId("narration").querySelector("p")?.textContent ?? "(no text)");
  });

  it("during playback the region reads the step, not its explanation", () => {
    vi.useFakeTimers();
    try {
      render(<SubroutineLab mode="lifetime" />);
      lockIn(/t=10 id=2/);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByTestId("step-live")).not.toHaveTextContent(/Why:/);
      expect(screen.getByTestId("step-live")).not.toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the suspect and grade live regions are mounted while empty and filled on change", () => {
    render(<SubroutineLab mode="debug" />);
    const suspect = screen.getByTestId("suspect-live-second-twice");
    const grade = screen.getByTestId("grade-live");
    expect(suspect).toHaveAttribute("aria-live", "polite");
    expect(grade).toHaveAttribute("aria-live", "polite");
    expect(suspect).toBeEmptyDOMElement();
    expect(grade).toBeEmptyDOMElement();
    fireEvent.click(within(screen.getByTestId("symptom-second-twice")).getByRole("button", { name: /^task log_after/ }));
    expect(screen.getByTestId("suspect-live-second-twice")).toBe(suspect);
    expect(suspect).toHaveTextContent(/Found it\./);
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    expect(screen.getByTestId("grade-live")).toBe(grade);
    expect(grade).toHaveTextContent(/Not yet/);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "ref instead of output" }));
    expect(screen.getByTestId("grade-live")).toBe(grade);
    expect(grade).toBeEmptyDOMElement();
  });

  it("the switch's visible word is in its accessible name, and the issue list stays a list", () => {
    render(<SubroutineLab mode="directions" />);
    const lifetime = screen.getByRole("switch", { name: "show_dirs is automatic" });
    expect(lifetime).toHaveTextContent(/automatic$/);
    fireEvent.click(lifetime);
    expect(lifetime).toHaveTextContent(/automatic$/);
    expect(within(screen.getByRole("alert")).getByRole("list")).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("the ref chip describes itself in text, not in aria-label on a span", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "ref" } });
    reveal();
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    let chip: HTMLElement | null = null;
    for (let i = 0; i <= max && !chip; i += 1) {
      scrubTo(i);
      chip = screen.queryByText(/flag is a ref to busy: one variable, two names/);
    }
    expect(chip).toHaveClass("sr-only");
  });
});

describe("SubroutineLab · wide pictures at 390 px", () => {
  const original = Object.getOwnPropertyDescriptors(HTMLElement.prototype);
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", original.scrollWidth ?? { configurable: true, value: 0 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", original.clientWidth ?? { configurable: true, value: 0 });
  });

  it("the diagram and the lanes are never drawn below 0.9 scale", () => {
    const { unmount } = render(<SubroutineLab mode="directions" />);
    reveal();
    const diagram = screen.getByRole("img", { name: /Caller and task storage/ });
    expect(diagram).toHaveClass("min-w-[470px]");
    expect(470 / 520).toBeGreaterThanOrEqual(0.9);
    unmount();
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    scrubToEnd();
    const lanes = screen.getByRole("img", { name: /Call lanes/ });
    expect(lanes).toHaveClass("min-w-[380px]");
    expect(380 / 420).toBeGreaterThanOrEqual(0.9);
  });

  it("a frame that overflows is a named, focusable region; one that fits is not a tab stop", () => {
    const { unmount } = render(<SubroutineLab mode="recursion" />);
    reveal();
    expect(screen.queryByRole("region", { name: /Scrollable: recursion trace table/ })).not.toBeInTheDocument();
    unmount();
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 600 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 300 });
    render(<SubroutineLab mode="recursion" />);
    reveal();
    expect(screen.getByRole("region", { name: "Scrollable: recursion trace table" })).toHaveAttribute("tabindex", "0");
  });
});

describe("SubroutineLab · text that follows the learner's edits", () => {
  const secondCall = (lifetime: Lifetime, b: Direction) => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "inout" } });
    fireEvent.change(screen.getByTestId("direction-b"), { target: { value: b } });
    if (lifetime === "static") fireEvent.click(screen.getByRole("switch", { name: "show_dirs is automatic" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /second time/ }));
    reveal();
    return screen.getByTestId("second-call-note");
  };

  it("the second-call note per direction of b, automatic", () => {
    const output = secondCall("automatic", "output");
    expect(output).toHaveTextContent("v_out=20");
    expect(output).toHaveTextContent(/Output b restarted at 0, so the second call added the same 20 again: v_out = 20/);
  });

  it("the second-call note: b inout (automatic), with no talk of an output b", () => {
    const note = secondCall("automatic", "inout");
    expect(note).toHaveTextContent("v_out=45");
    expect(note).toHaveTextContent(/Inout b copied in v_out's 25 and added 20 to it: v_out = 45/);
    expect(note).not.toHaveTextContent(/Output b/);
  });

  it("the second-call note: b input (static), v_out stays 5", () => {
    const note = secondCall("static", "input");
    expect(note).toHaveTextContent("v_out=5");
    expect(note).toHaveTextContent(/Input b is never copied back: v_out stays 5/);
    expect(note).not.toHaveTextContent(/kept the previous call's value/);
  });

  it("the second-call note: b ref (automatic)", () => {
    expect(secondCall("automatic", "ref")).toHaveTextContent(/Ref b is v_out itself, so the second call added 20 to it directly: v_out = 45/);
  });

  it("the second-call note: b inout (static) reads the same copy-in rule", () => {
    expect(secondCall("static", "inout")).toHaveTextContent(/Inout b copied in v_out's 25 and added 20 to it: v_out = 45/);
  });

  it("the second-call note names other outputs too", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-d"), { target: { value: "output" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /second time/ }));
    reveal();
    const note = screen.getByTestId("second-call-note");
    expect(note).toHaveTextContent(/Output d restarted at 0, so the second call added the same 40 again: v_ref = 40/);
  });

  it("one click loads the static task called twice", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.click(screen.getByRole("button", { name: "Static, called twice" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "show_dirs is automatic" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("direction-d")).toHaveValue("inout");
    expect(screen.getByRole("checkbox", { name: /second time/ })).toBeChecked();
    reveal();
    expect(screen.getByTestId("second-call-note")).toHaveTextContent(/kept the previous call's value/);
    expect(screen.getByTestId("second-call-note")).toHaveTextContent("v_out=40");
  });

  it("the diagram's caption describes the dashed copy-out it draws", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    expect(screen.getByText(/Dashed arrow: a copy out still waiting for the return/)).toBeInTheDocument();
  });

  it("pulse, static, output, <=: the copy-out carries the old 1", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.click(screen.getByRole("switch", { name: "pulse is automatic" }));
    fireEvent.click(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" }));
    lockIn(/t=23 busy=1\s*only/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/the copy-out carries the old 1/)).toHaveTextContent("§4.4.2.4");
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("t=23 busy=1")).toBeInTheDocument();
  });

  it("pulse, input: nothing is copied out, and no text says otherwise", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "input" } });
    lockIn(/t=23 busy=0\s*only/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    const feedback = screen.getByText(/An input is never copied out, so no 0 reaches busy/);
    expect(feedback).toBeInTheDocument();
    const why = screen.getByText(/Why the answer holds/).parentElement as HTMLElement;
    expect(why).toHaveTextContent(/nothing is ever copied out/);
    expect(why).not.toHaveTextContent(/final 0 is copied out/);
  });

  it("add(2, 3) follows the formals: a one-bit a stores 0, so the sum is 3", () => {
    render(<SubroutineLab mode="formals" preset="add" />);
    reveal();
    expect(screen.getByTestId("return-type-strip")).toHaveTextContent(/computes 5 and returns 1'b1, the low bit of 5/);
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of a" }), { target: { value: "" } });
    reveal();
    const strip = screen.getByTestId("return-type-strip");
    expect(strip).toHaveTextContent(/a = 0 \(2 truncated to a logic, §10.7\) and b = 3, computes 3 and returns 1'b1, the low bit of 3/);
    fireEvent.change(screen.getByRole("combobox", { name: "Written return type" }), { target: { value: "int" } });
    expect(screen.getByTestId("return-type-strip")).toHaveTextContent(/computes 3 and returns 3\./);
  });

  it.each([
    ["output", "§13.5"],
    ["inout", "§13.5"],
    ["ref", "§13.5.2"],
  ] as const)("add(2, 3) with a as %s is a compile error, %s", (direction, clause) => {
    render(<SubroutineLab mode="formals" preset="add" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of a" }), { target: { value: direction } });
    reveal();
    const strip = screen.getByTestId("return-type-strip");
    expect(within(strip).getByRole("alert")).toHaveTextContent(`Compile error (${clause})`);
    expect(strip).not.toHaveTextContent(/computes/);
  });

  it.each([
    ["output", "§13.5"],
    ["inout", "§13.5"],
    ["ref", "§13.5.2"],
  ] as const)("wait_cycles(4) with n as %s is a compile error, %s, not a cycle count", (direction, clause) => {
    render(<SubroutineLab mode="formals" preset="wait_cycles" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of n" }), { target: { value: direction } });
    reveal();
    const strip = screen.getByTestId("wait-cycles-strip");
    expect(within(strip).getByRole("alert")).toHaveTextContent(`Compile error (${clause})`);
    expect(strip).not.toHaveTextContent(/waits/);
  });
});

describe("SubroutineLab · the header and lanes match the lab on screen", () => {
  it.each([
    ["lifetime", "initializers", "Initializers in static subroutines", /call 1/],
    ["recursion", "sum_to", "Recursion in the kata's sum_to", /multipl/],
    ["directions", "pulse", "pulse(busy): output or ref", /Every direction is a control/],
  ] as const)("%s %s", (mode, preset, title, wrong) => {
    render(<SubroutineLab mode={mode} preset={preset} />);
    const region = screen.getByRole("region", { name: `Subroutine lab: ${title}` });
    const header = within(region).getByRole("heading", { name: title }).parentElement as HTMLElement;
    expect(header.textContent).not.toMatch(wrong);
  });

  it("the kata's lanes name the task, so log_after's call and pulse's call read apart", () => {
    render(<SubroutineLab mode="debug" />);
    const section = screen.getByRole("region", { name: "Step 3: watch the bench run" });
    const slider = within(section).getByRole("slider", { name: /scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    const lanes = within(section).getByRole("img", { name: /Call lanes/ });
    const labels = [...lanes.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["log_after 1", "log_after 2"]));
    expect(lanes.getAttribute("aria-label")).toContain("log_after 1");
    expect(labels).not.toContain("call 1");
  });

  it("the send lab, with one task, keeps the plain call labels", () => {
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    scrubToEnd();
    const labels = [...screen.getByRole("img", { name: /Call lanes/ }).querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["call 1", "call 2"]));
  });
});
