import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RunEndingExplorer from "@/components/visuals/RunEndingExplorer";
import { endingHeadline, runEndOfRun, runSchedulerLoop, runSeverity } from "@/lib/run-ending-scenarios";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  const buttons = screen.getAllByRole("button", { name: /lock in prediction/i });
  fireEvent.click(buttons[buttons.length - 1]);
};

const scrubToEnd = (noun: RegExp) => {
  const slider = screen.getByRole("slider", { name: noun });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
};

const output = () => screen.getByRole("list", { name: /simulation output/i });

describe("RunEndingExplorer · severity-and-end", () => {
  it("hides the run until both predictions are locked in, then explains each", () => {
    render(<RunEndingExplorer view="lanes" preset="severity-and-end" />);
    expect(screen.queryByRole("group", { name: /run step playback controls/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /simulation output/i })).not.toBeInTheDocument();

    lockIn(/Only the final summary/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/\$error prints its message with a tool-specific prefix and returns: §20\.10 gives \$error no implicit \$finish/)).toBeInTheDocument();
    // The second question is still open: no run yet.
    expect(screen.queryByRole("group", { name: /run step playback controls/i })).not.toBeInTheDocument();

    lockIn("FAIL=1");
    expect(screen.getByRole("group", { name: /run step playback controls/i })).toBeInTheDocument();
    scrubToEnd(/run step scrubber/i);
    const log = output();
    expect(within(log).getByText(/still running at t=30/)).toBeInTheDocument();
    expect(within(log).getByText(/final block: FAIL=1/)).toBeInTheDocument();
    expect(within(log).getByText(/‹Error prefix, 20 ns›/)).toBeInTheDocument();
    expect(screen.getByText(/tool-specific \(§20\.10\)/)).toBeInTheDocument();
    // Table 20-1: the diagnostic the tool prints at $finish is named, not invented.
    expect(screen.getByText(/^Not shown: at \$finish the tool also reports diagnostic level 1/)).toBeInTheDocument();
  });

  it("switches the statement at 20 ns to $stop: the panel says suspended and final does not run", () => {
    render(<RunEndingExplorer preset="severity-and-end" />);
    fireEvent.change(screen.getByLabelText(/Statement at t = 20 ns/), { target: { value: "stop" } });
    expect(screen.getByText("$stop;")).toBeInTheDocument();
    lockIn("Neither line");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    lockIn("No summary prints");
    scrubToEnd(/run step scrubber/i);
    const run = runSeverity({ control: "stop", count: true });
    expect(screen.getByText(endingHeadline(run.result))).toBeInTheDocument();
    expect(screen.getByText(/suspended: what a batch tool does next is tool-dependent/i)).toBeInTheDocument();
    expect(within(output()).queryByText(/final block/)).not.toBeInTheDocument();
    // The narration says nothing runs unless the run is resumed; it never calls it ended.
    expect(screen.getByText(/Nothing runs unless someone resumes the simulation/)).toBeInTheDocument();
    expect(screen.getByText(/^Not shown: at \$stop the tool also reports diagnostic level 1/)).toBeInTheDocument();
  });

  it("the counter toggle changes the code and re-asks; $error alone leaves FAIL=0", () => {
    render(<RunEndingExplorer preset="severity-and-end" />);
    expect(screen.getByText("n_fail++;")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /n_fail\+\+ in the failing branch/ }));
    expect(screen.queryByText("n_fail++;")).not.toBeInTheDocument();
    lockIn(/still running at t=30", then the final summary/);
    lockIn("FAIL=0");
    expect(screen.getAllByText(/Correct\./)).toHaveLength(2);
    scrubToEnd(/run step scrubber/i);
    expect(within(output()).getByText(/final block: FAIL=0/)).toBeInTheDocument();
    expect(screen.getAllByText(/printed an error but changed no variable/).length).toBeGreaterThan(0);
  });
});

