import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DecisionLab, { DECISION_ASSUMPTIONS } from "@/components/visuals/DecisionLab";
import { COMPARE_SETS, DECISION_PRESETS, findCompareSet, findPreset, splitSentences } from "@/lib/sv-decision-model";

/** Answers the prompt whose question matches, then locks it in. Scoped, because the two prompts can offer the same options. */
function predict(question: RegExp, option: RegExp | string) {
  const legend = Array.from(document.querySelectorAll("legend")).find((l) => question.test(l.textContent ?? ""));
  if (!legend) throw new Error(`No prompt matching ${question}`);
  const fieldset = legend.closest("fieldset") as HTMLElement;
  fireEvent.click(within(fieldset).getByLabelText(option));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
}

/** Opens "Change the statement"; a no-op once it is open. */
function openFold() {
  const fold = screen.getByRole("button", { name: /Change the statement/ });
  if (fold.getAttribute("aria-expanded") !== "true") fireEvent.click(fold);
}

const radio = (group: string, name: string) => {
  // Item set stays outside the fold; everything that changes the statement is inside it.
  if (group !== "Item set") openFold();
  return within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
};
const liveLine = () => screen.getByTestId("decision-live-line");
/** On-screen matches: the live line is read out, not displayed. */
const shown = (text: RegExp) => screen.queryAllByText(text).filter((el) => !el.closest('[data-testid="decision-live-line"]'));
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
    expect(shown(/Correct\./).length).toBe(1);
    expect(screen.getByText(/What is reported\?/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Outcome by qualifier/ })).not.toBeInTheDocument();

    predict(/What is reported/, "nothing is reported");
    expect(shown(/Correct\./).length).toBe(2);
    expect(shown(/Exactly one case item matches/).length).toBe(1);
    expect(screen.getByRole("note", { name: "No violation" })).toHaveTextContent("Nothing reported");
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
    expect(shown(/Correct\./).length).toBe(1);
    predict(/What is reported/, "a no-match violation");
    const ticket = screen.getByRole("note", { name: "Violation ticket" });
    expect(ticket).toHaveTextContent("unique case: no case item matches");
    expect(ticket).toHaveTextContent(/§12\.5\.3/);
    // Both halves of §12.4.2.1: the check is evaluated when the statement executes, the report waits for the Observed region.
    expect(ticket).toHaveTextContent(/checked now, reported in the Observed region \(§12\.4\.2\.1, §12\.5\.3\.1\)/);
    expect(liveGridCell()?.textContent).toContain("nothing runs, report");
    expect(screen.getAllByText(/no match$/).length).toBe(3);
  });

  it("an if chain's ticket cites §12.4.2.1 only, since §12.5.3.1 covers case statements", () => {
    render(<DecisionLab preset="unique-if" />);
    fireEvent.click(screen.getByRole("button", { name: "req = 2'b11" }));
    revealBoth();
    const ticket = screen.getByRole("note", { name: "Violation ticket" });
    expect(ticket).toHaveTextContent("unique if: 2 conditions match");
    expect(ticket).toHaveTextContent(/checked now, reported in the Observed region \(§12\.4\.2\.1\)/);
    expect(ticket).not.toHaveTextContent(/§12\.5\.3\.1/);
    expect(liveLine()).toHaveTextContent(/Violation reported in the Observed region \(§12\.4\.2, §12\.4\.2\.1\)\./);
  });

  it("a wrong prediction is diagnosed: choosing 2'b00 for sel = xx explains the literal x comparison", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, /item 1: 2'b00/);
    expect(shown(/Not quite/).length).toBe(1);
    expect(screen.getAllByText(/compares x and z literally/).length).toBeGreaterThan(0);
    predict(/What is reported/, "nothing is reported");
    expect(shown(/Not quite/).length).toBe(2);
    expect(screen.getAllByText(/not silent/).length).toBeGreaterThan(0);
  });

  it("a default silences the no-match check and runs instead", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    openFold();
    fireEvent.click(screen.getByLabelText(/default item/));
    expect(codeText()).toContain("default:");
    predict(/Which case item runs/, /the default item/);
    expect(shown(/Correct\./).length).toBe(1);
    predict(/What is reported/, "a no-match violation");
    expect(shown(/Not quite/).length).toBe(1);
    expect(shown(/A default silences the missing-match check/).length).toBe(1);
    expect(shown(/No case item matches, but there is a default: it runs, and unique reports a missing match only when there is no default \(§12\.5, §12\.5\.3\)\./).length).toBe(1);
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
    expect(shown(/Correct\./).length).toBe(2);
    expect(shown(/unique0 does not report a missing match/).length).toBe(1);
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
    expect(shown(/Correct\./).length).toBe(1);
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
    expect(shown(/Not quite/).length).toBe(1);
    expect(screen.getAllByText(/first one in source order wins/).length).toBeGreaterThan(0);
    predict(/What is reported/, "an overlap violation");
    expect(screen.getAllByText(/first match wins/).length).toBeGreaterThan(0);
    expect(shown(/Correct\./).length).toBe(1);
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
    expect(shown(/Correct\./).length).toBe(2);
    expect(screen.getByRole("note", { name: "Violation ticket" })).toHaveTextContent("unique case: 2 case items match");
  });

  it("the bit editor keeps focus on the bit while it cycles, and any change re-arms the prediction", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    openFold();
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
    // The live region is already mounted, so its text is announced when it changes.
    const live = liveLine();
    expect(live).toHaveAttribute("aria-live", "polite");

    predict(/What is reported/, "nothing is reported");
    expect(liveLine()).toBe(live);
    expect(live).toHaveTextContent(/Item 2 \(2'b01\) runs/);
    expect(screen.getByText(/^Outcome:/).closest("[aria-live]")).toBeNull();
    // The detail (items, ticket, grid) is static: no live region wraps it.
    expect(screen.getByRole("table", { name: /Outcome by qualifier/ }).closest("[aria-live]")).toBeNull();
    expect(screen.getByRole("note", { name: "No violation" }).closest("[aria-live]")).toBeNull();
    // The grid no longer forces a minimum width, so its columns wrap instead of scrolling at 390 px.
    expect(screen.getByRole("table", { name: /Outcome by qualifier/ }).className).not.toMatch(/min-w-/);
  });

  it("re-arming the first prompt removes the second one again and the live line says so", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    predict(/What is reported/, "nothing is reported");
    expect(liveLine()).toHaveTextContent(/Item 2 \(2'b01\) runs/);
    fireEvent.click(radio("Qualifier", "priority"));
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(liveLine()).toHaveTextContent("Statement is now priority case, no default, prediction reset");
  });

  it("a preset's outcome stays hidden until both predictions are in, then appears inside the reveal", () => {
    render(<DecisionLab preset="lrm-unique-case" />);
    expect(screen.getByLabelText("Preset")).toHaveValue("lrm-unique-case");
    expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
    expect(screen.getByText(/declares bit \[2:0\] a; the lab uses logic so x can be tried/)).toBeInTheDocument();
    predict(/Which case item runs/, "nothing runs");
    expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
    predict(/What is reported/, "a no-match violation");
    // The first value's note speaks about that value; the whole example waits for the end of the walk.
    expect(screen.getByRole("note", { name: "About this value" })).toHaveTextContent("The standard names this value among those that cause a violation report (§12.5.3).");
    expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
  });

  it("the first prompt's feedback leaves the report to the second prompt: sel = xx under unique", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, "nothing runs");
    const feedback = shown(/Correct\./)[0].closest("p") as HTMLElement;
    expect(feedback).toHaveTextContent("Every case item fails: case (not casez or casex) compares x and z literally (§12.5), so nothing runs.");
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
    expect(screen.queryByRole("note", { name: "About this value" })).not.toBeInTheDocument();
    expect(screen.queryByText(/unique0 does not/)).not.toBeInTheDocument();

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

  it("the ticket and the grid come before the item cards, plain misses fold to one line, and the legend waits for a chip table on screen", () => {
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
    // Every chip table is folded, so a legend would explain nothing yet.
    expect(screen.queryByText(/1 match, 0 mismatch/)).not.toBeInTheDocument();
    const details = folded[0].parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    // A case compares every bit literally (§12.5): its chips are 1 or 0, so the legend lists nothing else.
    expect(screen.getByText(/1 match, 0 mismatch/).textContent).toBe("Chips: 1 match, 0 mismatch.");
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(screen.queryByText(/1 match, 0 mismatch/)).not.toBeInTheDocument();
  });

  it("the legend lists only the marks the chips draw: casez skips, a ? is noted, and a case edited from casez shows no wildcard", () => {
    render(<DecisionLab preset="casez-overlap" />);
    revealBoth();
    expect(screen.getByText(/1 match, 0 mismatch/).textContent).toBe("Chips: 1 match, 0 mismatch, – skipped. A ? in the source is written z here (same bit value).");
    // Under case the ? is a z compared literally (§12.5): nothing is skipped and nothing is a wildcard.
    fireEvent.click(radio("Statement form", "case"));
    revealBoth();
    expect(screen.queryByText(/1 match, 0 mismatch/)).not.toBeInTheDocument();
    const details = screen.getAllByText("fails at bit 0")[0].parentElement as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByText(/1 match, 0 mismatch/).textContent).toBe("Chips: 1 match, 0 mismatch. A ? in the source is written z here (same bit value).");
  });

  it("compare mode's one legend covers both columns: casex skips, case inside gives x", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    revealBoth();
    expect(screen.getByText(/1 match, 0 mismatch/).textContent).toBe("Chips: 1 match, 0 mismatch, x unknown (no match), – skipped.");
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
    expect(shown(/Correct\./).length).toBe(1);
    expect(screen.getAllByText(/skips bit 0/).length).toBeGreaterThan(0);
    predict(/Under case inside/, "nothing runs");
    expect(shown(/Correct\./).length).toBe(2);

    const left = screen.getByRole("region", { name: "casex column" });
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(left).getByText(/matches and runs/)).toBeInTheDocument();
    expect(within(left).getAllByText(/skipped, a do-not-care/).length).toBeGreaterThan(0);
    // sel[0] = x was skipped against the item's known 0: that is the hidden bug, and the wording is casex's (x and z).
    expect(within(left).getByText(/Looks clean/)).toHaveTextContent(/an unknown select ran a real branch, because casex skips x and z bits in the case expression too \(§12\.5\.1\)/);
    expect(within(right).getAllByText("x means no match").length).toBe(2);
    expect(within(right).getAllByText(/unknown, no match/).length).toBeGreaterThan(0);
    // No default and no qualifier: the column is silent, so the banner must not claim the unknown is visible (§12.5, §12.5.4).
    // The prompt and the x stamps already say x is no match, so the banner keeps only what makes the unknown visible.
    const banner = within(right).getByText(/No real branch runs/);
    expect(banner.textContent).toBe("✓ No real branch runs. To see the unknown, add a default that reports it or a unique or priority qualifier (§12.5.3).");
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
    expect(shown(/Correct\./).length).toBe(2);
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
    expect(shown(/Not quite/).length).toBe(1);
    expect(screen.getAllByText(/casez skips only z/).length).toBeGreaterThan(0);
  });

  it("the wildcard item set: 2'b1? accepts sel = 2'b1x in both columns, and the x1 value in neither", () => {
    render(<DecisionLab mode="compare" />);
    fireEvent.click(radio("Item set", "One item, 2'b1?"));
    expect(codeText()).toContain("2'b1?:");
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, /item 1: 2'b1\?/);
    expect(shown(/Correct\./).length).toBe(2);
    expect(screen.getAllByText(/wildcard/).length).toBeGreaterThan(0);
    // The match comes from the item's ?, which case inside accepts as well: nothing hides, so no warning fires.
    expect(within(screen.getByRole("region", { name: "case inside column" })).getByText(/matches and runs/)).toBeInTheDocument();
    expect(screen.queryByText(/Looks clean/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bx1" }));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, "nothing runs");
    expect(shown(/Correct\./).length).toBe(2);
    // sel = x1 against 2'b1?: casex skipped the select's x against the item's known 1, so the warning does fire here.
    expect(within(screen.getByRole("region", { name: "casex column" })).getByText(/Looks clean/)).toBeInTheDocument();
  });

  it("the wildcard item under casez: sel = 2'b1x matches through the item's ? in both columns and no warning fires", () => {
    render(<DecisionLab mode="compare" preset="wildcard-item" />);
    fireEvent.click(radio("Left column", "casez"));
    predict(/Under casez/, /item 1: 2'b1\?/);
    predict(/Under case inside/, /item 1: 2'b1\?/);
    expect(shown(/Correct\./).length).toBe(2);
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
    expect(shown(/Correct\./).length).toBe(1);
    predict(/Under case inside/, /the default item/);
    expect(shown(/Correct\./).length).toBe(2);
    expect(screen.getAllByText(/written as casex with plain items/).length).toBe(1);
    const left = screen.getByRole("region", { name: "casex column" });
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(left).getByText(/matches and runs/).closest("li")?.textContent).toContain("3'b000");
    expect(within(right).getByText(/runs: no case item matched/)).toBeInTheDocument();
    expect(within(right).getAllByText(/§11\.4\.4/).length).toBeGreaterThan(0);
    // With a default the value does reach a place a testbench can report it.
    expect(within(right).getByText(/No real branch runs/).textContent).toBe("✓ No real branch runs. The unknown stays visible: it reaches default, where a testbench can report it.");
  });

  it("opcode-decoder: 3'b110 runs ALU in both columns; a plain statement stopped there, so JUMP is marked 'would also match'", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    fireEvent.click(screen.getByRole("button", { name: "op = 3'b110" }));
    predict(/Under casex/, /item 3: ALU/);
    predict(/Under case inside/, /item 3: ALU/);
    expect(shown(/Correct\./).length).toBe(2);
    const right = screen.getByRole("region", { name: "case inside column" });
    expect(within(right).getByText(/would also match; the search stopped at the first match \(§12\.5\)/).closest("li")?.textContent).toContain("3'b11?");
    expect(within(right).queryByText(/matches, not run/)).not.toBeInTheDocument();
    expect(within(right).getAllByText(/OR across the item/).length).toBeGreaterThan(0);
  });

  it("the asymmetric wildcard rule stays out of the frame until both predictions are in, and the set's whole outcome until every value is tried", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    expect(screen.queryByText(/Wildcards are asymmetric/)).not.toBeInTheDocument();
    expect(screen.queryByText(/run a real branch under casex/)).not.toBeInTheDocument();
    predict(/Under casex/, /item 1: 2'b10/);
    expect(screen.queryByText(/Wildcards are asymmetric/)).not.toBeInTheDocument();
    predict(/Under case inside/, "nothing runs");
    const note = screen.getByRole("note", { name: "About this value" });
    expect(note).toHaveTextContent(/Wildcards are asymmetric/);
    expect(screen.queryByText(/run a real branch under casex/)).not.toBeInTheDocument();
  });

  it("wildcard-item with sel = 2'bx1: casex runs the item on an x at a known bit, and the note says so instead of 'only there' (§12.5.1)", () => {
    render(<DecisionLab mode="compare" preset="wildcard-item" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bx1" }));
    predict(/Under casex/, /item 1: 2'b1\?/);
    predict(/Under case inside/, "nothing runs");
    expect(shown(/Correct\./).length).toBe(2);
    expect(within(screen.getByRole("region", { name: "casex column" })).getByText(/^Result:/).parentElement?.textContent).toMatch(/Item 1 \(2'b1\?\) runs/);
    expect(screen.getByRole("note", { name: "About this value" })).toHaveTextContent("casex skips a select x at every bit, even against the item's fixed 1 (§12.5.1).");
  });

  it("the reveal highlights the running line in both code panels and fills the mounted live line", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    const live = liveLine();
    expect(live).toBeEmptyDOMElement();
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    predict(/Under casex/, /item 1: NOP/);
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(live).toHaveTextContent(/^Correct\. .* Next: predict the case inside column\.$/);
    predict(/Under case inside/, /the default item/);
    const active = Array.from(document.querySelectorAll('[aria-current="step"]')).map((l) => l.textContent ?? "");
    expect(active.length).toBe(2);
    expect(active[0]).toContain("3'b000:");
    expect(active[1]).toContain("default:");
    expect(live).toHaveTextContent(/^Correct\. casex: Item 1 \(NOP, 3'b000\) runs\. case inside: The default runs\.$/);
    // Only the short line is live: the columns are static.
    expect(screen.getByRole("region", { name: "casex column" }).querySelector("[aria-live]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "op = 3'b001" }));
    expect(document.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(live).toHaveTextContent("op is now 3'b001, prediction reset");
  });
});

/* ------------------------------------------------------------------ */

/** Skips both gates of the shown value. */
function revealBoth() {
  fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
  fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
}

const tryNext = () => screen.getByRole("button", { name: /Try next value/ });

describe("DecisionLab: the note speaks about the value on screen, and the walk ends with the whole lesson", () => {
  it("kata-c-4: revealing 1x says nothing about x1, and the closing line waits for every value", () => {
    render(<DecisionLab preset="kata-c-4" />);
    revealBoth();
    const note = screen.getByRole("note", { name: "About this value" });
    expect(note).toHaveTextContent("The item's ? makes bit 0 a wildcard, so the select's x there is accepted, silently (§11.4.6).");
    expect(note).not.toHaveTextContent(/x1/);
    expect(screen.queryByRole("note", { name: "What the values show" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Values tried: 1 of 4").length).toBeGreaterThan(0);

    for (let i = 2; i <= 3; i += 1) {
      fireEvent.click(tryNext());
      revealBoth();
      expect(screen.getAllByText(`Values tried: ${i} of 4`).length).toBeGreaterThan(0);
      expect(screen.queryByRole("note", { name: "What the values show" })).not.toBeInTheDocument();
    }
    fireEvent.click(tryNext());
    revealBoth();
    expect(screen.getAllByText("All 4 values tried").length).toBeGreaterThan(0);
    expect(screen.getByRole("note", { name: "What the values show" })).toHaveTextContent(/An x against a fixed bit gives x, x is no match, and unique reports the miss/);
  });

  it("lrm-unique-case: the standard's whole comment appears only after all eight values", () => {
    render(<DecisionLab preset="lrm-unique-case" />);
    for (let i = 1; i <= 7; i += 1) {
      revealBoth();
      expect(screen.queryByText(/values 3, 5, 6 and 7/)).not.toBeInTheDocument();
      fireEvent.click(tryNext());
    }
    revealBoth();
    expect(screen.getByRole("note", { name: "What the values show" })).toHaveTextContent("IEEE 1800-2023 §12.5.3: values 3, 5, 6 and 7 cause a violation report.");
  });

  it("casex-vs-inside: the note follows the value, and the Flow Control line waits for the whole list", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    revealBoth();
    expect(screen.getByRole("note", { name: "About this value" })).not.toHaveTextContent(/x1|xx/);
    expect(screen.queryByText(/sel = 1x, x1 and xx run a real branch/)).not.toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(tryNext());
      revealBoth();
    }
    expect(screen.getByRole("note", { name: "What the values show" })).toHaveTextContent("In the Flow Control table, sel = 1x, x1 and xx run a real branch under casex and match nothing under case inside.");
  });

  it("the casez toggle starts its own walk and gets its own closing line", () => {
    render(<DecisionLab mode="compare" preset="casex-vs-inside" />);
    revealBoth();
    fireEvent.click(radio("Left column", "casez"));
    expect(screen.getAllByText("Values tried: 0 of 5").length).toBe(1);
    for (let i = 0; i < 5; i += 1) {
      revealBoth();
      if (i < 4) fireEvent.click(tryNext());
    }
    expect(screen.getByRole("note", { name: "What the values show" })).toHaveTextContent("Of the listed values, under casez the columns differ only for sel = 2'b1z");
    // The walk stays complete while the learner builds another value, and the two notes must both hold there.
    fireEvent.click(screen.getByRole("button", { name: /^sel = 2'b1z/ }));
    openFold();
    const clickBit = (from: RegExp) => fireEvent.click(screen.getByRole("button", { name: from }));
    clickBit(/^sel\[1\] is 1/); // to x
    clickBit(/^sel\[1\] is x/); // to z
    clickBit(/^sel\[0\] is z/); // to 0
    clickBit(/^sel\[0\] is 0/); // to 1
    revealBoth();
    expect(screen.getByRole("note", { name: "About this value" })).toHaveTextContent("The columns differ on 2'bz1: casez skips every z bit of the select, at every item.");
    expect(screen.getByRole("note", { name: "What the values show" })).toHaveTextContent("Of the listed values, under casez the columns differ only for sel = 2'b1z");
  });

  it("the count belongs to the preset's own statement: an edited statement neither shows it nor adds to it", () => {
    render(<DecisionLab />);
    expect(screen.getByText("Values tried: 0 of 5")).toBeInTheDocument();
    fireEvent.click(radio("Qualifier", "priority"));
    expect(screen.queryByText(/Values tried/)).not.toBeInTheDocument();
    revealBoth();
    fireEvent.click(radio("Qualifier", "unique"));
    expect(screen.getByText("Values tried: 0 of 5")).toBeInTheDocument();
  });

  it("a tried value is marked on its chip, in text as well as with a glyph", () => {
    render(<DecisionLab />);
    revealBoth();
    expect(screen.getByRole("button", { name: /^sel = 2'b01\s*\(tried\)$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "sel = 2'b11" })).toHaveAttribute("aria-pressed", "false");
  });

  it("a value built bit by bit gets the generic note and does not count", () => {
    render(<DecisionLab />);
    openFold();
    fireEvent.click(screen.getByRole("button", { name: /^sel\[1\] is 0/ }));
    fireEvent.click(screen.getByRole("button", { name: /^sel\[1\] is 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^sel\[1\] is x/ }));
    revealBoth();
    expect(screen.getByRole("note", { name: "About this value" })).toHaveTextContent(/not on the list/);
    expect(screen.getAllByText("Values tried: 0 of 5").length).toBeGreaterThan(0);
  });
});

describe("DecisionLab: a screen-reader learner hears each prediction land and keeps focus", () => {
  it("the first commit fills the live line with the verdict, the correct feedback and what comes next, and gives no report away", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, "nothing runs");
    expect(liveLine()).toHaveTextContent("Correct. Every case item fails: case (not casez or casex) compares x and z literally (§12.5), so nothing runs. Next: what is reported?");

    predict(/What is reported/, "nothing is reported");
    expect(liveLine()).toHaveTextContent(/^Not quite\. No case item matches and there is no default, so nothing runs\. unique case: no case item matches\./);
  });

  it("a wrong first pick is said to be wrong, and a skip has no verdict", () => {
    const { unmount } = render(<DecisionLab />);
    predict(/Which case item runs/, /item 1: 2'b00/);
    expect(liveLine()).toHaveTextContent(/^Not quite\. 2'b01 matches bit for bit \(§12\.5\)\. Next: what is reported\?$/);
    unmount();
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(liveLine()).toHaveTextContent(/^2'b01 matches bit for bit \(§12\.5\)\. Next: what is reported\?$/);
  });

  it("coming back to a value does not bring back its old verdict", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 1: 2'b00/);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b11" }));
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b01" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(liveLine()).toHaveTextContent(/^2'b01 matches bit for bit/);
  });

  it("no first-commit announcement answers the report question, for any preset and value", () => {
    for (const p of DECISION_PRESETS) {
      const { unmount } = render(<DecisionLab preset={p.id} />);
      for (const body of p.selectOptions) {
        const name = `${p.config.selectName} = ${body.length}'b${body}`;
        const chip = screen.getByRole("button", { name: new RegExp(`^${name.replace(/[[\]]/g, "\\$&")}`) });
        fireEvent.click(chip);
        fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
        const text = (liveLine().textContent ?? "").replace("Next: what is reported?", "");
        expect(text, `${p.id} ${body}`).not.toMatch(/\breports?\b|\breported\b|\bviolation\b/);
      }
      unmount();
    }
  });

  it("focus moves to the second prompt after the first commit and to the outcome after the second, never to the body", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute("aria-label", "Second prediction");
    expect((document.activeElement as HTMLElement).textContent).toContain("What is reported?");
    predict(/What is reported/, "nothing is reported");
    expect(document.activeElement).toHaveAttribute("aria-label", "Outcome");
    expect((document.activeElement as HTMLElement).textContent).toMatch(/^Outcome: Item 2 \(2'b01\) runs\.$/);
  });

  it("a skip moves focus the same way", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(document.activeElement).toHaveAttribute("aria-label", "Second prediction");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(document.activeElement).toHaveAttribute("aria-label", "Outcome");
  });

  it("compare mode: the same focus walk, ending on the value's note", () => {
    render(<DecisionLab mode="compare" />);
    predict(/Under casex/, /item 1: 2'b10/);
    expect(document.activeElement).toHaveAttribute("aria-label", "Second prediction");
    predict(/Under case inside/, "nothing runs");
    expect(document.activeElement).toHaveAttribute("aria-label", "Outcome");
    expect((document.activeElement as HTMLElement).textContent).toContain("A row of the Flow Control table");
  });

  it("a change of value, statement or preset is announced, and the second prompt is gone in the same commit", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    openFold();
    const bit = screen.getByRole("button", { name: /^sel\[0\] is 1/ });
    fireEvent.click(bit);
    expect(liveLine()).toHaveTextContent("sel is now 2'b0x, prediction reset");
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    expect(liveLine()).toHaveTextContent("sel is now 2'bxx, prediction reset");
    fireEvent.click(screen.getByLabelText(/default item/));
    expect(liveLine()).toHaveTextContent("Statement is now unique case, with default, prediction reset");
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "one-hot" } });
    expect(liveLine()).toHaveTextContent(/^Preset is now One-hot select/);
  });

  it("pressing the chip of the value already shown does not re-arm or announce anything", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    const before = liveLine().textContent;
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b01" }));
    expect(liveLine().textContent).toBe(before);
    expect(screen.getByText(/What is reported\?/)).toBeInTheDocument();
  });
});

describe("DecisionLab: the question comes before the controls (visual-language rule 7)", () => {
  it("form, qualifier, default and bit editing sit behind one button; the preset, the values, the code and the question do not", () => {
    render(<DecisionLab />);
    const fold = screen.getByRole("button", { name: /Change the statement/ });
    expect(fold.tagName).toBe("BUTTON");
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold.className).toContain("min-h-10");
    expect(screen.queryByRole("radiogroup", { name: "Qualifier" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Statement form" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /default item/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Bits of sel/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Preset")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Values of sel to try" })).toBeInTheDocument();
    expect(screen.getByText(/Which case item runs/)).toBeInTheDocument();

    fireEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(fold.getAttribute("aria-controls") as string)).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Qualifier" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Bits of sel/ })).toBeInTheDocument();
    fireEvent.click(fold);
    expect(screen.queryByRole("radiogroup", { name: "Qualifier" })).not.toBeInTheDocument();
  });

  it("compare mode folds the left-column toggle and the bits, and keeps the item set and the values out", () => {
    render(<DecisionLab mode="compare" />);
    expect(screen.getByRole("radiogroup", { name: "Item set" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Values of sel to try" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Left column" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Bits of sel/ })).not.toBeInTheDocument();
  });

  it("the region label follows the left-column toggle", () => {
    render(<DecisionLab mode="compare" />);
    expect(screen.getByRole("region", { name: "Decision lab: casex versus case inside" })).toBeInTheDocument();
    fireEvent.click(radio("Left column", "casez"));
    expect(screen.getByRole("region", { name: "Decision lab: casez versus case inside" })).toBeInTheDocument();
  });
});

describe("DecisionLab: Try next value", () => {
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    vi.restoreAllMocks();
  });

  it("names the next value, moves on, re-arms, focuses the first prompt and scrolls it into view", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<DecisionLab />);
    revealBoth();
    const button = tryNext();
    expect(button).toHaveTextContent("Try next value: sel = 2'b11");
    expect(button.className).toContain("min-h-10");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "sel = 2'b11" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.queryByText(/What is reported\?/)).not.toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute("aria-label", "First prediction");
    expect((document.activeElement as HTMLElement).textContent).toContain("sel = 2'b11");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(liveLine()).toHaveTextContent("sel is now 2'b11, prediction reset");
  });

  it("is not on screen before the reveal, and it skips a value already tried", () => {
    render(<DecisionLab />);
    expect(screen.queryByRole("button", { name: /Try next value/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b11" }));
    revealBoth();
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b01" }));
    revealBoth();
    expect(tryNext()).toHaveTextContent("sel = 2'bxx");
  });

  it("works in compare mode", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    revealBoth();
    expect(tryNext()).toHaveTextContent("op = 3'b001");
    fireEvent.click(tryNext());
    expect(screen.getByRole("button", { name: "op = 3'b001" })).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).toHaveAttribute("aria-label", "First prediction");
  });
});

describe("DecisionLab: one statement of each fact, in the reveal as rendered", () => {
  /**
   * The sentences a sighted learner reads in the two prompts, with folded cards and screen-reader text left out.
   * The correct answer's paragraph opens with a label (PredictionPrompt), which is stripped so its first sentence compares as itself.
   */
  const visibleSentences = (root: HTMLElement): string[] => {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("details, .sr-only, table, pre, code").forEach((el) => {
      if (el.tagName === "CODE") el.replaceWith(el.textContent ?? "");
      else el.remove();
    });
    return Array.from(clone.querySelectorAll("p")).flatMap((p) => splitSentences((p.textContent ?? "").replace(/^Why the answer holds: /, "")));
  };

  it("visibleSentences reads the correct answer's first sentence without its label", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 1: 2'b00/);
    const region = document.querySelector("section[aria-label]") as HTMLElement;
    expect(visibleSentences(region)).toContain("2'b01 matches bit for bit (§12.5).");
    expect(visibleSentences(region).some((s) => s.startsWith("Why the answer holds"))).toBe(false);
  });

  const expectNoRepeat = (name: string) => {
    const region = document.querySelector("section[aria-label]") as HTMLElement;
    // A stamp and a clause beside it are a label on each card, not a sentence.
    // "Not quite." is a verdict word, and each compare column has its own Result line.
    const sentences = visibleSentences(region).filter((t) => t.endsWith(".") && t.length > 12 && !t.startsWith("Result:"));
    const repeated = sentences.filter((t, i) => sentences.indexOf(t) !== i);
    expect(repeated, name).toEqual([]);
  };

  it("no sentence appears twice for any preset and value, on a skip", () => {
    for (const p of DECISION_PRESETS) {
      const { unmount } = render(<DecisionLab preset={p.id} />);
      for (const body of p.selectOptions) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${p.config.selectName} = ${body.length}'b${body}`) }));
        revealBoth();
        expectNoRepeat(`${p.id} ${body}`);
      }
      unmount();
    }
  }, 60000);

  it("no sentence appears twice for any item set, value and left column, on a skip", () => {
    for (const s of COMPARE_SETS) {
      const { unmount } = render(<DecisionLab mode="compare" preset={s.id} />);
      for (const kind of ["casex", "casez"]) {
        fireEvent.click(radio("Left column", kind));
        for (const body of s.selectOptions) {
          fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${s.selectName} = ${body.length}'b${body.replace("?", "\\?")}`) }));
          revealBoth();
          expectNoRepeat(`${s.id} ${kind} ${body}`);
        }
      }
      unmount();
    }
  }, 60000);

  it("no sentence appears twice on wrong picks either: x in the select under case inside", () => {
    render(<DecisionLab preset="kata-c-4" />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bx1" }));
    predict(/Which case item runs/, /item 2/);
    predict(/What is reported/, "nothing is reported");
    expectNoRepeat("kata-c-4 x1 wrong");
    // The chosen option's reason is on screen, so the card does not say it again: the x cards keep their chips and the stamp.
    expect(screen.getAllByText("x means no match").length).toBe(2);
  });

  it("the unique no-match sentence is on screen once: in the feedback, not on the ticket; the timing is on the ticket only", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'bxx" }));
    predict(/Which case item runs/, "nothing runs");
    predict(/What is reported/, "a no-match violation");
    expect(shown(/unique reports when no case item matches and there is no default/).length).toBe(1);
    expect(screen.getByRole("note", { name: "Violation ticket" })).not.toHaveTextContent(/unique reports when/);
    expect(shown(/Observed region/).filter((el) => el.tagName === "P").length).toBe(1);
    expect(screen.getByText(/^Outcome:/).parentElement?.textContent).toBe("Outcome: Nothing runs.");
  });

  it("the running item's card does not repeat the explanation the feedback gave; its chips stay", () => {
    render(<DecisionLab />);
    predict(/Which case item runs/, /item 2: 2'b01/);
    predict(/What is reported/, "nothing is reported");
    expect(shown(/2'b01 matches bit for bit/).length).toBe(1);
    const card = screen.getByText(/matches and runs/).closest("li") as HTMLElement;
    expect(within(card).getByRole("table")).toBeInTheDocument();
  });

  it("the deferred report sits on the ticket and the compare result says only what ran", () => {
    render(<DecisionLab mode="compare" preset="opcode-decoder" />);
    revealBoth();
    const left = screen.getByRole("region", { name: "casex column" });
    expect(within(left).getByText(/^Result:/).parentElement?.textContent).toBe("Result: Item 1 (NOP, 3'b000) runs.");
  });
});

describe("DecisionLab: small wording, by form", () => {
  afterEach(() => vi.restoreAllMocks());

  it("an if chain's chip table and legend say literal; a case's say item", () => {
    render(<DecisionLab preset="lrm-priority-inside" />);
    fireEvent.click(radio("Statement form", "if-else-if"));
    fireEvent.click(screen.getByRole("button", { name: /^status = 3'b0x0/ }));
    revealBoth();
    expect(screen.getAllByRole("rowheader", { name: "literal" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("rowheader", { name: "item" })).not.toBeInTheDocument();
    expect(screen.getByText(/\? wildcard in the literal/)).toBeInTheDocument();
    fireEvent.click(radio("Statement form", "case inside"));
    revealBoth();
    expect(screen.getAllByRole("rowheader", { name: "item" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/\? wildcard in the item/)).toBeInTheDocument();
  });

  it("the catch-all's hint says when it runs; it does not say it matches", () => {
    render(<DecisionLab />);
    openFold();
    expect(screen.getByLabelText(/default item/).closest("label")).toHaveTextContent("runs when no item matches");
    expect(screen.queryByText(/matches every leftover value/)).not.toBeInTheDocument();
    fireEvent.click(radio("Statement form", "if-else-if"));
    expect(screen.getByLabelText(/final else/).closest("label")).toHaveTextContent("runs when no condition matches");
  });

  it("under plain or unique0 with a default, the no-match pick is not told a check was silenced", () => {
    render(<DecisionLab />);
    fireEvent.click(screen.getByRole("button", { name: "sel = 2'b11" }));
    fireEvent.click(radio("Qualifier", "unique0"));
    fireEvent.click(screen.getByLabelText(/default item/));
    predict(/Which case item runs/, /the default item/);
    predict(/What is reported/, "a no-match violation");
    expect(shown(/unique0 reports no missing match, with or without a default\./).length).toBe(1);
    expect(shown(/The default runs, and unique0 has no check for a missing match \(§12\.5\.3\)\./).length).toBe(1);
    expect(screen.queryByText(/silences/)).not.toBeInTheDocument();
    expect(liveGridCell()?.textContent).toContain("default runs, silent");
  });

  it("a later fitting item: unique marks it 'matches, not run'; priority says the search stopped", () => {
    render(<DecisionLab preset="casez-overlap" />);
    revealBoth();
    expect(screen.getByText(/matches, not run \(the first match wins\)/)).toBeInTheDocument();
    fireEvent.click(radio("Qualifier", "priority"));
    revealBoth();
    expect(screen.getByText(/would also match; the search stopped at the first match \(§12\.5\)/)).toBeInTheDocument();
    expect(screen.queryByText(/matches, not run/)).not.toBeInTheDocument();
  });

  it("the assumptions declare that a case violation may be reported at compile time (§12.5.3)", () => {
    expect(DECISION_ASSUMPTIONS.join(" ")).toMatch(/§12\.5\.3 also allows a case violation to be reported at compile time/);
  });

  it("a one-match plain statement does not speak of checks that fire", () => {
    render(<DecisionLab />);
    fireEvent.click(radio("Qualifier", "plain"));
    revealBoth();
    expect(shown(/a plain case has no checks/).length).toBe(1);
    expect(screen.queryByText(/neither check fires/)).not.toBeInTheDocument();
  });

  it("an unknown preset warns and shows the first preset, once, however often the lab renders", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<DecisionLab preset="not-a-preset" />);
    expect(screen.getByLabelText("Preset")).toHaveValue(findPreset(undefined).id);
    openFold();
    fireEvent.click(radio("Qualifier", "plain"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/unknown preset "not-a-preset"/);
  });

  it("a qualifier preset id in compare mode warns and shows the first item set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(<DecisionLab mode="compare" preset="one-hot" />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: findCompareSet(undefined).title })).toHaveAttribute("aria-checked", "true");
  });
});
