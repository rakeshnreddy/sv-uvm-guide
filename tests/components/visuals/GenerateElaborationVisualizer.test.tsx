import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GenerateElaborationVisualizer from "@/components/visuals/GenerateElaborationVisualizer";

const lockIn = (path: string) => {
  fireEvent.click(screen.getByLabelText(path));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const instances = () => within(screen.getByRole("list", { name: "Elaborated instances" })).getAllByRole("listitem").map((li) => li.textContent);

describe("GenerateElaborationVisualizer", () => {
  it("hides the elaborated paths until the learner predicts one", () => {
    render(<GenerateElaborationVisualizer />);
    expect(screen.queryByRole("list", { name: "Elaborated instances" })).not.toBeInTheDocument();
    lockIn("tb_top.gen_chk[1].chk_inst");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(instances()).toEqual(["tb_top.gen_chk[0].chk_inst", "tb_top.gen_chk[1].chk_inst"]);
  });

  it("diagnoses the instance-array misconception", () => {
    render(<GenerateElaborationVisualizer />);
    lockIn("tb_top.chk_inst[1]");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/The index belongs to the block, not to the instance/)).toBeInTheDocument();
  });

  it("an unlabelled loop becomes genblk1, and genblk2 when another generate construct comes first (§27.6)", () => {
    render(<GenerateElaborationVisualizer />);
    fireEvent.click(screen.getByLabelText(/Label the loop block/));
    lockIn("tb_top.genblk1[1].chk_inst");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/generate block first/));
    lockIn("tb_top.genblk2[1].chk_inst");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(instances()).toContain("tb_top.gen_cov.u_cov");
  });

  it("the NUM_CH stepper changes the code and the number of elaborated instances", () => {
    render(<GenerateElaborationVisualizer />);
    fireEvent.click(screen.getByRole("button", { name: /Increase channels/i }));
    expect(screen.getByText(/parameter int NUM_CH = 3;/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(instances()).toHaveLength(3);
    expect(instances()).toContain("tb_top.gen_chk[2].chk_inst");
  });

  it("clamps NUM_CH between 1 and 4", () => {
    render(<GenerateElaborationVisualizer />);
    const dec = screen.getByRole("button", { name: /Decrease channels/i });
    fireEvent.click(dec);
    expect(dec).toBeDisabled();
    const inc = screen.getByRole("button", { name: /Increase channels/i });
    fireEvent.click(inc);
    fireEvent.click(inc);
    fireEvent.click(inc);
    expect(inc).toBeDisabled();
  });

  it("the runtime view shows one process iterating, selected with the keyboard", () => {
    render(<GenerateElaborationVisualizer />);
    const view = screen.getByRole("radiogroup", { name: "View" });
    const gen = within(view).getByRole("radio", { name: "Generate (Elaboration)" });
    gen.focus();
    fireEvent.keyDown(gen, { key: "ArrowRight" });
    expect(screen.getByText(/Runtime execution \(simulation time\)/)).toBeInTheDocument();
    expect(screen.getByText(/cannot instantiate/)).toBeInTheDocument();
  });
});
