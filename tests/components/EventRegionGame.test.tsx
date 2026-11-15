import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EventRegionGame, { QUESTIONS, SORTER_ASSUMPTIONS } from "@/components/visuals/EventRegionGame";
import { regionGuideById } from "@/components/visuals/scheduler/region-guide";
import { REGION_ORDER, simulateTimeSlot } from "@/lib/sv-scheduler-model";
import { regionLandings, type RegionQuestion } from "@/lib/sv-region-map-model";
import { shiftRegisterScenario } from "@/lib/sv-scheduler-scenarios";
import {
  PLACE_LABELS,
  TRAY_HOLDS,
  cardLabel,
  gradePlacement,
  placementAnnouncement,
  placementVerdict,
  resolveSorterDeck,
  sorterCards,
  whereText,
  type SorterPlace,
} from "@/lib/region-sorter-items";

const regionQuestions = QUESTIONS.filter((q): q is RegionQuestion => q.type === "region");

// The key is generated from the scheduler model, so these tests pin the
// model-derived answers to IEEE 1800-2023 §4.4.2 rather than to a hand list.
describe("EventRegionGame answer key (generated from the scheduler model)", () => {
  const answerFor = (id: string) => regionQuestions.find((q) => q.id === id)?.answer;

  it("places nonblocking updates in NBA, their right-hand side in Active (§4.4.2.2, §4.4.2.4)", () => {
    expect(answerFor("nba-update")).toBe("nba");
    expect(answerFor("nba-rhs")).toBe("active");
  });

  it("places clocking-block sampling, events and drives in Preponed, Observed and Re-NBA (§14.13, §14.10, §14.16)", () => {
    expect(answerFor("cb-sample")).toBe("preponed");
    expect(answerFor("cb-event")).toBe("observed");
    expect(answerFor("cb-drive")).toBe("reNba");
  });

  it("places #0 resumes in Inactive / Re-Inactive and program code in Reactive (§4.4.2.3, §4.4.2.7, §24.3.1)", () => {
    expect(answerFor("zero-delay-resume")).toBe("inactive");
    expect(answerFor("program-zero-delay")).toBe("reInactive");
    expect(answerFor("program-code")).toBe("reactive");
    expect(answerFor("strobe")).toBe("postponed");
  });

  it("agrees with a fresh run of the model for the same event", () => {
    const run = simulateTimeSlot(shiftRegisterScenario("nba"));
    const landing = regionLandings(shiftRegisterScenario("nba"), run).find((l) => l.stmtId === "a1" && l.kind === "update");
    expect(answerFor("nba-update")).toBe(landing?.region);
  });

  it("offers every region as an answer somewhere, and never asks about final", () => {
    expect(new Set(regionQuestions.map((q) => q.answer)).size).toBe(REGION_ORDER.length);
    expect(QUESTIONS.some((q) => /\bfinal\b/.test(q.prompt) || q.code.some((l) => /\bfinal\b/.test(l.text)))).toBe(false);
  });
});

