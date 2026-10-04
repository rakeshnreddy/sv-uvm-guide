import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmVirtualSequencerDiagram from "@/components/diagrams/UvmVirtualSequencerDiagram";

describe("UvmVirtualSequencerDiagram", () => {
  it("declares itself an illustration and explains the selected block", () => {
    render(<UvmVirtualSequencerDiagram />);
    expect(screen.getByText("Conceptual illustration")).toBeInTheDocument();
    expect(screen.getByText("soc_vseq: the virtual sequence")).toBeInTheDocument();
  });

  it("blocks are keyboard selectable and show their code", () => {
    render(<UvmVirtualSequencerDiagram />);
    const vsqr = screen.getByRole("button", { name: /SQR soc_vsqr/ });
    fireEvent.keyDown(vsqr, { key: "Enter" });
    expect(screen.getByText("soc_vsqr: the virtual sequencer")).toBeInTheDocument();
    expect(screen.getByText(/cfg_sequencer cfg_sqr;/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show the env wiring" }));
    expect(screen.getByText(/vsqr.data_sqr = data_agt.sqr;/)).toBeInTheDocument();
  });

  it("the start(null) variant has no virtual sequencer", () => {
    render(<UvmVirtualSequencerDiagram />);
    fireEvent.click(screen.getByRole("radio", { name: "Handles in the sequence (start(null))" }));
    expect(screen.queryByRole("button", { name: /SQR soc_vsqr/ })).not.toBeInTheDocument();
    expect(screen.getByText(/vseq.start\(null\);/)).toBeInTheDocument();
  });

  it("prediction: a child runs on the sequencer passed to start()", () => {
    render(<UvmVirtualSequencerDiagram />);
    fireEvent.click(screen.getByLabelText(/soc_vsqr, because the parent sequence runs there/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/A child runs on the sequencer passed to its start\(\)/)).toBeInTheDocument();
  });
});
