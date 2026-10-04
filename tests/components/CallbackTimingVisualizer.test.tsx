import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CallbackTimingVisualizer from "@/components/visuals/CallbackTimingVisualizer";

const lockIn = (label: string | RegExp, index = 0) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[index]);
};

describe("CallbackTimingVisualizer", () => {
  it("hides the build trace until a prediction is locked in; test build_phase dereferences a null env.agt0", () => {
    render(<CallbackTimingVisualizer />);
    expect(screen.queryByRole("list", { name: "Elaboration order" })).not.toBeInTheDocument();
    lockIn("Simulation stops with a null-object error during build");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Elaboration order" })).getByText(/Null object access: env\.agt0 is null/)).toBeInTheDocument();
  });

  it("env build_phase (chosen from the keyboard) registers type-wide; the order question follows", () => {
    render(<CallbackTimingVisualizer />);
    const where = screen.getByRole("radiogroup", { name: "Where the add() runs" });
    fireEvent.keyDown(within(where).getByRole("radio", { name: "err_test.build_phase" }), { key: "ArrowRight" });
    expect(within(where).getByRole("radio", { name: "my_env.build_phase" })).toHaveAttribute("aria-checked", "true");

    lockIn("No driver corrupts anything");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/null is how you ask for type-wide registration/)).toBeInTheDocument();
    expect(screen.getAllByText("log_cb → err_cb").length).toBeGreaterThan(0);

    lockIn("The original CRC, 0x5A", 0);
    expect(screen.getAllByText(/^Correct\./).length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    // Both drivers, both packets: the leak reaches agt1 too.
    expect(within(table).getAllByText(/\(corrupted\)/)).toHaveLength(4);
    expect(within(table).getAllByRole("rowheader", { name: "env.agt1.drv" })[0].closest("tr")).toHaveTextContent("(corrupted)");
  });

  it("UVM_PREPEND makes log_cb print the corrupted CRC", () => {
    render(<CallbackTimingVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "err_test.connect_phase" }));
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/ }));
    fireEvent.click(screen.getByRole("radio", { name: "UVM_PREPEND" }));
    lockIn("Only agt0.drv corrupts CRCs");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    lockIn("The original CRC, 0x5A", 0);
    expect(screen.getAllByText(/UVM_PREPEND put it in front of log_cb/).length).toBeGreaterThan(0);
  });

  it("debug mode: the env build_phase add() is the culprit; connect_phase fixes it, add_by_name does not", () => {
    render(<CallbackTimingVisualizer mode="debug" />);
    expect(screen.getByLabelText("Failing log")).toHaveTextContent("agt1 is not under error injection");
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: `uvm_register_cb/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: uvm_callbacks#\(my_driver, drv_cb\)::add\(agt0\.drv/ }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/add_by_name/));
    expect(screen.getByText(/Neither driver corrupts anything/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Move the add() to my_env.connect_phase"));
    expect(screen.getByText(/Only agt0\.drv corrupts its CRCs/)).toBeInTheDocument();
  });
});
