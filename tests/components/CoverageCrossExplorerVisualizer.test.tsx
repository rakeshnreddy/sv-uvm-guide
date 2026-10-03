import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CoverageCrossExplorerVisualizer } from "@/components/visualizers/CoverageCrossExplorerVisualizer";

const code = () => screen.getByTestId("covergroup-code").textContent ?? "";
const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const toEnd = () => {
  const slider = screen.getByRole("slider", { name: /coverage event scrubber/i });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
};

describe("CoverageCrossExplorerVisualizer", () => {
  it("renders a 3 × 3 cross of button cells and declares the bins it crosses", () => {
    render(<CoverageCrossExplorerVisualizer />);
    expect(screen.getByText(/addr_x_op: 9 cross products/)).toBeInTheDocument();
    for (const row of ["low", "mid", "high"]) {
      for (const col of ["auto[READ]", "auto[WRITE]", "auto[BURST]"]) {
        expect(screen.getByTestId(`cross-cell-${row}-${col}`).tagName).toBe("BUTTON");
      }
    }
    expect(code()).toContain("bins low = {[0:15]};");
    expect(code()).toContain("addr_x_op: cross cp_addr, cp_op;");
  });

  it("keeps hit counts and the forecast hidden until a prediction is locked in", () => {
    render(<CoverageCrossExplorerVisualizer />);
    expect(screen.queryByText(/Model forecast/)).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /coverage event scrubber/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("cross-cell-low-auto[READ]")).toHaveAccessibleName(/counted bin/);

    lockIn(/About 9 samples: one per bin/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/30 samples on average \(coupon-collector baseline 25\)/)).toBeInTheDocument();
    toEnd();
    expect(screen.getByText(/cg_bus reaches 100% at sample/)).toBeInTheDocument();
    expect(screen.getByText(/✓ None: every counted bin is covered/)).toBeInTheDocument();
  });

  it("generates valid binsof selects: binsof(cp.bin) for named bins, intersect for enum and array bins", () => {
    render(<CoverageCrossExplorerVisualizer />);
    fireEvent.click(screen.getByTestId("cross-cell-high-auto[BURST]"));
    expect(code()).toContain("ignore_bins ign_high_BURST = binsof(cp_addr.high) && binsof(cp_op) intersect {BURST};");
    expect(code()).not.toMatch(/intersect \{high\}|intersect \{low\}/);

    fireEvent.click(screen.getByRole("radio", { name: "✕ illegal_bins" }));
    fireEvent.click(screen.getByRole("button", { name: /Toggle illegal_bins for row low/ }));
    expect(code()).toContain("illegal_bins ill_low = binsof(cp_addr.low);");

    fireEvent.click(screen.getByRole("radio", { name: "quad[4] array" }));
    expect(code()).toContain("bins quad[4] = {[0:63]};");
    fireEvent.click(screen.getByTestId("cross-cell-quad[3]-auto[READ]"));
    expect(code()).toContain("binsof(cp_addr) intersect {[48:63]} && binsof(cp_op) intersect {READ}");
  });

  it("cells are operable from the keyboard", async () => {
    const user = userEvent.setup();
    render(<CoverageCrossExplorerVisualizer />);
    const cell = screen.getByTestId("cross-cell-mid-auto[WRITE]");
    cell.focus();
    await user.keyboard("{Enter}");
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(cell).toHaveAccessibleName(/ignore_bins ign_mid_WRITE, not counted/);
    await user.keyboard(" ");
    expect(cell).toHaveAttribute("aria-pressed", "false");
  });

  it("ignoring a cell shrinks the cross denominator (Bc + Bu) and the forecast", () => {
    render(<CoverageCrossExplorerVisualizer />);
    fireEvent.click(screen.getByTestId("cross-cell-high-auto[BURST]"));
    lockIn(/About 22 samples/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/addr_x_op: 0 \/ 8 \(Bc 8 \+ Bu 0\)/)).toBeInTheDocument();
  });

  it("a constraint hole never closes, and the run explains why", () => {
    render(<CoverageCrossExplorerVisualizer initialStimulus="hole" />);
    lockIn(/Never: some bin cannot be generated/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    toEnd();
    expect(screen.getByText(/Stopped after 500 samples/)).toBeInTheDocument();
    expect(screen.getAllByText(/probability 0/).length).toBeGreaterThan(0);
  });

  it("illegal-bin hits appear as run-time errors with the ✕ glyph", () => {
    render(<CoverageCrossExplorerVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "✕ illegal_bins" }));
    fireEvent.click(screen.getByTestId("cross-cell-low-auto[READ]"));
    expect(code()).toContain("illegal_bins ill_low_READ = binsof(cp_addr.low) && binsof(cp_op) intersect {READ};");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    toEnd();
    expect(screen.getByText(/✕ Run-time errors:/)).toBeInTheDocument();
    expect(screen.getAllByText(/✕ Error \(sample \d+\): illegal cross bin addr_x_op\.ill_low_READ/).length).toBeGreaterThan(0);
  });

  it("changing the bins re-asks the prediction", () => {
    render(<CoverageCrossExplorerVisualizer />);
    lockIn(/About 25 samples/);
    expect(screen.getByText(/Model forecast/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "corners + default" }));
    expect(screen.queryByText(/Model forecast/)).not.toBeInTheDocument();
    expect(screen.getByText(/addr_x_op: 6 cross products/)).toBeInTheDocument();
    lockIn(/Far more than/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });
});

describe("Coverage closure challenge", () => {
  it("grades each fix on closure and on faithfulness to the spec", () => {
    render(<CoverageCrossExplorerVisualizer mode="closure" />);
    const region = screen.getByRole("region", { name: /coverage closure challenge/i });
    fireEvent.click(within(region).getByLabelText(/Run 10× more random samples/));
    expect(within(region).getByText(/✕ Still stuck at/)).toBeInTheDocument();

    fireEvent.click(within(region).getByLabelText(/^ignore_bins ign_high_burst/));
    expect(within(region).getByText(/✓ Coverage closes/)).toBeInTheDocument();
    expect(within(region).getByText(/✕ Does not match the spec/)).toBeInTheDocument();

    fireEvent.click(within(region).getByLabelText(/^illegal_bins ill_high_burst/));
    expect(within(region).getByText(/✓ Matches the spec\. Preferred/)).toBeInTheDocument();

    fireEvent.click(within(region).getByRole("radio", { name: /Spec B: legal/ }));
    expect(within(region).getByText(/✕ Does not match the spec/)).toBeInTheDocument();
    fireEvent.click(within(region).getByLabelText(/Delete the constraint/));
    expect(within(region).getByText(/✓ Coverage closes/)).toBeInTheDocument();
    expect(within(region).getByText(/✓ Matches the spec/)).toBeInTheDocument();
  });
});
