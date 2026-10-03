import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmPhasingDiagram from "@/components/diagrams/UvmPhasingDiagram";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const timeline = () => screen.queryByRole("img", { name: /run_phase objection count/ });
const scenario = (name: string) => within(screen.getByRole("radiogroup", { name: "Scenario" })).getByRole("radio", { name });

describe("UvmPhasingDiagram (objections and end of test)", () => {
  it("hides the timeline until a prediction is locked in; drain time holds run_phase open to 450 ns", () => {
    render(<UvmPhasingDiagram />);
    expect(timeline()).not.toBeInTheDocument();
    lockIn(/It ends after 400 ns/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(timeline()?.getAttribute("aria-label")).toMatch(/Drain from 400 ns to 450 ns\. run_phase ends at 450 ns\. Last response at 430 ns checked\./);
    expect(screen.getByText(/The 50 ns drain held the phase open until 450 ns/)).toBeInTheDocument();
  });

  it("'test ends at 0 ns' bug: no objection means run_phase is skipped and the test passes vacuously", () => {
    render(<UvmPhasingDiagram />);
    fireEvent.click(scenario("Ends at 0 ns"));
    lockIn(/^run_phase ends at 0 ns\./);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/passes without sending any traffic/)).toBeInTheDocument();
  });

  it("raise after #10ns is too late", () => {
    render(<UvmPhasingDiagram />);
    fireEvent.click(scenario("Raise too late"));
    lockIn(/It ends at 400 ns, when the objection drops/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/killed the thread before the delay elapsed/)).toBeInTheDocument();
  });

  it("drain time is not a hang safety net: a missing drop ends with PH_TIMEOUT", () => {
    render(<UvmPhasingDiagram />);
    fireEvent.click(scenario("Never dropped"));
    lockIn(/It ends after 400 ns/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/A drain time cannot help, because it starts only when the count reaches 0/)).toBeInTheDocument();
    expect(screen.getByText(/UVM_FATAL @ 2 us \[PH_TIMEOUT\] Explicit timeout of 2 us hit/)).toBeInTheDocument();
  });

  it("without drain or phase_ready_to_end, the last response is lost", () => {
    render(<UvmPhasingDiagram />);
    fireEvent.click(scenario("Lost response"));
    lockIn(/It ends at 400 ns, when the objection drops/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/1 expected response never arrived/)).toBeInTheDocument();
  });

  it("phase_ready_to_end re-raises until the response arrives", () => {
    render(<UvmPhasingDiagram />);
    fireEvent.click(scenario("phase_ready_to_end"));
    lockIn(/It ends after 400 ns/);
    expect(screen.getByText(/phase_ready_to_end was called 2 times/)).toBeInTheDocument();
    expect(screen.getByText(/run_phase ended at 430 ns/)).toBeInTheDocument();
  });

  it("code-line controls change the scenario and reset the prediction", () => {
    render(<UvmPhasingDiagram />);
    lockIn(/It ends after 400 ns/);
    expect(timeline()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove the drop_objection call" }));
    expect(timeline()).not.toBeInTheDocument();
    expect(screen.getByText(/edited: your own variant/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Switch to the default/ }));
    lockIn(/never ends by itself/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/UVM_FATAL @ 9200 s \[PH_TIMEOUT\] Default timeout of 9200 s hit/)).toBeInTheDocument();
  });

  it("scenarios are keyboard operable", () => {
    render(<UvmPhasingDiagram />);
    const healthy = scenario("Healthy test");
    healthy.focus();
    fireEvent.keyDown(healthy, { key: "ArrowRight" });
    expect(scenario("Ends at 0 ns")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Bug: nobody raises an objection/)).toBeInTheDocument();
  });
});
