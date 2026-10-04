import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FormalVsSimulationVisualizer from "@/components/visuals/FormalVsSimulationVisualizer";

const commit = (label: RegExp) => {
  fireEvent.click(screen.getAllByLabelText(label)[0]);
  fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[0]);
};

describe("FormalVsSimulationVisualizer", () => {
  it("hides formal results until the learner commits a prediction", () => {
    render(<FormalVsSimulationVisualizer />);
    expect(screen.getByRole("region", { name: "Formal vs simulation explorer" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Formal results" })).not.toBeInTheDocument();
    commit(/^Both assertions are proven\.$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const results = screen.getByRole("region", { name: "Formal results" });
    expect(within(results).getAllByText("proven")).toHaveLength(2);
    expect(within(results).getByText(/It depends on a_no_push_when_full and a_no_pop_when_empty/)).toBeInTheDocument();
  });

  it("dropping a_no_push_when_full fails p_count_in_range (not p_full_is_correct) and the replay flags it as spurious", () => {
    render(<FormalVsSimulationVisualizer />);
    const toggle = screen.getByRole("button", { name: /^a_no_push_when_full: enabled\. Toggle assumption/ });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /^a_no_push_when_full: disabled/ })).toHaveAttribute("aria-pressed", "false");

    // Wrong prediction gets a diagnosis that names the assertion that really fails.
    commit(/^p_full_is_correct gets a counterexample; p_count_in_range is proven\.$/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/p_count_in_range has a counterexample at edge 5/).length).toBeGreaterThan(0);

    const trace = screen.getByRole("region", { name: "Counterexample trace" });
    expect(within(trace).getByRole("group", { name: /Counterexample for p_count_in_range/ })).toBeInTheDocument();
    expect(within(trace).queryByText(/Replay verdict/)).not.toBeInTheDocument();
    fireEvent.click(within(trace).getByLabelText(/No\. Formal used stimulus/));
    fireEvent.click(within(trace).getByRole("button", { name: /lock in prediction/i }));
    expect(within(trace).getByText(/spurious counterexample/)).toBeInTheDocument();
    expect(within(trace).getByText(/a_no_push_when_full is checked, and it fails at edge 4/)).toBeInTheDocument();
    expect(within(trace).getByLabelText("Generated replay sequence").textContent).toContain("bit push_v[5] = '{1, 1, 1, 1, 1};");
  });

  it("the late-flag RTL produces a genuine counterexample that simulation only catches with some seeds", () => {
    render(<FormalVsSimulationVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Bug: full flag is registered/ }));
    commit(/^Both assertions get counterexamples\.$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show CEX trace for p_full_is_correct" }));
    const trace = screen.getByRole("region", { name: "Counterexample trace" });
    fireEvent.click(within(trace).getByRole("button", { name: /Reveal without predicting/ }));
    expect(within(trace).getByText(/real DUT bug/)).toBeInTheDocument();

    const sim = screen.getByRole("region", { name: "Constrained-random simulation" });
    expect(within(sim).getByText(/fails at edge 15/)).toBeInTheDocument();
    const seeds = within(sim).getByRole("radiogroup", { name: "Random seed" });
    fireEvent.keyDown(within(seeds).getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(within(seeds).getByRole("radio", { checked: true })).toHaveTextContent("seed 2");
    expect(within(sim).getAllByText(/formal found a counterexample this seed never exercised/).length).toBeGreaterThan(0);
  });

  it("over-constraining shows a vacuous proof, an unreachable cover, and a simulation assumption failure", () => {
    render(<FormalVsSimulationVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: /Bug: full flag is registered/ }));
    fireEvent.click(screen.getByRole("button", { name: /^a_never_fill: disabled/ }));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const results = screen.getByRole("region", { name: "Formal results" });
    expect(within(results).getByText("proven (vacuous)")).toBeInTheDocument();
    expect(within(results).getByText("unreachable")).toBeInTheDocument();
    expect(screen.getByText(/fails at edge 14\. The legal environment does what this assumption forbids/)).toBeInTheDocument();
  });
});
