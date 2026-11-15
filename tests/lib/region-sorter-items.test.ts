import { describe, expect, it } from "vitest";

import {
  FIRST_READ_IDS,
  PLACE_CLAUSES,
  PLACE_LABELS,
  SORTER_CARD_ORDER,
  SORTER_PLACES,
  annotatedScenarioSource,
  cardLabel,
  deckFidelity,
  gradePlacement,
  landingPlaceClause,
  placementAnnouncement,
  placementVerdict,
  resolveSorterDeck,
  sorterAssertionScenario,
  sorterCards,
  sorterSummary,
  togglePlace,
  whereText,
  type SorterCardId,
  type SorterPlace,
} from "@/lib/region-sorter-items";
import { REGION_CLAUSES, regionLandings } from "@/lib/sv-region-map-model";
import { REGION_LABELS, REGION_ORDER, simulateTimeSlot } from "@/lib/sv-scheduler-model";
import { shiftRegisterScenario } from "@/lib/sv-scheduler-scenarios";

const card = (id: SorterCardId) => sorterCards().get(id)!;
const places = (id: SorterCardId) => card(id).landings.map((l) => l.place);

describe("region sorter: model cards read their regions from the scheduler model", () => {
  it("blocking a = b writes in Active, the region of its module process (§4.9.3, §4.4.2.2)", () => {
    expect(places("blocking")).toEqual(["active"]);
    expect(card("blocking").code).toBe("q1 = d;");
  });

  it("q <= d reads its right-hand side in Active and updates in NBA (§4.9.4, §4.4.2.4)", () => {
    expect(places("nonblocking")).toEqual(["active", "nba"]);
    expect(card("nonblocking").code).toBe("q1 <= d;");
  });

  it("#0 in module code resumes in Inactive (§4.4.2.3)", () => {
    expect(places("zero-delay")).toEqual(["inactive"]);
    expect(card("zero-delay").code).toBe("#0;");
    expect(card("zero-delay").clauses).toEqual(["§4.4.2.3"]);
    // §4.4.2.3: the event is scheduled in Inactive; the process resumes on the next Inactive to Active iteration.
    expect(card("zero-delay").ask).toMatch(/event that resumes the process scheduled/);
    expect(card("zero-delay").landings[0].event).toBe("the event that resumes the process is scheduled");
    // The model run behind this card is deterministic, so the note says what the shared model line means.
    expect(card("zero-delay").note).toMatch(/order is fixed, but q2 takes d on the same edge/);
  });

  it("$display prints in the region of its module process, Active (§21.2.1, §4.4.2.2); $strobe prints in Postponed (§21.2.2, §4.4.2.9)", () => {
    expect(places("display")).toEqual(["active"]);
    expect(places("strobe")).toEqual(["postponed"]);
    expect(card("display").code).toMatch(/^\$display\(/);
    expect(card("strobe").code).toMatch(/^\$strobe\(/);
    expect(card("display").clauses).toEqual(["§21.2.1", "§4.4.2.2"]);
    expect(card("strobe").clauses).toEqual(["§21.2.2", "§4.4.2.9"]);
    // Program code runs in the reactive region set (§24.3.1), not always in Reactive itself.
    expect(card("display").note).toContain("in the reactive region set, usually in Reactive (§24.3.1)");
  });

  it("module-code reasons cite §4.4.2.2 only for what it says: the Active region holds the active region set events", () => {
    for (const id of ["blocking", "nonblocking", "display", "deferred-observed", "deferred-final"] as SorterCardId[]) {
      const active = card(id).landings.find((l) => l.place === "active")!;
      expect(active.why, id).toContain("Active region, which holds the active region set events being evaluated (§4.4.2.2)");
      expect(active.why, id).not.toMatch(/module code (executes|runs) in (the )?Active/);
    }
  });

  it("a concurrent assertion samples in Preponed, is evaluated in Observed and runs its action in Reactive (§16.5.1, §16.5, §4.4.2.5, §4.4.2.6)", () => {
    expect(places("concurrent-assertion")).toEqual(["preponed", "observed", "reactive"]);
    // The same three regions straight from a fresh model run.
    const scenario = sorterAssertionScenario();
    const ls = regionLandings(scenario, simulateTimeSlot(scenario)).filter((l) => l.processId === "A" && l.kind.startsWith("assert-"));
    expect(ls.map((l) => [l.kind, l.region])).toEqual([
      ["assert-sample", "preponed"],
      ["assert-eval", "observed"],
      ["assert-action", "reactive"],
    ]);
    expect(card("concurrent-assertion").code).toContain("assert property (@(posedge clk) d)");
    expect(card("concurrent-assertion").clauses).toEqual(["§16.5.1", "§4.4.2.1", "§16.5", "§4.4.2.5", "§4.4.2.6"]);
    expect(card("concurrent-assertion").note).toMatch(/§16\.5 also exempts disable conditions and clocking events/);
  });

  it("a zero-skew clocking drive from module code lands in Re-NBA (§14.16, §4.4.2.8)", () => {
    expect(places("clocking-drive")).toEqual(["reNba"]);
    expect(card("clocking-drive").code).toBe("cb.din <= 7;");
    expect(card("clocking-drive").note).toMatch(/§14\.16/);
    expect(card("clocking-drive").clauses).toEqual(["§14.16", "§4.4.2.8"]);
  });

  it("a #1step clocking input returns the Preponed sample (§14.13, §4.4.2.1); @(cb) triggers in Observed (§14.10)", () => {
    expect(places("step-input")).toEqual(["preponed"]);
    expect(places("clocking-event")).toEqual(["observed"]);
    expect(card("clocking-event").code).toBe("@(cb)");
    expect(card("step-input").clauses).toEqual(["§14.13", "§4.4.2.1"]);
    expect(card("clocking-event").clauses).toEqual(["§14.10", "§4.4.2.5"]);
    expect(card("clocking-event").note).toMatch(/first Active region after/);
  });

  it("program code reads in Reactive and updates in Re-NBA (§24.3.1, §4.4.2.6, §4.4.2.8); program #0 resumes in Re-Inactive (§4.4.2.7)", () => {
    expect(places("program-nonblocking")).toEqual(["reactive", "reNba"]);
    expect(places("program-zero-delay")).toEqual(["reInactive"]);
    expect(card("program-nonblocking").clauses).toEqual(["§24.3.1", "§4.4.2.6", "§4.4.2.8"]);
    expect(card("program-zero-delay").clauses).toEqual(["§4.4.2.7"]);
    expect(card("program-zero-delay").ask).toMatch(/event that resumes the program thread scheduled/);
  });

  it("every model landing's clause list includes the §4.4.2 sub-clause of the region the model chose", () => {
    for (const c of sorterCards().values()) {
      if (c.fidelity !== "model") continue;
      for (const l of c.landings) expect(l.clause).toContain(REGION_CLAUSES[l.place as keyof typeof REGION_CLAUSES]);
    }
  });

  it("every model landing keeps the model's own explanation as modelWhy, and every model card names its scenario", () => {
    for (const c of sorterCards().values()) {
      if (c.fidelity !== "model") continue;
      expect(c.scenarioTitle).toBeTruthy();
      c.landings.forEach((l) => expect(l.modelWhy?.length ?? 0).toBeGreaterThan(20));
    }
    expect(card("nonblocking").landings.find((l) => l.place === "nba")?.modelWhy).toBe("Scheduled by the nonblocking assignment in Stage A.");
  });

  it("every model landing's why is in the card's own terms: it names the region the model chose and that region's §4.4.2 clause", () => {
    for (const c of sorterCards().values()) {
      if (c.fidelity !== "model") continue;
      for (const l of c.landings) {
        const region = l.place as keyof typeof REGION_CLAUSES;
        expect(l.why, `${c.id} ${l.place}`).toContain(`${REGION_LABELS[region]} region`);
        expect(l.why, `${c.id} ${l.place}`).toContain(REGION_CLAUSES[region]);
        expect(l.why).not.toMatch(/Stage A|TB driver|program thread|assign led/);
      }
    }
    expect(card("nonblocking").landings.find((l) => l.place === "nba")?.why).toMatch(/scheduled when the statement executed \(§4\.9\.4\).*NBA region.*\(§4\.4\.2\.4\)/);
  });

  it("prints each model card's scenario code from the model, with starting values and process labels, so the model's why can be read against it", () => {
    const code = annotatedScenarioSource(shiftRegisterScenario("nba"));
    expect(code[0]).toBe("// starting values: clk = 0, d = 1, q1 = 0, q2 = 0");
    expect(code).toContain("always @(posedge clk) q1 <= d;  // Stage A");
    expect(card("nonblocking").scenarioCode).toEqual(code);
    for (const c of sorterCards().values()) {
      if (c.fidelity === "model") expect(c.scenarioCode?.join("\n")).toContain(c.code.split(" ")[0]);
      else expect(c.scenarioCode).toBeUndefined();
    }
  });
});

describe("region sorter: reference cards (not simulated) name their clauses", () => {
  it("$monitor prints in Postponed (§4.4.2.9, §21.2.3)", () => {
    expect(card("monitor").fidelity).toBe("reference");
    expect(places("monitor")).toEqual(["postponed"]);
    expect(card("monitor").clauses).toEqual(expect.arrayContaining(["§4.4.2.9", "§21.2.3"]));
    expect(card("monitor").note).toMatch(/\$time, \$stime and \$realtime/);
  });

  it("->> triggers its event in the NBA region (§15.5.1)", () => {
    expect(places("nonblocking-trigger")).toEqual(["nba"]);
    expect(card("nonblocking-trigger").clauses).toEqual(["§15.5.1", "§4.4.2.4"]);
  });

  it("final runs in no region: at the end of simulation, in zero time (§9.2.3)", () => {
    expect(places("final")).toEqual(["none"]);
    expect(card("final").clauses).toEqual(["§9.2.3"]);
    expect(card("final").landings[0].event).toBe("it runs once when simulation ends through $finish, in zero time, as function calls; no event still scheduled runs after it");
    expect(card("final").landings[0].why).toContain("as a series of function calls from a single process");
    expect(card("final").landings.map((l) => `${l.event} ${l.why}`).join(" ")).not.toMatch(/outside any time slot/);
    // The $time point rests on §9.2.3's example, not its normative text, and the note says so.
    expect(card("final").note).toMatch(/an inference from the clause's example, which reads \$time/);
  });

  it("the tray has no clause of its own: a tray landing shows its card's clause, a rung its §4.4.2 sub-clause", () => {
    expect("none" in PLACE_CLAUSES).toBe(false);
    expect(landingPlaceClause(card("final").landings[0])).toBe("§9.2.3");
    expect(landingPlaceClause(card("nonblocking").landings[1])).toBe("§4.4.2.4");
  });

  it("an observed deferred assertion evaluates at once, matures in Observed and acts in Reactive (§16.4, §16.4.1)", () => {
    expect(places("deferred-observed")).toEqual(["active", "observed", "reactive"]);
    expect(card("deferred-observed").clauses).toEqual(["§16.4", "§4.4.2.2", "§16.4.1"]);
  });

  it("a final deferred assertion evaluates at once and matures and runs in Postponed (§16.4, §16.4.1)", () => {
    expect(places("deferred-final")).toEqual(["active", "postponed"]);
    expect(card("deferred-final").clauses).toEqual(["§16.4", "§4.4.2.2", "§16.4.1"]);
  });

  it("every card, model or reference, cites at least one clause on every landing, all in § form", () => {
    for (const c of sorterCards().values()) {
      expect(c.clauses.length).toBeGreaterThan(0);
      c.clauses.forEach((cl) => expect(cl).toMatch(/^§\d+(\.\d+)*$/));
      c.landings.forEach((l) => expect(l.clause).toMatch(/§\d/));
    }
  });

  it("no card lands twice in one place, and landings are in ladder order", () => {
    for (const c of sorterCards().values()) {
      const ps = c.landings.map((l) => l.place);
      expect(new Set(ps).size).toBe(ps.length);
      expect([...ps].sort((a, b) => SORTER_PLACES.indexOf(a) - SORTER_PLACES.indexOf(b))).toEqual(ps);
    }
  });

  it("no card's ask or context names one of its answer regions, so the prompt never gives the answer away", () => {
    for (const c of sorterCards().values()) {
      for (const p of c.landings.map((l) => l.place)) {
        const name = PLACE_LABELS[p];
        const re = new RegExp(`\\b${name.replace("-", "\\-")}\\b`, "i");
        expect(re.test(c.ask), `${c.id} ask names ${name}`).toBe(false);
        expect(re.test(c.context), `${c.id} context names ${name}`).toBe(false);
        expect(re.test(c.code), `${c.id} code names ${name}`).toBe(false);
      }
    }
  });
});

describe("region sorter: decks", () => {
  it("'all' holds every card in play order, and every region and the tray is an answer somewhere", () => {
    const deck = resolveSorterDeck("all");
    expect(deck.cards.map((c) => c.id)).toEqual(SORTER_CARD_ORDER);
    const answered = new Set(deck.cards.flatMap((c) => c.landings.map((l) => l.place)));
    expect([...REGION_ORDER, "none"].every((p) => answered.has(p as SorterPlace))).toBe(true);
  });

  it("'first-read' is the eight constructs F3B names: =, <=, #0, $display, $strobe, concurrent assertions, clocking drives, final", () => {
    const deck = resolveSorterDeck("first-read");
    expect(deck.cards.map((c) => c.id)).toEqual(FIRST_READ_IDS);
    expect(deck.cards).toHaveLength(8);
    expect(deck.cards.map((c) => c.code.split(/[ (]/)[0])).toEqual(["q1", "q1", "#0;", "$display", "$strobe", "a_d:", "cb.din", "final"]);
  });

  it("a custom list keeps its order, drops duplicates and reports unknown ids instead of hiding them", () => {
    const deck = resolveSorterDeck(["final", "nonblocking", "final", "nope"]);
    expect(deck.cards.map((c) => c.id)).toEqual(["final", "nonblocking"]);
    expect(deck.unknownIds).toEqual(["nope"]);
  });

  it("reads a plain comma-separated string as an id list (for MDX authors)", () => {
    expect(resolveSorterDeck("final, display").cards.map((c) => c.id)).toEqual(["final", "display"]);
  });

  it("trims and lowercases deck names and ids, takes a deck name inside an array, and reads allowMulti=\"false\" as false", () => {
    expect(resolveSorterDeck(" all ").cards.map((c) => c.id)).toEqual(SORTER_CARD_ORDER);
    expect(resolveSorterDeck("First-Read").cards.map((c) => c.id)).toEqual(FIRST_READ_IDS);
    expect(resolveSorterDeck(["first-read"]).cards.map((c) => c.id)).toEqual(FIRST_READ_IDS);
    expect(resolveSorterDeck(" Final ,DISPLAY").cards.map((c) => c.id)).toEqual(["final", "display"]);
    const deck = resolveSorterDeck("first-read", "false");
    expect(deck.allowMulti).toBe(false);
    expect(deck.omittedMulti.map((c) => c.id)).toEqual(["nonblocking", "concurrent-assertion"]);
    expect(resolveSorterDeck("first-read", "true").allowMulti).toBe(true);
  });

  it("labels cards apart when two share their code (module and program #0), and leaves the rest as their code", () => {
    const { cards } = resolveSorterDeck("all");
    const labels = cards.map((c) => cardLabel(c, cards));
    expect(new Set(labels).size).toBe(cards.length);
    expect(cardLabel(card("zero-delay"), cards)).toBe("#0; (module)");
    expect(cardLabel(card("program-zero-delay"), cards)).toBe("#0; (program)");
    expect(cardLabel(card("zero-delay"), resolveSorterDeck("first-read").cards)).toBe("#0;");
    expect(cardLabel(card("nonblocking"), cards)).toBe("q1 <= d;");
  });

  it("badges a deck as a model run only when every card is a model card", () => {
    expect(deckFidelity(resolveSorterDeck("first-read").cards)).toBe("illustration");
    expect(deckFidelity(resolveSorterDeck(["blocking", "nonblocking"]).cards)).toBe("model");
    expect(deckFidelity(resolveSorterDeck(["blocking", "monitor"]).cards)).toBe("illustration");
    expect(deckFidelity([])).toBe("illustration");
  });

  it("an empty custom list gives an empty deck", () => {
    expect(resolveSorterDeck([]).cards).toEqual([]);
  });

  it("with allowMulti false, multi-landing cards are left out and listed, never graded against one place", () => {
    const deck = resolveSorterDeck("first-read", false);
    expect(deck.omittedMulti.map((c) => c.id)).toEqual(["nonblocking", "concurrent-assertion"]);
    expect(deck.cards.every((c) => c.landings.length === 1)).toBe(true);
  });
});

describe("region sorter: placing and grading", () => {
  it("toggles places in ladder order when several are allowed", () => {
    let picked: SorterPlace[] = [];
    picked = togglePlace(picked, "nba", true);
    picked = togglePlace(picked, "active", true);
    expect(picked).toEqual(["active", "nba"]);
    expect(togglePlace(picked, "nba", true)).toEqual(["active"]);
  });

  it("keeps the tray and the ladder exclusive (a construct in no region is on no rung, §9.2.3)", () => {
    expect(togglePlace(["active", "nba"], "none", true)).toEqual(["none"]);
    expect(togglePlace(["none"], "active", true)).toEqual(["active"]);
  });

  it("replaces the place when only one is allowed", () => {
    expect(togglePlace(["active"], "nba", false)).toEqual(["nba"]);
    expect(togglePlace(["nba"], "nba", false)).toEqual([]);
  });

  it("grades exact, partial and wrong placements of <= (§4.9.4)", () => {
    const c = card("nonblocking");
    expect(gradePlacement(c, ["active", "nba"]).status).toBe("correct");
    const partial = gradePlacement(c, ["nba"]);
    expect(partial).toEqual({ status: "partial", hits: ["nba"], missed: ["active"], extra: [] });
    expect(gradePlacement(c, ["postponed"]).status).toBe("wrong");
    expect(gradePlacement(c, []).status).toBe("wrong");
  });

  it("generates the verdict from the grade", () => {
    const c = card("nonblocking");
    expect(placementVerdict(c, gradePlacement(c, ["active", "nba"]))).toBe("Right: all 2 places. It lands in Active and NBA.");
    expect(placementVerdict(c, gradePlacement(c, ["nba", "reNba"]))).toBe("Partly right: NBA is right; Active is missing; Re-NBA is not where it lands. It lands in Active and NBA.");
    expect(placementVerdict(card("final"), gradePlacement(card("final"), ["postponed"]))).toBe("Not quite: the no-region tray is missing; Postponed is not where it lands. It runs in no region.");
    expect(placementVerdict(card("blocking"), gradePlacement(card("blocking"), ["none"]))).toBe("Not quite: Active is missing; the no-region tray is not where it lands. It lands in Active.");
    expect(placementVerdict(card("final"), gradePlacement(card("final"), ["none"]))).toBe("Right. It runs in no region.");
  });

  it("builds the reference row's where column from the landings", () => {
    expect(whereText(card("nonblocking"))).toBe("Active: d is read and the update is scheduled; NBA: q1 changes");
    expect(whereText(card("final"))).toBe("no region: it runs once when simulation ends through $finish, in zero time, as function calls; no event still scheduled runs after it");
  });

  it("announces placements and summarises a deck from the results", () => {
    expect(placementAnnouncement(card("nonblocking"), [])).toBe("q1 <= d; is not placed yet.");
    expect(placementAnnouncement(card("nonblocking"), ["active", "nba"])).toBe("q1 <= d; placed on Active and NBA.");
    const c = card("nonblocking");
    expect(sorterSummary([gradePlacement(c, ["active", "nba"]), gradePlacement(c, ["nba"]), gradePlacement(c, ["inactive"])], 3)).toBe("1 of 3 cards placed exactly, 1 partly right.");
    expect(sorterSummary([], 0)).toBe("0 of 0 cards placed exactly.");
  });
});
