import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConfigDbExplorer from "@/components/curriculum/interactives/ConfigDbExplorer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));

describe("ConfigDbExplorer", () => {
  it("hides the resolution until a prediction is locked in, then diagnoses a 'last call wins' guess", () => {
    render(<ConfigDbExplorer />);
    expect(screen.queryByRole("list", { name: "Database entries considered by get" })).not.toBeInTheDocument();

    // env's set runs later, but during build the test (higher context) wins.
    fireEvent.click(screen.getByLabelText(/returns 1, num_pkts = 20/));
    lockIn();
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/higher context wins/).length).toBeGreaterThan(0);
    const entries = screen.getByRole("list", { name: "Database entries considered by get" });
    expect(within(entries).getByText("★ returned")).toBeInTheDocument();
    expect(entries).toHaveTextContent("precedence 999");
    expect(entries).toHaveTextContent("precedence 998");
  });

  it("type mismatch: get returns 0 silently", () => {
    render(<ConfigDbExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Debug: type mismatch" }));
    fireEvent.click(screen.getByLabelText(/get returns 0/));
    lockIn();
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/exactly type T/).length).toBeGreaterThan(0);
  });

  it("moving both calls to run_phase makes the last set win; the prediction resets on edit", () => {
    render(<ConfigDbExplorer />);
    reveal();
    expect(screen.getByText(/get returns 1: num_pkts = 10\./)).toBeInTheDocument();

    const whenSelects = screen.getAllByLabelText("When");
    // set #1, set #2, get
    fireEvent.change(whenSelects[1], { target: { value: "run" } });
    fireEvent.change(whenSelects[2], { target: { value: "run" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    reveal();
    expect(screen.getByText(/get returns 1: num_pkts = 20\./)).toBeInTheDocument();
  });

  it("wildcard reach: after reveal the hierarchy shows the driver also receives the setting", () => {
    render(<ConfigDbExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "How far does * reach?" }));
    expect(screen.queryByRole("list", { name: "Reach of the configuration in the hierarchy" })).not.toBeInTheDocument();
    reveal();
    const reach = screen.getByRole("list", { name: "Reach of the configuration in the hierarchy" });
    expect(within(reach).getAllByText(/✓ UVM_PASSIVE/)).toHaveLength(6);
    expect(within(reach).getAllByText("— get returns 0")).toHaveLength(2);
  });

  it("scenario picker is keyboard operable", () => {
    render(<ConfigDbExplorer />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Test vs env (build)" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Wildcard vs exact path" })).toHaveAttribute("aria-checked", "true");
  });
});
