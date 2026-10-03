import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RalRegisterMapVisualizer from "@/components/visualizers/RalRegisterMapVisualizer";

const lockIn = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const toMode = (name: RegExp) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Mode" })).getByRole("radio", { name }));
const regRow = (reg: string) => screen.getAllByRole("row").filter((r) => new RegExp(`^${reg}\\s*reg`).test(r.textContent ?? ""));

describe("RalRegisterMapVisualizer (model: src/lib/ral-model.ts)", () => {
  it("declares itself a deterministic model and starts on a prediction challenge", () => {
    render(<RalRegisterMapVisualizer />);
    expect(screen.getByRole("region", { name: "RAL register model lab" })).toBeInTheDocument();
    expect(screen.getByText("Deterministic educational model")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Test code" })).toHaveTextContent("ral.CTRL.write(status, 'hFFFF_FFFF);");
  });

  it("hides the model's result until a prediction is locked in (RO bits keep their value)", () => {
    render(<RalRegisterMapVisualizer />);
    expect(screen.queryByText("After the call (model)")).not.toBeInTheDocument();
    lockIn("0x0000_000F");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText("After the call (model)")).toBeInTheDocument();
    expect(screen.getAllByText(/RSVD is RO/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/uvm_reg_predictor \(UVM_PREDICT_WRITE\)/).length).toBeGreaterThan(0);
  });

  it("diagnoses the copy-the-bus-data misconception", () => {
    render(<RalRegisterMapVisualizer />);
    lockIn("0xFFFF_FFFF");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/RSVD\[31:4\] is RO/).length).toBeGreaterThan(0);
  });

  it("switches challenges from the keyboard and resets the prediction (W1C write of 'hFF predicts 0)", () => {
    render(<RalRegisterMapVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Challenge" });
    const first = within(group).getByRole("radio", { name: /1\. Write all ones/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: /2\. Clear interrupts/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/writes 'hFF to INT_STATUS/)).toBeInTheDocument();
    lockIn("0x0000_0000");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });

  it("grades the update() challenge from the model: one bus write", () => {
    render(<RalRegisterMapVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /3\. set\(\) then update\(\), twice/ }));
    lockIn("2");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/needs_update\(\) is 0/).length).toBeGreaterThan(0);
  });

  it("sandbox: a frontdoor write is predicted per field, and removing the predictor leaves a stale mirror", () => {
    render(<RalRegisterMapVisualizer />);
    toMode(/Sandbox/);
    fireEvent.click(screen.getByRole("checkbox", { name: /Predict the mirror before each call/ }));
    fireEvent.change(screen.getByLabelText(/value \(hex/), { target: { value: "'hFFFF_FFFF" } });
    fireEvent.click(screen.getByRole("button", { name: "write(status, value)" }));
    expect(regRow("CTRL")[0]).toHaveTextContent("0x0000_000F0x0000_000F0x0000_000F");

    fireEvent.click(screen.getByRole("radio", { name: "None (default)" }));
    fireEvent.change(screen.getByLabelText(/value \(hex/), { target: { value: "'h5" } });
    fireEvent.click(screen.getByRole("button", { name: "write(status, value)" }));
    expect(regRow("CTRL")[0]).toHaveTextContent("0x0000_00050x0000_000F0x0000_0005");
    expect(screen.getAllByLabelText("stale: differs from the DUT").length).toBeGreaterThan(0);
    const log = screen.getByRole("list", { name: "Operation log" });
    expect(within(log).getAllByText(/nothing predicted it/).length).toBeGreaterThan(0);
  });

  it("sandbox: with predict-first on, a call waits behind a prediction and only applies on confirm", () => {
    render(<RalRegisterMapVisualizer />);
    toMode(/Sandbox/);
    fireEvent.click(screen.getByRole("radio", { name: /INT_STATUS/ }));
    fireEvent.click(screen.getByRole("button", { name: "apply hardware event" }));
    expect(screen.getByText(/what will ral.INT_STATUS.get_mirrored_value\(\) return/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Operation log" })).not.toBeInTheDocument();
    lockIn("0x0000_0000");
    fireEvent.click(screen.getByRole("button", { name: /Apply to the model and continue/ }));
    expect(screen.getByRole("list", { name: "Operation log" })).toHaveTextContent(/DUT logic: INT_STATUS.DONE becomes 1/);
  });

  it("sandbox: rejects invalid values and explains the field policy without hover", () => {
    render(<RalRegisterMapVisualizer />);
    toMode(/Sandbox/);
    const input = screen.getByLabelText(/value \(hex/);
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a hex value that fits in 32 bits/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "write(status, value)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /RSVD \[31:4\]/ }));
    expect(screen.getByText(/RO: a write has no effect/)).toBeInTheDocument();
    expect(screen.getByText(/RSVD.configure\(this, 28, 4, "RO", 0/)).toBeInTheDocument();
  });

  it("debug mode: the culprit is a hardware-driven field configured volatile = 0; fixes are graded by rerunning the model", () => {
    render(<RalRegisterMapVisualizer />);
    toMode(/Debug a mismatch/);
    expect(screen.getAllByText(/Register "ral.STATUS" value read from DUT/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: TX_EMPTY.configure/ }));
    expect(screen.getByText(/Not this one/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: BUSY.configure/ }));
    expect(screen.getByText(/volatile = 0, so the field keeps UVM_CHECK/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /volatile = 1/ }));
    expect(screen.getByText(/✓ no UVM_ERROR in either check/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /predict\('h1\)/ }));
    expect(screen.getByText(/✕ 1 UVM_ERROR/)).toBeInTheDocument();
  });
});
