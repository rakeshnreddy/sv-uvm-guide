import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SubroutineLab from "@/components/visuals/SubroutineLab";
import { compileBench, exploreBench, factBench, pulseBench, recursionTable, sendBench, sendVerdict, simulateBench, sumToBench, type Direction, type Lifetime, type SecondCallAt } from "@/lib/sv-subroutine-model";

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

/** Where the right answer sits among its prompt's options. Call after a reveal; `which` picks among revealed prompts. */
const answerIndex = (which = 0) => {
  const label = screen.getAllByLabelText("correct answer")[which].closest("label") as HTMLElement;
  return [...(label.parentElement as HTMLElement).children].indexOf(label);
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
    lockIn(/t=10 use\s+id=2/);
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
    expect(screen.getByText(/innermost call has set n to 1, so each of those returns is rest × 1 = 1/)).toBeInTheDocument();
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
    expect(screen.getByRole("alert")).toHaveTextContent(/const ref: the subroutine may read it, but a write with = or <= is a compile error/);

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

  it("wait_cycles: predicts n's type, then the cycles wait_cycles(5) waits, and only then shows the counts", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles" />);
    expect(screen.queryByText(/How long does/)).not.toBeInTheDocument();
    lockIn(/^input logic n$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/How long does/)).toBeInTheDocument();
    expect(screen.queryByTestId("wait-cycles-strip")).not.toBeInTheDocument();
    lockIn(/^5 cycles$/);
    expect(screen.getByText(/5 does not fit in a logic/)).toHaveTextContent("§10.7");
    const strip = screen.getByTestId("wait-cycles-strip");
    expect(strip).toHaveTextContent(/wait_cycles\(4\).*n = 0, so it waits 0 cycles/);
    expect(strip).toHaveTextContent(/wait_cycles\(5\).*n = 1, so it waits 1 cycle/);
  });

  it.each([
    ["1 cycle", /^1 cycle$/, true, /stores 5 into the logic n: n = 1, so it waits 1 cycle/],
    ["0 cycles", /^0 cycles$/, false, /wait_cycles\(4\) is the call that waits 0 cycles/],
    ["a compile error", /^A compile error$/, false, /a formal too narrow for it is legal too/],
  ] as const)("wait_cycles(5), predicting %s", (_name, pick, right, text) => {
    render(<SubroutineLab mode="formals" preset="wait_cycles" />);
    reveal();
    lockIn(pick);
    expect(screen.getByText(right ? /^Correct\./ : /^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("wait_cycles_ok: n is fully written, so the only question is the wait, and it is 5 cycles", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles_ok" />);
    expect(screen.queryByText(/What direction and type/)).not.toBeInTheDocument();
    expect(screen.getByTestId("resolved-n")).toHaveTextContent("input int unsigned n");
    expect(screen.queryByTestId("wait-cycles-strip")).not.toBeInTheDocument();
    lockIn(/^1 cycle$/);
    expect(screen.getByText(/One cycle is what a one-bit n would give/)).toBeInTheDocument();
    expect(screen.getByTestId("wait-cycles-strip")).toHaveTextContent(/wait_cycles_ok\(5\).*waits 5 cycles/);
  });

  it("add: the formals are written, so the prediction is what add(2, 3) returns, and it gates the result", () => {
    render(<SubroutineLab mode="formals" preset="add" />);
    expect(screen.queryByText(/What direction and type/)).not.toBeInTheDocument();
    expect(screen.getByText(/What does/)).toHaveTextContent("add(2, 3)");
    expect(screen.getByTestId("resolved-b")).toHaveTextContent("input int b");
    expect(screen.queryByTestId("return-type-strip")).not.toBeInTheDocument();
    lockIn(/^5$/);
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/5 is what a \+ b computes/)).toHaveTextContent("§13.4");
    const strip = screen.getByTestId("return-type-strip");
    expect(strip).toHaveTextContent(/no return type written, so a one-bit logic, §13.4/);
    expect(strip).toHaveTextContent("1'b1");
    // The return type is a control outside the gate, so changing it keeps focus and asks again.
    const select = screen.getByRole("combobox", { name: "Written return type" });
    select.focus();
    fireEvent.change(select, { target: { value: "int" } });
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Written return type" }));
    expect(screen.queryByTestId("return-type-strip")).not.toBeInTheDocument();
    lockIn(/^5$/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("return-type-strip")).toHaveTextContent(/returns 5/);
  });

  it.each([
    [/^1'b1$/, true, /only its low bit comes back: 1'b1/],
    [/^1'b0$/, false, /5 is odd, so 1'b1, not 1'b0/],
    [/^A compile error$/, false, /A function with no return type is legal/],
  ] as const)("add(2, 3) option %s has feedback generated from the call", (pick, right, text) => {
    render(<SubroutineLab mode="formals" preset="add" />);
    lockIn(pick);
    expect(screen.getByText(right ? /^Correct\./ : /^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("a function's formal rules cite §13.4 in the feedback and in the strip; a task's cite §13.3", () => {
    render(<SubroutineLab mode="formals" preset="add" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of b" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of b" }), { target: { value: "" } });
    // b now inherits, so it is a question: a wrong direction is diagnosed, and every citation is §13.4.
    lockIn(/^output int b$/);
    const prompt = (screen.getByText(/^Not quite\./).parentElement as HTMLElement).parentElement as HTMLElement;
    expect(prompt).toHaveTextContent("(§13.4)");
    expect(prompt).not.toHaveTextContent("§13.3");
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of a" }), { target: { value: "" } });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Formal to predict" })).getByRole("radio", { name: "a" }));
    reveal();
    expect(screen.getByTestId("resolved-a")).toHaveTextContent(/type: the §13.4 default/);
    expect(screen.getByTestId("resolution-strip")).not.toHaveTextContent("§13.3");
  });

  it("only a formal with something unwritten is offered as a question", () => {
    render(<SubroutineLab mode="formals" />);
    expect(screen.queryByRole("radiogroup", { name: "Formal to predict" })).not.toBeInTheDocument();
    expect(screen.getByText(/What direction and type/)).toHaveTextContent("lo");
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of hi" }), { target: { value: "" } });
    const picker = screen.getByRole("radiogroup", { name: "Formal to predict" });
    expect(within(picker).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? r.textContent)).toEqual(["hi", "lo"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of hi" }), { target: { value: "logic [7:0]" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of lo" }), { target: { value: "output" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Written type of lo" }), { target: { value: "int" } });
    expect(screen.queryByText(/What direction and type/)).not.toBeInTheDocument();
    expect(screen.getByTestId("resolved-lo")).toHaveTextContent(/type: written/);
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
    expect(within(first).getByText(/§13\.3\.1, §13\.3\.2/)).toBeInTheDocument();
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

    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "pass by ref" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for log_after" })).getByRole("radio", { name: "add a return type" }));
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    grade = screen.getByTestId("grade");
    // §13.3: a task declaration has no place for a return type, so this decoy stops the bench compiling.
    expect(grade).toHaveTextContent(/Does not compile/);
    expect(within(grade).getByTestId("grade-issues")).toHaveTextContent(/§13\.3\).*a task declaration has no return type, so this does not compile/);
    expect(grade).not.toHaveTextContent(/Nothing changes/);
    expect(screen.getByTestId("bench-issues")).toHaveTextContent("§13.3");
    expect(screen.getByRole("list", { name: /The bench, with your fixes/ })).toHaveTextContent("task int log_after(input int delay_ns, input string msg);");

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
    expect(screen.getByText(/Two of the three subroutines have no lifetime keyword/)).toHaveTextContent("(§13.3.1, §13.3.2, §13.4.2)");
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
    // The option shows the line the code on screen prints, spacing included.
    const answerPattern = (verdict: "id=1" | "id=2" | "either", debugPrints: boolean) => (verdict === "either" ? /^Either/ : new RegExp(`^t=10 ${debugPrints ? "use   " : ""}${verdict}:`));
    for (const lifetime of lifetimes) {
      for (const at of [2, 10, 12] as SecondCallAt[]) {
        for (const debugPrints of [false, true]) {
          const { unmount } = render(<SubroutineLab mode="lifetime" />);
          if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
          fireEvent.click(screen.getByRole("radio", { name: new RegExp(`#${at}: call 2 starts`) }));
          if (debugPrints) fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
          reveal();
          const verdict = sendVerdict(exploreBench(sendBench({ lifetime, secondCallAt: at, debugPrints })));
          expect(onlyAnswer()).toMatch(answerPattern(verdict, debugPrints));
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

  it("formals: every signature, through every prompt it asks", () => {
    const promptsOf = { split: 1, wait_cycles: 2, wait_cycles_ok: 1, add: 1 };
    for (const [preset, prompts] of Object.entries(promptsOf)) {
      const { unmount } = render(<SubroutineLab mode="formals" preset={preset} />);
      for (let i = 1; i <= prompts; i += 1) {
        reveal();
        expect(screen.getAllByLabelText("correct answer")).toHaveLength(i);
      }
      expect(screen.queryByRole("button", { name: /reveal without predicting/i })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("formals: a formal with its direction and type edited still has one answer, in every return type", () => {
    for (const direction of ["", "input", "output", "inout", "ref"]) {
      for (const type of ["", "int", "logic", "logic [7:0]"]) {
        for (const returnType of ["", "int"]) {
          const { unmount } = render(<SubroutineLab mode="formals" preset="add" />);
          fireEvent.change(screen.getByRole("combobox", { name: "Written direction of a" }), { target: { value: direction } });
          fireEvent.change(screen.getByRole("combobox", { name: "Written type of a" }), { target: { value: type } });
          fireEvent.change(screen.getByRole("combobox", { name: "Written return type" }), { target: { value: returnType } });
          let answered = 0;
          while (screen.queryByRole("button", { name: /reveal without predicting/i })) {
            reveal();
            answered += 1;
            expect(screen.getAllByLabelText("correct answer")).toHaveLength(answered);
          }
          expect(answered).toBeGreaterThan(0);
          unmount();
        }
      }
    }
  });
});

describe("SubroutineLab · the right answer's position says nothing", () => {
  const notBiased = (positions: number[]) => {
    expect(positions.length).toBeGreaterThan(1);
    expect(new Set(positions).size).toBeGreaterThan(1);
    // A learner picking the same slot every time does no better than chance would on three or four options.
    const counts = [...new Set(positions)].map((p) => positions.filter((x) => x === p).length);
    expect(Math.max(...counts) / positions.length).toBeLessThan(0.6);
  };

  it("directions: every combination of the four directions", () => {
    render(<SubroutineLab mode="directions" />);
    const dirs: Direction[] = ["input", "output", "inout", "ref"];
    const positions: number[] = [];
    for (const a of dirs) {
      fireEvent.change(screen.getByTestId("direction-a"), { target: { value: a } });
      for (const b of dirs) {
        fireEvent.change(screen.getByTestId("direction-b"), { target: { value: b } });
        for (const c of dirs) {
          fireEvent.change(screen.getByTestId("direction-c"), { target: { value: c } });
          for (const d of dirs) {
            fireEvent.change(screen.getByTestId("direction-d"), { target: { value: d } });
            reveal();
            positions.push(answerIndex());
          }
        }
      }
    }
    expect(positions).toHaveLength(256);
    notBiased(positions);
  }, 60000);

  it("formals: every signature, with each formal's written direction and type edited", () => {
    const positions: number[] = [];
    const formalsOf = { split: ["word", "hi", "lo"], wait_cycles: ["n"], wait_cycles_ok: ["n"], add: ["a", "b"] };
    for (const [preset, formals] of Object.entries(formalsOf)) {
      for (const formal of formals) {
        const { unmount } = render(<SubroutineLab mode="formals" preset={preset} />);
        for (const direction of ["", "input", "output", "inout", "ref"]) {
          for (const type of ["", "int", "logic", "logic [7:0]"]) {
            fireEvent.change(screen.getByRole("combobox", { name: `Written direction of ${formal}` }), { target: { value: direction } });
            fireEvent.change(screen.getByRole("combobox", { name: `Written type of ${formal}` }), { target: { value: type } });
            if (screen.queryByText(/What direction and type/)) {
              fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[0]);
              positions.push(answerIndex());
            }
          }
        }
        unmount();
      }
    }
    notBiased(positions);
  }, 60000);

  it("the lesson's own formals questions do not all sit in one slot", () => {
    const positions: number[] = [];
    for (const preset of ["split", "wait_cycles"]) {
      const { unmount } = render(<SubroutineLab mode="formals" preset={preset} />);
      reveal();
      positions.push(answerIndex());
      unmount();
    }
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it("recursion: the values run in ascending order, with the compile error last", () => {
    for (const preset of ["fact", "sum_to"]) {
      for (const lifetime of ["static", "automatic"]) {
        const { unmount } = render(<SubroutineLab mode="recursion" preset={preset} />);
        if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: /is automatic$/ }));
        const legend = screen.getByText(/^What does/).closest("fieldset") as HTMLElement;
        const labels = within(legend).getAllByRole("radio").map((r) => (r.closest("label") as HTMLElement).textContent ?? "");
        const values = labels.slice(0, -1).map((text) => parseInt(text, 10));
        expect(values).toEqual([...values].sort((x, y) => x - y));
        expect(labels[labels.length - 1]).toMatch(/compile error/);
        unmount();
      }
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
    lockIn(/t=10 use\s+id=1/);
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

  it("automatic, #10, no debug prints: 'Either' says the order changes nothing, as the one outcome beside it shows", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
    fireEvent.click(screen.getByRole("radio", { name: /#10: call 2 starts/ }));
    expect(screen.getByRole("checkbox", { name: /debug prints/ })).not.toBeChecked();
    lockIn(/^Either/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.queryByText(/which log line comes first/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "The order of the two processes at t = 10 ns changes nothing here: call 1 prints its own copy, which only call 1 ever wrote, and call 2 prints only at t = 20 ns (§13.3.2).",
      ),
    ).toBeInTheDocument();
    // The outcome cards agree: one outcome, whatever the order.
    const group = screen.getByRole("group", { name: "Outcomes across orders" });
    expect(within(group).getAllByRole("button")).toHaveLength(1);
    expect(group).not.toHaveTextContent(/log order only/);
  });

  it("static, #10: the id=2 feedback names the order it needs, with and without the debug prints", () => {
    for (const debug of [false, true]) {
      const { unmount } = render(<SubroutineLab mode="lifetime" />);
      fireEvent.click(screen.getByRole("radio", { name: /#10: call 2 starts/ }));
      if (debug) fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
      lockIn(debug ? /t=10 use\s+id=2/ : /t=10 id=2/);
      expect(screen.getByText("Possible, but only if call 2's copy-in runs before call 1's print; §4.7 leaves that order open.")).toBeInTheDocument();
      expect(screen.queryByText(/one of the two orders/)).not.toBeInTheDocument();
      unmount();
    }
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
    lockIn(/t=10 use\s+id=2/);
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
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "pass by ref" }));
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

  it("the diagram's caption describes the copy-out it draws: an arrow only on the return", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    expect(screen.getByText(/A copy-out arrow appears only on the return/)).toBeInTheDocument();
  });

  it("pulse, output: flag is described as the task's own variable, not as a copy of busy (§13.3)", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    lockIn(/^Nothing/);
    expect(screen.getByText(/flag is the task's own variable, not busy/)).toBeInTheDocument();
    expect(screen.queryByText(/flag is a copy inside/)).not.toBeInTheDocument();
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
    reveal();
    const strip = screen.getByTestId("return-type-strip");
    expect(strip).toHaveTextContent(/a = 0 \(2 truncated to a logic, §10.7\) and b = 3, computes 3 and returns 1'b1, the low bit of 3/);
    fireEvent.change(screen.getByRole("combobox", { name: "Written return type" }), { target: { value: "int" } });
    lockIn(/^3$/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("return-type-strip")).toHaveTextContent(/computes 3 and returns 3\./);
  });

  it.each([
    ["output", "§13.5"],
    ["inout", "§13.5"],
    ["ref", "§13.5.2"],
  ] as const)("add(2, 3) with a as %s is a compile error, %s", (direction, clause) => {
    render(<SubroutineLab mode="formals" preset="add" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Written direction of a" }), { target: { value: direction } });
    lockIn(/^A compile error$/);
    expect(screen.getByText(/^Correct\./).parentElement).toHaveTextContent(clause);
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
    lockIn(/^A compile error$/);
    expect(screen.getByText(/^Correct\./).parentElement).toHaveTextContent(clause);
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
    fireEvent.click(screen.getByRole("button", { name: "Show the run anyway" }));
    const section = screen.getByRole("region", { name: "Step 3: watch the bench run" });
    const slider = within(section).getByRole("slider", { name: /scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    const lanes = within(section).getByRole("img", { name: /Call lanes/ });
    const labels = [...lanes.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["log_after 1", "log_after 2"]));
    expect(lanes.getAttribute("aria-label")).toContain("log_after 1");
    expect(labels).not.toContain("call 1");
  });

  it("the lifetime header does not call the calls overlapping, since #12 is one of its choices", () => {
    render(<SubroutineLab mode="lifetime" />);
    const region = screen.getByRole("region", { name: "Subroutine lab: Where a task's variables live" });
    const header = within(region).getByRole("heading", { name: "Where a task's variables live" }).parentElement as HTMLElement;
    expect(header).toHaveTextContent(/Two calls of one task/);
    expect(header.textContent).not.toMatch(/overlapping/);
    expect(screen.getByRole("radio", { name: /#12: call 2 starts/ })).toBeInTheDocument();
  });

  it("the §4.7 limit uses the clause's breadth: a process may be suspended at any point while it evaluates a statement", () => {
    render(<SubroutineLab mode="lifetime" />);
    const limits = screen.getByText("Assumptions and limits").closest("details") as HTMLElement;
    expect(limits).toHaveTextContent(/§4\.7 also lets a simulator suspend a process at any point while it evaluates a statement/);
    expect(limits).toHaveTextContent(/static, #10, with the debug prints: call 1's use line before call 2's enter line, both id=2/);
    expect(limits.textContent).not.toMatch(/between its statements/);
  });

  it("the send lab, with one task, keeps the plain call labels", () => {
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    scrubToEnd();
    const labels = [...screen.getByRole("img", { name: /Call lanes/ }).querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["call 1", "call 2"]));
  });
});

describe("SubroutineLab · a ref formal in the storage panel", () => {
  const scrubToKind = (kind: RegExp) => {
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    for (let i = 0; i <= max; i += 1) {
      scrubTo(i);
      if (kind.test(screen.getByTestId("narration").textContent ?? "")) return;
    }
    throw new Error(`no step matches ${kind}`);
  };

  it("pulse with ref: no storage of its own, a box titled as references, and the Why says another activation does reach it", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "ref" } });
    reveal();
    scrubToKind(/Call starts/);
    const narration = screen.getByTestId("narration");
    expect(narration).toHaveTextContent(/has no storage of its own: flag is busy/);
    expect(narration).toHaveTextContent("§13.5.2");
    expect(narration).not.toHaveTextContent(/Nothing another activation does can reach/);
    const storage = screen.getByTestId("storage");
    expect(storage).toHaveTextContent(/call 1's references \(pulse\(busy\)\)/);
    expect(storage).not.toHaveTextContent(/own copy/);
  });

  it("pulse with ref: the box ends without claiming a copy was dropped", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "ref" } });
    reveal();
    scrubToKind(/Returns/);
    const storage = screen.getByTestId("storage");
    expect(storage).toHaveTextContent(/ended at return/);
    expect(storage).not.toHaveTextContent(/dropped at return/);
  });

  it("pulse with output keeps the own-copy title", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    reveal();
    scrubToKind(/Call starts/);
    expect(screen.getByTestId("storage")).toHaveTextContent(/call 1's own copy \(pulse\(busy\)\)/);
  });
});

describe("SubroutineLab · copy arrows only while a call is open", () => {
  const diagram = () => screen.getByRole("img", { name: /Caller and task storage/ });
  const kindOf = () => screen.getByTestId("narration").textContent ?? "";
  const walk = (visit: (i: number) => void) => {
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    for (let i = 0; i <= max; i += 1) {
      scrubTo(i);
      visit(i);
    }
  };

  it("static: the box and its values stay at the start and after the return, with no arrows", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.click(screen.getByRole("button", { name: "Static, called twice" }));
    reveal();
    scrubTo(0);
    expect(kindOf()).toMatch(/^Start/);
    expect(diagram()).not.toHaveTextContent(/copy in|copy out|never copied back/);
    expect(diagram()).toHaveTextContent("Task: no call open (static)");
    expect(diagram()).toHaveTextContent("output b = 0");

    let sawReturn = false;
    let afterReturn = false;
    let checkedAfter = false;
    walk(() => {
      if (afterReturn && !checkedAfter) {
        checkedAfter = true;
        if (!/^Call starts/.test(kindOf())) {
          expect(diagram()).not.toHaveTextContent(/copy in|copy out|never copied back/);
          expect(diagram()).toHaveTextContent("output b = 20");
        }
      }
      if (/^Returns/.test(kindOf()) && !sawReturn) {
        sawReturn = true;
        afterReturn = true;
        // The return step performs the copy-out, so its arrow is still there, solid and lit.
        expect(diagram()).toHaveTextContent("copy out at the return");
        const out = [...diagram().querySelectorAll("line")].filter((l) => (l.getAttribute("marker-end") ?? "").includes("sub-arrow"));
        expect(out.some((l) => (l.getAttribute("marker-end") ?? "").includes("lit") && !l.getAttribute("stroke-dasharray"))).toBe(true);
      }
    });
    expect(sawReturn && checkedAfter).toBe(true);
  });

  it("while the call waits, the copy-in is drawn and the copy-out has no arrow yet", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    let seen = false;
    walk(() => {
      if (!seen && /^Waits/.test(kindOf()) && /show_dirs/.test(kindOf())) {
        seen = true;
        expect(diagram()).toHaveTextContent("copy in at the call");
        expect(diagram()).toHaveTextContent("no copy out yet");
        expect(diagram()).not.toHaveTextContent("copy out at the return");
        expect([...diagram().querySelectorAll("line")].filter((l) => l.getAttribute("marker-end")?.includes("lit"))).toHaveLength(0);
      }
    });
    expect(seen).toBe(true);
  });

  it("automatic: no box and no arrows before the call", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    scrubTo(0);
    expect(diagram()).toHaveTextContent("Task: not running");
    expect(diagram()).not.toHaveTextContent(/copy in|copy out/);
  });

  it("the arrowheads have one marker per colour and per lab, so two labs never share an id", () => {
    render(
      <>
        <SubroutineLab mode="directions" />
        <SubroutineLab mode="directions" />
      </>,
    );
    screen.getAllByRole("button", { name: /reveal without predicting/i }).forEach((b) => fireEvent.click(b));
    const ids = screen.getAllByRole("img", { name: /Caller and task storage/ }).flatMap((svg) => [...svg.querySelectorAll("marker")].map((m) => m.id));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => expect(id).not.toContain(":"));
  });

  it("the summary for screen readers names a ref as its caller's variable, not a value", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    let seen = false;
    walk(() => {
      if (!seen && /^Waits/.test(kindOf())) {
        seen = true;
        expect(diagram().getAttribute("aria-label")).toContain("d (ref) is v_ref");
      }
    });
    expect(seen).toBe(true);
  });
});

describe("SubroutineLab · the control marked invalid is the one that can fix it", () => {
  const operator = (name: string) => screen.getByRole("switch", { name: `${name} uses a nonblocking assignment` });

  it("pulse, const ref: the direction select is marked and the operator is not", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "const ref" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/const ref/);
    expect(screen.getByTestId("direction-flag")).toHaveAttribute("aria-invalid", "true");
    expect(operator("flag")).not.toHaveAttribute("aria-invalid");
  });

  it("pulse, const ref with <=: both are wrong, so both are marked", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "const ref" } });
    fireEvent.click(operator("flag"));
    expect(screen.getByTestId("direction-flag")).toHaveAttribute("aria-invalid", "true");
    expect(operator("flag")).toHaveAttribute("aria-invalid", "true");
  });

  it("pulse, <= to an automatic output: the operator is marked and the direction is not", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.click(operator("flag"));
    expect(screen.getByRole("alert")).toHaveTextContent("§13.3.2");
    expect(operator("flag")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("direction-flag")).not.toHaveAttribute("aria-invalid");
  });

  it("pulse, ref in a static task: the direction is marked and the lifetime switch stays usable", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "ref" } });
    fireEvent.click(screen.getByRole("switch", { name: "pulse is automatic" }));
    expect(screen.getByRole("alert")).toHaveTextContent("§13.5.2");
    expect(screen.getByTestId("direction-flag")).toHaveAttribute("aria-invalid", "true");
    expect(operator("flag")).not.toHaveAttribute("aria-invalid");
  });

  it("show_dirs, b as const ref: the direction of b is marked and its operator is not", () => {
    render(<SubroutineLab mode="directions" />);
    fireEvent.change(screen.getByTestId("direction-b"), { target: { value: "const ref" } });
    expect(screen.getByTestId("direction-b")).toHaveAttribute("aria-invalid", "true");
    expect(operator("b")).not.toHaveAttribute("aria-invalid");
  });
});

