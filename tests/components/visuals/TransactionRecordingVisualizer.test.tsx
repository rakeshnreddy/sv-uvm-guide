import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TransactionRecordingVisualizer from "@/components/visuals/TransactionRecordingVisualizer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("TransactionRecordingVisualizer", () => {
  it("default: the stream stays hidden until the prediction, then shows an empty stream and begin_tr = 0", () => {
    render(<TransactionRecordingVisualizer />);
    expect(screen.queryByRole("figure", { name: "Transaction stream" })).not.toBeInTheDocument();
    lockIn(/Three closed transactions with kind/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/empty stream — nothing was recorded/)).toBeInTheDocument();
    expect(screen.getByText(/begin_tr\(\) returned: 0, 0, 0/)).toBeInTheDocument();
    expect(screen.getAllByText(/recording_detail = UVM_NONE|recording_detail defaults to UVM_NONE/).length).toBeGreaterThan(0);
  });

  it("set_recording_enabled(1) with do_record records rdata at end_tr", () => {
    render(<TransactionRecordingVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "set_recording_enabled(1)" }));
    lockIn(/Three closed transactions with kind/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const stream = screen.getByRole("figure", { name: "Transaction stream" });
    expect(within(stream).getByText("rdata='h3c")).toBeInTheDocument();
    expect(within(stream).getByText(/#102 20–40 ns/)).toBeInTheDocument();
  });

  it("forgetting end_tr leaves transactions open with no fields (keyboard selection)", () => {
    render(<TransactionRecordingVisualizer />);
    const enable = screen.getByRole("radiogroup", { name: "How recording is enabled" });
    fireEvent.keyDown(within(enable).getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(within(enable).getByRole("radio", { name: "set_recording_enabled(1)" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: /calls end_tr/ }));
    expect(screen.getByRole("figure", { name: "pkt_driver" })).toHaveTextContent(/\/\/ end_tr\(req\);\s+← forgotten/);
    lockIn(/Three transactions that never end/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByRole("figure", { name: "Transaction stream" })).getAllByText(/▶ never closed/).length).toBe(3);
  });

  it("config_db in run_phase is too late", () => {
    render(<TransactionRecordingVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "config_db in run_phase" }));
    lockIn(/Nothing at all/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/A set made in run_phase is never read/)).toBeInTheDocument();
  });
});
