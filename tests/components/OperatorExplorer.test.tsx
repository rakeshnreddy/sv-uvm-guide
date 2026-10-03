import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OperatorExplorer from "@/components/visuals/OperatorExplorer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));

describe("OperatorExplorer", () => {
  it("hides the result until a prediction is locked in, then shows the per-bit truth table", () => {
    render(<OperatorExplorer />);
    expect(screen.getByText('$display("%b", a & b);')).toBeInTheDocument();
    expect(screen.queryByText(/Bit by bit, using the truth table/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a 0 on either side forces 0/)).not.toBeInTheDocument();
    // a = 4'b10xz, b = 4'b0110 → a & b = 4'b00x0 (Table 11-11).
    fireEvent.click(screen.getByLabelText("4'b00x0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Bit by bit, using the truth table/)).toBeInTheDocument();
    expect(screen.getByText("z & 0 = 0")).toBeInTheDocument();
  });

  it("diagnoses the 'any x poisons everything' answer for a bitwise operator", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByLabelText("4'bxxxx"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/arithmetic rule/)).toBeInTheDocument();
  });

  it("binary ~& is a compile error, not a bitwise NAND", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
    expect(screen.getByText('$display("%b", a ~& b);')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/bitwise NAND/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Compile error: SystemVerilog has no binary ~& operator/)).toBeInTheDocument();
  });

  it("inside matches with wildcards and shows what === would have said", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Try inside/ }));
    fireEvent.click(screen.getByLabelText("1'b0"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/If inside used/)).toBeInTheDocument();
  });

  it("keyboard: End selects the Streaming family; {<<{16'hA55A}} reveals 16'h5AA5", () => {
    render(<OperatorExplorer />);
    const group = screen.getByRole("radiogroup", { name: "Operator family" });
    const checked = within(group).getByRole("radio", { checked: true });
    checked.focus();
    fireEvent.keyDown(checked, { key: "End" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("Streaming");
    expect(screen.getByText(/logic \[15:0\] a = 16'hA55A;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("16'h5AA5"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /\{<< \{a\}\} result: 16'h5AA5/ })).toBeInTheDocument();
    expect(screen.getByText(/a bit reversal and a byte swap give the same result/)).toBeInTheDocument();
  });

  it("editing a bit cycles 0 → 1 → x → z, re-runs the model and resets the prediction", () => {
    render(<OperatorExplorer />);
    reveal();
    expect(screen.getByText(/Bit by bit, using the truth table/)).toBeInTheDocument();
    const bit3 = screen.getByRole("button", { name: /^b bit 3 is 0; press to change to 1/ });
    fireEvent.click(bit3);
    expect(screen.getByRole("button", { name: /^b bit 3 is 1; press to change to x/ })).toBeInTheDocument();
    expect(screen.queryByText(/Bit by bit, using the truth table/)).not.toBeInTheDocument();
    expect(screen.getByText(/logic \[3:0\] b = 4'b1110;/)).toBeInTheDocument();
  });

  it("shift: >> on a signed operand still fills with 0; >>> copies the sign bit", () => {
    render(<OperatorExplorer family="shift" />);
    fireEvent.click(screen.getByRole("radio", { name: "a >> n" }));
    reveal();
    expect(screen.getByRole("img", { name: /a >> n result: 4'b0100/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "a >>> n" }));
    reveal();
    expect(screen.getByRole("img", { name: /a >>> n result: 4'b1100/ })).toBeInTheDocument();
  });

  it("equality shows ==, === and ==? side by side for the same operands", () => {
    render(<OperatorExplorer family="equality" />);
    fireEvent.click(screen.getByLabelText("1'bx"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const trio = screen.getByLabelText("The three equality operators on the same operands");
    // a = b = 4'b1x10: == is ambiguous (x), === matches literally (1), ==? treats b's x as a wildcard (1).
    const chips = Array.from(trio.querySelectorAll("[aria-label]")).map((e) => e.getAttribute("aria-label"));
    expect(chips).toEqual(["x, unknown (X)", "1", "1"]);
  });
});
