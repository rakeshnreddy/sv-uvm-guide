import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProceduralBlocksSimulator from "@/components/animations/ProceduralBlocksSimulator";
import { proceduralScenarios } from "@/components/animations/procedural-blocks-data";
import { simulateProcesses } from "@/lib/sv-process-model";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("ProceduralBlocksSimulator", () => {
  it("is read-only and gates the run behind a prediction", () => {
    render(<ProceduralBlocksSimulator />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /playback controls/i })).not.toBeInTheDocument();
    lockIn(/final: count = 2, at t = 22 ns/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: /process step scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    const output = screen.getByText(/Simulation output/i).closest("div") as HTMLElement;
    expect(within(output).getByText(/final: count = 2/).closest("li")).toHaveTextContent("22 ns");
  });

  it("shows nonblocking updates in the NBA region of the same time step", () => {
    render(<ProceduralBlocksSimulator scenario="nba-swap" />);
    lockIn(/display a=1 b=2 and \$strobe a=1 b=2/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/land in the NBA region of the same time step/)).toBeInTheDocument();

    const nbaIndex = simulateProcesses(proceduralScenarios[1].build("nba")).trace.findIndex((s) => s.region === "nba");
    fireEvent.change(screen.getByRole("slider", { name: /process step scrubber/i }), { target: { value: nbaIndex } });
    expect(screen.getByText("NBA region")).toBeInTheDocument();
    expect(screen.getByText(/NBA region, still t = 10: a updates 1 → 2/)).toBeInTheDocument();
    expect(screen.getByText("t = 10 ns")).toBeInTheDocument();
  });

  it("switching to blocking assignments re-runs the model and resets the prediction", () => {
    render(<ProceduralBlocksSimulator scenario="nba-swap" />);
    fireEvent.click(screen.getByRole("radio", { name: "Blocking assignments" }));
    expect(screen.getAllByText("a = b;").length).toBeGreaterThan(0);
    lockIn(/display a=2 b=2, then \$strobe a=2 b=2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("supports keyboard scenario selection", () => {
    render(<ProceduralBlocksSimulator />);
    const programs = screen.getByRole("radiogroup", { name: "Program" });
    fireEvent.keyDown(within(programs).getByRole("radio", { name: /initial · always · final/ }), { key: "ArrowRight" });
    expect(within(programs).getByRole("radio", { name: /<= versus =/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/what do \$display and \$strobe print/i)).toBeInTheDocument();
  });
});
