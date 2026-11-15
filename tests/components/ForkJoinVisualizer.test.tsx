import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ForkJoinVisualizer from "@/components/visuals/ForkJoinVisualizer";
import ProcessTreeView from "@/components/visuals/fork-join/ProcessTreeView";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const scrubToEnd = () => {
  const slider = screen.getByRole("slider", { name: /process step scrubber/i });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
};

describe("ForkJoinVisualizer", () => {
  it("hides the run until a prediction is locked in, then diagnoses it", () => {
    render(<ForkJoinVisualizer />);
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulation output/i)).not.toBeInTheDocument();

    lockIn("t = 0 ns");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/That is join_none/)).toBeInTheDocument();
    expect(screen.getByText(/join waits for every child, so the longest one/)).toBeInTheDocument();

    scrubToEnd();
    const output = screen.getByText(/Simulation output/i).closest("div") as HTMLElement;
    expect(within(output).getByText("parent continues").closest("li")).toHaveTextContent("30 ns");
  });

  it("changes the variant from the keyboard and re-asks the question", () => {
    render(<ForkJoinVisualizer />);
    lockIn("t = 30 ns");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    const variants = screen.getByRole("radiogroup", { name: "Variant" });
    fireEvent.keyDown(within(variants).getByRole("radio", { name: "join" }), { key: "ArrowRight" });
    expect(within(variants).getByRole("radio", { name: "join_any" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();

    lockIn("t = 10 ns");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /process step playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next process step/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);
  });

  it("shows disable fork killing the monitor, and the isolation wrapper sparing it", () => {
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" />);
    lockIn("The timer and the monitor");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: /monitor/ }).closest("tr")).toHaveTextContent(/killed/);

    fireEvent.click(screen.getByRole("radio", { name: "isolation wrapper" }));
    lockIn("Only the timer");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    scrubToEnd();
    expect(within(screen.getByRole("table")).getByRole("rowheader", { name: /monitor/ }).closest("tr")).not.toHaveTextContent(/killed/);
  });

  it("reports the -> / @ race across every legal order and offers an order toggle", () => {
    render(<ForkJoinVisualizer scenario="event-race" scenarios={["event-race"]} />);
    expect(screen.queryByRole("radio", { name: /Debug: disable fork/ })).not.toBeInTheDocument();
    lockIn(/It depends on which process the simulator runs first/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Race: 2 different outcomes/)).toBeInTheDocument();

    scrubToEnd();
    expect(screen.queryByText("consumer woke")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("consumer first, then producer"));
    scrubToEnd();
    expect(screen.getAllByText("consumer woke").length).toBeGreaterThan(0);
  });

  it("debug mode: find the culprit, then grade fixes on one call and on two concurrent calls", () => {
    render(<ForkJoinVisualizer mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: join_any/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: disable fork;" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Name the fork/));
    expect(screen.getByText(/Rejected in review/)).toBeInTheDocument();
    const concurrent = screen.getByText(/Two concurrent calls/).closest("div") as HTMLElement;
    expect(within(concurrent).getByText(/every transfer gets its response/).closest("li")).toHaveTextContent("fails");

    fireEvent.click(screen.getByLabelText(/Wrap the race and its cleanup/));
    expect(screen.getByText(/Passes both runs\./)).toBeInTheDocument();
  });
});

