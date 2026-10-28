import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PacketSorterGame from "@/components/curriculum/f2/PacketSorterGame";
import ScenarioSorter from "@/components/visuals/ScenarioSorter";

const option = (id: string) => screen.getByTestId(`sorter-option-${id}`);
const feedback = () => screen.getByTestId("sorter-sorter-feedback");

describe("ScenarioSorter: predict, then reveal", () => {
  it("hides every verdict until the learner commits a bin, then explains the pick and the answer", () => {
    render(<ScenarioSorter deck="verification-methods" />);
    expect(screen.getByRole("region", { name: "Verification method sorting practice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which method answers it?" })).toBeInTheDocument();
    expect(screen.getByText("Practice · card 1 of 9")).toBeInTheDocument();
    expect(screen.queryByTestId("sorter-sorter-feedback")).not.toBeInTheDocument();
    expect(screen.queryByText(/best choice/)).not.toBeInTheDocument();
    expect(screen.getByTestId("sorter-next")).toBeDisabled();
    // The commit is the prediction, marked with the PREDICT chip of the visual language.
    expect(screen.getByTestId("sorter-predict").textContent).toBe("PredictCommit one pick. The answer stays hidden until you do.");

    const bins = within(screen.getByRole("group", { name: "Bins" })).getAllByRole("button");
    expect(bins).toHaveLength(7);
    for (const b of bins) expect(b).toHaveAttribute("type", "button");

    fireEvent.click(option("constrained-random"));
    expect(screen.queryByTestId("sorter-predict")).not.toBeInTheDocument();
    expect(feedback().textContent).toMatch(/^Not the best fit\. A random run checks the rule only on the cycles it happens to reach/);
    expect(feedback().textContent).toMatch(/Best choice, Formal property verification: A proof covers every reachable state/);
    expect(screen.getByTestId("sorter-source").textContent).toBe("Source: Industry practice (F1B, How the methods combine)");
    expect(option("formal").textContent).toMatch(/✓ best choice/);
    expect(option("constrained-random").textContent).toMatch(/✕ your choice/);
    expect(option("constrained-random")).toHaveAttribute("aria-pressed", "true");
    for (const b of bins) expect(b).toBeDisabled();
    expect(screen.getByTestId("sorter-next")).toBeEnabled();
  });

  it("moves focus to the verdict, which opens the reveal; Tab reaches 'Why not the others?', then Next", async () => {
    const user = userEvent.setup();
    render(<ScenarioSorter deck="sv-features" cards={["legal-bursts", "one-type"]} />);
    await user.click(option("covergroup"));
    // Not the Next button: it sits below the picture, grid and code, so focusing it would
    // scroll the verdict out of view on a phone.
    const verdict = screen.getByTestId("sorter-verdict");
    expect(verdict).toHaveFocus();
    expect(verdict).toHaveAttribute("tabindex", "-1");
    expect(feedback().firstElementChild?.nextElementSibling).toBe(verdict);
    expect(verdict.textContent).toMatch(/^Not the best fit\. A covergroup records what was generated/);
    // Focus already lands on the verdict, so it is not also in a live region (no double reading).
    expect(verdict.closest("[aria-live]")).toBeNull();
    expect(screen.getByTestId("sorter-live")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("sorter-live").textContent).toBe("");
    await user.tab();
    expect(screen.getByTestId("sorter-others-toggle")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("sorter-next")).toHaveFocus();
  });

  it("'Why not the others?' lists every option the reveal has not explained, collapsed until asked", async () => {
    const user = userEvent.setup();
    render(<ScenarioSorter deck="verification-methods" cards={["mutex"]} />);
    fireEvent.click(option("constrained-random"));
    const toggle = screen.getByTestId("sorter-others-toggle");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.textContent).toBe("▸ Why not the others?");
    const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(panel).toBeInTheDocument();
    expect(panel).not.toBeVisible();
    expect(panel?.textContent).toBe("");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();
    // Seven bins: the pick (constrained-random) and the best (formal) are explained above.
    const items = within(panel as HTMLElement).getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-testid"))).toEqual([
      "sorter-others-directed",
      "sorter-others-emulation",
      "sorter-others-equivalence",
      "sorter-others-cdc",
      "sorter-others-power-aware",
    ]);
    for (const li of items) expect(li.lastElementChild?.textContent?.length).toBeGreaterThan(20);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel?.textContent).toBe("");
  });

  it("'Why not the others?' marks a partly right option and lists the second step's other options", async () => {
    const user = userEvent.setup();
    render(<ScenarioSorter deck="verification-methods" cards={["async-fifo"]} />);
    fireEvent.click(option("cdc"));
    fireEvent.click(screen.getByTestId("sorter-followup-formal"));
    await user.click(screen.getByTestId("sorter-others-toggle"));
    expect(screen.getByTestId("sorter-others-formal").textContent).toMatch(/^Formal property verification◐ partly rightHalf of the answer/);
    expect(screen.queryByTestId("sorter-others-cdc")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sorter-others-step2-formal")).not.toBeInTheDocument();
    expect(screen.getByTestId("sorter-others-step2-constrained-random").textContent).toMatch(/^Step 2: Constrained-random simulationRTL simulation does not model metastability/);
    expect(screen.getByTestId("sorter-others-step2-equivalence").textContent).toMatch(/^Step 2: Equivalence checkingEquivalence checking proves/);
  });

  it("closes 'Why not the others?' again on the next card", async () => {
    const user = userEvent.setup();
    render(<ScenarioSorter deck="ipc-tools" cards={["every-txn", "two-ahead"]} />);
    fireEvent.click(option("event"));
    await user.click(screen.getByTestId("sorter-others-toggle"));
    expect(screen.getByTestId("sorter-others-toggle")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.queryByTestId("sorter-others")).not.toBeInTheDocument();
    fireEvent.click(option("mailbox"));
    expect(screen.getByTestId("sorter-others-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the learner's own pick for every verdict, so two ◐ options with the same text stay apart", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["reset-waiting"]} />);
    fireEvent.click(option("mailbox"));
    expect(option("mailbox").textContent).toMatch(/◐ partly right• your pick/);
    expect(option("bounded-mailbox").textContent).toMatch(/◐ partly right$/);
    expect(screen.getByTestId("sorter-option-mailbox-pick")).toBeInTheDocument();
    expect(screen.queryByTestId("sorter-option-bounded-mailbox-pick")).not.toBeInTheDocument();
    // A semaphore with no keys also wakes the one waiting checker (§15.3): partly right, as on late-monitor.
    expect(option("semaphore").textContent).toMatch(/◐ partly right$/);
  });

  it("marks a correct pick as the learner's too", () => {
    render(<ScenarioSorter deck="verification-methods" cards={["rare-bin"]} />);
    fireEvent.click(option("directed"));
    expect(option("directed").textContent).toMatch(/✓ best choice• your pick/);
    expect(option("formal").textContent).toMatch(/✓ best choice$/);
  });

  it("credits either of two correct bins and names the other", () => {
    render(<ScenarioSorter deck="verification-methods" cards={["rare-bin"]} />);
    fireEvent.click(option("formal"));
    expect(feedback().textContent).toMatch(/^Correct\. Formal explores every reachable state/);
    expect(feedback().textContent).toMatch(/Also correct, Directed test: Aim at the hole/);
    expect(option("directed").textContent).toMatch(/✓ best choice/);
  });

  it("grades a partly correct bin with ◐ and shows the best one", () => {
    render(<ScenarioSorter deck="verification-methods" cards={["async-fifo"]} />);
    fireEvent.click(option("formal"));
    expect(feedback().textContent).toMatch(/^Partly right\. Half of the answer/);
    expect(feedback().textContent).toMatch(/Best choice, CDC structural analysis:/);
    expect(option("formal").textContent).toMatch(/◐ partly right/);
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.getByTestId("sorter-score").textContent).toBe("You sorted 0 of 1 cards correctly.");
    expect(screen.getByTestId("sorter-partial-count").textContent).toBe("1 more was partly correct.");
    expect(screen.getByTestId("sorter-summary-async-fifo").textContent).toMatch(/^◐ Partly correct: /);
  });
});

