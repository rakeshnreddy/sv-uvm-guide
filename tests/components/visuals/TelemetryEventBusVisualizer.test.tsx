import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TelemetryEventBusVisualizer from "@/components/visuals/TelemetryEventBusVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const summary = () => screen.getByText(/--- UVM Report Summary ---/).textContent ?? "";

describe("TelemetryEventBusVisualizer (report pipeline explorer)", () => {
  it("hides the outcome until the learner commits a prediction", () => {
    render(<TelemetryEventBusVisualizer />);
    expect(screen.getByRole("heading", { name: /Where does a `uvm_error go\?/ })).toBeInTheDocument();
    expect(screen.queryByText(/--- UVM Report Summary ---/)).not.toBeInTheDocument();
    lockIn(/^3 UVM_ERRORs$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(summary()).toContain("UVM_ERROR :    3");
  });

  it("diagnoses the $error misconception", () => {
    render(<TelemetryEventBusVisualizer />);
    lockIn(/^4 UVM_ERRORs$/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/\$error is a SystemVerilog severity task/).length).toBeGreaterThan(0);
  });

  it("the demoting catcher leaves only the real bug counted and shows catcher statistics", () => {
    render(<TelemetryEventBusVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Demote the injected CRC errors" }));
    lockIn(/^1 UVM_ERROR$/);
    expect(summary()).toContain("UVM_ERROR :    1");
    expect(summary()).toContain("Number of demoted UVM_ERROR reports  :    2");
    expect(screen.getByText(/Test FAILS for exactly the right reason/)).toBeInTheDocument();
    expect(screen.getByText(/class crc_demoter extends uvm_report_catcher;/)).toBeInTheDocument();
  });

  it("the over-broad catcher makes the test pass while the real bug escapes", () => {
    render(<TelemetryEventBusVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Catch every error" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/Test PASSES — the DUT bug escapes/)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText(/caught by a catcher/).length).toBe(3);
  });

  it("changing a knob with the keyboard re-arms the prediction", () => {
    render(<TelemetryEventBusVisualizer />);
    lockIn(/^3 UVM_ERRORs$/);
    expect(screen.getByText(/--- UVM Report Summary ---/)).toBeInTheDocument();
    const quit = screen.getByRole("radiogroup", { name: "Max quit count" });
    const current = within(quit).getByRole("radio", { checked: true });
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(within(quit).getByRole("radio", { name: "2" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(/--- UVM Report Summary ---/)).not.toBeInTheDocument();
    lockIn(/^2 UVM_ERRORs$/);
    expect(summary()).toContain("Quit count reached!");
    expect(screen.getByText(/not because of the real bug/)).toBeInTheDocument();
  });
});
