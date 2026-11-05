import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import OperatorExplorer from "@/components/visuals/OperatorExplorer";
import { operatorCatalog, operatorPresets, type OperatorSpec } from "@/lib/sv-expression-model";

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
    expect(screen.getByText(/SystemVerilog has no binary ~& operator/)).toBeInTheDocument();
    expect(screen.getByText("✕ Compile error")).toBeInTheDocument();
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
    // The if/else belongs to the reveal: in the code panel it would read as a second assignment that overwrites y.
    expect(screen.queryByText(/if \(sel\) y = a; else y = b;/)).not.toBeInTheDocument();
    expect(screen.queryByText(/agree on 0 or 1 \(Table 11-20\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'b1xx0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Merged bit by bit with Table 11-20")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "if/else contrast" })).getByText("if (sel) y = a; else y = b;")).toBeInTheDocument();
    expect(code().queryByText(/if \(sel\)/)).not.toBeInTheDocument();
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
    // The contrast line runs the same condition through if/else, which stores the 'z.
    const contrast = within(screen.getByRole("group", { name: "if/else contrast" }));
    expect(contrast.getByText("if (en) y = data; else y = 'z;")).toBeInTheDocument();
    expect(contrast.getByRole("img", { name: "if/else stores: 4'bzzzz" })).toBeInTheDocument();
    expect(contrast.getByText(/which hides the unknown/)).toBeInTheDocument();
  });

  it("cond-equal: 4'bxxxx is answered by the comparison, not by Table 11-20, and the table says it is not used", () => {
    render(<OperatorExplorer initialPreset="cond-equal" />);
    fireEvent.click(screen.getByLabelText("4'bxxxx"));
    lockIn();
    // The wrong choice names its slip; the rule gives the path; the detail gives this run's comparison.
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/^Not quite\. That assumes an x\/z condition makes every bit x\.$/);
    expect(screen.getByText(/Why the answer holds/).parentElement).toHaveTextContent(/compares them with == \(§11\.4\.5\)\. If that gives 1, either one is returned\./);
    expect(screen.getByText(/so either branch is the result\./).textContent).toMatch(/^sel is x\/z \(ambiguous\)\. a == b is .*, so either branch is the result\.$/);
    expect(screen.queryByText(/At least one pair agrees/)).not.toBeInTheDocument();
    expect(screen.getByText("Table 11-20 for comparison: this run does not use it")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Merge table, scrollable" })).getAllByText("(not used)")).toHaveLength(4);
  });

  it("a known condition: the same branch in both forms, and the table is not used", () => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is x; press to change to z/ }));
    fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is z; press to change to 0/ }));
    reveal();
    expect(screen.getByText(/Same answer: a known condition picks the same branch in both forms\./)).toBeInTheDocument();
    expect(screen.getByText("Table 11-20 for comparison: this run does not use it")).toBeInTheDocument();
  });

  it.each([
    ["cond-x-sel", "sel is x/z (ambiguous). a == b is 0, so the table below merges them."],
    ["cond-tristate", "en is x/z (ambiguous). data == 'z is x, so the table below merges them."],
    ["cond-equal", "sel is x/z (ambiguous). a == b is 1, so either branch is the result."],
  ])("preset %s: the merge detail states the §11.4.5 comparison and what follows from it, exactly", (id, sentence) => {
    render(<OperatorExplorer initialPreset={id} />);
    reveal();
    expect(screen.getByText(/ \(ambiguous\)\./)).toHaveTextContent(new RegExp(`^${sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  });

  it("the cond-equal Notice reads exactly its note", () => {
    render(<OperatorExplorer initialPreset="cond-equal" />);
    reveal();
    expect(screen.getByText(/Notice:/).parentElement).toHaveTextContent(/^Notice: Both branches hold the same known bits, so no x appears\.$/);
  });

  it.each([
    ["1", 3, "sel is 1. Only the first branch is evaluated and returned."],
    ["0", 2, "sel is 0. Only the second branch is evaluated and returned."],
  ])("sel = %s: the detail names the one branch evaluated, exactly", (_sel, presses, sentence) => {
    render(<OperatorExplorer family="conditional" />);
    // sel cycles x → z → 0 → 1.
    for (let i = 0; i < presses; i += 1) fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is/ }));
    reveal();
    expect(screen.getByText(/branch is evaluated and returned\./)).toHaveTextContent(new RegExp(`^${sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  });

  it("en = 1 on `en ? data : 'z`: picking 'z names the other branch, and the rule says why data comes back", () => {
    render(<OperatorExplorer initialPreset="cond-tristate" />);
    // en cycles x → z → 0 → 1.
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: /^en bit 0 is/ }));
    expect(screen.getByText(/logic\s+en = 1'b1;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'bzzzz"));
    lockIn();
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/^Not quite\. That is the other branch's value\.$/);
    expect(screen.getByText(/Why the answer holds/).parentElement).toHaveTextContent(/^Why the answer holds: A known en returns one branch: data, or all z, because 'z fills every bit of the else branch\./);
  });

  it("sel = 1 with 1100 vs 1010: 4'b1xx0 is the unknown-condition slip and 4'bxxxx is not", () => {
    render(<OperatorExplorer family="conditional" />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: /^sel bit 0 is/ }));
    expect(screen.getByText(/logic\s+sel = 1'b1;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4'b1xx0"));
    lockIn();
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/^Not quite\. That treats the condition as unknown; it is 1\.$/);
  });

  it("the equal-branches preset shows no x even though sel is x", () => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = x: equal branches" }));
    reveal();
    expect(screen.getByRole("img", { name: "sel ? a : b result: 4'b1010" })).toBeInTheDocument();
    expect(screen.getByText(/so either branch is the result\./)).toHaveTextContent(/^sel is x\/z \(ambiguous\)\. a == b is 1, so either branch is the result\.$/);
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
    expect(screen.getByText(/The two middle bits differ, so they become x: 1xx0\. if\/else would give 1010\./)).toBeInTheDocument();
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
    expect(screen.getByText(/The four §20\.9 convenience functions on/)).toHaveTextContent(/^The four §20\.9 convenience functions on state = 4'b0100$/);
    expect(screen.getByText(/must also reject x\/z/)).toHaveTextContent(/^A one-hot check that must also reject x\/z wants \$onehot\(state\) && !\$isunknown\(state\)\.$/);
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
    expect(screen.getByText(/That expects x, but a bit result is 2-state: 1'b0 or 1'b1\./)).toBeInTheDocument();
    expect(screen.getByText(/Returns a bit, never x\./)).toBeInTheDocument();
    expect(screen.getByLabelText("$onehot(state) = 1")).toBeInTheDocument();
    expect(screen.getByText("$countbits(state, 'x, 'z) = 1, and 1 != 0 is true")).toBeInTheDocument();
  });

  it("a trap operator is announced as (trap) without naming its outcome before the prediction", () => {
    render(<OperatorExplorer family="bitcount" />);
    expect(screen.getByRole("radio", { name: "$onehot(state) (trap)" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /passes with an x bit/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/passes with an x bit/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "01x0 (one 1 and one x)" }));
    expect(screen.queryByText(/Only \$isunknown sees the x/)).not.toBeInTheDocument();
    expect(screen.queryByText(/so 01x0 passes/)).not.toBeInTheDocument();
    reveal();
    expect(screen.getByText(/Only \$isunknown sees the x/)).toBeInTheDocument();
    expect(screen.getByText(/An x or z bit is not a 1, so 01x0 passes\./)).toBeInTheDocument();
  });

  it.each([
    ["bitcount-legal", "One bit set, nothing unknown."],
    ["bitcount-two-hot", "$onehot fails, $onehot0 fails too: two bits are set."],
    ["bitcount-reset", "No bit is 1, so $onehot0 passes while every bit is unknown."],
  ])("preset %s: the Notice reads exactly its note after the reveal", (id, note) => {
    render(<OperatorExplorer initialPreset={id} />);
    expect(screen.queryByText(/Notice:/)).not.toBeInTheDocument();
    reveal();
    expect(screen.getByText(/Notice:/).parentElement).toHaveTextContent(`Notice: ${note}`);
  });

  it("11x0: two 1 bits already fail $onehot whatever the x is, so 1'b1 is named a miscount, not an x slip", () => {
    render(<OperatorExplorer initialPreset="bitcount-two-hot" />);
    // 0110 → 1110 → 11x0: bit 1 cycles 1 → x, bit 3 cycles 0 → 1.
    fireEvent.click(screen.getByRole("button", { name: /^state bit 3 is 0/ }));
    fireEvent.click(screen.getByRole("button", { name: /^state bit 1 is 1/ }));
    expect(screen.getByText(/logic \[3:0\] state = 4'b11x0;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("1'b1"));
    lockIn();
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/^Not quite\. That miscounts the 1 bits\.$/);
  });

  it("the guarded form $onehot(state) && !$isunknown(state) rejects 01x0", () => {
    render(<OperatorExplorer initialPreset="bitcount-x" />);
    fireEvent.click(screen.getByRole("radio", { name: "$onehot(state) && !$isunknown(state)" }));
    fireEvent.click(screen.getByLabelText("1'b0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/\$onehot\(state\) is 1'b1 and \$isunknown\(state\) is 1'b1, so the guard is false\./)).toBeInTheDocument();
    expect(screen.getByText(/The \$isunknown term is what rejects this vector\./)).toBeInTheDocument();
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
    expect(screen.getByText(/That is what \{lo, hi\} = 16'hBEEF would store\./)).toBeInTheDocument();
    expect(screen.getByText(/the first member taking the most significant bits, as in a source concatenation/)).toBeInTheDocument();
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
    expect(screen.getByText(/A zero replication is legal here because/)).toHaveTextContent(/^A zero replication is legal here because n has a positive width \(§11\.4\.12\.1\)\.$/);
  });

  it("{R{a}} with a zero count is a compile error (zero replication alone)", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{R{a}}" }));
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "0" } });
    expect(screen.getByText('$display("%b", {0{a}});')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Compile error"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/^\{0\{a\}\} replicates zero times, so it has no bits\./)).toBeInTheDocument();
    expect(screen.getByText("✕ Compile error")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("`");
  });

  it("keeps the {a, 1} unsized-constant error", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{a, 1} (trap)" }));
    reveal();
    expect(screen.getByText(/^1 is an unsized number, and a concatenation needs the size of every operand/)).toBeInTheDocument();
    expect(screen.getByText("✕ Compile error")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("`");
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
    expect(screen.getByText(/keeps only the low 8 bits of the 16-bit value; the 8 MSBs are discarded \(§10\.7\)/)).toBeInTheDocument();
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
    expect(screen.getByText(/~& is the unary reduction NAND/)).toBeInTheDocument();
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

  it("code that does not compile reads as a sentence in the live region", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
    reveal();
    expect(status()).toHaveTextContent("Answer revealed without a prediction. The answer is a compile error.");
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

describe("OperatorExplorer: the loaded preset is visible", () => {
  it("preset buttons carry the same pressed look as a checked segmented option", () => {
    render(<OperatorExplorer family="conditional" />);
    const button = screen.getByRole("button", { name: "sel = x: 1100 vs 1010" });
    for (const c of ["aria-pressed:border-cyan-500", "aria-pressed:bg-cyan-500/15", "aria-pressed:font-semibold"]) expect(button.className).toContain(c);
  });

  it("the stream value buttons say which value is loaded", () => {
    render(<OperatorExplorer family="stream" />);
    const loaded = screen.getByRole("button", { name: "a = 16'hA55A" });
    const other = screen.getByRole("button", { name: "a = 16'h1234" });
    expect(loaded).toHaveAttribute("aria-pressed", "true");
    expect(other).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(other);
    expect(other).toHaveAttribute("aria-pressed", "true");
    expect(other.className).toContain("aria-pressed:border-cyan-500");
  });
});

describe("OperatorExplorer: focus after Try a ~& b", () => {
  it("keyboard: Enter on the jump lands on the operator it selected, not on the page body", async () => {
    const user = userEvent.setup();
    render(<OperatorExplorer />);
    // visual-language.md: touch targets of at least 40 px.
    expect(screen.getByRole("button", { name: /Try a ~& b/ })).toHaveClass("inline-flex", "min-h-10", "items-center");
    screen.getByRole("button", { name: /Try a ~& b/ }).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "a ~& b (trap)" }));
    expect(document.activeElement).toHaveAttribute("aria-checked", "true");
  });

  it("the jump that also changes the family lands on the operator too", async () => {
    const user = userEvent.setup();
    render(<OperatorExplorer family="reduction" />);
    screen.getByRole("button", { name: /Try a ~& b/ }).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "a ~& b (trap)" }));
    expect(document.activeElement).toHaveAttribute("aria-checked", "true");
    expect(within(screen.getByRole("radiogroup", { name: "Operator family", hidden: true })).getByRole("radio", { checked: true, hidden: true })).toHaveTextContent("Bitwise");
  });

  it("picking an operator or a family by itself does not steal focus", () => {
    render(<OperatorExplorer />);
    const family = screen.getByRole("radio", { name: "Reduction" });
    family.focus();
    fireEvent.click(family);
    expect(document.activeElement).toBe(family);
  });
});

describe("OperatorExplorer: the rule is stated once", () => {
  const countOf = (text: string) => (document.body.textContent ?? "").split(text).length - 1;

  it.each([
    ["right answer", "4'b1xx0"],
    ["wrong answer", "4'b1010"],
  ])("cond, %s: the feedback holds the rule and no Rule line repeats it", (_name, label) => {
    render(<OperatorExplorer family="conditional" />);
    fireEvent.click(screen.getByLabelText(label));
    lockIn();
    expect(countOf("a bit survives only where the branches agree on 0 or 1")).toBe(1);
    expect(screen.queryByText("Rule:")).not.toBeInTheDocument();
  });

  it("the concatenation target and a skipped reveal say it once too", () => {
    render(<OperatorExplorer initialPreset="concat-target" />);
    reveal();
    expect(countOf("the value is cut by member width")).toBe(1);
    expect(screen.queryByText("Rule:")).not.toBeInTheDocument();
  });

  it("binary ~&, picking the bitwise NAND: the compiler's message appears once, with no Rule line saying it again", () => {
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
    fireEvent.click(screen.getByLabelText(/bitwise NAND/));
    lockIn();
    expect(countOf("SystemVerilog has no binary ~& operator")).toBe(1);
    expect(countOf("is the unary reduction NAND")).toBe(1);
    expect(screen.queryByText("Rule:")).not.toBeInTheDocument();
  });

  it("{a, 1}: the message appears once, and the Notice adds something new", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{a, 1} (trap)" }));
    reveal();
    expect(countOf("is an unsized number")).toBe(1);
    expect(screen.queryByText("Rule:")).not.toBeInTheDocument();
    expect(screen.getByText(/The same 1 is legal in a \+ 1\./)).toBeInTheDocument();
  });

  it("binary ~&, picking either NAND: the wrong option names the slip and the compiler's message says the rest", () => {
    for (const pick of [/bitwise NAND/, /reduction NAND of a/]) {
      const { unmount } = render(<OperatorExplorer />);
      fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
      fireEvent.click(screen.getByLabelText(pick));
      lockIn();
      expect(countOf("no binary ~&")).toBe(1);
      expect(countOf("does not compile")).toBe(0);
      unmount();
    }
  });

  it("{a, 1}, picking a width: 'write 1'b1' and 'not allowed' come from the compiler's message alone", () => {
    for (const pick of [/1 treated as 1'b1/, /1 treated as 32'd1/]) {
      const { unmount } = render(<OperatorExplorer family="concat" />);
      fireEvent.click(screen.getByRole("radio", { name: "{a, 1} (trap)" }));
      fireEvent.click(screen.getByLabelText(pick));
      lockIn();
      expect(countOf("1'b1.")).toBe(1);
      expect(countOf("needs its size")).toBe(0);
      expect(screen.getByText(/at least 32/)).toHaveTextContent(/\(§5\.7\.1\)|§5\.7\.1 only promises/);
      unmount();
    }
  });

  it("{hi, lo} = 16'hBEEF, picking Compile error or the swapped members: the rule's sentences appear once", () => {
    for (const pick of ["Compile error", "hi = 8'hEF, lo = 8'hBE", "hi = 8'h12, lo = 8'h34"]) {
      const { unmount } = render(<OperatorExplorer initialPreset="concat-target" />);
      fireEvent.click(screen.getByLabelText(pick));
      lockIn();
      expect(countOf("may not be a target"), pick).toBe(1);
      expect(countOf("most significant bits"), pick).toBe(1);
      expect(countOf("assignment target"), pick).toBe(1);
      unmount();
    }
  });

  it("{{0{n[3]}}, n}, picking Compile error: the slip, the rule and the legality are each said once", () => {
    render(<OperatorExplorer initialPreset="concat-sign-extend" />);
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("Compile error"));
    lockIn();
    expect(screen.getByText(/That treats \{0\{n\[3\]\}\} as if it stood alone in braces\./)).toBeInTheDocument();
    expect(countOf("only n remains")).toBe(1);
    expect(countOf("positive width")).toBe(1);
  });

  it("{0{a}}: the message appears once, with no Rule line", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{R{a}}" }));
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "0" } });
    reveal();
    expect(countOf("replicates zero times")).toBe(1);
    expect(screen.queryByText("Rule:")).not.toBeInTheDocument();
  });

  it("the ?: table caption names the table and does not restate the rule", () => {
    render(<OperatorExplorer family="conditional" />);
    reveal();
    expect(screen.getByText("Merged bit by bit with Table 11-20")).toBeInTheDocument();
    expect(countOf("agree on 0 or 1")).toBe(1);
  });

  it("the concatenation target says MSB first and names the replication once, and a resize once", () => {
    const { unmount } = render(<OperatorExplorer initialPreset="concat-target" />);
    reveal();
    expect(countOf("most significant bits")).toBe(1);
    expect(countOf("may not be a target")).toBe(1);
    unmount();
    const narrow = render(<OperatorExplorer family="concat" width={4} />);
    fireEvent.click(screen.getByRole("radio", { name: "{hi, lo} = 16'hBEEF" }));
    reveal();
    expect(countOf("MSBs are discarded")).toBe(1);
    narrow.unmount();
    render(<OperatorExplorer family="concat" width={16} />);
    fireEvent.click(screen.getByRole("radio", { name: "{hi, lo} = 16'hBEEF" }));
    reveal();
    expect(countOf("is zero-extended to the 32-bit concatenation first (§11.8.3)")).toBe(1);
  });

  it("{a, b} and {R{a}} add the bit positions, not the rule again", () => {
    render(<OperatorExplorer family="concat" />);
    reveal();
    expect(screen.getByText("a takes bits [7:4] and b takes bits [3:0]: 8 bits in all.")).toBeInTheDocument();
    expect(countOf("MSB first")).toBe(1);
    fireEvent.click(screen.getByRole("radio", { name: "{R{a}}" }));
    reveal();
    expect(screen.getByText("2 copies of a: 8 bits in all.")).toBeInTheDocument();
  });

  it("{{4{n[3]}}, n}: the sign-extended value is stated once, in the detail", () => {
    render(<OperatorExplorer initialPreset="concat-sign-extend" />);
    reveal();
    expect(countOf("Read as a signed number it is -6")).toBe(1);
    expect(screen.getByText(/Set n\[3\] to 0 and the same braces add zeros/)).toBeInTheDocument();
    expect(screen.getByText(/unsigned as every concatenation is \(§11\.8\.1\)/)).toBeInTheDocument();
  });

  it("the Rule line stays when the feedback does not state the rule", () => {
    render(<OperatorExplorer family="reduction" />);
    reveal();
    expect(screen.getByText("Rule:")).toBeInTheDocument();
    expect(countOf("AND of all bits: one 0 decides 0.")).toBe(1);
  });
});

