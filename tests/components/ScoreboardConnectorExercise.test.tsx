import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import ScoreboardConnectorExercise from "@/components/exercises/ScoreboardConnectorExercise";

const endpoint = (ref: string) => screen.getByRole("button", { name: new RegExp(`^${ref.replace(/\./g, "\\.")} \\(`) });
const connect = (from: string, to: string) => {
  fireEvent.click(endpoint(from));
  fireEvent.click(endpoint(to));
};
const SOLUTION: [string, string][] = [
  ["agt.mon.ap", "prd.analysis_export"],
  ["agt.mon.ap", "scb.actual_fifo.analysis_export"],
  ["agt.mon.ap", "cov.analysis_export"],
  ["prd.ap", "scb.expected_fifo.analysis_export"],
];
const code = () => screen.getByRole("list", { name: "Generated connect_phase code" });

describe("ScoreboardConnectorExercise", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects the wrong direction (fifo analysis_export.connect(ap)) with uvm-core's imp error, a why and the fix", () => {
    render(<ScoreboardConnectorExercise />);
    connect("scb.actual_fifo.analysis_export", "agt.mon.ap");
    const verdict = screen.getByTestId("connect-verdict");
    expect(verdict).toHaveTextContent("✕ UVM_ERROR. Not connected.");
    expect(verdict).toHaveTextContent("[Connection Error] Cannot call an imp port's connect method");
    expect(verdict).toHaveTextContent(/Why: Wrong direction: connect\(\) is called on the requirer/);
    expect(verdict).toHaveTextContent("Fix: agt.mon.ap.connect(scb.actual_fifo.analysis_export);");
    expect(within(code()).getByText("// (no connect() calls yet)")).toBeInTheDocument();
  });

  it("rejects an analysis port to a seq_item export as a compile error between interface classes", () => {
    render(<ScoreboardConnectorExercise />);
    connect("agt.mon.ap", "agt.sqr.seq_item_export");
    const verdict = screen.getByTestId("connect-verdict");
    expect(verdict).toHaveTextContent("✕ Compile error. Not connected.");
    expect(verdict).toHaveTextContent(/different interface classes/);
    expect(within(code()).queryByText(/sqr\.seq_item_export\);$/)).toHaveTextContent("drv.seq_item_port.connect(sqr.seq_item_export);");
  });

  it("flags the monitor's ap wired straight to the expected FIFO: legal UVM, failed check", async () => {
    render(<ScoreboardConnectorExercise />);
    connect("agt.mon.ap", "scb.expected_fifo.analysis_export");
    const verdict = screen.getByTestId("connect-verdict");
    expect(verdict).toHaveTextContent("! UVM accepts this, but it breaks the checker.");
    expect(verdict).toHaveTextContent(/compares the DUT with itself/);
    expect(within(code()).getByText(/^agt\.mon\.ap\.connect\(scb\.expected_fifo\.analysis_export\);\s+\/\/ ✕ wrong stream$/)).toBeInTheDocument();
    SOLUTION.forEach(([f, t]) => connect(f, t));
    await userEvent.click(screen.getByRole("button", { name: "Check wiring" }));
    const feedback = screen.getByTestId("exercise-feedback");
    expect(feedback).toHaveTextContent("Score: 75%");
    const perConnection = within(feedback).getByRole("list", { name: "Per-connection feedback" });
    expect(within(perConnection).getAllByText("✕", { exact: false })).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "write() call order" })).not.toBeInTheDocument();
  });

  it("an unconnected goal fails Check with its why, although UVM itself stays silent", async () => {
    render(<ScoreboardConnectorExercise />);
    SOLUTION.slice(0, 3).forEach(([f, t]) => connect(f, t));
    await userEvent.click(screen.getByRole("button", { name: "Check wiring" }));
    const feedback = screen.getByTestId("exercise-feedback");
    expect(feedback).toHaveTextContent("Score: 75%");
    expect(feedback).toHaveTextContent("✕ The predictor's output reaches the expected FIFO");
    expect(feedback).toHaveTextContent(/every prediction is written to nobody/);
    expect(feedback).toHaveTextContent(/min_size 0/);
    expect(feedback).toHaveTextContent(/without a single message/);
  });

  it("generates bus_env's connect_phase live from the model, with the given agent line", () => {
    render(<ScoreboardConnectorExercise />);
    SOLUTION.forEach(([f, t]) => connect(f, t));
    const lines = within(code())
      .getAllByRole("listitem")
      .map((li) => li.querySelector("code")?.textContent);
    expect(lines).toEqual([
      "// bus_env::connect_phase",
      "agt.mon.ap.connect(prd.analysis_export);",
      "agt.mon.ap.connect(scb.actual_fifo.analysis_export);",
      "agt.mon.ap.connect(cov.analysis_export);",
      "prd.ap.connect(scb.expected_fifo.analysis_export);",
      "// bus_agent::connect_phase (already written)",
      "drv.seq_item_port.connect(sqr.seq_item_export);",
    ]);
    expect(within(code()).getAllByRole("button", { name: /^Remove / })).toHaveLength(4);
  });

  it("passes a complete correct wiring, then gates the name-ordered write() trace behind a prediction", async () => {
    render(<ScoreboardConnectorExercise />);
    SOLUTION.forEach(([f, t]) => connect(f, t));
    await userEvent.click(screen.getByRole("button", { name: "Check wiring" }));
    const feedback = screen.getByTestId("exercise-feedback");
    expect(feedback).toHaveTextContent("Score: 100%");
    expect(feedback).toHaveTextContent(/only predictions reach the expected FIFO/);
    expect(screen.queryByRole("list", { name: "write() call order" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("cov.write(t)."));
    await userEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const order = screen.getByRole("list", { name: "write() call order" });
    expect(within(order).getAllByText(/^\d(\.\d)?\. /).map((n) => n.textContent)).toEqual([
      "1. cov.write(t)",
      "2. prd.write(t)",
      "2.1. scb.expected_fifo.write(exp)",
      "3. scb.actual_fifo.write(t)",
    ]);
    expect(screen.getByText(/calls the subscribers in full-name order/)).toBeInTheDocument();
    expect(screen.getByText(/Why the FIFOs give the scoreboard its own thread/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "bus_scoreboard run_phase" })).toHaveTextContent("expected_fifo.get(exp);");
  });

  it("can be completed with the keyboard only", async () => {
    const user = userEvent.setup();
    render(<ScoreboardConnectorExercise />);
    for (const [from, to] of SOLUTION) {
      endpoint(from).focus();
      await user.keyboard("{Enter}");
      expect(endpoint(from)).toHaveAttribute("aria-pressed", "true");
      endpoint(to).focus();
      await user.keyboard(" ");
    }
    // Escape cancels a half-made connection.
    endpoint("prd.ap").focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(endpoint("prd.ap")).toHaveAttribute("aria-pressed", "false");

    screen.getByRole("button", { name: "Check wiring" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("exercise-feedback")).toHaveTextContent("Score: 100%");
  });

  it("Reset board clears the wiring and feedback; attempts are recorded and can be cleared", async () => {
    render(<ScoreboardConnectorExercise />);
    SOLUTION.forEach(([f, t]) => connect(f, t));
    await userEvent.click(screen.getByRole("button", { name: "Check wiring" }));
    expect(screen.getByText("Best score: 100%")).toBeInTheDocument();
    expect(screen.getByText(/Attempts: 1/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reset board/i }));
    expect(screen.queryByTestId("exercise-feedback")).not.toBeInTheDocument();
    expect(within(code()).getByText("// (no connect() calls yet)")).toBeInTheDocument();
    expect(screen.getByText("Best score: 100%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear saved progress" }));
    expect(screen.getByText("Best score: 0%")).toBeInTheDocument();
    expect(screen.getByText(/Attempts: 0/)).toBeInTheDocument();
  });
});
