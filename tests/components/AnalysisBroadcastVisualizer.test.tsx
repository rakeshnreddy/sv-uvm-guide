import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AnalysisBroadcastVisualizer from "@/components/visuals/AnalysisBroadcastVisualizer";

const lockIn = (answer: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("AnalysisBroadcastVisualizer: call trace", () => {
  it("gates the trace behind a prediction about timing", () => {
    render(<AnalysisBroadcastVisualizer />);
    expect(screen.queryByLabelText("Call stack")).not.toBeInTheDocument();
    lockIn(/^At t = 10 ns, after all three/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Call stack")).toBeInTheDocument();
  });

  it("calls subscribers in full-name order, and reordering connect() lines does not change it", () => {
    render(<AnalysisBroadcastVisualizer />);
    lockIn(/^At t = 10 ns immediately/);
    const order = /Call order: uvm_test_top\.env\.cov\.analysis_imp → uvm_test_top\.env\.log\.analysis_imp → uvm_test_top\.env\.scb\.item_imp/;
    expect(screen.getByText(order)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move agt.ap.connect(scb.item_imp); down" }));
    expect(screen.getByText(order)).toBeInTheDocument();
  });

  it("a subscriber that modifies the shared item makes the scoreboard mismatch", () => {
    render(<AnalysisBroadcastVisualizer />);
    lockIn(/^At t = 10 ns, after all three/);
    expect(screen.getByText(/\[SCB\] match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /cov.write\(\) clears/ }));
    expect(screen.getByText(/\[SCB\] mismatch: expected data=0xa5/)).toBeInTheDocument();
  });

  it("steps with the keyboard and keeps every step at t = 10 ns", () => {
    render(<AnalysisBroadcastVisualizer />);
    lockIn(/^At t = 10 ns, after all three/);
    const controls = screen.getByRole("group", { name: /Call playback controls/ });
    fireEvent.keyDown(within(controls).getByRole("button", { name: "Next call" }), { key: "ArrowRight" });
    expect(screen.getByText(/t = 10 ns · step 2 of 5/)).toBeInTheDocument();
    expect(screen.getByLabelText("Call stack")).toHaveTextContent("bus_coverage::write(t)");
  });
});

describe("AnalysisBroadcastVisualizer: slow subscriber", () => {
  it("a delay inside write() is a compile error; the FIFO version shows the monitor never waits", () => {
    render(<AnalysisBroadcastVisualizer section="slow" />);
    lockIn(/^Not in write\(\)/);
    expect(screen.getByText(/§13.4 \(a\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "analysis FIFO + get() loop" }));
    expect(screen.getByText(/The monitor never waits \(0 ns\)/)).toBeInTheDocument();
    expect(screen.getByText(/leaves items #2, #3, #4 unchecked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "t = 110 ns" }));
    expect(screen.getByText(/Every item is checked before the test ends/)).toBeInTheDocument();
  });
});