describe("ScenarioSorter: a second step after some bins", () => {
  it("asks for the mailbox bound before revealing anything, and a wrong bound is partly correct", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["two-ahead"]} />);
    fireEvent.click(option("bounded-mailbox"));
    expect(screen.queryByTestId("sorter-sorter-feedback")).not.toBeInTheDocument();
    expect(screen.getByTestId("sorter-locked").textContent).toMatch(/Locked in: Bounded mailbox/);
    expect(screen.getByTestId("sorter-next")).toBeDisabled();
    expect(option("bounded-mailbox").textContent).not.toMatch(/best choice/);

    const step2 = screen.getByRole("group", { name: /Step 2.*Which bound\?/ });
    expect(within(step2).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("sorter-followup-new-1")).toHaveFocus();

    fireEvent.click(screen.getByTestId("sorter-followup-new-3"));
    expect(feedback().textContent).toMatch(/^Partly right\. The bound sets how far the producer can run ahead/);
    expect(feedback().textContent).toMatch(/Your step 2: mailbox #\(item_t\) gen2drv = new\(3\);Bound 3 lets three items wait/);
    expect(feedback().textContent).toMatch(/Best step 2: mailbox #\(item_t\) gen2drv = new\(2\);Two waiting items fill it/);
    expect(screen.getByTestId("sorter-followup-new-2").textContent).toMatch(/✓ best choice/);

    fireEvent.click(screen.getByTestId("sorter-next"));
    const summary = screen.getByTestId("sorter-summary-two-ahead");
    expect(summary.textContent).toMatch(
      /You chose Bounded mailbox then mailbox #\(item_t\) gen2drv = new\(3\); · best is Bounded mailbox then mailbox #\(item_t\) gen2drv = new\(2\);Two waiting items/,
    );
    expect(summary.textContent).not.toMatch(/;;|;\./);
    // Code labels render as code chips, so their semicolons never run into the sentence.
    const pick = screen.getByTestId("sorter-summary-two-ahead-pick");
    expect(within(pick).getByText("mailbox #(item_t) gen2drv = new(3);").tagName).toBe("CODE");
    expect(within(screen.getByTestId("sorter-summary-two-ahead-best")).getByText("mailbox #(item_t) gen2drv = new(2);").tagName).toBe("CODE");
  });

  it("skips the second step when the first pick is a different bin, and still names the right second step", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["two-ahead"]} />);
    fireEvent.click(option("mailbox"));
    expect(screen.queryByTestId("sorter-followup")).not.toBeInTheDocument();
    expect(feedback().textContent).toMatch(/^Not the best fit\. Unbounded: put\(\) never blocks \(§15\.4\.1\)/);
    expect(feedback().textContent).toMatch(/Best choice, Bounded mailbox: The bound sets how far/);
    expect(feedback().textContent).toMatch(/Best step 2: mailbox #\(item_t\) gen2drv = new\(2\);Two waiting items fill it/);
  });

  it("names the right key count when a semaphore card gets a different bin", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["log-file"]} />);
    fireEvent.click(option("event"));
    expect(feedback().textContent).toMatch(/^Not the best fit\. An event cannot make processes queue/);
    expect(feedback().textContent).toMatch(/Best step 2: semaphore log_key = new\(1\);One key/);
  });

  it("a correct second step needs no 'Best step 2' line", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["late-monitor"]} />);
    fireEvent.click(option("level-flag"));
    // Focus lands on the first step-2 option, which is not the answer.
    expect(screen.getByTestId("sorter-followup-at-change")).toHaveFocus();
    fireEvent.click(screen.getByTestId("sorter-followup-wait-level"));
    expect(feedback().textContent).toMatch(/^Correct\./);
    expect(feedback().textContent).not.toMatch(/Best step 2/);
  });

  it("a mailbox for the late monitor is partly right: peek() leaves the message for everyone (§15.4.7)", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["late-monitor"]} />);
    fireEvent.click(option("mailbox"));
    expect(feedback().textContent).toMatch(/^Partly right\. Works with peek\(\)/);
    expect(option("mailbox").textContent).toMatch(/◐ partly right/);
    expect(feedback().textContent).toMatch(/Best step 2: wait \(rst_done\);Level-sensitive/);
  });

  it("the async FIFO asks for the taxonomy's second method after CDC analysis, then moves focus to the verdict", () => {
    render(<ScenarioSorter deck="verification-methods" cards={["async-fifo"]} />);
    fireEvent.click(option("cdc"));
    const step2 = screen.getByRole("group", { name: /Step 2.*pairs a second method/ });
    expect(within(step2).getAllByRole("button").map((b) => b.textContent)).toEqual(["Constrained-random simulation", "Formal property verification", "Equivalence checking"]);
    fireEvent.click(screen.getByTestId("sorter-followup-formal"));
    expect(screen.getByTestId("sorter-verdict")).toHaveFocus();
    expect(feedback().textContent).toMatch(/^Correct\. Structural CDC analysis checks every signal that crosses/);
    expect(feedback().textContent).toMatch(/Your step 2: Formal property verificationThe taxonomy lists CDC structural analysis and formal/);
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.getByTestId("sorter-summary-async-fifo").textContent).toMatch(/You chose CDC structural analysis then Formal property verification/);
  });

  it("the right key count completes a correct answer", () => {
    render(<ScenarioSorter deck="ipc-tools" cards={["shared-bus"]} />);
    fireEvent.click(option("semaphore"));
    fireEvent.click(screen.getByTestId("sorter-followup-new-1"));
    expect(feedback().textContent).toMatch(/^Correct\./);
    expect(screen.getByTestId("sorter-progress").textContent).toBe("1 correct of 1 answered");
  });
});

