import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnimatedUvmSequenceDriverHandshakeDiagram } from "@/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram";

function commit(optionText: RegExp) {
  fireEvent.click(screen.getByLabelText(optionText));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
}

describe("AnimatedUvmSequenceDriverHandshakeDiagram", () => {
  it("keeps the named export and hides the trace until a prediction is committed", () => {
    render(<AnimatedUvmSequenceDriverHandshakeDiagram />);
    expect(screen.getByRole("region", { name: "Sequence, sequencer and driver handshake" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Handshake step playback controls" })).not.toBeInTheDocument();
    commit(/Blocked inside finish_item\(A1\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Handshake step playback controls" })).toBeInTheDocument();
  });

  it("steps with the keyboard and shows the sequence blocked in finish_item while the driver drives", () => {
    render(<AnimatedUvmSequenceDriverHandshakeDiagram />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const controls = screen.getByRole("group", { name: "Handshake step playback controls" });
    const next = within(controls).getByRole("button", { name: "Next handshake step" });
    for (let i = 0; i < 12 && !screen.queryByText(/Driving A1 until t = 10 ns/); i += 1) {
      fireEvent.keyDown(next, { key: "ArrowRight" });
    }
    expect(screen.getAllByText(/Driving A1 until t = 10 ns/).length).toBeGreaterThan(0);
    expect(screen.getByText(/blocked in finish_item\(A1\): waiting for item_done\(\)/)).toBeInTheDocument();
    // The sequence code panel highlights finish_item at this step.
    const current = document.querySelectorAll('[aria-current="step"]');
    expect(Array.from(current).some((el) => el.textContent?.includes("finish_item(req)"))).toBe(true);
  });

  it("missing item_done preset: the log shows the 'called twice' error and the fix completes the run", () => {
    render(<AnimatedUvmSequenceDriverHandshakeDiagram />);
    fireEvent.click(screen.getByRole("radio", { name: "Bug: no item_done()" }));
    expect(screen.getByText(/seq_item_port.item_done\(\);\s+<- missing/)).toBeInTheDocument();
    commit(/An error 'Get_next_item called twice/);
    const controls = screen.getByRole("group", { name: "Handshake step playback controls" });
    fireEvent.change(within(controls).getByRole("slider"), { target: { value: "999" } });
    expect(screen.getAllByText(/Get_next_item called twice without item_done or get in between/).length).toBeGreaterThan(0);
    expect(screen.getByText(/✕ Still running at t = 40 ns with 1 sequence\(s\) stuck/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Apply the fix/ }));
    fireEvent.change(within(screen.getByRole("group", { name: "Handshake step playback controls" })).getByRole("slider"), { target: { value: "999" } });
    expect(screen.getByText(/All sequences finished by t = 30 ns/)).toBeInTheDocument();
  });

  it("wrong prediction gets diagnostic feedback", () => {
    render(<AnimatedUvmSequenceDriverHandshakeDiagram />);
    fireEvent.click(screen.getByRole("radio", { name: "Bug: get_next_item twice" }));
    commit(/A2: the look-ahead works/);
    expect(screen.getByText(/A2 is only created after finish_item\(A1\) returns/)).toBeInTheDocument();
  });

  it("scenario picker is keyboard operable", () => {
    render(<AnimatedUvmSequenceDriverHandshakeDiagram />);
    const first = screen.getByRole("radio", { name: "Clean handshake" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Responses" })).toHaveAttribute("aria-checked", "true");
  });
});
