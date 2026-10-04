import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BridgeTranslationExplorer } from "@/components/visualizers/BridgeTranslationExplorer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("BridgeTranslationExplorer", () => {
  it("hides the output bursts until the learner predicts the count", () => {
    render(<BridgeTranslationExplorer />);
    expect(screen.getByTestId("bridge-translation-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("axi-bursts-container")).not.toBeInTheDocument();
    lockIn(/^1 burst$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const out = screen.getByTestId("axi-bursts-container");
    expect(out.textContent).toContain("AXI Burst 1");
    expect(out.textContent).not.toContain("AXI Burst 2");
  });

  it("a 1024-transfer undefined-length INCR splits only because of the AXI 256-transfer cap", () => {
    render(<BridgeTranslationExplorer />);
    fireEvent.click(screen.getByTestId("scenario-btn-2"));
    lockIn(/^3 or more bursts$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("axi-bursts-container")).getAllByText(/AXI Burst \d/)).toHaveLength(4);
    expect(screen.getAllByText(/stop at 256 transfers/).length).toBeGreaterThan(0);
  });

  it("the old 0x0FE0 example is illegal AHB stimulus, not a 4KB split", () => {
    render(<BridgeTranslationExplorer />);
    fireEvent.click(screen.getByTestId("scenario-btn-4"));
    lockIn(/^2 bursts$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/Check the input before translating it/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cross the 1KB boundary at 0x1000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/a_ahb_no_1kb_cross/)).toBeInTheDocument();
  });

  it("AXI to AHB: a legal AXI INCR16 across 0x0400 must be split at the 1KB boundary", () => {
    render(<BridgeTranslationExplorer />);
    fireEvent.click(screen.getByTestId("scenario-btn-5"));
    lockIn(/^2 bursts$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const out = screen.getByTestId("axi-bursts-container");
    expect(out.textContent).toContain("AHB Burst 1");
    expect(out.textContent).toContain("INCR4");
    expect(out.textContent).toContain("AHB Burst 2");
  });

  it("editing the AHB address to cross 1KB turns the input illegal and re-arms the prediction", () => {
    render(<BridgeTranslationExplorer />);
    lockIn(/^1 burst$/);
    fireEvent.change(screen.getByLabelText(/HADDR \(hex\)/), { target: { value: "0x03F8" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/^None: the input is illegal/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("downsizing a WRAP16 of doublewords needs two INCR bursts", () => {
    render(<BridgeTranslationExplorer />);
    fireEvent.click(screen.getByTestId("scenario-btn-3"));
    lockIn(/^2 bursts$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/limited to 2, 4, 8 or 16/).length).toBeGreaterThan(0);
  });

  it("scenario buttons expose their state and the output bus is keyboard operable", () => {
    render(<BridgeTranslationExplorer />);
    expect(screen.getByTestId("scenario-btn-0")).toHaveAttribute("aria-pressed", "true");
    const bus = within(screen.getByRole("radiogroup", { name: "Output bus width" })).getByRole("radio", { name: "32-bit" });
    bus.focus();
    fireEvent.keyDown(bus, { key: "ArrowRight" });
    expect(within(screen.getByRole("radiogroup", { name: "Output bus width" })).getByRole("radio", { name: "64-bit" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("scenario-btn-0")).toHaveAttribute("aria-pressed", "false");
  });
});
