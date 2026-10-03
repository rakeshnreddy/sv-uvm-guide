import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UVMTreeExplorer from "@/components/curriculum/interactives/UVMTreeExplorer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("UVMTreeExplorer", () => {
  it("numbers build_phase depth-first pre-order, siblings in name order", () => {
    render(<UVMTreeExplorer />);
    const tree = screen.getByRole("list", { name: /numbered in build_phase call order/ });
    expect(within(tree).getByLabelText("call 1").parentElement).toHaveTextContent("uvm_test_top");
    expect(within(tree).getByLabelText("call 3").parentElement).toHaveTextContent(/^3agt/);
    expect(within(tree).getByLabelText("call 4").parentElement).toHaveTextContent(/^4drv/);
    expect(within(tree).getByLabelText("call 7").parentElement).toHaveTextContent(/^7scb/);
  });

  it("switches to bottom-up connect_phase with the keyboard", () => {
    render(<UVMTreeExplorer />);
    const build = screen.getByRole("radio", { name: "build_phase, top-down" });
    fireEvent.keyDown(build, { key: "ArrowRight" });
    const tree = screen.getByRole("list", { name: /numbered in connect_phase call order/ });
    expect(within(tree).getByLabelText("call 1").parentElement).toHaveTextContent(/^1drv/);
    expect(within(tree).getByLabelText("call 7").parentElement).toHaveTextContent(/uvm_test_top/);
  });

  it("forgotten super.build_phase: children are still built, the PASSIVE setting is ignored", () => {
    render(<UVMTreeExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Forgotten super.build_phase" }));
    expect(screen.queryByText(/default; the config_db setting was never read/)).not.toBeInTheDocument();
    lockIn(/No children: without super.build_phase/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Children are created only by your own type_id::create calls/)).toBeInTheDocument();
    expect(screen.getByText(/UVM_ACTIVE \(default; the config_db setting was never read\)/)).toBeInTheDocument();
    expect(screen.getByText(/drv \(built; its own build_phase still runs\)/)).toBeInTheDocument();
  });

  it("restoring super.build_phase resets the prediction and makes the passive answer correct", () => {
    render(<UVMTreeExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Forgotten super.build_phase" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore the super.build_phase call" }));
    expect(screen.getByText(/With super.build_phase called/)).toBeInTheDocument();
    lockIn(/Only mon, with num_txns = 50/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/UVM_PASSIVE \(from config_db\)/)).toBeInTheDocument();
    expect(screen.getByText(/drv \(not built\)/)).toBeInTheDocument();
  });
});
