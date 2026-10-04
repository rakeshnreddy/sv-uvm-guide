import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmSequenceHierarchyVisualizer, { UvmSequenceHierarchyVisualizer as Named } from "@/components/visualizers/UvmSequenceHierarchyVisualizer";

function revealAndJumpToEnd() {
  const controls = screen.getByRole("group", { name: "Call playback controls" });
  fireEvent.change(within(controls).getByRole("slider"), { target: { value: "999" } });
}

describe("UvmSequenceHierarchyVisualizer", () => {
  it("keeps both default and named exports", () => {
    expect(Named).toBe(UvmSequenceHierarchyVisualizer);
  });

  it("gates the call trace behind a prediction about write_seq's hooks", () => {
    render(<UvmSequenceHierarchyVisualizer />);
    expect(screen.getByText(/top_seq.body\(\) starts write_seq with write_seq.start\(m_sequencer, this\);/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Call playback controls" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^write_seq.pre_start\(\) → write_seq.pre_body\(\) → top_seq.pre_do\(0\)/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Call playback controls" })).toBeInTheDocument();
  });

  it("`uvm_do skips pre_body/post_body for read_seq (call_pre_post = 0)", () => {
    render(<UvmSequenceHierarchyVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    revealAndJumpToEnd();
    const log = screen.getByRole("list", { name: "Call log so far" });
    expect(within(log).getByText("write_seq.pre_body()")).toBeInTheDocument();
    expect(within(log).queryByText("read_seq.pre_body()")).not.toBeInTheDocument();
    expect(within(log).getByText("top_seq.mid_do(read_seq)")).toBeInTheDocument();
    expect(within(log).getByText("read_seq.randomize()")).toBeInTheDocument();
  });

  it("changing the start style resets the prediction and changes the correct answer", () => {
    render(<UvmSequenceHierarchyVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const group = screen.getByRole("radiogroup", { name: "How top_seq starts write_seq" });
    fireEvent.click(within(group).getByRole("radio", { name: "start(m_sequencer)" }));
    expect(screen.queryByRole("group", { name: "Call playback controls" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^write_seq.pre_start\(\) → write_seq.pre_body\(\) → write_seq.body\(\)/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("debug: a parent lock deadlocks a child started without a parent", () => {
    render(<UvmSequenceHierarchyVisualizer />);
    fireEvent.click(screen.getByRole("checkbox", { name: /top_seq calls lock\(\) first/ }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "How top_seq starts write_seq" })).getByRole("radio", { name: "start(m_sequencer)" }));
    fireEvent.click(screen.getByLabelText(/It waits forever/));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    revealAndJumpToEnd();
    expect(screen.getByText(/✕ Deadlock: nothing reports an error/)).toBeInTheDocument();
    expect(screen.getByText(/write_seq: blocked/)).toBeInTheDocument();
  });

  it("item detail shows wait_for_grant and the item hooks; the playback is keyboard operable", () => {
    render(<UvmSequenceHierarchyVisualizer />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Show the calls inside start_item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const controls = screen.getByRole("group", { name: "Call playback controls" });
    const next = within(controls).getByRole("button", { name: "Next call" });
    fireEvent.keyDown(next, { key: "ArrowRight" });
    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(screen.getByText(/call 3 of/)).toBeInTheDocument();
    revealAndJumpToEnd();
    const log = screen.getByRole("list", { name: "Call log so far" });
    expect(within(log).getAllByText("m_sequencer.wait_for_grant(write_seq, priority)")).toHaveLength(1);
    expect(within(log).getByText("write_seq.mid_do(req)")).toBeInTheDocument();
  });
});
