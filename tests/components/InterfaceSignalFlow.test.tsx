import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InterfaceSignalFlow from "@/components/animations/InterfaceSignalFlow";

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const pathStep = (title: RegExp) => within(screen.getByRole("list", { name: /Signal path/ })).getByLabelText(title);

describe("InterfaceSignalFlow (class → virtual interface → modport → signal)", () => {
  it("does not animate or autoplay, and hides the verdict and path statuses until a prediction is committed", () => {
    render(<InterfaceSignalFlow />);
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(pathStep(/^Virtual interface handle/)).toHaveAttribute("aria-label", expect.stringContaining("predict first"));
    expect(screen.queryByText(/Compiles and runs/)).not.toBeInTheDocument();
    expect(screen.getByText("vif.cb.valid <= 1;")).toBeInTheDocument();
  });

  it("null handle: a 'compile error' guess is diagnosed, and the path fails at the handle (§25.9)", () => {
    render(<InterfaceSignalFlow />);
    fireEvent.click(screen.getByRole("button", { name: "Assignment missing" }));
    expect(screen.getByText("// drv.vif = bus_if; (missing)")).toBeInTheDocument();
    commit(/rejects it before simulation starts/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/Whether the handle points anywhere is only known at run time/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Fatal run-time error/)).toBeInTheDocument();
    expect(pathStep(/^Virtual interface handle/)).toHaveAttribute("aria-label", expect.stringContaining("fails here"));
    expect(pathStep(/^Signal on bus_if/)).toHaveAttribute("aria-label", expect.stringContaining("not reached"));
  });

  it("a .drv handle that writes valid directly is a compile-time error, so the handle step is never reached", () => {
    render(<InterfaceSignalFlow />);
    fireEvent.click(screen.getByRole("button", { name: "Direct drive via drv" }));
    commit(/rejects it before simulation starts/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(pathStep(/^Modport view/)).toHaveAttribute("aria-label", expect.stringContaining("fails here"));
    expect(pathStep(/^Virtual interface handle/)).toHaveAttribute("aria-label", expect.stringContaining("not reached"));
  });

  it("changing a control with the keyboard re-runs the model and resets the prediction", () => {
    render(<InterfaceSignalFlow />);
    commit(/compiles and runs/);
    expect(screen.getByText(/Compiles and runs/)).toBeInTheDocument();
    const handle = screen.getByRole("radiogroup", { name: "Virtual interface type" });
    fireEvent.keyDown(within(handle).getByRole("radio", { name: "virtual simple_bus_if.drv" }), { key: "ArrowRight" });
    expect(within(handle).getByRole("radio", { name: "virtual simple_bus_if.master" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("virtual simple_bus_if.master vif;")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    expect(pathStep(/^Modport view/)).toHaveAttribute("aria-label", expect.stringContaining("predict first"));
  });

  it("the direction matrix is generated from the modports: monitor drives nothing, drv sees only clockvars", () => {
    render(<InterfaceSignalFlow />);
    expect(screen.getByLabelText("monitor valid: input, read only")).toBeInTheDocument();
    expect(screen.getByLabelText("master valid: output, may drive")).toBeInTheDocument();
    expect(screen.getByLabelText("slave ready: output, may drive")).toBeInTheDocument();
    expect(screen.getByLabelText("drv valid: cb.output, may drive")).toBeInTheDocument();
    expect(screen.getByLabelText("drv clk: not visible")).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^monitor \w+: output/)).toHaveLength(0);
    expect(screen.queryByText(/inout data/)).not.toBeInTheDocument();
  });
});
