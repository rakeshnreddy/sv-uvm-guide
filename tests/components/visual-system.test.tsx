import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockDiagram, pointAlong } from "@/components/visual-system/BlockDiagram";
import { CycleWaveform } from "@/components/visual-system/CycleWaveform";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";

describe("SegmentedControl", () => {
  function Harness() {
    const [v, setV] = useState<"a" | "b" | "c">("a");
    return (
      <SegmentedControl
        label="Mode"
        value={v}
        onChange={setV}
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
          { value: "c", label: "Gamma" },
        ]}
      />
    );
  }

  it("is a radio group with roving tabindex and arrow-key selection", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Mode" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Beta" }), { key: "End" });
    expect(screen.getByRole("radio", { name: "Gamma" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Gamma" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("CycleWaveform", () => {
  it("exposes sampled values in a screen-reader table and toggles editable bits from the keyboard", () => {
    const toggles: string[] = [];
    render(
      <CycleWaveform
        title="Handshake"
        caption="Values are sampled at each rising edge."
        edges={4}
        signals={[
          { name: "clk", kind: "clock" },
          { name: "req", kind: "bit", values: [0, 1, 1, 0], editable: true },
          { name: "data", kind: "bus", values: ["X", 5, 5, 7] },
        ]}
        markers={[{ edge: 2, tone: "fail", label: "attempt 1 fails" }]}
        onToggle={(s, k) => toggles.push(`${s}@${k}`)}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /req/ })).toHaveTextContent("req0110");
    expect(within(table).getByRole("row", { name: /data/ })).toHaveTextContent("dataX557");
    const cell = screen.getByRole("button", { name: "req at edge 1: 1. Toggle." });
    expect(cell).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(toggles).toEqual(["req@1"]);
  });
});

describe("BlockDiagram", () => {
  it("makes nodes selectable by keyboard with role tags in their names", () => {
    const picked: string[] = [];
    render(
      <BlockDiagram
        title="Agent"
        width={300}
        height={120}
        nodes={[
          { id: "drv", label: "driver", kind: "driver", x: 10, y: 10, w: 100, h: 50 },
          { id: "sqr", label: "sequencer", kind: "sequencer", x: 180, y: 10, w: 100, h: 50, badge: "active" },
        ]}
        ports={[{ id: "p", nodeId: "drv", side: "right", offset: 0.5, kind: "port" }]}
        edges={[{ id: "e", from: "p", to: "sqr", style: "data", label: "item" }]}
        tokens={[{ edgeId: "e", t: 0.5, label: "txn" }]}
        onSelect={(id) => picked.push(id)}
      />,
    );
    const sqr = screen.getByRole("button", { name: /SQR sequencer, active/ });
    fireEvent.keyDown(sqr, { key: " " });
    expect(picked).toEqual(["sqr"]);
  });

  it("interpolates token positions along multi-segment edges", () => {
    expect(pointAlong([[0, 0], [10, 0], [10, 10]], 0.5)).toEqual([10, 0]);
    expect(pointAlong([[0, 0], [10, 0], [10, 10]], 0.75)).toEqual([10, 5]);
    expect(pointAlong([[0, 0], [10, 0]], 2)).toEqual([10, 0]);
  });
});

describe("HintLadder", () => {
  it("reveals one hint per request and resets on a new key", () => {
    const { rerender } = render(<HintLadder hints={["one", "two"]} resetKey="a" />);
    fireEvent.click(screen.getByRole("button", { name: /Need a hint/ }));
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.queryByText("two")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    expect(screen.getByText("two")).toBeInTheDocument();
    rerender(<HintLadder hints={["one", "two"]} resetKey="b" />);
    expect(screen.queryByText("one")).not.toBeInTheDocument();
  });
});
