import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DPIBoundaryInspector from "@/components/visuals/DPIBoundaryInspector";

const prompts = () => screen.getAllByRole("group").filter((g) => g.tagName === "FIELDSET");

describe("DPIBoundaryInspector", () => {
  it("gates the C prototype behind a prediction and diagnoses the svLogicVecVal misconception for int", () => {
    render(<DPIBoundaryInspector />);
    expect(screen.queryByText("void c_use(int x);")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("const svLogicVecVal* x"));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/svLogicVecVal is only for 4-state packed vectors/)).toBeInTheDocument();
    expect(screen.getByText("void c_use(int x);")).toBeInTheDocument();
  });

  it("output strings arrive as const char** (keyboard type selection)", () => {
    render(<DPIBoundaryInspector />);
    const types = screen.getByRole("radiogroup", { name: "SystemVerilog formal type" });
    fireEvent.click(within(types).getByRole("radio", { name: "string" }));
    const dirs = screen.getByRole("radiogroup", { name: "Argument direction" });
    const input = within(dirs).getByRole("radio", { name: "input" });
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(within(dirs).getByRole("radio", { name: "output / inout" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByLabelText("const char** x"));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("open arrays use real svdpi accessors, never svGetIntElement", () => {
    render(<DPIBoundaryInspector />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "SystemVerilog formal type" })).getByRole("radio", { name: "int x[]" }));
    fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[0]);
    expect(screen.getAllByText(/svGetArrElemPtr1/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/svGetIntElement/)).not.toBeInTheDocument();
  });

  it("legality: a function calling an exported task is illegal at run time, not a compile error (§35.8)", () => {
    render(<DPIBoundaryInspector />);
    fireEvent.click(screen.getByRole("radio", { name: "function calls exported task" }));
    expect(screen.queryByText(/never legal/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Compile error: the SystemVerilog declaration itself is rejected/));
    fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[1]);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/never legal to call an exported task from an imported function/).length).toBeGreaterThan(0);
  });

  it("legality: a pure task is a compile error and a blocking socket task freezes simulation time", () => {
    render(<DPIBoundaryInspector />);
    fireEvent.click(screen.getByRole("radio", { name: "pure task" }));
    fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[1]);
    expect(screen.getByText(/✕ Compile error/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "task blocks on a socket" }));
    fireEvent.click(screen.getAllByRole("button", { name: /reveal without predicting/i })[1]);
    expect(screen.getAllByText(/freezes the whole simulator/).length).toBeGreaterThan(0);
  });

  it("has no timers or random hazard: nothing changes without input", () => {
    render(<DPIBoundaryInspector />);
    expect(prompts().length).toBe(2);
    expect(screen.queryByText(/Simulation Blocked/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Force Hazard/i })).not.toBeInTheDocument();
  });
});
