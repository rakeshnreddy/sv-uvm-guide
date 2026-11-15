import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string } & Record<string, unknown>) => {
    const { src, alt, fill: _fill, priority: _priority, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import HallOfShameCarousel, { HALL_OF_SHAME_INCIDENTS } from "@/components/curriculum/f1/HallOfShameCarousel";

afterEach(() => {
  vi.useRealTimers();
});

const slide = () => screen.getByRole("article");

describe("HallOfShameCarousel: verified content", () => {
  it("every default card cites at least one https source", () => {
    for (const item of HALL_OF_SHAME_INCIDENTS) {
      expect(item.sources?.length, item.title).toBeGreaterThan(0);
      item.sources?.forEach((s) => expect(s.url, item.title).toMatch(/^https:\/\//));
    }
  });

  it("keeps the verified numbers and drops the unverifiable ones", () => {
    const [fdiv, ariane, spectre] = HALL_OF_SHAME_INCIDENTS;
    expect(fdiv.impact).toContain("$475 million");
    expect(fdiv.impact).toContain("fourth quarter of 1994");
    expect(fdiv.story).toContain("1 in 9 billion");
    expect(fdiv.impact).not.toMatch(/\$1B|~\$1B|today/);
    // The Ariane inquiry report states no cost, so the card must not invent one.
    expect(`${ariane.story} ${ariane.impact}`).not.toMatch(/\$\s?\d/);
    expect(ariane.story).toContain("64-bit floating-point");
    expect(ariane.story).toContain("16-bit signed integer");
    expect(ariane.impact).toContain("Cluster");
    expect(spectre.story).toContain("3 January 2018");
    expect(spectre.impact).not.toMatch(/fundamental rethink/i);
  });

  it("renders source links that open safely in a new tab", () => {
    render(<HallOfShameCarousel />);
    const links = within(slide()).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });
  });
});

describe("HallOfShameCarousel: interaction and accessibility", () => {
  it("never advances on its own", () => {
    vi.useFakeTimers();
    render(<HallOfShameCarousel />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/\(1 of 3\)$/));
  });

  it("moves with the buttons, the dots and the arrow keys, and wraps around", () => {
    render(<HallOfShameCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Ariane 5/));
    expect(screen.getByRole("button", { name: /Go to incident 2:/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(screen.getByRole("button", { name: "Next incident" }), { key: "ArrowRight" });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Spectre/));
    fireEvent.keyDown(slide(), { key: "ArrowRight" });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Intel Pentium/));
    fireEvent.click(screen.getByRole("button", { name: "Previous incident" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Spectre/));

    fireEvent.click(screen.getByRole("button", { name: /Go to incident 1:/ }));
    expect(screen.getByText(/Incident 1 of 3: Intel Pentium/)).toBeInTheDocument();
  });

  it("hides the lesson until the learner asks for it, and resets it on the next card", () => {
    render(<HallOfShameCarousel />);
    const reveal = screen.getByRole("button", { name: /What check would have caught it/ });
    expect(reveal).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/equivalence check of the table/)).not.toBeVisible();
    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide the lesson" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/equivalence check of the table/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(screen.getByRole("button", { name: /What check would have caught it/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("still accepts items from a lesson and says when a card has no source", () => {
    render(<HallOfShameCarousel items={[{ title: "Example Bug", story: "Story.", impact: "Delay." }]} />);
    expect(screen.getByText("Example Bug")).toBeInTheDocument();
    expect(screen.getByText("No source given for this card.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next incident" })).toBeDisabled();
  });
});

/* ---------------------- Escape analysis (predict mode) ---------------------- */

import {
  COMMON_THREAD,
  buildPredictSlides,
  canPredictItem,
  checkOptionProblems,
  defaultThreadOptions,
  escapeRows,
  pendingReveals,
  pendingText,
  slideAnnouncement,
  tallyText,
  type HallOfShameItem,
} from "@/components/curriculum/f1/HallOfShameCarousel";

const [FDIV, ARIANE, SPECTRE] = HALL_OF_SHAME_INCIDENTS;
const cardText = (item: HallOfShameItem) => `${item.title} ${item.story} ${item.impact} ${item.lesson ?? ""}`;
const correctOf = (item: HallOfShameItem) => item.checkOptions?.find((o) => o.correct);

