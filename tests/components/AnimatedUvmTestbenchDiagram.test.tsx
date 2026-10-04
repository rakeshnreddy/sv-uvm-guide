import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AnimatedUvmTestbenchDiagram from "@/components/diagrams/AnimatedUvmTestbenchDiagram";

const lockIn = (answer: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("AnimatedUvmTestbenchDiagram", () => {
  it("hides the built topology until the learner predicts", () => {
    render(<AnimatedUvmTestbenchDiagram />);
    expect(screen.queryByLabelText("Build log")).not.toBeInTheDocument();
    lockIn(/^sqr, drv and mon/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Build log")).toHaveTextContent("uvm_test_top.env.out_agt [BUILD] get_is_active() = UVM_PASSIVE; built mon");
  });

  it("skipping super.build_phase makes the passive agent build a driver anyway", () => {
    render(<AnimatedUvmTestbenchDiagram />);
    lockIn(/^Only mon/);
    fireEvent.click(screen.getByRole("checkbox", { name: /skips super.build_phase/ }));
    expect(screen.getByLabelText("Build log")).toHaveTextContent("out_agt [BUILD] get_is_active() = UVM_ACTIVE; built sqr, drv, mon");
    expect(screen.getByText(/configured passive but still built a driver/)).toBeInTheDocument();
  });

  it("an unguarded connect_phase in a passive agent is a null-handle failure", () => {
    render(<AnimatedUvmTestbenchDiagram />);
    lockIn(/^Only mon/);
    fireEvent.click(screen.getByRole("checkbox", { name: /no get_is_active\(\) guard/ }));
    expect(screen.getByLabelText("Build log")).toHaveTextContent("null object access in uvm_test_top.env.out_agt.connect_phase");
  });

  it("switches an agent's mode with the keyboard", () => {
    render(<AnimatedUvmTestbenchDiagram />);
    lockIn(/^Only mon/);
    const group = screen.getByRole("radiogroup", { name: "in_agt is_active" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "UVM_ACTIVE" }), { key: "ArrowRight" });
    expect(screen.getByLabelText("Build log")).toHaveTextContent("in_agt [BUILD] get_is_active() = UVM_PASSIVE; built mon");
  });
});
