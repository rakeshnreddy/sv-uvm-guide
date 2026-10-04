import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmPolicyVisualizer from "@/components/visuals/UvmPolicyVisualizer";

const lockIn = (label: RegExp | string) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("UvmPolicyVisualizer", () => {
  it("compare: hides the field walk until the prediction is committed, then shows the threshold effect", () => {
    render(<UvmPolicyVisualizer />);
    expect(screen.queryByRole("table", { name: /How the comparer walked the fields/ })).not.toBeInTheDocument();
    lockIn("returns 0, get_result() = 2");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/default comparer threshold is 1/).length).toBeGreaterThan(0);
    const walk = screen.getByRole("table", { name: /How the comparer walked the fields/ });
    expect(within(walk).getAllByText(/not compared \(threshold\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/UVM_INFO @ 0: reporter \[MISCMP\] Miscompare for exp\.data/)).toBeInTheDocument();
  });

  it("compare: editing a field flag re-arms the prediction and changes the result", () => {
    render(<UvmPolicyVisualizer />);
    fireEvent.change(screen.getByRole("combobox", { name: "Flag for data" }), { target: { value: "nocompare" } });
    expect(screen.getByText("`uvm_field_int(data, UVM_ALL_ON | UVM_NOCOMPARE)")).toBeInTheDocument();
    lockIn("returns 0, get_result() = 1");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Miscompare for exp\.tag/)).toBeInTheDocument();
  });

  it("compare: UVM_REFERENCE scenario reports a handle miscompare", () => {
    render(<UvmPolicyVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "UVM_REFERENCE on cfg" }));
    lockIn("returns 0, get_result() = 1");
    expect(screen.getByText(/Miscompare for exp\.cfg: lhs = @7 : rhs = @9/)).toBeInTheDocument();
  });

  it("copy: the do_copy aliasing bug shares the nested object", () => {
    render(<UvmPolicyVisualizer />);
    const modes = screen.getByRole("radiogroup", { name: "Policy operation" });
    fireEvent.keyDown(within(modes).getByRole("radio", { name: "compare()" }), { key: "ArrowRight" });
    expect(within(modes).getByRole("radio", { name: "copy()" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/cfg = rhs_\.cfg;/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Handles and objects/ })).not.toBeInTheDocument();
    lockIn("p1 burst_len = 8");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/One pkt_cfg is shared by both packets/)).toBeInTheDocument();
  });

  it("copy: field-macro deep copy keeps p1 unchanged", () => {
    render(<UvmPolicyVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "copy()" }));
    fireEvent.click(screen.getByRole("radio", { name: "macro, UVM_ALL_ON" }));
    lockIn("p1 burst_len = 4");
    expect(screen.getByText(/Each packet owns its pkt_cfg/)).toBeInTheDocument();
  });

  it("print: teaches the 1800.2 flag rule and uses uvm_printer::set_default", () => {
    render(<UvmPolicyVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "print()" }));
    lockIn(/tag is printed and copied/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/uvm_printer::set_default\(uvm_table_printer::get_default\(\)\);/)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Output" })).toHaveTextContent("[UVM/FIELDS/NO_FLAG]");
    expect(screen.getByRole("figure", { name: "Output" })).not.toHaveTextContent(/tag\s+integral/);
    expect(screen.getByRole("figure", { name: "Output" })).toHaveTextContent(/addr\s+integral\s+32\s+'h40/);
    fireEvent.click(screen.getByRole("radio", { name: "tree" }));
    expect(screen.getByText(/uvm_tree_printer::get_default/)).toBeInTheDocument();
  });
});
