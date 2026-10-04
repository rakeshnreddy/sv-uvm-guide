import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConstraintSolverExplorer } from "@/components/visuals/ConstraintSolverExplorer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const pickMode = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));

describe("ConstraintSolverExplorer", () => {
  it("gates the distribution behind a prediction and shows that array size is solved before elements", () => {
    render(<ConstraintSolverExplorer />);
    expect(screen.queryByText(/P\(length\) — exact/)).not.toBeInTheDocument();
    lockIn(/About 67%/);
    expect(screen.getByText(/sizes are solved before elements \(§18\.5\.7\.1\)/)).toBeInTheDocument();
    expect(screen.getByText(/P\(length\) — exact/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByText("12.5% (1/8)")).toHaveLength(8);
    expect(screen.getByText("payloads: 3^8 = 6,561")).toBeInTheDocument();
  });

  it("adds the weights of 8, which appears in both dist items", () => {
    render(<ConstraintSolverExplorer initialMode="dist" />);
    expect(screen.getByText("length dist { 8 := 80, [4:16] :/ 20 };", { exact: false })).toBeInTheDocument();
    lockIn(/80\.0%: the item 8 := 80 decides it/);
    expect(screen.getByText(/weights of a value listed twice add up/)).toBeInTheDocument();
    expect(screen.getAllByText("81.5% (53/65)").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: /:= gives every value 20/ }));
    lockIn(/29\.4% \(5\/17\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("models soft as priority: P = 1 alone, the later soft wins, and inline with beats it", () => {
    render(<ConstraintSolverExplorer initialMode="soft" />);
    lockIn(/About 90%/);
    expect(screen.getByText(/soft is a priority, not a probability/)).toBeInTheDocument();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);

    const late = screen.getByRole("button", { name: /c_small \(declared later\)/ });
    fireEvent.click(late);
    expect(late).toHaveAttribute("aria-pressed", "true");
    lockIn(/100%: a soft default always applies/);
    expect(screen.getByText(/the later one wins/)).toBeInTheDocument();
    expect(screen.getByText(/Discarded soft: soft length == 16;/)).toBeInTheDocument();
  });

  it("solve…before changes P(JUMBO) with direction, never the legal pairs", () => {
    render(<ConstraintSolverExplorer initialMode="order" />);
    lockIn(/50\.0%: kind has two values/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/14 legal combinations/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "solve kind before length" }));
    lockIn(/50\.0% \(1\/2\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/14 legal combinations/)).toBeInTheDocument();
    expect(screen.getAllByText("illegal").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "solve length before kind" }));
    lockIn(/3\.8% \(1\/26\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("debug mode: the lab's constraints never fail; forcing IPV6 produces a three-constraint conflict", () => {
    render(<ConstraintSolverExplorer initialMode="hole" />);
    lockIn(/fails about 1 call in 3/);
    expect(screen.getByText(/The solver never picks a value and then gives up/)).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /with \{ proto == IPV6; \}/ }));
    lockIn(/It fails on every call/);
    expect(screen.getByText(/Minimal conflict/)).toBeInTheDocument();
    expect(screen.getByText("length inside {16, 32, 64, 128, 256};")).toBeInTheDocument();
  });

  it("cites the 2023 clause numbers", () => {
    render(<ConstraintSolverExplorer initialMode="dist" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/§18\.5\.3: := gives every value/)).toBeInTheDocument();
    pickMode(/solve…before/);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/§18\.5\.9: with no ordering/)).toBeInTheDocument();
  });
});