describe("SubroutineLab · layout at narrow widths", () => {
  it("pulse: flag's direction sits on flag's own line, and the task line carries one control", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    const flagLine = screen.getByTestId("direction-flag").closest("li") as HTMLElement;
    expect(flagLine).toHaveTextContent("output logic flag");
    expect(flagLine).not.toHaveTextContent("task automatic");
    const taskLine = screen.getByRole("switch", { name: "pulse is automatic" }).closest("li") as HTMLElement;
    expect(taskLine).toHaveTextContent("task automatic pulse(");
    expect(within(taskLine).queryByTestId("direction-flag")).not.toBeInTheDocument();
  });

  it.each([
    ["lifetime", /debug prints/],
    ["directions", /second time/],
  ] as const)("%s: the checkbox's label meets the 40 px touch target", (mode, name) => {
    render(<SubroutineLab mode={mode} />);
    expect(screen.getByRole("checkbox", { name }).closest("label")).toHaveClass("min-h-10");
  });
});

describe("SubroutineLab · the kata's order: read the log, pick, fix, rerun", () => {
  it("shows the code near the top and no run, narration or playback before the first rerun", () => {
    const { container } = render(<SubroutineLab mode="debug" />);
    const code = screen.getByRole("list", { name: /The bench, with your fixes/ });
    expect(code).toHaveTextContent("task log_after(input int delay_ns, input string msg);");
    const firstSymptom = screen.getByTestId("symptom-second-twice");
    expect(code.compareDocumentPosition(firstSymptom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("trace-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narration")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /scrubber/i })).not.toBeInTheDocument();
    ["overwriting", "one shared copy", "does not wake", "overwrote the shared copies"].forEach((leak) => expect(container.textContent).not.toContain(leak));
  });

  it("the code follows the fixes as they are picked, with the run still closed", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "pass by ref" }));
    expect(screen.getByRole("list", { name: /The bench, with your fixes/ })).toHaveTextContent("task automatic pulse(ref logic flag);");
    expect(screen.getByTestId("run-closed")).toBeInTheDocument();
  });

  it("the first rerun opens the run, and it stays open while the fixes change", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    expect(screen.getByTestId("narration")).toBeInTheDocument();
    expect(screen.queryByTestId("run-closed")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for sum_to" })).getByRole("radio", { name: "add automatic" }));
    expect(screen.queryByTestId("grade")).not.toBeInTheDocument();
    expect(screen.getByTestId("narration")).toBeInTheDocument();
  });

  it("'Show the run anyway' opens it without grading, and moves focus to the step's heading", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: "Show the run anyway" }));
    expect(screen.getByTestId("narration")).toBeInTheDocument();
    expect(screen.queryByTestId("grade")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /3\. Watch the bench/ }));
  });

  it("a bench that does not compile reports it in the open run", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for pulse" })).getByRole("radio", { name: "use <= for the write" }));
    expect(screen.queryByTestId("bench-issues")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rerun and grade" }));
    expect(screen.getByTestId("bench-issues")).toHaveTextContent("§13.3.2");
  });

  it("hints stay open when a fix changes", () => {
    render(<SubroutineLab mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Need a hint\? \(0\/3\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint \(1\/3\)/ }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fix for sum_to" })).getByRole("radio", { name: "add automatic" }));
    expect(screen.getByText(/Two of the three subroutines have no lifetime keyword/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Another hint \(2\/3\)/ })).toBeInTheDocument();
  });

  it("the fix is named 'pass by ref' on all three subroutines", () => {
    render(<SubroutineLab mode="debug" />);
    ["log_after", "sum_to", "pulse"].forEach((sub) => {
      const group = screen.getByRole("radiogroup", { name: `Fix for ${sub}` });
      expect(within(group).getByRole("radio", { name: "pass by ref" })).toBeInTheDocument();
      expect(within(group).queryByRole("radio", { name: /instead of output/ })).not.toBeInTheDocument();
    });
  });
});

