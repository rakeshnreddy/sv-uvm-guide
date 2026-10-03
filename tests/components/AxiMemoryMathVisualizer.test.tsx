import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AxiMemoryMathVisualizer from "@/components/visualizers/AxiMemoryMathVisualizer";

const lockIn = (label: RegExp | string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const preset = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Burst presets" })).getByRole("radio", { name }));

describe("AxiMemoryMathVisualizer", () => {
  it("hides the transfer table until the learner predicts the last address", () => {
    render(<AxiMemoryMathVisualizer />);
    expect(screen.getByTestId("axi-memory-math-visualizer")).toBeInTheDocument();
    expect(screen.getByText(/What is the address of the last transfer \(N = 4\)/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    lockIn("0x100C");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const table = screen.getByRole("table");
    const addresses = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[1].textContent);
    // IHI0022E A3.4.1: only the first transfer is unaligned.
    expect(addresses).toEqual(["0x1003", "0x1004", "0x1008", "0x100C"]);
  });

  it("diagnoses the 'start + N x size' misconception for unaligned INCR", () => {
    render(<AxiMemoryMathVisualizer />);
    lockIn("0x100F");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/carries the start offset into every transfer/)).toBeInTheDocument();
  });

  it("asks about legality for a burst that crosses 4KB and reports the A3.4.1 violation", () => {
    render(<AxiMemoryMathVisualizer />);
    preset("Crosses 4KB");
    expect(screen.getByText("Is this burst legal?")).toBeInTheDocument();
    lockIn("Illegal: crosses a 4KB boundary");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/straddle 0x1000/).length).toBeGreaterThan(0);
  });

  it("treats a burst whose last byte is 0x0FFF as legal", () => {
    render(<AxiMemoryMathVisualizer />);
    preset("Ends at 0x0FFF");
    lockIn("0x0FFC");
    expect(screen.getByText(/✓ Legal burst/)).toBeInTheDocument();
  });

  it("flags a WSTRB lane outside the active lanes but accepts a sparse strobe", () => {
    render(<AxiMemoryMathVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    // Transfer 1 of the 0x1003 burst only uses lane 3.
    fireEvent.click(screen.getByRole("button", { name: /WSTRB\[2\] 0, inactive lane/ }));
    expect(screen.getByText(/✕ Illegal: lane 2 carries no valid data/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /WSTRB\[2\] 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /WSTRB\[3\] 1, active lane/ }));
    expect(screen.getByText(/✓ Legal sparse write/)).toBeInTheDocument();
  });

  it("supports keyboard selection of AxBURST and re-arms the prediction", () => {
    render(<AxiMemoryMathVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    const incr = within(screen.getByRole("radiogroup", { name: "AxBURST" })).getByRole("radio", { name: "INCR" });
    incr.focus();
    fireEvent.keyDown(incr, { key: "ArrowRight" });
    expect(within(screen.getByRole("radiogroup", { name: "AxBURST" })).getByRole("radio", { name: "WRAP" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // An unaligned WRAP is illegal.
    lockIn("Illegal: unaligned WRAP start");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("generates the driver assignment from the current burst", () => {
    render(<AxiMemoryMathVisualizer />);
    preset("WRAP4 at 0x1008");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/AWBURST = 2'b10; \/\/ WRAP/)).toBeInTheDocument();
    expect(screen.getAllByText(/↺ wrapped/)).toHaveLength(1);
  });
});
