import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AmbaFamilyExplorer } from "@/components/visualizers/AmbaFamilyExplorer";

const protocolGroup = () => screen.getByRole("radiogroup", { name: "Protocol" });
const blockGroup = () => screen.getByRole("radiogroup", { name: "Block" });
const profile = (name: string) => screen.getByRole("article", { name: `${name} profile` });

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
};

describe("AmbaFamilyExplorer", () => {
  afterEach(() => cleanup());

  it("keeps the lesson test id, declares a model fidelity, and opens on AXI4", () => {
    render(<AmbaFamilyExplorer />);
    expect(screen.getByTestId("amba-family-explorer")).toBeInTheDocument();
    expect(screen.getByText("Deterministic educational model")).toBeInTheDocument();
    expect(within(protocolGroup()).getByRole("radio", { name: "AXI4" })).toHaveAttribute("aria-checked", "true");
    expect(within(profile("AXI4")).getByText(/INCR 1 to 256 beats/)).toBeInTheDocument();
    expect(within(profile("AXI4")).getByText("IHI0022E §A3.4.1")).toBeInTheDocument();
  });

  it("states that out-of-order completion is across IDs only, and that EXOKAY is a response", () => {
    render(<AmbaFamilyExplorer />);
    const card = profile("AXI4");
    expect(within(card).getByText(/Different IDs may complete in any order; the same ID stays in order/)).toBeInTheDocument();
    expect(within(card).getByText(/OKAY, EXOKAY, SLVERR, DECERR/)).toBeInTheDocument();
  });

  it("shows AHB with separate HWDATA and HRDATA buses rather than one multiplexed channel", () => {
    render(<AmbaFamilyExplorer />);
    fireEvent.click(within(protocolGroup()).getByRole("radio", { name: "AHB" }));
    const card = profile("AHB");
    expect(within(card).getByText(/separate write \(HWDATA\) and read \(HRDATA\) data buses/)).toBeInTheDocument();
    expect(within(card).getByText(/two cycles/)).toBeInTheDocument();
    expect(within(card).queryByText(/multiplexed/i)).toBeNull();
  });

  it("moves between protocols with the arrow keys and shows ACE's snoop channels", () => {
    render(<AmbaFamilyExplorer />);
    const axi4 = within(protocolGroup()).getByRole("radio", { name: "AXI4" });
    fireEvent.keyDown(axi4, { key: "ArrowRight" });
    expect(within(protocolGroup()).getByRole("radio", { name: "AXI4-Lite" })).toHaveAttribute("aria-checked", "true");
    expect(within(profile("AXI4-Lite")).getByText(/EXOKAY is not supported/)).toBeInTheDocument();
    fireEvent.keyDown(within(protocolGroup()).getByRole("radio", { name: "AXI4-Lite" }), { key: "End" });
    expect(within(protocolGroup()).getByRole("radio", { name: "CHI" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(protocolGroup()).getByRole("radio", { name: "ACE" }));
    const lanes = within(profile("ACE")).getByRole("list", { name: "ACE channels and phases" });
    expect(within(lanes).getByText("← AC")).toBeInTheDocument();
    expect(within(lanes).getByText("CR →")).toBeInTheDocument();
  });

  it("hides the fit check until the learner commits a prediction", () => {
    render(<AmbaFamilyExplorer />);
    expect(within(blockGroup()).getByRole("radio", { name: "UART registers" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("list", { name: "Fit check for each option" })).toBeNull();
    commit(/^APB:/);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    const fit = screen.getByRole("list", { name: "Fit check for each option" });
    expect(within(fit).getByText(/Best fit/)).toBeInTheDocument();
    expect(within(fit).getByText(/Works, but pays for: several transactions in flight/)).toBeInTheDocument();
  });

  it("diagnoses a DMA choice of AHB by the capability it lacks", () => {
    render(<AmbaFamilyExplorer />);
    fireEvent.click(within(blockGroup()).getByRole("radio", { name: "DMA engine" }));
    commit(/^AHB:/);
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getByText(/only one transfer can be in its data phase/)).toBeInTheDocument();
    const fit = screen.getByRole("list", { name: "Fit check for each option" });
    expect(within(fit).getByText(/Lacks: several transactions in flight; reads and writes in progress at once/)).toBeInTheDocument();
  });

  it("re-locks the reveal when the block changes, and can open the winning profile", () => {
    render(<AmbaFamilyExplorer />);
    fireEvent.click(within(blockGroup()).getByRole("radio", { name: "I/O-coherent accelerator" }));
    commit(/^ACE-Lite:/);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show the ACE-Lite profile" }));
    expect(within(profile("ACE-Lite")).getByText(/I\/O \(one-way\) coherency/)).toBeInTheDocument();
    fireEvent.click(within(blockGroup()).getByRole("radio", { name: "Many-core mesh" }));
    expect(screen.queryByRole("list", { name: "Fit check for each option" })).toBeNull();
    commit(/^ACE:/);
    expect(screen.getByText(/no packets, node IDs or link credits/)).toBeInTheDocument();
  });
});