describe("SubroutineLab · send feedback and option labels", () => {
  it("static #12: the no-overlap feedback is scoped to this bench, and points at count_ones for the rest of the rule", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: /#12: call 2 starts/ }));
    lockIn(/t=10 id=1/);
    const right = screen.getByText(/Call 2 starts at t = 12 ns, after call 1 returned/);
    expect(right).toHaveTextContent(/Here the overlap is what does the harm: send only reads id, and each call rewrites it at copy-in/);
    expect(right).toHaveTextContent(/A static local that carries a value between calls still misbehaves without overlap \(see count_ones\)/);
    expect(right).not.toHaveTextContent(/The static bug needs overlapping calls/);
  });

  it("static #12: the wrong-answer feedback says the same", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: /#12: call 2 starts/ }));
    lockIn(/t=10 id=2/);
    const wrong = screen.getByText(/By t = 12 ns, when call 2 copies 2 in/);
    expect(wrong).toHaveTextContent(/still misbehaves without overlap \(see count_ones\)/);
    expect(wrong).not.toHaveTextContent(/does no harm/);
  });

  it("static #2: a task with no lifetime keyword cites the default-to-static clause too", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=1/);
    expect(screen.getByText(/This task has no lifetime keyword, so in a module it is static/)).toHaveTextContent("(§13.3.1, §13.3.2)");
  });

  it("with the debug prints the options show the line the code prints, and that line appears in the log", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
    const legend = screen.getByText("What does call 1 print at t = 10 ns?").closest("fieldset") as HTMLElement;
    const labels = within(legend).getAllByRole("radio").map((r) => (r.closest("label") as HTMLElement).textContent ?? "");
    expect(labels.some((text) => text.startsWith("t=10 use   id=1:"))).toBe(true);
    expect(labels.some((text) => text.startsWith("t=10 use   id=2:"))).toBe(true);
    expect(labels.some((text) => /t=10 id=/.test(text))).toBe(false);
    lockIn(/t=10 use\s+id=2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByTestId("log")).getByText("t=10 use id=2").textContent).toBe("t=10 use   id=2");
  });

  it("without the debug prints the options keep the plain line", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });
});

