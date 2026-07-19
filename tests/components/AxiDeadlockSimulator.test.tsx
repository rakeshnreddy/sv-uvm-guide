import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import AxiDeadlockSimulator from "@/components/visualizers/AxiDeadlockSimulator";

vi.mock("lucide-react", () => ({
  Play: () => <span />,
  Pause: () => <span />,
  SkipBack: () => <span />,
  SkipForward: () => <span />,
  RotateCcw: () => <span />,
  AlertTriangle: () => <span />,
}));

describe("AxiDeadlockSimulator", () => {
  it("attributes the cycle to the source VALID dependency", () => {
    render(<AxiDeadlockSimulator />);
    fireEvent.click(screen.getByTitle("Step Forward"));
    fireEvent.click(screen.getByTitle("Step Forward"));

    expect(screen.getByText("DEADLOCK DETECTED")).toBeInTheDocument();
    expect(screen.getByText("AXI-A3-VALID-INDEPENDENCE")).toBeInTheDocument();
    expect(screen.getByText(/slave policy is legal but participates/i)).toBeInTheDocument();
  });

  it("does not classify delayed READY alone as a protocol error", () => {
    render(<AxiDeadlockSimulator />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "delayed_ready" } });
    fireEvent.click(screen.getByTitle("Step Forward"));

    expect(screen.getByText(/Delayed READY is not, by itself/i)).toBeInTheDocument();
    expect(screen.queryByText("DEADLOCK DETECTED")).not.toBeInTheDocument();
  });
});