describe("ForkJoinVisualizer process tree (treeView)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const tree = () => screen.getByRole("img", { name: /^Process tree at t = / });
  const pickGroup = () => screen.getByRole("group", { name: /Processes you predict it reaches/ });
  const feedback = () => screen.getByRole("group", { name: "Your prediction, revealed" });

  it("grows the tree as playback steps, then pauses before disable fork without showing the answer", () => {
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" scenarios={["timeout-disable-fork", "wrapper-begin-end", "finished-child-grandchild"]} treeView />);
    // No up-front question: the prediction happens at the pause.
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(tree()).toHaveAccessibleName(/^Process tree at t = 0 ns: test \(/);
    expect(tree().getAttribute("aria-label")).not.toMatch(/monitor/);

    scrubToEnd();
    expect(tree()).toHaveAccessibleName(/t = 15 ns: test .*monitor .*rsp 1 .*timer 1/);
    expect(screen.getByText(/test is about to run disable fork\. Which processes does it kill\?/)).toBeInTheDocument();
    // The answer is not visible yet: nothing has been killed.
    expect(within(screen.getByRole("table")).queryByText(/killed/)).not.toBeInTheDocument();
    expect(tree().getAttribute("aria-label")).not.toMatch(/killed/);
    const slider = screen.getByRole("slider", { name: /process step scrubber/i });
    expect(slider.getAttribute("aria-valuetext")).not.toMatch(/kills/);
    expect(screen.getByRole("button", { name: /next process step/i })).toBeDisabled();

    fireEvent.click(within(pickGroup()).getByRole("button", { name: "monitor" }));
    fireEvent.click(within(pickGroup()).getByRole("button", { name: "timer 1" }));
    expect(within(pickGroup()).getByRole("button", { name: "monitor" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(within(feedback()).getByText(/disable fork kills monitor and timer 1\./)).toBeInTheDocument();
    expect(within(feedback()).getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText(/Marks: what disable fork; reached at t = 15 ns/)).toBeInTheDocument();

    scrubToEnd();
    expect(within(screen.getByRole("table")).getByRole("rowheader", { name: /monitor/ }).closest("tr")).toHaveTextContent(/killed/);
    expect(screen.getByText(/What to notice:/)).toBeInTheDocument();
  });

  it("explains each miss: begin … end adds no node, so the monitor still dies", () => {
    render(<ForkJoinVisualizer scenario="wrapper-begin-end" scenarios={["wrapper-begin-end"]} treeView />);
    fireEvent.click(screen.getByRole("radio", { name: "begin … end" }));
    scrubToEnd();
    expect(tree().getAttribute("aria-label")).not.toMatch(/wrapper/);
    fireEvent.click(within(pickGroup()).getByRole("button", { name: "timer" }));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(within(feedback()).getByText("Not quite.")).toBeInTheDocument();
    expect(within(feedback()).getByText(/You missed monitor\./)).toBeInTheDocument();
    expect(screen.getByText(/monitor is a child of test and still running, so disable fork kills it/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "fork begin … end join" }));
    scrubToEnd();
    expect(tree()).toHaveAccessibleName(/wrapper \(.*child of test\)/);
    expect(screen.getByText(/wrapper is about to run disable fork/)).toBeInTheDocument();
  });

  it("finished child: tapping nothing is right for wait fork, and the grandchild is explained", () => {
    render(<ForkJoinVisualizer preset="disable-in-depth" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Variant" })).getByRole("radio", { name: "wait fork" }));
    scrubToEnd();
    expect(screen.getByText(/parent is about to run wait fork\. Which processes does it wait for\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(within(feedback()).getByText("Correct.")).toBeInTheDocument();
    expect(within(feedback()).getByText(/wait fork waits for no process\./)).toBeInTheDocument();
    expect(screen.getByText(/G is a grandchild of parent, not an immediate child/)).toBeInTheDocument();
  });

  it("finished child with disable fork: reveal without predicting still explains the grandchild's death", () => {
    render(<ForkJoinVisualizer scenario="finished-child-grandchild" scenarios={["finished-child-grandchild"]} treeView />);
    scrubToEnd();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText("Answer.")).toBeInTheDocument();
    expect(screen.getByText(/even though C has already finished/)).toBeInTheDocument();
    scrubToEnd();
    expect(tree()).toHaveAccessibleName(/G \(killed, child of C\)/);
  });

  it("without treeView the new scenarios use the up-front prediction", () => {
    render(<ForkJoinVisualizer scenario="wrapper-begin-end" scenarios={["wrapper-begin-end"]} />);
    expect(screen.queryByRole("img", { name: /^Process tree/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "begin … end" }));
    lockIn("No: disable fork kills the monitor");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/a begin-end block is not in §9\.5's list of what creates a process/)).toBeInTheDocument();
    expect(screen.queryByText(/adds no process \(§9\.5\)/)).not.toBeInTheDocument();
  });

  it("autoplay stops at the pause: the kill step is never shown before the prediction", () => {
    vi.useFakeTimers();
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" scenarios={["timeout-disable-fork"]} treeView />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    for (let i = 0; i < 80; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1500);
      });
    }
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByText(/test is about to run disable fork/)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /process step scrubber/i }).getAttribute("aria-valuetext")).not.toMatch(/kills/);
    expect(within(screen.getByRole("table")).queryByText(/killed/)).not.toBeInTheDocument();
  });

  it("ArrowRight on the playback controls cannot step past the pause", () => {
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" scenarios={["timeout-disable-fork"]} treeView />);
    scrubToEnd();
    const group = screen.getByRole("group", { name: /process step playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: "Play" }), { key: "ArrowRight" });
    fireEvent.keyDown(within(group).getByRole("button", { name: "Play" }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).toBe(before);
    expect(slider.getAttribute("aria-valuetext")).not.toMatch(/kills/);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
  });

  it("lock-in moves focus to the verdict, and a live region that was already mounted announces it", () => {
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" scenarios={["timeout-disable-fork"]} treeView />);
    const live = screen.getByTestId("tree-verdict-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    scrubToEnd();
    fireEvent.click(within(pickGroup()).getByRole("button", { name: "timer 1" }));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByTestId("tree-verdict-live")).toBe(live);
    expect(live).toHaveTextContent("Not quite. disable fork kills monitor and timer 1. You missed monitor.");
    const verdict = screen.getByText("Not quite.").closest("p") as HTMLElement;
    expect(document.activeElement).toBe(verdict);
  });

  it("cleanup preset, disable by name with two calls: xfer(2) is forced out of guard, not ended (§9.6.2)", () => {
    render(<ForkJoinVisualizer preset="cleanup" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name: "disable by name" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Variant" })).getByRole("radio", { name: "two concurrent calls" }));
    scrubToEnd();
    expect(
      screen.getByText("At t = 15 ns, xfer(1) is about to run disable guard. Which processes does it reach (end, or force out of guard)? Tap each one you predict, or none."),
    ).toBeInTheDocument();
    for (const label of ["timer 1", "rsp 2", "timer 2"]) fireEvent.click(within(pickGroup()).getByRole("button", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(within(feedback()).getByText(/ends timer 1, rsp 2 and timer 2, and forces xfer\(2\) out of guard; xfer\(2\) carries on after the block \(§9\.6\.2\)\. You missed xfer\(2\), which it forces out of guard\./)).toBeInTheDocument();
    const xfer2 = within(feedback()).getByText("xfer(2)").closest("li") as HTMLElement;
    expect(xfer2).toHaveTextContent(/xfer\(2\) · forced out of guard, you missed it\./);
    expect(xfer2).not.toHaveTextContent(/ended/);
    expect(xfer2).toHaveTextContent(/carries on after the block \(§9\.6\.2\)/);
    expect(within(feedback()).getByText("rsp 2").closest("li")).toHaveTextContent(/rsp 2 · ended, you picked it\./);
    expect(within(tree()).getByText("↩ forced out")).toBeInTheDocument();
  });

  it("what-creates-a-process preset: one scenario, tree on, and the none variant pauses before test's disable fork", () => {
    render(<ForkJoinVisualizer preset="what-creates-a-process" />);
    expect(screen.queryByRole("radiogroup", { name: "Scenario" })).not.toBeInTheDocument();
    expect(tree()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "none" }));
    scrubToEnd();
    expect(screen.getByText(/test is about to run disable fork/)).toBeInTheDocument();
  });

  it("without treeView, the none variant's survive option does not mention a wrapper", () => {
    render(<ForkJoinVisualizer scenario="wrapper-begin-end" scenarios={["wrapper-begin-end"]} />);
    fireEvent.click(screen.getByRole("radio", { name: "none" }));
    expect(screen.getByLabelText("Yes: the monitor survives")).toBeInTheDocument();
    expect(screen.queryByLabelText(/the wrapper keeps the monitor/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "begin … end" }));
    expect(screen.getByLabelText("Yes: the wrapper keeps the monitor out of reach")).toBeInTheDocument();
  });

  it("'Reveal without predicting' takes the secondary button style; only Lock in is filled", () => {
    render(<ForkJoinVisualizer scenario="timeout-disable-fork" scenarios={["timeout-disable-fork"]} treeView />);
    scrubToEnd();
    const reveal = screen.getByRole("button", { name: "Reveal without predicting" });
    expect(reveal).toHaveClass("min-h-10", "border", "border-border", "bg-muted", "text-foreground");
    expect(reveal).not.toHaveClass("text-muted-foreground", "hover:underline");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toHaveClass("bg-primary");
  });

  it("a cut label in the drawing keeps its full name as an SVG title", () => {
    render(
      <ProcessTreeView
        time={0}
        tree={[
          { pid: 0, label: "test", parent: null, depth: 0, state: "running", kind: "initial", children: [1] },
          { pid: 1, label: "monitor_long_name", parent: 0, depth: 1, state: "blocked", kind: "child", children: [] },
        ]}
      />,
    );
    const drawing = screen.getByRole("img", { name: /^Process tree at t = 0 ns/ });
    const cut = within(drawing).getByText("monitor_lo…");
    expect(cut.querySelector("title")?.textContent).toBe("monitor_long_name");
    expect(drawing.querySelectorAll("title")).toHaveLength(1);
  });

  it("a run without process control keeps the up-front question in tree view", () => {
    render(<ForkJoinVisualizer scenario="join-variants" scenarios={["join-variants"]} treeView />);
    lockIn("t = 30 ns");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(tree()).toBeInTheDocument();
  });
});
