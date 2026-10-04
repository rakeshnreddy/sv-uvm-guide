import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TlmConnectionBuilderVisualizer } from "@/components/visualizers/TlmConnectionBuilderVisualizer";

const endpoint = (id: string) => screen.getByRole("button", { name: new RegExp(`^${id.replace(/\./g, "\\.")} \\(`) });
const connect = (from: string, to: string) => {
  fireEvent.click(endpoint(from));
  fireEvent.click(endpoint(to));
};
const scenario = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name: name }));

describe("TlmConnectionBuilderVisualizer", () => {
  it("accepts port.connect(imp) and generates the agent's connect_phase code", () => {
    render(<TlmConnectionBuilderVisualizer />);
    connect("drv.seq_item_port", "sqr.seq_item_export");
    expect(screen.getByTestId("connect-verdict")).toHaveTextContent("✓ Connected.");
    const code = screen.getByRole("list", { name: "Generated connect_phase code" });
    expect(within(code).getByText("drv.seq_item_port.connect(sqr.seq_item_export);")).toBeInTheDocument();
    expect(within(code).getByText("// bus_agent::connect_phase")).toBeInTheDocument();
  });

  it("rejects imp.connect(port) with uvm-core's message and an explanation", () => {
    render(<TlmConnectionBuilderVisualizer />);
    connect("sqr.seq_item_export", "drv.seq_item_port");
    const verdict = screen.getByTestId("connect-verdict");
    expect(verdict).toHaveTextContent("UVM_ERROR. Not connected.");
    expect(verdict).toHaveTextContent("[Connection Error] Cannot call an imp port's connect method.");
    expect(verdict).toHaveTextContent(/Why:/);
    expect(screen.getByText("// no connect() calls yet")).toBeInTheDocument();
  });

  it("accepts hierarchical promotion child port → parent port and writes it in the parent", () => {
    render(<TlmConnectionBuilderVisualizer />);
    connect("mon.ap", "agt.ap");
    expect(screen.getByTestId("connect-verdict")).toHaveTextContent("✓ Connected.");
    expect(within(screen.getByRole("list", { name: "Generated connect_phase code" })).getByText("mon.ap.connect(ap);")).toBeInTheDocument();
  });

  it("flags a different interface family as a compile error", () => {
    render(<TlmConnectionBuilderVisualizer />);
    connect("drv.seq_item_port", "scb.item_imp");
    expect(screen.getByTestId("connect-verdict")).toHaveTextContent("Compile error. Not connected.");
  });

  it("hides elaboration results until the learner runs to end_of_elaboration, then reports min_size errors", () => {
    render(<TlmConnectionBuilderVisualizer />);
    scenario("Env with an analysis FIFO");
    connect("agt.ap", "fifo.analysis_export");
    expect(screen.queryByLabelText("Simulation log")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run to end_of_elaboration" }));
    const log = screen.getByLabelText("Simulation log");
    expect(log).toHaveTextContent("uvm_test_top.env.scb.get_port [Connection Error] connection count of 0 does not meet required minimum of 1");
    expect(log).toHaveTextContent("[BUILDERR] stopping due to build errors");
  });

  it("the shown solution passes elaboration and meets every goal", () => {
    render(<TlmConnectionBuilderVisualizer />);
    scenario("Promotion through two boundaries");
    fireEvent.click(screen.getByRole("button", { name: "Show a solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Run to end_of_elaboration" }));
    expect(screen.getByText(/every port and export reaches an allowed number of imps/)).toBeInTheDocument();
    const goals = screen.getByRole("list", { name: "Goals" });
    expect(within(goals).getAllByText("✓", { exact: false })).toHaveLength(3);
  });

  it("spot-the-bug mode gates the outcome behind a prediction", () => {
    render(<TlmConnectionBuilderVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Spot the bug" }));
    expect(screen.queryByLabelText("Simulation log")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Cannot call an imp port's connect method/ }));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("Cannot call an imp port's connect method");
  });

  it("endpoint buttons are keyboard reachable real buttons with pressed state", () => {
    render(<TlmConnectionBuilderVisualizer />);
    const btn = endpoint("mon.ap");
    expect(btn.tagName).toBe("BUTTON");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
