import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TemporalLogicExplorer from "@/components/curriculum/interactives/TemporalLogicExplorer";

const comparison = () => screen.queryByRole("list", { name: /Comparison for attempt/ });
const operatorGroup = () => screen.getByRole("radiogroup", { name: "Operator" });
const lockIn = () => screen.getAllByRole("button", { name: /lock in prediction/i })[0];

describe("TemporalLogicExplorer", () => {
  it("shows only valid SVA operators (no `|-->` / `|==>`)", () => {
    const { container } = render(<TemporalLogicExplorer />);
    expect(within(operatorGroup()).getByRole("radio", { name: "req |-> gnt" })).toBeInTheDocument();
    expect(within(operatorGroup()).getByRole("radio", { name: "req |=> gnt" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\|-->|\|==>/);
  });

  it("gates the comparison behind a prediction and diagnoses a wrong answer with the operator that would give it", () => {
    render(<TemporalLogicExplorer />);
    expect(comparison()).not.toBeInTheDocument();
    // req |-> gnt at edge 1 fails (gnt is 0 on the same edge); PASS at edge 2 is what |=> reports.
    fireEvent.click(screen.getByLabelText("PASS, decided at edge 2"));
    fireEvent.click(lockIn());
    expect(screen.getByText(/That is what req \|=> gnt and req \|-> ##\[1:2\] gnt report/)).toBeInTheDocument();
    const list = comparison();
    expect(list).toBeInTheDocument();
    const items = within(list!).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/req \|-> gnt.*FAIL at edge 1/);
    expect(items[1]).toMatch(/req \|=> gnt.*PASS, decided at edge 2/);
  });

  it("changing the operator with the keyboard resets the prediction", () => {
    render(<TemporalLogicExplorer />);
    fireEvent.click(screen.getByLabelText("FAIL at edge 1"));
    fireEvent.click(lockIn());
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.keyDown(within(operatorGroup()).getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(within(operatorGroup()).getByRole("radio", { checked: true })).toHaveTextContent("req |=> gnt");
    expect(comparison()).not.toBeInTheDocument();
  });

  it("re-runs the model when the learner toggles a trace cell", () => {
    render(<TemporalLogicExplorer />);
    fireEvent.keyDown(screen.getByRole("button", { name: "gnt at edge 1: 0. Toggle." }), { key: "Enter" });
    // Now gnt is high on the same edge as req: |-> passes at edge 1.
    fireEvent.click(screen.getByLabelText("PASS, decided at edge 1"));
    fireEvent.click(lockIn());
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("repetition family separates [*N], goto [->N] and nonconsecutive [=N]", () => {
    render(<TemporalLogicExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Repetition" }));
    fireEvent.click(within(operatorGroup()).getByRole("radio", { name: "start |=> ack[=2] ##1 done" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Reveal without predicting/ })[0]);
    const items = within(comparison()!).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/ack\[\*2\].*FAIL at edge 3/);
    expect(items[1]).toMatch(/ack\[->2\].*FAIL at edge 5/);
    expect(items[2]).toMatch(/ack\[=2\].*PASS, decided at edge 6/);
  });
});
