import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AxiChannelHandshakeVisualizer from "@/components/visualizers/AxiChannelHandshakeVisualizer";

const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const scenario = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name }));

describe("AxiChannelHandshakeVisualizer (handshake focus)", () => {
  it("hides handshake markers until the learner commits, then explains the edge", () => {
    render(<AxiChannelHandshakeVisualizer focus="handshake" />);
    expect(screen.getByTestId("axi-handshake-basics")).toBeInTheDocument();
    expect(screen.getByText("At which edge does the address transfer?")).toBeInTheDocument();
    expect(screen.queryByText(/handshake on AW/)).not.toBeInTheDocument();
    lockIn("Edge 3");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Edge 3: handshake on AW \(0x1000\)/)).toBeInTheDocument();
    expect(screen.getByText(/AWVALID and AWREADY are both 1 at edge 3/)).toBeInTheDocument();
  });

  it("diagnoses 'VALID alone transfers' when READY is still low", () => {
    render(<AxiChannelHandshakeVisualizer focus="handshake" />);
    lockIn("Edge 2");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/AWREADY is 0 at edge 2/)).toBeInTheDocument();
  });

  it("re-runs the model when the learner toggles a READY cell, and re-arms the prediction", () => {
    render(<AxiChannelHandshakeVisualizer focus="handshake" />);
    lockIn("Edge 3");
    fireEvent.click(screen.getByRole("button", { name: "AWREADY at edge 1: 0. Toggle." }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn("Edge 1");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("debug preset: the learner must find the edge where VALID was dropped", () => {
    render(<AxiChannelHandshakeVisualizer focus="handshake" />);
    scenario("Debug: dropped VALID");
    fireEvent.click(screen.getByRole("button", { name: "Select edge 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Check this edge" }));
    expect(screen.getByText(/Edge 2 is legal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select edge 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Check this edge" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();
    expect(screen.getAllByText(/fell at edge 3 without a handshake/).length).toBeGreaterThan(0);
  });

  it("supports keyboard navigation between scenarios", () => {
    render(<AxiChannelHandshakeVisualizer focus="handshake" />);
    const first = within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name: "VALID first" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name: "READY first" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/AWREADY is already 1 at edge 1/)).toBeInTheDocument();
  });
});

describe("AxiChannelHandshakeVisualizer (channels focus)", () => {
  it("W before AW: BVALID is hidden until the prediction, and AXI4 makes it wait for the AW handshake", () => {
    render(<AxiChannelHandshakeVisualizer />);
    expect(screen.getByTestId("axi-channel-handshake-visualizer")).toBeInTheDocument();
    expect(screen.queryAllByText("BVALID")).toHaveLength(0);
    lockIn("Edge 3");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/waiting for the AW handshake/)).toBeInTheDocument();
    expect(screen.getAllByText("BVALID").length).toBeGreaterThan(0);
  });

  it("the correct answer for W before AW is edge 5", () => {
    render(<AxiChannelHandshakeVisualizer />);
    lockIn("Edge 5");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("legacy-slave debug: B before AW is caught at edge 3 and the matching SVA line is highlighted", () => {
    render(<AxiChannelHandshakeVisualizer />);
    scenario("Debug: legacy slave");
    fireEvent.click(screen.getByRole("button", { name: "Select edge 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Check this edge" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();
    const current = document.querySelectorAll('[aria-current="step"]');
    expect([...current].some((el) => /a_b_dep|BVALID/.test(el.textContent ?? ""))).toBe(true);
  });

  it("backpressure on W does not delay the read: RLAST transfers at edge 3", () => {
    render(<AxiChannelHandshakeVisualizer />);
    scenario("Backpressure on W only");
    lockIn("Edge 3");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });
});
