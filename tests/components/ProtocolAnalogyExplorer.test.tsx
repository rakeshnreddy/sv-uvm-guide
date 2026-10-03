import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProtocolAnalogyExplorer } from "../../src/components/visualizers/ProtocolAnalogyExplorer";

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
const lanes = (name: "Write channels" | "Read channels") => screen.getByRole("list", { name });
const laneFor = (name: "Write channels" | "Read channels", channel: string) =>
  within(lanes(name)).getByText(channel).closest("li") as HTMLElement;

const commit = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
};

describe("ProtocolAnalogyExplorer", () => {
  afterEach(() => cleanup());

  it("keeps the lesson test id and declares itself an illustration", () => {
    render(<ProtocolAnalogyExplorer />);
    expect(screen.getByTestId("protocol-analogy-explorer")).toBeInTheDocument();
    expect(screen.getByText("Conceptual illustration")).toBeInTheDocument();
    expect(screen.getByText("Step 0 of 3")).toBeInTheDocument();
  });

  it("keeps the e2e contract: 'Reading Data' then 'Next Step' shows 'Step 1 of 2'", () => {
    render(<ProtocolAnalogyExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Reading Data/ }));
    expect(screen.getByRole("button", { name: /Reading Data/ })).toHaveAttribute("aria-pressed", "true");
    next();
    expect(screen.getAllByText("Step 1 of 2")).toHaveLength(1);
    expect(screen.getByText(/AR handshake: ARVALID && ARREADY/)).toBeInTheDocument();
    expect(within(laneFor("Read channels", "AR")).getByText("▶ handshake this step")).toBeInTheDocument();
    next();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByText(/RRESP is per beat/)).toBeInTheDocument();
    expect(within(laneFor("Read channels", "AR")).getByText("✓ handshake done")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next Step" })).toBeDisabled();
  });

  it("maps every write step to its real handshake and says where the analogy breaks", () => {
    render(<ProtocolAnalogyExplorer />);
    next();
    expect(screen.getByText(/AW handshake: AWVALID && AWREADY/)).toBeInTheDocument();
    expect(screen.getByText(/may arrive before, with, or after the box/)).toBeInTheDocument();
    next();
    expect(screen.getByText(/W handshake: WVALID && WREADY/)).toBeInTheDocument();
    next();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByText(/only after the AW handshake and the W handshake carrying WLAST/)).toBeInTheDocument();
    expect(screen.getByText(/one receipt per transaction/)).toBeInTheDocument();
  });

  it("gates the W-before-AW orders behind a prediction and diagnoses the 'W waits for AW' misconception", () => {
    render(<ProtocolAnalogyExplorer />);
    expect(screen.queryByRole("radiogroup", { name: "Write order" })).toBeNull();
    commit(/W handshake has to wait until the AW handshake/);
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getByText(/can deadlock against a legal slave/)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Write order" })).toBeInTheDocument();
  });

  it("walks the box-first order: W completes before AW and B still comes last", () => {
    render(<ProtocolAnalogyExplorer />);
    commit(/AW and W are independent channels/);
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    const order = screen.getByRole("radiogroup", { name: "Write order" });
    fireEvent.keyDown(within(order).getByRole("radio", { name: /Label first/ }), { key: "ArrowRight" });
    expect(within(order).getByRole("radio", { name: /Box first/ })).toHaveAttribute("aria-checked", "true");
    next();
    expect(within(laneFor("Write channels", "W")).getByText("▶ handshake this step")).toBeInTheDocument();
    expect(within(laneFor("Write channels", "AW")).getByText("○ not yet")).toBeInTheDocument();
    next();
    next();
    expect(within(laneFor("Write channels", "B")).getByText("▶ handshake this step")).toBeInTheDocument();
  });

  it("the same-edge order has two steps", () => {
    render(<ProtocolAnalogyExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Write order" })).getByRole("radio", { name: /Same edge/ }));
    expect(screen.getByText("Step 0 of 2")).toBeInTheDocument();
    next();
    expect(within(laneFor("Write channels", "AW")).getByText("▶ handshake this step")).toBeInTheDocument();
    expect(within(laneFor("Write channels", "W")).getByText("▶ handshake this step")).toBeInTheDocument();
  });

  it("read prediction: R cannot precede the AR handshake", () => {
    render(<ProtocolAnalogyExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Reading Data/ }));
    commit(/already holding RREADY high/);
    expect(screen.getByText(/does not create a transaction/)).toBeInTheDocument();
    expect(screen.getByText(/must wait for ARVALID and ARREADY before asserting RVALID/)).toBeInTheDocument();
  });

  it("steps back and resets", () => {
    render(<ProtocolAnalogyExplorer />);
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Step 0 of 3")).toBeInTheDocument();
  });

  it("states the handshake rule the relay picture hides: VALID must not depend on READY", () => {
    render(<ProtocolAnalogyExplorer />);
    expect(screen.getByText(/VALID must not depend on READY/)).toBeInTheDocument();
  });
});
