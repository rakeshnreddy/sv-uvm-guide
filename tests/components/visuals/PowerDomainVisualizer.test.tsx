import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PowerDomainVisualizer from "../../../src/components/curriculum/interactives/visuals/PowerDomainVisualizer";

const narration = () => screen.getByText(/^Step \d+ of \d+/).closest("div") as HTMLElement;

describe("PowerDomainVisualizer", () => {
  it("gates the sequence behind a prediction and diagnoses a wrong guess", () => {
    render(<PowerDomainVisualizer />);
    expect(screen.getByRole("region", { name: "Power domain sequence model" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /PMU step playback controls/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^X reaches PD_TOP at some step, but ctx/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/cpu_iso_en is 1 at every one of those steps/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: /PMU step playback controls/ })).toBeInTheDocument();
  });

  it("keeps isolation on through restore and only releases it at the last step (keyboard stepping)", () => {
    render(<PowerDomainVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const controls = screen.getByRole("group", { name: /PMU step playback controls/ });
    const next = within(controls).getByRole("button", { name: /Next pmu step/i });
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(narration()).toHaveTextContent(/Step 5 of 6 · Restore \(retention\)/);
    expect(screen.getByRole("img", { name: /isolation clamping to 0, ctx 8'hA5/ })).toBeInTheDocument();
    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: /isolation passing, ctx 8'hA5.*PD_TOP sees 8'hA5/ })).toBeInTheDocument();
  });

  it("highlights the UPF command that governs the current step", () => {
    render(<PowerDomainVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const controls = screen.getByRole("group", { name: /PMU step playback controls/ });
    fireEvent.click(within(controls).getByRole("button", { name: /Next pmu step/i }));
    const current = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step");
    expect(current.map((li) => li.textContent).join(" ")).toMatch(/set_isolation iso_cpu/);
  });

  it("the early-release preset shows X reaching PD_TOP and the failing assertion", () => {
    render(<PowerDomainVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Release isolation before restore" }));
    fireEvent.click(screen.getByLabelText(/^X reaches PD_TOP at some step, but ctx/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Not clean: X reaches PD_TOP at step 5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select edge 5" }));
    expect(screen.getByText(/✕ X reached PD_TOP/)).toBeInTheDocument();
    expect(screen.getByText(/fails at step 5/)).toBeInTheDocument();
  });

  it("build-your-own mode runs the learner's sequence through the model", () => {
    render(<PowerDomainVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "PMU sequence" });
    fireEvent.keyDown(within(group).getByRole("radio", { checked: true }), { key: "End" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("Build your own");
    const add = screen.getByRole("group", { name: "Add a PMU action" });
    fireEvent.click(within(add).getByRole("button", { name: "+ Power off" }));
    expect(screen.getByText(/Not clean: X reaches PD_TOP at step 1/)).toBeInTheDocument();
    expect(within(add).getByRole("button", { name: "+ Power off" })).toBeDisabled();
    fireEvent.click(within(add).getByRole("button", { name: "Undo last" }));
    fireEvent.click(within(add).getByRole("button", { name: "+ Assert isolation" }));
    fireEvent.click(within(add).getByRole("button", { name: "+ Power off" }));
    expect(screen.queryByText(/X reaches PD_TOP at step/)).not.toBeInTheDocument();
    expect(screen.getByText(/ctx ends as X/)).toBeInTheDocument();
  });
});