describe("SubroutineLab · the compile-error option tells the truth about the state on screen", () => {
  const pickN = (n: number) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "n" })).getByRole("radio", { name: String(n) }));

  it("static with differing values: compiles and returns the wrong value", () => {
    render(<SubroutineLab mode="recursion" />);
    lockIn(/compile error/);
    const feedback = screen.getByText(/it does not forbid the static call/);
    expect(feedback).toHaveTextContent("The code compiles and returns the wrong value: 1, not 24.");
    expect(feedback).not.toHaveTextContent(/some tools/);
  });

  it("automatic: compiles and returns the correct value", () => {
    render(<SubroutineLab mode="recursion" />);
    fireEvent.click(screen.getByRole("switch", { name: "fact_static is automatic" }));
    expect(screen.getByLabelText(/A compile error: fact_auto may not call itself/)).toBeInTheDocument();
    lockIn(/compile error/);
    const feedback = screen.getByText(/fact_auto is automatic, so it is reentrant/);
    expect(feedback).toHaveTextContent("It compiles and returns 24, the correct value.");
    expect(feedback).not.toHaveTextContent(/wrong value/);
  });

  it.each(["static", "automatic"] as const)("n = 1, %s: the base case compiles and returns the correct value", (lifetime) => {
    render(<SubroutineLab mode="recursion" />);
    pickN(1);
    if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: "fact_static is automatic" }));
    lockIn(/compile error/);
    const feedback = screen.getByText(/n = 1 reaches the base case/);
    expect(feedback).toHaveTextContent("so it compiles and returns 1, the correct value.");
    expect(feedback).not.toHaveTextContent(/wrong value/);
  });

  it("sum_to, static and automatic: the feedback names sum_to's own values", () => {
    render(<SubroutineLab mode="recursion" preset="sum_to" />);
    lockIn(/A compile error: sum_to may not call itself/);
    expect(screen.getByText(/does not forbid the static call/)).toHaveTextContent("returns the wrong value: 0, not 6.");
    fireEvent.click(screen.getByRole("switch", { name: "sum_to is automatic" }));
    lockIn(/compile error/);
    expect(screen.getByText(/sum_to is automatic, so it is reentrant/)).toHaveTextContent("returns 6, the correct value.");
  });
});

