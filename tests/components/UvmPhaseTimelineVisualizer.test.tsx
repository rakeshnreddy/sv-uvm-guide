import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UvmPhaseTimelineVisualizer } from "@/components/visualizers/UvmPhaseTimelineVisualizer";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("UvmPhaseTimelineVisualizer", () => {
  it("shows the 12 runtime phases as the standard uvm schedule beside run_phase, not as optional extras", () => {
    render(<UvmPhaseTimelineVisualizer />);
    const map = screen.getByRole("group", { name: "UVM phase map" });
    expect(within(map).getByText(/uvm domain, schedule "uvm_sched" ∥ run_phase/)).toBeInTheDocument();
    for (const name of ["pre_reset_phase", "main_phase", "post_shutdown_phase"]) {
      expect(within(map).getByRole("button", { name: new RegExp(`^${name}: task`) })).toBeInTheDocument();
    }
    expect(screen.queryByText(/optional|custom phases/i)).not.toBeInTheDocument();
  });

  it("labels each common phase with its traversal direction (final is top-down, report bottom-up)", () => {
    render(<UvmPhaseTimelineVisualizer />);
    expect(screen.getByRole("button", { name: /^build_phase: function, top-down/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^connect_phase: function, bottom-up/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^report_phase: function, bottom-up/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^final_phase: function, top-down/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^final_phase:/ }));
    expect(screen.getByText(/uvm_final_phase extends uvm_topdown_phase/)).toBeInTheDocument();
  });

  it("hides the call order until a prediction is locked in, then confirms the bottom-up first call", () => {
    render(<UvmPhaseTimelineVisualizer />);
    expect(screen.queryByRole("list", { name: "Call log" })).not.toBeInTheDocument();
    lockIn("uvm_test_top.env.agt.drv");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const log = screen.getByRole("list", { name: "Call log" });
    expect(within(log).getByText("1. uvm_test_top.env.agt.drv.connect_phase()")).toBeInTheDocument();
  });

  it("diagnoses the creation-order misconception", () => {
    render(<UvmPhaseTimelineVisualizer />);
    lockIn(/env\.scb \(env creates it first\)/);
    expect(screen.getByText(/Creation order does not matter/)).toBeInTheDocument();
  });

  it("asks a top-down question for build_phase (picked with the keyboard) and steps through the order", () => {
    render(<UvmPhaseTimelineVisualizer />);
    const picker = screen.getByRole("radiogroup", { name: "Function phase" });
    const connect = within(picker).getByRole("radio", { name: "connect_phase" });
    fireEvent.keyDown(connect, { key: "ArrowLeft" });
    expect(within(picker).getByRole("radio", { name: "build_phase" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Whose build_phase is called third\?/)).toBeInTheDocument();
    lockIn("uvm_test_top.env.agt");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next call" }));
    fireEvent.click(screen.getByRole("button", { name: "Next call" }));
    const log = screen.getByRole("list", { name: "Call log" });
    expect(within(log).getByText("3. uvm_test_top.env.agt.build_phase()")).toBeInTheDocument();
  });

  it("runtime lanes: components leave reset_phase together when the last objection drops", () => {
    render(<UvmPhaseTimelineVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "run_phase ∥ uvm schedule" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    lockIn(/At 30 ns, right after its own reset work/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/synchronized across the domain/)).toBeInTheDocument();
    const row = within(screen.getByRole("table")).getByText("configure_phase").closest("tr") as HTMLElement;
    expect(within(row).getAllByText("100 ns")[0]).toBeInTheDocument();
  });

  it("runtime lanes: run_phase with no objection still waits for the uvm schedule", () => {
    render(<UvmPhaseTimelineVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "run_phase ∥ uvm schedule" }));
    fireEvent.click(screen.getByRole("radio", { name: "Runtime phases only" }));
    lockIn(/When post_shutdown ends \(470 ns\)/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const row = within(screen.getByRole("table")).getByText("run_phase").closest("tr") as HTMLElement;
    expect(within(row).getByText("470 ns")).toBeInTheDocument();
    expect(within(row).getByText(/waited for the uvm schedule/)).toBeInTheDocument();
  });

  it("runtime lanes: main_phase without its own objection ends at 0 ns while run_phase continues", () => {
    render(<UvmPhaseTimelineVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "run_phase ∥ uvm schedule" }));
    fireEvent.click(screen.getByRole("radio", { name: "Objection only in run_phase" }));
    lockIn(/At 500 ns, together with run_phase/);
    expect(screen.getByText(/keeps run_phase alive, not main_phase/)).toBeInTheDocument();
    const main = within(screen.getByRole("table")).getByText("main_phase").closest("tr") as HTMLElement;
    expect(within(main).getByText(/no objection: ended at once/)).toBeInTheDocument();
  });
});
