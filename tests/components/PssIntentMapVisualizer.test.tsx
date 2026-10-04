import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PssIntentMapVisualizer, { PssIntentMapVisualizer as Named } from "@/components/visualizers/PssIntentMapVisualizer";

describe("PssIntentMapVisualizer", () => {
  it("keeps the named and default exports used by the lazy registry", () => {
    expect(Named).toBe(PssIntentMapVisualizer);
  });

  it("shows the PSS source (buffer, resource pool, actions, exec blocks, activity) before any result", () => {
    render(<PssIntentMapVisualizer />);
    const source = screen.getByRole("list", { name: "mem_test.pss (Accellera PSS)" });
    expect(source).toHaveTextContent("buffer mem_buf_s {");
    expect(source).toHaveTextContent("pool [2] dma_chan_r chan_p;");
    expect(source).toHaveTextContent("lock dma_chan_r chan;");
    expect(source).toHaveTextContent("exec body SV");
    expect(source).toHaveTextContent("do mem_subsys_c::read_check_a;");
    expect(screen.queryByRole("region", { name: "Resolved scenario" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("generated-code")).not.toBeInTheDocument();
  });

  it("read-only scenario: a wrong prediction is diagnosed and the inferred write is revealed", () => {
    render(<PssIntentMapVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Scenario" });
    fireEvent.keyDown(within(group).getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("Read only");

    fireEvent.click(screen.getByLabelText(/leaves any unbound input fields random/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/A buffer input is never left dangling/)).toBeInTheDocument();
    const resolved = screen.getByRole("region", { name: "Resolved scenario" });
    expect(within(resolved).getByRole("group", { name: /write_a#1 inferred, read_check_a#2/ })).toBeInTheDocument();
    expect(within(resolved).getAllByText(/inferred/i).length).toBeGreaterThan(0);
  });

  it("the C target checks inline while the UVM target leaves checking to the scoreboard", () => {
    render(<PssIntentMapVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("generated-code").textContent).toMatch(/if \(mem_read32\(0x[0-9A-F]+\) != 0x[0-9A-F]+\) test_fail\(\);/);
    fireEvent.click(screen.getByRole("radio", { name: "SystemVerilog / UVM simulation" }));
    const sv = screen.getByTestId("generated-code").textContent ?? "";
    expect(sv).toContain("s.start(m_sequencer);");
    expect(sv).not.toMatch(/uvm_error|!=/);
    expect(screen.getByText(/Checking stays in the scoreboard/)).toBeInTheDocument();
  });

  it("a one-instance pool cannot serve two parallel locks: the tool reports a solve-time error", () => {
    render(<PssIntentMapVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Two DMA copies in parallel, pool [1]" }));
    expect(screen.getByRole("list", { name: "mem_test.pss (Accellera PSS)" })).toHaveTextContent("pool [1] dma_chan_r chan_p;");
    fireEvent.click(screen.getByLabelText(/adds producer actions/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/cannot add resource instances/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/chan_p holds only 1 instance/);
    expect(screen.getByTestId("generated-code")).toHaveTextContent(/nothing generated/);
  });
});
