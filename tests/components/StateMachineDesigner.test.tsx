import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StateMachineDesigner from "@/components/animations/StateMachineDesigner";

const stateBox = (name: string) => screen.getByLabelText(new RegExp(`^State ${name} encoded as`));

describe("StateMachineDesigner", () => {
  it("reports the binary encoding width and counts the reset state as visited", () => {
    render(<StateMachineDesigner />);
    expect(screen.getByTestId("encoding-summary")).toHaveTextContent("Encoding width: 2 flip-flops for 3 states.");
    const coverage = screen.getByTestId("fsm-coverage");
    expect(coverage).toHaveTextContent("States: 1/3");
    fireEvent.click(screen.getByRole("button", { name: "Step Simulation" }));
    expect(coverage).toHaveTextContent("Coverage after 1 clock");
    expect(coverage).toHaveTextContent("States: 2/3");
    expect(coverage).toHaveTextContent("Transitions: 1/3");
    expect(stateBox("STATE_A")).toHaveAccessibleName(/current state/);
  });

  it("draws a transition from the keyboard (Enter on source, then target) without duplicating it", () => {
    render(<StateMachineDesigner />);
    fireEvent.keyDown(stateBox("IDLE"), { key: "Enter" });
    expect(screen.getByText(/Transition from IDLE: select the target state/)).toBeInTheDocument();
    fireEvent.keyDown(stateBox("STATE_B"), { key: "Enter" });
    const list = screen.getByRole("list", { name: "Transitions" });
    expect(within(list).getAllByText(/IDLE → STATE_B/)).toHaveLength(1);
    fireEvent.keyDown(stateBox("IDLE"), { key: "Enter" });
    fireEvent.keyDown(stateBox("STATE_B"), { key: "Enter" });
    expect(within(list).getAllByText(/IDLE → STATE_B/)).toHaveLength(1);
  });

  it("flags a new, unconnected state as unreachable from reset", () => {
    render(<StateMachineDesigner />);
    fireEvent.click(screen.getByRole("button", { name: "Add State" }));
    expect(stateBox("STATE_4")).toBeInTheDocument();
    expect(screen.getByTestId("fsm-analysis")).toHaveTextContent("Unreachable from reset (IDLE): STATE_4");
    expect(screen.getByTestId("encoding-summary")).toHaveTextContent("Encoding width: 2 flip-flops for 4 states.");
  });
});
