import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import VirtualSequencerExplorer from "@/components/curriculum/interactives/VirtualSequencerExplorer";

function predict(label: RegExp) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
}

describe("VirtualSequencerExplorer", () => {
  it("shows the p_sequencer code and hides the timeline until a prediction is made", () => {
    render(<VirtualSequencerExplorer />);
    expect(screen.getByText(/`uvm_declare_p_sequencer\(soc_vsqr\)/)).toBeInTheDocument();
    expect(screen.getByText(/d.start\(p_sequencer.data_sqr\);/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Timeline/ })).not.toBeInTheDocument();
  });

  it("fork…join: D1 starts at 0 ns, before configuration finishes", () => {
    render(<VirtualSequencerExplorer />);
    predict(/t = 40 ns, right after cfg_seq returns/);
    expect(screen.getByText(/fork does not order its branches/)).toBeInTheDocument();
    expect(screen.getByText(/Data item D1 reaches the data driver at t = 0 ns, before configuration completes at t = 40 ns/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Timeline/ })).toBeInTheDocument();
  });

  it("ordered dispatch: data starts after cfg_seq returns", () => {
    render(<VirtualSequencerExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "one after another" }));
    predict(/t = 40 ns, right after cfg_seq returns/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Configuration completes at t = 40 ns; the first data item starts at t = 40 ns/)).toBeInTheDocument();
  });

  it("join_none: the test ends at 0 ns", () => {
    render(<VirtualSequencerExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "fork … join_none" }));
    predict(/Never: the test ends before any data item is driven/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/vseq.start\(\) returned at 0 ns/)).toBeInTheDocument();
  });

  it("debug: a forgotten handle assignment is a UVM_FATAL from start_item", () => {
    render(<VirtualSequencerExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "one after another" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /env.connect_phase assigns/ }));
    expect(screen.getByText(/<- forgotten/)).toBeInTheDocument();
    predict(/Never: data_seq hits a UVM_FATAL/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/UVM_FATAL @ 40 ns \[SEQ\]/)).toBeInTheDocument();
  });

  it("dispatch picker is keyboard operable", () => {
    render(<VirtualSequencerExplorer />);
    const current = screen.getByRole("radio", { name: "fork … join" });
    current.focus();
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "fork … join_none" })).toHaveAttribute("aria-checked", "true");
  });
});
