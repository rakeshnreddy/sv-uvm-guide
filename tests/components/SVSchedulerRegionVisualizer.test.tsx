import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SVSchedulerRegionVisualizerDefault, { SVSchedulerRegionVisualizer } from "@/components/visualizers/SVSchedulerRegionVisualizer";

const regionRow = (name: string) => within(screen.getByRole("list", { name: "Where each event landed" })).getByLabelText(new RegExp(`^${name}:`));

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const jumpToEnd = () => {
  const scrubber = screen.getByRole("slider", { name: /scrubber/i });
  fireEvent.change(scrubber, { target: { value: scrubber.getAttribute("max") } });
};

describe("SVSchedulerRegionVisualizer (F3B region map, model-driven)", () => {
  it("keeps the named export the lesson registry loads, and the default export", () => {
    expect(SVSchedulerRegionVisualizerDefault).toBe(SVSchedulerRegionVisualizer);
  });

  it("shows the code and the empty ladder, but hides the trace, log and map until a prediction is committed", () => {
    render(<SVSchedulerRegionVisualizer />);
    expect(screen.getByText("assign y = q;")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /scrubber/i })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("diagnoses the 'runs in NBA' misconception, then shows q landing in NBA and assign y re-running in Active at Δ1", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/In NBA, together with the update of q/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/NBA only applies the scheduled updates/).length).toBeGreaterThan(0);
    expect(regionRow("NBA")).toHaveAttribute("aria-label", expect.stringContaining("q ← 1 (q <= d;)"));
    const active = regionRow("Active");
    expect(within(active).getByRole("button", { name: /run assign y, delta 1/ })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: /run always_ff, delta 0/ })).toBeInTheDocument();
    expect(regionRow("Observed")).toHaveAttribute("aria-label", "Observed: nothing landed here");
  });

  it("selecting a map entry moves the synchronized trace to that step", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/Back in Active, in a second pass/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    fireEvent.click(within(regionRow("Active")).getByRole("button", { name: /y = q; writes now/ }));
    const current = document.querySelector('li[aria-current="step"]');
    expect(current?.textContent).toContain("assign y = q;");
    expect(screen.getByLabelText(/^y = 1, just changed$/)).toBeInTheDocument();
  });

  it("#0 and $strobe: the log fills in step by step and ends with the settled value", () => {
    render(<SVSchedulerRegionVisualizer scenario="zero-delay-prints" />);
    commit(/^\$display: q=0\s+→\s+\$display: q=0\s+→\s+\$strobe: q=5$/);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("(no output yet)");
    jumpToEnd();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("$display: q=0$display: q=0$strobe: q=5");
    expect(regionRow("Inactive")).toHaveAttribute("aria-label", expect.stringContaining("$display: q=0"));
    expect(regionRow("Postponed")).toHaveAttribute("aria-label", expect.stringContaining("$strobe: q=5"));
  });

  it("program block: wrapper code is shown and its thread lands in Reactive, its <= in Re-NBA", () => {
    render(<SVSchedulerRegionVisualizer scenario="program-reactive" />);
    expect(screen.getByText("program tb;")).toBeInTheDocument();
    commit(/0: the value before the edge/);
    expect(screen.getAllByText(/clocking-block input/).length).toBeGreaterThan(0);
    expect(regionRow("Reactive")).toHaveAttribute("aria-label", expect.stringContaining("run program thread"));
    expect(regionRow("Re-NBA")).toHaveAttribute("aria-label", expect.stringContaining("cmd ← 1 (cmd <= 1;)"));
  });

  it("is keyboard operable: arrow keys switch scenario (resetting the prediction) and step the trace", () => {
    render(<SVSchedulerRegionVisualizer />);
    commit(/Back in Active/);
    const group = screen.getByRole("group", { name: /scheduler step playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next scheduler step/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);

    fireEvent.keyDown(screen.getByRole("radio", { name: "NBA → combinational" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "$display · #0 · $strobe" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Where each event landed" })).not.toBeInTheDocument();
  });
});