describe("EventRegionGame UI", () => {
  const start = () => {
    render(<EventRegionGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start Challenge" }));
  };

  it("offers all nine regions, highlights the line asked about, and gives a model 'why' for a correct pick", () => {
    start();
    const group = screen.getByRole("group", { name: /Scheduling regions/ });
    expect(within(group).getAllByRole("button")).toHaveLength(9);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("q1 = d;");
    fireEvent.click(within(group).getByRole("button", { name: /^Active/ }));
    expect(screen.getByText("Correct!")).toBeInTheDocument();
    expect(screen.getByText(/A blocking assignment updates its target before the next statement runs/)).toBeInTheDocument();
    within(group).getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  });

  it("diagnoses a wrong pick with what that region really holds", () => {
    start();
    fireEvent.click(within(screen.getByRole("group", { name: /Scheduling regions/ })).getByRole("button", { name: /^NBA/ }));
    expect(screen.getByText("Not quite. It lands in Active.")).toBeInTheDocument();
    expect(screen.getByText(/You picked NBA, which holds: The left-hand side updates of nonblocking assignments/)).toBeInTheDocument();
    expect(screen.getByLabelText("your answer, incorrect")).toBeInTheDocument();
  });

  it("can be played to the end with the keyboard-reachable buttons, including the output-order round", () => {
    start();
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const q = QUESTIONS[i];
      if (q.type === "region") {
        const group = screen.getByRole("group", { name: /Scheduling regions/ });
        const label = { preponed: "Preponed", active: "Active", inactive: "Inactive", nba: "NBA", observed: "Observed", reactive: "Reactive", reInactive: "Re-Inactive", reNba: "Re-NBA", postponed: "Postponed" }[q.answer];
        fireEvent.click(within(group).getByRole("button", { name: new RegExp(`^${label}`) }));
      } else {
        const correct = q.options.find((o) => o.correct);
        fireEvent.click(screen.getByRole("button", { name: correct?.label.replace(/\s+/g, " ") }));
      }
      expect(screen.getByText("Correct!")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: i + 1 < QUESTIONS.length ? "Next question" : "See results" }));
    }
    expect(screen.getByText(`${QUESTIONS.length} / ${QUESTIONS.length}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    expect(screen.getByRole("button", { name: "Start Challenge" })).toBeInTheDocument();
  });
});

describe("EventRegionGame region sorter (items prop)", () => {
  const ladder = () => screen.getByRole("group", { name: "Regions of a time slot, in order" });
  const rung = (name: string) => within(ladder()).getByRole("button", { name: new RegExp(`^${name.replace("-", "\\-")}\\b`) });
  const tray = () => within(screen.getByRole("group", { name: "Not on the ladder" })).getByRole("button");
  const placeOn = (place: SorterPlace) => fireEvent.click(place === "none" ? tray() : rung(PLACE_LABELS[place]));
  const check = () => fireEvent.click(screen.getByRole("button", { name: "Check placement" }));
  const revealed = () => within(screen.getByTestId("sorter-reveal"));
  const openCard = (code: string) => {
    const button = within(screen.getByRole("list", { name: "Cards" }))
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label")?.endsWith(`: ${code}`));
    if (!button) throw new Error(`no card ${code}`);
    fireEvent.click(button);
  };

  it("keeps the no-prop embed on the original quiz", () => {
    render(<EventRegionGame />);
    expect(screen.getByRole("button", { name: "Start Challenge" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Regions of a time slot, in order" })).not.toBeInTheDocument();
  });

  it("'first-read' deals the eight F3B constructs, with nine rungs and a no-region tray", () => {
    render(<EventRegionGame items="first-read" />);
    expect(screen.getByRole("region", { name: "Region sorter" })).toBeInTheDocument();
    const deck = resolveSorterDeck("first-read");
    expect(within(screen.getByRole("list", { name: "Cards" })).getAllByRole("button")).toHaveLength(deck.cards.length);
    expect(within(ladder()).getAllByRole("button")).toHaveLength(9);
    expect(tray()).toHaveAccessibleName(/^No region/);
    expect(screen.getByText(deck.cards[0].ask)).toBeInTheDocument();
  });

  it("hides the answer until the learner checks, then shows the reference row and its clause", () => {
    render(<EventRegionGame items="first-read" />);
    const first = resolveSorterDeck("first-read").cards[0];
    expect(screen.getByRole("button", { name: "Check placement" })).toBeDisabled();
    expect(screen.queryByTestId("sorter-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(whereText(first))).not.toBeInTheDocument();
    expect(screen.queryByText(/lands here/)).not.toBeInTheDocument();
    placeOn("active");
    expect(rung("Active")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(placementAnnouncement(first, ["active"]));
    check();
    const reveal = screen.getByTestId("sorter-reveal");
    expect(within(reveal).getByText(placementVerdict(first, gradePlacement(first, ["active"])))).toBeInTheDocument();
    expect(within(reveal).getByRole("table")).toHaveTextContent(first.construct);
    expect(within(reveal).getByRole("table")).toHaveTextContent(whereText(first));
    expect(within(reveal).getByRole("table")).toHaveTextContent(first.clauses.join(", "));
    expect(within(reveal).getByText(first.landings[0].why)).toBeInTheDocument();
    expect(within(reveal).getByText("Deterministic educational model")).toBeInTheDocument();
    within(ladder()).getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  });

  it("grades <= as partly right on NBA alone and marks Active as missed (§4.9.4)", () => {
    render(<EventRegionGame items="first-read" />);
    openCard("q1 <= d;");
    placeOn("nba");
    check();
    const c = sorterCards().get("nonblocking")!;
    expect(revealed().getByText(placementVerdict(c, gradePlacement(c, ["nba"])))).toBeInTheDocument();
    expect(rung("Active")).toHaveTextContent("missed: lands here");
    expect(rung("NBA")).toHaveTextContent("lands here");
  });

  it("accepts all three regions of a concurrent assertion (§16.5.1, §4.4.2.5, §4.4.2.6)", () => {
    render(<EventRegionGame items="first-read" />);
    const c = sorterCards().get("concurrent-assertion")!;
    openCard(c.code);
    c.landings.forEach((l) => placeOn(l.place));
    check();
    expect(revealed().getByText(placementVerdict(c, gradePlacement(c, ["preponed", "observed", "reactive"])))).toBeInTheDocument();
  });

  it("puts final in the tray, marked reference, not simulated (§9.2.3)", () => {
    render(<EventRegionGame items="first-read" />);
    const c = sorterCards().get("final")!;
    openCard(c.code);
    placeOn("active");
    placeOn("none");
    expect(rung("Active")).toHaveAttribute("aria-pressed", "false");
    check();
    expect(revealed().getByText("Right. It runs in no region.")).toBeInTheDocument();
    expect(revealed().getByText(/Reference, not simulated/)).toBeInTheDocument();
    expect(revealed().getByText("Conceptual illustration")).toBeInTheDocument();
  });

  it("says what a wrongly chosen region or the tray holds, only after the check", () => {
    render(<EventRegionGame items="first-read" />);
    const c = sorterCards().get("final")!;
    openCard(c.code);
    placeOn("postponed");
    expect(screen.queryByText(/which holds:/)).not.toBeInTheDocument();
    check();
    expect(revealed().getByText(`You placed it on Postponed (§4.4.2.9), which holds: ${regionGuideById.postponed.holds}`)).toBeInTheDocument();
    openCard("q1 = d;");
    placeOn("none");
    check();
    expect(revealed().getByText(`You put it in the tray (No region), which is for: ${TRAY_HOLDS}`)).toBeInTheDocument();
  });

  it("gives each model landing a reason in the card's own terms, then the model's text and the code it ran", () => {
    render(<EventRegionGame items="first-read" />);
    const c = sorterCards().get("nonblocking")!;
    openCard(c.code);
    placeOn("active");
    placeOn("nba");
    check();
    const nba = c.landings.find((l) => l.place === "nba")!;
    expect(revealed().getByText(nba.why)).toBeInTheDocument();
    expect(revealed().getByText(`In the model run: ${nba.modelWhy}`)).toBeInTheDocument();
    expect(revealed().getByText(`Code the model ran: ${c.scenarioTitle}`)).toBeInTheDocument();
    expect(revealed().getByText(/\/\/ Stage A/)).toBeInTheDocument();
  });

  it("badges a mixed deck as an illustration and says how many cards are reference cards; an all-model deck as a model run", () => {
    const { unmount } = render(<EventRegionGame items="first-read" />);
    const deck = resolveSorterDeck("first-read").cards;
    const refs = deck.filter((c) => c.fidelity === "reference").length;
    expect(screen.getByText("Conceptual illustration")).toBeInTheDocument();
    expect(screen.queryByText("Deterministic educational model")).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${refs} of ${deck.length} is a reference card, read from the clause and not simulated`))).toBeInTheDocument();
    unmount();
    render(<EventRegionGame items={["blocking", "nonblocking"]} />);
    expect(screen.getByText("Deterministic educational model")).toBeInTheDocument();
    expect(screen.queryByText(/reference card/)).not.toBeInTheDocument();
  });

  it("tells apart the module and program #0 cards in the picker and the results", () => {
    render(<EventRegionGame items={["zero-delay", "program-zero-delay"]} />);
    const chips = within(screen.getByRole("list", { name: "Cards" })).getAllByRole("button");
    expect(chips.map((b) => b.getAttribute("aria-label"))).toEqual(["Card 1: #0; (module)", "Card 2: #0; (program)"]);
    const { cards } = resolveSorterDeck(["zero-delay", "program-zero-delay"]);
    expect(cards.map((c) => cardLabel(c, cards))).toEqual(["#0; (module)", "#0; (program)"]);
    cards.forEach((c, i) => {
      c.landings.forEach((l) => placeOn(l.place));
      check();
      fireEvent.click(screen.getByRole("button", { name: i + 1 < cards.length ? "Next card" : "See results" }));
    });
    const results = screen.getByRole("list", { name: "Your placements" });
    expect(results).toHaveTextContent("#0; (module) → Inactive");
    expect(results).toHaveTextContent("#0; (program) → Re-Inactive");
  });

  it("has a one-row card picker for narrow screens that moves to the chosen card, keeps focus on the select and announces the card", () => {
    render(<EventRegionGame items="first-read" />);
    const picker = screen.getByRole("combobox", { name: "Go to card" });
    const deck = resolveSorterDeck("first-read").cards;
    expect(within(picker).getAllByRole("option")).toHaveLength(deck.length);
    picker.focus();
    fireEvent.change(picker, { target: { value: "7" } });
    expect(screen.getByText(deck[7].ask)).toBeInTheDocument();
    // Arrow keys can fire change on a closed select, so focus must stay on it.
    expect(document.activeElement).toBe(picker);
    const name = `Card 8 of ${deck.length}: ${deck[7].code}, ${deck[7].context}. ${deck[7].ask}`;
    expect(screen.getByRole("status")).toHaveTextContent(name);
    expect(screen.getByRole("group", { name })).toBeInTheDocument();
  });

  it("speaks the verdict once after a check: through the focused reveal, not also through the live region", () => {
    render(<EventRegionGame items="first-read" />);
    placeOn("active");
    check();
    expect(document.activeElement).toBe(screen.getByTestId("sorter-reveal"));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("states the §9.2.3 assumption as function calls from a single process", () => {
    expect(SORTER_ASSUMPTIONS.join(" ")).toContain("as function calls from a single process, not as a separate process");
    expect(SORTER_ASSUMPTIONS.join(" ")).not.toMatch(/rather than a process/);
  });

  it.each([false, "false"] as const)("with allowMulti %j, says which cards it left out and takes one region per card", (allowMulti) => {
    render(<EventRegionGame items="first-read" allowMulti={allowMulti} />);
    expect(screen.getByText(/left out/)).toHaveTextContent("q1 <= d;");
    expect(within(screen.getByRole("list", { name: "Cards" })).getAllByRole("button")).toHaveLength(resolveSorterDeck("first-read", false).cards.length);
    placeOn("active");
    placeOn("nba");
    expect(rung("Active")).toHaveAttribute("aria-pressed", "false");
    expect(rung("NBA")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows unknown card ids instead of dropping them silently", () => {
    render(<EventRegionGame items={["final", "no-such-card"]} />);
    expect(screen.getByText(/no card has this id/)).toHaveTextContent("no-such-card");
    expect(within(screen.getByRole("list", { name: "Cards" })).getAllByRole("button")).toHaveLength(1);
  });

  it("plays the whole 'all' deck with the model's landings, never dropping focus to the page body", () => {
    render(<EventRegionGame items="all" />);
    const { cards } = resolveSorterDeck("all");
    cards.forEach((c, i) => {
      expect(screen.getByText(c.ask)).toBeInTheDocument();
      c.landings.forEach((l) => placeOn(l.place));
      check();
      // The Check button unmounts and the rungs are disabled: focus moves to the reveal.
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(screen.getByTestId("sorter-reveal"));
      expect(revealed().getByText(placementVerdict(c, gradePlacement(c, c.landings.map((l) => l.place))))).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: i + 1 < cards.length ? "Next card" : "See results" }));
      if (i + 1 < cards.length) {
        // Focus lands on the card itself, whose name holds the code as well as the question.
        expect(document.activeElement).toHaveTextContent(cards[i + 1].ask);
        expect(document.activeElement).toHaveAttribute("aria-label", expect.stringContaining(`${cardLabel(cards[i + 1], cards)}, ${cards[i + 1].context}. ${cards[i + 1].ask}`));
      }
    });
    const summary = screen.getByText(`${cards.length} of ${cards.length} cards placed exactly.`);
    expect(document.activeElement).toBe(summary);
    fireEvent.click(screen.getByRole("button", { name: "Sort the cards again" }));
    expect(screen.getByRole("button", { name: "Check placement" })).toBeDisabled();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveTextContent(cards[0].ask);
  });
});