describe("escape model: the options restate each card's verified lesson", () => {
  it("every default card has 3 or 4 usable options with exactly one correct", () => {
    for (const item of HALL_OF_SHAME_INCIDENTS) {
      expect(item.checkOptions?.length, item.title).toBeGreaterThanOrEqual(3);
      expect(item.checkOptions?.length, item.title).toBeLessThanOrEqual(4);
      expect(checkOptionProblems(item.checkOptions), item.title).toEqual([]);
      expect(item.escape, item.title).toBeDefined();
    }
  });

  it("FDIV (Edelman 1997; Shirriff 2024): the missing check is an exhaustive or formal table check at block level", () => {
    expect(correctOf(FDIV)?.text).toMatch(/exhaustive or formal/);
    expect(correctOf(FDIV)?.text).toMatch(/block level/);
    expect(FDIV.lesson).toMatch(/checked exhaustively|formal proof/);
    const random = FDIV.checkOptions?.find((o) => /more random divides/i.test(o.text));
    expect(random?.correct).toBe(false);
    expect(FDIV.checkOptions?.some((o) => /faster clock check/i.test(o.text) && !o.correct)).toBe(true);
    // The escape row must agree with the correct option.
    expect(FDIV.escape!.check).toMatch(/whole table with its mathematical definition|prove the divider formally/);
    expect(FDIV.escape!.when).toContain("block level");
    expect(random?.feedback).toContain("random simulation before release did not find it");
  });

  it("FDIV: the 1 in 9 billion figure is only ever quoted as Intel's estimate, never derived from table entries", () => {
    const all = (FDIV.checkOptions ?? []).map((o) => `${o.text} ${o.feedback}`).join(" ");
    expect(all).toMatch(/Intel's own estimate was about 1 in 9 billion/);
    expect(all).not.toMatch(/\d+\s*(bad|wrong|missing)\s*entr/i);
    expect(all).not.toMatch(/1 in \d+(?! billion)/);
    expect(FDIV.story).toContain("1 in 9 billion");
  });

  it("Ariane 501 (ESA/CNES Inquiry Board report, 1996): the missing check re-verifies reused code over the new operating range", () => {
    expect(correctOf(ARIANE)?.text).toMatch(/[Rr]e-verifying the reused code over Ariane 5's operating range/);
    expect(ARIANE.lesson).toMatch(/not re-verified against the new operating range/);
    // Distractor feedback is pinned to facts already on the card.
    expect(ARIANE.story).toContain("both inertial reference computers stopped");
    expect(ARIANE.story).toContain("about five times faster");
    expect(ARIANE.story).toContain("whose trajectory kept the value in range");
    const backup = ARIANE.checkOptions!.find((o) => /second inertial reference computer/.test(o.text))!;
    expect(backup.correct).toBe(false);
    expect(backup.feedback).toMatch(/Both inertial reference computers stopped/);
    const flown = ARIANE.checkOptions!.find((o) => /already flown/.test(o.text))!;
    expect(flown.correct).toBe(false);
    expect(flown.feedback).toContain("about five times faster");
    expect(flown.feedback).toContain("kept the value in range");
    expect(ARIANE.escape!.question).toMatch(/new operating range/);
    expect(ARIANE.escape!.check).toMatch(/again over the new operating range/);
  });

  it("Spectre and Meltdown (Project Zero, 2018): the missing check is an information-flow security property", () => {
    expect(correctOf(SPECTRE)?.text).toMatch(/information flow/);
    expect(SPECTRE.lesson).toMatch(/properties about information flow/);
    expect(SPECTRE.lesson).toContain("architecturally correct result");
    const functional = SPECTRE.checkOptions!.find((o) => /functional tests/.test(o.text))!;
    expect(functional.correct).toBe(false);
    expect(functional.feedback).toContain("architecturally correct result");
    expect(functional.feedback).toContain("what timing reveals");
    const clock = SPECTRE.checkOptions!.find((o) => /faster clock check/i.test(o.text))!;
    expect(clock.correct).toBe(false);
    expect(clock.feedback).toMatch(/how long a cache access takes/);
    expect(correctOf(SPECTRE)!.feedback).not.toMatch(/\bOnly\b/);
    expect(SPECTRE.escape!.check).toMatch(/information flow/);
    expect(SPECTRE.escape!.when).toMatch(/functional verification/);
  });

  it("every number in an option or its feedback already appears on that card", () => {
    for (const item of HALL_OF_SHAME_INCIDENTS) {
      const source = cardText(item);
      for (const o of item.checkOptions ?? []) {
        for (const n of `${o.text} ${o.feedback}`.match(/\d+/g) ?? []) expect(source, `${item.title}: ${n}`).toContain(n);
      }
    }
  });

  it("the correct option is not always in the same position, so position gives nothing away", () => {
    const positions = HALL_OF_SHAME_INCIDENTS.map((i) => i.checkOptions?.findIndex((o) => o.correct));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it("checkOptionProblems rejects options that cannot gate a reveal", () => {
    expect(checkOptionProblems(undefined)).toEqual(["no options are given"]);
    expect(checkOptionProblems([{ text: "a", correct: true, feedback: "f" }])).toContain("a prediction needs at least two options");
    const none = [{ text: "a", correct: false, feedback: "f" }, { text: "b", correct: false, feedback: "f" }];
    expect(checkOptionProblems(none)).toContain("exactly one option must be correct (found 0)");
    const two = none.map((o) => ({ ...o, correct: true }));
    expect(checkOptionProblems(two)).toContain("exactly one option must be correct (found 2)");
    expect(checkOptionProblems([{ text: "a", correct: true, feedback: " " }, { text: "", correct: false, feedback: "f" }])).toEqual([
      "an option has no text",
      "an option has no feedback",
    ]);
    const twins = [{ text: "Same", correct: true, feedback: "f" }, { text: "same ", correct: false, feedback: "g" }];
    expect(checkOptionProblems(twins)).toEqual(["two options have the same text"]);
  });
});

describe("escape model: the common thread (F1A 'What each card teaches')", () => {
  it("has exactly one correct option, and its feedback is built from every card's unasked question", () => {
    const options = defaultThreadOptions();
    expect(checkOptionProblems(options)).toEqual([]);
    const correct = options.find((o) => o.correct)!;
    expect(correct.text).toMatch(/never asked the question that failed/);
    expect(COMMON_THREAD).toBe("The plan never asked the question that failed.");
    for (const item of HALL_OF_SHAME_INCIDENTS) expect(correct.feedback).toContain(item.escape!.question);
    // The questions read as a list: commas, then "and" before the last one.
    const [q1, q2, q3] = HALL_OF_SHAME_INCIDENTS.map((i) => `“${i.escape!.question}”`);
    expect(correct.feedback).toContain(`${q1}, ${q2} and ${q3} A passing regression`);
    // The lesson claims only that the thread is not one missing technique.
    const formal = options.find((o) => /formal verification/.test(o.text))!;
    expect(formal.feedback).not.toMatch(/No single technique/);
    expect(formal.feedback).toMatch(/not one missing technique/);
  });

  it("the 'all software' distractor matches the cards' own labels: only Ariane is software", () => {
    const software = HALL_OF_SHAME_INCIDENTS.filter((i) => /· software/.test(i.title));
    expect(software).toEqual([ARIANE]);
    expect(defaultThreadOptions().find((o) => /software bugs/.test(o.text))?.feedback).toMatch(/Only Ariane 501/);
  });

  it("adds the summary slide only for the default incidents or explicit thread options", () => {
    const slides = buildPredictSlides(HALL_OF_SHAME_INCIDENTS);
    expect(slides.map((s) => s.kind)).toEqual(["incident", "incident", "incident", "summary"]);
    const custom = [{ title: "Example", story: "s", impact: "i" }];
    expect(buildPredictSlides(custom).map((s) => s.kind)).toEqual(["incident"]);
    expect(buildPredictSlides(custom, defaultThreadOptions(custom)).map((s) => s.kind)).toEqual(["incident", "summary"]);
    expect(buildPredictSlides([])).toEqual([]);
    expect(slideAnnouncement(slides[3], 3)).toBe("Summary: the common thread across 3 incidents");
    expect(slideAnnouncement(slides[0], 3)).toBe(`Incident 1 of 3: ${FDIV.title}`);
    expect(slideAnnouncement(undefined, 3)).toBe("");
  });

  it("tallies predictions from the results, including zero", () => {
    expect(tallyText({}, 3)).toBe("No prediction locked in yet on the 3 cards.");
    expect(tallyText({ 0: true, 2: false }, 3)).toBe("You locked in a prediction on 2 of 3 cards and chose the missing check on 1.");
    expect(tallyText({ 0: true }, 1)).toBe("You locked in a prediction on 1 of 1 card and chose the missing check on 1.");
    expect(tallyText({}, 1)).toBe("No prediction locked in yet on the 1 card.");
    expect(tallyText({ 5: true }, 3)).toBe("No prediction locked in yet on the 3 cards.");
  });

  it("counts only cards that can take a prediction, and says how many could not", () => {
    expect(tallyText({ 0: true }, 2, 1)).toBe("You locked in a prediction on 1 of 1 card and chose the missing check on 1. 1 card had no prediction to make.");
    expect(tallyText({}, 2, 0)).toBe("None of the 2 cards takes a prediction.");
    expect(canPredictItem(FDIV)).toBe(true);
    expect(canPredictItem({ title: "t", story: "s", impact: "i" })).toBe(false);
  });

  it("keeps every card's row hidden until that card's own reveal", () => {
    const rows = escapeRows(HALL_OF_SHAME_INCIDENTS, new Set([1]));
    expect(rows.map((r) => r.escape)).toEqual([null, ARIANE.escape, null]);
    expect(pendingReveals(3, new Set([1]))).toEqual([0, 2]);
    expect(pendingText([0, 2])).toMatch(/Still to open: incidents 1 and 3\.$/);
    expect(pendingText([2])).toMatch(/Still to open: incident 3\.$/);
    expect(pendingText([])).toBe("");
  });
});

describe("HallOfShameCarousel predict: predict-then-reveal", () => {
  const lock = () => fireEvent.click(within(slide()).getByRole("button", { name: "Lock in prediction" }));
  const skip = () => fireEvent.click(within(slide()).getByRole("button", { name: "Reveal without predicting" }));

  it("keeps the e2e pins: a Hall of Shame region, incident headings and a Next incident button", () => {
    render(<HallOfShameCarousel predict />);
    expect(screen.getByRole("region", { name: /Hall of Shame/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Intel Pentium FDIV bug \(1994\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(screen.getByRole("heading", { name: /Ariane 5 Flight 501/ })).toBeInTheDocument();
  });

  it("hides the lesson and sources until the learner commits, then explains a wrong choice", () => {
    render(<HallOfShameCarousel predict />);
    expect(within(slide()).queryByText(FDIV.lesson!)).not.toBeInTheDocument();
    expect(within(slide()).queryAllByRole("link")).toHaveLength(0);
    expect(within(slide()).getByRole("button", { name: "Lock in prediction" })).toBeDisabled();

    fireEvent.click(within(slide()).getByRole("radio", { name: /More random divides/ }));
    lock();
    const wrong = FDIV.checkOptions!.find((o) => /More random divides/.test(o.text))!;
    expect(within(slide()).getByText("Not quite.")).toBeInTheDocument();
    expect(within(slide()).getByText(wrong.feedback)).toBeInTheDocument();
    expect(within(slide()).getByText(correctOf(FDIV)!.feedback)).toBeInTheDocument();
    expect(within(slide()).getByText(FDIV.lesson!)).toBeVisible();
    expect(within(slide()).getByText(FDIV.escape!.when)).toBeInTheDocument();
    expect(within(slide()).getAllByRole("link")).toHaveLength(FDIV.sources!.length);
  });

  it("confirms the right choice", () => {
    render(<HallOfShameCarousel predict />);
    fireEvent.click(within(slide()).getByRole("radio", { name: correctOf(FDIV)!.text }));
    lock();
    expect(within(slide()).getByText("Correct.")).toBeInTheDocument();
  });

  it("leaves arrow keys to the radio options, and keeps each card's answer across navigation", () => {
    render(<HallOfShameCarousel predict />);
    const radio = within(slide()).getByRole("radio", { name: correctOf(FDIV)!.text });
    fireEvent.keyDown(radio, { key: "ArrowRight" });
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Intel Pentium/));
    fireEvent.click(radio);
    lock();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Ariane 5/));
    fireEvent.keyDown(slide(), { key: "ArrowLeft" });
    expect(within(slide()).getByText("Correct.")).toBeInTheDocument();
  });

  it("locks the summary until every card is revealed, then asks for the common thread", () => {
    render(<HallOfShameCarousel predict />);
    fireEvent.click(screen.getByRole("button", { name: "Go to the common thread" }));
    expect(slide()).toHaveAttribute("aria-label", "The common thread (summary)");
    expect(within(slide()).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(slide()).getByText(pendingText([0, 1, 2]))).toBeInTheDocument();
    expect(within(slide()).getByTestId("tally")).toHaveTextContent(tallyText({}, 3));

    fireEvent.click(within(slide()).getByRole("button", { name: "Go to incident 2" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Ariane 5/));

    fireEvent.click(within(slide()).getByRole("radio", { name: correctOf(ARIANE)!.text }));
    lock();
    fireEvent.click(screen.getByRole("button", { name: /Go to incident 1:/ }));
    skip();
    fireEvent.click(screen.getByRole("button", { name: /Go to incident 3:/ }));
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));

    expect(within(slide()).getByTestId("tally")).toHaveTextContent(tallyText({ 1: true }, 3));
    expect(within(slide()).queryByText(COMMON_THREAD)).not.toBeInTheDocument();
    const correct = defaultThreadOptions().find((o) => o.correct)!;
    fireEvent.click(within(slide()).getByRole("radio", { name: correct.text }));
    lock();
    const reveal = within(slide()).getByTestId("summary-reveal");
    expect(within(reveal).getByText(COMMON_THREAD)).toBeInTheDocument();
    for (const item of HALL_OF_SHAME_INCIDENTS) expect(within(reveal).getByText(item.escape!.check)).toBeInTheDocument();
  });

  it("falls back to the plain reveal for a lesson's own cards without options, and says why bad options are skipped", () => {
    const items: HallOfShameItem[] = [
      { title: "Plain", story: "s", impact: "i", lesson: "The plain lesson." },
      { title: "Broken", story: "s", impact: "i", checkOptions: [{ text: "only", correct: true, feedback: "f" }] },
    ];
    render(<HallOfShameCarousel predict items={items} />);
    expect(screen.queryByRole("button", { name: "Go to the common thread" })).not.toBeInTheDocument();
    expect(within(slide()).getByText("The plain lesson.")).not.toBeVisible();
    fireEvent.click(within(slide()).getByRole("button", { name: /What check would have caught it/ }));
    expect(within(slide()).getByText("The plain lesson.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next incident" }));
    expect(within(slide()).getByText(/a prediction needs at least two options/)).toBeInTheDocument();
  });

  it("drops the reveal-only note once the card is revealed", () => {
    render(<HallOfShameCarousel predict />);
    const note = "The lesson and the sources appear with the reveal.";
    expect(within(slide()).getByText(note)).toBeInTheDocument();
    skip();
    expect(within(slide()).queryByText(note)).not.toBeInTheDocument();
  });

  it("moves focus to the incident that 'Go to incident N' opens, and shows 'Summary' in the counter there", () => {
    render(<HallOfShameCarousel predict />);
    expect(screen.getByText("1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to the common thread" }));
    expect(screen.getByText("Summary")).toBeInTheDocument();
    fireEvent.click(within(slide()).getByRole("button", { name: "Go to incident 2" }));
    expect(slide()).toHaveAttribute("aria-label", expect.stringMatching(/^Ariane 5/));
    expect(document.activeElement).toBe(slide());
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("with custom items and threadOptions, a card with nothing to reveal counts as opened only once it is shown", () => {
    const options = defaultThreadOptions();
    const items: HallOfShameItem[] = [
      { ...FDIV },
      { title: "Bare", story: "s", impact: "i", escape: { question: "Bare q?", check: "Bare check.", when: "Bare when." } },
    ];
    render(<HallOfShameCarousel predict items={items} threadOptions={options} />);
    fireEvent.click(screen.getByRole("button", { name: "Go to the common thread" }));
    expect(within(slide()).getByText(pendingText([0, 1]))).toBeInTheDocument();
    expect(within(slide()).getByTestId("tally")).toHaveTextContent(tallyText({}, 2, 1));
    fireEvent.click(within(slide()).getByRole("button", { name: "Go to incident 1" }));
    skip();
    fireEvent.click(screen.getByRole("button", { name: /Go to incident 2:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Go to the common thread" }));
    expect(within(slide()).queryByTestId("summary-locked")).not.toBeInTheDocument();
    expect(within(slide()).getAllByRole("radio")).toHaveLength(options.length);
  });

  it("says why the summary is left out when a lesson's threadOptions cannot be used", () => {
    const bad = [{ text: "a", correct: true, feedback: "f" }, { text: "b", correct: true, feedback: "g" }];
    render(<HallOfShameCarousel predict items={[{ title: "One", story: "s", impact: "i" }]} threadOptions={bad} />);
    expect(screen.queryByRole("button", { name: "Go to the common thread" })).not.toBeInTheDocument();
    expect(screen.getByText(/summary slide is left out.*exactly one option must be correct \(found 2\)/)).toBeInTheDocument();
  });

  it("says so when there are no incidents", () => {
    render(<HallOfShameCarousel predict items={[]} />);
    expect(screen.getByText("No incidents to show.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next incident" })).toBeDisabled();
  });
});
