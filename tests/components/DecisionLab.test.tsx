import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DecisionLab, { DECISION_ASSUMPTIONS } from "@/components/visuals/DecisionLab";

/** Answers the prompt whose question matches, then locks it in. Scoped, because the two prompts can offer the same options. */
function predict(question: RegExp, option: RegExp | string) {
  const legend = Array.from(document.querySelectorAll("legend")).find((l) => question.test(l.textContent ?? ""));
  if (!legend) throw new Error(`No prompt matching ${question}`);
  const fieldset = legend.closest("fieldset") as HTMLElement;
  fireEvent.click(within(fieldset).getByLabelText(option));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
}

const radio = (group: string, name: string) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
const codeText = () => Array.from(document.querySelectorAll("ol[aria-label] li")).map((li) => li.textContent ?? "").join("\n");
const liveGridCell = () => screen.getByRole("table", { name: /Outcome by qualifier/ }).querySelector('[aria-current="true"]');

describe("DecisionLab (qualifiers mode)", () => {
  it("starts on the lesson decoder, declares itself a model, and hides the reveal until both predictions are in", () => {
    render(<DecisionLab />);
    expect(screen.getByRole("region", { name: /Decision lab: which item runs and what is reported/ })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
    expect(codeText()).toContain("unique case (sel)");
    expect(codeText()).toContain("2'b01:");
    expect(screen.queryByRole("note", { name: /violation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Outcome by qualifier/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();

    predict(/Which case item runs/, /item 2: 2'b01/);
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    expect(screen.getByText(/What is reported\?/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Outcome by qualifier/ })).not.toBeInTheDocument();

    predict(/What is reported/, "nothing is reported");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.getByRole("note", { name: "No violation" })).toHaveTextContent(/Exactly one case item matches/);
    expect(liveGridCell()?.textContent).toContain("runs it, silent");
    expect(screen.getByText(/^Outcome:/).parentElement?.textContent).toMatch(/Item 2 \(2'b01\) runs/);
    // The running line is highlighted in the generated code.
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("2'b01:");
  });

  it("sel = xx under unique: nothing runs and the no-match ticket names §12.5.3 and the deferred report", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    expect(screen.getByRole("button", { name: "sel = 2'bxx" })).toHaveAttribute("aria-pressed", "true");
    predict(/Which case item runs/, "nothing runs");
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    predict(/What is reported/, "a no-match violation");
    const ticket = screen.getByRole("note", { name: "Violation ticket" });
    expect(ticket).toHaveTextContent("unique case: no case item matches");
    expect(ticket).toHaveTextContent(/§12\.5\.3/);
    expect(ticket).toHaveTextContent(/reported in the Observed region \(§12\.4\.2\.1, §12\.5\.3\.1\)/);
    expect(liveGridCell()?.textContent).toContain("nothing runs, report");
    expect(screen.getAllByText(/no match$/).length).toBe(3);
  });

  it("a wrong prediction is diagnosed: choosing 2'b00 for sel = xx explains the literal x comparison", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, /item 1: 2'b00/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/compares x and z literally/).length).toBeGreaterThan(0);
    predict(/What is reported/, "nothing is reported");
    expect(screen.getAllByText(/Not quite/).length).toBe(2);
    expect(screen.getAllByText(/not silent/).length).toBeGreaterThan(0);
  });

  it("a default silences the no-match check and runs instead", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    fireEvent.click(screen.getByLabelText(/default item/));
    expect(codeText()).toContain("default:");
    predict(/Which case item runs/, /the default item/);
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    predict(/What is reported/, "a no-match violation");
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/can never happen/).length).toBeGreaterThan(0);
    expect(screen.getByRole("note", { name: "No violation" })).toBeInTheDocument();
    expect(liveGridCell()?.textContent).toContain("default runs, silent");
  });

  it("the qualifier control is keyboard operable and unique0 stays silent on a missing match", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b11" }));
    const unique = radio("Qualifier", "unique");
    unique.focus();
    fireEvent.keyDown(unique, { key: "ArrowRight" });
    expect(radio("Qualifier", "unique0")).toHaveAttribute("aria-checked", "true");
    expect(codeText()).toContain("unique0 case (sel)");
    predict(/Which case item runs/, "nothing runs");
    predict(/What is reported/, "nothing is reported");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.getByRole("note", { name: "No violation" })).toHaveTextContent(/unique0 does not report a missing match/);
    expect(liveGridCell()?.textContent).toContain("nothing runs, silent");
  });

  it("switching the form to if-else-if rewrites the code as == conditions and renames the catch-all", () => {
    render(<DecisionLab />);
    fireEvent.click(radio("Statement form", "if-else-if"));
    expect(codeText()).toContain("unique if (sel == 2'b00)");
    expect(codeText()).toContain("else if (sel == 2'b01)");
    expect(screen.getByLabelText(/final else/)).toBeInTheDocument();
    expect(screen.getByText(/Which branch runs/)).toBeInTheDocument();
    predict(/Which branch runs/, /branch 2: sel == 2'b01/);
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    predict(/What is reported/, "nothing is reported");
    expect(screen.getByRole("columnheader", { name: "one condition matches" })).toBeInTheDocument();
    expect(screen.getByText(/^Outcome:/).parentElement?.textContent).toMatch(/Branch 2 \(sel == 2'b01\) runs/);
  });

  it("the casez overlap preset: the first item runs, unique reports the overlap, the second item is marked 'matches, not run'", () => {
    render(<DecisionLab />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "casez-overlap" } });
    expect(codeText()).toContain("unique casez (sel)");
    expect(codeText()).toContain("2'b1?:");
    predict(/Which case item runs/, /item 2: 2'b\?1/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/first match wins/).length).toBeGreaterThan(0);
    predict(/What is reported/, "an overlap violation");
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    expect(screen.getByRole("note", { name: "Violation ticket" })).toHaveTextContent("unique casez: 2 case items match");
    expect(screen.getByText(/matches, not run/)).toBeInTheDocument();
    expect(screen.getByText(/matches and runs/)).toBeInTheDocument();
    expect(liveGridCell()?.textContent).toContain("runs first, report");
  });

  it("the preset prop selects a preset, and the one-hot case (1'b1) reads its items as bits of gnt", () => {
    render(<DecisionLab preset="one-hot" />);
    expect(codeText()).toContain("unique case (1'b1)");
    expect(codeText()).toContain("gnt[0]:");
    predict(/Which case item runs/, /item 1: gnt\[0\]/);
    predict(/What is reported/, "an overlap violation");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.getByRole("note", { name: "Violation ticket" })).toHaveTextContent("unique case: 2 case items match");
  });

  it("the bit editor keeps focus on the bit while it cycles, and any change re-arms the prediction", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    const bit = screen.getByRole("button", { name: /^sel\[0\] is 1/ });
    bit.focus();
    fireEvent.click(bit);
    const after = screen.getByRole("button", { name: /^sel\[0\] is x/ });
    expect(after).toBe(bit);
    expect(document.activeElement).toBe(after);
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();
    expect(codeText()).toContain("logic [1:0] sel = 2'b0x;");
  });

  it("reveal without predicting works for both gates", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByRole("table", { name: /Outcome by qualifier/ })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "No violation" })).toBeInTheDocument();
  });

  it("the report prompt is a sibling of the run prompt (one inset on a phone), only the outcome line is live, and quick values meet the 40 px target", () => {
    render(<DecisionLab />);
    expect(screen.getByRole("button", { name: "sel = 2'bxx" }).className).toContain("min-h-10");
    predict(/Which case item runs/, /item 2: 2'b01/);
    const firstPrompt = document.querySelector("legend")?.closest("fieldset")?.parentElement as HTMLElement;
    const secondPrompt = screen.getByText(/What is reported\?/).closest("fieldset")?.parentElement as HTMLElement;
    expect(firstPrompt).toBeTruthy();
    expect(secondPrompt).toBeTruthy();
    expect(firstPrompt.contains(secondPrompt)).toBe(false);
    expect(firstPrompt).toHaveTextContent(/Next, predict what is reported/);
    // The live region is already mounted and empty, so its text is announced when it arrives.
    const live = screen.getByTestId("decision-live-line");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();

    predict(/What is reported/, "nothing is reported");
    expect(screen.getByTestId("decision-live-line")).toBe(live);
    expect(live).toHaveTextContent(/Item 2 \(2'b01\) runs/);
    expect(screen.getByText(/^Outcome:/).closest("[aria-live]")).toBeNull();
    // The detail (items, ticket, grid) is static: no live region wraps it.
    expect(screen.getByRole("table", { name: /Outcome by qualifier/ }).closest("[aria-live]")).toBeNull();
    expect(screen.getByRole("note", { name: "No violation" }).closest("[aria-live]")).toBeNull();
    // The grid no longer forces a minimum width, so its columns wrap instead of scrolling at 390 px.
    expect(screen.getByRole("table", { name: /Outcome by qualifier/ }).className).not.toMatch(/min-w-/);
  });

  it("re-arming the first prompt removes the second one again and empties the live line", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    predict(/What is reported/, "nothing is reported");
    expect(screen.getByTestId("decision-live-line")).not.toBeEmptyDOMElement();
    fireEvent.click(radio("Qualifier", "priority"));
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.getByTestId("decision-live-line")).toBeEmptyDOMElement();
  });

  it("a preset's outcome stays hidden until both predictions are in, then appears inside the reveal", () => {
    render(<DecisionLab preset="lrm-unique-case" />);
    expect(screen.getByLabelText("Preset")).toHaveValue("lrm-unique-case");
    expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
    expect(screen.getByText(/declares bit \[2:0\] a; the lab uses logic so x can be tried/)).toBeInTheDocument();
    predict(/Which case item runs/, "nothing runs");
    expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
    predict(/What is reported/, "a no-match violation");
    expect(screen.getByRole("note", { name: "About this preset" })).toHaveTextContent(/values 3, 5, 6 and 7 cause a violation report/);
  });

  it("the first prompt's feedback leaves the report to the second prompt: sel = xx under unique", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, "nothing runs");
    const feedback = screen.getByText(/Correct\./).closest("p") as HTMLElement;
    expect(feedback).toHaveTextContent("Every case item fails: a plain case compares x and z literally (§12.5), so nothing runs.");
    expect(feedback).not.toHaveTextContent(/report/);
  });

  it("editing the form, qualifier or default replaces the preset's text; another select value does not", () => {
    render(<DecisionLab preset="lrm-unique0-case" />);
    const edited = /Edited from: Standard example: unique0 case \(a\).*computed from the statement shown/;
    expect(screen.queryByText(edited)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "a = 3'b101" }));
    expect(screen.queryByText(edited)).not.toBeInTheDocument();
    expect(screen.getByText(/From IEEE 1800-2023 §12\.5\.3/)).toBeInTheDocument();

    fireEvent.click(radio("Qualifier", "unique"));
    expect(screen.getByText(edited)).toBeInTheDocument();
    expect(screen.queryByText(/From IEEE 1800-2023 §12\.5\.3/)).not.toBeInTheDocument();
    predict(/Which case item runs/, "nothing runs");
    predict(/What is reported/, "a no-match violation");
    // The ticket reports the miss; the preset's "do not cause a violation report" must not stand beside it.
    expect(screen.getByRole("note", { name: "Violation ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "About this preset" })).not.toBeInTheDocument();
    expect(screen.queryByText(/do not cause a violation report/)).not.toBeInTheDocument();

    // Going back to the preset's own statement restores its text.
    fireEvent.click(radio("Qualifier", "unique0"));
    expect(screen.queryByText(edited)).not.toBeInTheDocument();

    const defaultItem = screen.getByRole("checkbox", { name: /default item/ });
    fireEvent.click(defaultItem);
    expect(screen.getByText(edited)).toBeInTheDocument();
    fireEvent.click(defaultItem);
    fireEvent.click(radio("Statement form", "casez"));
    expect(screen.getByText(edited)).toBeInTheDocument();
  });

  it("the ticket and the grid come before the item cards, plain misses fold to one line, and a legend explains the chips", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, "nothing runs");
    predict(/What is reported/, "a no-match violation");
    const ticket = screen.getByRole("note", { name: "Violation ticket" });
    const grid = screen.getByRole("table", { name: /Outcome by qualifier/ });
    const items = screen.getByRole("list", { name: "case items in source order" });
    expect(ticket.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const folded = within(items).getAllByText("fails at bit 1");
    expect(folded.length).toBe(3);
    for (const line of folded) {
      expect(line.tagName).toBe("SUMMARY");
      expect((line.parentElement as HTMLDetailsElement).open).toBe(false);
    }
    expect(screen.getByText(/1 match, 0 mismatch, x unknown \(no match\), – skipped, \? wildcard in the item/)).toHaveTextContent(/written z here \(same bit value\)/);
  });

  it("a matching item keeps its chips open, and its failed sibling terms carry no chip table", () => {
    render(<DecisionLab preset="casez-overlap" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b10" }));
    predict(/Which case item runs/, /item 1/);
    predict(/What is reported/, "nothing is reported");
    const runs = screen.getByText(/matches and runs/).closest("li") as HTMLElement;
    expect(runs.querySelector("details")).toBeNull();
    expect(within(runs).getByRole("table")).toBeInTheDocument();
  });

  it("the chip's screen-reader text is one phrase, without the stutter", () => {
    render(<DecisionLab preset="casez-overlap" />);
    predict(/Which case item runs/, /item 1/);
    predict(/What is reported/, "an overlap violation");
    const chip = screen.getAllByText(/skipped, a do-not-care/)[0];
    expect(chip.textContent).toBe("skipped, a do-not-care");
  });

  it("the code panel carries no owner tag, and the assumptions declare the one-execution simplification (§12.4.2.1, §12.5.3.1)", () => {
    render(<DecisionLab />);
    expect(codeText()).not.toContain("DUT");
    expect(DECISION_ASSUMPTIONS.join(" ")).toMatch(/models one execution of the statement\. A pending report is discarded .*\(§12\.4\.2\.1, §12\.5\.3\.1\)/);
  });
});

