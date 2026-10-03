import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AxiIdOrderingVisualizer, { ORDERING_PRESETS } from "@/components/visualizers/AxiIdOrderingVisualizer";
import { isLegalOrdering } from "@/lib/axi-channel-model";

const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const situation = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name }));

describe("AxiIdOrderingVisualizer", () => {
  it("every preset offers exactly one order that the model accepts", () => {
    for (const p of ORDERING_PRESETS) {
      expect(p.options.filter((seq) => isLegalOrdering(p.kind, p.requests, seq)), p.id).toHaveLength(1);
    }
  });

  it("hides the waveform and the play controls until the learner commits", () => {
    render(<AxiIdOrderingVisualizer />);
    expect(screen.getByTestId("axi-id-ordering-visualizer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send A" })).not.toBeInTheDocument();
    lockIn("A0, A1, B0, B1");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send A" })).toBeInTheDocument();
  });

  it("explains why same-ID read data may not be reordered (A5.3.1)", () => {
    render(<AxiIdOrderingVisualizer />);
    lockIn("B0, B1, A0, A1");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/Same-ID read data must return in address order/).length).toBeGreaterThan(0);
  });

  it("lets different IDs interleave and keeps same-ID order", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Reads, different IDs");
    lockIn("B0, A0, B1, A1, C");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("play mode records an illegal same-ID transfer with the reason", () => {
    render(<AxiIdOrderingVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Send B" }));
    expect(screen.getAllByText(/B has ARID 3, like A/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Send A" }));
    expect(screen.getAllByText(/no earlier read with ARID 3/).length).toBeGreaterThan(0);
  });

  it("AXI4 write data cannot interleave even with different AWIDs (A5.4)", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Write data (AXI4)");
    lockIn("X0, Y, X1");
    expect(screen.getAllByText(/consecutive transfers/).length).toBeGreaterThan(0);
  });

  it("shows the interconnect ID arithmetic: 2'b10 from M0 is 3'b010 (2), from M1 is 3'b110 (6)", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Two masters");
    const table = screen.getByRole("table");
    expect(within(table).getByText("3'b010")).toBeInTheDocument();
    expect(within(table).getByText("3'b110")).toBeInTheDocument();
    expect(within(table).getByText("6")).toBeInTheDocument();
    lockIn("M1:B, M0:A, M0:C");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("supports keyboard navigation between situations", () => {
    render(<AxiIdOrderingVisualizer />);
    const first = within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name: "Reads, same ID" });
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name: "Two masters" })).toHaveAttribute("aria-checked", "true");
  });
});
