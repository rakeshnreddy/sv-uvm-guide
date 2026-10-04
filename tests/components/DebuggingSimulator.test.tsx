import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DefaultDebuggingSimulator, { DebuggingSimulator } from "@/components/ui/DebuggingSimulator";

describe("DebuggingSimulator (hang triage)", () => {
  it("keeps the named and default exports", () => {
    expect(DefaultDebuggingSimulator).toBe(DebuggingSimulator);
  });

  it("shows three UVM hang scenarios for scenario='hang' and four for 'all'", () => {
    const { unmount } = render(<DebuggingSimulator scenario="hang" />);
    expect(within(screen.getByRole("radiogroup", { name: "Hang scenario" })).getAllByRole("radio")).toHaveLength(3);
    unmount();
    render(<DebuggingSimulator scenario="all" />);
    expect(within(screen.getByRole("radiogroup", { name: "Hang scenario" })).getAllByRole("radio")).toHaveLength(4);
  });

  it("missing item_done: the log shows the repeated sequencer error and PH_TIMEOUT", () => {
    render(<DebuggingSimulator scenario="hang" />);
    const log = screen.getByRole("list", { name: /Simulation log/ });
    expect(log).toHaveTextContent("Get_next_item called twice without item_done or get in between");
    expect(log).toHaveTextContent("×99");
    expect(log).toHaveTextContent("[PH_TIMEOUT] Explicit timeout of 1000 hit");
  });

  it("the code and fixes stay hidden until the owner is found; a wrong suspect gets diagnostic feedback", () => {
    render(<DebuggingSimulator scenario="hang" />);
    expect(screen.queryByText("The owner's code")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "agt.sqr (the sequencer)" }));
    expect(screen.getByText(/Not the owner\./)).toBeInTheDocument();
    expect(screen.getByText(/enforcing the protocol/)).toBeInTheDocument();
    expect(screen.queryByText("The owner's code")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "agt.drv (the driver)" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();
    expect(screen.getByText("The owner's code")).toBeInTheDocument();
  });

  it("the model reruns the chosen fix: a longer timeout still hangs, item_done ends cleanly", () => {
    render(<DebuggingSimulator scenario="hang" />);
    fireEvent.click(screen.getByRole("button", { name: "agt.drv (the driver)" }));
    fireEvent.click(screen.getByRole("radio", { name: /Raise the timeout to 10 µs/ }));
    expect(screen.getByText(/Hang: PH_TIMEOUT fatal at t = 10000 ns/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Call seq_item_port.item_done\(\) after drive\(req\)/ }));
    expect(screen.getByText(/Ends cleanly at t = 30 ns: 3 of 3 items, 0 UVM_ERRORs/)).toBeInTheDocument();
  });

  it("stuck objection: the objection trace and display_objections point at the scoreboard", () => {
    render(<DebuggingSimulator scenario="hang" />);
    const group = screen.getByRole("radiogroup", { name: "Hang scenario" });
    fireEvent.keyDown(within(group).getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "One mismatch, then silence" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: /UVM_OBJECTION_TRACE/ }));
    expect(screen.getByRole("list", { name: /UVM_OBJECTION_TRACE/ })).toHaveTextContent("Object uvm_test_top.env.scb raised 1 run_objection objection(s) (pending compare)");
    const probe = screen.getByRole("button", { name: /display_objections/ });
    fireEvent.click(probe);
    expect(probe).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/The total objection count is 1/)).toBeInTheDocument();
  });

  it("grab leak: the sequencer probe names the grabber", () => {
    render(<DebuggingSimulator scenario="hang" />);
    fireEvent.click(screen.getByRole("radio", { name: "Stimulus stops after the interrupt" }));
    fireEvent.click(screen.getByRole("button", { name: /is_grabbed/ }));
    expect(screen.getByText(/current_grabber\(\) = uvm_test_top\.env\.agt\.sqr\.irq_seq/)).toBeInTheDocument();
  });
});