describe("ScenarioSorter: deck-specific reveals", () => {
  it("sv-features shows the constraint picture only after the commit, and places the card in its half", () => {
    render(<ScenarioSorter deck="sv-features" cards={["legal-bursts", "one-type"]} />);
    expect(screen.queryByTestId("sorter-anchor")).not.toBeInTheDocument();
    fireEvent.click(option("covergroup"));
    const anchor = screen.getByTestId("sorter-anchor");
    expect(within(anchor).getByRole("img").getAttribute("aria-label")).toMatch(/band \[1:99\] is shaded, and all 10 randomized values/);
    const grid = screen.getByTestId("sorter-grid");
    expect(within(grid).getByRole("columnheader", { name: "Verification half" })).toBeInTheDocument();
    // sv-features has no row label: the corner is a hidden cell, not an empty column header.
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Verification half", "Design half"]);
    expect(within(grid).getByText(/only legal bursts/).closest("td")).toBe(within(grid).getAllByRole("cell")[0]);

    fireEvent.click(screen.getByTestId("sorter-next"));
    fireEvent.click(option("logic"));
    expect(screen.queryByTestId("sorter-anchor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sorter-next"));
    const split = screen.getByTestId("sorter-split");
    expect(within(split).getAllByRole("cell")[1].textContent).toMatch(/✓ Correct: one 4-state type/);
    expect(within(split).getAllByRole("cell")[0].textContent).toMatch(/✕ Incorrect: only legal bursts/);
  });

  it("sv-features assertion picture states each attempt's outcome", () => {
    render(<ScenarioSorter deck="sv-features" cards={["gnt-within-3"]} />);
    fireEvent.click(option("assertion"));
    expect(within(screen.getByTestId("sorter-anchor")).getByRole("img").getAttribute("aria-label")).toMatch(
      /Attempt from edge 1 passes at edge 3\. Attempt from edge 5 fails at edge 8\. At the other 8 edges req is 0/,
    );
  });

  it("the coverage picture for lengths 1 to 16 says how its two-bin example maps to one bin per length (§19.5.1)", () => {
    render(<ScenarioSorter deck="sv-features" cards={["burst-lengths"]} />);
    fireEvent.click(option("assertion"));
    expect(feedback().textContent).toMatch(/^Not the best fit\. An assert statement fails on a rule but records no value bins/);
    expect(screen.getByTestId("sorter-anchor-note").textContent).toMatch(/bins len\[\] = \{\[1:16\]\};, one bin per length \(§19\.5\.1\)/);
    expect(screen.getByTestId("sorter-anchor-note").closest("figcaption")).not.toBeNull();
  });

  it("always_comb shows the 'should warn' caveat after the reveal", () => {
    render(<ScenarioSorter deck="sv-features" cards={["latch"]} />);
    expect(screen.queryByTestId("sorter-caveat")).not.toBeInTheDocument();
    fireEvent.click(option("always_comb"));
    expect(screen.getByTestId("sorter-caveat").textContent).toMatch(/Tools should warn \(§9\.2\.2\.2\), not a guarantee/);
  });

  it("uvm-name-layers reveals the defining file of a library-only name", () => {
    render(<ScenarioSorter deck="uvm-name-layers" cards={["uvm-macros-svh"]} />);
    expect(screen.queryByTestId("sorter-defined-in")).not.toBeInTheDocument();
    fireEvent.click(option("ieee-1800-2"));
    expect(feedback().textContent).toMatch(/^Not the best fit\. The standard defines the macros themselves \(Annex B\) but names no file/);
    expect(screen.getByTestId("sorter-defined-in").textContent).toMatch(/^Defined in: uvm-core 2020\.3\.1, src\/uvm_macros\.svh/);
  });

  it("uvm-compile-triage draws the stack with the missing layer struck out", () => {
    render(<ScenarioSorter deck="uvm-compile-triage" cards={["no-package"]} />);
    expect(screen.getByText(/Log \(generic wording: real message text is tool-dependent\)/)).toBeInTheDocument();
    fireEvent.click(option("import"));
    const layers = within(screen.getByRole("list", { name: "Compile stack, top layer first" })).getAllByRole("listitem");
    expect(layers.map((l) => l.textContent)).toEqual([
      "Your classes✓ present",
      "import uvm_pkg::*;✓ present",
      '`include "uvm_macros.svh"✓ present',
      "uvm-core compiled (uvm_pkg)struck out: ✕ not compiled into this run",
      "IEEE 1800 simulator✓ present",
    ]);
  });

  it("regression-log runs the matcher on each line only after the reveal and fills the 2x2", () => {
    render(<ScenarioSorter deck="regression-log" cards={["tool-prefix", "rtl-assertion"]} />);
    const log = screen.getByTestId("sorter-log");
    expect(log.textContent).not.toMatch(/matcher/);
    fireEvent.click(option("false-alarm"));
    expect(screen.getByTestId("sorter-log").textContent).toMatch(/No line matches: the matcher rejects this log\./);
    const rejects = within(screen.getByTestId("sorter-grid")).getByRole("rowheader", { name: "rejects it" }).closest("tr") as HTMLElement;
    expect(within(rejects).getAllByRole("cell")[0].textContent).toMatch(/'# ' tool prefix/);

    fireEvent.click(screen.getByTestId("sorter-next"));
    fireEvent.click(option("trusted-pass"));
    expect(feedback().textContent).toMatch(/^Partly right\. This cell gets the matcher right but not the run: /);
    expect(screen.getByTestId("sorter-log").textContent).toMatch(/PASS=14 FAIL=0✓ matches \^PASS=\\d\+ FAIL=0\$/);
    fireEvent.click(screen.getByTestId("sorter-next"));
    const accepts = within(screen.getByTestId("sorter-split")).getByRole("rowheader", { name: "accepts it" }).closest("tr") as HTMLElement;
    expect(within(accepts).getAllByRole("cell")[1].textContent).toMatch(/◐ Partly correct: RTL \$error beside PASS=14 FAIL=0/);
  });

  it("regression-log lays its four bins out as the 2x2 they stand for, row by row in the axis order", () => {
    render(<ScenarioSorter deck="regression-log" cards={["crash"]} />);
    const group = screen.getByRole("group", { name: "Bins" });
    expect(group).toHaveClass("grid-cols-2");
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Accepted, really passed",
      "Accepted, did not pass",
      "Rejected, really passed",
      "Rejected, did not pass",
    ]);
  });

  it("other decks keep the flowing grid, including sv-features, whose axis is one row", () => {
    render(<ScenarioSorter deck="sv-features" cards={["one-type"]} />);
    expect(screen.getByRole("group", { name: "Bins" })).not.toHaveClass("grid-cols-2");
  });

  it("each sv-features picture names what it draws; only the constraint and coverage pictures say Packet example", () => {
    const heading = (cardId: string, pick: string) => {
      const { unmount } = render(<ScenarioSorter deck="sv-features" cards={[cardId]} />);
      fireEvent.click(option(pick));
      const text = screen.getByTestId("sorter-anchor-heading").textContent;
      unmount();
      return text;
    };
    expect(heading("legal-bursts", "constraint")).toBe("◇ Picture: the Packet example's length constraint");
    expect(heading("burst-lengths", "covergroup")).toBe("◇ Picture: coverage of the Packet example's length");
    for (const [cardId, pick] of [
      ["gnt-within-3", "assertion"],
      ["reuse-driver", "class"],
      ["bus-bundle", "interface"],
      ["share-types", "package"],
    ]) {
      expect(heading(cardId, pick), cardId).not.toMatch(/Packet example/);
    }
  });

  it("the constraint picture says randomize() assigns values; it returns only a status (§18.6.1)", () => {
    render(<ScenarioSorter deck="sv-features" cards={["legal-bursts"]} />);
    fireEvent.click(option("constraint"));
    const caption = within(screen.getByTestId("sorter-anchor")).getByText(/every value randomize\(\)/);
    expect(caption.closest("figcaption")?.textContent).toMatch(/every value randomize\(\) assigns to length lies in the band\./);
    expect(caption.closest("figcaption")?.textContent).not.toMatch(/returns/);
  });

  it("regression-log: with reset_dut() deleted, the log starts at 0 ns", () => {
    render(<ScenarioSorter deck="regression-log" cards={["zero-checks"]} />);
    const lines = within(screen.getByTestId("sorter-log")).getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual(["0 ns TEST smoke", "35 ns TEST corners", "115 ns TEST gaps", "PASS=0 FAIL=0"]);
  });

  it("function-body shows the calling-thread proviso for a nonblocking assignment", () => {
    render(<ScenarioSorter deck="function-body" cards={["nba"]} />);
    fireEvent.click(option("legal"));
    expect(feedback().textContent).toMatch(/^Correct\./);
    expect(screen.getByTestId("sorter-caveat").textContent).toMatch(/provided the calling thread comes from an initial or always procedure.*the tool shall issue an error \(§13\.4\.4\)/);
  });
});

