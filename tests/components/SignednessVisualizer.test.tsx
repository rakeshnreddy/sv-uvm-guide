import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignednessVisualizer from "@/components/visuals/SignednessVisualizer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
const steps = () => screen.queryByRole("list", { name: "Evaluation steps" });
const code = () => within(screen.getByRole("list", { name: "The code" }));

describe("SignednessVisualizer (expression trap lab)", () => {
  it("hides the trace until a prediction is locked in, then diagnoses the ordinary-math answer", () => {
    render(<SignednessVisualizer />);
    expect(code().getByText("r = a + u;")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("r = 6"));
    lockIn();

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/ordinary integer math/).length).toBeGreaterThan(0);
    const list = steps();
    expect(list).toBeInTheDocument();
    // §11.8.2: a is zero-extended because u makes the expression unsigned.
    expect(within(list as HTMLElement).getByText(/Zero-extend/)).toBeInTheDocument();
    expect(within(list as HTMLElement).getByRole("img", { name: /a in context: 8-bit value 8'b0000_1100; bits 7 to 4 added by extension/ })).toBeInTheDocument();
    expect(screen.getByText(/ACT r = 22/)).toBeInTheDocument();
    expect(screen.getByText(/Differs from what the author meant/)).toBeInTheDocument();
  });

  it("the fix variant sign-extends a and matches the author's intent", () => {
    render(<SignednessVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "a + $signed(u)" }));
    expect(code().getByText("r = a + $signed(u);")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("r = 6"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(steps() as HTMLElement).getByText(/Sign-extend/)).toBeInTheDocument();
    expect(screen.getByText(/Matches what the author meant/)).toBeInTheDocument();
  });

  it("switches scenarios with the keyboard and re-asks for a prediction", () => {
    render(<SignednessVisualizer />);
    reveal();
    expect(steps()).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Trap scenario" });
    const checked = within(group).getByRole("radio", { checked: true });
    checked.focus();
    fireEvent.keyDown(checked, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("signed vs unsigned compare");
    expect(code().getByText("pos = a > 4'd0;")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
  });

  it("a > 4'd0 is true for a = -4 because the comparison is unsigned", () => {
    render(<SignednessVisualizer scenario="signed-compare" />);
    fireEvent.click(screen.getByLabelText("pos = 0"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Unsigned comparison: 12 > 0 is true/)).toBeInTheDocument();
  });

  it("the LHS width is part of the context: a 9-bit s keeps the carry", () => {
    render(<SignednessVisualizer scenario="lost-carry" />);
    fireEvent.click(screen.getByRole("radio", { name: "9-bit s = a8 + b8" }));
    expect(screen.getByText(/logic \[8:0\] s;/)).toBeInTheDocument();
    reveal();
    expect(screen.getByText(/ACT s = 300/)).toBeInTheDocument();
    expect(screen.getAllByText(/Zero-extend/).length).toBe(2);
  });

  it("editing an operand re-runs the model, regenerates the code and resets the prediction", () => {
    render(<SignednessVisualizer />);
    reveal();
    fireEvent.change(screen.getByLabelText(/Value of a/), { target: { value: "-1" } });
    expect(screen.getByText(/logic signed \[3:0\] a = -1;/)).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    // a = 4'b1111 zero-extends to 15, so 15 + 10 = 25 (ordinary math would say 9).
    expect(screen.getByLabelText("r = 25")).toBeInTheDocument();
    expect(screen.getByLabelText("r = 9")).toBeInTheDocument();
  });

  it("changing the operand width updates the declaration", () => {
    render(<SignednessVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "8-bit a" }));
    expect(screen.getByText(/logic signed \[7:0\] a = -4;/)).toBeInTheDocument();
  });

  it("int vs logic [31:0]: explains the unsigned 32-bit comparison", () => {
    render(<SignednessVisualizer scenario="int-vs-logic" />);
    reveal();
    expect(screen.getByText(/Unsigned comparison: 4294967295 < 1 is false/)).toBeInTheDocument();
  });

  it("x in arithmetic poisons the whole sum", () => {
    render(<SignednessVisualizer scenario="x-arith" />);
    fireEvent.click(screen.getByLabelText("r = 4'b1xx0"));
    lockIn();
    expect(screen.getAllByText(/pessimistic/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ACT r = 4'bxxxx/)).toBeInTheDocument();
  });
});

describe("SignednessVisualizer: expression-lab extensions", () => {
  it("initialVariant opens the lost-carry lab on the size-cast fix: (9'(a8) + b8) >> 1 = 150", () => {
    render(<SignednessVisualizer scenario="lost-carry" initialVariant="size-cast" />);
    expect(code().getByText("s = (9'(a8) + b8) >> 1;")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("s = 22"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/That ignores the cast/)).toBeInTheDocument();
    expect(screen.getByText(/ACT s = 150/)).toBeInTheDocument();
    expect(within(steps() as HTMLElement).getByText(/Cast context: 9 bits/)).toBeInTheDocument();
  });

  it("casts: 8'(12'hABC) keeps the low byte (188 = 8'hBC); signed'(4'b1100) reads as -4", () => {
    render(<SignednessVisualizer scenario="casts" />);
    expect(code().getByText("v = 8'(12'hABC);")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("v = 171"));
    lockIn();
    expect(screen.getByText(/keeps the top 8 bits/)).toBeInTheDocument();
    expect(screen.getByText(/ACT v = 188/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "logic signed [7:0] v = signed'(4'b1100)" }));
    expect(screen.getByText(/logic signed \[7:0\] v;/)).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    reveal();
    expect(screen.getByText(/ACT v = -4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "int v = int'(w)" }));
    reveal();
    expect(screen.getByText(/ACT v = 240/)).toBeInTheDocument();
  });

  it("part-select: w = sb[7:0] zero-extends -8 to 248, and the signed guess is diagnosed", () => {
    render(<SignednessVisualizer scenario="part-select" />);
    fireEvent.click(screen.getByRole("radio", { name: "w = sb[7:0]" }));
    expect(code().getByText("w = sb[7:0];")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("w = -8"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/treats the part-select as signed/)).toBeInTheDocument();
    expect(screen.getByText(/ACT w = 248/)).toBeInTheDocument();
    expect(screen.getByText(/Differs from what the author meant/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "w = $signed(sb[7:0])" }));
    reveal();
    expect(screen.getByText(/ACT w = -8/)).toBeInTheDocument();
  });

  it("literal signedness: -'d12 / 3 is 1431655761 because 'd12 is unsigned (§11.3.3)", () => {
    render(<SignednessVisualizer scenario="literal-sign" />);
    fireEvent.click(screen.getByRole("radio", { name: "q = -'d12 / 3" }));
    fireEvent.click(screen.getByLabelText("q = -4"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/ACT q = 1431655761/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "q = -4'sd12 / 3" }));
    reveal();
    expect(screen.getByText(/ACT q = 1/)).toBeInTheDocument();
  });

  it("-4'sd12 / 3 differs from what the author meant: EXP q = -4, ACT q = 1", () => {
    render(<SignednessVisualizer scenario="literal-sign" />);
    fireEvent.click(screen.getByRole("radio", { name: "q = -4'sd12 / 3" }));
    reveal();
    expect(screen.getByText(/EXP q = -4/)).toBeInTheDocument();
    expect(screen.getByText(/ACT q = 1/)).toBeInTheDocument();
    expect(screen.getByText(/Differs from what the author meant/)).toBeInTheDocument();
    expect(screen.queryByText(/Matches what the author meant/)).not.toBeInTheDocument();
  });

  it("each scenario's rule stays out of the page until the reveal", () => {
    const rules: [string, RegExp][] = [
      ["part-select", /zero-extended into a wider target/],
      ["literal-sign", /a based literal is unsigned unless it carries an s/],
      ["casts", /A size cast pads or truncates and keeps the signedness/],
    ];
    for (const [scenario, rule] of rules) {
      const { unmount } = render(<SignednessVisualizer scenario={scenario} />);
      expect(screen.queryByText(rule)).not.toBeInTheDocument();
      reveal();
      expect(screen.getByText(rule)).toBeInTheDocument();
      unmount();
    }
  });

  it("w = sb[7:0]: the answer's own explanation states the zero extension and why", () => {
    render(<SignednessVisualizer scenario="part-select" />);
    fireEvent.click(screen.getByRole("radio", { name: "w = sb[7:0]" }));
    fireEvent.click(screen.getByLabelText("w = 248"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/a part-select is unsigned even when it covers the entire vector \(§11\.8\.1\), so it is zero-extended from 8 to 16 bits/);
    // The extend step that decides the result carries the trap flag.
    expect(within(within(steps() as HTMLElement).getByText(/Zero-extend/).closest("li") as HTMLElement).getByText(/trap/)).toBeInTheDocument();
    expect(screen.getByText(/The RHS is 8 bits, unsigned; §11\.8\.3 extends it to the 16-bit w, with zeros because it is unsigned\./)).toBeInTheDocument();
  });

  it(">>> inside an unsigned context fills with 0, and the fill bit is marked on the strip (the lesson's s = -8)", () => {
    render(<SignednessVisualizer scenario="ashr-unsigned-context" />);
    expect(code().getByText("r = (s >>> 1) + u;")).toBeInTheDocument();
    expect(screen.getByText(/logic signed \[7:0\] s = -8;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("r = -3"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/ACT r = 125/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /s >>> 1 result: 8-bit value 8'b0111_1100; bit 7 filled by the shift/ })).toBeInTheDocument();
    expect(screen.getByText(/bit 7 = 0, a 0 because the expression is unsigned/)).toBeInTheDocument();
    expect(screen.getByText(/bit filled in by the shift/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "r = (s >>> 1) + $signed(u)" }));
    reveal();
    expect(screen.getByText(/ACT r = -3/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /s >>> 1 result: 8-bit value 8'b1111_1100; bit 7 filled by the shift/ })).toBeInTheDocument();
    expect(screen.getByText(/bit 7 = 1, a copy of the sign bit because the expression is signed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "r = s[7:0] >>> 1" }));
    reveal();
    // The lesson's Push Further answer: 8'h7C (124), not 8'hFC.
    expect(screen.getByText(/ACT r = 124/)).toBeInTheDocument();
    expect(screen.getByText(/^8'b0111_1100$/)).toBeInTheDocument();
  });

  it("an operand editor appears only for code variants that read the operand", () => {
    render(<SignednessVisualizer scenario="casts" />);
    // 8'(12'hABC), signed'(4'b1100) and $signed(4'b1100) do not read w.
    expect(screen.queryByLabelText(/Value of w/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Operands" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "logic signed [7:0] v = $signed(4'b1100)" }));
    expect(screen.queryByLabelText(/Value of w/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "int v = int'(w)" }));
    fireEvent.change(screen.getByLabelText(/Value of w/), { target: { value: "15" } });
    expect(screen.getByText(/logic \[7:0\] w = 8'd15;/)).toBeInTheDocument();
    reveal();
    expect(screen.getByText(/ACT v = 15/)).toBeInTheDocument();
    // The edit survives a switch to a variant that does not show the field, and comes back with it.
    fireEvent.click(screen.getByRole("radio", { name: "logic [7:0] v = 8'(12'hABC)" }));
    expect(screen.queryByLabelText(/Value of w/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "int v = int'(signed'(w))" }));
    expect(screen.getByLabelText(/Value of w/)).toHaveValue(15);
  });

  it("s[7:0] >>> 1 reads only s, so the u editor is withdrawn for that variant", () => {
    render(<SignednessVisualizer scenario="ashr-unsigned-context" />);
    expect(screen.getByLabelText(/Value of s/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value of u/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "r = s[7:0] >>> 1" }));
    expect(screen.getByLabelText(/Value of s/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Value of u/)).not.toBeInTheDocument();
  });

  it("the shared BitStrip announces x bits as unknown (X)", () => {
    render(<SignednessVisualizer scenario="x-arith" />);
    reveal();
    expect(screen.getAllByRole("img", { name: /p: 4-bit value 4'b10x1; bit 1 unknown \(X\)/ }).length).toBeGreaterThan(0);
  });

  it("the new scenarios are reachable from the scenario list and each asks for a prediction first", () => {
    render(<SignednessVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Trap scenario" });
    for (const title of ["size, sign and type casts", "whole-vector part-select", "literal signedness", ">>> inside an unsigned context"]) {
      fireEvent.click(within(group).getByRole("radio", { name: title }));
      expect(steps()).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    }
  });
});

describe("SignednessVisualizer: reveal focus and announcements", () => {
  const status = () => screen.getByRole("status", { name: "Prediction verdict" });

  it("the live region is mounted and empty before the reveal, then holds the verdict", () => {
    render(<SignednessVisualizer />);
    expect(status()).toBeEmptyDOMElement();
    fireEvent.click(screen.getByLabelText("r = 6"));
    lockIn();
    expect(status()).toHaveTextContent("Your prediction is wrong. The answer is r = 22.");
  });

  it("locking in moves focus from the unmounted button to the feedback", () => {
    render(<SignednessVisualizer />);
    fireEvent.click(screen.getByLabelText("r = 6"));
    const button = screen.getByRole("button", { name: /lock in prediction/i });
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toHaveTextContent(/Not quite/);
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("skipping moves focus too, and switching the variant clears the verdict", () => {
    render(<SignednessVisualizer />);
    reveal();
    expect(document.activeElement).toHaveTextContent(/Why the answer holds/);
    expect(status()).toHaveTextContent("Answer revealed without a prediction. The answer is r = 22.");
    fireEvent.click(screen.getByRole("radio", { name: "a + $signed(u)" }));
    expect(status()).toBeEmptyDOMElement();
  });
});
