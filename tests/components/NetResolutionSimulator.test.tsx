import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NetResolutionSimulator from "@/components/visuals/NetResolutionSimulator";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));

describe("NetResolutionSimulator", () => {
  it("is not a placeholder: it renders a model-backed experiment", () => {
    render(<NetResolutionSimulator />);
    expect(screen.getByRole("region", { name: /net resolution simulator/i })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
  });

  it("gates the result behind a prediction and diagnoses 'conflict means x' when strengths differ", () => {
    render(<NetResolutionSimulator />);
    // Default: wire, a = 0 strong, b = 1 weak.
    expect(screen.queryByText(/is the strongest driver/)).not.toBeInTheDocument();
    expect(screen.getByText("assign (strong0, strong1) y = a;")).toBeInTheDocument();
    expect(screen.getByText("assign (weak0, weak1) y = b;")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getByText(/not at the same strength/)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value St0")).toBeInTheDocument();
    expect(screen.getAllByText(/is the strongest driver/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("sets the net value").length).toBe(1);
  });

  it("equal-strength opposite drivers on a wire resolve to StX", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Bus fight" }));
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value StX")).toBeInTheDocument();
  });

  it("switching to wand changes the answer for the same drivers (Table 6-3)", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Bus fight" }));
    const nets = screen.getByRole("radiogroup", { name: "Net type" });
    fireEvent.keyDown(within(nets).getByRole("radio", { name: "wire" }), { key: "ArrowRight" });
    expect(within(nets).getByRole("radio", { name: "wand" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getAllByText(/wired AND/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("strength and value St0")).toBeInTheDocument();
  });

  it("a weak driver loses to the tri0 pull-down", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Weak 1 vs tri0" }));
    fireEvent.click(screen.getByLabelText("y reads 0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value Pu0")).toBeInTheDocument();
  });

  it("lets the learner set a driver strength and add a third driver from the keyboard", () => {
    render(<NetResolutionSimulator />);
    fireEvent.change(screen.getByLabelText("Strength of driver b"), { target: { value: "supply" } });
    expect(screen.getByText("assign (supply0, supply1) y = b;")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add a third driver/i }));
    expect(screen.getByRole("radiogroup", { name: "Value driven by c" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads 1"));
    lockIn();
    expect(screen.getByLabelText("strength and value Su1")).toBeInTheDocument();
  });

  it("variable vs net: two assigns on logic y are a compile error, on wire y they resolve", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Variable vs net" }));
    expect(screen.queryByText(/multiple continuous drivers on a variable/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/y is the resolved value of both drivers/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Compile error: multiple continuous drivers on a variable/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /wire y, a net/ }));
    fireEvent.click(screen.getByLabelText(/y is the resolved value of both drivers/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Legal: the net resolves its drivers/)).toBeInTheDocument();
  });

  it("two always blocks on a variable are legal: last write wins", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Variable vs net" }));
    fireEvent.click(screen.getByRole("radio", { name: "two always" }));
    fireEvent.click(screen.getByLabelText(/It does not compile/));
    lockIn();
    expect(screen.getByText(/Several procedural writers are legal/)).toBeInTheDocument();
    expect(screen.getByText(/Legal: the last procedural write wins/)).toBeInTheDocument();
  });

  it("trireg keeps its charge when every driver lets go, while a wire floats", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "trireg holds charge" }));
    expect(screen.getByText(/trireg \(medium\) y;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads z: nothing drives it"));
    lockIn();
    expect(screen.getByText(/never floats to z/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /same drivers on a trireg and on a wire/ });
    expect(within(table).getByText("Me1")).toBeInTheDocument();
    expect(within(table).getAllByText("We0")).toHaveLength(2);
    expect(within(table).getAllByText("HiZ").length).toBeGreaterThan(0);
  });
});