describe("DecisionLab (compare mode)", () => {
  it("casex-vs-inside: an unknown select runs 2'b10 under casex and matches nothing under case inside, with per-bit chips and the stamp", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    expect(screen.getByRole("region", { name: /Decision lab: casex versus case inside/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "casex (sel)" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "case (sel) inside" })).toBeInTheDocument();
    expect(screen.queryByText("x means no match")).not.toBeInTheDocument();

    predict(/Under casex/, /item 1: 2'b10/);
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    expect(screen.getAllByText(/skips bit 0/).length).toBeGreaterThan(0);
    predict(/Under case inside/, "nothing runs");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);

    const left = screen.getByRole("region", { name: "casex column" });
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(left).getByText(/matches and runs/)).toBeInTheDocument();
    expect(within(left).getAllByText(/skipped, a do-not-care/).length).toBeGreaterThan(0);
    // sel[0] = x was skipped against the item's known 0: that is the hidden bug, and the wording is casex's (x and z).
    expect(within(left).getByText(/Looks clean/)).toHaveTextContent(/an unknown select ran a real branch, because casex skips x and z bits in the case expression too \(§12\.5\.1\)/);
    expect(within(right).getAllByText("x means no match").length).toBe(2);
    expect(within(right).getAllByText(/unknown, no match/).length).toBeGreaterThan(0);
    // No default and no qualifier: the column is silent, so the banner must not claim the unknown is visible (§12.5, §12.5.4).
    const banner = within(right).getByText(/No real branch runs/);
    expect(banner).toHaveTextContent(/x is no match \(§12\.5\.4\)\. To see it, add a default that reports it or a unique or priority qualifier \(§12\.5\.3\)\./);
    expect(within(right).queryByText(/stays visible/)).not.toBeInTheDocument();
    expect(within(right).queryByText(/matches and runs/)).not.toBeInTheDocument();
  });

  it("the casez toggle shows z don't-cares: sel = 2'b1z runs 2'b10 under casez and nothing under case inside", () => {
    render(<DecisionLab mode="compare" />);
    fireEvent.click(radio("Left column", "casez"));
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b1z" }));
    expect(screen.getByRole("list", { name: "casez (sel)" })).toBeInTheDocument();
    predict(/Under casez/, /item 1: 2'b10/);
    predict(/Under case inside/, "nothing runs");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    const left = screen.getByRole("region", { name: "casez column" });
    expect(within(left).getByText(/matches and runs/)).toBeInTheDocument();
    // The z was skipped against the item's 0; the casez wording is z-only (§12.5.1 lets casez skip z, not x).
    const warning = within(left).getByText(/Looks clean/);
    expect(warning).toHaveTextContent(/a z in the select ran a real branch, because casez skips z bits in the case expression too/);
    expect(warning).not.toHaveTextContent(/x and z/);
  });

  it("casez does not skip x: sel = 2'b1x matches nothing in either column", () => {
    render(<DecisionLab mode="compare" />);
    fireEvent.click(radio("Left column", "casez"));
    predict(/Under casez/, /item 1: 2'b10/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/casez skips only z/).length).toBeGreaterThan(0);
  });

  it("the wildcard item set: 2'b1? accepts sel = 2'b1x in both columns, and the x1 value in neither", () => {
    render(<DecisionLab mode="compare" />);
    fireEvent.click(radio("Item set", "One item, 2'b1?"));
    expect(codeText()).toContain("2'b1?:");
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, /item 1: 2'b1\?/);
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.getAllByText(/wildcard/).length).toBeGreaterThan(0);
    // The match comes from the item's ?, which case inside accepts as well: nothing hides, so no warning fires.
    expect(within(screen.getByRole("region", { name: "case inside column" })).getByText(/matches and runs/)).toBeInTheDocument();
    expect(screen.queryByText(/Looks clean/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bx1" }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, "nothing runs");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    // sel = x1 against 2'b1?: casex skipped the select's x against the item's known 1, so the warning does fire here.
    expect(within(screen.getByRole("region", { name: "casex column" })).getByText(/Looks clean/)).toBeInTheDocument();
  });

  it("the wildcard item under casez: sel = 2'b1x matches through the item's ? in both columns and no warning fires", () => {
    render(<DecisionLab mode="compare" preset="wildcard-item" />);
    fireEvent.click(radio("Left column", "casez"));
    predict(/Under casez/, /item 1: 2'b1\?/);
    predict(/Under case inside/, /item 1: 2'b1\?/);
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.queryByText(/Looks clean/)).not.toBeInTheDocument();
  });

  it("opcode-decoder: the casex column lists the range as three plain items and 3'b0x0 runs NOP there while case inside reaches default", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    expect(screen.getByRole("list", { name: "casex (op)" })).toBeInTheDocument();
    expect(codeText()).toContain("3'b100, 3'b101, 3'b110:");
    expect(codeText()).toContain("[3'b100:3'b110]:");
    // The note is printed once, under the code panel.
    expect(screen.getAllByText(/written as casex with plain items/).length).toBe(1);
    expect(screen.getByRole("button", { name: "op = 3'b0x0" })).toHaveAttribute("aria-pressed", "true");

    predict(/Under casex/, /item 1: NOP/);
    expect(screen.getAllByText(/Correct\./).length).toBe(1);
    predict(/Under case inside/, /the default item/);
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(screen.getAllByText(/written as casex with plain items/).length).toBe(1);
    const left = screen.getByRole("region", { name: "casex column" });
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(left).getByText(/matches and runs/).closest("li")?.textContent).toContain("3'b000");
    expect(within(right).getByText(/runs: no case item matched/)).toBeInTheDocument();
    expect(within(right).getAllByText(/§11\.4\.4/).length).toBeGreaterThan(0);
    // With a default the value does reach a place a testbench can report it.
    expect(within(right).getByText(/No real branch runs/)).toHaveTextContent(/The unknown stays visible: it reaches default, where a testbench can report it\./);
  });

  it("opcode-decoder: 3'b110 runs ALU in both columns and JUMP is marked 'matches, not run'", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    fireEvent.click(screen.getByRole("button", { name: "op = 3'b110" }));
    predict(/Under casex/, /item 3: ALU/);
    predict(/Under case inside/, /item 3: ALU/);
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(right).getByText(/matches, not run/).closest("li")?.textContent).toContain("3'b11?");
    expect(within(right).getAllByText(/OR across the item/).length).toBeGreaterThan(0);
  });

  it("the asymmetric wildcard rule and the set's outcome stay out of the frame until both predictions are in", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    expect(screen.queryByText(/Wildcards are asymmetric/)).not.toBeInTheDocument();
    expect(screen.queryByText(/run a real branch under casex/)).not.toBeInTheDocument();
    predict(/Under casex/, /item 1: 2'b10/);
    expect(screen.queryByText(/Wildcards are asymmetric/)).not.toBeInTheDocument();
    predict(/Under case inside/, "nothing runs");
    const note = screen.getByRole("note", { name: "About this item set" });
    expect(note).toHaveTextContent(/Wildcards are asymmetric/);
    expect(note).toHaveTextContent(/run a real branch under casex/);
  });

  it("wildcard-item with sel = 2'bx1: casex runs the item on an x at a known bit, and the note says so instead of 'only there' (§12.5.1)", () => {
    render(<DecisionLab mode="compare" preset="wildcard-item" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bx1" }));
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, "nothing runs");
    expect(screen.getAllByText(/Correct\./).length).toBe(2);
    expect(within(screen.getByRole("region", { name: "casex column" })).getByText(/^Result:/).parentElement?.textContent).toMatch(/Item 1 \(2'b1\?\) runs/);
    const note = screen.getByRole("note", { name: "About this item set" });
    expect(note).toHaveTextContent("case inside accepts a select x only there; casex accepts it at every bit (§12.5.1).");
    expect(note).not.toHaveTextContent(/the select's x is accepted only there/);
  });

  it("the reveal highlights the running line in both code panels and fills the mounted live line", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    const live = screen.getByTestId("decision-live-line");
    expect(live).toBeEmptyDOMElement();
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    predict(/Under casex/, /item 1: NOP/);
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(live).toBeEmptyDOMElement();
    predict(/Under case inside/, /the default item/);
    const active = Array.from(document.querySelectorAll('[aria-current="step"]')).map((l) => l.textContent ?? "");
    expect(active.length).toBe(2);
    expect(active[0]).toContain("3'b000:");
    expect(active[1]).toContain("default:");
    expect(live).toHaveTextContent(/^casex: .* case inside: /);
    // Only the short line is live: the columns are static.
    expect(screen.getByRole("region", { name: "casex column" }).querySelector("[aria-live]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "op = 3'b001" }));
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(live).toBeEmptyDOMElement();
  });
});