describe("RunEndingExplorer · watchdog-race", () => {
  it("normal run: disable fork kills the watchdog and main's $finish ends the run", () => {
    render(<RunEndingExplorer view="lanes" preset="watchdog-race" />);
    expect(screen.queryByRole("img", { name: /process lanes/i })).not.toBeInTheDocument();
    lockIn(/Yes; main's \$finish ends the run/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd(/run step scrubber/i);
    const lanes = screen.getByRole("img", { name: /process lanes/i });
    expect(lanes.getAttribute("aria-label")).toMatch(/watchdog killed/);
    expect(within(output()).getByText("PASS=3 FAIL=0")).toBeInTheDocument();
  });

  it("each ending is chosen from the keyboard and graded against the model", () => {
    render(<RunEndingExplorer preset="watchdog-race" />);
    const picker = screen.getByRole("radiogroup", { name: "How the run goes" });
    fireEvent.keyDown(within(picker).getByRole("radio", { name: "normal run" }), { key: "ArrowRight" });
    expect(within(picker).getByRole("radio", { name: /run hangs/ })).toHaveAttribute("aria-checked", "true");
    lockIn(/Yes; main's \$finish ends the run/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/the watchdog's #\(TIMEOUT\) expires/)).toBeInTheDocument();

    fireEvent.click(within(picker).getByRole("radio", { name: "zero-delay wait loop" }));
    expect(screen.getByText(/while \(n_exp != 0\);/)).toBeInTheDocument();
    lockIn(/No; time stops/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd(/run step scrubber/i);
    expect(screen.getByText(endingHeadline(runEndOfRun("zero-delay").result))).toBeInTheDocument();
    expect(screen.getAllByText(/stands in for exp_q\.size\(\)/).length).toBeGreaterThan(0);
  });

  it("$finish deleted: still running at the model horizon, labelled as a model limit", () => {
    render(<RunEndingExplorer preset="watchdog-race" />);
    fireEvent.click(screen.getByRole("radio", { name: "$finish deleted" }));
    lockIn(/Yes; then nothing ends the run/);
    scrubToEnd(/run step scrubber/i);
    expect(screen.getByText(endingHeadline(runEndOfRun("no-finish").result))).toBeInTheDocument();
    expect(screen.getAllByText(/The horizon is a limit of this model, not SystemVerilog/).length).toBeGreaterThan(0);
  });
});

describe("RunEndingExplorer · scheduler-loop", () => {
  it("asks how the run ends, then pauses before each jump of time until the jump is predicted", () => {
    render(<RunEndingExplorer view="loop" preset="scheduler-loop" />);
    expect(screen.queryByRole("list", { name: /scheduler loop boxes/i })).not.toBeInTheDocument();
    lockIn("A $finish ends it");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    const boxes = screen.getByRole("list", { name: /scheduler loop boxes/i });
    expect(within(boxes).getByText("T = 0").closest("[aria-current]")).toHaveAttribute("aria-current", "step");

    scrubToEnd(/loop step scrubber/i);
    // Clamped before the first jump: the jump question is open and the booked list hides its order.
    expect(screen.getByText(/Which time does the loop visit next/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Booked for later" })).toHaveTextContent(/in booking order/);
    expect(screen.queryByText(/Time advances to t = 5/)).not.toBeInTheDocument();

    lockIn("t = 1 ns");
    expect(screen.getByText(/Time does not tick by 1 ns/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /jump to the next time slot/i }));
    expect(screen.getByText(/Time advances to t = 5/)).toBeInTheDocument();
    expect(within(boxes).getByText(/Move to the first nonempty time slot/).closest("[aria-current]")).toHaveAttribute("aria-current", "step");
  });

  it("walks every jump to the $finish and shows final in zero time", () => {
    render(<RunEndingExplorer preset="scheduler-loop" />);
    lockIn("A $finish ends it");
    const run = runSchedulerLoop("finish");
    for (const t of run.visited.slice(1)) {
      scrubToEnd(/loop step scrubber/i);
      lockIn(`t = ${t} ns`);
      fireEvent.click(screen.getByRole("button", { name: /jump to the next time slot/i }));
    }
    scrubToEnd(/loop step scrubber/i);
    expect(screen.getByText(endingHeadline(run.result))).toBeInTheDocument();
    expect(within(output()).getByText("final: count = 2")).toBeInTheDocument();
    // After the run the box stays on final procedures, and the slot list shows only the final procedure.
    const boxes = screen.getByRole("list", { name: /scheduler loop boxes/i });
    expect(within(boxes).getByText("final procedures").closest("[aria-current]")).toHaveAttribute("aria-current", "step");
    const slot = screen.getByRole("region", { name: "This time slot" });
    expect(slot).toHaveTextContent(/After the last time slot · final procedures/);
    expect(slot).toHaveTextContent(/report \(final procedure, zero time\)/);
    expect(slot).not.toHaveTextContent(/test runs/);
  });

  it("blocked waiter: the check says No before final runs, then the box stays on final", () => {
    render(<RunEndingExplorer preset="scheduler-loop" />);
    fireEvent.click(screen.getByRole("radio", { name: "blocked waiter, nothing booked" }));
    lockIn(/It ends by itself/);
    const run = runSchedulerLoop("quiet");
    for (const t of run.visited.slice(1)) {
      scrubToEnd(/loop step scrubber/i);
      lockIn(`t = ${t} ns`);
      fireEvent.click(screen.getByRole("button", { name: /jump to the next time slot/i }));
    }
    const slider = screen.getByRole("slider", { name: /loop step scrubber/i });
    const first = run.result.trace.findIndex((s) => s.kind === "final");
    fireEvent.change(slider, { target: { value: String(first) } });
    const boxes = screen.getByRole("list", { name: /scheduler loop boxes/i });
    expect(within(boxes).getByText("final procedures").closest("[aria-current]")).toHaveAttribute("aria-current", "step");
    expect(within(boxes).getByText(/No: every time slot is empty/)).toBeInTheDocument();
    scrubToEnd(/loop step scrubber/i);
    expect(within(boxes).getByText("final procedures").closest("[aria-current]")).toHaveAttribute("aria-current", "step");
    expect(within(boxes).queryByText(/Passed on the way here/)).not.toBeInTheDocument();
  });

  it("the zero-delay program never jumps: time stops at 0", () => {
    render(<RunEndingExplorer preset="scheduler-loop" />);
    fireEvent.click(screen.getByRole("radio", { name: "always areg = ~areg;" }));
    lockIn(/Time stops/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd(/loop step scrubber/i);
    expect(screen.queryByText(/Which time does the loop visit next/)).not.toBeInTheDocument();
    expect(screen.getByText(endingHeadline(runSchedulerLoop("zero-delay").result))).toBeInTheDocument();
    expect(screen.getByText(/The slot never empties/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "This time slot" })).toHaveTextContent(/areg changed \d+ times/);
    expect(screen.queryByText(/raised objection/)).not.toBeInTheDocument();
  });
});
