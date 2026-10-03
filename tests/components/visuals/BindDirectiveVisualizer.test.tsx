import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BindDirectiveVisualizer from "@/components/visuals/BindDirectiveVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("BindDirectiveVisualizer", () => {
  it("labels bind as elaboration-time, not a compiler directive", () => {
    render(<BindDirectiveVisualizer />);
    expect(screen.getByText(/is not a compiler directive/)).toBeInTheDocument();
    expect(screen.getByText(/processed at elaboration/)).toBeInTheDocument();
    expect(screen.queryByText(/Compile-time Directive/i)).not.toBeInTheDocument();
  });

  it("hides the elaborated hierarchy until the learner predicts the bound path", () => {
    render(<BindDirectiveVisualizer />);
    expect(screen.queryByRole("list", { name: "Elaborated hierarchy" })).not.toBeInTheDocument();
    lockIn(/tb_top\.dut\.u_slave_0\.chk_inst and tb_top\.dut\.u_slave_1\.chk_inst/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const tree = screen.getByRole("list", { name: "Elaborated hierarchy" });
    expect(within(tree).getByLabelText("tb_top.dut.u_slave_0.chk_inst, bound ahb_protocol_chk")).toBeInTheDocument();
    expect(within(tree).getByLabelText("tb_top.dut.u_slave_1.chk_inst, bound ahb_protocol_chk")).toBeInTheDocument();
  });

  it("diagnoses the 'lands where the bind is written' misconception", () => {
    render(<BindDirectiveVisualizer />);
    lockIn(/where the bind statement is written/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/created inside the target scope/).length).toBeGreaterThan(0);
  });

  it("the instance form binds exactly one instance (keyboard selection)", () => {
    render(<BindDirectiveVisualizer />);
    const forms = screen.getByRole("radiogroup", { name: "Bind form" });
    const first = within(forms).getByRole("radio", { name: "every ahb_slave" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(within(forms).getByRole("radio", { name: "listed instances" }), { key: "ArrowRight" });
    expect(within(forms).getByRole("radio", { name: "one instance path" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/^bind tb_top\.dut\.u_slave_0 ahb_protocol_chk chk_inst/)).toBeInTheDocument();
    lockIn(/tb_top\.dut\.u_slave_0\.chk_inst only/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.queryByLabelText("tb_top.dut.u_slave_1.chk_inst, bound ahb_protocol_chk")).not.toBeInTheDocument();
  });

  it("two binds that introduce the same instance name are an elaboration error", () => {
    render(<BindDirectiveVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "two binds, same name" }));
    lockIn(/None: elaboration stops with an error/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/✕ Elaboration error/).length).toBe(2);
  });
});
