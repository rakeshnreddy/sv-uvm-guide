import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RALPredictorVisualizer from "@/components/visuals/RALPredictorVisualizer";

const lockIn = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const pick = (group: string, name: string | RegExp) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }));
const envCode = () => screen.getByRole("list", { name: "Generated env wiring" }).textContent ?? "";

describe("RALPredictorVisualizer (model: src/lib/ral-model.ts predictionPath)", () => {
  it("names the modes correctly: implicit = set_auto_predict(1), explicit = uvm_reg_predictor on the monitor", () => {
    render(<RALPredictorVisualizer />);
    const implicit = screen.getByRole("row", { name: /^Implicit \(auto-predict\)/ });
    expect(implicit).toHaveTextContent("ral.default_map.set_auto_predict(1);");
    expect(implicit).toHaveTextContent("✕ no");
    const explicit = screen.getByRole("row", { name: /^Explicit \(uvm_reg_predictor\)/ });
    expect(explicit).toHaveTextContent("agent.mon.ap.connect(predictor.bus_in);");
    expect(explicit).toHaveTextContent("✓ yes");
    expect(screen.queryByText(/implicit prediction flow/i)).not.toBeInTheDocument();
  });

  it("keeps the path diagram hidden until the learner commits a prediction", () => {
    render(<RALPredictorVisualizer />);
    expect(screen.queryByRole("group", { name: "Path step playback controls" })).not.toBeInTheDocument();
    lockIn("0x0000_0005");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Path step playback controls" })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of \d+/)).toBeInTheDocument();
  });

  it("steps through the path with the keyboard", () => {
    render(<RALPredictorVisualizer />);
    lockIn("0x0000_0005");
    const controls = screen.getByRole("group", { name: "Path step playback controls" });
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    expect(screen.getByText(/Step 2 of \d+/)).toBeInTheDocument();
    expect(screen.getByText(/adapter.reg2bus\(\) with \{kind: UVM_WRITE/)).toBeInTheDocument();
    fireEvent.keyDown(controls, { key: "Home" });
    expect(screen.getByText(/Step 1 of \d+/)).toBeInTheDocument();
  });

  it("a predictor that is built but not connected leaves the mirror at reset, silently", () => {
    render(<RALPredictorVisualizer />);
    pick("Predictor", "built, not connected");
    expect(envCode()).toContain("// agent.mon.ap.connect(predictor.bus_in);  // missing");
    lockIn("0x0000_0000");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const controls = screen.getByRole("group", { name: "Path step playback controls" });
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(controls, { key: "ArrowRight" });
    expect(screen.getByText(/monitor.ap has no subscriber: the predictor's bus_in was never connected/)).toBeInTheDocument();
  });

  it("auto-predict cannot see a firmware write; only the explicit predictor can", () => {
    render(<RALPredictorVisualizer />);
    pick("Auto-predict", "1");
    pick("Predictor", "none");
    pick("Access", /firmware writes CTRL/);
    lockIn("0x0000_0000");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });

  it("both paths on: a W1T write is predicted twice and the mirror toggles back", () => {
    render(<RALPredictorVisualizer />);
    pick("Auto-predict", "1");
    pick("Access", /GPIO/);
    lockIn("0x0000_0000");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/✕ twice/)).toBeInTheDocument();
  });

  it("debug: finds the commented-out connect() and grades fixes with probes", () => {
    render(<RALPredictorVisualizer />);
    pick("Mode", /Debug/);
    expect(screen.getByText(/Register "ral.CTRL" value read from DUT \(0x0000000000000005\) does not match mirrored value \(0x0000000000000000\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: ral.default_map.set_auto_predict\(0\)/ }));
    expect(screen.getByText(/Not this one/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: \/\/ agent.mon.ap.connect/ }));
    expect(screen.getByText(/mon.ap has no subscriber/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Restore agent.mon.ap.connect/ }));
    expect(screen.getAllByText(/mirror matches DUT/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: /also set_auto_predict\(1\)/ }));
    expect(screen.getByText(/predicted twice: mirror toggled back/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /mirror\(status, UVM_NO_CHECK\) after every write/ }));
    expect(screen.getAllByText(/stale mirror/).length).toBeGreaterThan(0);
  });
});
