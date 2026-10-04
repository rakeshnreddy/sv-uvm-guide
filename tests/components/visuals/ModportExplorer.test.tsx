import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModportExplorer } from "@/components/visuals/ModportExplorer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("ModportExplorer", () => {
  it("draws directions from the module's side: input flows in, output flows out", () => {
    render(<ModportExplorer />);
    expect(screen.getAllByText("module master_driver (simple_bus_if.master bus);").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("bus.ready: input, flows from the interface into the module")).toBeInTheDocument();
    expect(screen.getByLabelText("bus.addr: output, flows out of the module into the interface")).toBeInTheDocument();
  });

  it("hides the verdict for driving an input until the learner predicts, then classifies it as a compile-time error", () => {
    render(<ModportExplorer />);
    expect(screen.queryByText(/✕ Compile-time error/)).not.toBeInTheDocument();
    lockIn(/The tool rejects it before simulation starts/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/✕ Compile-time error/)).toBeInTheDocument();
    expect(screen.getAllByText(/§23\.3\.3\.2/).length).toBeGreaterThan(0);
  });

  it("diagnoses the run-time misconception", () => {
    render(<ModportExplorer />);
    lockIn(/It compiles, then fails or produces X/);
    expect(screen.getByText(/Direction rules are static/)).toBeInTheDocument();
  });

  it("switches to the clocking modport with the keyboard and shows clockvar paths", () => {
    render(<ModportExplorer />);
    const views = screen.getByRole("radiogroup", { name: "Modport view" });
    const master = within(views).getByRole("radio", { name: "master" });
    master.focus();
    fireEvent.keyDown(master, { key: "End" });
    expect(within(views).getByRole("radio", { name: "drv (clocking cb)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("modport drv (clocking cb);")).toBeInTheDocument();
    expect(screen.getByLabelText("bus.cb.ready: input, flows from the interface into the module")).toBeInTheDocument();
  });

  it("in the clocking view, a synchronous drive of an output clockvar is legal (§14.16)", () => {
    render(<ModportExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "drv (clocking cb)" }));
    lockIn(/It compiles: this module is allowed/);
    expect(screen.getByText(/✓ Legal/)).toBeInTheDocument();
    expect(screen.getAllByText(/§14\.16/).length).toBeGreaterThan(0);
  });

  it("reading an output clockvar is illegal and changing the statement resets the prediction", () => {
    render(<ModportExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "drv (clocking cb)" }));
    lockIn(/It compiles: this module is allowed/);
    fireEvent.click(screen.getByRole("radio", { name: "x = bus.cb.valid;" }));
    expect(screen.queryByText(/✓ Legal/)).not.toBeInTheDocument();
    lockIn(/The tool rejects it before simulation starts/);
    expect(screen.getAllByText(/reading an output clockvar is illegal/).length).toBeGreaterThan(0);
  });

  it("the monitor view has no outputs", () => {
    render(<ModportExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "monitor" }));
    const list = screen.getByRole("list", { name: /Signals visible through modport monitor/ });
    expect(within(list).queryByText("output")).not.toBeInTheDocument();
  });
});
