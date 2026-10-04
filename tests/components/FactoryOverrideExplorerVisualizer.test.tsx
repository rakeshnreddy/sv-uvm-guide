import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FactoryOverrideExplorerVisualizer } from "@/components/visualizers/FactoryOverrideExplorerVisualizer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const choose = (label: string) => fireEvent.click(screen.getByLabelText(label));
const hierarchy = () => screen.getByRole("list", { name: "Component hierarchy" });

describe("FactoryOverrideExplorerVisualizer", () => {
  it("hides built types and the create() log until a prediction is locked in", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    expect(within(hierarchy()).getAllByText("built type hidden until you predict").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/create\(\) log for/)).not.toBeInTheDocument();

    choose("mock_driver");
    lockIn();
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("create() log for uvm_test_top.env.agt0.drv")).toHaveTextContent(/type override #1: base_driver → mock_driver/);
    expect(within(hierarchy()).queryAllByText("built type hidden until you predict")).toHaveLength(0);
    expect(within(hierarchy()).getAllByText("▣ TYPE #1")).toHaveLength(2);
  });

  it("two matching instance overrides: the first registered wins, and reordering flips the answer", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Two instance overrides" }));

    choose("err_driver");
    lockIn();
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/was registered first/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("create() log for uvm_test_top.env.agt0.drv")).toHaveTextContent(/never reached/);

    // Reordering is a new experiment: the prediction resets.
    fireEvent.click(screen.getByRole("button", { name: "Move override #2 earlier" }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    choose("err_driver");
    lockIn();
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });

  it("debug preset: an incompatible override ends the build with FCTTYP, and the fix removes it", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Debug: FCTTYP fatal" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByRole("list", { name: "UVM messages" })).toHaveTextContent(/UVM_FATAL \[FCTTYP\] Factory did not return a component of type 'base_driver'/);
    expect(within(hierarchy()).getAllByText("— not built").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /apply the fix/i }));
    expect(screen.queryByRole("list", { name: "UVM messages" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/Result: mock_driver\./)).toBeInTheDocument();
  });

  it("an override registered in connect_phase is too late for every driver", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Debug: override ignored" }));
    choose("mock_driver");
    lockIn();
    expect(screen.getAllByText(/after this create\(\) already ran/).length).toBeGreaterThan(0);
  });

  it("new() in the agent bypasses the factory", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    fireEvent.click(screen.getByRole("checkbox", { name: /builds drv with new\(\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/Result: base_driver\./)).toBeInTheDocument();
    expect(within(hierarchy()).getAllByText("new() · factory bypassed")).toHaveLength(2);
  });

  it("is keyboard operable: arrow keys switch scenarios and node buttons select the target", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    const free = screen.getByRole("radio", { name: "Free play" });
    fireEvent.keyDown(free, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Two instance overrides" })).toHaveAttribute("aria-checked", "true");

    const mon = screen.getByRole("button", { name: /^uvm_test_top\.env\.agt1\.mon, requested my_monitor/ });
    fireEvent.click(mon);
    expect(mon).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("uvm_test_top.env.agt1.mon", { selector: "code" })).toBeInTheDocument();
  });

  it("adds an instance override from the form and shows the generated call", () => {
    render(<FactoryOverrideExplorerVisualizer />);
    fireEvent.click(screen.getByText("Add an override"));
    fireEvent.click(screen.getByRole("button", { name: /^Add override/ }));
    expect(screen.getAllByText('base_driver::type_id::set_inst_override(err_driver::get_type(), "env.agt1.drv", this);').length).toBeGreaterThan(0);
  });
});
