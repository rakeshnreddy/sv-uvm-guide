import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MultiAgentCoordinationVisualizer from "@/components/visuals/MultiAgentCoordinationVisualizer";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("MultiAgentCoordinationVisualizer", () => {
  it("hides the timeline until a prediction is locked in; a cycle can be selected from the keyboard", () => {
    render(<MultiAgentCoordinationVisualizer />);
    expect(screen.queryByRole("group", { name: /Virtual sequence timeline/ })).not.toBeInTheDocument();
    lockIn("PASS: all 6 items reach the scoreboard");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const wave = screen.getByRole("group", { name: /Virtual sequence timeline/ });
    fireEvent.keyDown(within(wave).getByRole("button", { name: "Select edge 5" }), { key: "Enter" });
    expect(screen.getByText(/cfg_seq done: CTRL\.EN = 1\. D0 accepted\./)).toBeInTheDocument();
  });

  it("fork cfg | data join: data before configuration is dropped", () => {
    render(<MultiAgentCoordinationVisualizer />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "cfg, then data" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "fork cfg | data join" })).toHaveAttribute("aria-checked", "true");
    lockIn("PASS: all 6 items reach the scoreboard");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /planned data items/ });
    expect(within(table).getAllByText("✕ dropped (EN = 0)")).toHaveLength(4);
  });

  it("predicts the hang and the passive-sequencer fatal", () => {
    render(<MultiAgentCoordinationVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "fork + background irq, join" }));
    lockIn("The test never ends: UVM_FATAL [PH_TIMEOUT]");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("Default timeout of 9200s hit");

    fireEvent.click(screen.getByRole("radio", { name: "wait for irq with a sequence" }));
    lockIn("UVM_FATAL [SEQ] at the first start_item");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /irq_agt is passive/ })).toBeInTheDocument();
  });

  it("reset mid-traffic: flush + restart passes", () => {
    render(<MultiAgentCoordinationVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/ }));
    fireEvent.click(screen.getByLabelText("Assert rst_n at 80 ns for 20 ns"));
    fireEvent.click(screen.getByRole("radio", { name: "flush + restart vseq" }));
    lockIn("PASS: all 6 items reach the scoreboard");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: /planned data items/ })).getAllByText("◌ flushed on reset")).toHaveLength(2);
  });

  it("debug mode: the join is the culprit; join_any is rejected and the isolated background fork is accepted", () => {
    render(<MultiAgentCoordinationVisualizer mode="debug" />);
    expect(screen.getByLabelText("Failing log")).toHaveTextContent("PH_TIMEOUT");
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: irq_seq\.start/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: join" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Change join to join_any"));
    expect(screen.getByText(/only 5 of 6 planned items were sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Fork the irq sequence in its own/));
    expect(screen.getByText(/Model: PASS/)).toBeInTheDocument();
  });
});