describe("SubroutineLab · recursion feedback and the table", () => {
  it("the wrong answers explain themselves: fact's 0 and sum_to's outermost n", () => {
    const first = render(<SubroutineLab mode="recursion" />);
    lockIn(/^0$/);
    expect(screen.getByText(/Nothing produces 0: rest starts at the int default 0 but is assigned from the inner call before it is read/)).toBeInTheDocument();
    first.unmount();
    render(<SubroutineLab mode="recursion" preset="sum_to" />);
    lockIn(/^3$/);
    expect(screen.getByText(/Only the outermost n would give that/)).toBeInTheDocument();
  });

  it("a right answer speaks of the levels above the base case, which has no inner call", () => {
    const first = render(<SubroutineLab mode="recursion" />);
    lockIn(/^1$/);
    expect(screen.getByText(/Every level above the base case reads the shared n/)).toBeInTheDocument();
    first.unmount();
    render(<SubroutineLab mode="recursion" preset="sum_to" />);
    lockIn(/^0$/);
    expect(screen.getByText(/Every level above the base case reads the shared n/)).toBeInTheDocument();
  });

  it("the table's caption says the base case shares one row", () => {
    render(<SubroutineLab mode="recursion" />);
    reveal();
    expect(within(screen.getByTestId("recursion-table")).getByText(/the base case's entry and return share one row/)).toBeInTheDocument();
  });

  it.each([
    ["fact", "static", () => factBench({ lifetime: "static", n: 4 })],
    ["fact", "automatic", () => factBench({ lifetime: "automatic", n: 4 })],
    ["sum_to", "static", () => sumToBench({ lifetime: "static", n: 3 })],
    ["sum_to", "automatic", () => sumToBench({ lifetime: "automatic", n: 3 })],
  ] as const)("%s, %s: on every exec or return step the highlighted row is the running activation", (preset, lifetime, bench) => {
    render(<SubroutineLab mode="recursion" preset={preset} />);
    if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: /is automatic$/ }));
    reveal();
    const run = simulateBench(bench());
    expect(recursionTable(run).length).toBeGreaterThan(0);
    const table = screen.getByTestId("recursion-table");
    let checked = 0;
    run.trace.forEach((step) => {
      if ((step.kind !== "exec" && step.kind !== "return") || step.activationId === undefined) return;
      scrubTo(step.index);
      const current = table.querySelector("tr[aria-current='step']") as HTMLElement;
      expect(current.querySelectorAll("td")[1].textContent).toBe(run.activations.find((a) => a.id === step.activationId)?.label);
      checked += 1;
    });
    expect(checked).toBeGreaterThan(0);
  });
});

