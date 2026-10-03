import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScoreboardMatchingVisualizer from "@/components/visuals/ScoreboardMatchingVisualizer";

const lockIn = (label: string | RegExp, prompt = 0) => {
  fireEvent.click(screen.getAllByLabelText(label)[0]);
  fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[prompt]);
};

describe("ScoreboardMatchingVisualizer", () => {
  it("hides the run until a prediction is locked in, then shows the verdict and the timeline", () => {
    render(<ScoreboardMatchingVisualizer />);
    expect(screen.queryByRole("img", { name: /Transaction timeline/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Scoreboard step playback controls/ })).not.toBeInTheDocument();

    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Transaction timeline/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("matched 5, errors 0 → PASS");
  });

  it("re-asks after a keyboard policy change and diagnoses the in-order false mismatch", () => {
    render(<ScoreboardMatchingVisualizer />);
    const policies = screen.getByRole("radiogroup", { name: "Matching policy" });
    fireEvent.keyDown(within(policies).getByRole("radio", { name: "Per-ID queues" }), { key: "ArrowLeft" });
    expect(within(policies).getByRole("radio", { name: "In-order queue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })[0]).toBeDisabled();

    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/false mismatch/).length).toBeGreaterThan(0);
  });

  it("steps through scoreboard writes with synchronized narration", () => {
    render(<ScoreboardMatchingVisualizer />);
    lockIn("PASS: no UVM_ERROR at all");
    const group = screen.getByRole("group", { name: /Scoreboard step playback controls/ });
    const slider = within(group).getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Predictor writes #1"));
    fireEvent.keyDown(within(group).getByRole("button", { name: /next scoreboard step/i }), { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Predictor writes #2"));
    expect(screen.getByText(/joins the back of exp_q\[1\]/)).toBeInTheDocument();
  });

  it("a dropped response with check_phase off escapes as a PASS", () => {
    render(<ScoreboardMatchingVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Drops the last id-0 response" }));
    fireEvent.click(screen.getByLabelText("check_phase reports leftovers"));
    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/PASS · bug escaped/)).toBeInTheDocument();
  });

  it("exhaustive check: only search-any lets the same-ID reorder escape", () => {
    render(<ScoreboardMatchingVisualizer />);
    lockIn("Search any match", 1);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Every DUT bug against every policy/ });
    const row = within(table).getByRole("rowheader", { name: "Swaps #1 and #3 (same ID)" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("bug escaped");
  });

  it("debug mode: find the overwrite line, then the per-ID fix is accepted and the in-order one rejected", () => {
    render(<ScoreboardMatchingVisualizer mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: `uvm_error\("SCB", \$sformatf\("Unexpected/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: expected\[t\.id\] = t;/ }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Use one queue for every ID/));
    expect(screen.getByText(/Rejected\. The correct DUT still fails/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Give each ID an ordered queue/));
    expect(screen.getByText(/Accepted\./)).toBeInTheDocument();
  });
});
