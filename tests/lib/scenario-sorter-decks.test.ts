import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { lazyMdxInteractiveNames } from "@/components/mdx/lazy-mdx-interactives";
import {
  COMPILE_STACK_LAYERS,
  F2E_BENCH,
  PACKET_EXAMPLE,
  PACKET_SORTER_CHALLENGES,
  REGRESSION_CELLS,
  SCENARIO_DECKS,
  SCENARIO_DECK_IDS,
  allInRange,
  axisCellFor,
  binHits,
  correctOptions,
  correctPositions,
  fillTemplate,
  formatSource,
  getScenarioDeck,
  gradeAnswer,
  implicationWindowAttempts,
  isAnswerComplete,
  longestAnswerStreak,
  longestPositionRun,
  otherOptions,
  regressionBinFor,
  selectCards,
  tallyAnswers,
  testStartLines,
  timeAfterEdgesNs,
  validateDeck,
  type ScenarioDeck,
  type ScenarioDeckId,
  type SorterCard,
} from "@/lib/scenario-sorter-decks";

const deck = (id: ScenarioDeckId) => SCENARIO_DECKS[id];
const card = (id: ScenarioDeckId, cardId: string): SorterCard => {
  const found = deck(id).cards.find((c) => c.id === cardId);
  if (!found) throw new Error(`no card ${cardId} in ${id}`);
  return found;
};
const answerIds = (c: SorterCard) => correctOptions(c).map((o) => o.id);
const partialIds = (c: SorterCard) => c.options.filter((o) => o.verdict === "partial").map((o) => o.id);
const refs = (c: SorterCard) => c.source.map(formatSource).join(" | ");
const opt = (c: SorterCard, id: string) => {
  const found = c.options.find((o) => o.id === id);
  if (!found) throw new Error(`no option ${id} in ${c.id}`);
  return found;
};

/**
 * Today's PacketSorterGame data, copied literally from the component before it
 * became a wrapper. The deck keeps every scenario, label and feedback; only the
 * order of each scenario's options changed, so the best one is no longer first.
 */
