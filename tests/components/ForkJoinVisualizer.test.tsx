import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ForkJoinVisualizer from "@/components/visuals/ForkJoinVisualizer";

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
