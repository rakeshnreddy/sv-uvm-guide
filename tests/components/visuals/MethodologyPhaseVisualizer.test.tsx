import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MethodologyPhaseVisualizer from "@/components/visuals/MethodologyPhaseVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("MethodologyPhaseVisualizer", () => {
  it("adding to the common domain after reset is a PH_BAD_ADD fatal, revealed only after predicting", () => {
    render(<MethodologyPhaseVisualizer />);
    expect(screen.queryByText(/cannot find after_phase/)).not.toBeInTheDocument();
    lockIn(/In its own slot between two neighbours/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/UVM_FATAL \[PH_BAD_ADD\] cannot find after_phase 'reset' within node 'common'/)).toBeInTheDocument();
  });

  it("the uvm schedule accepts the reset anchor and splices load_fw in serially", () => {
    render(<MethodologyPhaseVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "get_uvm_schedule()" }));
    expect(screen.getByText(/uvm_domain::get_uvm_schedule\(\)\.add/)).toBeInTheDocument();
    lockIn(/In its own slot between two neighbours/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const sched = screen.getByRole("list", { name: /uvm_sched .* in execution order/ });
    const items = within(sched).getAllByRole("listitem").map((li) => li.textContent?.replace("→", "").trim());
    expect(items.slice(0, 4)).toEqual(["pre_reset", "reset", "✚ load_fw", "post_reset"]);
  });

  it("without exec_task the phase runs but calls no component code", () => {
    render(<MethodologyPhaseVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "get_uvm_schedule()" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove the exec_task override" }));
    expect(screen.getByText(/no exec_task override: the inherited one is empty/)).toBeInTheDocument();
    lockIn(/load_fw_phase task is never called/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/default exec_task is empty/)).toBeInTheDocument();
  });

  it("with_phase(main) runs the custom phase in a parallel branch (positions picked with the keyboard)", () => {
    render(<MethodologyPhaseVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "get_uvm_schedule()" }));
    const pos = screen.getByRole("radio", { name: ".after_phase(reset)" });
    fireEvent.keyDown(pos, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("radio", { name: ".after_phase(reset), .before_phase(configure)" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: ".with_phase(main)" })).toHaveAttribute("aria-checked", "true");
    lockIn(/In a parallel branch/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("parallel branch")).toHaveTextContent(/main.*load_fw/);
  });

  it("a task phase after extract is accepted by the common domain, with a warning", () => {
    render(<MethodologyPhaseVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: ".after_phase(extract)" }));
    lockIn(/In its own slot between two neighbours/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/never timed out/)).toBeInTheDocument();
  });
});