const PACKET_SORTER_CHALLENGES_BEFORE = [
  {
    id: "in-order",
    prompt: "Packets arrive one at a time and must be processed in arrival order. Which structure holds them?",
    options: [
      { id: "queue", label: "Queue", correct: true, feedback: "push_back on arrival, pop_front to process: FIFO order with no index bookkeeping (§7.10)." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "A dynamic array cannot grow one element at a time. You would reallocate with new[n+1](arr) per packet and track a read index yourself." },
      { id: "associative-array", label: "Associative array", correct: false, feedback: "It works only if you invent sequence-number keys. A queue gives you arrival order for free." },
    ],
    code: "pkt_t pkt_q[$];\npkt_q.push_back(p);      // monitor\np = pkt_q.pop_front();   // checker",
  },
  {
    id: "sparse",
    prompt: "You store error packets indexed by their 32-bit error ID. Only a handful of IDs ever occur. Which structure?",
    options: [
      { id: "associative-array", label: "Associative array", correct: true, feedback: "Entries exist only for IDs you write, and exists() checks membership without a warning (§7.8, §7.9.3)." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Indexing by a 32-bit ID would need new[2**32] elements to hold the largest ID." },
      { id: "queue", label: "Queue", correct: false, feedback: "Every lookup would be a linear search with find_first_index. Associative arrays look up by key." },
    ],
    code: "pkt_t err_pkts[bit [31:0]];\nerr_pkts[p.err_id] = p;\nif (err_pkts.exists(id)) ...",
  },
  {
    id: "unknown-count",
    prompt: "You collect every packet length for statistics at the end of the test. You do not know how many packets will arrive. Which structure?",
    options: [
      { id: "queue", label: "Queue", correct: true, feedback: "push_back grows the queue by one each time. At the end, lens.sum() with (int'(item)) and friends work on it directly." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Dynamic arrays have no push_back. You would write lens = new[lens.size()+1](lens) for every packet: a reallocate-and-copy each time (§7.5.1)." },
      { id: "associative-array", label: "Associative array", correct: false, feedback: "It works with a counter as the key, but you invent and manage an index that a queue provides for free." },
    ],
    code: "int lens[$];\nlens.push_back(p.len);           // per packet\ntotal = lens.sum() with (int'(item));",
  },
  {
    id: "known-at-runtime",
    prompt: "A plusarg tells you at run time that there are N lanes. Lane results arrive in any order and you write each one by lane number. Which structure?",
    options: [
      { id: "dynamic-array", label: "Dynamic array", correct: true, feedback: "new[N] creates exactly N default-initialized slots, so lane_res[lane] = v is valid in any order (§7.5.1)." },
      { id: "queue", label: "Queue", correct: false, feedback: "Writing q[5] when size() is 2 is an invalid index: the write is ignored (§7.4.5). Queues fit in-order filling." },
      { id: "fixed-size-array", label: "Fixed-size array", correct: false, feedback: "A fixed-size array needs its size at elaboration. N is only known at run time." },
    ],
    code: "int lane_res[];\nlane_res = new[n_lanes];   // all 0 (int is 2-state)\nlane_res[lane] = result;",
  },
  {
    id: "bounded",
    prompt: "A stimulus buffer may hold at most 8 pending items. A ninth must be dropped, and the tool must tell you. Which declaration?",
    options: [
      { id: "bounded-7", label: "item_t buf[$:7]", correct: true, feedback: "The bound is the last legal index, so [$:7] holds 8 items. A ninth push_back is discarded with a required warning (§7.10.5)." },
      { id: "bounded-8", label: "item_t buf[$:8]", correct: false, feedback: "Off by one: [$:8] allows indices 0..8, which is nine items." },
      { id: "unbounded", label: "item_t buf[$]", correct: false, feedback: "An unbounded queue just grows. Nothing is dropped and nothing warns." },
    ],
    code: "item_t buf[$:7];                // indices 0..7: at most 8 items\nif (buf.size() == 8) n_drops++;  // count drops yourself if you need them\nbuf.push_back(it);              // a 9th item is discarded with a warning",
  },
  {
    id: "packed",
    prompt: "A register mirror must line up bit-for-bit with a 32-bit bus so you can assign the whole bus to it in one statement. Which declaration?",
    options: [
      { id: "packed", label: "logic [3:0][7:0] mirror", correct: true, feedback: "Packed dimensions form one 32-bit vector, so mirror = bus; works and mirror[2] is byte 2 (§7.4.1, §7.6)." },
      { id: "unpacked", label: "logic [7:0] mirror [4]", correct: false, feedback: "An unpacked array is not a vector: mirror = bus; does not compile without a cast or streaming operator (§7.6)." },
      { id: "queue", label: "logic [7:0] mirror [$]", correct: false, feedback: "A queue is an unpacked, variable-size array. It cannot be assigned from a vector either." },
    ],
    code: "logic [3:0][7:0] mirror;\nmirror = bus;           // one 32-bit assignment\nbyte2  = mirror[2];     // packed index selects byte 2",
  },
];

describe("every deck is sound", () => {
  it("registers all nine decks under their ids", () => {
    expect(SCENARIO_DECK_IDS).toHaveLength(9);
    for (const id of SCENARIO_DECK_IDS) expect(getScenarioDeck(id)?.id).toBe(id);
    expect(getScenarioDeck("no-such-deck")).toBeUndefined();
  });

  it.each(SCENARIO_DECK_IDS)("%s passes the validator", (id) => {
    expect(validateDeck(deck(id))).toEqual([]);
  });

  it.each(SCENARIO_DECK_IDS)("%s: every card has at least one correct bin", (id) => {
    for (const c of deck(id).cards) expect(answerIds(c).length, c.id).toBeGreaterThan(0);
  });

  it.each(SCENARIO_DECK_IDS)("%s: every option (and every step-2 option) has feedback", (id) => {
    for (const c of deck(id).cards) {
      for (const o of [...c.options, ...(c.followUp?.options ?? [])]) expect(o.feedback.trim().length, `${c.id}/${o.id}`).toBeGreaterThan(20);
    }
  });

  it.each(SCENARIO_DECK_IDS)("%s: every option id is a bin of the deck", (id) => {
    const bins = new Set(deck(id).bins.map((b) => b.id));
    for (const c of deck(id).cards) for (const o of c.options) expect(bins.has(o.id), `${c.id}/${o.id}`).toBe(true);
  });

  it.each(SCENARIO_DECK_IDS)("%s: every card names its source", (id) => {
    for (const c of deck(id).cards) {
      expect(c.source.length, c.id).toBeGreaterThan(0);
      for (const s of c.source) expect(s.ref.trim(), c.id).not.toBe("");
    }
  });

  it("the validator reports broken data instead of passing it", () => {
    const good = deck("task-or-function");
    const c = (id: string) => card("task-or-function", id);
    const broken: ScenarioDeck = {
      ...good,
      cards: [
        { ...c("expected-value"), options: c("expected-value").options.map((o) => ({ ...o, verdict: "wrong" as const })) },
        { ...c("handshake"), options: [...c("handshake").options, { id: "macro", label: "Macro", verdict: "wrong", feedback: "Not a bin of this deck at all, so it must be reported." }] },
        { ...c("summary"), source: [] },
        { ...c("two-results"), options: c("two-results").options.map((o) => ({ ...o, feedback: "" })) },
      ],
    };
    const problems = validateDeck(broken).join("\n");
    expect(problems).toMatch(/expected-value: no correct option/);
    expect(problems).toMatch(/handshake: option "macro" is not a bin/);
    expect(problems).toMatch(/summary: names no source/);
    expect(problems).toMatch(/two-results: option "nonvoid" has no feedback/);
  });
});

describe("containers: today's PacketSorterGame, with its options reordered", () => {
  const byId = <T extends { id: string }>(items: readonly T[]) => Object.fromEntries(items.map((item) => [item.id, item]));

  it("keeps every scenario, in order, with the same options, labels, verdicts and feedback as the game shipped", () => {
    expect(PACKET_SORTER_CHALLENGES.map((c) => [c.id, c.prompt, c.code])).toEqual(PACKET_SORTER_CHALLENGES_BEFORE.map((c) => [c.id, c.prompt, c.code]));
    PACKET_SORTER_CHALLENGES.forEach((c, i) => {
      // The options as an id-keyed set: their order may change, nothing else may.
      expect(byId(c.options), c.id).toEqual(byId(PACKET_SORTER_CHALLENGES_BEFORE[i].options));
      expect(c.options, c.id).toHaveLength(PACKET_SORTER_CHALLENGES_BEFORE[i].options.length);
    });
  });

  it("no longer puts the best option first on every scenario, so the first button cannot score 6 of 6", () => {
    const best = deck("containers").cards.map((c) => correctPositions(c));
    expect(best).toEqual([[1], [0], [2], [1], [2], [0]]);
    const firstButtonScore = deck("containers").cards.filter((c) => c.options[0].verdict === "correct").length;
    expect(firstButtonScore).toBe(2);
  });

  it("cites the array clauses its feedback relies on (IEEE 1800-2023 Clause 7)", () => {
    expect(refs(card("containers", "bounded"))).toBe("IEEE 1800-2023 §7.10.5");
    expect(refs(card("containers", "sparse"))).toContain("§7.9.3");
  });
});

describe("verification-methods: industry practice from the F1B lesson, no LRM clause", () => {
  it("every source is labelled industry practice and cites no clause", () => {
    for (const c of deck("verification-methods").cards) {
      for (const s of c.source) {
        expect(s.kind).toBe("industry-practice");
        // The lesson, or (for the order of a CDC flow, which the lesson's taxonomy does not give) general practice.
        expect(s.ref).toMatch(/^F1B|^general CDC flow/);
        expect(s.ref).not.toMatch(/§|Clause/);
      }
    }
  });

  it("sorts the nine jobs as the lesson's split, tour and taxonomy do", () => {
    expect(deck("verification-methods").cards).toHaveLength(9);
    expect(answerIds(card("verification-methods", "mutex"))).toEqual(["formal"]);
    expect(answerIds(card("verification-methods", "no-starvation"))).toEqual(["formal"]);
    expect(answerIds(card("verification-methods", "bring-up"))).toEqual(["directed"]);
    expect(answerIds(card("verification-methods", "mixed-traffic"))).toEqual(["constrained-random"]);
    expect(answerIds(card("verification-methods", "rare-bin")).sort()).toEqual(["directed", "formal"]);
    expect(answerIds(card("verification-methods", "boot-os"))).toEqual(["emulation"]);
    expect(answerIds(card("verification-methods", "netlist"))).toEqual(["equivalence"]);
    expect(answerIds(card("verification-methods", "async-fifo"))).toEqual(["cdc"]);
    expect(answerIds(card("verification-methods", "retention"))).toEqual(["power-aware"]);
  });

  it("more seeds of the same constraints are unlikely to reach a stuck bin soon, but retargeted constraints are partly right (F1B, The coverage closure trap)", () => {
    const c = card("verification-methods", "rare-bin");
    expect(c.prompt).toMatch(/still at 0\. Which method closes it\?$/);
    expect(opt(c, "constrained-random").verdict).toBe("partial");
    // Diminishing returns, not a certain miss (F1B: rare bins take far more samples).
    expect(opt(c, "constrained-random").feedback).toMatch(/^More seeds of the same constraints are unlikely to reach it soon: coverage has plateaued\. A new test whose constraints aim at the hole works too/);
    expect(opt(c, "constrained-random").feedback).not.toMatch(/keep missing/);
    expect(c.source).toEqual([{ kind: "industry-practice", ref: "F1B, The coverage closure trap" }]);
  });

  it("an unreachable bin is reviewed before it is excluded, and formal needs the bin as a cover property (F1B, IEEE 1800-2023 §16.2, §19.2)", () => {
    const c = card("verification-methods", "rare-bin");
    const formal = opt(c, "formal").feedback;
    expect(formal).toMatch(/Restate the bin as a cover property/);
    // Three outcomes, as the lesson teaches: reached, unreachable, or bounded or inconclusive.
    expect(formal).toMatch(/finds a trace that reaches the case, shows that the case is unreachable, or, on a large design, ends bounded or inconclusive/);
    expect(formal).toMatch(/An unreachable bin is a question first: an over-constrained assumption, or a design that cannot reach a case the spec requires, is a bug\./);
    expect(formal).toMatch(/Exclude the bin only after that review, with the reason recorded\.$/);
    expect(formal).not.toMatch(/so the bin can be excluded/);
    // A directed test that misses the case shows only that its stimulus missed it.
    expect(opt(c, "directed").feedback).toMatch(/the test's failure to reach it points at the cause to debug\.$/);
    expect(opt(c, "directed").feedback).not.toMatch(/shows why it cannot/);
  });

  it("no starvation goes to formal, as in the lesson's split for the arbiter (F1B, How the methods combine)", () => {
    const c = card("verification-methods", "no-starvation");
    expect(opt(c, "formal").feedback).toMatch(/under assumptions that match how the real requesters behave/);
    expect(opt(c, "constrained-random").feedback).toMatch(/not that every request is granted eventually/);
    expect(c.source).toEqual([{ kind: "industry-practice", ref: "F1B, How the methods combine" }]);
  });

  it("the emulation bin's default says what emulation adds and what it does not", () => {
    const bin = deck("verification-methods").bins.find((b) => b.id === "emulation");
    expect(bin?.whenWrong).toMatch(/It runs the same RTL, only faster: it adds no proof, and no model the RTL lacks\.$/);
  });

  it("the async FIFO takes the taxonomy's two methods: CDC structural analysis, then formal as the second step (F1B bug taxonomy)", () => {
    const c = card("verification-methods", "async-fifo");
    // The order is general CDC-flow practice: the lesson's taxonomy names the two methods without one.
    expect(c.prompt).toMatch(/takes two methods, and in a typical CDC flow one of them runs first: pick that one\.$/);
    expect(c.source).toEqual([
      { kind: "industry-practice", ref: "F1B bug taxonomy" },
      { kind: "industry-practice", ref: "general CDC flow: structural analysis before formal" },
    ]);
    for (const text of [opt(c, "formal").feedback, opt(c, "cdc").feedback]) expect(text).toMatch(/in a typical CDC flow/i);
    expect(opt(c, "formal").feedback).not.toMatch(/formal is the second of the two/);
    expect(c.followUp?.after).toBe("cdc");
    expect(c.followUp?.options.map((o) => [o.id, o.verdict])).toEqual([
      ["constrained-random", "wrong"],
      ["formal", "correct"],
      ["equivalence", "wrong"],
    ]);
    expect(gradeAnswer(c, { primary: "cdc", followUp: "formal" })).toBe("correct");
    expect(gradeAnswer(c, { primary: "cdc", followUp: "equivalence" })).toBe("partial");
    // Naming only the second method is half the answer.
    expect(gradeAnswer(c, { primary: "formal" })).toBe("partial");
    expect(opt(c, "formal").feedback).toMatch(/^Half of the answer: the lesson's bug taxonomy lists CDC structural analysis and formal/);
    expect(gradeAnswer(c, { primary: "constrained-random" })).toBe("wrong");
  });

  it("a formal pick on the retention card is diagnosed by the missing power intent", () => {
    expect(opt(card("verification-methods", "retention"), "formal").feedback).toMatch(/power intent.*UPF \(IEEE 1801\)/);
  });

  it("the async FIFO's directed and emulation picks are told why they miss metastability, not given the bins' defaults (F1B: RTL simulation would not show it)", () => {
    const c = card("verification-methods", "async-fifo");
    expect(opt(c, "directed").feedback).toMatch(/^A directed RTL test does not model metastability either: in an ordinary RTL run a flop simply takes the value at its input, however well the test aims at the crossing\.$/);
    expect(opt(c, "emulation").feedback).toMatch(/an emulator runs its flops with no metastability model/);
    expect(opt(c, "emulation").feedback).toMatch(/It is faster, not more accurate at a crossing\.$/);
    for (const id of ["directed", "emulation"]) {
      const bin = deck("verification-methods").bins.find((b) => b.id === id);
      expect(opt(c, id).feedback, id).not.toBe(bin?.whenWrong);
    }
  });

  it("the retention card's directed and emulation picks are told that plain RTL has no power domains (F1B taxonomy, UPF IEEE 1801)", () => {
    const c = card("verification-methods", "retention");
    expect(opt(c, "directed").feedback).toMatch(/^A directed test in plain RTL simulation never powers anything down: without the UPF \(IEEE 1801\) power intent there are no power domains\./);
    expect(opt(c, "directed").feedback).not.toMatch(/only what somebody thought to write/);
    expect(opt(c, "emulation").feedback).toMatch(/without the UPF \(IEEE 1801\) power intent it has no power domains either/);
    expect(opt(c, "emulation").feedback).toMatch(/Some commercial emulators can load that intent \(tool-dependent\)/);
    // The answer says what power-aware simulation does, not only that the lesson lists it.
    expect(opt(c, "power-aware").feedback).toMatch(/corrupts state that is not retained, and models the retention save and restore/);
  });
});

describe("sv-features (IEEE 1800-2023)", () => {
  const cited = (cardId: string) => card("sv-features", cardId).source.map((s) => s.ref);

  it("maps each problem to the feature and clause in the F1C drill", () => {
    const expected: Record<string, [string, string]> = {
      "reuse-driver": ["class", "Clause 8"],
      "legal-bursts": ["constraint", "Clause 18"],
      "burst-lengths": ["covergroup", "Clause 19"],
      "gnt-within-3": ["assertion", "Clause 16"],
      "one-type": ["logic", "§6.11.2"],
      latch: ["always_comb", "§9.2.2.2"],
      "bus-bundle": ["interface", "Clause 25"],
      "share-types": ["package", "§26.2"],
    };
    for (const [cardId, [bin, clause]] of Object.entries(expected)) {
      expect(answerIds(card("sv-features", cardId)), cardId).toEqual([bin]);
      expect(cited(cardId), cardId).toContain(clause);
      for (const s of card("sv-features", cardId).source) expect(s.kind).toBe("ieee-1800-2023");
    }
  });

  it("always_comb carries §9.2.2.2's 'should warn': a recommendation, not a guarantee", () => {
    const c = card("sv-features", "latch");
    expect(c.caveat).toMatch(/should warn \(§9\.2\.2\.2\), not a guarantee/i);
    expect(c.options.find((o) => o.verdict === "correct")?.feedback).toMatch(/should warn/);
  });

  it("wrong picks say what a constraint and an assert statement cannot do, without denying cover property (§16.14.3)", () => {
    const c = card("sv-features", "burst-lengths");
    expect(opt(c, "constraint").feedback).toMatch(/makes values legal but records nothing/);
    expect(opt(c, "assertion").feedback).toMatch(/An assert statement fails on a rule but records no value bins/);
    expect(opt(c, "assertion").feedback).toMatch(/cover property counts one property's successes \(§16\.14\.3\)/);
    expect(refs(c)).toContain("IEEE 1800-2023 §16.14.3");
  });

  it("the assertion bin's default answers the cards that use it: no type, no bundle, no driver (Clause 16)", () => {
    const assertionBin = deck("sv-features").bins.find((b) => b.id === "assertion");
    expect(assertionBin?.whenWrong).toBe("An assertion checks a rule about values or timing (Clause 16). It declares no type, bundles no signals and is not a driver.");
    expect(assertionBin?.whenWrong).not.toMatch(/counts nothing/);
    const withDefault = deck("sv-features")
      .cards.filter((c) => opt(c, "assertion").feedback === assertionBin?.whenWrong)
      .map((c) => c.id)
      .sort();
    expect(withDefault).toEqual(["bus-bundle", "one-type", "reuse-driver", "share-types"]);
  });

  it("a covergroup is not a checker, but its illegal_bins do report a run-time error (§19.5.6)", () => {
    const covergroupBin = deck("sv-features").bins.find((b) => b.id === "covergroup");
    expect(covergroupBin?.whenWrong).toMatch(/It is not a checker \(only its illegal_bins report a run-time error, §19\.5\.6\)/);
    for (const c of deck("sv-features").cards) expect(opt(c, "covergroup").feedback, c.id).not.toMatch(/never fails/);
    expect(opt(card("sv-features", "gnt-within-3"), "covergroup").feedback).toMatch(/it is not a timing checker, so a late gnt still passes unless someone writes a check for it/);
  });

  it("every class has a built-in randomize() (§18.6.1): the legal-bursts class pick is told the constraint is what keeps bursts legal", () => {
    const c = card("sv-features", "legal-bursts");
    expect(opt(c, "class").feedback).toMatch(/^The rand fields and randomize\(\) live in a class \(§18\.6\.1\), but without a constraint randomize\(\) may pick any value of the type/);
    const classBin = deck("sv-features").bins.find((b) => b.id === "class");
    expect(classBin?.whenWrong).not.toMatch(/generates.*nothing/);
  });

  it("an interface can hold tasks (§25.7) but has no inheritance: the reuse-driver interface pick says so", () => {
    const c = card("sv-features", "reuse-driver");
    expect(opt(c, "interface").feedback).toMatch(/it can hold signal-level tasks such as read and write \(§25\.7\)/);
    expect(opt(c, "interface").feedback).toMatch(/an interface has no inheritance/);
    expect(opt(c, "interface").feedback).not.toMatch(/not the driver's code/);
    expect(refs(c)).toContain("IEEE 1800-2023 §25.7");
  });

  it("a package may declare variables and nets (§26.2): no feedback says it holds no signals", () => {
    const packageBin = deck("sv-features").bins.find((b) => b.id === "package");
    expect(packageBin?.whenWrong).toMatch(/types, functions, even variables and nets.*\(§26\.2\)/);
    for (const c of deck("sv-features").cards) {
      expect(opt(c, "package").feedback, c.id).not.toMatch(/no signals|not signals/);
    }
    expect(opt(card("sv-features", "bus-bundle"), "package").feedback).toMatch(/a global, not a port/);
  });

  it("a package's functions run when called: only processes of its own are limited, to checkers (§26.2)", () => {
    const packageBin = deck("sv-features").bins.find((b) => b.id === "package");
    expect(packageBin?.whenWrong).toMatch(/it contains no processes of its own \(no initial or always procedure\), except inside a checker \(§26\.2\)\.$/);
    for (const c of deck("sv-features").cards) expect(opt(c, "package").feedback, c.id).not.toMatch(/nothing in it runs/);
  });

  it("the latch card's assertion feedback does not tie every assertion to a clock (§16.3, §16.4 have none)", () => {
    const text = opt(card("sv-features", "latch"), "assertion").feedback;
    expect(text).not.toMatch(/on a clock/);
    expect(text).toMatch(/inferred latch \(§9\.2\.2\.2\)/);
  });

  it("the burst-lengths picture says how 1 to 16 differs from the shared two-bin example (§19.5.1)", () => {
    const c = card("sv-features", "burst-lengths");
    expect(c.anchorNote).toMatch(/bins len\[\] = \{\[1:16\]\};, one bin per length \(§19\.5\.1\)/);
    expect(PACKET_EXAMPLE.coverBins).toHaveLength(2);
  });

  it("splits into a verification half and a design half, four cards each", () => {
    const d = deck("sv-features");
    const halves = d.cards.map((c) => axisCellFor(d, c)?.column);
    expect(halves.filter((h) => h === "verification")).toHaveLength(4);
    expect(halves.filter((h) => h === "design")).toHaveLength(4);
    expect(axisCellFor(d, card("sv-features", "share-types"))?.column).toBe("design");
  });

  it("gives the anchor pictures to constraint, coverage, assertion, class, package and interface; the summary promises them only for most cards", () => {
    const anchored = deck("sv-features").cards.filter((c) => c.anchor).map((c) => [c.id, c.anchor]);
    expect(anchored).toEqual([
      ["legal-bursts", "constraint"],
      ["share-types", "package"],
      ["gnt-within-3", "assertion"],
      ["reuse-driver", "class"],
      ["burst-lengths", "coverage"],
      ["bus-bundle", "interface"],
    ]);
    expect(deck("sv-features").cards.filter((c) => !c.anchor).map((c) => c.id)).toEqual(["one-type", "latch"]);
    expect(deck("sv-features").summary).toMatch(/For most cards, a small picture shows the feature at work/);
    expect(deck("sv-features").summary).not.toMatch(/Packet example/);
  });

  it("meets the cards in a mixed order: not the drill's, and neither half alternates", () => {
    const d = deck("sv-features");
    expect(d.cards.map((c) => c.id)).toEqual(["legal-bursts", "one-type", "share-types", "gnt-within-3", "reuse-driver", "latch", "burst-lengths", "bus-bundle"]);
    const halves = d.cards.map((c) => axisCellFor(d, c)?.column).join(" ");
    expect(halves).not.toBe("verification verification verification verification design design design design");
    expect(halves).not.toMatch(/^(verification design ?){4}$|^(design verification ?){4}$/);
  });
});

describe("the Packet example behind the sv-features pictures", () => {
  it("every randomized length satisfies c_len, length inside {[1:99]} (§18.5)", () => {
    expect(allInRange(PACKET_EXAMPLE.samples, PACKET_EXAMPLE.legal.lo, PACKET_EXAMPLE.legal.hi)).toBe(true);
    expect(allInRange(PACKET_EXAMPLE.samples, PACKET_EXAMPLE.lengthRange.lo, PACKET_EXAMPLE.lengthRange.hi)).toBe(true);
  });

  it("the low and high bins count the same values (§19.5.1, bins for values)", () => {
    expect(binHits(PACKET_EXAMPLE.samples, PACKET_EXAMPLE.coverBins)).toEqual([
      { name: "low", hits: 4 },
      { name: "high", hits: 6 },
    ]);
  });

  it("req |-> ##[1:3] gnt: an attempt passes at the first gnt in its window, fails at the window's end, and is vacuous when req is 0 (§16.12.7)", () => {
    const attempts = implicationWindowAttempts(PACKET_EXAMPLE.req, PACKET_EXAMPLE.gnt, 1, 3);
    expect(attempts.filter((a) => a.status !== "vacuous")).toEqual([
      { start: 1, status: "pass", end: 3 },
      { start: 5, status: "fail", end: 8 },
    ]);
    expect(attempts.filter((a) => a.status === "vacuous")).toHaveLength(8);
  });

  it("a window that runs past the trace is pending, not failed", () => {
    expect(implicationWindowAttempts([0, 0, 1], [0, 0, 0], 1, 3)[2]).toEqual({ start: 2, status: "pending" });
    expect(implicationWindowAttempts([1, 0], [0, 1], 1, 3)[0]).toEqual({ start: 0, status: "pass", end: 1 });
  });
});

describe("uvm-name-layers", () => {
  const byBin = (bin: string) =>
    deck("uvm-name-layers")
      .cards.filter((c) => answerIds(c)[0] === bin)
      .map((c) => c.code);

  it("class, randomize(), covergroup, logic and $display are IEEE 1800-2023", () => {
    expect(byBin("ieee-1800").sort()).toEqual(["$display", "class", "covergroup", "logic", "randomize()"]);
  });

  it("the UVM names are IEEE 1800.2-2020, each with its clause", () => {
    expect(byBin("ieee-1800-2").sort()).toEqual(["`UVM_VERSION_POST_2017", "`uvm_component_utils", "run_test", "uvm_component", "uvm_pkg", "uvm_test"].sort());
    const clause: Record<string, string> = {
      "uvm-component": "§13.1",
      "uvm-test": "§13.2",
      "uvm-pkg": "§1.4.5",
      "component-utils": "§B.2.1.3",
      "run-test": "§F.3.1.2",
      "version-post-2017": "§B.7.3",
    };
    for (const [id, ref] of Object.entries(clause)) {
      const c = card("uvm-name-layers", id);
      expect(c.source[0]).toEqual({ kind: "ieee-1800.2-2020", ref });
      expect(c.definedIn).toContain(ref);
    }
  });

  it("uvm_macros.svh and `UVM_POST_VERSION_1_2 are uvm-core only: the standard names neither", () => {
    expect(byBin("uvm-core").sort()).toEqual(["`UVM_POST_VERSION_1_2", "uvm_macros.svh"]);
    expect(card("uvm-name-layers", "uvm-macros-svh").source).toEqual([{ kind: "uvm-core-2020.3.1", ref: "src/uvm_macros.svh" }]);
    const post12 = card("uvm-name-layers", "post-version-1-2").source;
    expect(post12[0]).toEqual({ kind: "uvm-core-2020.3.1", ref: "src/macros/uvm_version_defines.svh" });
    // The language clauses cited for `define and `ifdef, never a clause of the UVM standard.
    expect(post12.filter((s) => s.kind === "ieee-1800.2-2020")).toEqual([]);
  });

  const macroTiles = () => deck("uvm-name-layers").cards.filter((c) => c.code?.startsWith("`"));

  it("no macro tile says a macro arrives with uvm_pkg: macros come by `include, as uvm-compile-triage teaches", () => {
    expect(macroTiles().map((c) => c.id).sort()).toEqual(["component-utils", "post-version-1-2", "version-post-2017"]);
    for (const c of macroTiles()) {
      for (const o of c.options) expect(o.feedback, `${c.id}/${o.id}`).not.toMatch(/after uvm_pkg is compiled/);
      // Each one answers an IEEE 1800 pick with the mechanism, `define, not with the default text.
      expect(opt(c, "ieee-1800").feedback, c.id).toMatch(/^The language defines `define/);
    }
    const post2017 = opt(card("uvm-name-layers", "version-post-2017"), "ieee-1800").feedback;
    expect(post2017).toMatch(/This define is UVM's \(IEEE 1800\.2-2020 §B\.7\.3\)/);
    expect(post2017).toMatch(/`include "uvm_macros\.svh"/);
    expect(post2017).toMatch(/not a package item \(§26\.2\), so import uvm_pkg::\* cannot supply it/);
    expect(refs(card("uvm-name-layers", "version-post-2017"))).toContain("IEEE 1800-2023 §22.5.1");
  });

  it("only names that start with uvm_ are answered with 'defines no uvm_ name'", () => {
    for (const c of deck("uvm-name-layers").cards) {
      if (/^uvm_/.test(c.code ?? "")) continue;
      for (const o of c.options) expect(o.feedback, `${c.id}/${o.id}`).not.toMatch(/defines no uvm_ name/);
    }
  });

  it("run_test has no uvm_ prefix: an IEEE 1800 pick is told it is UVM's global task, exported through uvm_pkg (§F.3.1.2, §1.4.5)", () => {
    const c = card("uvm-name-layers", "run-test");
    expect(opt(c, "ieee-1800").feedback).toMatch(/^IEEE 1800-2023 defines no UVM task\. run_test is UVM's global task \(IEEE 1800\.2-2020 §F\.3\.1\.2\), exported through uvm_pkg \(§1\.4\.5\)/);
    expect(refs(c)).toContain("IEEE 1800.2-2020 §1.4.5");
  });

  it("every tile reveals its defining clause or file", () => {
    for (const c of deck("uvm-name-layers").cards) expect(c.definedIn, c.id).toMatch(/IEEE 1800(\.2)?-20(23|20)|uvm-core 2020\.3\.1/);
  });

  it("the uvm-core bin does not claim the library implements every standard name (it lists deviations)", () => {
    const bin = deck("uvm-name-layers").bins.find((b) => b.id === "uvm-core");
    expect(bin?.whenWrong).toMatch(/uvm-core implements the standard's uvm_ names; implementing a name does not make it library-only/);
    expect(bin?.whenWrong).not.toMatch(/every standard name/);
    // On a language tile the uvm-core pick is diagnosed as using the construct, not defining it.
    expect(opt(card("uvm-name-layers", "class"), "uvm-core").feedback).toMatch(/uses this construct.*the language defines it/);
  });

  it("uvm-core 2020.3.1 contains no covergroup, so the covergroup tile never says the library uses one (IEEE 1800-2023 §19.3)", () => {
    const feedback = opt(card("uvm-name-layers", "covergroup"), "uvm-core").feedback;
    expect(feedback).not.toMatch(/uses this construct|as any bench does/);
    expect(feedback).toMatch(/^uvm-core declares no covergroup at all\. covergroup is a language construct \(IEEE 1800-2023 §19\.3\)/);
    // The shared text stays only on the constructs uvm-core really uses (class, randomize(), logic, $display).
    const shared = deck("uvm-name-layers")
      .cards.filter((c) => opt(c, "uvm-core").feedback.includes("uses this construct"))
      .map((c) => c.id)
      .sort();
    expect(shared).toEqual(["class", "display", "logic", "randomize"]);
  });
});

describe("uvm-compile-triage", () => {
  it("draws the stack bottom-up in compile order", () => {
    expect(COMPILE_STACK_LAYERS).toEqual(["simulator", "uvm-core", "macros", "import", "classes"]);
  });

  it("each symptom strikes out exactly the layer that is its answer", () => {
    const expected: Record<string, string> = { "unknown-type": "import", "no-package": "uvm-core", "undefined-macro": "macros", "renamed-method": "classes" };
    for (const [id, layer] of Object.entries(expected)) {
      const c = card("uvm-compile-triage", id);
      expect(answerIds(c)).toEqual([layer]);
      expect(c.stack?.layer).toBe(layer);
    }
  });

  it("an unresolved package means it was not compiled first: a package's compilation shall precede its import (IEEE 1800-2023 §26.3)", () => {
    const c = card("uvm-compile-triage", "no-package");
    expect(refs(c)).toContain("IEEE 1800-2023 §26.3");
    expect(c.options.find((o) => o.verdict === "correct")?.feedback).toMatch(/shall precede/);
  });

  it("labels every message as generic and tool-dependent", () => {
    for (const c of deck("uvm-compile-triage").cards) expect(c.codeLabel).toMatch(/tool-dependent/);
  });

  it("the version guard is the standard's `UVM_VERSION_POST_2017 (IEEE 1800.2-2020 §B.7.3)", () => {
    const c = card("uvm-compile-triage", "renamed-method");
    expect(refs(c)).toContain("IEEE 1800.2-2020 §B.7.3");
    expect(partialIds(c)).toEqual(["uvm-core"]);
  });

  it("the renamed-method prompt says why your classes are the single answer: nothing is missing, one layer must change", () => {
    const c = card("uvm-compile-triage", "renamed-method");
    expect(c.prompt).toMatch(/Nothing in the stack is missing\. Which layer must change\?$/);
    // The lesson's own cause is credited, then set against the layer you change.
    expect(opt(c, "uvm-core").feedback).toMatch(/the lesson's cause, a different UVM version is compiled in/);
    // The title asks for the layer you fix, as the card does: the uvm-core layer is the cause but not the fix.
    expect(deck("uvm-compile-triage").title).toBe("Which layer must you fix?");
  });
});

describe("ipc-tools (IEEE 1800-2023 Clause 15)", () => {
  it("matches the lesson table in eight situations, met in a mixed order", () => {
    const expected: Record<string, string> = {
      "reset-waiting": "event",
      "late-monitor": "level-flag",
      "shared-bus": "semaphore",
      "log-file": "semaphore",
      "every-txn": "mailbox",
      "two-ahead": "bounded-mailbox",
      "latest-config": "level-flag",
      "last-item": "event",
    };
    expect(deck("ipc-tools").cards.map((c) => c.id)).toEqual(["reset-waiting", "late-monitor", "shared-bus", "every-txn", "log-file", "two-ahead", "latest-config", "last-item"]);
    for (const [id, bin] of Object.entries(expected)) expect(answerIds(card("ipc-tools", id)), id).toEqual([bin]);
  });

  it("-> reaches only current waiters (§15.5.2), so a late monitor needs a level wait (§9.4.3)", () => {
    const c = card("ipc-tools", "late-monitor");
    expect(c.options.find((o) => o.id === "event")?.feedback).toMatch(/reaches only current waiters \(§15\.5\.2\)/);
    expect(c.followUp?.after).toBe("level-flag");
    expect(c.followUp?.options.find((o) => o.verdict === "correct")?.label).toBe("wait (rst_done);");
    expect(c.followUp?.options.find((o) => o.id === "triggered")?.feedback).toMatch(/§15\.5\.3/);
  });

  it("mutual exclusion takes new(1); the default keyCount 0 blocks the first get() (§15.3, §15.3.1)", () => {
    for (const id of ["shared-bus", "log-file"]) {
      const step2 = card("ipc-tools", id).followUp;
      expect(step2?.after).toBe("semaphore");
      expect(step2?.options.find((o) => o.verdict === "correct")?.id).toBe("new-1");
      expect(step2?.options.find((o) => o.id === "new-0")?.feedback).toMatch(/§15\.3\.1/);
      // The question asks for the job's count, not the default, which is 0 keys (§15.3.1).
      expect(step2?.question).toBe("How many keys should new() create for this job?");
    }
  });

  it("two items ahead is a mailbox bounded to 2: put() suspends while it is full (§15.4.1, §15.4.3)", () => {
    const step2 = card("ipc-tools", "two-ahead").followUp;
    expect(step2?.after).toBe("bounded-mailbox");
    expect(step2?.options.filter((o) => o.verdict === "correct").map((o) => o.label)).toEqual(["mailbox #(item_t) gen2drv = new(2);"]);
  });

  it("an unbounded mailbox loses nothing and keeps FIFO order (§15.4.1, §15.4.3, §15.4.5)", () => {
    const c = card("ipc-tools", "every-txn");
    expect(c.source.map((s) => s.ref)).toEqual(["§15.4.1", "§15.4.3", "§15.4.5", "§6.5"]);
    // The prompt carries the cue that rules out a bound, which the lesson's step 3 otherwise asks for.
    expect(c.prompt).toMatch(/The monitor must never stop sampling the bus\.$/);
    expect(opt(c, "bounded-mailbox").feedback).toMatch(/a monitor blocked in put\(\) is not sampling the bus/);
  });

  it("a level flag holds one value; the claim is narrowed to a flag or other scalar variable (§6.5)", () => {
    expect(opt(card("ipc-tools", "two-ahead"), "level-flag").feedback).toMatch(/^A flag, or another scalar variable, holds one value/);
    expect(opt(card("ipc-tools", "every-txn"), "level-flag").feedback).toMatch(/^A flag, or another scalar variable, keeps only the latest value/);
    for (const c of deck("ipc-tools").cards) expect(opt(c, "level-flag").feedback, c.id).not.toMatch(/^A shared variable (holds one|keeps only)/);
  });

  it("a late monitor: a mailbox read with peek() also works (§15.4.7), so mailboxes are partly right; only the level flag is correct", () => {
    const c = card("ipc-tools", "late-monitor");
    expect(answerIds(c)).toEqual(["level-flag"]);
    // One key per monitor, or a gate (get() then put() straight back), also lets a late monitor through: partly right too.
    expect(partialIds(c).sort()).toEqual(["bounded-mailbox", "mailbox", "semaphore"]);
    expect(opt(c, "semaphore").feedback).toMatch(/^Works if the reset driver puts one key per monitor, put\(3\), since keys stay in the bucket until a get\(\) takes them, or if every monitor puts its key straight back/);
    expect(opt(c, "event").verdict).toBe("wrong");
    for (const id of ["mailbox", "bounded-mailbox"]) {
      expect(opt(c, id).feedback).toMatch(/^Works with peek\(\): it copies the message without removing it.*\(§15\.4\.7\)\. With a plain get\(\) the first monitor takes it.*\(§15\.4\.5\), unless each monitor puts it straight back/);
      expect(opt(c, id).feedback).not.toMatch(/Works only/);
    }
    expect(refs(c)).toContain("IEEE 1800-2023 §15.4.7");
  });

  it("the semaphore bin admits basic synchronization (§15.3) and says one key wakes one waiter, unlike -> (§15.5.1)", () => {
    const bin = deck("ipc-tools").bins.find((b) => b.id === "semaphore");
    expect(bin?.whenWrong).not.toMatch(/announces nothing/);
    expect(bin?.whenWrong).toMatch(/take turns at a resource \(§15\.3\).*only one waiting get\(\) through.*unlike -> ev, which wakes every waiter \(§15\.5\.1\)/);
  });

  it("announcing to one waiting checker: a mailbox, a flag or a semaphore also works, so each is partly right", () => {
    for (const id of ["reset-waiting", "last-item"]) {
      const c = card("ipc-tools", id);
      expect(answerIds(c), id).toEqual(["event"]);
      expect(partialIds(c).sort(), id).toEqual(["bounded-mailbox", "level-flag", "mailbox", "semaphore"]);
      expect(opt(c, "bounded-mailbox").feedback, id).toBe(opt(c, "mailbox").feedback);
    }
  });

  it("the semaphore gets one verdict on all three signal cards: partly right (§15.3 names basic synchronization)", () => {
    for (const id of ["reset-waiting", "late-monitor", "last-item"]) expect(opt(card("ipc-tools", id), "semaphore").verdict, id).toBe("partial");
    for (const id of ["reset-waiting", "last-item"]) {
      const text = opt(card("ipc-tools", id), "semaphore").feedback;
      expect(text, id).toMatch(/^Works: new\(\) creates no keys, so the waiting checker's get\(\) returns when .* put\(\) adds one \(§15\.3\.1–§15\.3\.3\)\./);
      expect(text, id).toMatch(/one key releases only one waiter, where -> wakes every waiter \(§15\.5\.1\), and the lesson keeps semaphores for taking turns\.$/);
      expect(text, id).not.toMatch(/not a moment|guards a resource/);
      expect(refs(card("ipc-tools", id)), id).toContain("IEEE 1800-2023 §15.3.3");
    }
  });

  it("every situation but the two announce cards has a pick that fails; on those, every other tool can be made to work, so none is wrong", () => {
    for (const c of deck("ipc-tools").cards) {
      const wrong = c.options.filter((o) => o.verdict === "wrong").map((o) => o.id);
      if (c.id === "reset-waiting" || c.id === "last-item") {
        expect(wrong, c.id).toEqual([]);
        // The prediction can still miss: only the event is fully right.
        expect(answerIds(c), c.id).toEqual(["event"]);
      } else expect(wrong.length, c.id).toBeGreaterThan(0);
    }
  });

  it("a mailbox can fake a lock with a token message, but that is a semaphore's job: the shared-bus mailbox picks say so (§15.4)", () => {
    const c = card("ipc-tools", "shared-bus");
    for (const id of ["mailbox", "bounded-mailbox"]) {
      expect(opt(c, id).verdict, id).toBe("wrong");
      expect(opt(c, id).feedback, id).toMatch(/using it for exclusive use means faking a key with a token message, which is a semaphore's job\.$/);
      expect(opt(c, id).feedback, id).not.toMatch(/does not give one process exclusive use/);
    }
  });

  it("an event cannot make processes queue or hold items: the log-file and two-ahead cards say so", () => {
    expect(opt(card("ipc-tools", "log-file"), "event").feedback).toMatch(/^An event cannot make processes queue/);
    expect(opt(card("ipc-tools", "two-ahead"), "event").feedback).toMatch(/^An event cannot hold items/);
    expect(opt(card("ipc-tools", "shared-bus"), "event").feedback).toMatch(/^An event cannot make processes queue/);
  });

  it("two-ahead counts the items that wait between generator and driver, the lesson bench's framing", () => {
    expect(card("ipc-tools", "two-ahead").prompt).toBe("At most two items may wait between the generator and the driver.");
  });

  it("step-2 options never put the correct one first, where focus lands; key counts and bounds run in ascending order", () => {
    const withSteps = deck("ipc-tools").cards.filter((c) => c.followUp);
    expect(withSteps.map((c) => c.id)).toEqual(["late-monitor", "shared-bus", "log-file", "two-ahead"]);
    for (const c of withSteps) {
      const options = c.followUp?.options ?? [];
      expect(options[0].verdict, c.id).not.toBe("correct");
      const counts = options.map((o) => /new\((\d*)\)/.exec(o.label)?.[1]).filter((n): n is string => n !== undefined);
      if (counts.length > 0) {
        const values = counts.map((n) => (n === "" ? 0 : Number(n)));
        expect(values, c.id).toEqual([...values].sort((a, b) => a - b));
      }
    }
  });
});

describe("function-body (IEEE 1800-2023 §13.4)", () => {
  const verdictOf = (id: string) => answerIds(card("function-body", id))[0];

  it("rule a forbids #, @, wait, fork-join, fork-join_any and wait fork; rule b forbids task enables", () => {
    for (const id of ["delay", "edge", "wait", "fork-join", "fork-join-any", "wait-fork", "task-call"]) {
      expect(verdictOf(id), id).toBe("illegal");
      expect(card("function-body", id).source[0].ref).toBe("§13.4");
    }
  });

  it("§13.4.4 allows nonblocking assignments, event triggers and fork-join_none; $display and a void-cast call are legal", () => {
    for (const id of ["fork-join-none", "nba", "trigger", "display", "void-cast"]) expect(verdictOf(id), id).toBe("legal");
  });

  it("only the two scheduled-later cases carry the calling-thread proviso and its required error (§13.4.4)", () => {
    const withProviso = deck("function-body")
      .cards.filter((c) => c.caveat)
      .map((c) => c.id);
    expect(withProviso.sort()).toEqual(["fork-join-none", "nba"]);
    for (const id of withProviso) {
      expect(card("function-body", id).caveat).toMatch(/provided the calling thread comes from an initial or always procedure, or a fork in one/);
      expect(card("function-body", id).caveat).toMatch(/the tool shall issue an error \(§13\.4\.4\)/);
    }
    expect(card("function-body", "trigger").caveat).toBeUndefined();
  });

  it("flag <= 1 is legal because flag is a module variable: an automatic variable cannot take a nonblocking assignment (§6.21, §10.4.2)", () => {
    const c = card("function-body", "nba");
    expect(c.code).toBe("flag <= 1;   // flag is a module variable");
    expect(opt(c, "legal").feedback).toMatch(/shall not be written with nonblocking assignments \(§6\.21, §10\.4\.2\)/);
    expect(opt(c, "illegal").feedback).toMatch(/^A nonblocking assignment to a module variable, as here, does not wait/);
    expect(refs(c)).toContain("IEEE 1800-2023 §6.21");
    expect(refs(c)).toContain("IEEE 1800-2023 §10.4.2");
  });

  it("$display is legal because final procedures allow only function-legal statements and §9.2.3's example uses it", () => {
    const c = card("function-body", "display");
    expect(c.source[0].ref).toBe("§9.2.3");
    expect(c.options.find((o) => o.verdict === "correct")?.feedback).toMatch(/final/);
  });

  it("offers the twelve chips the spec lists", () => {
    expect(deck("function-body").cards).toHaveLength(12);
  });

  it("each bin's default text diagnoses a wrong pick of that bin, not the bin itself", () => {
    const bins = Object.fromEntries(deck("function-body").bins.map((b) => [b.id, b.whenWrong]));
    // Picking "legal" is wrong only for an illegal statement, so its default says why it is illegal.
    expect(bins.legal).toMatch(/can suspend the caller or enables a task, which §13\.4 rules a and b forbid/);
    // Picking "illegal" is wrong only for a legal statement, so its default says why it is allowed.
    expect(bins.illegal).toMatch(/does not wait, so §13\.4\.4 .* allows it/);
  });
});

describe("task-or-function (IEEE 1800-2023 §13.3, §13.4)", () => {
  it("follows the lesson's table", () => {
    expect(answerIds(card("task-or-function", "expected-value"))).toEqual(["nonvoid"]);
    expect(answerIds(card("task-or-function", "handshake"))).toEqual(["task"]);
    expect(answerIds(card("task-or-function", "summary"))).toEqual(["void"]);
    expect(answerIds(card("task-or-function", "two-results")).sort()).toEqual(["nonvoid", "void"]);
  });

  it("a task that prints a summary works but loses the zero-time guarantee: partly correct", () => {
    expect(partialIds(card("task-or-function", "summary"))).toEqual(["task"]);
    expect(partialIds(card("task-or-function", "two-results"))).toEqual(["task"]);
  });
});

describe("regression-log: the matcher is a real RegExp, run on every line", () => {
  // Built here, independently of the deck module, so the deck cannot agree with itself by accident.
  const matcher = new RegExp("^PASS=\\d+ FAIL=0$");
  const accepts = (log: readonly string[]) => log.some((line) => matcher.test(line));

  it("places each ending in the cell its log and its truth decide", () => {
    for (const c of deck("regression-log").cards) {
      expect(c.log, c.id).toBeDefined();
      expect(typeof c.reallyPassed, c.id).toBe("boolean");
      const expected = regressionBinFor(accepts(c.log ?? []), Boolean(c.reallyPassed));
      expect(answerIds(c), c.id).toEqual([expected]);
      expect(REGRESSION_CELLS[expected]).toEqual({ accepts: accepts(c.log ?? []), passed: c.reallyPassed });
    }
  });

  it("covers every cell of the 2x2, with the two traps in 'accepted, did not pass'", () => {
    const where = Object.fromEntries(deck("regression-log").cards.map((c) => [c.id, answerIds(c)[0]]));
    expect(where).toEqual({
      clean: "trusted-pass",
      "zero-checks": "false-pass",
      crash: "caught-fail",
      "tool-prefix": "false-alarm",
      "rtl-assertion": "false-pass",
      "fatal-exit-0": "caught-fail",
    });
  });

  it("one axis right is partly correct; both wrong is wrong", () => {
    const c = card("regression-log", "zero-checks");
    expect(c.options.find((o) => o.id === "trusted-pass")?.verdict).toBe("partial");
    expect(c.options.find((o) => o.id === "caught-fail")?.verdict).toBe("partial");
    expect(c.options.find((o) => o.id === "false-alarm")?.verdict).toBe("wrong");
  });

  it("each option describes its cell, not the learner, so 'Why not the others?' never praises a cell the learner did not pick", () => {
    for (const c of deck("regression-log").cards) {
      for (const pick of c.options) {
        for (const listed of otherOptions(c, { primary: pick.id }).options) expect(listed.feedback, `${c.id}: pick ${pick.id}, listed ${listed.id}`).not.toMatch(/You read/);
      }
    }
    const clean = card("regression-log", "clean");
    expect(opt(clean, "false-pass").feedback).toBe("This cell gets the matcher right but not the run: All 14 checks ran and passed, and nothing else reported an error.");
    expect(opt(clean, "false-alarm").feedback).toBe("This cell gets the run right but not the matcher: The last line is exactly PASS=14 FAIL=0, so the anchored pattern matches it.");
  });

  it("a cell wrong on both axes says so briefly; the best choice, shown next, carries both notes", () => {
    const clean = card("regression-log", "clean");
    expect(opt(clean, "caught-fail").feedback).toBe("Both axes are off: the matcher accepts this log, and the run really passed.");
    const crash = card("regression-log", "crash");
    expect(opt(crash, "trusted-pass").feedback).toBe("Both axes are off: the matcher rejects this log, and the run did not pass.");
    for (const c of deck("regression-log").cards) {
      const best = correctOptions(c)[0].feedback;
      for (const o of c.options.filter((x) => x.verdict === "wrong")) expect(best.includes(o.feedback.replace(/^Both axes are off: /, "")), `${c.id}/${o.id}`).toBe(false);
    }
  });

  it("exit statuses are tool-dependent: only §20.10 and §20.2 are cited for them", () => {
    const c = card("regression-log", "fatal-exit-0");
    expect(c.source.map((s) => s.ref)).toEqual(expect.arrayContaining(["§20.10", "§20.2"]));
    expect(c.options.find((o) => o.verdict === "correct")?.feedback).toMatch(/tool-dependent/);
    expect(deck("regression-log").assumptions?.join(" ")).toMatch(/tool-dependent/);
  });

  it("a $error from an RTL immediate assertion is the §16.3 default action, invisible to the counters", () => {
    expect(refs(card("regression-log", "rtl-assertion"))).toContain("IEEE 1800-2023 §16.3");
  });
});

describe("regression-log: TEST start times follow the F2E bench, with and without reset_dut()", () => {
  // Derived here independently: step a 10 ns clock (clk = 1'b0; always #5 clk = ~clk;) and
  // count the @(posedge clk) waits in the lesson's tasks.
  const lessonTasks: Record<string, string[]> = {
    smoke: ["send", "send", "send", "idle(1)"],
    corners: ["send", "send", "send", "send", "send", "send", "send", "idle(1)"],
    gaps: ["send", "idle(2)", "send", "send", "idle(1)", "send", "idle(1)"],
  };
  const edgesOf = (steps: string[]) => steps.reduce((n, s) => n + (s === "send" ? 1 : Number(/idle\((\d+)\)/.exec(s)?.[1])), 0);
  const risingEdges = (count: number) => {
    const edges: number[] = [];
    let clk = 0;
    for (let t = 5; edges.length < count; t += 5) {
      clk = 1 - clk;
      if (clk === 1) edges.push(t);
    }
    return edges;
  };
  const startTimes = (resetEdges: number) => {
    const edges = risingEdges(64);
    let waited = resetEdges;
    return ["smoke", "corners", "gaps"].map((name) => {
      const ns = waited === 0 ? 0 : edges[waited - 1];
      waited += edgesOf(lessonTasks[name]);
      return `${ns} ns TEST ${name}`;
    });
  };

  it("the bench timing matches the lesson's tasks", () => {
    expect(F2E_BENCH.tests.map((t) => [t.name, t.edges])).toEqual(Object.entries(lessonTasks).map(([name, steps]) => [name, edgesOf(steps)]));
    expect(F2E_BENCH.resetEdges).toBe(2);
    expect(timeAfterEdgesNs(F2E_BENCH, 0)).toBe(0);
    expect(timeAfterEdgesNs(F2E_BENCH, 2)).toBe(15);
  });

  it("with reset_dut(), smoke starts at 15 ns: the lesson's expected output", () => {
    expect(startTimes(2)).toEqual(["15 ns TEST smoke", "55 ns TEST corners", "135 ns TEST gaps"]);
    expect(testStartLines(F2E_BENCH, F2E_BENCH.resetEdges)).toEqual(startTimes(2));
    expect(card("regression-log", "clean").log).toEqual([...startTimes(2), "PASS=14 FAIL=0"]);
    expect(card("regression-log", "tool-prefix").log).toEqual([...startTimes(2).map((l) => `# ${l}`), "# PASS=14 FAIL=0"]);
  });

  it("with reset_dut() deleted, the zero-checks log starts at 0 ns, so it carries no false clue that reset ran", () => {
    expect(startTimes(0)).toEqual(["0 ns TEST smoke", "35 ns TEST corners", "115 ns TEST gaps"]);
    expect(card("regression-log", "zero-checks").log).toEqual(["0 ns TEST smoke", "35 ns TEST corners", "115 ns TEST gaps", "PASS=0 FAIL=0"]);
  });

  it("every other ending keeps the reset run's start times", () => {
    const withReset = new Set(startTimes(2));
    for (const id of ["crash", "rtl-assertion", "fatal-exit-0"]) {
      const testLines = (card("regression-log", id).log ?? []).filter((l) => / TEST /.test(l));
      expect(testLines.length, id).toBeGreaterThan(0);
      for (const l of testLines) expect(withReset.has(l), `${id}: ${l}`).toBe(true);
    }
  });
});

describe("grading", () => {
  it("a correct bin is correct; a partial bin is partial; anything else is wrong", () => {
    const c = card("task-or-function", "summary");
    expect(gradeAnswer(c, { primary: "void" })).toBe("correct");
    expect(gradeAnswer(c, { primary: "task" })).toBe("partial");
    expect(gradeAnswer(c, { primary: "nonvoid" })).toBe("wrong");
    expect(gradeAnswer(c, {})).toBeNull();
    expect(gradeAnswer(c, { primary: "not-a-bin" })).toBeNull();
  });

  it("a correct bin waits for its second step, and a wrong second step makes it partial", () => {
    const c = card("ipc-tools", "two-ahead");
    expect(isAnswerComplete(c, { primary: "bounded-mailbox" })).toBe(false);
    expect(gradeAnswer(c, { primary: "bounded-mailbox" })).toBeNull();
    expect(gradeAnswer(c, { primary: "bounded-mailbox", followUp: "new-2" })).toBe("correct");
    expect(gradeAnswer(c, { primary: "bounded-mailbox", followUp: "new-3" })).toBe("partial");
    expect(gradeAnswer(c, { primary: "mailbox" })).toBe("wrong");
  });

  it("tallies correct, partial and wrong answers", () => {
    const cards = deck("task-or-function").cards;
    const tally = tallyAnswers(cards, { "expected-value": { primary: "nonvoid" }, handshake: { primary: "void" }, summary: { primary: "task" } });
    expect(tally).toEqual({ total: 4, answered: 3, correct: 1, partial: 1, wrong: 1 });
  });

  it("selects a subset in the lesson's order and reports unknown ids", () => {
    const { cards, unknown } = selectCards(deck("ipc-tools"), ["two-ahead", "every-txn", "nope", "two-ahead"]);
    expect(cards.map((c) => c.id)).toEqual(["two-ahead", "every-txn"]);
    expect(unknown).toEqual(["nope"]);
    expect(selectCards(deck("ipc-tools")).cards).toHaveLength(8);
  });

  it("'Why not the others?' holds every option the reveal does not explain: never the pick, never a correct bin", () => {
    const mutex = card("verification-methods", "mutex");
    expect(otherOptions(mutex, undefined)).toEqual({ options: [], step2: [] });
    const others = otherOptions(mutex, { primary: "constrained-random" });
    expect(others.options.map((o) => o.id)).toEqual(["directed", "emulation", "equivalence", "cdc", "power-aware"]);
    expect(others.step2).toEqual([]);
    // With the pick and the correct bins, every option of every card is explained somewhere.
    for (const id of SCENARIO_DECK_IDS) {
      for (const c of deck(id).cards) {
        for (const pick of c.options) {
          const step = c.followUp && c.followUp.after === pick.id ? c.followUp.options[0].id : undefined;
          const listed = otherOptions(c, { primary: pick.id, followUp: step }).options.map((o) => o.id);
          const explained = new Set([pick.id, ...answerIds(c), ...listed]);
          expect([...explained].sort(), `${id}/${c.id}/${pick.id}`).toEqual(c.options.map((o) => o.id).sort());
        }
      }
    }
  });

  it("'Why not the others?' lists a second step's other options only once that step was answered", () => {
    const c = card("ipc-tools", "two-ahead");
    expect(otherOptions(c, { primary: "bounded-mailbox" })).toEqual({ options: [], step2: [] });
    expect(otherOptions(c, { primary: "bounded-mailbox", followUp: "new-3" }).step2.map((o) => o.id)).toEqual(["new-1"]);
    expect(otherOptions(c, { primary: "bounded-mailbox", followUp: "new-2" }).step2.map((o) => o.id)).toEqual(["new-1", "new-3"]);
    // A different first pick never opened the step, so none of its options are listed.
    expect(otherOptions(c, { primary: "mailbox" }).step2).toEqual([]);
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fillTemplate("You chose the best structure in {correct} of {total} scenarios.", { correct: 5, total: 6 })).toBe("You chose the best structure in 5 of 6 scenarios.");
    expect(fillTemplate("{missing}", {})).toBe("{missing}");
  });
});

describe("lesson subsets: cards and bins", () => {
  const F1B_FIRST_BINS = ["directed", "constrained-random", "formal", "emulation", "equivalence"];

  it("keeps only the bins a lesson asks for, in the deck's order, and reports unknown ones", () => {
    const { cards, unknown, unknownBins, unanswerable } = selectCards(deck("verification-methods"), ["mutex", "netlist"], ["formal", "directed", "equivalence", "constrained-random", "emulation", "no-such-bin"]);
    expect(unknown).toEqual([]);
    expect(unknownBins).toEqual(["no-such-bin"]);
    expect(unanswerable).toEqual([]);
    for (const c of cards) expect(c.options.map((o) => o.id), c.id).toEqual(F1B_FIRST_BINS);
    // The deck itself is untouched.
    expect(card("verification-methods", "mutex").options).toHaveLength(7);
  });

  it("drops, and reports, a card whose every correct bin is hidden", () => {
    const { cards, unanswerable } = selectCards(deck("verification-methods"), ["mutex", "async-fifo", "retention"], F1B_FIRST_BINS);
    expect(cards.map((c) => c.id)).toEqual(["mutex"]);
    expect(unanswerable).toEqual(["async-fifo", "retention"]);
  });

  it("keeps a second step while its bin is shown, and drops it when its bin is hidden", () => {
    const { cards: methods } = selectCards(deck("verification-methods"), ["async-fifo"], ["cdc", "constrained-random", "formal"]);
    expect(methods[0].followUp?.after).toBe("cdc");
    // A card with a second correct bin stays answerable when the step's bin is hidden.
    const lateMonitor = card("ipc-tools", "late-monitor");
    const twoAnswers: ScenarioDeck = {
      ...deck("ipc-tools"),
      cards: [{ ...lateMonitor, options: lateMonitor.options.map((o) => (o.id === "event" ? { ...o, verdict: "correct" as const } : o)) }],
    };
    const { cards, unanswerable } = selectCards(twoAnswers, undefined, ["event", "semaphore"]);
    expect(unanswerable).toEqual([]);
    expect(cards[0].options.map((o) => o.id)).toEqual(["event", "semaphore"]);
    expect(cards[0].followUp).toBeUndefined();
    expect(isAnswerComplete(cards[0], { primary: "event" })).toBe(true);
  });

  it("a second step offers only the kept bins too, and goes when it would have no correct option or a single one", () => {
    const methods = deck("verification-methods");
    const step2Ids = (bins: string[]) => selectCards(methods, ["async-fifo"], bins).cards[0].followUp?.options.map((o) => o.id);
    // Equivalence checking is hidden from the first step, so the second step does not offer it either.
    expect(step2Ids(["cdc", "constrained-random", "formal"])).toEqual(["constrained-random", "formal"]);
    expect(step2Ids(["cdc", "constrained-random", "formal", "equivalence"])).toEqual(["constrained-random", "formal", "equivalence"]);
    // Formal hidden: the step would have no correct option, so it goes and CDC analysis alone is correct.
    const [noFormal] = selectCards(methods, ["async-fifo"], ["cdc", "constrained-random", "equivalence"]).cards;
    expect(noFormal.followUp).toBeUndefined();
    expect(gradeAnswer(noFormal, { primary: "cdc" })).toBe("correct");
    // Only formal left: a one-option step would give itself away, so it goes.
    expect(selectCards(methods, ["async-fifo"], ["cdc", "formal"]).cards[0].followUp).toBeUndefined();
    // Step options that are not bins (key counts) are never filtered.
    const [sharedBus] = selectCards(deck("ipc-tools"), ["shared-bus"], ["semaphore", "event"]).cards;
    expect(sharedBus.followUp?.options.map((o) => o.id)).toEqual(["new-0", "new-1", "new-2"]);
    // The deck itself is untouched.
    expect(card("verification-methods", "async-fifo").followUp?.options).toHaveLength(3);
  });

  it("without bins, every bin of the deck is offered", () => {
    const { cards, unknownBins, unanswerable } = selectCards(deck("verification-methods"), ["mutex"]);
    expect(cards[0].options).toHaveLength(7);
    expect(unknownBins).toEqual([]);
    expect(unanswerable).toEqual([]);
  });
});

/**
 * The embeds this item documents for each lesson (the mdxUsage of its report).
 * The content sweep below checks whatever the lessons really contain.
 */
const LESSON_PRESETS: { lesson: string; deck: ScenarioDeckId; cards?: string[]; bins?: string[] }[] = [
  {
    lesson: "F1B How the methods combine",
    deck: "verification-methods",
    // Six jobs over five bins (formal answers two), so the last card cannot be answered by elimination.
    cards: ["mutex", "bring-up", "netlist", "no-starvation", "mixed-traffic", "boot-os"],
    // CDC analysis and power-aware simulation are taught only in the bug taxonomy, later in the lesson.
    bins: ["directed", "constrained-random", "formal", "emulation", "equivalence"],
  },
  { lesson: "F1B bug taxonomy", deck: "verification-methods", cards: ["rare-bin", "async-fifo", "retention"] },
  { lesson: "F1C Drill: problem to feature", deck: "sv-features" },
  { lesson: "F1C UVM: a separate standard and a library", deck: "uvm-name-layers" },
  { lesson: "F1C compile-failure symptoms", deck: "uvm-compile-triage" },
  { lesson: "F2D ipc Choosing the right tool", deck: "ipc-tools" },
  { lesson: "F2D tasks-functions Functions: one value in zero time", deck: "function-body" },
  { lesson: "F2D tasks-functions Choosing a task or a function", deck: "task-or-function" },
  { lesson: "F2E Pass and fail signals a regression can trust", deck: "regression-log" },
  { lesson: "F2B (PacketSorterGame)", deck: "containers" },
];

describe("card order never gives the answer away", () => {
  it("measures the longest run of cards that share a correct bin", () => {
    const fb = deck("function-body");
    const ids = (list: string[]) => selectCards(fb, list).cards;
    // The order the deck had before: five illegal statements in a row.
    expect(longestAnswerStreak(ids(["delay", "edge", "wait", "fork-join", "fork-join-any", "fork-join-none"]))).toBe(5);
    expect(longestAnswerStreak(ids(["delay", "nba", "edge"]))).toBe(1);
    // A card with two correct bins continues a run through either one.
    const methods = deck("verification-methods");
    expect(longestAnswerStreak(selectCards(methods, ["bring-up", "rare-bin", "mutex"]).cards)).toBe(2);
    expect(longestAnswerStreak([])).toBe(0);
  });

  it.each(SCENARIO_DECK_IDS)("%s: the default order has no more than two cards in a row with the same answer", (id) => {
    expect(longestAnswerStreak(deck(id).cards)).toBeLessThanOrEqual(2);
  });

  it("measures runs of the correct button's position: the same button, or one place along", () => {
    const fake = (positions: number[][]): SorterCard[] =>
      positions.map((ps, i): SorterCard => ({
        id: `c${i}`,
        prompt: "p",
        source: [{ kind: "industry-practice", ref: "test" }],
        options: [0, 1, 2, 3].map((k) => ({ id: `o${k}`, label: `o${k}`, verdict: ps.includes(k) ? "correct" : "wrong", feedback: "feedback long enough to pass" })),
      }));
    expect(longestPositionRun(fake([[0], [0], [0]]), 0)).toBe(3);
    expect(longestPositionRun(fake([[0], [1], [2], [3]]), 1)).toBe(4);
    expect(longestPositionRun(fake([[3], [2], [1]]), -1)).toBe(3);
    expect(longestPositionRun(fake([[2], [1], [2]]), 1)).toBe(2);
    // A card with two correct options continues a run through either one.
    expect(longestPositionRun(fake([[0], [1, 3], [2]]), 1)).toBe(3);
    expect(longestPositionRun([], 1)).toBe(0);
  });

  it.each(SCENARIO_DECK_IDS)("%s: the correct button is not the same on every card, and never steps one place along for three cards", (id) => {
    const cards = deck(id).cards;
    const positions = cards.map(correctPositions);
    const onEveryCard = positions.reduce((common, ps) => common.filter((p) => ps.includes(p)), positions[0]);
    expect(onEveryCard, JSON.stringify(positions)).toEqual([]);
    for (const step of [-1, 0, 1] as const) expect(longestPositionRun(cards, step), `step ${step}: ${JSON.stringify(positions)}`).toBeLessThanOrEqual(2);
  });

  it("function-body and uvm-name-layers mix their answers instead of grouping them", () => {
    expect(deck("function-body").cards.map((c) => answerIds(c)[0])).toEqual([
      "illegal",
      "legal",
      "illegal",
      "illegal",
      "legal",
      "legal",
      "illegal",
      "legal",
      "illegal",
      "illegal",
      "legal",
      "illegal",
    ]);
    const layers = deck("uvm-name-layers").cards.map((c) => answerIds(c)[0]);
    expect(layers.slice(0, 3)).toEqual(["ieee-1800", "ieee-1800-2", "ieee-1800"]);
    expect(layers.filter((b) => b === "uvm-core")).toHaveLength(2);
    expect(layers).toHaveLength(13);
  });

  it.each(LESSON_PRESETS.map((p) => [p.lesson, p] as const))("documented preset %s: valid ids, no streak above two, no stepping button", (_lesson, preset) => {
    const { cards, unknown, unknownBins, unanswerable } = selectCards(deck(preset.deck), preset.cards, preset.bins);
    expect(unknown).toEqual([]);
    expect(unknownBins).toEqual([]);
    expect(unanswerable).toEqual([]);
    expect(cards.length).toBeGreaterThan(0);
    expect(longestAnswerStreak(cards)).toBeLessThanOrEqual(2);
    for (const step of [-1, 0, 1] as const) expect(longestPositionRun(cards, step), `step ${step}`).toBeLessThanOrEqual(2);
  });

  it("the F1B methods preset reuses a bin, so its last card cannot be answered by elimination", () => {
    const preset = LESSON_PRESETS[0];
    const { cards } = selectCards(deck(preset.deck), preset.cards, preset.bins);
    const answers = cards.map((c) => answerIds(c)[0]);
    expect(new Set(answers).size).toBeLessThan(answers.length);
  });

  it("the first F1B embed offers no bin the lesson has not taught yet", () => {
    const preset = LESSON_PRESETS[0];
    const { cards } = selectCards(deck(preset.deck), preset.cards, preset.bins);
    for (const c of cards) {
      expect(c.options.map((o) => o.id), c.id).not.toContain("cdc");
      expect(c.options.map((o) => o.id), c.id).not.toContain("power-aware");
    }
  });
});

/* ------------------------------------------------------------------------- */
/* Content sweep: every <ScenarioSorter> in the lessons names real data       */
/* ------------------------------------------------------------------------- */

type MdxNode = {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdxNode[];
  children?: MdxNode[];
  position?: { start: { line: number } };
};

interface SorterEmbed {
  where: string;
  props: Record<string, unknown>;
  errors: string[];
}

const CURRICULUM = path.join(process.cwd(), "content", "curriculum");
const SORTER_PROPS = new Set(["deck", "cards", "bins", "title", "testIdPrefix"]);

function mdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdxFiles(full));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out.sort();
}

/** Props in lesson MDX are literal data (strings and arrays of strings). */
function evaluate(code: string): unknown {
  return new Function(`"use strict"; return (${code});`)();
}

function sorterEmbeds(file: string): SorterEmbed[] {
  return sorterEmbedsIn(fs.readFileSync(file, "utf8"), path.relative(process.cwd(), file));
}

function sorterEmbedsIn(raw: string, rel: string): SorterEmbed[] {
  if (!raw.includes("<ScenarioSorter")) return [];
  const body = matter(raw).content;
  const offset = body.length ? raw.slice(0, raw.length - body.length).split("\n").length - 1 : 0;
  let tree: MdxNode;
  try {
    tree = unified().use(remarkParse).use(remarkMdx).parse(body) as unknown as MdxNode;
  } catch (error) {
    return [{ where: rel, props: {}, errors: [`the MDX does not parse, so its ScenarioSorter cannot be checked: ${(error as Error).message}`] }];
  }
  const out: SorterEmbed[] = [];
  const visit = (node: MdxNode) => {
    if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "ScenarioSorter") {
      const embed: SorterEmbed = { where: `${rel}:${(node.position?.start.line ?? 0) + offset}`, props: {}, errors: [] };
      for (const attr of node.attributes ?? []) {
        if (attr.type !== "mdxJsxAttribute") {
          embed.errors.push("spread attributes cannot be checked");
          continue;
        }
        const name = String(attr.name);
        if (!SORTER_PROPS.has(name)) embed.errors.push(`unknown prop "${name}"`);
        const value = attr.value as string | null | { value: string };
        if (value === null || value === undefined || typeof value === "string") embed.props[name] = value;
        else {
          try {
            embed.props[name] = evaluate(value.value);
          } catch (error) {
            embed.errors.push(`prop ${name} is not literal data: ${(error as Error).message}`);
          }
        }
      }
      out.push(embed);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return out;
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function checkEmbed(embed: SorterEmbed): string[] {
  const errors = [...embed.errors];
  const { deck: deckId, cards, bins, title, testIdPrefix } = embed.props;
  const data = typeof deckId === "string" ? getScenarioDeck(deckId) : undefined;
  if (!data) return [...errors, `unknown deck ${JSON.stringify(deckId)}`];
  if (cards !== undefined && !isStringList(cards)) errors.push("cards must be an array of card ids");
  if (bins !== undefined && !isStringList(bins)) errors.push("bins must be an array of bin ids");
  if (title !== undefined && typeof title !== "string") errors.push("title must be a string");
  if (testIdPrefix !== undefined && typeof testIdPrefix !== "string") errors.push("testIdPrefix must be a string");
  const selection = selectCards(data, isStringList(cards) ? cards : undefined, isStringList(bins) ? bins : undefined);
  if (selection.unknown.length) errors.push(`no card ${selection.unknown.join(", ")} in deck ${data.id}`);
  if (selection.unknownBins.length) errors.push(`no bin ${selection.unknownBins.join(", ")} in deck ${data.id}`);
  if (selection.unanswerable.length) errors.push(`bins hide every correct bin of ${selection.unanswerable.join(", ")}`);
  if (selection.cards.length === 0) errors.push("no cards to show");
  const streak = longestAnswerStreak(selection.cards);
  if (streak > 2) errors.push(`${streak} cards in a row share an answer: reorder the cards`);
  for (const step of [-1, 1] as const) {
    const run = longestPositionRun(selection.cards, step);
    if (run > 2) errors.push(`${run} cards in a row put the answer one button ${step > 0 ? "further on" : "further back"}: reorder the cards`);
  }
  return errors;
}

describe("content sweep: every ScenarioSorter in content/curriculum names a real deck, cards and bins", () => {
  const files = mdxFiles(CURRICULUM);
  const embeds = files.flatMap(sorterEmbeds);

  it("reads the lesson MDX", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("reads string and literal props from MDX, after front matter, and skips code fences", () => {
    const mdx = [
      "---",
      "title: Sample",
      "---",
      "",
      "Some text.",
      "",
      "<ScenarioSorter deck='verification-methods' cards={[\"mutex\", \"netlist\"]} bins={[\"formal\", \"equivalence\"]} />",
      "",
      "```tsx",
      '<ScenarioSorter deck="not-checked-inside-a-fence" />',
      "```",
      "",
      '<ScenarioSorter deck="ipc-tools" title="Pick the IPC tool" />',
    ].join("\n");
    const found = sorterEmbedsIn(mdx, "sample.mdx");
    expect(found.map((e) => [e.where, e.props])).toEqual([
      ["sample.mdx:7", { deck: "verification-methods", cards: ["mutex", "netlist"], bins: ["formal", "equivalence"] }],
      ["sample.mdx:13", { deck: "ipc-tools", title: "Pick the IPC tool" }],
    ]);
    expect(found.flatMap(checkEmbed)).toEqual([]);
    expect(sorterEmbedsIn('<ScenarioSorter deck="ipc-tools" card={["every-txn"]} />', "typo.mdx").flatMap(checkEmbed)).toEqual(['unknown prop "card"']);
  });

  it("the checker catches the mistakes it exists for", () => {
    const bad = (props: Record<string, unknown>) => checkEmbed({ where: "test", props, errors: [] }).join("\n");
    expect(bad({ deck: "ipc-tool" })).toMatch(/unknown deck "ipc-tool"/);
    expect(bad({ deck: "ipc-tools", cards: ["every-txn", "no-such-card"] })).toMatch(/no card no-such-card in deck ipc-tools/);
    expect(bad({ deck: "verification-methods", cards: ["async-fifo"], bins: ["directed", "formal"] })).toMatch(/bins hide every correct bin of async-fifo/);
    expect(bad({ deck: "function-body", cards: ["delay", "edge", "wait"] })).toMatch(/3 cards in a row share an answer/);
    // The drill's own order walks down the bins: card k's answer is bin k.
    expect(bad({ deck: "sv-features", cards: ["reuse-driver", "legal-bursts", "burst-lengths", "gnt-within-3"] })).toMatch(/4 cards in a row put the answer one button further on/);
    expect(bad({ deck: "regression-log", cards: "clean" })).toMatch(/cards must be an array/);
    expect(bad({ deck: "sv-features" })).toBe("");
  });

  it("finds no unknown deck, card or bin id, and no streak above two, in any lesson", () => {
    const findings = embeds.flatMap((e) => checkEmbed(e).map((msg) => `${e.where}: ${msg}`));
    expect(findings, `ScenarioSorter embeds that would show learners a "Deck data error" or a giveaway order:\n${findings.join("\n")}`).toEqual([]);
  });

  // The sweep above passes vacuously while no lesson embeds the component. An embed
  // renders only if ScenarioSorter is an MDX interactive (src/components/mdx/
  // lazy-mdx-interactives.ts, with its loader in LazyMdxInteractive.tsx), so the
  // first embed fails here until it is registered. Once lessons embed the decks,
  // pin their number here too, so a lost embed is caught.
  it("every lesson that embeds ScenarioSorter can render it: the component is registered as an MDX interactive", () => {
    const registered = (lazyMdxInteractiveNames as readonly string[]).includes("ScenarioSorter");
    const where = embeds.map((e) => e.where);
    if (where.length > 0) expect(registered, `ScenarioSorter is embedded at ${where.join(", ")} but not registered as an MDX interactive`).toBe(true);
    expect(registered).toBe(true);
    // The embeds that exist today, by deck; add each new lesson's deck here.
    const decks = embeds.map((e) => `${e.where.replace(/:\d+$/, "")} ${String(e.props.deck)}`).sort();
    expect(decks).toEqual([path.join("content", "curriculum", "T1_Foundational", "F1B_The_Verification_Mindset", "index.mdx") + " verification-methods"]);
    // PacketSorterGame, the containers deck's wrapper, is registered and embedded in F2B today.
    expect(lazyMdxInteractiveNames).toContain("PacketSorterGame");
    const f2b = files.find((f) => f.includes("F2B_Dynamic_Structures"));
    expect(f2b && fs.readFileSync(f2b, "utf8").includes("<PacketSorterGame />")).toBe(true);
  });
});