describe("SubroutineLab · small things a learner reads or hears", () => {
  it("the scrubber names its position; the status region alone reads the narration", () => {
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    const slider = screen.getByRole("slider", { name: /scrubber/i });
    expect(slider.getAttribute("aria-valuetext")).toMatch(/^Simulation step 1 of \d+: Start, t = 0 ns$/);
    expect(screen.getByTestId("step-live")).toHaveTextContent(/Why:/);
  });

  it("the single-choice controls show their names, without announcing them twice", () => {
    const first = render(<SubroutineLab mode="recursion" />);
    expect(screen.getByText("n =")).toHaveAttribute("aria-hidden", "true");
    first.unmount();
    const second = render(<SubroutineLab mode="lifetime" />);
    expect(screen.getByText("Call 2 starts:")).toHaveAttribute("aria-hidden", "true");
    second.unmount();
    render(<SubroutineLab mode="formals" />);
    expect(screen.getByText("Signature:")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("radiogroup", { name: "Signature" })).toBeInTheDocument();
  });

  it("'Formal to predict' is visible when there is a choice", () => {
    render(<SubroutineLab mode="formals" />);
    const select = screen.getByRole("combobox", { name: "Written direction of word" });
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.getByRole("radiogroup", { name: "Formal to predict" })).toBeInTheDocument();
    expect(screen.getByText("Formal to predict:")).toHaveAttribute("aria-hidden", "true");
  });

  it("the buggy log is a finished log, so no line is tinted; the live log tints its newest", () => {
    render(<SubroutineLab mode="debug" />);
    expect((within(screen.getByTestId("buggy-log")).getByText("sum_to(3) = 0").closest("li") as HTMLElement).className).not.toContain("text-cyan-200");
    fireEvent.click(screen.getByRole("button", { name: "Show the run anyway" }));
    scrubToEnd();
    expect((within(screen.getByTestId("log")).getByText("sum_to(3) = 0").closest("li") as HTMLElement).className).toContain("text-cyan-200");
  });

  it("a phone gets the task's values without scrolling the diagram: a compact list, shown only below sm", () => {
    render(<SubroutineLab mode="directions" />);
    reveal();
    const list = screen.getByTestId("formal-values");
    expect(list).toHaveClass("sm:hidden");
    expect(list).toHaveAttribute("aria-hidden", "true");
    scrubToEnd();
    expect(list).toHaveTextContent("v_out = 20; b (output) = no storage");
    const walkTo = screen.getByRole("slider", { name: /scrubber/i });
    const max = Number(walkTo.getAttribute("max"));
    for (let i = 0; i <= max; i += 1) {
      scrubTo(i);
      if (/^Returns/.test(screen.getByTestId("narration").textContent ?? "")) break;
    }
    expect(list).toHaveTextContent("v_in = 5; a (input) = 15");
    expect(list).toHaveTextContent("v_ref = 45; d (ref) is v_ref");
  });

  it("const ref with <=: the message says the write is the error and offers no cure that fails", () => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: "const ref" } });
    fireEvent.click(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/const ref, so the write itself is the error/);
    expect(alert).not.toHaveTextContent(/Use =|ref static/);
  });
});

