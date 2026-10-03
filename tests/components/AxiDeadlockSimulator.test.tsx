import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AxiDeadlockSimulator from "@/components/visualizers/AxiDeadlockSimulator";

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
};
const DEADLOCKS = /^It deadlocks/;
const LATENT = /^It completes here, but one side breaks/;
const SAFE = /^It completes, and every wait/;
const preset = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Presets" })).getByRole("button", { name }));

describe("AxiDeadlockSimulator", () => {
  afterEach(() => cleanup());

  it("keeps the lesson test id, declares a model fidelity, and opens on the classic configuration", () => {
    render(<AxiDeadlockSimulator />);
    expect(screen.getByTestId("axi-deadlock-simulator")).toBeInTheDocument();
    expect(screen.getByText("Deterministic educational model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Classic W/AW deadlock" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "WVALID waits for AWREADY" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "AWREADY waits for WVALID" })).toBeChecked();
  });

  it("hides the verdict, loop and graph until the learner commits", () => {
    render(<AxiDeadlockSimulator />);
    expect(screen.queryByText(/Model result/)).toBeNull();
    expect(screen.queryByRole("img", { name: /Wait-for graph/ })).toBeNull();
    commit(DEADLOCKS);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText(/Model result: Deadlock/)).toBeInTheDocument();
    const loops = screen.getByRole("list", { name: "Wait-for loops" });
    expect(within(loops).getByText("↻ master WVALID → slave AWREADY → master WVALID")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Loop: master WVALID → slave AWREADY → master WVALID/ })).toBeInTheDocument();
  });

  it("attributes the deadlock to the source VALID wait, and calls the slave's wait legal", () => {
    render(<AxiDeadlockSimulator />);
    commit(SAFE);
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    const waits = screen.getByRole("list", { name: "Waits in this configuration" });
    const forbidden = within(waits).getByText("master WVALID waits for slave AWREADY").closest("li") as HTMLElement;
    expect(within(forbidden).getByText("✕ forbidden wait")).toBeInTheDocument();
    expect(within(forbidden).getByText("AXI-A3-VALID-INDEPENDENCE")).toBeInTheDocument();
    const allowed = within(waits).getByText("slave AWREADY waits for master WVALID").closest("li") as HTMLElement;
    expect(within(allowed).getByText("✓ allowed wait")).toBeInTheDocument();
  });

  it("does not call delayed READY a protocol error or a deadlock", () => {
    render(<AxiDeadlockSimulator />);
    preset("Legal delayed READY");
    commit(DEADLOCKS);
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getByText(/Waiting alone does not deadlock/)).toBeInTheDocument();
    expect(screen.getByText(/Model result: Completes, and every wait is legal/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /and no loop/ })).toBeInTheDocument();
  });

  it("flags a latent violation and names the legal partner that would deadlock it", () => {
    render(<AxiDeadlockSimulator />);
    preset("Latent violation");
    commit(LATENT);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getAllByText(/a legal slave whose AWREADY waits for WVALID/).length).toBeGreaterThan(0);
  });

  it("re-locks the prediction when the learner edits a wait from the keyboard-operable checkboxes", () => {
    render(<AxiDeadlockSimulator />);
    commit(DEADLOCKS);
    expect(screen.getByText(/Model result/)).toBeInTheDocument();
    const masterWait = screen.getByRole("checkbox", { name: "WVALID waits for AWREADY" });
    fireEvent.click(masterWait);
    expect(masterWait).not.toBeChecked();
    expect(screen.queryByText(/Model result/)).toBeNull();
    expect(screen.getByRole("button", { name: "Classic W/AW deadlock" })).toHaveAttribute("aria-pressed", "false");
    commit(SAFE);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("finds the B-channel loop: a slave holding BVALID for BREADY", () => {
    render(<AxiDeadlockSimulator />);
    preset("B-channel deadlock");
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(within(screen.getByRole("list", { name: "Wait-for loops" })).getByText("↻ master BREADY → slave BVALID → master BREADY")).toBeInTheDocument();
    expect(screen.getAllByText("■ required by AXI4")).toHaveLength(2);
  });
});
