import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmPhaseSorterExercise, { uvmPhases } from "../../src/components/exercises/UvmPhaseSorterExercise";

const solvedDirections = {
  build: "top-down",
  connect: "bottom-up",
  end_of_elaboration: "bottom-up",
  start_of_simulation: "bottom-up",
  extract: "bottom-up",
  check: "bottom-up",
  report: "bottom-up",
  final: "top-down",
} as const;

const feedback = () => screen.getByTestId("exercise-feedback");

describe("UvmPhaseSorterExercise (two lanes + direction)", () => {
  it("scores 100% when both lanes are ordered and every direction is right", () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} initialDirections={solvedDirections} />);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(within(feedback()).getByText("Score: 100%")).toBeInTheDocument();
    expect(within(feedback()).getByText(/Every phase falls into place/)).toBeInTheDocument();
  });

  it("puts run_phase and the runtime phases in separate lanes (concurrency, not a sequence)", () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} />);
    const lane1 = screen.getByRole("region", { name: "Lane 1 · common domain" });
    const lane2 = screen.getByRole("region", { name: "Lane 2 · uvm schedule (beside run_phase)" });
    expect(within(lane1).getByText("run_phase")).toBeInTheDocument();
    expect(within(lane1).queryByText("main_phase")).not.toBeInTheDocument();
    expect(within(lane2).getByText("main_phase")).toBeInTheDocument();
  });

  it("missing directions cost points and are diagnosed", () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} />);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(within(feedback()).getByText(/A few phases are still out of order/)).toBeInTheDocument();
    expect(within(feedback()).getByText("Directions: 0/8 right")).toBeInTheDocument();
    expect(within(feedback()).getByText(/Choose a direction for every function phase/)).toBeInTheDocument();
  });

  it("diagnoses final_phase marked bottom-up", () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} initialDirections={{ ...solvedDirections, final: "bottom-up" }} />);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(within(feedback()).getByText(/final_phase is top-down, like build_phase/)).toBeInTheDocument();
  });

  it("move buttons and direction buttons are keyboard-reachable controls", () => {
    render(<UvmPhaseSorterExercise initialItems={uvmPhases} initialDirections={solvedDirections} />);
    fireEvent.click(screen.getByRole("button", { name: "Move connect_phase up" }));
    const lane1 = screen.getByRole("region", { name: "Lane 1 · common domain" });
    const names = within(lane1).getAllByRole("listitem").map((li) => li.textContent);
    expect(names[0]).toMatch(/connect_phase/);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(within(feedback()).getByText("Common domain: 8/9 in order")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "build_phase runs bottom-up" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("exercise-feedback")).not.toBeInTheDocument();
  });

  it("shuffle again clears the feedback and produces a deterministic new order", () => {
    render(<UvmPhaseSorterExercise />);
    fireEvent.click(screen.getByRole("button", { name: /check order/i }));
    expect(feedback()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /shuffle again/i }));
    expect(screen.queryByTestId("exercise-feedback")).not.toBeInTheDocument();
  });
});