describe("SubroutineLab · send texts checked against §13.3.1 and §13.3.2", () => {
  it("default state: the right answer's feedback names call 2's copy-in at t = 2 ns", () => {
    render(<SubroutineLab mode="lifetime" />);
    lockIn(/t=10 id=2/);
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(
      "Call 2 copied 2 into the one shared id at t = 2 ns while call 1 waited at #10, so call 1 printed another call's argument (§13.3.2).",
    );
  });

  it("automatic: the id=2 feedback says call 2's write lands in call 2's copy only", () => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
    lockIn(/t=10 id=2/);
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent("An automatic task gives every activation its own id; call 2's write lands in call 2's copy only (§13.3.2).");
  });

  it.each([
    [2, "No tie here: the overwrite at t = 2 ns happens 8 ns before the print, in a different time slot."],
    [12, "No tie here: call 2 starts 2 ns after call 1 printed."],
  ] as const)("static #%s: the 'Either' feedback says there is no tie", (at, text) => {
    render(<SubroutineLab mode="lifetime" />);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`#${at}: call 2 starts`) }));
    lockIn(/^Either/);
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(text);
  });

  it("the static box is titled as the one shared copy, and is badged as shared by both calls once call 2 has entered", () => {
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    expect(screen.getByTestId("box-static:send")).toHaveTextContent("send: the one shared copy");
    expect(screen.queryByText("shared by 2 activations at once")).not.toBeInTheDocument();
    const max = Number(screen.getByRole("slider", { name: /scrubber/i }).getAttribute("max"));
    let entered = -1;
    for (let i = 0; i <= max && entered < 0; i += 1) {
      scrubTo(i);
      if (/send\(2\) starts/.test(screen.getByTestId("narration").textContent ?? "")) entered = i;
    }
    expect(entered).toBeGreaterThan(0);
    expect(screen.getByTestId("narration")).toHaveTextContent("t = 2 ns");
    const box = screen.getByTestId("box-static:send");
    expect(box).toHaveTextContent("send: the one shared copy");
    expect(within(box).getByText("shared by 2 activations at once")).toBeInTheDocument();
    scrubTo(entered - 1);
    expect(screen.queryByText("shared by 2 activations at once")).not.toBeInTheDocument();
  });
});

describe("SubroutineLab · the compile-error option follows the lifetime and the start time", () => {
  it("lifetime × start time × debug prints: 'does the wrong thing' only where call 1 can print call 2's id", () => {
    for (const lifetime of ["static", "automatic"] as Lifetime[]) {
      for (const at of [2, 10, 12] as SecondCallAt[]) {
        for (const debugPrints of [false, true]) {
          const { unmount } = render(<SubroutineLab mode="lifetime" />);
          if (lifetime === "automatic") fireEvent.click(screen.getByRole("switch", { name: "send is automatic" }));
          fireEvent.click(screen.getByRole("radio", { name: new RegExp(`#${at}: call 2 starts`) }));
          if (debugPrints) fireEvent.click(screen.getByRole("checkbox", { name: /debug prints/ }));
          lockIn(/A compile error: two calls of a static task/);
          const feedback = screen.getByText(/Not quite\./).parentElement as HTMLElement;
          const verdict = sendVerdict(exploreBench(sendBench({ lifetime, secondCallAt: at, debugPrints })));
          expect(/wrong thing/.test(feedback.textContent ?? "")).toBe(verdict !== "id=1");
          expect(feedback).toHaveTextContent("§13.3.2");
          if (verdict === "id=1") expect(feedback).toHaveTextContent(/prints id=1,? correctly/);
          if (verdict === "either") expect(feedback).toHaveTextContent("§4.7");
          if (lifetime === "automatic") expect(feedback).toHaveTextContent(/each call has its own id/);
          unmount();
        }
      }
    }
  });
});

