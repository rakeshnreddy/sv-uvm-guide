import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmAgentBuilderExercise from "@/components/exercises/UvmAgentBuilderExercise";

const add = (name: string) => fireEvent.click(screen.getByRole("button", { name: `Add ${name} to the agent` }));
const agentList = () => document.getElementById("agent-droppable") as HTMLElement;

describe("UvmAgentBuilderExercise", () => {
  it("builds an active agent with buttons and grades membership, not order", () => {
    render(<UvmAgentBuilderExercise />);
    add("Monitor");
    add("Driver");
    add("Sequencer");
    expect(within(agentList()).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Check Agent" }));
    const feedback = screen.getByTestId("exercise-feedback");
    expect(feedback).toHaveTextContent("Score: 100%");
    expect(feedback).toHaveTextContent(/get_is_active\(\)/);
  });

  it("in passive mode, a driver inside the agent is marked wrong with a reason", () => {
    render(<UvmAgentBuilderExercise />);
    fireEvent.click(screen.getByRole("radio", { name: "UVM_PASSIVE agent" }));
    add("Monitor");
    add("Driver");
    fireEvent.click(screen.getByRole("button", { name: "Check Agent" }));
    const feedback = screen.getByTestId("exercise-feedback");
    expect(feedback).not.toHaveTextContent("Score: 100%");
    expect(feedback).toHaveTextContent(/A passive agent must not build a driver/);
  });

  it("remove returns an item to the palette and Retry clears feedback", () => {
    render(<UvmAgentBuilderExercise />);
    add("Scoreboard");
    fireEvent.click(screen.getByRole("button", { name: "Remove Scoreboard from the agent" }));
    expect(within(agentList()).queryAllByRole("listitem")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Check Agent" }));
    expect(screen.getByTestId("exercise-feedback")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.queryByTestId("exercise-feedback")).not.toBeInTheDocument();
  });

  it("switches mode with the keyboard (radio group arrows)", () => {
    render(<UvmAgentBuilderExercise />);
    const active = screen.getByRole("radio", { name: "UVM_ACTIVE agent" });
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "UVM_PASSIVE agent" })).toHaveAttribute("aria-checked", "true");
  });
});
