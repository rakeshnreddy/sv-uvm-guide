import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TLMPortConnector from "@/components/curriculum/interactives/TLMPortConnector";

const lockIn = (answer: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const choose = (line: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "connect_phase line" })).getByRole("radio", { name: line }));

describe("TLMPortConnector (pull model)", () => {
  it("hides the flow until a prediction is locked in", () => {
    render(<TLMPortConnector />);
    expect(screen.queryByRole("group", { name: /Step playback controls/ })).not.toBeInTheDocument();
    lockIn(/^Sequencer → driver/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Step playback controls/ })).toBeInTheDocument();
  });

  it("steps through the handshake with the keyboard; the item returns sequencer → driver", () => {
    render(<TLMPortConnector />);
    lockIn(/^Driver → sequencer/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    const controls = screen.getByRole("group", { name: /Step playback controls/ });
    const next = within(controls).getByRole("button", { name: "Next step" });
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(screen.getByText(/req travels sequencer → driver/)).toBeInTheDocument();
  });

  it("reversed connect: BUILDERR before run_phase", () => {
    render(<TLMPortConnector />);
    choose("sqr.seq_item_export.connect(drv.seq_item_port);");
    lockIn(/^UVM_ERROR \[Connection Error\] during connect_phase/);
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("[BUILDERR] stopping due to build errors");
  });

  it("missing connect: no elaboration error, null object access at the first get_next_item", () => {
    render(<TLMPortConnector />);
    choose("// connect line deleted");
    lockIn(/^At end_of_elaboration/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/min_size 0/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Simulation log")).not.toBeInTheDocument();
  });
});
