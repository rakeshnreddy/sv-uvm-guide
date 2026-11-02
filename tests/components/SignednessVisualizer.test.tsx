import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      ["ashr-unsigned-context", /An unsigned context-determined operand, including a bare part-select, makes the expression unsigned, so >>> fills with 0/],
      ["ashr-unsigned-context", /Self-determined operands do not count: the shift count and a \?: condition never affect the sign/],
      ["lost-carry", /The LHS width counts/],
      ["lost-carry", /a shift count is self-determined and does not count/],
      ["signed-compare", /A comparison is signed only when both operands are signed/],
      ["int-vs-logic", /int is signed and logic \[31:0\] is not/],
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

  it(">>> in a mixed expression fills with 0, and the fill bit is marked on the strip (the lesson's s = -8)", () => {
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
    for (const title of ["size, sign and type casts", "whole-vector part-select", "literal signedness", ">>> in a mixed expression"]) {
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

describe("SignednessVisualizer: what the reveal says about the fill and the carry", () => {
  it("the correct answer to (s >>> 1) + u names the fill, not only the operand's reading", () => {
    render(<SignednessVisualizer scenario="ashr-unsigned-context" />);
    fireEvent.click(screen.getByLabelText("r = 125"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/>>> on an unsigned expression fills with 0/);
  });

  it("the size-cast reveal shows the contrast (a8 + b8) >> 1 = 22 beside 150 and says the context keeps the carry", () => {
    render(<SignednessVisualizer scenario="lost-carry" initialVariant="size-cast" />);
    expect(screen.queryByText(/Without the fix/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ACT s = 22/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("s = 150"));
    lockIn();
    expect(screen.getByText(/ACT s = 150/)).toBeInTheDocument();
    expect(screen.getByText(/Without the fix/).parentElement).toHaveTextContent(/s = \(a8 \+ b8\) >> 1\s*ACT s = 22/);
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/9-bit context keeps the carry/);
  });

  it("the contrast follows the edited operands and the target of the variant it names", () => {
    render(<SignednessVisualizer scenario="lost-carry" />);
    fireEvent.click(screen.getByRole("radio", { name: "9-bit s = a8 + b8" }));
    fireEvent.change(screen.getByLabelText(/Value of a8/), { target: { value: "250" } });
    reveal();
    expect(screen.getByText(/ACT s = 350/)).toBeInTheDocument();
    // 350 mod 256: the 8-bit target of the trap variant.
    expect(screen.getByText(/Without the fix/).parentElement).toHaveTextContent(/ACT s = 94/);
  });

  it("a trap variant shows no contrast", () => {
    render(<SignednessVisualizer scenario="lost-carry" />);
    reveal();
    expect(screen.queryByText(/Without the fix/)).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: step badges", () => {
  it("the deciding step is a trap in a trap variant and a key step in a fix", () => {
    const { unmount } = render(<SignednessVisualizer scenario="lost-carry" />);
    reveal();
    expect(within(steps() as HTMLElement).getByText(/trap/)).toBeInTheDocument();
    expect(within(steps() as HTMLElement).queryByText("key step")).not.toBeInTheDocument();
    unmount();
    render(<SignednessVisualizer scenario="lost-carry" initialVariant="size-cast" />);
    reveal();
    expect(within(steps() as HTMLElement).getAllByText("key step").length).toBeGreaterThan(0);
    expect(within(steps() as HTMLElement).queryByText(/⚠ trap/)).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: every badge decides something", () => {
  const trace = () => within(steps() as HTMLElement);
  const stepOf = (text: RegExp) => trace().getByText(text).closest("li") as HTMLElement;

  it.each([
    ["mixed-add", "a + $signed(u)", /^Context: 8 bits, signed/],
    ["signed-compare", "a > 0", /^Comparison context: 32 bits, signed/],
    ["signed-compare", "a > 4'sd0", /^Comparison context: 4 bits, signed/],
    ["shift-fill", "-4'sd1 >>> 1", /^Evaluate/],
    ["int-vs-logic", "i < $signed(w)", /^Comparison context: 32 bits, signed/],
    ["int-vs-logic", "i < int'(w)", /^Comparison context: 32 bits, signed/],
    ["part-select", "w = $signed(sb[7:0])", /^Evaluate/],
    ["literal-sign", "q = -'sd12 / 3", /^Context: 32 bits, signed/],
    ["ashr-unsigned-context", "r = (s >>> 1) + $signed(u)", /^Context: 8 bits, signed/],
  ])("%s, %s: the curing step is marked at the default values", (scenario, label, title) => {
    render(<SignednessVisualizer scenario={scenario} />);
    fireEvent.click(screen.getByRole("radio", { name: label }));
    reveal();
    const key = trace().getByText("key step").closest("li") as HTMLElement;
    expect(within(key).getByText(title)).toBeInTheDocument();
    expect(trace().queryByText(/⚠ trap/)).not.toBeInTheDocument();
  });

  it("a trap whose values happen to be harmless shows no trap badge beside a matching result", () => {
    render(<SignednessVisualizer />);
    fireEvent.change(screen.getByLabelText(/Value of a/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/Value of u/), { target: { value: "0" } });
    reveal();
    expect(screen.getByText(/Matches what the author meant/)).toBeInTheDocument();
    expect(trace().queryByText(/⚠ trap/)).not.toBeInTheDocument();
  });

  it("-4'sd12 / 3 marks the literal that reads as -4", () => {
    render(<SignednessVisualizer scenario="literal-sign" />);
    fireEvent.click(screen.getByRole("radio", { name: "q = -4'sd12 / 3" }));
    reveal();
    expect(within(stepOf(/^Sign-extend/)).getByText(/⚠ trap/)).toBeInTheDocument();
    expect(stepOf(/^Sign-extend/)).toHaveTextContent(/holds only its 4 bits, 4'b1100, which reads as -4, not 12/);
  });

  it("int r = -4'sd1 >> 1 badges the logical shift as a trap, not as a key step", () => {
    render(<SignednessVisualizer scenario="shift-fill" />);
    fireEvent.click(screen.getByRole("radio", { name: "int r = -4'sd1 >> 1" }));
    reveal();
    const shift = trace().getAllByRole("listitem").find((li) => /Logical right shift by 1/.test(li.textContent ?? "")) as HTMLElement;
    expect(within(shift).getByText(/⚠ trap/)).toBeInTheDocument();
    expect(trace().queryByText("key step")).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: the answer's own explanation reaches the value", () => {
  it("-4'sd12 / 3 goes from the literal to 4 / 3", () => {
    render(<SignednessVisualizer scenario="literal-sign" initialVariant="sized-signed" />);
    fireEvent.click(screen.getByLabelText("q = 1"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/reads as -4, not 12 .*the division is 4 \/ 3, which is 1/);
  });

  it("the two int casts say which extension they get", () => {
    render(<SignednessVisualizer scenario="casts" initialVariant="type-cast" />);
    fireEvent.click(screen.getByLabelText("v = 240"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/`?w`? is unsigned, so it extends with zeros\..*int being signed does not change that: the extension follows the expression inside the cast/);
    fireEvent.click(screen.getByRole("radio", { name: "int v = int'(signed'(w))" }));
    fireEvent.click(screen.getByLabelText("v = -16"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/`?signed'\(w\)`? is signed, so it extends with copies of the sign bit\..*The sign cast is what changes the extension: int'\(w\) alone always adds zeros/);
  });

  it("s[7:0] >>> 1 says why the expression is unsigned", () => {
    render(<SignednessVisualizer scenario="ashr-unsigned-context" initialVariant="select" />);
    fireEvent.click(screen.getByLabelText("r = 124"));
    lockIn();
    expect(screen.getByText(/Correct\./).parentElement).toHaveTextContent(/s\[7:0\] is a part-select, and a part-select is unsigned even when it covers the entire vector/);
  });
});

describe("SignednessVisualizer: the reveal does not answer the next question", () => {
  it("literal-sign's opening reveal shows no result of the based literal below it", () => {
    render(<SignednessVisualizer scenario="literal-sign" />);
    reveal();
    expect(screen.getByText(/ACT q = -4/)).toBeInTheDocument();
    expect(screen.queryByText(/Without the fix/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1431655761/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next variant: q = -'d12 / 3" })).toBeInTheDocument();
  });

  it("the signed fix further along still shows the trap it cures", () => {
    render(<SignednessVisualizer scenario="literal-sign" initialVariant="based-signed" />);
    reveal();
    expect(screen.getByText(/Without the fix/).parentElement).toHaveTextContent(/ACT q = 1431655761/);
  });

  it("the lost-carry title does not give away the outcome of its opening variant", () => {
    render(<SignednessVisualizer />);
    expect(screen.getByRole("radio", { name: "carry out of 8 bits" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "the lost carry" })).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: a narrowing cast draws what it discards", () => {
  it("8'(12'hABC) marks bits 11 to 8 of the value inside the cast, and the legend says so", () => {
    render(<SignednessVisualizer scenario="casts" />);
    reveal();
    expect(within(steps() as HTMLElement).getByRole("img", { name: /value inside the cast: 12-bit value 12'hABC; bits 11 to 8 discarded/ })).toBeInTheDocument();
    expect(screen.getByText(/discarded by the store or a narrowing cast/)).toBeInTheDocument();
  });

  it("a widening cast draws no discarded bits, and the legend stays with the store", () => {
    render(<SignednessVisualizer scenario="lost-carry" initialVariant="size-cast" />);
    reveal();
    expect(within(steps() as HTMLElement).queryByRole("img", { name: /value inside the cast/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/or a narrowing cast/)).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: the question stays near the top in a lesson", () => {
  it("a lesson's scenario prop folds the other traps into a closed disclosure", () => {
    render(<SignednessVisualizer scenario="casts" />);
    const details = screen.getByText("More traps").closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    // visual-language.md: touch targets of at least 40 px; py-3 gives 16 + 24 px with text-xs.
    expect(screen.getByText("More traps")).toHaveClass("py-3");
    expect(within(details).getByRole("radiogroup", { name: "Trap scenario", hidden: true })).toBeInTheDocument();
  });

  it("without a scenario prop the whole list stays in view", () => {
    render(<SignednessVisualizer />);
    expect(screen.queryByText("More traps")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Trap scenario" }).closest("details")).toBeNull();
  });

  it("picking another trap from the disclosure switches the lab and re-asks", () => {
    render(<SignednessVisualizer scenario="casts" />);
    reveal();
    const details = screen.getByText("More traps").closest("details") as HTMLElement;
    fireEvent.click(within(details).getByRole("radio", { name: "carry out of 8 bits", hidden: true }));
    expect(code().getByText("s = a8 + b8;")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
  });
});

describe("SignednessVisualizer: Next variant", () => {
  it("advances the code, re-asks, moves focus to the new question and wraps around", async () => {
    const user = userEvent.setup();
    render(<SignednessVisualizer scenario="ashr-unsigned-context" />);
    reveal();
    const next = screen.getByRole("button", { name: "Next variant: r = (s >>> 1) + $signed(u)" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(code().getByText("r = (s >>> 1) + $signed(u);")).toBeInTheDocument();
    expect(steps()).not.toBeInTheDocument();
    expect(document.activeElement?.tagName).toBe("LEGEND");
    expect(document.activeElement).toHaveTextContent("After r = (s >>> 1) + $signed(u);, what does r hold?");
    reveal();
    await user.click(screen.getByRole("button", { name: "Next variant: r = s[7:0] >>> 1" }));
    reveal();
    await user.click(screen.getByRole("button", { name: "Next variant: r = (s >>> 1) + u" }));
    expect(code().getByText("r = (s >>> 1) + u;")).toBeInTheDocument();
  });

  it("editing a value or switching a pill moves no focus to the question", () => {
    render(<SignednessVisualizer scenario="ashr-unsigned-context" />);
    const radio = screen.getByRole("radio", { name: "r = s[7:0] >>> 1" });
    radio.focus();
    fireEvent.click(radio);
    expect(document.activeElement).toBe(radio);
  });
});

describe("SignednessVisualizer: two embeds on one page", () => {
  it("the same scenario twice has unique field ids, and each label names its own input", () => {
    render(
      <>
        <SignednessVisualizer scenario="part-select" />
        <SignednessVisualizer scenario="part-select" />
      </>,
    );
    const [first, second] = screen.getAllByLabelText(/Value of sb/);
    expect(first.id).not.toBe(second.id);
    expect(first.closest("label")).toHaveAttribute("for", first.id);
    expect(second.closest("label")).toHaveAttribute("for", second.id);
  });
});
