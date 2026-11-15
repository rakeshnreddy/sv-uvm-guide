import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScoreboardMatchingVisualizer from "@/components/visuals/ScoreboardMatchingVisualizer";
import { runPlainSvScoreboard } from "@/lib/scoreboard-model";

const lockIn = (label: string | RegExp, prompt = 0) => {
  fireEvent.click(screen.getAllByLabelText(label)[0]);
  fireEvent.click(screen.getAllByRole("button", { name: /lock in prediction/i })[prompt]);
};

describe("ScoreboardMatchingVisualizer", () => {
  it("hides the run until a prediction is locked in, then shows the verdict and the timeline", () => {
    render(<ScoreboardMatchingVisualizer />);
    expect(screen.queryByRole("img", { name: /Transaction timeline/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Scoreboard step playback controls/ })).not.toBeInTheDocument();

    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Transaction timeline/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation log")).toHaveTextContent("matched 5, errors 0 → PASS");
  });

  it("re-asks after a keyboard policy change and diagnoses the in-order false mismatch", () => {
    render(<ScoreboardMatchingVisualizer />);
    const policies = screen.getByRole("radiogroup", { name: "Matching policy" });
    fireEvent.keyDown(within(policies).getByRole("radio", { name: "Per-ID queues" }), { key: "ArrowLeft" });
    expect(within(policies).getByRole("radio", { name: "In-order queue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { name: /lock in prediction/i })[0]).toBeDisabled();

    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/false mismatch/).length).toBeGreaterThan(0);
  });

  it("steps through scoreboard writes with synchronized narration", () => {
    render(<ScoreboardMatchingVisualizer />);
    lockIn("PASS: no UVM_ERROR at all");
    const group = screen.getByRole("group", { name: /Scoreboard step playback controls/ });
    const slider = within(group).getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Predictor writes #1"));
    fireEvent.keyDown(within(group).getByRole("button", { name: /next scoreboard step/i }), { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("Predictor writes #2"));
    expect(screen.getByText(/joins the back of exp_q\[1\]/)).toBeInTheDocument();
  });

  it("a dropped response with check_phase off escapes as a PASS", () => {
    render(<ScoreboardMatchingVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Drops the last id-0 response" }));
    fireEvent.click(screen.getByLabelText("check_phase reports leftovers"));
    lockIn("PASS: no UVM_ERROR at all");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/PASS · bug escaped/)).toBeInTheDocument();
  });

  it("exhaustive check: only search-any lets the same-ID reorder escape", () => {
    render(<ScoreboardMatchingVisualizer />);
    lockIn("Search any match", 1);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Every DUT bug against every policy/ });
    const row = within(table).getByRole("rowheader", { name: "Swaps #1 and #3 (same ID)" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("bug escaped");
  });

  it("debug mode: find the overwrite line, then the per-ID fix is accepted and the in-order one rejected", () => {
    render(<ScoreboardMatchingVisualizer mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: `uvm_error\("SCB", \$sformatf\("Unexpected/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: expected\[t\.id\] = t;/ }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Use one queue for every ID/));
    expect(screen.getByText(/Rejected\. The correct DUT still fails/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Give each ID an ordered queue/));
    expect(screen.getByText(/Accepted\./)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------- */
/* variant="plain-sv": the F2B lesson's tracker                               */
/* ------------------------------------------------------------------------- */

/** Clicks "Run …" until a prediction is due (or the script ends). Returns how many calls ran. */
const runToPrompt = () => {
  let n = 0;
  for (;;) {
    const run = screen.queryByRole("button", { name: /^Run / });
    if (!run) return n;
    fireEvent.click(run);
    n += 1;
  }
};
/** Same as runToPrompt, for a page with several embeds: clicks every Run button until none is left. */
const runToPromptAll = () => {
  for (;;) {
    const runs = screen.queryAllByRole("button", { name: /^Run / });
    if (!runs.length) return;
    for (const r of runs) fireEvent.click(r);
  }
};
const predict = (group: RegExp, picks: string[]) => {
  const g = screen.getByRole("group", { name: group });
  for (const label of picks) fireEvent.click(within(g).getByLabelText(label));
  fireEvent.click(within(g).getByRole("button", { name: "Lock in prediction" }));
};

describe("ScoreboardMatchingVisualizer variant=plain-sv (F2B Make It Work)", () => {
  it("keeps the UVM framing out: the source is plain SV with INJECT_BUGS = 1, as in the lesson", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    const code = screen.getByRole("list", { name: /tb_top from Make It Work/ });
    expect(code).toHaveTextContent("localparam bit INJECT_BUGS = 1;");
    expect(code).toHaveTextContent("exp_by_id [int][$];");
    expect(code.textContent).not.toMatch(/uvm_|objection|check_phase/);
    expect(screen.getByLabelText("Simulation output")).toHaveTextContent("(nothing printed yet)");
  });

  it("runs the four add_expected calls, then gates check_actual(2, 32'hB1) behind a two-part prediction", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    expect(runToPrompt()).toBe(4);
    expect(screen.getByLabelText("exp_by_id[1]: A1, A2")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /Predict check_actual\(2, 32'hB1\)/ });
    const lock = within(group).getByRole("button", { name: "Lock in prediction" });
    expect(lock).toBeDisabled();
    // Nothing about the result is visible yet.
    expect(screen.queryByText(/Deleted keys/)?.parentElement).toHaveTextContent("None yet.");
    fireEvent.click(within(group).getByLabelText("match"));
    expect(lock).toBeDisabled();
    fireEvent.click(within(group).getByLabelText("Key 2"));
    fireEvent.click(lock);
    expect(screen.getAllByText(/^Correct\./)).toHaveLength(2);
    expect(screen.getByText(/deleted after/)).toHaveTextContent("key 2 deleted after check_actual(2, 32'hB1)");
  });

  it("a wrong prediction is diagnosed, and the answer explains the same-ID order rule", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    predict(/Predict check_actual\(2/, ["match", "Key 2"]);
    runToPrompt();
    predict(/Predict check_actual\(1, 32'hA2\)/, ["match", "Key 1"]);
    expect(screen.getAllByText(/^Not quite\./)).toHaveLength(2);
    expect(screen.getByText(/order within one ID is checked/)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation output")).toHaveTextContent("Error: MISMATCH id=1 exp=000000a1 act=000000a2");
  });

  it("final: counters stay hidden until the SCB_SUMMARY prediction, then the lesson's line and the pending key show", () => {
    const expected = runPlainSvScoreboard({ injectBugs: true, checkers: ["per-id"] }).summaries[0].line;
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    for (let i = 0; i < 3; i += 1) {
      runToPrompt();
      fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    }
    runToPrompt();
    expect(screen.getByText(/Counters stay hidden/)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation output")).not.toHaveTextContent("SCB_SUMMARY");
    predict(/Predict final/, [expected]);
    expect(expected).toBe("SCB_SUMMARY matches=1 mismatches=2 pending=1");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation output")).toHaveTextContent("Error: PENDING id=3 count=1");
    expect(screen.getByText(/pending at final/)).toBeInTheDocument();
    expect(screen.getByText(/n_pending = 1/)).toBeInTheDocument();
  });

  it("INJECT_BUGS is keyboard operable; switching to 0 restarts with the correct DUT's script", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    const group = screen.getByRole("radiogroup", { name: "INJECT_BUGS" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: /^1:/ }), { key: "ArrowLeft" });
    expect(within(group).getByRole("radio", { name: /^0:/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("list", { name: /tb_top/ })).toHaveTextContent("localparam bit INJECT_BUGS = 0;");
    expect(screen.getByText("Step 0 of 10")).toBeInTheDocument();
  });
});

describe("ScoreboardMatchingVisualizer variant=plain-sv navigation, focus and the probe", () => {
  it("Start over clears the predictions, so after four Runs the prediction gate shows again", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    predict(/Predict check_actual\(2/, ["match", "Key 2"]);
    expect(screen.getAllByText(/^Correct\./)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText("Step 0 of 9")).toBeInTheDocument();
    // The narration is announced as one unit, not piece by piece.
    expect(screen.getByText("Step 0 of 9").closest("[aria-live]")).toHaveAttribute("aria-atomic", "true");
    expect(runToPrompt()).toBe(4);
    expect(screen.getByRole("group", { name: /Predict check_actual\(2, 32'hB1\)/ })).toBeInTheDocument();
    expect(screen.queryByText(/^Correct\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Not quite\./)).not.toBeInTheDocument();
  });

  it("Back one call over a predicted step asks for that prediction again", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    predict(/Predict check_actual\(2/, ["match", "Key 2"]);
    // check_actual(1, 32'hA2) is gated too, so its prompt is now up.
    expect(screen.getByRole("group", { name: /Predict check_actual\(1, 32'hA2\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back one call" }));
    expect(screen.getByRole("group", { name: /Predict check_actual\(2, 32'hB1\)/ })).toBeInTheDocument();
    expect(screen.queryByText(/deleted after/)).not.toBeInTheDocument();
  });

  it("'No key' is right when the popped queue still holds items, and the answer says why", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    predict(/Predict check_actual\(2/, ["match", "Key 2"]);
    predict(/Predict check_actual\(1, 32'hA2\)/, ["MISMATCH", "No key"]);
    expect(screen.getAllByText(/^Correct\./)).toHaveLength(2);
    expect(screen.getAllByText(/exp_by_id\[1\] still holds \[A2\] after the pop, so key 1 stays\./).length).toBeGreaterThan(0);
  });

  it("keyboard focus is never dropped to <body>: Run onto a gated step lands on its first choice, and Lock in moves on", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: /^Run / }));
    const run = screen.getByRole("button", { name: /^Run / });
    run.focus();
    fireEvent.click(run);
    const group = screen.getByRole("group", { name: /Predict check_actual\(2, 32'hB1\)/ });
    expect(document.activeElement).not.toBe(document.body);
    expect(group.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(group).getByLabelText("match"));
    fireEvent.click(within(group).getByLabelText("Key 2"));
    const lock = within(group).getByRole("button", { name: "Lock in prediction" });
    lock.focus();
    fireEvent.click(lock);
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole("group", { name: /Predict check_actual\(1, 32'hA2\)/ }).contains(document.activeElement)).toBe(true);
    // The verdict sits in a polite live region.
    expect(screen.getByRole("status", { name: "Prediction result" })).toHaveTextContent(/Correct\./);
    const start = screen.getByRole("button", { name: "Start over" });
    start.focus();
    fireEvent.click(start);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Run / }));
  });

  it("two embeds on one page keep their radio groups apart", () => {
    render(
      <>
        <ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />
        <ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" compare={["in-order", "per-id"]} />
      </>,
    );
    runToPromptAll();
    const groups = screen.getAllByRole("group", { name: /Predict check_actual\(2, 32'hB1\)/ });
    expect(groups).toHaveLength(2);
    const names = groups.map((g) => new Set(within(g).getAllByRole("radio").map((r) => r.getAttribute("name"))));
    for (const n of names[0]) expect(names[1].has(n)).toBe(false);
  });

  it("past the lesson: the stray response is UNEXPECTED with the guard, and the unguarded read's '0 passes silently", () => {
    const { unmount } = render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    expect(screen.queryByRole("region", { name: /Past the lesson/ })).not.toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) {
      runToPrompt();
      fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    }
    runToPrompt();
    const probe = screen.getByRole("region", { name: /Past the lesson/ });
    // It is shown after final, so it says the summary above does not include it.
    expect(probe).toHaveTextContent("This is a what-if: the SCB_SUMMARY above is from the lesson's run without it.");
    expect(within(probe).queryByLabelText("Stray response output")).not.toBeInTheDocument();
    const g = within(probe).getByRole("group", { name: /Predict check_actual\(9, 32'h0\)/ });
    fireEvent.click(within(g).getByLabelText("UNEXPECTED"));
    fireEvent.click(within(g).getByLabelText("pop_front() returns '0, so the compare passes"));
    fireEvent.click(within(g).getByRole("button", { name: "Lock in prediction" }));
    expect(within(probe).getAllByText(/^Correct\./)).toHaveLength(2);
    expect(within(probe).getByLabelText("Stray response output")).toHaveTextContent("Error: UNEXPECTED id=9 data=00000000");
    expect(within(probe).getByText(/^Without the exists\(\) guard/)).toHaveTextContent(/n_match counts a response nobody requested/);
    expect(probe.contains(document.activeElement)).toBe(true);
    // The lesson's own output is unchanged by the probe.
    expect(screen.getByLabelText("Simulation output")).not.toHaveTextContent("id=9");
    unmount();
  });

  it("phone excerpt shows the highlighted call next to the prediction; the plain-SV code has no TB gutter tags", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" />);
    runToPrompt();
    const excerpt = screen.getByLabelText("Current line and latest output");
    expect(excerpt).toHaveTextContent("check_actual(2, 32'hB1);");
    expect(within(screen.getByRole("list", { name: /tb_top from Make It Work/ })).queryAllByText("TB")).toHaveLength(0);
  });
});

describe("ScoreboardMatchingVisualizer variant=plain-sv compare (F2B Kata)", () => {
  it("shows checker A beside checker B and reveals A's false alarm on the legal overtake", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" compare={["in-order", "per-id"]} />);
    expect(screen.getByRole("region", { name: "Checker A state" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Kata solution/ })).toHaveTextContent("localparam bit INJECT_BUGS = 0;");
    runToPrompt();
    expect(screen.queryByText(/false alarm/)).not.toBeInTheDocument();
    predict(/Predict check_actual\(2/, ["Checker A only", "Key 2"]);
    expect(screen.getAllByText(/^Correct\./)).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "Checker A state" })).getByText(/false alarm/)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation output")).toHaveTextContent("Error: A: MISMATCH id=2 exp=000000a1 act=000000b1");
    // After four add_expected calls and one pop_front(), exp_q holds 3 items, and size() reports the live count (§7.10.2).
    expect(within(screen.getByRole("region", { name: "Checker A state" })).getByText(/exp_q\.size\(\) = 3/)).toBeInTheDocument();
  });

  it("checker A's exp_q.size() counter equals the exp_q strip at every step", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" compare={["in-order", "per-id"]} />);
    const a = () => within(screen.getByRole("region", { name: "Checker A state" }));
    const stripCount = () => {
      const label = a().getByLabelText(/^exp_q: /).getAttribute("aria-label")!.replace(/^exp_q: /, "");
      return label === "empty" ? 0 : label.split(", ").length;
    };
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      runToPrompt();
      fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
      const n = stripCount();
      seen.push(n);
      expect(a().getByText(new RegExp(`exp_q\\.size\\(\\) = ${n}$`))).toBeInTheDocument();
    }
    // Four pushes, then one pop_front() per check_actual (§7.10.2.4).
    expect(seen).toEqual([3, 2, 1]);
  });

  it("checker A's second error is labelled as exp_q out of step, not as a reorder", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" compare={["in-order", "per-id"]} />);
    for (let i = 0; i < 2; i += 1) {
      runToPrompt();
      fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    }
    const a = within(screen.getByRole("region", { name: "Checker A state" }));
    expect(a.getAllByText(/legal reorder across IDs/)).toHaveLength(1);
    expect(a.getByText(/exp_q out of step/)).toBeInTheDocument();
  });

  it("final asks for checker A's summary, generated from the model", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" traffic="f2b-lesson" compare={["in-order", "per-id"]} />);
    for (let i = 0; i < 4; i += 1) {
      runToPrompt();
      fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    }
    runToPrompt();
    predict(/Predict final/, ["A: SCB_SUMMARY matches=2 mismatches=2 pending=0"]);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Simulation output")).toHaveTextContent("B: SCB_SUMMARY matches=4 mismatches=0 pending=0");
  });

  it("names policies the plain-SV bench does not have instead of silently dropping them", () => {
    render(<ScoreboardMatchingVisualizer variant="plain-sv" compare={["per-id", "search-any"]} />);
    expect(screen.getByText(/search-any is not part of the lesson/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Checker A state" })).not.toBeInTheDocument();
  });
});
