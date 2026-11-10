import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LogicStateDiagram, { analyseVectorCondition, diagnoseVectorGuess } from "@/components/visuals/LogicStateDiagram";
import { caseItemMatches, compare, conditionalOp, ifBranch, logicalNot, parseBits, selectCaseItem } from "@/lib/sv-four-state-model";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const tab = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));

describe("LogicStateDiagram (four-state explorer)", () => {
  it("shows the four-value picture and declares itself a model", () => {
    render(<LogicStateDiagram />);
    expect(screen.getByRole("region", { name: /four-state value explorer/i })).toBeInTheDocument();
    expect(screen.getByText(/The simulator cannot tell 0 from 1/)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
  });

  it("hides the operator result until a prediction is locked in, then diagnoses 'x & 0 = x'", () => {
    render(<LogicStateDiagram />);
    // Default case: a = x, b = 0, operator &.
    expect(screen.queryByText(/controlling value of &/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Table 11-11/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/decides the result on its own/)).toBeInTheDocument();
    expect(screen.getAllByText(/controlling value of &/).length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: /Table 11-11/ });
    const current = table.querySelector('[aria-current="true"]');
    expect(current?.textContent).toContain("0");
  });

  it("changing an operand with the keyboard re-asks the prediction", () => {
    render(<LogicStateDiagram />);
    fireEvent.click(screen.getByLabelText(/y = 1'b0/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Value of b" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "0" }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "1" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("== with a known differing bit is 0, while === and ==? are shown after the reveal", () => {
    render(<LogicStateDiagram />);
    tab(/== vs ===/);
    fireEvent.click(screen.getByLabelText(/a == b is 1'bx/));
    lockIn();
    expect(screen.getByText(/does not automatically poison/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bit 3 is known in both operands and differs/).length).toBeGreaterThan(0);
    expect(screen.getByText(/=== compares x and z literally/)).toBeInTheDocument();
  });

  it("bit editors keep keyboard focus on the bit while it cycles", () => {
    render(<LogicStateDiagram />);
    tab(/== vs ===/);
    const bit = screen.getByRole("button", { name: /^a\[2\] is x/ });
    bit.focus();
    fireEvent.click(bit);
    const after = screen.getByRole("button", { name: /^a\[2\] is z/ });
    expect(after).toBe(bit);
    expect(document.activeElement).toBe(after);
  });

  it("if (a) and if (!a) both take the else branch when a is x", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByLabelText(/y = 1'b0/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/X-optimism/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "if (!a)" }));
    fireEvent.click(screen.getByLabelText(/y = 1'b1/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/!x is x|!x is still x/).length).toBeGreaterThan(0);
  });

  it("?: with an x condition gives x, not a branch", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByRole("radio", { name: "a ? 1 : 0" }));
    fireEvent.click(screen.getByLabelText(/y = 1'bx/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/Table 11-20/).length).toBeGreaterThan(0);
  });

  it("casex lets an x select run branch A, while case falls to default", () => {
    render(<LogicStateDiagram />);
    tab(/if \/ case with x/);
    fireEvent.click(screen.getByRole("radio", { name: "casex" }));
    fireEvent.click(screen.getByLabelText(/Branch A/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/casex treats x in the case expression as a do-not-care/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "case" }));
    fireEvent.click(screen.getByLabelText(/Branch A/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/compares x and z literally/).length).toBeGreaterThan(0);
  });

  it("assigning 4'b1x0z to bit [3:0] gives 4'b1000 and explains §6.11.2", () => {
    render(<LogicStateDiagram />);
    tab(/Into 2-state/);
    expect(screen.queryByText(/became 0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/t = 4'b1x0z/));
    lockIn();
    expect(screen.getByText(/A 2-state variable has no encoding for x or z/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bits 2, 0 became 0/).length).toBeGreaterThan(0);
    expect(screen.getByText(/After the copy the evidence is gone/)).toBeInTheDocument();
  });

  it("int targets are 32 bits wide", () => {
    render(<LogicStateDiagram />);
    tab(/Into 2-state/);
    fireEvent.click(screen.getByRole("radio", { name: "int" }));
    expect(screen.getByLabelText(/t = 32'b0…01000 \(8\)/)).toBeInTheDocument();
  });

  /* ---------------- props for embeds ---------------- */

  it("opens on the control tab with only that tab when initialTab='control' and tabs={['control']}", () => {
    render(<LogicStateDiagram initialTab="control" initialConstruct="if" tabs={["control"]} />);
    expect(screen.queryByRole("radiogroup", { name: "Explorer tab" })).not.toBeInTheDocument();
    const construct = screen.getByRole("radiogroup", { name: "Construct" });
    expect(within(construct).getByRole("radio", { name: "if (a)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/logic a = 1'bx;/)).toBeInTheDocument();
  });

  it("'tables' is the default tab and a tabs subset keeps the default order", () => {
    render(<LogicStateDiagram tabs={["control", "tables"]} initialTab="tables" />);
    const tabs = within(screen.getByRole("radiogroup", { name: "Explorer tab" })).getAllByRole("radio");
    expect(tabs.map((t) => t.textContent)).toEqual(["Operator tables", "if / case with x"]);
    expect(tabs[0]).toHaveAttribute("aria-checked", "true");
  });

  it("an initialTab outside tabs falls back to the first shown tab", () => {
    render(<LogicStateDiagram tabs={["equality"]} initialTab="control" />);
    expect(screen.getByText(/logic \[3:0\] a = 4'b1x00;/)).toBeInTheDocument();
  });

  it("initialConstruct='case' with initialValue='x0' preloads sel and keeps items A, B, C and default D (§12.5)", () => {
    render(<LogicStateDiagram initialTab="control" initialConstruct="case" initialValue="x0" tabs={["control"]} />);
    expect(screen.getByText(/logic \[1:0\] sel = 2'bx0;/)).toBeInTheDocument();
    expect(screen.getByText(/2'b00: +branch = "A";/)).toBeInTheDocument();
    expect(screen.getByText(/2'b1\?: +branch = "B";/)).toBeInTheDocument();
    expect(screen.getByText(/2'bx1: +branch = "C";/)).toBeInTheDocument();
    expect(screen.getByText(/default: branch = "D";/)).toBeInTheDocument();
    // The answer is the model's: plain case on x0 matches nothing, so default D runs.
    expect(selectCaseItem("case", parseBits("x0"), ["00", "1?", "x1"].map(parseBits))).toBe("default");
    fireEvent.click(screen.getByLabelText(/Branch D/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/No item matches under case rules, so default runs/)).toBeInTheDocument();
  });

  it("casez on sel = 1z matches item B (2'b1?) because ? is z in both places (§12.5.1)", () => {
    expect(caseItemMatches("casez", parseBits("1z"), parseBits("1?"))).toBe(true);
    render(<LogicStateDiagram initialTab="control" initialConstruct="casez" initialValue="1z" tabs={["control"]} />);
    fireEvent.click(screen.getByLabelText(/Branch B/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("an initialValue of the wrong width or with bad characters is ignored", () => {
    const { unmount } = render(<LogicStateDiagram initialTab="control" initialConstruct="case" initialValue="x01" />);
    expect(screen.getByText(/sel = 2'bx0;/)).toBeInTheDocument();
    unmount();
    render(<LogicStateDiagram initialTab="control" initialValue="q" />);
    expect(screen.getByText(/logic a = 1'bx;/)).toBeInTheDocument();
  });

  it("initialValue='1' preloads a for if (a): §12.4 known nonzero runs then", () => {
    expect(ifBranch(["1"])).toBe("then");
    render(<LogicStateDiagram initialTab="control" initialValue="1" />);
    fireEvent.click(screen.getByLabelText(/y = 1'b1/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  /* ---------------- vector-condition preset ---------------- */

  it("model: §12.4 if (4'b1x00) runs then because a 1 bit makes it nonzero; e != 0 is 1", () => {
    const r = analyseVectorCondition("if", parseBits("1x00"));
    expect(r.branch).toBe("then");
    expect(r.notEqualZero).toBe(compare("!=", parseBits("1x00"), parseBits("0000")).result);
    expect(r.notEqualZero).toBe("1");
    expect(r.oneBits).toEqual([3]);
    expect(r.unknownBits).toEqual([2]);
    expect(r.why).toBe("Bit 3 is 1, so e = 4'b1x00 is nonzero whatever its x and z bits hold: e != 0 is 1'b1. if (e) tests e != 0, so the then branch runs (§12.4).");
  });

  it("model: §12.4 if (4'b0x00) takes else because e != 0 is x, which counts as false", () => {
    const r = analyseVectorCondition("if", parseBits("0x00"));
    expect(r.notEqualZero).toBe("x");
    expect(r.branch).toBe("else");
    expect(r.y).toBe("0");
    expect(r.why).toBe(
      "No bit of e = 4'b0x00 is a known 1, and bit 2 is x or z, so e might be zero: e != 0 is 1'bx. if (e) tests e != 0, and an x or z result counts as false, so the else branch runs (§12.4).",
    );
  });

  it("model: §12.4 z bits are unknown too, and all-zero is plainly false", () => {
    expect(analyseVectorCondition("if", parseBits("0z0z")).branch).toBe("else");
    expect(analyseVectorCondition("if", parseBits("0z01")).branch).toBe("then");
    const zero = analyseVectorCondition("if", parseBits("0000"));
    expect(zero.notEqualZero).toBe("0");
    expect(zero.branch).toBe("else");
    expect(zero.why).toMatch(/^Every bit of e = 4'b0000 is 0, so e != 0 is 1'b0\./);
  });

  it("model: §11.4.7 if (!4'b0x00) also takes else because !e is x; if (!4'b1x00) takes else because !e is 0", () => {
    const unk = analyseVectorCondition("ifnot", parseBits("0x00"));
    expect(unk.negated).toBe(logicalNot(parseBits("0x00")));
    expect(unk.negated).toBe("x");
    expect(unk.branch).toBe("else");
    expect(unk.why).toMatch(/!e is 1'bx because the truth of e is unknown \(§11\.4\.7\)/);
    const known = analyseVectorCondition("ifnot", parseBits("1x00"));
    expect(known.negated).toBe("0");
    expect(known.branch).toBe("else");
    expect(analyseVectorCondition("ifnot", parseBits("0000")).branch).toBe("then");
  });

  it("model: §11.4.11 Table 11-20 e ? 1 : 0 merges to x for 4'b0x00 and selects 1 for 4'b1x00", () => {
    const unk = analyseVectorCondition("ternary", parseBits("0x00"));
    expect(unk.y).toBe(conditionalOp(parseBits("0x00"), ["1"], ["0"])[0]);
    expect(unk.y).toBe("x");
    expect(unk.why).toMatch(/Table 11-20/);
    expect(analyseVectorCondition("ternary", parseBits("1x00")).y).toBe("1");
  });

  it("model: wrong guesses are diagnosed with the model's explanation attached", () => {
    const r = analyseVectorCondition("if", parseBits("1x00"));
    expect(diagnoseVectorGuess(r, "else")).toBe(`One known 1 is enough: the x or z bits cannot make e zero. ${r.why}`);
    expect(diagnoseVectorGuess(r, "x")).toBe(`An if statement cannot produce x by itself: it runs one branch. ${r.why}`);
    expect(diagnoseVectorGuess(r, "then")).toBe(r.why);
    const u = analyseVectorCondition("if", parseBits("0x00"));
    expect(diagnoseVectorGuess(u, "then")).toBe(`An x or z bit might be 0, so e is not known to be nonzero. ${u.why}`);
    expect(diagnoseVectorGuess(u, "x")).toBe(`An if statement cannot produce x by itself: it runs one branch. ${u.why}`);
    // z bits count as unknown too (§12.4, §11.4.5).
    const z = analyseVectorCondition("if", parseBits("1z00"));
    expect(z.branch).toBe("then");
    expect(diagnoseVectorGuess(z, "else")).toBe(`One known 1 is enough: the x or z bits cannot make e zero. ${z.why}`);
  });

  it("model: if (!e) wrong guesses are refuted with §11.4.7, not with the if (e) reasoning", () => {
    const u = analyseVectorCondition("ifnot", parseBits("0x00"));
    expect(u.branch).toBe("else");
    expect(diagnoseVectorGuess(u, "then")).toBe(
      `e is not known to be zero either, so !e is 1'bx, not 1 (§11.4.7), and x counts as false (§12.4). ${u.why}`,
    );
    expect(diagnoseVectorGuess(u, "then")).not.toMatch(/not known to be nonzero/);
    expect(diagnoseVectorGuess(u, "x")).toBe(`An if statement cannot produce x by itself: it runs one branch. ${u.why}`);
    expect(diagnoseVectorGuess(u, "else")).toBe(u.why);
    const k = analyseVectorCondition("ifnot", parseBits("1x00"));
    expect(k.branch).toBe("else");
    expect(diagnoseVectorGuess(k, "then")).toBe(k.why);
  });

  it("model: ternary wrong guesses get the ?: prefix only when the condition is ambiguous", () => {
    const u = analyseVectorCondition("ternary", parseBits("0x00"));
    expect(u.y).toBe("x");
    const prefix = "?: does not pick a side when its condition is ambiguous.";
    expect(diagnoseVectorGuess(u, "1")).toBe(`${prefix} ${u.why}`);
    expect(diagnoseVectorGuess(u, "0")).toBe(`${prefix} ${u.why}`);
    expect(diagnoseVectorGuess(u, "x")).toBe(u.why);
    const k = analyseVectorCondition("ternary", parseBits("1x00"));
    expect(k.y).toBe("1");
    expect(diagnoseVectorGuess(k, "x")).toBe(k.why);
    expect(diagnoseVectorGuess(k, "0")).toBe(k.why);
  });

  it("vector-condition preset: if (4'b1x00) hides the answer, then a 'then' prediction is confirmed with e != 0 = 1", () => {
    render(<LogicStateDiagram initialTab="control" initialConstruct="if" tabs={["control"]} preset="vector-condition" />);
    expect(screen.getByText(/logic \[3:0\] e = 4'b1x00;/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "if (e)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(/if \(e\) is the same test as if \(e != 0\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/whatever its x and z bits hold/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/then branch/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/if \(e\) is the same test as if \(e != 0\)/)).toBeInTheDocument();
    expect(screen.getAllByText(analyseVectorCondition("if", parseBits("1x00")).why).length).toBeGreaterThan(0);
  });

  it("vector-condition preset: toggling bit 3 to 0 re-asks, and 'then' on 4'b0x00 is diagnosed as X-optimism", () => {
    render(<LogicStateDiagram initialTab="control" tabs={["control"]} preset="vector-condition" />);
    const bit3 = screen.getByRole("button", { name: /^e\[3\] is 1/ });
    fireEvent.click(bit3); // 1 -> x
    fireEvent.click(bit3); // x -> z
    fireEvent.click(bit3); // z -> 0
    expect(screen.getByText(/logic \[3:0\] e = 4'b0x00;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/then branch/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/An x or z bit might be 0/).length).toBeGreaterThan(0);
    expect(screen.getByText(/X-optimism: y is a clean 1'b0/)).toBeInTheDocument();
  });

  it("vector-condition preset: quick-load buttons and initialValue set e, and the keyboard reaches if (!e)", () => {
    render(<LogicStateDiagram initialTab="control" preset="vector-condition" initialValue="0x00" />);
    expect(screen.getByText(/e = 4'b0x00;/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4'b0000" }));
    expect(screen.getByText(/e = 4'b0000;/)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Construct" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "if (e)" }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "if (!e)" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByLabelText(/then branch/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("vector-condition preset: e ? 1 : 0 on 4'b0x00 predicts y and reveals the Table 11-20 merge", () => {
    render(<LogicStateDiagram initialTab="control" initialConstruct="ternary" preset="vector-condition" initialValue="0x00" />);
    fireEvent.click(screen.getByLabelText(/y = 1'b0/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/does not pick a side/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Table 11-20/).length).toBeGreaterThan(0);
  });
});