describe("SubroutineLab · pulse: ref is offered as the cure only where it compiles", () => {
  const setPulse = (lifetime: Lifetime, direction: Direction, nba: boolean) => {
    render(<SubroutineLab mode="directions" preset="pulse" />);
    if (lifetime === "static") fireEvent.click(screen.getByRole("switch", { name: "pulse is automatic" }));
    fireEvent.change(screen.getByTestId("direction-flag"), { target: { value: direction } });
    if (nba) fireEvent.click(screen.getByRole("switch", { name: "flag uses a nonblocking assignment" }));
  };

  it("every legal non-ref state: the 'both lines' feedback says ref gives them only where ref compiles, and why it does not here", () => {
    let checked = 0;
    for (const lifetime of ["static", "automatic"] as Lifetime[]) {
      for (const direction of ["input", "output", "inout"] as Direction[]) {
        for (const nba of [false, true]) {
          if (compileBench(pulseBench({ lifetime, direction, nba })).length) continue;
          checked += 1;
          setPulse(lifetime, direction, nba);
          lockIn(/t=13 busy=1\s*then/);
          const feedback = screen.getByText(/Not quite\./).parentElement as HTMLElement;
          const refIssues = compileBench(pulseBench({ lifetime, direction: "ref", nba }));
          if (refIssues.length === 0) {
            // Only automatic with =: ref compiles and gives both lines.
            expect(simulateBench(pulseBench({ lifetime, direction: "ref", nba })).log.map((l) => l.text)).toEqual(["t=13 busy=1", "t=23 busy=0"]);
            expect(feedback).toHaveTextContent("That is what ref would give.");
            expect(feedback).not.toHaveTextContent(/does not compile/);
          } else {
            expect(refIssues.every((i) => i.clause === "§13.5.2")).toBe(true);
            expect(feedback).not.toHaveTextContent(/That is what ref would give\./);
            expect(feedback).toHaveTextContent(nba ? "That is what ref would give in an automatic task with =." : "That is what ref would give in an automatic task.");
            expect(feedback).toHaveTextContent("Here ref does not compile");
            expect(feedback).toHaveTextContent("§13.5.2");
            if (lifetime === "static") expect(feedback).toHaveTextContent("pass by reference is illegal in a static task");
            if (nba) expect(feedback).toHaveTextContent(/a <= through a ref is not allowed.*§13\.3\.2/);
            else expect(feedback).not.toHaveTextContent(/<= through a ref/);
          }
          cleanup();
        }
      }
    }
    // input, output and inout under = in both lifetimes, and under <= when static.
    expect(checked).toBe(9);
  });

  it("automatic with =: the late-1 feedback says the <= it needs is not allowed on an automatic task's flag", () => {
    setPulse("automatic", "output", false);
    lockIn(/t=23 busy=1\s*only/);
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/that takes flag <= 1'b0, which an automatic task may not use on its own flag \(§13\.3, §4\.4\.2\.4, §13\.3\.2\)/);
    cleanup();
    setPulse("static", "output", false);
    lockIn(/t=23 busy=1\s*only/);
    const feedback = screen.getByText(/Not quite\./).parentElement as HTMLElement;
    expect(feedback).toHaveTextContent(/still waiting in the NBA region/);
    expect(feedback).not.toHaveTextContent(/automatic task may not/);
  });
});

describe("SubroutineLab · the article before a type", () => {
  it("wait_cycles_ok: n is an int unsigned in the strip and in the feedback", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles_ok" />);
    lockIn(/^1 cycle$/);
    expect(screen.getByText(/One cycle is what a one-bit n would give/)).toHaveTextContent("This n is an int unsigned, wide enough for 5");
    const strip = screen.getByTestId("wait-cycles-strip");
    expect(strip).toHaveTextContent("stores 5 into an int unsigned n");
    expect(strip).toHaveTextContent("stores 4 into an int unsigned n");
    expect(strip).not.toHaveTextContent(/\ba int\b/);
  });

  it("wait_cycles_ok: the 'nothing is lost' feedback says the same", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles_ok" />);
    lockIn(/^0 cycles$/);
    expect(screen.getByText(/Nothing is lost/)).toHaveTextContent("Nothing is lost: n is an int unsigned, wide enough for 5, so it waits 5 cycles.");
  });

  it("wait_cycles: a one-bit logic keeps 'a'", () => {
    render(<SubroutineLab mode="formals" preset="wait_cycles" />);
    reveal();
    lockIn(/^1 cycle$/);
    expect(screen.getByTestId("wait-cycles-strip")).toHaveTextContent("stores 5 into a logic n");
  });
});

describe("SubroutineLab · prefers-reduced-motion", () => {
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

  it("the lane bars animate by default and carry no transition class under reduce", () => {
    mock(false);
    const first = render(<SubroutineLab mode="lifetime" />);
    reveal();
    scrubToEnd();
    const animated = screen.getAllByTestId("lane-bar");
    expect(animated).toHaveLength(2);
    animated.forEach((bar) => expect(bar.getAttribute("class")).toContain("transition-all"));
    first.unmount();

    mock(true);
    render(<SubroutineLab mode="lifetime" />);
    reveal();
    scrubToEnd();
    const still = screen.getAllByTestId("lane-bar");
    expect(still).toHaveLength(2);
    still.forEach((bar) => expect(bar.getAttribute("class") ?? "").not.toMatch(/transition|duration/));
    // The storage boxes fade by CSS, and opt out of it under reduce.
    expect(screen.getByTestId("box-static:send")).toHaveClass("motion-reduce:transition-none");
  });
});
