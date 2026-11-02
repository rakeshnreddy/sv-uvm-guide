import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OperatorExplorer from "@/components/visuals/OperatorExplorer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const reveal = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
const code = () => within(screen.getByRole("list", { name: "The code" }));

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
    render(<OperatorExplorer family="inside" />);
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

describe("OperatorExplorer: conditional family (§11.4.11, Table 11-20, §12.4)", () => {
  it("sel ? a : b with sel = x: hides the merge until a prediction, then shows the per-bit table and the if/else contrast", () => {
    render(<OperatorExplorer family="conditional" />);
    expect(code().getByText("y = sel ? a : b;")).toBeInTheDocument();
    expect(screen.getByText(/logic\s+sel = 1'bx;/)).toBeInTheDocument();
    expect(screen.getByText(/if \(sel\) y = a; else y = b;/)).toBeInTheDocument();
    expect(screen.queryByText(/agree on 0 or 1 \(Table 11-20\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'b1xx0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Bit by bit: a bit survives only where both branches agree on 0 or 1/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "if/else stores: 4'b1010" })).toBeInTheDocument();
    expect(screen.getByText(/treats an x\/z condition as false/)).toBeInTheDocument();
  });

  it("diagnoses the if/else answer as a misconception about ?:", () => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByLabelText("4'b1010"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/That is what if\/else stores/)).toBeInTheDocument();
  });

  it("the tri-state preset en ? data : 'z drives x in every bit, and 4'bzzzz is diagnosed with Table 11-20", () => {
    render(<OperatorExplorer initialPreset="cond-tristate" />);
    expect(code().getByText("y = en ? data : 'z;")).toBeInTheDocument();
    expect(screen.getByText(/logic \[3:0\] data = 4'b1010;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'bzzzz"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Table 11-20 has no z result/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "en ? data : 'z result: 4'bxxxx" })).toBeInTheDocument();
  });

  it("the equal-branches preset shows no x even though sel is x", () => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = x: equal branches" }));
    reveal();
    expect(screen.getByRole("img", { name: "sel ? a : b result: 4'b1010" })).toBeInTheDocument();
    expect(screen.getByText(/so either branch is the result and no x appears/)).toBeInTheDocument();
  });

  it("editing the 1-bit condition to a known value picks one branch", () => {
    render(<OperatorExplorer family="conditional" />);
    // sel cycles x → z → 0; two presses give a known 0.
    fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is x; press to change to z/ }));
    fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is z; press to change to 0/ }));
    expect(screen.getByText(/logic\s+sel = 1'b0;/)).toBeInTheDocument();
    reveal();
    expect(screen.getByRole("img", { name: "sel ? a : b result: 4'b1010" })).toBeInTheDocument();
    expect(screen.getByText(/Only the second branch is evaluated and returned/)).toBeInTheDocument();
  });

  it("a preset's note is hidden until the prediction is locked in, and never leaks through a title attribute", () => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = x: 1100 vs 1010" }));
    for (const button of within(screen.getByRole("group", { name: "Presets" })).getAllByRole("button")) expect(button).not.toHaveAttribute("title");
    expect(screen.queryByText(/if\/else would give 1010/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Notice:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'b1xx0"));
    lockIn();
    expect(screen.getByText(/Notice:/)).toBeInTheDocument();
    expect(screen.getByText(/Only the bits that differ become x: 1xx0\. if\/else would give 1010\./)).toBeInTheDocument();
    // Editing an operand leaves the preset, so its note no longer applies.
    fireEvent.click(screen.getByRole("button", { name: /^a bit 0 is 0; press to change to 1/ }));
    expect(screen.queryByText(/if\/else would give 1010/)).not.toBeInTheDocument();
  });
});

describe("OperatorExplorer: bit vector functions (§20.9)", () => {
  it("$countones(state) on 0100 predicts a decimal count and reveals every function with its $countbits arithmetic", () => {
    render(<OperatorExplorer family="bitcount" />);
    expect(screen.getByText('$display("%0d", $countones(state));')).toBeInTheDocument();
    expect(screen.getByText(/logic \[3:0\] state = 4'b0100;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("1"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Every bit vector function on/)).toBeInTheDocument();
    expect(screen.getByText("$countbits(state, '1) = 1, and 1 == 1 is true")).toBeInTheDocument();
    expect(screen.getByText("$countbits(state, 'x, 'z) = 0, and 0 != 0 is false")).toBeInTheDocument();
    expect(screen.getByLabelText("$countones(state) = 1")).toBeInTheDocument();
  });

  it("the 01x0 preset: $onehot passes, which the reveal explains, and 1'bx is impossible for a bit result", () => {
    render(<OperatorExplorer family="bitcount" />);
    fireEvent.click(screen.getByRole("button", { name: "01x0 (one 1 and one x)" }));
    expect(screen.getByText('$display("%b", $onehot(state));')).toBeInTheDocument();
    expect(screen.getByText(/logic \[3:0\] state = 4'b01x0;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("1'bx"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/can never be x/)).toBeInTheDocument();
    expect(screen.getByLabelText("$onehot(state) = 1")).toBeInTheDocument();
    expect(screen.getByText("$countbits(state, 'x, 'z) = 1, and 1 != 0 is true")).toBeInTheDocument();
  });

  it("a trap operator is announced as (trap) without naming its outcome before the prediction", () => {
    render(<OperatorExplorer family="bitcount" />);
    expect(screen.getByRole("radio", { name: "$onehot(state) (trap)" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /passes with an x bit/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/passes with an x bit/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "01x0 (one 1 and one x)" }));
    expect(screen.queryByText(/\$onehot passes: the x is not a 1/)).not.toBeInTheDocument();
    reveal();
    expect(screen.getByText(/\$onehot passes: the x is not a 1/)).toBeInTheDocument();
  });

  it("the guarded form $onehot(state) && !$isunknown(state) rejects 01x0", () => {
    render(<OperatorExplorer initialPreset="bitcount-x" />);
    fireEvent.click(screen.getByRole("radio", { name: "$onehot(state) && !$isunknown(state)" }));
    fireEvent.click(screen.getByLabelText("1'b0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/the \$isunknown term is what rejects the x/)).toBeInTheDocument();
  });
});

describe("OperatorExplorer: concatenation additions (§11.4.12, §11.4.12.1)", () => {
  it("{hi, lo} = 16'hBEEF as a target: predicts both members and shows the split by member width", () => {
    render(<OperatorExplorer initialPreset="concat-target" />);
    expect(code().getByText("{hi, lo} = 16'hBEEF;")).toBeInTheDocument();
    expect(screen.getByText(/logic \[7:0\] hi = 8'h12;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("hi = 8'hEF, lo = 8'hBE"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/The first member of the concatenation takes the most significant bits, exactly as it does when the concatenation is a source/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /16'hBEEF cut by member width: 16-bit value 16'hBEEF; hi is bits 15 to 8; lo is bits 7 to 0/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "hi after: 8'b1011_1110" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "lo after: 8'b1110_1111" })).toBeInTheDocument();
  });

  it("hand sign-extension {{4{n[3]}}, n} is 8'hFA; the replication count is editable and 0 copies leave n alone", () => {
    render(<OperatorExplorer initialPreset="concat-sign-extend" />);
    expect(screen.getByText('$display("%b", {{4{n[3]}}, n});')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("8'hFA"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /result with the replicated bits: 8-bit value 8'b1111_1010; bits 7 to 4 added by extension/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /n with its sign bit: 4-bit value 4'b1010; sign bit is bit 3/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "0" } });
    expect(screen.getByText('$display("%b", {{0{n[3]}}, n});')).toBeInTheDocument();
    reveal();
    expect(screen.getByRole("img", { name: "{{0{n[3]}}, n} result: 4'b1010" })).toBeInTheDocument();
    expect(screen.getByText(/a zero replication is legal here/)).toBeInTheDocument();
  });

  it("{R{a}} with a zero count is a compile error (zero replication alone)", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{R{a}}" }));
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "0" } });
    expect(screen.getByText('$display("%b", {0{a}});')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Compile error"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Compile error: `?\{0\{a\}\}`? replicates zero times/)).toBeInTheDocument();
  });

  it("keeps the {a, 1} unsized-constant error", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{a, 1} (trap)" }));
    reveal();
    expect(screen.getByText(/Compile error: .*unsized number/)).toBeInTheDocument();
  });

  it("the concat picker offers five operators, {R{a}} being the only replication", () => {
    render(<OperatorExplorer family="concat" />);
    const names = within(screen.getByRole("radiogroup", { name: "Operator" }))
      .getAllByRole("radio")
      .map((r) => r.getAttribute("aria-label") ?? r.textContent);
    expect(names).toEqual(["{a, b}", "{R{a}}", "{hi, lo} = 16'hBEEF", "{{R{n[3]}}, n}", "{a, 1} (trap)"]);
  });
});

describe("OperatorExplorer: width prop", () => {
  it("width={8} declares 8-bit operands", () => {
    render(<OperatorExplorer width={8} />);
    expect(screen.getByText(/logic \[7:0\] a = 8'b0000_10xz;/)).toBeInTheDocument();
    expect(screen.getByText(/logic \[7:0\] b = 8'h06;/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Operand a, 8 bits" })).toBeInTheDocument();
  });

  it("width={8} also fits an operator's own defaults: the conditional branches are 8 bits while sel stays 1 bit", () => {
    render(<OperatorExplorer family="conditional" width={8} />);
    expect(screen.getByText(/logic \[7:0\] a = 8'h0C;/)).toBeInTheDocument();
    expect(screen.getByText(/logic \[7:0\] b = 8'h0A;/)).toBeInTheDocument();
    expect(screen.getByText(/logic\s+sel = 1'bx;/)).toBeInTheDocument();
    expect(screen.getByText(/logic \[7:0\] y;/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Operand a, 8 bits" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Operand sel, 1 bit" })).toBeInTheDocument();
    reveal();
    expect(screen.getByRole("img", { name: "sel ? a : b result: 8'b0000_1xx0" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "if/else stores: 8'b0000_1010" })).toBeInTheDocument();
  });

  it("width={4} applies when an operator with defaults is picked: {hi, lo} = 16'hBEEF gets 4-bit members and drops the 8 MSBs", () => {
    render(<OperatorExplorer family="concat" width={4} />);
    fireEvent.click(screen.getByRole("radio", { name: "{hi, lo} = 16'hBEEF" }));
    expect(screen.getByText(/logic \[3:0\] hi = 4'b0010;/)).toBeInTheDocument();
    expect(screen.getByText(/logic \[3:0\] lo = 4'b0100;/)).toBeInTheDocument();
    reveal();
    expect(screen.getByText(/The members add up to 8 bits but the value has 16: the 8 MSBs are discarded/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "hi after: 4'b1110" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "lo after: 4'b1111" })).toBeInTheDocument();
  });

  it("{{R{n[3]}}, n} keeps its 4-bit n under width={8}, because the template names bit 3", () => {
    render(<OperatorExplorer initialPreset="concat-sign-extend" width={8} />);
    expect(screen.getByText(/logic \[3:0\] n = 4'b1010;/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "{a, b}" }));
    expect(screen.getByRole("group", { name: "Operand b, 8 bits" })).toBeInTheDocument();
  });
});

describe("OperatorExplorer: misconception notes belong to their own family", () => {
  const note = () => screen.queryByRole("complementary", { name: "Common misconception" });

  it("the ~& note shows on bitwise and reduction, and not while its own trap is the question", () => {
    const { unmount } = render(<OperatorExplorer family="reduction" />);
    expect(note()).toHaveTextContent(/no binary ~&/);
    unmount();
    render(<OperatorExplorer />);
    expect(note()).toHaveTextContent(/no binary ~&/);
    fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
    expect(note()).not.toBeInTheDocument();
    expect(screen.queryByText(/no binary ~&/)).not.toBeInTheDocument();
    reveal();
    expect(screen.getByText(/exists only as the unary reduction NAND/)).toBeInTheDocument();
  });

  it("nothing shows on the families that are not about it, and no button jumps away", () => {
    for (const family of ["conditional", "bitcount", "logical", "equality", "shift", "concat", "stream"] as const) {
      const { unmount } = render(<OperatorExplorer family={family} />);
      expect(note(), family).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Try / }), family).not.toBeInTheDocument();
      unmount();
    }
  });

  it("the inside note waits for the reveal, so it cannot answer the prediction", () => {
    render(<OperatorExplorer family="inside" />);
    expect(note()).not.toBeInTheDocument();
    expect(screen.queryByText(/not case equality/)).not.toBeInTheDocument();
    reveal();
    expect(note()).toHaveTextContent(/not case equality/);
  });
});

describe("OperatorExplorer: reveal focus and announcements", () => {
  const status = () => screen.getByRole("status", { name: "Prediction verdict" });

  it("the live region is mounted and empty before the reveal, then holds the verdict", () => {
    render(<OperatorExplorer />);
    expect(status()).toBeEmptyDOMElement();
    fireEvent.click(screen.getByLabelText("4'b00x0"));
    lockIn();
    expect(status()).toHaveTextContent("Your prediction is right. The answer is 4'b00x0.");
  });

  it("locking in moves focus from the unmounted button to the feedback", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByLabelText("4'bxxxx"));
    const button = screen.getByRole("button", { name: /lock in prediction/i });
    button.focus();
    fireEvent.click(button);
    expect(button).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveTextContent(/Not quite/);
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
    expect(status()).toHaveTextContent("Your prediction is wrong. The answer is 4'b00x0.");
  });

  it("skipping moves focus too, and an edit clears the verdict and leaves focus on the edited bit", () => {
    render(<OperatorExplorer />);
    reveal();
    expect(document.activeElement).toHaveTextContent(/Why the answer holds/);
    expect(status()).toHaveTextContent("Answer revealed without a prediction. The answer is 4'b00x0.");
    const bit = screen.getByRole("button", { name: /^b bit 3 is 0; press to change to 1/ });
    bit.focus();
    fireEvent.click(bit);
    expect(status()).toBeEmptyDOMElement();
    expect(document.activeElement).toBe(bit);
  });

  it("the reveal itself is no longer one large live region", () => {
    render(<OperatorExplorer />);
    reveal();
    expect(screen.getByText(/Bit by bit, using the truth table/).closest("[aria-live]")).toBeNull();
  });
});

describe("OperatorExplorer: small accessibility and accuracy points", () => {
  it("a bit-returning function keeps %b; only the int-returning $countones uses %0d", () => {
    render(<OperatorExplorer family="bitcount" />);
    expect(screen.getByText('$display("%0d", $countones(state));')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "$onehot(state) (trap)" }));
    expect(screen.getByText('$display("%b", $onehot(state));')).toBeInTheDocument();
  });

  it("the current function's row has a non-colour marker next to aria-current", () => {
    render(<OperatorExplorer initialPreset="bitcount-x" />);
    reveal();
    const table = screen.getByRole("region", { name: "Bit vector functions table, scrollable" });
    expect(table).toHaveAttribute("tabindex", "0");
    const current = within(table).getAllByRole("row").filter((r) => r.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/▶ \$onehot\(state\)/);
    expect(within(table).getByRole("row", { name: /\$countones\(state\)/ })).not.toHaveTextContent("▶");
  });

  it("the guarded form marks both of its functions", () => {
    render(<OperatorExplorer initialPreset="bitcount-x-guarded" />);
    expect(screen.getByText(/logic \[3:0\] state = 4'b01x0;/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "$onehot(state) && !$isunknown(state)" })).toHaveAttribute("aria-checked", "true");
    reveal();
    const table = screen.getByRole("region", { name: "Bit vector functions table, scrollable" });
    const marked = within(table).getAllByRole("row").filter((r) => r.getAttribute("aria-current") === "true");
    expect(marked.map((r) => r.textContent?.slice(0, 11))).toEqual(["▶ $onehot(s", "▶ $isunknow"]);
  });

  it("neither scrollable table sets a minimum width wider than a phone", () => {
    render(<OperatorExplorer initialPreset="bitcount-x" />);
    reveal();
    expect(within(screen.getByRole("region", { name: "Bit vector functions table, scrollable" })).getByRole("table").className).not.toMatch(/min-w/);
  });

  it("the if/else contrast is a labelled group and the merge table can take keyboard focus", () => {
    render(<OperatorExplorer family="conditional" />);
    reveal();
    expect(screen.getByRole("group", { name: "if/else contrast" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Merge table, scrollable" })).toHaveAttribute("tabindex", "0");
  });

  it("preset buttons expose which preset is loaded", () => {
    render(<OperatorExplorer family="conditional" />);
    const equal = screen.getByRole("button", { name: "sel = x: equal branches" });
    expect(screen.getByRole("button", { name: "sel = x: 1100 vs 1010" })).toHaveAttribute("aria-pressed", "true");
    expect(equal).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(equal);
    expect(equal).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^a bit 0 is 0; press to change to 1/ }));
    expect(equal).toHaveAttribute("aria-pressed", "false");
  });

  it("the assumption about z names the tables it holds for", () => {
    render(<OperatorExplorer />);
    expect(screen.queryByText(/on every operator input/)).not.toBeInTheDocument();
    expect(screen.getByText(/z behaves like x on the bitwise, logical, arithmetic and \?: tables/)).toBeInTheDocument();
  });
});
