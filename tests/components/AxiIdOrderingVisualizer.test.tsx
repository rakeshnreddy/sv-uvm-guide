import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AxiIdOrderingVisualizer, {
  ID_ORDERING_MENU,
  ORDERING_PRESETS,
  READ_AFTER_WRITE_PRESET,
  isLegalReadResult,
} from "@/components/visualizers/AxiIdOrderingVisualizer";
import { isLegalOrdering } from "@/lib/axi-channel-model";

const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const situation = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name }));

describe("AxiIdOrderingVisualizer", () => {
  it("every preset offers exactly one order that the model accepts", () => {
    for (const p of ORDERING_PRESETS) {
      expect(p.options.filter((seq) => isLegalOrdering(p.kind, p.requests, seq)), p.id).toHaveLength(1);
    }
  });

  it("hides the waveform and the play controls until the learner commits", () => {
    render(<AxiIdOrderingVisualizer />);
    expect(screen.getByTestId("axi-id-ordering-visualizer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send A" })).not.toBeInTheDocument();
    lockIn("A0, A1, B0, B1");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send A" })).toBeInTheDocument();
  });

  it("explains why same-ID read data may not be reordered (A5.3.1)", () => {
    render(<AxiIdOrderingVisualizer />);
    lockIn("B0, B1, A0, A1");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/Same-ID read data must return in address order/).length).toBeGreaterThan(0);
  });

  it("lets different IDs interleave and keeps same-ID order", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Reads, different IDs");
    lockIn("B0, A0, B1, A1, C");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("play mode records an illegal same-ID transfer with the reason", () => {
    render(<AxiIdOrderingVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Send B" }));
    expect(screen.getAllByText(/B has ARID 3, like A/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Send A" }));
    expect(screen.getAllByText(/no earlier read with ARID 3/).length).toBeGreaterThan(0);
  });

  it("AXI4 write data cannot interleave even with different AWIDs (A5.4)", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Write data (AXI4)");
    lockIn("X0, Y, X1");
    expect(screen.getAllByText(/consecutive transfers/).length).toBeGreaterThan(0);
  });

  it("shows the interconnect ID arithmetic: 2'b10 from M0 is 3'b010 (2), from M1 is 3'b110 (6)", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Two masters");
    const table = screen.getByRole("table");
    expect(within(table).getByText("3'b010")).toBeInTheDocument();
    expect(within(table).getByText("3'b110")).toBeInTheDocument();
    expect(within(table).getByText("6")).toBeInTheDocument();
    lockIn("M1:B, M0:A, M0:C");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("supports keyboard navigation between situations", () => {
    render(<AxiIdOrderingVisualizer />);
    const first = within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name: "Reads, same ID" });
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name: "Two masters" })).toHaveAttribute("aria-checked", "true");
  });

  it("offers six situations, with read after write between the four rules and Two masters", () => {
    expect(ID_ORDERING_MENU.map((m) => m.value)).toEqual(["same-id", "diff-id", "b-order", "w-order", "read-after-write", "interconnect"]);
  });

  it("read after write: exactly one offered result pair is legal (A5.3.4, A6.1, A6.4)", () => {
    const legal = READ_AFTER_WRITE_PRESET.options.filter((o) => isLegalReadResult(READ_AFTER_WRITE_PRESET, o));
    expect(legal).toEqual([{ R1: "0x00", R2: "0x42" }]);
    // R1 was issued before the write's B and R2 after it.
    const { write, reads } = READ_AFTER_WRITE_PRESET;
    expect(reads[0].arEdge).toBeLessThan(write.bEdge);
    expect(reads[1].arEdge).toBeGreaterThan(write.bEdge);
    expect(reads.every((r) => r.id === write.id)).toBe(true);
  });

  it("opens on the situation named by initialPreset", () => {
    render(<AxiIdOrderingVisualizer initialPreset="read-after-write" />);
    const group = screen.getByRole("radiogroup", { name: "Ordering situation" });
    expect(within(group).getByRole("radio", { name: "Read after write, same ID" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/It issues read R1 \(ARID 1\)/)).toBeInTheDocument();
  });

  it("falls back to the first situation for an unknown initialPreset", () => {
    render(<AxiIdOrderingVisualizer initialPreset={"nope" as never} />);
    expect(within(screen.getByRole("radiogroup", { name: "Ordering situation" })).getByRole("radio", { name: "Reads, same ID" })).toHaveAttribute("aria-checked", "true");
  });

  it("read after write: a stale R2 is the bug, because R2 was issued after B (A6.4)", () => {
    render(<AxiIdOrderingVisualizer initialPreset="read-after-write" />);
    lockIn("R1 = 0x00, R2 = 0x00");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/R2 was issued at edge 6, after the write's B at edge 5/).length).toBeGreaterThan(0);
  });

  it("read after write: the legal pair explains both reads", () => {
    render(<AxiIdOrderingVisualizer initialPreset="read-after-write" />);
    lockIn("R1 = 0x00, R2 = 0x42");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/R1 may return 0x00 or 0x42 \(IHI0022E A5\.3\.4, A6\.1\); R2 may return only 0x42 \(IHI0022E A6\.4\)/).length).toBeGreaterThan(0);
  });

  it("read after write: play the slave and see each returned value checked", () => {
    render(<AxiIdOrderingVisualizer />);
    situation("Read after write, same ID");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByText(/not returned yet/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "R1 returns 0x42" }));
    expect(screen.getByRole("button", { name: "R1 returns 0x42" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/Legal: R1 returns 0x42/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "R2 returns 0x00" }));
    expect(screen.getAllByText(/Illegal: R2 returns 0x00, the stale value from before the write/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "R2 returns 0x42" }));
    expect(screen.queryAllByText(/Illegal: R2/)).toHaveLength(0);
  });
});
