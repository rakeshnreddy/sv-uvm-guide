import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExclusiveAccessVisualizer from "@/components/visualizers/ExclusiveAccessVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const situation = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Exclusive access situation" })).getByRole("radio", { name }));
const monitor = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Monitor implementation" })).getByRole("radio", { name }));

describe("ExclusiveAccessVisualizer", () => {
  it("hides responses until the learner predicts, then shows the monitor trace", () => {
    render(<ExclusiveAccessVisualizer />);
    expect(screen.getByTestId("exclusive-access-visualizer")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    lockIn(/^EXOKAY: the write is performed/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const responses = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[1].textContent);
    expect(responses).toEqual(["✓ EXOKAY", "✓ EXOKAY"]);
  });

  it("an intervening normal write makes the exclusive write fail; EXOKAY is diagnosed as a misconception", () => {
    render(<ExclusiveAccessVisualizer />);
    situation("Intervening normal write");
    lockIn(/^EXOKAY: the write is performed/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/no longer monitored for ID 0/).length).toBeGreaterThan(0);
  });

  it("the race outcome depends on the monitor implementation", () => {
    render(<ExclusiveAccessVisualizer />);
    situation("Two masters race");
    lockIn(/^EXOKAY: the write is performed/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    monitor("One shared monitor");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/^OKAY: the exclusive failed/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Implementation choice: a single shared monitor/)).toBeInTheDocument();
  });

  it("a slave without exclusive support answers OKAY and still writes (A7.2.5)", () => {
    render(<ExclusiveAccessVisualizer />);
    monitor("No exclusive support");
    lockIn(/^OKAY: memory is written anyway/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/A7\.2\.5/).length).toBeGreaterThan(0);
  });

  it("a 3 x 4-byte exclusive at 0x1004 breaks A7.2.4 and is UNPREDICTABLE", () => {
    render(<ExclusiveAccessVisualizer />);
    situation("Debug: bad exclusive");
    lockIn(/^UNPREDICTABLE/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/12 bytes is not a power of 2/).length).toBeGreaterThan(0);
  });

  it("supports keyboard selection of the situation", () => {
    render(<ExclusiveAccessVisualizer />);
    const first = within(screen.getByRole("radiogroup", { name: "Exclusive access situation" })).getByRole("radio", { name: "Uncontended" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(within(screen.getByRole("radiogroup", { name: "Exclusive access situation" })).getByRole("radio", { name: "Intervening normal write" })).toHaveAttribute("aria-checked", "true");
  });
});