describe("OperatorExplorer: no editor that cannot change the answer", () => {
  it("{hi, lo} = 16'hBEEF declares hi and lo without editors, and the presets stay", () => {
    render(<OperatorExplorer initialPreset="concat-target" />);
    expect(screen.getByText(/logic \[7:0\] hi = 8'h12;/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Operand hi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Operand lo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Presets" })).toBeInTheDocument();
  });

  it("{R{a}} drops the a editor while R is 0, keeps the count field, and brings a back with R = 1", () => {
    render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{R{a}}" }));
    expect(screen.getByRole("group", { name: "Operand a, 4 bits" })).toBeInTheDocument();
    const count = screen.getByLabelText(/Replication count/);
    count.focus();
    fireEvent.change(count, { target: { value: "0" } });
    expect(screen.queryByRole("group", { name: /Operand a/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Replication count/)).toHaveValue(0);
    expect(document.activeElement).toBe(screen.getByLabelText(/Replication count/));
    fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: "1" } });
    expect(screen.getByRole("group", { name: "Operand a, 4 bits" })).toBeInTheDocument();
  });

  it("the other compile-error operators have no editors either, and no empty panel is left behind", () => {
    const { unmount } = render(<OperatorExplorer family="concat" />);
    fireEvent.click(screen.getByRole("radio", { name: "{a, 1} (trap)" }));
    expect(screen.queryByRole("group", { name: /Operand a/ })).not.toBeInTheDocument();
    unmount();
    render(<OperatorExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /Try a ~& b/ }));
    expect(screen.queryByRole("group", { name: /^Operand / })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Presets" })).not.toBeInTheDocument();
    expect(document.querySelector(".grid.rounded-xl")).toBeNull();
  });

  it("an operator whose answer follows its operands keeps them", () => {
    render(<OperatorExplorer family="concat" />);
    expect(screen.getByRole("group", { name: "Operand a, 4 bits" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Operand b, 4 bits" })).toBeInTheDocument();
  });
});

describe("OperatorExplorer: the question stays near the top in a lesson", () => {
  it.each([
    ["a family prop", { family: "conditional" as const }],
    ["a preset prop", { initialPreset: "concat-target" }],
  ])("%s folds the other families into a closed disclosure", (_name, props) => {
    render(<OperatorExplorer {...props} />);
    const details = screen.getByText("More operators").closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    // visual-language.md: touch targets of at least 40 px; py-3 gives 16 + 24 px with text-xs.
    expect(screen.getByText("More operators")).toHaveClass("py-3");
    expect(within(details).getByRole("radiogroup", { name: "Operator family", hidden: true })).toBeInTheDocument();
    // The operators of the lesson's own family stay in view.
    expect(screen.getByRole("radiogroup", { name: "Operator" }).closest("details")).toBeNull();
  });

  it("with neither prop the families stay in view", () => {
    render(<OperatorExplorer />);
    expect(screen.queryByText("More operators")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Operator family" }).closest("details")).toBeNull();
  });
});

describe("OperatorExplorer: two embeds on one page", () => {
  it("the same concat operator twice has unique field ids, and each label names its own input", () => {
    render(
      <>
        <OperatorExplorer initialPreset="concat-sign-extend" />
        <OperatorExplorer initialPreset="concat-sign-extend" />
      </>,
    );
    const [first, second] = screen.getAllByLabelText(/Replication count/);
    expect(first.id).not.toBe(second.id);
    expect(first.closest("label")).toHaveAttribute("for", first.id);
    expect(second.closest("label")).toHaveAttribute("for", second.id);
  });
});

describe("OperatorExplorer: a merge table pair is not a condition", () => {
  it("each cell reads as a pair of branch bits, not as a ?: expression", () => {
    render(<OperatorExplorer family="conditional" />);
    reveal();
    const table = within(screen.getByRole("region", { name: "Merge table, scrollable" }));
    expect(table.getByText(/^1 with 1 → 1$/)).toBeInTheDocument();
    expect(table.getByText(/^1 with 0 → x$/)).toBeInTheDocument();
    expect(table.queryByText(/\d \? \d/)).not.toBeInTheDocument();
  });

  it("en = x against 'z: the table names each pair with 'with', and the Notice adds only the consequence", () => {
    render(<OperatorExplorer initialPreset="cond-tristate" />);
    reveal();
    const table = within(screen.getByRole("region", { name: "Merge table, scrollable" }));
    expect(table.getAllByText(/^[01] with z → x$/)).toHaveLength(4);
    expect(screen.getByText(/Notice:/).parentElement).toHaveTextContent(/^Notice: The bus drives x, not z\.$/);
    expect(screen.queryByText(/\d \? \d|z\?z/)).not.toBeInTheDocument();
  });
});

describe("OperatorExplorer: width={1}", () => {
  it("en = x on `en ? data : 'z`: the if/else answer 1'bz can be picked, and is diagnosed with Table 11-20", () => {
    render(<OperatorExplorer family="conditional" width={1} />);
    fireEvent.click(screen.getByRole("radio", { name: /en \? data : 'z/ }));
    expect(screen.getByText(/logic\s+en = 1'bx;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("1'bz"));
    lockIn();
    expect(screen.getByText(/Not quite\./).parentElement).toHaveTextContent(/^Not quite\. Table 11-20 has no z result, not even for z with z\. An if\/else would store this\.$/);
    expect(screen.getByRole("status", { name: "Prediction verdict" })).toHaveTextContent("Your prediction is wrong. The answer is 1'bx.");
  });

  it("a 1-bit z result can be answered: en = 0 on `en ? data : 'z`", () => {
    render(<OperatorExplorer family="conditional" width={1} />);
    fireEvent.click(screen.getByRole("radio", { name: /en \? data : 'z/ }));
    for (let guard = 0; guard < 4 && !screen.queryByRole("button", { name: /^en bit 0 is 0/ }); guard += 1) {
      fireEvent.click(screen.getByRole("button", { name: /^en bit 0 is/ }));
    }
    fireEvent.click(screen.getByLabelText("1'bz"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Prediction verdict" })).toHaveTextContent("Your prediction is right. The answer is 1'bz.");
  });
});

describe("OperatorExplorer: no reveal prints the same words twice", () => {
  // The chosen option names its slip, "Why the answer holds" states the rule, and the detail adds this run's values.
  // A run of five words printed twice means two of those restate each other. Data tables and bit strips are values, not prose.
  const RUN = 5;
  const repeats = (text: string) => {
    const words = text.split(/\s+/).filter(Boolean).map((w) => w.toLowerCase().replace(/[.,:;()]+$|^[(]+/g, ""));
    const first = new Map<string, number>();
    const found = new Set<string>();
    for (let i = 0; i + RUN <= words.length; i += 1) {
      const key = words.slice(i, i + RUN).join(" ");
      const at = first.get(key);
      if (at === undefined) first.set(key, i);
      else if (i - at >= RUN) found.add(key);
    }
    return [...found];
  };
  const prompt = () => screen.getAllByRole("group").find((g) => g.tagName === "FIELDSET")?.parentElement as HTMLElement;
  const prose = () => {
    const clone = prompt().cloneNode(true) as HTMLElement;
    clone.querySelectorAll("fieldset, table, [role='img']").forEach((e) => e.remove());
    return clone.textContent ?? "";
  };
  const pickSpec = (s: OperatorSpec) => () => fireEvent.click(screen.getByRole("radio", { name: s.trap ? `${s.template} (trap)` : s.template }));
  const setCount = (n: number) => () => fireEvent.change(screen.getByLabelText(/Replication count/), { target: { value: String(n) } });
  const cycleSel = (presses: number) => () => {
    for (let i = 0; i < presses; i += 1) fireEvent.click(screen.getAllByRole("button", { name: /^sel bit 0 is/ })[0]);
  };
  const ours = operatorCatalog.filter((s) => ["conditional", "bitcount", "concat"].includes(s.family) || s.id === "binary-nand");
  const cases: [string, () => React.ReactElement, (() => void)?][] = [
    ...ours.map((s): [string, () => React.ReactElement, () => void] => [s.id, () => <OperatorExplorer family={s.family} />, pickSpec(s)]),
    ...ours
      .filter((s) => s.family === "conditional" || s.family === "bitcount")
      .map((s): [string, () => React.ReactElement, () => void] => [`${s.id} at width 1`, () => <OperatorExplorer family={s.family} width={1} />, pickSpec(s)]),
    ...operatorPresets.map((p): [string, () => React.ReactElement] => [`preset ${p.id}`, () => <OperatorExplorer initialPreset={p.id} />]),
    ["{0{a}}", () => <OperatorExplorer family="concat" />, () => (pickSpec(operatorCatalog.find((s) => s.id === "repl-n") as OperatorSpec)(), setCount(0)())],
    ["{{0{n[3]}}, n}", () => <OperatorExplorer initialPreset="concat-sign-extend" />, setCount(0)],
    ["sel = 0", () => <OperatorExplorer family="conditional" />, cycleSel(2)],
    ["sel = 1", () => <OperatorExplorer family="conditional" />, cycleSel(3)],
  ];

  it.each(cases)("%s: skipped, and with each option locked in", (_name, make, prepare) => {
    const { unmount } = render(make());
    prepare?.();
    const choices = within(prompt()).getAllByRole("radio").length;
    unmount();
    for (let k = -1; k < choices; k += 1) {
      const view = render(make());
      prepare?.();
      if (k < 0) {
        reveal();
      } else {
        fireEvent.click(within(prompt()).getAllByRole("radio")[k]);
        lockIn();
      }
      expect(repeats(prose()), k < 0 ? "skipped" : `option ${k}`).toEqual([]);
      view.unmount();
    }
  });
});
