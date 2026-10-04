import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import VIPReuseVisualizer from "@/components/visuals/VIPReuseVisualizer";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("VIPReuseVisualizer", () => {
  it("asks which components exist in passive mode before showing the agent", () => {
    render(<VIPReuseVisualizer />);
    expect(screen.queryByRole("radiogroup", { name: "Integration level" })).not.toBeInTheDocument();
    lockIn("All four are built; the driver is just switched off");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Passive does not mean built-but-idle/)).toBeInTheDocument();

    const parts = screen.getByRole("list", { name: "Components after build_phase" });
    expect(within(parts).getByText("driver").closest("li")).toHaveTextContent("null.");
    expect(within(parts).getByText("monitor").closest("li")).toHaveTextContent("exists.");
    expect(screen.getByText(/UVM_PASSIVE\);/)).toBeInTheDocument();
  });

  it("switches to block level from the keyboard: driver and sequencer exist", () => {
    render(<VIPReuseVisualizer />);
    lockIn("Monitor and coverage only; driver and sequencer are never created");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const level = screen.getByRole("radiogroup", { name: "Integration level" });
    fireEvent.keyDown(within(level).getByRole("radio", { name: /SoC level/ }), { key: "ArrowLeft" });
    expect(within(level).getByRole("radio", { name: /Block level/ })).toHaveAttribute("aria-checked", "true");
    const parts = screen.getByRole("list", { name: "Components after build_phase" });
    expect(within(parts).getByText("driver").closest("li")).toHaveTextContent("exists.");
    expect(screen.getByText(/UVM_ACTIVE\);/)).toBeInTheDocument();
  });

  it("break it: without super.build_phase the SoC agent stays active and fights the CPU", () => {
    render(<VIPReuseVisualizer />);
    lockIn("Monitor and coverage only; driver and sequencer are never created");
    fireEvent.click(screen.getByRole("button", { name: /break the agent/ }));
    fireEvent.click(screen.getByLabelText("Forget super.build_phase(phase)"));
    expect(screen.getByText(/both the UVM driver and the CPU \(contention\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Forget super.build_phase(phase)"));
    fireEvent.click(screen.getByLabelText("Drop the is_active guard in connect_phase"));
    expect(screen.getByText(/Null object access in connect_phase/)).toBeInTheDocument();
  });
});