describe("ScenarioSorter: props, flow and errors", () => {
  it("keeps the lesson's card order, honours a title, and moves focus to each new prompt", () => {
    render(<ScenarioSorter deck="task-or-function" cards={["summary", "handshake"]} title="Pick the subroutine" />);
    expect(screen.getByRole("heading", { name: "Pick the subroutine" })).toBeInTheDocument();
    expect(screen.getByText("Practice · card 1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("sorter-sorter-prompt").textContent).toMatch(/end-of-test summary/);
    fireEvent.click(option("void"));
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.getByTestId("sorter-sorter-prompt").textContent).toMatch(/valid and ready/);
    expect(screen.getByTestId("sorter-sorter-prompt")).toHaveFocus();
    expect(screen.getByTestId("sorter-next").textContent).toBe("See results");
    fireEvent.click(option("task"));
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.getByRole("heading", { name: "Pick the subroutine: results" })).toBeInTheDocument();
    expect(screen.getByTestId("sorter-score").textContent).toBe("You sorted 2 of 2 cards correctly.");
    expect(screen.getByTestId("sorter-score")).toHaveFocus();
    expect(screen.getByTestId("sorter-sorter-summary").textContent).toMatch(/Every pick matched the answer\./);
    // Focus already moves to the score, so the whole summary is not a live region.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("sorter-sorter-summary").closest("[aria-live]")).toBeNull();

    fireEvent.click(screen.getByTestId("sorter-restart"));
    expect(screen.getByTestId("sorter-sorter-prompt").textContent).toMatch(/end-of-test summary/);
    // restart() asks for focus on the first prompt, as Next does.
    expect(screen.getByTestId("sorter-sorter-prompt")).toHaveFocus();
    expect(screen.getByTestId("sorter-next")).toBeDisabled();
    expect(screen.getByTestId("sorter-progress").textContent).toBe("0 correct of 0 answered");
  });

  it("names the subject of a generic prompt: the code block is the prompt's description", () => {
    render(<ScenarioSorter deck="uvm-name-layers" cards={["run-test", "version-post-2017"]} />);
    const prompt = screen.getByTestId("sorter-sorter-prompt");
    expect(prompt.textContent).toBe("Which document defines this name?");
    const subject = document.getElementById(prompt.getAttribute("aria-describedby") ?? "");
    expect(subject?.textContent).toBe("run_test");
    fireEvent.click(option("ieee-1800"));
    expect(feedback().textContent).toMatch(/^Not the best fit\. IEEE 1800-2023 defines no UVM task\. run_test is UVM's global task/);
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(document.getElementById(screen.getByTestId("sorter-sorter-prompt").getAttribute("aria-describedby") ?? "")?.textContent).toBe("`UVM_VERSION_POST_2017");
    fireEvent.click(option("ieee-1800"));
    expect(feedback().textContent).toMatch(/^Not the best fit\. The language defines `define and `ifdef, the mechanism/);
    expect(feedback().textContent).not.toMatch(/after uvm_pkg is compiled/);
  });

  it("a regression log is the prompt's description too; a card with neither code nor log has none", () => {
    const { unmount } = render(<ScenarioSorter deck="regression-log" cards={["crash"]} />);
    const prompt = screen.getByTestId("sorter-sorter-prompt");
    expect(document.getElementById(prompt.getAttribute("aria-describedby") ?? "")).toBe(screen.getByTestId("sorter-log"));
    unmount();
    render(<ScenarioSorter deck="task-or-function" cards={["handshake"]} />);
    expect(screen.getByTestId("sorter-sorter-prompt")).not.toHaveAttribute("aria-describedby");
  });

  it("the default function-body order mixes legal and illegal statements", () => {
    render(<ScenarioSorter deck="function-body" />);
    expect(screen.getByText("#10;")).toBeInTheDocument();
    fireEvent.click(option("illegal"));
    fireEvent.click(screen.getByTestId("sorter-next"));
    expect(screen.getByText(/^flag <= 1;\s+\/\/ flag is a module variable$/)).toBeInTheDocument();
  });

  it("a single-line message wraps on a phone; multi-line code keeps its layout", () => {
    const { unmount } = render(<ScenarioSorter deck="uvm-compile-triage" cards={["undefined-macro"]} />);
    const message = screen.getByText("Error: my_test.sv(4): macro 'uvm_component_utils' is not defined").closest("pre");
    expect(message).toHaveClass("whitespace-pre-wrap", "break-words");
    unmount();
    render(<ScenarioSorter deck="function-body" cards={["fork-join"]} />);
    const code = document.getElementById(screen.getByTestId("sorter-sorter-prompt").getAttribute("aria-describedby") ?? "")?.querySelector("pre");
    expect(code?.textContent).toMatch(/\n/);
    expect(code).not.toHaveClass("whitespace-pre-wrap");
  });

  it("offers only the bins a lesson asks for", () => {
    render(
      <ScenarioSorter
        deck="verification-methods"
        cards={["mutex", "bring-up", "mixed-traffic", "boot-os", "netlist"]}
        bins={["directed", "constrained-random", "formal", "emulation", "equivalence"]}
      />,
    );
    const bins = within(screen.getByRole("group", { name: "Bins" })).getAllByRole("button");
    expect(bins.map((b) => b.textContent)).toEqual(["Directed test", "Constrained-random simulation", "Formal property verification", "Emulation or FPGA prototyping", "Equivalence checking"]);
    expect(screen.queryByTestId("sorter-option-cdc")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sorter-option-power-aware")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Practice · card 1 of 5")).toBeInTheDocument();
  });

  it("reports an unknown bin and a card the kept bins cannot answer", () => {
    render(<ScenarioSorter deck="verification-methods" cards={["mutex", "retention"]} bins={["formal", "directed", "cdcc"]} />);
    const alert = screen.getByRole("alert").textContent;
    expect(alert).toMatch(/no bin "cdcc" in deck "verification-methods"\./);
    expect(alert).toMatch(/the bins kept hide every correct bin of "retention", so it is left out\./);
    expect(screen.getByText("Practice · card 1 of 1")).toBeInTheDocument();
  });

  it("uses the test-id prefix it is given", () => {
    render(<ScenarioSorter deck="task-or-function" cards={["handshake"]} testIdPrefix="tf" />);
    fireEvent.click(screen.getByTestId("tf-option-task"));
    expect(screen.getByTestId("tf-sorter-feedback").textContent).toMatch(/^Correct\./);
  });

  it("reports unknown card ids and an unknown deck instead of hiding them", () => {
    const { unmount } = render(<ScenarioSorter deck="ipc-tools" cards={["every-txn", "no-such-card"]} />);
    expect(screen.getByRole("alert").textContent).toMatch(/no card "no-such-card" in deck "ipc-tools"/);
    expect(screen.getByText("Practice · card 1 of 1")).toBeInTheDocument();
    unmount();
    // @ts-expect-error: an MDX typo arrives as an arbitrary string
    render(<ScenarioSorter deck="nope" />);
    expect(screen.getByRole("alert").textContent).toMatch(/unknown deck "nope"/);
  });

  it("PacketSorterGame is the containers deck with the packet prefix", () => {
    const { container: wrapper } = render(<PacketSorterGame />);
    const { container: direct } = render(<ScenarioSorter deck="containers" testIdPrefix="packet" />);
    expect(wrapper.innerHTML).toBe(direct.innerHTML);
    expect(within(wrapper).getByRole("group", { name: "Options" })).toBeInTheDocument();
  });

  it("PacketSorterGame keeps its promise that every option explains itself after you answer", () => {
    render(<PacketSorterGame />);
    fireEvent.click(screen.getByTestId("packet-option-queue"));
    // A correct pick explains itself; the two other structures are one toggle away.
    expect(screen.getByTestId("packet-sorter-feedback").textContent).toMatch(/^Correct\. push_back on arrival/);
    fireEvent.click(screen.getByTestId("packet-others-toggle"));
    expect(screen.getByTestId("packet-others-dynamic-array").textContent).toMatch(/^Dynamic arrayA dynamic array cannot grow one element at a time/);
    expect(screen.getByTestId("packet-others-associative-array").textContent).toMatch(/^Associative arrayIt works only if you invent sequence-number keys/);
  });
});
