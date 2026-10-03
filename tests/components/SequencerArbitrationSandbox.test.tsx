import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import SequencerArbitrationSandbox from "@/components/exercises/SequencerArbitrationSandbox";

describe("SequencerArbitrationSandbox", () => {
  beforeEach(() => window.localStorage.clear());

  it("hides the grant order until a prediction is committed, then explains every candidate", () => {
    render(<SequencerArbitrationSandbox />);
    expect(screen.getByText(/FIFO: which sequence receives grant #2 at t = 10 ns\?/)).toBeInTheDocument();
    expect(screen.queryByText(/Grant order:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^C \(seq_c, priority 300\)/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/FIFO ignores priority/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Grant order: A1@0 → B1@10 → C1@20 → A2@30 → B2@40 → C2@50/)).toBeInTheDocument();
  });

  it("STRICT_FIFO preset: C's priority wins grant #2", () => {
    render(<SequencerArbitrationSandbox />);
    fireEvent.click(screen.getByRole("radio", { name: "STRICT_FIFO" }));
    fireEvent.click(screen.getByLabelText(/^C \(seq_c, priority 300\)/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Grant order: A1@0 → C1@10 → C2@20/)).toBeInTheDocument();
  });

  it("forgot unlock(): the lock is held until the owner exits, with SEQFINERR in the log", () => {
    render(<SequencerArbitrationSandbox />);
    fireEvent.click(screen.getByRole("radio", { name: "Forgot unlock()" }));
    fireEvent.click(screen.getByLabelText(/At 30 ns: the lock is released/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/There is no auto-release/)).toBeInTheDocument();
    expect(screen.getByText(/UVM_ERROR @ 70 ns \[SEQFINERR\]/)).toBeInTheDocument();
    expect(screen.getByText(/C1@70/)).toBeInTheDocument();
  });

  it("grab beats a waiting lock", () => {
    render(<SequencerArbitrationSandbox />);
    fireEvent.click(screen.getByRole("radio", { name: "grab vs lock" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByText(/Grant order: A1@0 → C1@30 → B1@40/)).toBeInTheDocument();
  });

  it("weighted mode asks for odds and shows a seed check against the rule", () => {
    render(<SequencerArbitrationSandbox />);
    fireEvent.click(screen.getByRole("radio", { name: "WEIGHTED" }));
    expect(screen.getByText(/What is the chance that B wins\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("60%"));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Model check: grant #2 over 400 seeds/)).toBeInTheDocument();
    expect(screen.getAllByText(/rule says 60%/).length).toBe(1);
  });

  it("editing a sequence regenerates the code and resets the prediction", () => {
    render(<SequencerArbitrationSandbox />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByText(/Grant order:/)).toBeInTheDocument();
    const editorB = screen.getByRole("group", { name: /seq_b \(B\)/ });
    fireEvent.change(within(editorB).getByLabelText("Before items"), { target: { value: "lock" } });
    expect(screen.queryByText(/Grant order:/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Edited:/)).toBeInTheDocument();
    expect(screen.getByText(/^lock\(\);$/)).toBeInTheDocument();
  });

  it("mode picker is keyboard operable", () => {
    render(<SequencerArbitrationSandbox />);
    const fifo = screen.getByRole("radio", { name: "UVM_SEQ_ARB_FIFO" });
    fifo.focus();
    fireEvent.keyDown(fifo, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "UVM_SEQ_ARB_WEIGHTED" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/each request's chance is its priority divided by the sum/)).toBeInTheDocument();
  });
});
