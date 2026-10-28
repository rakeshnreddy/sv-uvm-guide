/**
 * ScenarioSorter decks: plain data for one classification drill in which every
 * option explains itself, plus the pure grading rules the component renders.
 *
 * Each deck sorts scenario cards into bins. A card has at least one correct
 * bin, may mark some bins as partly correct, and may ask a second step (a
 * follow-up) after a specific correct bin is picked, such as a semaphore's key
 * count or a mailbox's bound. Every card names its source: a clause of
 * IEEE 1800-2023 or IEEE 1800.2-2020, a file of uvm-core 2020.3.1, or, where no
 * standard decides the question, "industry practice" from the lesson itself.
 *
 * No React here: the component in src/components/visuals/ScenarioSorter.tsx
 * renders what these functions return.
 */

export type ScenarioDeckId =
  | "containers"
  | "verification-methods"
  | "sv-features"
  | "uvm-name-layers"
  | "uvm-compile-triage"
  | "ipc-tools"
  | "function-body"
  | "task-or-function"
  | "regression-log";

export const SCENARIO_DECK_IDS: readonly ScenarioDeckId[] = [
  "containers",
  "verification-methods",
  "sv-features",
  "uvm-name-layers",
  "uvm-compile-triage",
  "ipc-tools",
  "function-body",
  "task-or-function",
  "regression-log",
];

export type Verdict = "correct" | "partial" | "wrong";

export type SourceKind = "ieee-1800-2023" | "ieee-1800.2-2020" | "uvm-core-2020.3.1" | "industry-practice";

export interface SourceRef {
  kind: SourceKind;
  /** A clause ("§15.5.2", "Clause 8"), a uvm-core file, or the lesson section for industry practice. */
  ref: string;
}

export const SOURCE_LABELS: Record<SourceKind, string> = {
  "ieee-1800-2023": "IEEE 1800-2023",
  "ieee-1800.2-2020": "IEEE 1800.2-2020",
  "uvm-core-2020.3.1": "uvm-core 2020.3.1",
  "industry-practice": "Industry practice",
};

export function formatSource(source: SourceRef): string {
  return source.kind === "industry-practice" ? `Industry practice (${source.ref})` : `${SOURCE_LABELS[source.kind]} ${source.ref}`;
}

export interface SorterBin {
  id: string;
  label: string;
  /** Render the label as code. */
  mono?: boolean;
  /** Default diagnosis when this bin is picked for a card it does not fit. */
  whenWrong: string;
}

export interface SorterOption {
  id: string;
  label: string;
  mono?: boolean;
  verdict: Verdict;
  /** Why this option fits, partly fits, or does not fit this card. */
  feedback: string;
}

export interface SorterFollowUp {
  /** The (correct) primary bin whose pick opens this second step. */
  after: string;
  question: string;
  options: SorterOption[];
}

export type AnchorId = "constraint" | "coverage" | "assertion" | "class" | "package" | "interface";

export interface StackFault {
  /** The compile-stack layer (a bin id) the symptom points at. */
  layer: string;
  /** Short status drawn beside the struck-out layer, e.g. "missing from my_test.sv". */
  status: string;
}

export interface SorterCard {
  id: string;
  prompt: string;
  /** A few words for the summary grid. */
  short?: string;
  /** Code or a message shown with the prompt, before the learner commits. */
  code?: string;
  codeLabel?: string;
  /** Log lines shown with the prompt (regression-log); the matcher runs on each one. */
  log?: string[];
  /** Whether the run behind `log` really passed (regression-log). */
  reallyPassed?: boolean;
  options: SorterOption[];
  followUp?: SorterFollowUp;
  /** Idiomatic code shown after the reveal. */
  answerCode?: string;
  /** A limit of the answer the learner must not miss (shown after the reveal). */
  caveat?: string;
  /** The defining clause or file (uvm-name-layers). */
  definedIn?: string;
  /** Static picture shown after the reveal (sv-features). */
  anchor?: AnchorId;
  /** A line under the picture's caption that ties the shared example to this card. */
  anchorNote?: string;
  /** The compile-stack layer to strike out in the reveal (uvm-compile-triage). */
  stack?: StackFault;
  source: SourceRef[];
}

/** A split or grid that the deck's bins fall into (sv-features halves, regression-log 2x2). */
export interface SorterAxis {
  title: string;
  rowLabel?: string;
  rows: { id: string; label: string }[];
  columnLabel?: string;
  columns: { id: string; label: string }[];
  /** The cell each bin occupies. */
  cells: Record<string, { row: string; column: string }>;
  note?: string;
}

/** UI text. Placeholders in braces are filled by the component. */
export interface DeckCopy {
  eyebrow: string;
  itemNoun: string;
  groupLabel: string;
  correctLead: string;
  partialLead: string;
  wrongLead: string;
  /** {label} */
  bestLead: string;
  /** {label} */
  alsoLead: string;
  bestBadge: string;
  chosenBadge: string;
  partialBadge: string;
  /** Marks the learner's own pick after the reveal, beside a ✓ or ◐ badge. */
  pickBadge: string;
  /** The reveal's toggle for the options it has not explained yet. */
  othersToggle: string;
  /** Beside the PREDICT chip, before the commit. */
  predictHint: string;
  next: string;
  finish: string;
  restart: string;
  /** {correct} {answered} */
  progress: string;
  /** {correct} {total} */
  score: string;
  allCorrect: string;
  review: string;
}

export const DEFAULT_SORTER_COPY: DeckCopy = {
  eyebrow: "Practice",
  itemNoun: "card",
  groupLabel: "Bins",
  correctLead: "Correct. ",
  partialLead: "Partly right. ",
  wrongLead: "Not the best fit. ",
  bestLead: "Best choice, {label}: ",
  alsoLead: "Also correct, {label}: ",
  bestBadge: "✓ best choice",
  chosenBadge: "✕ your choice",
  partialBadge: "◐ partly right",
  pickBadge: "• your pick",
  othersToggle: "Why not the others?",
  predictHint: "Commit one pick. The answer stays hidden until you do.",
  next: "Next card",
  finish: "See results",
  restart: "Try again",
  progress: "{correct} correct of {answered} answered",
  score: "You sorted {correct} of {total} cards correctly.",
  allCorrect: "Every pick matched the answer.",
  review: "Review the cards marked ✕ or ◐ below: each one names the rule behind the better choice.",
};

export interface ScenarioDeck {
  id: ScenarioDeckId;
  /** Accessible name of the whole visual. */
  label: string;
  title: string;
  summary: string;
  fidelity: "illustration" | "model";
  assumptions?: string[];
  bins: SorterBin[];
  cards: SorterCard[];
  axis?: SorterAxis;
  copy?: Partial<DeckCopy>;
}

export function resolveCopy(deck: ScenarioDeck): DeckCopy {
  return { ...DEFAULT_SORTER_COPY, ...deck.copy };
}

/** Fill {name} placeholders. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/* ------------------------------------------------------------------------- */
/* Card builders                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Lists a deck's cards in the order a learner meets them. The definitions stay
 * grouped by answer for review; the order mixes the answers, so that no answer
 * runs more than twice in a row and a streak never gives the next card away.
 * Every card must be named exactly once.
 */
function inOrder(cards: SorterCard[], ids: readonly string[]): SorterCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const unnamed = cards.filter((c) => !ids.includes(c.id)).map((c) => c.id);
  const unknown = ids.filter((id) => !byId.has(id));
  if (unnamed.length > 0 || unknown.length > 0 || new Set(ids).size !== ids.length) {
    throw new Error(`ScenarioSorter card order must name each card once (unnamed: ${unnamed.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`);
  }
  return ids.map((id) => byId.get(id) as SorterCard);
}

interface BinCardSpec extends Omit<SorterCard, "options"> {
  correct: string[];
  /** Explanation for the correct bin(s); a record gives each correct bin its own. */
  why: string | Record<string, string>;
  /** Partly correct bins, each with its diagnosis. */
  partial?: Record<string, string>;
  /** Card-specific diagnoses for wrong bins (otherwise the bin's default). */
  feedback?: Record<string, string>;
}

/** One option per deck bin, so every card offers every bin and every option explains itself. */
function binCard(bins: SorterBin[], spec: BinCardSpec): SorterCard {
  const { correct, why, partial = {}, feedback = {}, ...card } = spec;
  const known = new Set(bins.map((b) => b.id));
  const referenced = [...correct, ...Object.keys(partial), ...Object.keys(feedback), ...(typeof why === "string" ? [] : Object.keys(why))];
  const unknown = referenced.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`ScenarioSorter card "${spec.id}" names unknown bin id(s): ${unknown.join(", ")}`);
  }
  return {
    ...card,
    options: bins.map((bin) => {
      const verdict: Verdict = correct.includes(bin.id) ? "correct" : bin.id in partial ? "partial" : "wrong";
      const text =
        verdict === "correct" ? (typeof why === "string" ? why : why[bin.id]) : verdict === "partial" ? partial[bin.id] : feedback[bin.id] ?? bin.whenWrong;
      return { id: bin.id, label: bin.label, ...(bin.mono ? { mono: true } : {}), verdict, feedback: text ?? "" };
    }),
  };
}

/* ------------------------------------------------------------------------- */
/* containers (F2B): today's PacketSorterGame data, options reordered        */
/* ------------------------------------------------------------------------- */

const CONTAINER_BINS: SorterBin[] = [
  { id: "queue", label: "Queue", mono: true, whenWrong: "A queue is an ordered, variable-size unpacked array with push and pop at both ends (§7.10)." },
  { id: "dynamic-array", label: "Dynamic array", mono: true, whenWrong: "A dynamic array is sized at run time with new[] and indexed from 0 (§7.5)." },
  { id: "associative-array", label: "Associative array", mono: true, whenWrong: "An associative array stores entries only for the keys you write (§7.8)." },
  { id: "fixed-size-array", label: "Fixed-size array", mono: true, whenWrong: "A fixed-size array has its size fixed at elaboration (§7.4)." },
  { id: "bounded-7", label: "item_t buf[$:7]", mono: true, whenWrong: "A queue bounded to indices 0..7 (§7.10.5)." },
  { id: "bounded-8", label: "item_t buf[$:8]", mono: true, whenWrong: "A queue bounded to indices 0..8 (§7.10.5)." },
  { id: "unbounded", label: "item_t buf[$]", mono: true, whenWrong: "An unbounded queue grows without limit (§7.10)." },
  { id: "packed", label: "logic [3:0][7:0] mirror", mono: true, whenWrong: "Packed dimensions form one vector (§7.4.1)." },
  { id: "unpacked", label: "logic [7:0] mirror [4]", mono: true, whenWrong: "An unpacked array is a collection of elements, not a vector (§7.4.2)." },
];

interface ContainerOptionSpec {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

function containerCard(spec: { id: string; prompt: string; options: ContainerOptionSpec[]; code: string; source: SourceRef[] }): SorterCard {
  return {
    id: spec.id,
    prompt: spec.prompt,
    options: spec.options.map((o) => ({ id: o.id, label: o.label, mono: true, verdict: o.correct ? "correct" : "wrong", feedback: o.feedback })),
    answerCode: spec.code,
    source: spec.source,
  };
}

const lrm = (ref: string): SourceRef => ({ kind: "ieee-1800-2023", ref });
const uvmStd = (ref: string): SourceRef => ({ kind: "ieee-1800.2-2020", ref });
const uvmCore = (ref: string): SourceRef => ({ kind: "uvm-core-2020.3.1", ref });
const practice = (ref: string): SourceRef => ({ kind: "industry-practice", ref });

/**
 * The six scenarios, prompts and feedback are the standalone game's, unchanged.
 * Only the order of each scenario's options changed: the game always listed the
 * best option first, so pressing the first button scored 6 of 6. The best one
 * now sits second, first, third, second, third and first.
 */
const CONTAINERS_DECK: ScenarioDeck = {
  id: "containers",
  label: "Structure choice practice",
  title: "Pick the container",
  summary: "Choose the structure an experienced verification engineer would reach for. Every option explains itself after you answer.",
  fidelity: "illustration",
  bins: CONTAINER_BINS,
  copy: {
    itemNoun: "scenario",
    groupLabel: "Options",
    next: "Next scenario",
    score: "You chose the best structure in {correct} of {total} scenarios.",
    allCorrect: "Every choice matched the idiomatic answer.",
    review: "Review the scenarios marked ✕ below: each one names the rule behind the better choice.",
  },
  cards: [
    containerCard({
      id: "in-order",
      prompt: "Packets arrive one at a time and must be processed in arrival order. Which structure holds them?",
      options: [
        { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "A dynamic array cannot grow one element at a time. You would reallocate with new[n+1](arr) per packet and track a read index yourself." },
        { id: "queue", label: "Queue", correct: true, feedback: "push_back on arrival, pop_front to process: FIFO order with no index bookkeeping (§7.10)." },
        { id: "associative-array", label: "Associative array", correct: false, feedback: "It works only if you invent sequence-number keys. A queue gives you arrival order for free." },
      ],
      code: "pkt_t pkt_q[$];\npkt_q.push_back(p);      // monitor\np = pkt_q.pop_front();   // checker",
      source: [lrm("§7.10"), lrm("§7.10.2")],
    }),
    containerCard({
      id: "sparse",
      prompt: "You store error packets indexed by their 32-bit error ID. Only a handful of IDs ever occur. Which structure?",
      options: [
        { id: "associative-array", label: "Associative array", correct: true, feedback: "Entries exist only for IDs you write, and exists() checks membership without a warning (§7.8, §7.9.3)." },
        { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Indexing by a 32-bit ID would need new[2**32] elements to hold the largest ID." },
        { id: "queue", label: "Queue", correct: false, feedback: "Every lookup would be a linear search with find_first_index. Associative arrays look up by key." },
      ],
      code: "pkt_t err_pkts[bit [31:0]];\nerr_pkts[p.err_id] = p;\nif (err_pkts.exists(id)) ...",
      source: [lrm("§7.8"), lrm("§7.9.3")],
    }),
    containerCard({
      id: "unknown-count",
      prompt: "You collect every packet length for statistics at the end of the test. You do not know how many packets will arrive. Which structure?",
      options: [
        { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Dynamic arrays have no push_back. You would write lens = new[lens.size()+1](lens) for every packet: a reallocate-and-copy each time (§7.5.1)." },
        { id: "associative-array", label: "Associative array", correct: false, feedback: "It works with a counter as the key, but you invent and manage an index that a queue provides for free." },
        { id: "queue", label: "Queue", correct: true, feedback: "push_back grows the queue by one each time. At the end, lens.sum() with (int'(item)) and friends work on it directly." },
      ],
      code: "int lens[$];\nlens.push_back(p.len);           // per packet\ntotal = lens.sum() with (int'(item));",
      source: [lrm("§7.10.2"), lrm("§7.5.1"), lrm("§7.12.3")],
    }),
    containerCard({
      id: "known-at-runtime",
      prompt: "A plusarg tells you at run time that there are N lanes. Lane results arrive in any order and you write each one by lane number. Which structure?",
      options: [
        { id: "queue", label: "Queue", correct: false, feedback: "Writing q[5] when size() is 2 is an invalid index: the write is ignored (§7.4.5). Queues fit in-order filling." },
        { id: "dynamic-array", label: "Dynamic array", correct: true, feedback: "new[N] creates exactly N default-initialized slots, so lane_res[lane] = v is valid in any order (§7.5.1)." },
        { id: "fixed-size-array", label: "Fixed-size array", correct: false, feedback: "A fixed-size array needs its size at elaboration. N is only known at run time." },
      ],
      code: "int lane_res[];\nlane_res = new[n_lanes];   // all 0 (int is 2-state)\nlane_res[lane] = result;",
      source: [lrm("§7.5.1"), lrm("§7.4.5")],
    }),
    containerCard({
      id: "bounded",
      prompt: "A stimulus buffer may hold at most 8 pending items. A ninth must be dropped, and the tool must tell you. Which declaration?",
      options: [
        { id: "unbounded", label: "item_t buf[$]", correct: false, feedback: "An unbounded queue just grows. Nothing is dropped and nothing warns." },
        { id: "bounded-8", label: "item_t buf[$:8]", correct: false, feedback: "Off by one: [$:8] allows indices 0..8, which is nine items." },
        { id: "bounded-7", label: "item_t buf[$:7]", correct: true, feedback: "The bound is the last legal index, so [$:7] holds 8 items. A ninth push_back is discarded with a required warning (§7.10.5)." },
      ],
      code: "item_t buf[$:7];                // indices 0..7: at most 8 items\nif (buf.size() == 8) n_drops++;  // count drops yourself if you need them\nbuf.push_back(it);              // a 9th item is discarded with a warning",
      source: [lrm("§7.10.5")],
    }),
    containerCard({
      id: "packed",
      prompt: "A register mirror must line up bit-for-bit with a 32-bit bus so you can assign the whole bus to it in one statement. Which declaration?",
      options: [
        { id: "packed", label: "logic [3:0][7:0] mirror", correct: true, feedback: "Packed dimensions form one 32-bit vector, so mirror = bus; works and mirror[2] is byte 2 (§7.4.1, §7.6)." },
        { id: "unpacked", label: "logic [7:0] mirror [4]", correct: false, feedback: "An unpacked array is not a vector: mirror = bus; does not compile without a cast or streaming operator (§7.6)." },
        { id: "queue", label: "logic [7:0] mirror [$]", correct: false, feedback: "A queue is an unpacked, variable-size array. It cannot be assigned from a vector either." },
      ],
      code: "logic [3:0][7:0] mirror;\nmirror = bus;           // one 32-bit assignment\nbyte2  = mirror[2];     // packed index selects byte 2",
      source: [lrm("§7.4.1"), lrm("§7.6")],
    }),
  ],
};

/** The PacketSorterGame challenge shape, kept for its existing tests and imports. */
export interface PacketSorterChallenge {
  id: string;
  prompt: string;
  options: { id: string; label: string; correct: boolean; feedback: string }[];
  code: string;
}

export const PACKET_SORTER_CHALLENGES: PacketSorterChallenge[] = CONTAINERS_DECK.cards.map((card) => ({
  id: card.id,
  prompt: card.prompt,
  options: card.options.map((o) => ({ id: o.id, label: o.label, correct: o.verdict === "correct", feedback: o.feedback })),
  code: card.answerCode ?? "",
}));

/* ------------------------------------------------------------------------- */
/* verification-methods (F1B): industry practice, no LRM clause               */
/* ------------------------------------------------------------------------- */

const METHOD_BINS: SorterBin[] = [
  { id: "directed", label: "Directed test", whenWrong: "A directed test checks the sequences you wrote, one by one. It finds only what somebody thought to write." },
  {
    id: "constrained-random",
    label: "Constrained-random simulation",
    whenWrong: "Constrained-random simulation samples many legal scenarios and needs checks and coverage to be useful. It samples the space; it proves nothing about all of it.",
  },
  {
    id: "formal",
    label: "Formal property verification",
    whenWrong: "Formal proves properties of a block within its assumptions. It does not run software, and large designs can exceed its capacity.",
  },
  {
    id: "emulation",
    label: "Emulation or FPGA prototyping",
    whenWrong:
      "Emulation runs the RTL compiled onto hardware, fast enough to run real software on a whole chip. It runs the same RTL, only faster: it adds no proof, and no model the RTL lacks.",
  },
  {
    id: "equivalence",
    label: "Equivalence checking",
    whenWrong: "Equivalence checking proves that two representations of the design, such as the netlist and the RTL, match. It cannot tell you whether the RTL itself is right.",
  },
  {
    id: "cdc",
    label: "CDC structural analysis",
    whenWrong: "Clock-domain-crossing (CDC) analysis looks for signals that cross between clocks without safe synchronization. It says nothing about function inside one clock domain.",
  },
  {
    id: "power-aware",
    label: "Power-aware simulation",
    whenWrong: "Power-aware simulation adds the power intent, written in UPF (IEEE 1801), to simulation. It matters when power domains switch off and on.",
  },
];

const VERIFICATION_METHODS_DECK: ScenarioDeck = {
  id: "verification-methods",
  label: "Verification method sorting practice",
  title: "Which method answers it?",
  summary:
    "Sort each verification job into the method that answers it. Commit a pick to see why it fits or not, and why the best method fits; “Why not the others?” explains the rest. A job that takes two methods asks for the second one after you pick the first.",
  fidelity: "illustration",
  assumptions: [
    "Industry practice, taken from this lesson's method table, its methods tour and its bug taxonomy. No IEEE standard says which method to use.",
    "Real projects combine methods; each card asks for the method that answers its question best.",
  ],
  bins: METHOD_BINS,
  cards: inOrder(
    [
    binCard(METHOD_BINS, {
      id: "mutex",
      short: "never two grants",
      prompt: "Prove that the 4-requester arbiter never gives two grants in the same cycle.",
      correct: ["formal"],
      why: "A proof covers every reachable state, within its assumptions. 'Never' is a question for formal: the lesson's split for the arbiter gives mutual exclusion to it.",
      feedback: {
        "constrained-random": "A random run checks the rule only on the cycles it happens to reach. 'Never' asks about every reachable state, which is what formal proves.",
        directed: "Directed tests check the cases you wrote; 'never' also covers the cases nobody wrote.",
      },
      source: [practice("F1B, How the methods combine")],
    }),
    binCard(METHOD_BINS, {
      id: "no-starvation",
      short: "no requester starves",
      prompt: "Prove that the 4-requester arbiter grants every request eventually: no requester starves.",
      correct: ["formal"],
      why: "'Every request, eventually' is a claim about every possible run of the arbiter, with no time limit: a proof can answer it, a simulation run cannot. The lesson's split for the arbiter gives no starvation to formal, under assumptions that match how the real requesters behave.",
      feedback: {
        "constrained-random":
          "A random run sees only the request patterns it happens to reach, and it ends: it can check that those requests were granted within some number of cycles, not that every request is granted eventually.",
        directed: "Directed tests check the request patterns you wrote; 'every request' also covers the patterns nobody wrote.",
      },
      source: [practice("F1B, How the methods combine")],
    }),
    binCard(METHOD_BINS, {
      id: "bring-up",
      short: "bring-up",
      prompt: "Bring the arbiter up with a single request and check that it is granted.",
      correct: ["directed"],
      why: "Deterministic and easy to debug. The lesson's split brings the block up with directed tests: one request, then all four at once.",
      feedback: {
        "constrained-random": "Random stimulus at bring-up makes the first failures hard to debug. Start with one known sequence.",
        formal: "Formal could prove the grant, but bring-up is about getting one known sequence working end to end in the bench.",
      },
      source: [practice("F1B, How the methods combine")],
    }),
    binCard(METHOD_BINS, {
      id: "mixed-traffic",
      short: "long mixed traffic",
      prompt: "Run long, mixed request patterns with back-pressure while a scoreboard checks every grant.",
      correct: ["constrained-random"],
      why: "One test, many legal scenarios: random request patterns, a scoreboard that checks every grant, and coverage that shows which patterns happened.",
      feedback: {
        directed: "Hand-writing every long mixed pattern does not scale: the method table lists exactly that weakness.",
        formal: "Formal proves properties of the arbiter. Hours of mixed traffic through a scoreboard are the bulk-regression job.",
      },
      source: [practice("F1B, How the methods combine and the method table")],
    }),
    binCard(METHOD_BINS, {
      id: "rare-bin",
      short: "bin at 0 after 1,000 seeds",
      prompt: "After 1,000 random seeds, one functional-coverage bin is still at 0. Which method closes it?",
      correct: ["directed", "formal"],
      why: {
        directed: "Aim at the hole: a directed test drives the missing case on purpose, so the bin fills, or the test's failure to reach it points at the cause to debug.",
        formal:
          "Formal explores every reachable state within its assumptions. Restate the bin as a cover property, and the tool finds a trace that reaches the case, shows that the case is unreachable, or, on a large design, ends bounded or inconclusive. An unreachable bin is a question first: an over-constrained assumption, or a design that cannot reach a case the spec requires, is a bug. Exclude the bin only after that review, with the reason recorded.",
      },
      partial: {
        "constrained-random":
          "More seeds of the same constraints are unlikely to reach it soon: coverage has plateaued. A new test whose constraints aim at the hole works too, and that is close to a directed test.",
      },
      source: [practice("F1B, The coverage closure trap")],
    }),
    binCard(METHOD_BINS, {
      id: "boot-os",
      short: "boot an OS",
      prompt: "Boot the operating system on the full chip before tape-out.",
      correct: ["emulation"],
      why: "The emulator runs the RTL compiled into hardware, orders of magnitude faster than simulation, and lab chips do not exist before tape-out.",
      feedback: {
        "constrained-random": "Simulation runs the right model, but far too slowly to boot an operating system on a full chip.",
        directed: "A directed simulation test still runs at simulation speed, far too slowly to boot an operating system on a full chip.",
        formal: "Formal proves properties of blocks. It does not execute the software an operating system boot needs.",
      },
      source: [practice("F1B methods tour")],
    }),
    binCard(METHOD_BINS, {
      id: "netlist",
      short: "netlist matches RTL",
      prompt: "Show that the synthesized gate-level netlist matches the RTL.",
      correct: ["equivalence"],
      why: "Equivalence checking runs after synthesis and proves that the netlist matches the RTL. It cannot tell you whether the RTL itself is right.",
      feedback: {
        "constrained-random": "Simulating the netlist checks the cases you run. Equivalence checking proves that the two representations match.",
        formal: "Formal property verification proves the properties you write about one design. Comparing two representations of it is equivalence checking.",
      },
      source: [practice("F1B methods tour")],
    }),
    binCard(METHOD_BINS, {
      id: "async-fifo",
      short: "async FIFO crossing",
      prompt:
        "Find metastability risk on an asynchronous FIFO's pointer crossing between two clocks. This job takes two methods, and in a typical CDC flow one of them runs first: pick that one.",
      correct: ["cdc"],
      partial: {
        formal:
          "Half of the answer: the lesson's bug taxonomy lists CDC structural analysis and formal for this bug. In a typical CDC flow the structural analysis runs first: it checks every crossing for a safe synchronizer, and formal then checks the logic around the crossings it found.",
      },
      why: "Structural CDC analysis checks every signal that crosses between the two clocks for a safe synchronizer. The lesson's bug taxonomy lists it, with formal, for metastability on an asynchronous FIFO pointer crossing, and in a typical CDC flow it runs first.",
      feedback: {
        "constrained-random": "RTL simulation does not model metastability: a flop simply takes the value at its input, so the risk never shows up in an ordinary RTL run.",
        directed: "A directed RTL test does not model metastability either: in an ordinary RTL run a flop simply takes the value at its input, however well the test aims at the crossing.",
        emulation:
          "Emulation compiles the same RTL onto hardware: an emulator runs its flops with no metastability model, and a metastable event on an FPGA prototype would be rare, unrepeatable and set by the FPGA's timing, not the chip's. It is faster, not more accurate at a crossing.",
      },
      // The taxonomy row names two methods: CDC analysis is the primary bin, formal the second step.
      followUp: {
        after: "cdc",
        question: "The taxonomy pairs a second method with it for this bug. Which one?",
        options: [
          {
            id: "constrained-random",
            label: "Constrained-random simulation",
            verdict: "wrong",
            feedback: "RTL simulation does not model metastability: a flop simply takes the value at its input, so the risk never shows up in an ordinary RTL run.",
          },
          {
            id: "formal",
            label: "Formal property verification",
            verdict: "correct",
            feedback:
              "The taxonomy lists CDC structural analysis and formal. Formal proves properties of the logic around the crossing, such as a pointer that changes only one bit at a time, in every reachable state within its assumptions.",
          },
          {
            id: "equivalence",
            label: "Equivalence checking",
            verdict: "wrong",
            feedback: "Equivalence checking proves that two representations, such as the netlist and the RTL, match. Both can contain the same unsafe crossing.",
          },
        ],
      },
      source: [practice("F1B bug taxonomy"), practice("general CDC flow: structural analysis before formal")],
    }),
    binCard(METHOD_BINS, {
      id: "retention",
      short: "retention after power-down",
      prompt: "Check that a retention register keeps its value across a power-down.",
      correct: ["power-aware"],
      why: "The lesson's bug taxonomy lists power-aware simulation, driven by a power-intent file in UPF (IEEE 1801), for a retention register corrupted after power-down. It switches the domain off as the UPF describes, corrupts state that is not retained, and models the retention save and restore, so a missing or mistimed save or restore shows up as a wrong value after power-up.",
      feedback: {
        "constrained-random": "Plain RTL simulation has no power domains: nothing switches off, so retention is never exercised. Add the power intent and simulate power-aware.",
        directed:
          "A directed test in plain RTL simulation never powers anything down: without the UPF (IEEE 1801) power intent there are no power domains. Run the same power-down test as a power-aware simulation.",
        emulation:
          "Emulation runs the same RTL faster, and without the UPF (IEEE 1801) power intent it has no power domains either, so nothing ever switches off. Some commercial emulators can load that intent (tool-dependent), but it is the power intent, not the speed, that checks retention.",
        formal:
          "Formal on the RTL alone has no power domains either: without the power intent, written in UPF (IEEE 1801), nothing ever switches off, so there is no power-down to reason about. The lesson's taxonomy pairs this bug with power-aware simulation.",
      },
      source: [practice("F1B bug taxonomy")],
    }),
    ],
    // No answer twice in a row, and the right button never steps one place along
    // for three cards (see longestPositionRun). mutex stays first.
    ["mutex", "bring-up", "netlist", "no-starvation", "mixed-traffic", "boot-os", "async-fifo", "rare-bin", "retention"],
  ),
};

/* ------------------------------------------------------------------------- */
/* sv-features (F1C): IEEE 1800-2023                                          */
/* ------------------------------------------------------------------------- */

const FEATURE_BINS: SorterBin[] = [
  {
    id: "class",
    label: "Class",
    whenWrong: "A class organizes data and code into objects that can be created, extended and reused (Clause 8). That reuse is its job, not the one this card asks for.",
  },
  { id: "constraint", label: "Constraint", whenWrong: "A constraint makes values legal but records nothing (Clause 18): it limits what randomize() may pick." },
  {
    id: "covergroup",
    label: "Covergroup",
    whenWrong:
      "A covergroup counts which values occurred (Clause 19). It is not a checker (only its illegal_bins report a run-time error, §19.5.6), and it never limits what is generated.",
  },
  {
    id: "assertion",
    label: "Assertion",
    // burst-lengths, the one card where coverage is the answer, overrides this with the assert, cover property and covergroup contrast.
    whenWrong: "An assertion checks a rule about values or timing (Clause 16). It declares no type, bundles no signals and is not a driver.",
  },
  { id: "logic", label: "logic", mono: true, whenWrong: "logic is a 4-state data type (§6.11.2). It holds values; it states no rule, intent or measurement." },
  { id: "always_comb", label: "always_comb", mono: true, whenWrong: "always_comb states that a procedure models combinational logic (§9.2.2.2). It does not generate, measure or share anything." },
  { id: "interface", label: "Interface", whenWrong: "An interface bundles a bus's signals once, for both the RTL and the testbench (Clause 25). Its job is the connection." },
  {
    id: "package",
    label: "Package",
    whenWrong:
      "A package shares declarations (types, functions, even variables and nets) by import or by pkg::name (§26.2). It is not a connection that instances plug into, and it contains no processes of its own (no initial or always procedure), except inside a checker (§26.2).",
  },
];

const SV_FEATURES_DECK: ScenarioDeck = {
  id: "sv-features",
  label: "SystemVerilog feature sorting practice",
  title: "Problem to feature",
  summary: "Pick the SystemVerilog feature that solves each problem. For most cards, a small picture shows the feature at work after you commit.",
  fidelity: "illustration",
  assumptions: [
    "The pictures are illustrations, not simulator output. The constraint and coverage pictures share one Packet example.",
    "Clauses are IEEE 1800-2023.",
  ],
  bins: FEATURE_BINS,
  axis: {
    title: "Verification half and design half",
    rows: [{ id: "all", label: "Cards" }],
    columns: [
      { id: "verification", label: "Verification half" },
      { id: "design", label: "Design half" },
    ],
    cells: {
      class: { row: "all", column: "verification" },
      constraint: { row: "all", column: "verification" },
      covergroup: { row: "all", column: "verification" },
      assertion: { row: "all", column: "verification" },
      logic: { row: "all", column: "design" },
      always_comb: { row: "all", column: "design" },
      interface: { row: "all", column: "design" },
      package: { row: "all", column: "design" },
    },
    note: "Interfaces and packages serve both halves: the RTL and the testbench use the same ones.",
  },
  cards: inOrder(
    [
    binCard(FEATURE_BINS, {
      id: "reuse-driver",
      short: "reuse a driver",
      prompt: "Reuse one driver across several tests and projects.",
      correct: ["class"],
      why: "Classes, with inheritance and polymorphism, let one driver be created by every test and extended where a project differs (Clause 8).",
      feedback: {
        package: "A package can carry the driver class to every project, but the reuse comes from the class itself: create it, extend it, override one method.",
        interface:
          "An interface carries the signals, and it can hold signal-level tasks such as read and write (§25.7), so a BFM-style driver can live in one. But an interface has no inheritance: a test or project cannot extend it and override one task, as it can a driver class (Clause 8).",
      },
      anchor: "class",
      source: [lrm("Clause 8"), lrm("§25.7")],
    }),
    binCard(FEATURE_BINS, {
      id: "legal-bursts",
      short: "only legal bursts",
      prompt: "Generate only legal bursts, without hand-writing each one.",
      correct: ["constraint"],
      why: "State the legal values once; randomize() picks only values that satisfy the constraints, and returns 0 when it cannot (§18.6.1).",
      feedback: {
        covergroup: "A covergroup records what was generated. It never stops an illegal burst from being generated.",
        assertion: "An assertion can flag an illegal burst after it appears. A constraint keeps it from being generated at all.",
        class:
          "The rand fields and randomize() live in a class (§18.6.1), but without a constraint randomize() may pick any value of the type; the constraint is what keeps bursts legal.",
      },
      answerCode: "class Packet;\n  rand bit [7:0] length;\n  constraint c_len { length inside {[1:99]}; }\nendclass",
      anchor: "constraint",
      source: [lrm("Clause 18"), lrm("§18.6.1")],
    }),
    binCard(FEATURE_BINS, {
      id: "burst-lengths",
      short: "every length exercised",
      prompt: "Know whether every burst length from 1 to 16 was exercised in the regression.",
      correct: ["covergroup"],
      why: "A covergroup with a bin per length records which lengths occurred, across every test and seed (Clause 19).",
      feedback: {
        constraint: "A constraint makes values legal but records nothing: lengths 1 to 16 can all be legal and some still never be generated.",
        assertion:
          "An assert statement fails on a rule but records no value bins: it can check that each length is 1 to 16, not which lengths occurred. cover property counts one property's successes (§16.14.3), so you would need sixteen of them; one covergroup bins every length.",
      },
      anchor: "coverage",
      anchorNote: "Same idea on the shared Packet example, which has two range bins. For lengths 1 to 16 you would declare bins len[] = {[1:16]};, one bin per length (§19.5.1).",
      source: [lrm("Clause 19"), lrm("§19.3"), lrm("§19.5.1"), lrm("§16.14.3")],
    }),
    binCard(FEATURE_BINS, {
      id: "gnt-within-3",
      short: "gnt within 3 cycles",
      prompt: "gnt must follow req within 3 cycles, checked on every clock.",
      correct: ["assertion"],
      why: "A concurrent assertion states the timing rule once, and the simulator checks it at every clock edge (Clause 16).",
      feedback: {
        covergroup: "A covergroup counts what happened; it is not a timing checker, so a late gnt still passes unless someone writes a check for it.",
        constraint: "gnt comes from the design. A constraint shapes generated stimulus and checks nothing the design does.",
      },
      answerCode: "a_gnt: assert property (@(posedge clk) req |-> ##[1:3] gnt);",
      anchor: "assertion",
      source: [lrm("Clause 16"), lrm("§16.12.7")],
    }),
    binCard(FEATURE_BINS, {
      id: "one-type",
      short: "one 4-state type",
      prompt: "One 4-state type for what Verilog split between reg and wire uses.",
      correct: ["logic"],
      why: "logic is a 4-state type, and logic and reg denote the same type (§6.11.2).",
      source: [lrm("§6.11.2")],
    }),
    binCard(FEATURE_BINS, {
      id: "latch",
      short: "catch a latch",
      prompt: "Catch an accidental latch in combinational code.",
      correct: ["always_comb"],
      why: "always_comb states the intent, and the standard says tools should warn when the code does not represent combinational logic, for example when latched behaviour can be inferred (§9.2.2.2).",
      caveat: "Tools should warn (§9.2.2.2), not a guarantee: the standard recommends the check but does not require it, so read your tool's warnings.",
      feedback: {
        assertion: "An assertion checks values while the code runs; it does not report how the code was written, which is what lets a tool see an inferred latch (§9.2.2.2).",
      },
      source: [lrm("§9.2.2.2")],
    }),
    binCard(FEATURE_BINS, {
      id: "bus-bundle",
      short: "bundle a bus",
      prompt: "Bundle a bus's signals once, for both the RTL and the testbench.",
      correct: ["interface"],
      why: "An interface encapsulates the communication between blocks: the RTL and the testbench connect to the same bundle (Clause 25).",
      feedback: {
        package:
          "A package can declare a variable that both sides reference by name, but that is a global, not a port: the bus still needs a bundle each instance connects to (Clause 25).",
      },
      anchor: "interface",
      source: [lrm("Clause 25")],
    }),
    binCard(FEATURE_BINS, {
      id: "share-types",
      short: "share types",
      prompt: "Share types between the RTL and the testbench.",
      correct: ["package"],
      why: "A package declares types once, and both sides import them (§26.2).",
      feedback: {
        interface: "An interface bundles signals. Typedefs that the RTL and the testbench both import belong in a package.",
        class: "A class is a type for testbench objects. The RTL needs plain types such as structs and enums, shared from a package.",
      },
      anchor: "package",
      source: [lrm("§26.2")],
    }),
    ],
    // Defined in the drill's order (verification half, then design half). Met mixed:
    // neither half alternates, no answer repeats, and the right button never steps
    // one place along for three cards.
    ["legal-bursts", "one-type", "share-types", "gnt-within-3", "reuse-driver", "latch", "burst-lengths", "bus-bundle"],
  ),
};

export interface PacketExample {
  lengthRange: { lo: number; hi: number };
  legal: { lo: number; hi: number };
  samples: readonly number[];
  coverBins: readonly { name: string; lo: number; hi: number }[];
  req: readonly number[];
  gnt: readonly number[];
  window: { min: number; max: number };
}

/** The shared Packet example the sv-features pictures draw. */
export const PACKET_EXAMPLE: PacketExample = {
  /** rand bit [7:0] length: the full range of the variable. */
  lengthRange: { lo: 0, hi: 255 },
  /** constraint c_len { length inside {[1:99]}; } */
  legal: { lo: 1, hi: 99 },
  /** Ten values that runs of randomize() could assign to length; all satisfy c_len. */
  samples: [7, 12, 23, 31, 38, 45, 57, 66, 84, 97],
  /** coverpoint length { bins low = {[1:32]}; bins high = {[33:99]}; } */
  coverBins: [
    { name: "low", lo: 1, hi: 32 },
    { name: "high", lo: 33, hi: 99 },
  ],
  /** req |-> ##[1:3] gnt, values sampled at ten rising edges. */
  req: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  gnt: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  window: { min: 1, max: 3 },
};

export function allInRange(values: readonly number[], lo: number, hi: number): boolean {
  return values.every((v) => v >= lo && v <= hi);
}

/** How many samples land in each value-range bin (a sample counts in every bin that contains it). */
export function binHits(values: readonly number[], bins: readonly { name: string; lo: number; hi: number }[]): { name: string; hits: number }[] {
  return bins.map((b) => ({ name: b.name, hits: values.filter((v) => v >= b.lo && v <= b.hi).length }));
}

export interface WindowAttempt {
  /** The edge at which the attempt starts. */
  start: number;
  /** vacuous: the antecedent was 0, so the implication succeeds (§16.12.7). */
  status: "vacuous" | "pass" | "fail" | "pending";
  /** The edge where it passed or failed. */
  end?: number;
}

/**
 * One attempt per sampled edge of `a |-> ##[min:max] b` (overlapped implication,
 * §16.12.7). The attempt from edge k passes at the first edge in k+min..k+max
 * where b is 1, fails at k+max when none is, and is pending when the window
 * runs past the trace.
 */
export function implicationWindowAttempts(antecedent: readonly number[], consequent: readonly number[], min: number, max: number): WindowAttempt[] {
  const n = Math.min(antecedent.length, consequent.length);
  const attempts: WindowAttempt[] = [];
  for (let k = 0; k < n; k += 1) {
    if (!antecedent[k]) {
      attempts.push({ start: k, status: "vacuous" });
      continue;
    }
    let end: number | undefined;
    for (let j = k + min; j <= Math.min(k + max, n - 1); j += 1) {
      if (consequent[j]) {
        end = j;
        break;
      }
    }
    if (end !== undefined) attempts.push({ start: k, status: "pass", end });
    else if (k + max <= n - 1) attempts.push({ start: k, status: "fail", end: k + max });
    else attempts.push({ start: k, status: "pending" });
  }
  return attempts;
}

/* ------------------------------------------------------------------------- */
/* uvm-name-layers (F1C)                                                      */
/* ------------------------------------------------------------------------- */

const LAYER_BINS: SorterBin[] = [
  {
    id: "ieee-1800",
    label: "IEEE 1800-2023 language",
    whenWrong: "IEEE 1800-2023 defines the language: its constructs, built-in methods and system tasks. It defines no uvm_ name at all.",
  },
  {
    id: "ieee-1800-2",
    label: "IEEE 1800.2-2020 API",
    whenWrong: "IEEE 1800.2-2020 defines UVM's API on top of IEEE 1800. It does not redefine the language's own constructs.",
  },
  {
    id: "uvm-core",
    label: "uvm-core 2020.3.1 only",
    whenWrong: "This bin is for names only the library defines. uvm-core implements the standard's uvm_ names; implementing a name does not make it library-only.",
  },
];

const languageTile = (spec: { id: string; label: string; definedIn: string; why: string; feedback?: Record<string, string>; source: SourceRef[] }): SorterCard =>
  binCard(LAYER_BINS, {
    id: spec.id,
    short: spec.label,
    prompt: "Which document defines this name?",
    code: spec.label,
    correct: ["ieee-1800"],
    why: spec.why,
    definedIn: spec.definedIn,
    feedback: {
      // True only of a construct uvm-core 2020.3.1 really uses (class, randomize(), logic and
      // $display all occur in its src/ tree); a tile for one it never uses overrides it.
      "uvm-core": "uvm-core is SystemVerilog code: it uses this construct, as any bench does, but the language defines it (IEEE 1800-2023).",
      ...spec.feedback,
    },
    source: spec.source,
  });

const uvmTile = (spec: { id: string; label: string; definedIn: string; why: string; feedback?: Record<string, string>; source: SourceRef[] }): SorterCard =>
  binCard(LAYER_BINS, {
    id: spec.id,
    short: spec.label,
    prompt: "Which document defines this name?",
    code: spec.label,
    correct: ["ieee-1800-2"],
    why: spec.why,
    definedIn: spec.definedIn,
    feedback: {
      // The default suits the lower-case uvm_ classes; macro tiles and run_test override it.
      "ieee-1800": "IEEE 1800-2023 defines no uvm_ name. A simulator knows it only after uvm_pkg is compiled.",
      "uvm-core": "uvm-core implements it, but the name and its API are standard, so it is not library-only.",
      ...spec.feedback,
    },
    source: spec.source,
  });

const coreTile = (spec: { id: string; label: string; definedIn: string; why: string; feedback?: Record<string, string>; source: SourceRef[] }): SorterCard =>
  binCard(LAYER_BINS, { id: spec.id, short: spec.label, prompt: "Which document defines this name?", code: spec.label, correct: ["uvm-core"], why: spec.why, definedIn: spec.definedIn, feedback: spec.feedback, source: spec.source });

const UVM_NAME_TILES: SorterCard[] = [
  languageTile({
    id: "class",
    label: "class",
    definedIn: "IEEE 1800-2023 Clause 8 (classes; syntax in §8.3)",
    why: "The class construct is part of the language. UVM's classes are written with it.",
    feedback: { "ieee-1800-2": "UVM uses classes everywhere, but the class construct is the language's own (IEEE 1800-2023 Clause 8)." },
    source: [lrm("Clause 8"), lrm("§8.3")],
  }),
  languageTile({
    id: "randomize",
    label: "randomize()",
    definedIn: "IEEE 1800-2023 §18.6.1: every class has a built-in randomize() virtual method",
    why: "randomize() is built into every class by the language, so UVM objects inherit it from IEEE 1800.",
    feedback: { "ieee-1800-2": "uvm_object gets randomize() from the language: IEEE 1800-2023 §18.6.1 gives every class one." },
    source: [lrm("§18.6.1")],
  }),
  languageTile({
    id: "covergroup",
    label: "covergroup",
    definedIn: "IEEE 1800-2023 §19.3",
    why: "covergroup is a language construct for functional coverage, defined in IEEE 1800-2023 Clause 19.",
    // uvm-core 2020.3.1 contains no covergroup at all (a case-insensitive search of its whole tree finds none).
    feedback: {
      "uvm-core":
        "uvm-core declares no covergroup at all. covergroup is a language construct (IEEE 1800-2023 §19.3): a UVM bench's covergroups are declared in its own classes, such as its coverage collectors, not in the library.",
    },
    source: [lrm("§19.3")],
  }),
  languageTile({
    id: "logic",
    label: "logic",
    definedIn: "IEEE 1800-2023 §6.11.2: a 4-state type; logic and reg denote the same type",
    why: "logic is a language data type.",
    source: [lrm("§6.11.2")],
  }),
  languageTile({
    id: "display",
    label: "$display",
    definedIn: "IEEE 1800-2023 §21.2.1",
    why: "$display is one of the language's display system tasks.",
    feedback: { "ieee-1800-2": "UVM reports through its own reporting API, but $display is a language system task (IEEE 1800-2023 §21.2.1)." },
    source: [lrm("§21.2.1")],
  }),
  uvmTile({
    id: "uvm-component",
    label: "uvm_component",
    definedIn: "IEEE 1800.2-2020 §13.1 (implemented in uvm-core's src/base/uvm_component.svh)",
    why: "The common base class for UVM components is part of the standard's API.",
    source: [uvmStd("§13.1"), uvmCore("src/base/uvm_component.svh")],
  }),
  uvmTile({
    id: "uvm-test",
    label: "uvm_test",
    definedIn: "IEEE 1800.2-2020 §13.2 (implemented in uvm-core's src/comps/uvm_test.svh)",
    why: "The virtual base class for user-defined tests is part of the standard's API.",
    source: [uvmStd("§13.2"), uvmCore("src/comps/uvm_test.svh")],
  }),
  uvmTile({
    id: "uvm-pkg",
    label: "uvm_pkg",
    definedIn: "IEEE 1800.2-2020 §1.4.5: all of UVM is exported through uvm_pkg (uvm-core: src/uvm_pkg.sv)",
    why: "The standard names the package that exports every UVM class, method and variable.",
    feedback: { "ieee-1800": "IEEE 1800-2023 defines packages in general (§26.2), not this one." },
    source: [uvmStd("§1.4.5"), uvmCore("src/uvm_pkg.sv")],
  }),
  uvmTile({
    id: "component-utils",
    label: "`uvm_component_utils",
    definedIn: "IEEE 1800.2-2020 §B.2.1.3 (implemented in uvm-core's src/macros/uvm_object_defines.svh)",
    why: "The utility macros for component classes are part of the standard (Annex B).",
    feedback: { "ieee-1800": "The language defines `define, the mechanism. This macro is UVM's (IEEE 1800.2-2020 §B.2.1.3)." },
    source: [uvmStd("§B.2.1.3"), uvmCore("src/macros/uvm_object_defines.svh")],
  }),
  uvmTile({
    id: "run-test",
    label: "run_test",
    definedIn: "IEEE 1800.2-2020 §F.3.1.2: a global convenience task for uvm_root::run_test (§F.7.3.1)",
    why: "The global run_test task is part of the standard's API.",
    feedback: {
      "ieee-1800":
        "IEEE 1800-2023 defines no UVM task. run_test is UVM's global task (IEEE 1800.2-2020 §F.3.1.2), exported through uvm_pkg (§1.4.5), so a file can call it only once uvm_pkg is compiled, and then through import or as uvm_pkg::run_test.",
    },
    source: [uvmStd("§F.3.1.2"), uvmStd("§1.4.5"), uvmCore("src/base/uvm_globals.svh")],
  }),
  uvmTile({
    id: "version-post-2017",
    label: "`UVM_VERSION_POST_2017",
    definedIn: "IEEE 1800.2-2020 §B.7.3, the version ladder (uvm-core defines it in src/macros/uvm_version_defines.svh)",
    why: "The standard requires one define for each earlier version, and this one marks versions after IEEE 1800.2-2017.",
    feedback: {
      "ieee-1800": `The language defines \`define and \`ifdef, the mechanism (IEEE 1800-2023 §22.5.1, §22.6). This define is UVM's (IEEE 1800.2-2020 §B.7.3), and with uvm-core a file gets it through \`include "uvm_macros.svh". A text macro is not a package item (§26.2), so import uvm_pkg::* cannot supply it.`,
      "uvm-core": "uvm-core defines it because the standard requires it: IEEE 1800.2-2020 §B.7.3 asks for one define per earlier version.",
    },
    source: [uvmStd("§B.7.3"), uvmCore("src/macros/uvm_version_defines.svh"), uvmCore("src/uvm_macros.svh"), lrm("§22.5.1"), lrm("§22.6"), lrm("§26.2")],
  }),
  coreTile({
    id: "uvm-macros-svh",
    label: "uvm_macros.svh",
    definedIn: "uvm-core 2020.3.1, src/uvm_macros.svh. IEEE 1800.2-2020 defines the macros (Annex B) but names no file to include.",
    why: "The file is how uvm-core delivers the macros; the standard never names it.",
    feedback: {
      "ieee-1800-2": "The standard defines the macros themselves (Annex B) but names no file. uvm_macros.svh is how uvm-core delivers them.",
      "ieee-1800": "The language defines `include, the mechanism. This file comes from the uvm-core library.",
    },
    source: [uvmCore("src/uvm_macros.svh")],
  }),
  coreTile({
    id: "post-version-1-2",
    label: "`UVM_POST_VERSION_1_2",
    definedIn: "uvm-core 2020.3.1, src/macros/uvm_version_defines.svh, for code written for Accellera's UVM 1.2",
    why: "uvm-core adds it so code written for Accellera's UVM 1.2 can test for it. The standard's ladder does not define it.",
    feedback: {
      "ieee-1800-2": "The standard's version ladder requires `UVM_VERSION_POST_2017 (§B.7.3). `UVM_POST_VERSION_1_2 is uvm-core's own.",
      "ieee-1800": `The language defines \`define and \`ifdef, the mechanism (IEEE 1800-2023 §22.5.1, §22.6), but no UVM define. uvm-core defines this one in src/macros/uvm_version_defines.svh, which \`include "uvm_macros.svh" brings in.`,
    },
    source: [uvmCore("src/macros/uvm_version_defines.svh"), lrm("§22.5.1"), lrm("§22.6")],
  }),
];

/**
 * The order learners meet the tiles: the three layers interleaved, never more
 * than two in a row, and the right button never steps one place along for three
 * tiles (see longestPositionRun).
 */
const UVM_NAME_ORDER: readonly string[] = [
  "class",
  "uvm-component",
  "logic",
  "uvm-pkg",
  "uvm-test",
  "uvm-macros-svh",
  "randomize",
  "component-utils",
  "display",
  "covergroup",
  "run-test",
  "version-post-2017",
  "post-version-1-2",
];

const UVM_NAME_LAYERS_DECK: ScenarioDeck = {
  id: "uvm-name-layers",
  label: "UVM name origin practice",
  title: "Who defines this name?",
  summary: "Sort each name by the document that defines it: the language, the UVM standard, or only the uvm-core library.",
  fidelity: "illustration",
  bins: LAYER_BINS,
  cards: inOrder(UVM_NAME_TILES, UVM_NAME_ORDER),
};

/* ------------------------------------------------------------------------- */
/* uvm-compile-triage (F1C): which compile-stack layer is missing?            */
/* ------------------------------------------------------------------------- */

/** Bottom of the stack first. */
const STACK_BINS: SorterBin[] = [
  {
    id: "simulator",
    label: "IEEE 1800 simulator",
    whenWrong: "The simulator is running: it parsed the file and reported the error. IEEE 1800-2023 defines no uvm_ name, so it never knew one by itself.",
  },
  {
    id: "uvm-core",
    label: "uvm-core compiled (uvm_pkg)",
    whenWrong: "A missing library shows up at the import line, as a package uvm_pkg that cannot be found. This symptom names something else.",
  },
  {
    id: "macros",
    label: '`include "uvm_macros.svh"',
    mono: true,
    whenWrong: "A missing macro file shows up as an undefined macro, such as `uvm_component_utils. This symptom names something else.",
  },
  {
    id: "import",
    label: "import uvm_pkg::*;",
    mono: true,
    whenWrong: "A missing import shows up as unknown uvm_ types while uvm_pkg itself compiled. This symptom names something else.",
  },
  { id: "classes", label: "Your classes", whenWrong: "Your class is where the error is reported, but the missing piece sits lower in the stack." },
];

export const COMPILE_STACK_LAYERS: readonly string[] = STACK_BINS.map((b) => b.id);

const TRIAGE_LOG_LABEL = "Log (generic wording: real message text is tool-dependent)";

const UVM_COMPILE_TRIAGE_DECK: ScenarioDeck = {
  id: "uvm-compile-triage",
  label: "UVM compile triage practice",
  title: "Which layer must you fix?",
  summary: "Each compile symptom points at one layer of the stack: one that is missing, or one that must change. Pick it, then see the stack with that layer struck out.",
  fidelity: "illustration",
  assumptions: ["The messages are generic: real message text is tool-dependent.", "The stack is drawn bottom-up in compile order."],
  bins: STACK_BINS,
  cards: [
    binCard(STACK_BINS, {
      id: "unknown-type",
      short: "unknown type uvm_test",
      prompt: "The log shows uvm_pkg compiled earlier in this run. Then my_test.sv stops at class my_test extends uvm_test;",
      codeLabel: TRIAGE_LOG_LABEL,
      code: "Error: my_test.sv(3): unknown type 'uvm_test'",
      correct: ["import"],
      why: "uvm_test lives in uvm_pkg (IEEE 1800.2-2020 §13.2, §1.4.5). The package compiled, but this file never imported it: add import uvm_pkg::*;, or name it uvm_pkg::uvm_test (IEEE 1800-2023 §26.3).",
      feedback: {
        "uvm-core": "The log shows uvm_pkg compiled, so the library is there. This file just cannot see into it.",
        macros: "uvm_test is a class, not a macro: a missing macro file gives an undefined-macro error instead.",
      },
      stack: { layer: "import", status: "missing from my_test.sv" },
      source: [uvmStd("§13.2"), uvmStd("§1.4.5"), lrm("§26.3")],
    }),
    binCard(STACK_BINS, {
      id: "no-package",
      short: "unresolved package uvm_pkg",
      prompt: "my_test.sv stops at its import line, import uvm_pkg::*;",
      codeLabel: TRIAGE_LOG_LABEL,
      code: "Error: my_test.sv(2): package 'uvm_pkg' not found",
      correct: ["uvm-core"],
      why: "The compilation of a package shall precede the compilation of scopes that import it (IEEE 1800-2023 §26.3). Compile uvm-core first, or select your simulator's bundled copy (tool-dependent).",
      feedback: {
        import: "The import is present: it is the line that fails, because it names a package this run never compiled.",
        simulator: "The simulator is running and found the import. What it cannot find is the package, which IEEE 1800-2023 does not supply.",
      },
      stack: { layer: "uvm-core", status: "not compiled into this run" },
      source: [lrm("§26.3"), uvmStd("§1.4.5")],
    }),
    binCard(STACK_BINS, {
      id: "undefined-macro",
      short: "undefined `uvm_component_utils",
      prompt: "my_test.sv imports uvm_pkg and compiles until its `uvm_component_utils(my_test) line.",
      codeLabel: TRIAGE_LOG_LABEL,
      code: "Error: my_test.sv(4): macro 'uvm_component_utils' is not defined",
      correct: ["macros"],
      why: "Macros are not package items: §26.2 lists what a package can declare, and text macros are not among them, so no import can bring them in. They reach a file through `include \"uvm_macros.svh\".",
      feedback: {
        import: "The import is there and works for types. A macro is not a package item, so no import can supply it.",
        "uvm-core": "uvm_pkg can be compiled and the macro still be undefined in this file: macros arrive by `include, not by import.",
      },
      stack: { layer: "macros", status: "missing from my_test.sv" },
      source: [lrm("§26.2"), uvmStd("§B.2.1.3"), uvmCore("src/uvm_macros.svh")],
    }),
    binCard(STACK_BINS, {
      id: "renamed-method",
      short: "method renamed after UVM 1.2",
      prompt: "A component that built against Accellera's UVM 1.2 now fails: a method it calls is not found in its uvm_ base class. Nothing in the stack is missing. Which layer must change?",
      codeLabel: TRIAGE_LOG_LABEL,
      code: "Error: my_env.sv(41): no method '<old name>' in class 'uvm_component'",
      correct: ["classes"],
      partial: {
        "uvm-core":
          "Part of it: this is the lesson's cause, a different UVM version is compiled in, and that is why the name moved. But that layer is present, and the lesson's fix is in your code: confirm which library the run uses (UVM_VERSION_STRING, IEEE 1800.2-2020 §B.7.2), then update the call.",
      },
      why: "Every layer is present; your code was written for another UVM version. Update the call, and guard code that must build against both with `ifdef UVM_VERSION_POST_2017 (IEEE 1800.2-2020 §B.7.3).",
      stack: { layer: "classes", status: "written for UVM 1.2" },
      source: [uvmStd("§B.7.2"), uvmStd("§B.7.3")],
    }),
  ],
};

/* ------------------------------------------------------------------------- */
/* ipc-tools (F2D)                                                            */
/* ------------------------------------------------------------------------- */

const IPC_BINS: SorterBin[] = [
  {
    id: "event",
    label: "Named event",
    whenWrong: "-> ev reaches only processes already waiting (§15.5.2), its triggered state lasts only until time advances (§15.5.3), and it carries no data.",
  },
  {
    id: "semaphore",
    label: "Semaphore",
    whenWrong:
      "A semaphore's keys make processes take turns at a resource (§15.3). It carries no data, and as a signal each key that put() returns lets only one waiting get() through (§15.3.2, §15.3.3), unlike -> ev, which wakes every waiter (§15.5.1).",
  },
  {
    id: "mailbox",
    label: "Mailbox",
    whenWrong: "A mailbox queues messages in strict FIFO order (§15.4.3); unbounded, its put() never blocks (§15.4.1). Each get() removes one message (§15.4.5).",
  },
  {
    id: "bounded-mailbox",
    label: "Bounded mailbox",
    whenWrong: "A bounded mailbox suspends the producer's put() while its queue is full (§15.4.3): a mailbox with backpressure.",
  },
  {
    id: "level-flag",
    label: "Level flag or shared variable",
    whenWrong:
      "A flag, or another scalar variable, holds a level: the last write determines its value (§6.5), and wait (flag) passes at once if it is already true (§9.4.3). It queues nothing.",
  },
];

/** Step-2 options are listed in the order of their argument (new(), new(1), new(2) ...), so position is no cue. */
const keyCountFollowUp = (name: string, wrongCount: number, wrongWhy: string): SorterFollowUp => ({
  after: "semaphore",
  question: "How many keys should new() create for this job?",
  options: [
    { id: "new-0", label: `semaphore ${name} = new();`, mono: true, verdict: "wrong", feedback: "The default keyCount is 0 (§15.3.1): the first get() blocks until some process puts a key it never took." },
    { id: "new-1", label: `semaphore ${name} = new(1);`, mono: true, verdict: "correct", feedback: "One key: whoever holds it has the resource, and the others wait in get() until put() returns the key (§15.3)." },
    { id: `new-${wrongCount}`, label: `semaphore ${name} = new(${wrongCount});`, mono: true, verdict: "wrong", feedback: wrongWhy },
  ],
});

/** A mailbox, bounded or not, can announce a moment to a process already blocked in get(). */
const MAILBOX_ANNOUNCES = "A mailbox, bounded or not, also works: the waiting checker's get() returns once a message is put (§15.4.5). But it carries data you do not need.";

/**
 * A semaphore created with no keys wakes the one process already blocked in
 * get() when another process puts a key: §15.3 names "basic synchronization"
 * among a semaphore's typical uses. So on the announce cards it is partly right,
 * as on late-monitor, and every tool but the event is partly right there: the
 * event is still the one tool that wakes every waiter (§15.5.1), and the lesson
 * keeps semaphores for taking turns. A mailbox used as a lock (a token message)
 * stays wrong on the turn-taking cards: §15.4 introduces mailboxes for
 * exchanging messages, and nothing in it names exclusion as a use.
 */
const semaphoreAnnounces = (who: string) =>
  `Works: new() creates no keys, so the waiting checker's get() returns when ${who} put() adds one (§15.3.1–§15.3.3). But one key releases only one waiter, where -> wakes every waiter (§15.5.1), and the lesson keeps semaphores for taking turns.`;

/** peek() leaves the message in place, so any number of monitors, early or late, can read it. */
const MAILBOX_PEEK_ONLY =
  "Works with peek(): it copies the message without removing it, so every monitor, even a late one, passes (§15.4.7). With a plain get() the first monitor takes it and the others block (§15.4.5), unless each monitor puts it straight back, a clumsier copy of peek(). A level flag says the same thing without a message.";

const IPC_TOOLS_DECK: ScenarioDeck = {
  id: "ipc-tools",
  label: "Interprocess communication tool practice",
  title: "Pick the IPC tool",
  summary:
    "Choose the tool for each coordination job. When a job needs more than the tool, picking the right tool opens a second step: the key count, the bound or the kind of wait.",
  fidelity: "illustration",
  assumptions: ["One best tool per situation, as in the lesson's table. Real benches sometimes combine them.", "Clauses are IEEE 1800-2023."],
  bins: IPC_BINS,
  cards: inOrder(
    [
    binCard(IPC_BINS, {
      id: "reset-waiting",
      short: "reset released, checker waiting",
      prompt: "Tell the checker, which is already waiting, that reset was released.",
      correct: ["event"],
      why: "The checker is already blocked in @(rst_ev), so -> rst_ev wakes it (§15.5.2). An event announces a moment and needs no data.",
      partial: {
        "level-flag": "It works, since wait (rst_done) also wakes a process that is already waiting (§9.4.3), but you now manage a variable where an event simply says 'it happened'.",
        mailbox: MAILBOX_ANNOUNCES,
        "bounded-mailbox": MAILBOX_ANNOUNCES,
        semaphore: semaphoreAnnounces("the reset driver's"),
      },
      answerCode: "event rst_ev;\n// checker, waiting since time 0:\n@(rst_ev);\n// reset driver:\n-> rst_ev;",
      source: [lrm("§15.5.2"), lrm("§15.5.1"), lrm("§15.3"), lrm("§15.3.1"), lrm("§15.3.2"), lrm("§15.3.3"), lrm("§15.4.5")],
    }),
    binCard(IPC_BINS, {
      id: "late-monitor",
      short: "a monitor arrives late",
      prompt: "Tell three monitors that reset was released at 20 ns. One of them starts waiting only at 50 ns.",
      correct: ["level-flag"],
      why: "Keep the fact in a variable and wait on its level, so late arrivals pass too (§9.4.3).",
      partial: {
        mailbox: MAILBOX_PEEK_ONLY,
        "bounded-mailbox": MAILBOX_PEEK_ONLY,
        semaphore:
          "Works if the reset driver puts one key per monitor, put(3), since keys stay in the bucket until a get() takes them, or if every monitor puts its key straight back after its get() (§15.3.1–§15.3.3). Either way the late monitor passes too. A level flag says the same thing without keys to count.",
      },
      feedback: {
        event: "The 50 ns monitor was not waiting at 20 ns, and -> reaches only current waiters (§15.5.2). No event construct remembers across time.",
      },
      followUp: {
        after: "level-flag",
        question: "How do the monitors wait on it?",
        // Edge, then the event's triggered state, then the level: the correct wait is not first, where focus lands.
        options: [
          { id: "at-change", label: "@(rst_done);", mono: true, verdict: "wrong", feedback: "@ waits for a value change (§9.4.2). At 50 ns rst_done is already 1 and never changes again, so that monitor waits forever." },
          { id: "triggered", label: "wait (rst_ev.triggered);", mono: true, verdict: "wrong", feedback: "The triggered state lasts only until simulation time advances (§15.5.3): a wait that starts at 50 ns cannot see a trigger from 20 ns." },
          { id: "wait-level", label: "wait (rst_done);", mono: true, verdict: "correct", feedback: "Level-sensitive: it passes at once when rst_done is already 1, so the 50 ns monitor goes straight through (§9.4.3)." },
        ],
      },
      answerCode: "bit rst_done;            // 0 until reset is released\n// reset driver, at 20 ns:\nrst_done = 1;\n// every monitor, whenever it starts:\nwait (rst_done);         // passes at once if already 1",
      source: [lrm("§9.4.3"), lrm("§9.4.2"), lrm("§15.5.2"), lrm("§15.5.3"), lrm("§15.4.5"), lrm("§15.4.7"), lrm("§15.3.1"), lrm("§15.3.2"), lrm("§15.3.3")],
    }),
    binCard(IPC_BINS, {
      id: "shared-bus",
      short: "driver and IRQ share a bus",
      prompt: "A driver and an interrupt handler both drive one shared bus. Only one may use it at a time.",
      correct: ["semaphore"],
      why: "A key in the bucket gives mutual exclusion: get() before using the bus, put() after (§15.3).",
      feedback: {
        "level-flag": "A 'busy' flag that two processes test and set in the same time slot races. A semaphore's get() makes them queue.",
        event: "An event cannot make processes queue for a resource: -> wakes every waiter at once (§15.5.1), so both would drive the bus together.",
        mailbox: "A mailbox is built to move data (§15.4); using it for exclusive use means faking a key with a token message, which is a semaphore's job.",
        "bounded-mailbox":
          "A bounded mailbox moves data with backpressure (§15.4.3); using it for exclusive use means faking a key with a token message, which is a semaphore's job.",
      },
      followUp: keyCountFollowUp("bus_key", 2, "Two keys let both processes in at once: no mutual exclusion."),
      source: [lrm("§15.3"), lrm("§15.3.1"), lrm("§15.4"), lrm("§15.4.3")],
    }),
    binCard(IPC_BINS, {
      id: "log-file",
      short: "three writers, one log",
      prompt: "Three threads each write a multi-line record to one log file, with waits between the lines. Records must not interleave.",
      correct: ["semaphore"],
      why: "Each record is a critical section: take the key before its first line and put it back after its last (§15.3).",
      feedback: {
        mailbox: "A mailbox could feed a single writer thread, but here the three threads write the file themselves: they need to take turns, which is a semaphore's job.",
        "bounded-mailbox":
          "A bounded mailbox could feed a single writer thread, with backpressure, but here the three threads write the file themselves: they need to take turns, which is a semaphore's job.",
        "level-flag": "A 'busy' flag that two threads test and set in the same time slot races. A semaphore's get() makes them queue.",
        event: "An event cannot make processes queue: -> wakes every waiter at once (§15.5.1), so all three threads would write together and their records would interleave.",
      },
      followUp: keyCountFollowUp("log_key", 3, "Three keys let all three threads write at once, so their records interleave."),
      source: [lrm("§15.3"), lrm("§15.3.1")],
    }),
    binCard(IPC_BINS, {
      id: "every-txn",
      short: "every transaction, in order",
      prompt: "Hand every observed transaction from the monitor to the checker, in order, losing none. The monitor must never stop sampling the bus.",
      correct: ["mailbox"],
      why: "put() stores each message in strict FIFO order and get() removes them one at a time (§15.4.3, §15.4.5). Unbounded, put() never blocks, so the monitor never stalls (§15.4.1).",
      feedback: {
        "bounded-mailbox":
          "A bound makes put() block while the checker is behind (§15.4.3), and a monitor blocked in put() is not sampling the bus. The lesson bounds a mailbox unless there is a reason not to; this is the reason.",
        "level-flag": "A flag, or another scalar variable, keeps only the latest value: the last write determines it (§6.5).",
        event: "An event carries no data, and a trigger is lost when nobody is waiting (§15.5.2).",
      },
      source: [lrm("§15.4.1"), lrm("§15.4.3"), lrm("§15.4.5"), lrm("§6.5")],
    }),
    binCard(IPC_BINS, {
      id: "two-ahead",
      short: "at most two items waiting",
      prompt: "At most two items may wait between the generator and the driver.",
      correct: ["bounded-mailbox"],
      why: "The bound sets how far the producer can run ahead: put() suspends while the mailbox is full (§15.4.3).",
      feedback: {
        mailbox: "Unbounded: put() never blocks (§15.4.1), so the generator can run any distance ahead.",
        semaphore: "Keys could count credits, but the items still need a queue. A bounded mailbox is both in one.",
        event: "An event cannot hold items or make the generator wait for room: it carries no data, and a trigger with nobody waiting is lost (§15.5.2).",
        "level-flag": "A flag, or another scalar variable, holds one value, and the last write determines it (§6.5): a second item overwrites the first, and nothing makes the generator wait.",
      },
      followUp: {
        after: "bounded-mailbox",
        question: "Which bound?",
        options: [
          { id: "new-1", label: "mailbox #(item_t) gen2drv = new(1);", mono: true, verdict: "wrong", feedback: "Bound 1: the second put() blocks while one item waits, so the generator can be only one item ahead." },
          {
            id: "new-2",
            label: "mailbox #(item_t) gen2drv = new(2);",
            mono: true,
            verdict: "correct",
            feedback: "Two waiting items fill it, and the third put() suspends the generator until the driver's get() makes room (§15.4.1, §15.4.3).",
          },
          { id: "new-3", label: "mailbox #(item_t) gen2drv = new(3);", mono: true, verdict: "wrong", feedback: "Bound 3 lets three items wait: one more than allowed." },
        ],
      },
      source: [lrm("§15.4.1"), lrm("§15.4.3"), lrm("§6.5")],
    }),
    binCard(IPC_BINS, {
      id: "latest-config",
      short: "only the latest config",
      prompt: "The scoreboard needs only the latest configuration value, whenever it looks.",
      correct: ["level-flag"],
      why: "A shared variable holds exactly that: the last write determines its value (§6.5), and reading it never blocks.",
      feedback: {
        mailbox: "A mailbox queues every value in FIFO order (§15.4.3); the scoreboard would have to drain the old ones to reach the latest.",
        "bounded-mailbox": "A mailbox queues values in FIFO order (§15.4.3), and a full one blocks the writer. The scoreboard wants only the newest.",
        event: "An event says that something happened, but it carries no value.",
      },
      source: [lrm("§6.5"), lrm("§15.4.3")],
    }),
    binCard(IPC_BINS, {
      id: "last-item",
      short: "'last item sent'",
      prompt: "Announce 'last item sent' to a checker that has been waiting since time 0.",
      correct: ["event"],
      why: "The checker has been blocked in @(last_item) since time 0, so it is waiting before the trigger and -> wakes it (§15.5.2).",
      partial: {
        "level-flag": "It works, since wait (sent_all) also wakes a process that is already waiting (§9.4.3), but you now manage a variable where an event simply says 'it happened'.",
        mailbox: MAILBOX_ANNOUNCES,
        "bounded-mailbox": MAILBOX_ANNOUNCES,
        semaphore: semaphoreAnnounces("the sender's"),
      },
      source: [lrm("§15.5.2"), lrm("§15.5.1"), lrm("§15.3"), lrm("§15.3.1"), lrm("§15.3.2"), lrm("§15.3.3"), lrm("§15.4.5")],
    }),
    ],
    // Defined in the lesson table's order; met mixed, so that no answer repeats and
    // the right button never steps one place along for three cards.
    ["reset-waiting", "late-monitor", "shared-bus", "every-txn", "log-file", "two-ahead", "latest-config", "last-item"],
  ),
};

/* ------------------------------------------------------------------------- */
/* function-body (F2D tasks and functions)                                    */
/* ------------------------------------------------------------------------- */

/**
 * Each whenWrong is the diagnosis shown when this bin is the WRONG pick: the
 * "legal" text explains why the statement is illegal, and the other way round.
 */
const FUNCTION_BODY_BINS: SorterBin[] = [
  { id: "legal", label: "Legal in a function body", whenWrong: "This statement can suspend the caller or enables a task, which §13.4 rules a and b forbid in a function." },
  { id: "illegal", label: "Illegal in a function body", whenWrong: "This statement does not wait, so §13.4.4 (or rule b's limit to tasks) allows it in a function." },
];

const SCHEDULED_LATER_PROVISO =
  "Legal, provided the calling thread comes from an initial or always procedure, or a fork in one, in a context where side effects are allowed; otherwise the tool shall issue an error (§13.4.4).";

const ruleA = (spec: { id: string; code: string; why: string }): SorterCard =>
  binCard(FUNCTION_BODY_BINS, {
    id: spec.id,
    short: spec.code.replace(/\s+/g, " "),
    prompt: "Can this appear in a function body?",
    code: spec.code,
    correct: ["illegal"],
    why: spec.why,
    feedback: { legal: "It can suspend the process that called the function, which rule a of §13.4 forbids." },
    source: [lrm("§13.4")],
  });

const FUNCTION_BODY_CARDS: SorterCard[] = [
  ruleA({ id: "delay", code: "#10;", why: "Rule a of §13.4: a function shall not contain time-controlling statements, and # is the first on its list." }),
  ruleA({ id: "edge", code: "@(posedge clk);", why: "@ is on rule a's list (§13.4): waiting for an edge would leave the calling expression half-evaluated." }),
  ruleA({ id: "wait", code: "wait (rdy);", why: "wait is on rule a's list (§13.4): it can block until rdy becomes true." }),
  ruleA({ id: "fork-join", code: "fork\n  x = 1;\n  y = 2;\njoin", why: "fork-join is on rule a's list (§13.4) even with nothing inside that waits: join waits for every child." }),
  ruleA({ id: "fork-join-any", code: "fork\n  x = 1;\n  y = 2;\njoin_any", why: "fork-join_any is on rule a's list (§13.4): join_any waits until one child finishes." }),
  binCard(FUNCTION_BODY_BINS, {
    id: "fork-join-none",
    short: "fork #5 ready = 1; join_none",
    prompt: "Can this appear in a function body?",
    code: "fork\n  #5 ready = 1;\njoin_none",
    correct: ["legal"],
    why: "§13.4.4 allows fork-join_none in a function, and the forked process may contain anything a task may. Its #5 runs after the function has returned, so the function itself still takes zero time.",
    caveat: SCHEDULED_LATER_PROVISO,
    feedback: { illegal: "join_none does not wait, so §13.4.4 allows it. The #5 belongs to the new process, which may contain anything legal in a task." },
    source: [lrm("§13.4.4")],
  }),
  ruleA({ id: "wait-fork", code: "wait fork;", why: "wait fork is on rule a's list (§13.4): it blocks until the child processes finish." }),
  binCard(FUNCTION_BODY_BINS, {
    id: "task-call",
    short: "write_word(8'h35), a task",
    prompt: "Can this appear in a function body?",
    code: "write_word(8'h35);   // write_word is a task",
    correct: ["illegal"],
    why: "Rule b of §13.4: a function shall not enable tasks, regardless of whether those tasks contain time-controlling statements.",
    feedback: { legal: "Even a task with no delay is off limits: rule b of §13.4 forbids enabling any task from a function." },
    source: [lrm("§13.4")],
  }),
  binCard(FUNCTION_BODY_BINS, {
    id: "nba",
    short: "flag <= 1",
    prompt: "Can this appear in a function body?",
    code: "flag <= 1;   // flag is a module variable",
    correct: ["legal"],
    why: "§13.4.4 allows nonblocking assignments in a function. The update is scheduled for later; the function itself still returns at once. That holds for a module variable such as flag: a local of a function automatic is, by default, an automatic variable, and automatic variables shall not be written with nonblocking assignments (§6.21, §10.4.2).",
    caveat: SCHEDULED_LATER_PROVISO,
    feedback: {
      illegal:
        "A nonblocking assignment to a module variable, as here, does not wait: it schedules an update and moves on, and §13.4.4 names it as allowed. An automatic variable, such as a local of a function automatic, could not take one (§6.21).",
    },
    source: [lrm("§13.4.4"), lrm("§6.21"), lrm("§10.4.2")],
  }),
  binCard(FUNCTION_BODY_BINS, {
    id: "trigger",
    short: "-> done",
    prompt: "Can this appear in a function body?",
    code: "-> done;",
    correct: ["legal"],
    why: "An event trigger does not block, and §13.4.4 names event triggers as allowed in a function.",
    feedback: { illegal: "-> does not wait for anything; §13.4.4 explicitly allows event triggers in a function." },
    source: [lrm("§13.4.4")],
  }),
  binCard(FUNCTION_BODY_BINS, {
    id: "display",
    short: "$display",
    prompt: "Can this appear in a function body?",
    code: '$display("sum = %0d", sum);',
    correct: ["legal"],
    why: "$display does not wait. A final procedure may contain only statements permitted in a function, and the standard's own final example calls $display (§9.2.3).",
    feedback: { illegal: "$display is a system task that returns at once. §9.2.3's final-procedure example, limited to function-legal statements, uses it." },
    source: [lrm("§9.2.3"), lrm("§21.2.1")],
  }),
  binCard(FUNCTION_BODY_BINS, {
    id: "void-cast",
    short: "void'(max2(3, 7))",
    prompt: "Can this appear in a function body?",
    code: "void'(max2(3, 7));",
    correct: ["legal"],
    why: "Calling another function is fine (rule b of §13.4 forbids only tasks), and casting the call to void discards its result without a warning (§13.4.1).",
    feedback: { illegal: "max2 is a function, not a task, so rule b of §13.4 does not apply; the void cast just discards the result (§13.4.1)." },
    source: [lrm("§13.4"), lrm("§13.4.1")],
  }),
];

/** The order learners meet the statements: legal and illegal mixed, never more than two in a row. */
const FUNCTION_BODY_ORDER: readonly string[] = [
  "delay",
  "nba",
  "edge",
  "task-call",
  "display",
  "trigger",
  "wait",
  "fork-join-none",
  "fork-join",
  "fork-join-any",
  "void-cast",
  "wait-fork",
];

const FUNCTION_BODY_DECK: ScenarioDeck = {
  id: "function-body",
  label: "Function body legality practice",
  title: "Can a function contain it?",
  summary: "Decide whether each statement is legal inside a function body. Keep the reason in mind: a function must return without suspending its caller.",
  fidelity: "illustration",
  assumptions: ["Rules of IEEE 1800-2023 §13.4 and §13.4.4.", "Each statement sits directly in the function's own body, not inside a fork-join_none."],
  bins: FUNCTION_BODY_BINS,
  cards: inOrder(FUNCTION_BODY_CARDS, FUNCTION_BODY_ORDER),
};

/* ------------------------------------------------------------------------- */
/* task-or-function (F2D tasks and functions)                                 */
/* ------------------------------------------------------------------------- */

const SUBROUTINE_BINS: SorterBin[] = [
  { id: "nonvoid", label: "Nonvoid function", whenWrong: "A nonvoid function returns a value in zero time, and its call is an operand (§13.4, §13.5)." },
  { id: "void", label: "Void function", whenWrong: "A void function returns no value; its call is a statement, and it runs in zero time (§13.4.1)." },
  { id: "task", label: "Task", whenWrong: "A task may wait, and its call is a statement, never an operand (§13.3, §13.5)." },
];

const TASK_OR_FUNCTION_DECK: ScenarioDeck = {
  id: "task-or-function",
  label: "Task or function practice",
  title: "Task or function?",
  summary: "Choose the kind of subroutine for each job, then check the reason against the standard.",
  fidelity: "illustration",
  bins: SUBROUTINE_BINS,
  cards: inOrder(
    [
    binCard(SUBROUTINE_BINS, {
      id: "expected-value",
      short: "expected value",
      prompt: "Compute the expected sum inside a compare: if (sum !== exp_sum(a, b)).",
      correct: ["nonvoid"],
      why: "The call is an operand in the compare, and a nonvoid function returns its value in zero time (§13.4, §13.5).",
      feedback: {
        task: "A task call is a statement, never an operand (§13.5), so if (sum !== exp_sum(a, b)) would not compile.",
        void: "A void function returns nothing, so its call cannot be an operand (§13.4.1).",
      },
      source: [lrm("§13.4"), lrm("§13.5")],
    }),
    binCard(SUBROUTINE_BINS, {
      id: "handshake",
      short: "wait for a handshake",
      prompt: "Wait until valid and ready are both high on a clock edge.",
      correct: ["task"],
      why: "Only a task may contain time controls such as @ and wait (§13.3; rule a of §13.4).",
      feedback: {
        nonvoid: "A function shall not contain @ or wait (rule a of §13.4): it must return without suspending its caller.",
        void: "A void function is still a function: no @ or wait (rule a of §13.4).",
      },
      source: [lrm("§13.3"), lrm("§13.4")],
    }),
    binCard(SUBROUTINE_BINS, {
      id: "summary",
      short: "print a summary",
      prompt: "Print the end-of-test summary: zero time, no result.",
      correct: ["void"],
      why: "Zero-time work with no result: a void function makes the compiler reject any accidental wait (§13.4, §13.4.1).",
      partial: { task: "A task works, but nothing stops a later edit from adding a wait. A void function makes the compiler reject one (§13.4)." },
      feedback: { nonvoid: "The value would be thrown away: calling a nonvoid function as a statement is legal but warns, unless you cast it to void (§13.4.1)." },
      source: [lrm("§13.4"), lrm("§13.4.1")],
    }),
    binCard(SUBROUTINE_BINS, {
      id: "two-results",
      short: "two zero-time results",
      prompt: "Return a quotient and a remainder from zero-time work.",
      correct: ["nonvoid", "void"],
      why: {
        nonvoid: "Return a struct that holds both: a function return can be a structure (§13.4.1).",
        void: "Use two output arguments: functions take the same argument directions as tasks (§13.4).",
      },
      partial: { task: "Two output arguments work in a task too, but you lose the compiler's guarantee that the call takes zero time." },
      source: [lrm("§13.4"), lrm("§13.4.1")],
    }),
    ],
    // The right button never steps one place along for three cards (nonvoid, task, then void).
    ["expected-value", "handshake", "two-results", "summary"],
  ),
};

/* ------------------------------------------------------------------------- */
/* regression-log (F2E): matcher x truth                                      */
/* ------------------------------------------------------------------------- */

/** The lesson's summary-line contract. */
export const SUMMARY_LINE_PATTERN = /^PASS=\d+ FAIL=0$/;

/** A matcher accepts the run when any log line is exactly a passing summary. */
export function summaryMatcherAccepts(log: readonly string[]): boolean {
  return log.some((line) => SUMMARY_LINE_PATTERN.test(line));
}

/**
 * The F2E bench's timing, read off its tb_top: the TEST lines in each log are
 * derived from it, never typed, so a log cannot contradict its own scenario.
 */
export interface BenchTiming {
  /** logic clk = 1'b0; always #5 clk = ~clk;: rising edges at 5, 15, 25 ns ... */
  firstRisingEdgeNs: number;
  periodNs: number;
  /** reset_dut() defaults to cycles = 2: repeat (cycles) @(posedge clk). */
  resetEdges: number;
  /** Rising edges each test waits for: every send() and every idle cycle is one @(posedge clk). */
  tests: readonly { name: string; edges: number }[];
}

export const F2E_BENCH: BenchTiming = {
  firstRisingEdgeNs: 5,
  periodNs: 10,
  resetEdges: 2,
  tests: [
    { name: "smoke", edges: 3 + 1 }, // three send(), idle(1)
    { name: "corners", edges: 7 + 1 }, // seven send(), idle(1)
    { name: "gaps", edges: 4 + 2 + 1 + 1 }, // four send(), idle(2), idle(1), idle(1)
  ],
};

/** The time at which a process that started at 0 resumes after waiting for `edges` rising edges. */
export function timeAfterEdgesNs(bench: BenchTiming, edges: number): number {
  return edges === 0 ? 0 : bench.firstRisingEdgeNs + (edges - 1) * bench.periodNs;
}

/**
 * run_one() prints "%t TEST %s" with $time on entry. With reset_dut() deleted,
 * pass resetEdges = 0: the first test then starts at time 0.
 */
export function testStartLines(bench: BenchTiming, resetEdges: number, linePrefix = ""): string[] {
  let edges = resetEdges;
  return bench.tests.map((t) => {
    const line = `${linePrefix}${timeAfterEdgesNs(bench, edges)} ns TEST ${t.name}`;
    edges += t.edges;
    return line;
  });
}

const CLEAN_TEST_LINES = testStartLines(F2E_BENCH, F2E_BENCH.resetEdges);
const NO_RESET_TEST_LINES = testStartLines(F2E_BENCH, 0);

export type RegressionBinId = "trusted-pass" | "false-pass" | "false-alarm" | "caught-fail";

export const REGRESSION_CELLS: Record<RegressionBinId, { accepts: boolean; passed: boolean }> = {
  "trusted-pass": { accepts: true, passed: true },
  "false-pass": { accepts: true, passed: false },
  "false-alarm": { accepts: false, passed: true },
  "caught-fail": { accepts: false, passed: false },
};

export function regressionBinFor(accepts: boolean, passed: boolean): RegressionBinId {
  if (accepts) return passed ? "trusted-pass" : "false-pass";
  return passed ? "false-alarm" : "caught-fail";
}

const REGRESSION_BINS: (SorterBin & { id: RegressionBinId })[] = [
  { id: "trusted-pass", label: "Accepted, really passed", whenWrong: "" },
  { id: "false-pass", label: "Accepted, did not pass", whenWrong: "" },
  { id: "false-alarm", label: "Rejected, really passed", whenWrong: "" },
  { id: "caught-fail", label: "Rejected, did not pass", whenWrong: "" },
];

interface RegressionSpec {
  id: string;
  short: string;
  prompt: string;
  log: string[];
  reallyPassed: boolean;
  /** Why the matcher accepts or rejects this log. */
  matcherNote: string;
  /** Why the run did or did not really pass. */
  passNote: string;
  source: SourceRef[];
}

/**
 * The correct cell is computed from the log with the real pattern, never by
 * hand. One axis right and the other wrong is partly correct. Each option's text
 * describes the cell, never the learner: "Why not the others?" lists options the
 * learner did not pick, so "you read ... correctly" would be false there.
 */
function regressionCard(spec: RegressionSpec): SorterCard {
  const accepts = summaryMatcherAccepts(spec.log);
  const answer = regressionBinFor(accepts, spec.reallyPassed);
  return {
    id: spec.id,
    short: spec.short,
    prompt: spec.prompt,
    log: spec.log,
    reallyPassed: spec.reallyPassed,
    codeLabel: "Log (message text is tool-dependent)",
    options: REGRESSION_BINS.map((bin) => {
      const cell = REGRESSION_CELLS[bin.id];
      const matcherRight = cell.accepts === accepts;
      const passRight = cell.passed === spec.reallyPassed;
      if (bin.id === answer) return { id: bin.id, label: bin.label, verdict: "correct" as const, feedback: `${spec.matcherNote} ${spec.passNote}` };
      if (matcherRight !== passRight) {
        const feedback = matcherRight
          ? `This cell gets the matcher right but not the run: ${spec.passNote}`
          : `This cell gets the run right but not the matcher: ${spec.matcherNote}`;
        return { id: bin.id, label: bin.label, verdict: "partial" as const, feedback };
      }
      // Short: the best choice, shown right after it, carries both notes.
      const feedback = `Both axes are off: the matcher ${accepts ? "accepts" : "rejects"} this log, and the run ${spec.reallyPassed ? "really passed" : "did not pass"}.`;
      return { id: bin.id, label: bin.label, verdict: "wrong" as const, feedback };
    }),
    source: spec.source,
  };
}

const LOG_CONTRACT = practice("F2E summary-line contract, ^PASS=\\d+ FAIL=0$");

const REGRESSION_LOG_DECK: ScenarioDeck = {
  id: "regression-log",
  label: "Regression log trust practice",
  title: "Can the regression trust this log?",
  summary: "Place each run on the grid: does a ^PASS=\\d+ FAIL=0$ matcher accept its log, and did the run really pass?",
  fidelity: "model",
  assumptions: [
    "The matcher is the real regular expression ^PASS=\\d+ FAIL=0$, run on every log line shown.",
    "Message text and exit statuses are tool-dependent: §20.10 says only that $fatal ends the run with an error code, and §20.2 that $finish returns control to the operating system.",
  ],
  bins: REGRESSION_BINS,
  axis: {
    title: "Matcher against reality",
    rowLabel: "A ^PASS=\\d+ FAIL=0$ matcher",
    rows: [
      { id: "accepts", label: "accepts it" },
      { id: "rejects", label: "rejects it" },
    ],
    columnLabel: "The run",
    columns: [
      { id: "passed", label: "really passed" },
      { id: "failed", label: "did not pass" },
    ],
    cells: {
      "trusted-pass": { row: "accepts", column: "passed" },
      "false-pass": { row: "accepts", column: "failed" },
      "false-alarm": { row: "rejects", column: "passed" },
      "caught-fail": { row: "rejects", column: "failed" },
    },
    note: "Accepted but not passed is the dangerous cell: a broken run that the regression reports as passing.",
  },
  cards: inOrder(
    [
    regressionCard({
      id: "clean",
      short: "clean run",
      prompt: "A clean run of all three tests.",
      log: [...CLEAN_TEST_LINES, "PASS=14 FAIL=0"],
      reallyPassed: true,
      matcherNote: "The last line is exactly PASS=14 FAIL=0, so the anchored pattern matches it.",
      passNote: "All 14 checks ran and passed, and nothing else reported an error.",
      source: [LOG_CONTRACT],
    }),
    regressionCard({
      id: "zero-checks",
      short: "PASS=0 FAIL=0, no guard",
      prompt: "report() prints only the two counters, with no guards for leftovers or for a run that checked nothing. reset_dut() was deleted, so the checker skipped every edge.",
      // No reset_dut(): smoke starts at 0 ns, not 15 ns, so the log carries no false clue that reset ran.
      log: [...NO_RESET_TEST_LINES, "PASS=0 FAIL=0"],
      reallyPassed: false,
      matcherNote: "\\d+ matches 0, so PASS=0 FAIL=0 satisfies the pattern.",
      passNote: "Nothing was compared, and a run that checked nothing proves nothing. The lesson's report() counts leftovers and a run with zero checks as failures, so its line could not match.",
      source: [LOG_CONTRACT],
    }),
    regressionCard({
      id: "crash",
      short: "crash, no summary",
      prompt: "The simulator process died partway through the corners test.",
      log: [...CLEAN_TEST_LINES.slice(0, 2), "[simulator process ended: no further output]"],
      reallyPassed: false,
      matcherNote: "No line is a summary, so nothing matches: a missing summary counts as a failure.",
      passNote: "The run never finished, so the remaining checks never ran.",
      source: [LOG_CONTRACT],
    }),
    regressionCard({
      id: "tool-prefix",
      short: "'# ' tool prefix",
      prompt: "The same clean run, from a simulator that prefixes every transcript line.",
      log: [...testStartLines(F2E_BENCH, F2E_BENCH.resetEdges, "# "), "# PASS=14 FAIL=0"],
      reallyPassed: true,
      matcherNote: "^ anchors the pattern at the start of the line, and every line starts with '# ', so nothing matches. Strip the tool's prefix first (tool-dependent).",
      passNote: "Every check passed: this is a false alarm, not a failure.",
      source: [LOG_CONTRACT],
    }),
    regressionCard({
      id: "rtl-assertion",
      short: "RTL $error beside PASS=14 FAIL=0",
      prompt: "An immediate assertion inside the RTL fails once. The bench's own counters see nothing.",
      log: [...CLEAN_TEST_LINES.slice(0, 2), "Error: assertion failed at 75 ns in tb_top.dut", CLEAN_TEST_LINES[2], "PASS=14 FAIL=0"],
      reallyPassed: false,
      matcherNote: "The summary line is still exactly PASS=14 FAIL=0, so the pattern matches.",
      passNote: "A failing immediate assertion with no else clause calls $error (§16.3), which never touches fail_cnt. The design broke a rule, so scan the log for the tool's error messages too.",
      source: [LOG_CONTRACT, lrm("§16.3")],
    }),
    regressionCard({
      id: "fatal-exit-0",
      short: "exit status 0 after $fatal",
      prompt: "The watchdog fires: report() prints the counters, then $fatal ends the run. The simulator exits with status 0.",
      log: [CLEAN_TEST_LINES[0], "Error: CHK 1 result(s) never arrived", "PASS=2 FAIL=2", "Fatal: WDOG test 'smoke' still running at 10000 ns"],
      reallyPassed: false,
      matcherNote: "PASS=2 FAIL=2 does not end in FAIL=0, so the pattern does not match and the log rejects the run.",
      passNote: "A hang is a failure. The exit status cannot be trusted either way: §20.10 says only that $fatal ends the run with an error code, without defining its value, so exit statuses are tool-dependent.",
      source: [LOG_CONTRACT, lrm("§20.10"), lrm("§20.2")],
    }),
    ],
    // clean comes before tool-prefix, which calls itself "the same clean run". No cell
    // repeats, and the right cell never steps one place along for three cards.
    ["clean", "zero-checks", "crash", "tool-prefix", "fatal-exit-0", "rtl-assertion"],
  ),
};

/* ------------------------------------------------------------------------- */
/* Registry, grading and validation                                           */
/* ------------------------------------------------------------------------- */

export const SCENARIO_DECKS: Record<ScenarioDeckId, ScenarioDeck> = {
  containers: CONTAINERS_DECK,
  "verification-methods": VERIFICATION_METHODS_DECK,
  "sv-features": SV_FEATURES_DECK,
  "uvm-name-layers": UVM_NAME_LAYERS_DECK,
  "uvm-compile-triage": UVM_COMPILE_TRIAGE_DECK,
  "ipc-tools": IPC_TOOLS_DECK,
  "function-body": FUNCTION_BODY_DECK,
  "task-or-function": TASK_OR_FUNCTION_DECK,
  "regression-log": REGRESSION_LOG_DECK,
};

export function getScenarioDeck(id: string): ScenarioDeck | undefined {
  return (SCENARIO_DECK_IDS as readonly string[]).includes(id) ? SCENARIO_DECKS[id as ScenarioDeckId] : undefined;
}

export interface CardSelection {
  cards: SorterCard[];
  /** Card ids the lesson asked for that the deck does not have. */
  unknown: string[];
  /** Bin ids the lesson asked for that the deck does not have. */
  unknownBins: string[];
  /** Cards dropped because the bins the lesson kept hide every correct bin. */
  unanswerable: string[];
}

/**
 * One card with only the kept bins. A second step whose bin is hidden goes too.
 * A kept step's own options that are bins of the deck (the async FIFO's second
 * method) are filtered the same way; options that are not bins (key counts,
 * bounds, kinds of wait) stay. If that leaves the step no correct option, or a
 * single option, which would be no question at all, the step goes.
 */
function withBins(card: SorterCard, keep: ReadonlySet<string>, deckBins: ReadonlySet<string>): SorterCard {
  const options = card.options.filter((o) => keep.has(o.id));
  const { followUp, ...rest } = card;
  if (!followUp || !keep.has(followUp.after)) return { ...rest, options };
  const stepOptions = followUp.options.filter((o) => !deckBins.has(o.id) || keep.has(o.id));
  if (stepOptions.length < 2 || !stepOptions.some((o) => o.verdict === "correct")) return { ...rest, options };
  return { ...rest, options, followUp: { ...followUp, options: stepOptions } };
}

/**
 * The cards a lesson asked for, in its order, offering only the bins it asked
 * for (in the deck's order). Unknown ids are reported, never dropped silently,
 * and so is a card whose every correct bin the lesson hid.
 */
export function selectCards(deck: ScenarioDeck, ids?: readonly string[], binIds?: readonly string[]): CardSelection {
  const unknown: string[] = [];
  let cards: SorterCard[] = [];
  if (!ids || ids.length === 0) cards = deck.cards;
  else {
    for (const id of ids) {
      const card = deck.cards.find((c) => c.id === id);
      if (!card) unknown.push(id);
      else if (!cards.includes(card)) cards.push(card);
    }
  }
  if (!binIds || binIds.length === 0) return { cards, unknown, unknownBins: [], unanswerable: [] };
  const deckBins = new Set(deck.bins.map((b) => b.id));
  const unknownBins = binIds.filter((id) => !deckBins.has(id));
  const keep = new Set(binIds.filter((id) => deckBins.has(id)));
  const unanswerable: string[] = [];
  const kept: SorterCard[] = [];
  for (const card of cards) {
    const restricted = withBins(card, keep, deckBins);
    if (correctOptions(restricted).length === 0) unanswerable.push(card.id);
    else kept.push(restricted);
  }
  return { cards: kept, unknown, unknownBins, unanswerable };
}

/** The most cards in a row that share a correct bin: above two, a streak starts to give the answer away. */
export function longestAnswerStreak(cards: readonly SorterCard[]): number {
  let longest = 0;
  for (let start = 0; start < cards.length; start += 1) {
    let common = new Set(correctOptions(cards[start]).map((o) => o.id));
    let end = start;
    while (end + 1 < cards.length) {
      const nextIds = new Set(correctOptions(cards[end + 1]).map((o) => o.id));
      const shared = new Set([...common].filter((id) => nextIds.has(id)));
      if (shared.size === 0) break;
      common = shared;
      end += 1;
    }
    longest = Math.max(longest, end - start + 1);
  }
  return longest;
}

/** Where a card's correct options sit among its buttons (0-based). */
export function correctPositions(card: SorterCard): number[] {
  return card.options.flatMap((o, i) => (o.verdict === "correct" ? [i] : []));
}

/**
 * The most cards in a row whose correct button moves by `step` places from one
 * card to the next: 0 is the same button again (a deck that always puts the
 * answer first), +1 or -1 the next or previous one (a deck whose cards follow
 * its bin order). Above two, the button order starts to give the next answer
 * away. A card with several correct options continues a run through any of them.
 */
export function longestPositionRun(cards: readonly SorterCard[], step: -1 | 0 | 1): number {
  let longest = 0;
  let previous = new Map<number, number>();
  for (const card of cards) {
    const current = new Map<number, number>();
    for (const position of correctPositions(card)) current.set(position, (previous.get(position - step) ?? 0) + 1);
    for (const run of current.values()) longest = Math.max(longest, run);
    previous = current;
  }
  return longest;
}

export interface CardAnswer {
  primary?: string;
  followUp?: string;
}

export function optionById(card: SorterCard, id: string | undefined): SorterOption | undefined {
  return id === undefined ? undefined : card.options.find((o) => o.id === id);
}

export function followUpOptionById(card: SorterCard, id: string | undefined): SorterOption | undefined {
  return id === undefined ? undefined : card.followUp?.options.find((o) => o.id === id);
}

export function correctOptions(card: SorterCard): SorterOption[] {
  return card.options.filter((o) => o.verdict === "correct");
}

export function bestFollowUp(card: SorterCard): SorterOption | undefined {
  return card.followUp?.options.find((o) => o.verdict === "correct");
}

/**
 * The second step opens only after the bin it belongs to, which the validator
 * requires to be a correct bin. So its appearance tells the learner the first
 * pick was right. That is deliberate, and the decks that use it say so in their
 * summaries: the first pick is already locked when the step opens, and the
 * step's own answer stays hidden until it is committed. Asking it after every
 * pick would not hide the verdict either, because each question names its tool
 * (a key count names a semaphore, a bound names a bounded mailbox).
 */
export function followUpApplies(card: SorterCard, primary: string | undefined): boolean {
  return Boolean(card.followUp && primary !== undefined && card.followUp.after === primary);
}

/**
 * The options a reveal does not explain on its own: it explains the pick and
 * every correct bin, so these are the other wrong and partly correct bins, plus,
 * once a second step was answered, the step's other wrong options. The reveal
 * lists them under "Why not the others?", so every option's feedback can be read.
 */
export function otherOptions(card: SorterCard, answer: CardAnswer | undefined): { options: SorterOption[]; step2: SorterOption[] } {
  if (!isAnswerComplete(card, answer)) return { options: [], step2: [] };
  const options = card.options.filter((o) => o.verdict !== "correct" && o.id !== answer?.primary);
  const step2 =
    card.followUp && followUpApplies(card, answer?.primary) ? card.followUp.options.filter((o) => o.verdict !== "correct" && o.id !== answer?.followUp) : [];
  return { options, step2 };
}

export function isAnswerComplete(card: SorterCard, answer: CardAnswer | undefined): boolean {
  if (!answer?.primary || !optionById(card, answer.primary)) return false;
  return !followUpApplies(card, answer.primary) || Boolean(followUpOptionById(card, answer.followUp));
}

/**
 * correct: a correct bin, and the right second step when there is one.
 * partial: a partly correct bin, or a correct bin with the wrong second step.
 * null: not answered yet (or waiting for the second step).
 */
export function gradeAnswer(card: SorterCard, answer: CardAnswer | undefined): Verdict | null {
  if (!isAnswerComplete(card, answer)) return null;
  const primary = optionById(card, answer?.primary) as SorterOption;
  if (primary.verdict !== "correct") return primary.verdict;
  if (!followUpApplies(card, primary.id)) return "correct";
  return followUpOptionById(card, answer?.followUp)?.verdict === "correct" ? "correct" : "partial";
}

export interface SorterTally {
  total: number;
  answered: number;
  correct: number;
  partial: number;
  wrong: number;
}

export function tallyAnswers(cards: readonly SorterCard[], answers: Record<string, CardAnswer | undefined>): SorterTally {
  const tally: SorterTally = { total: cards.length, answered: 0, correct: 0, partial: 0, wrong: 0 };
  for (const card of cards) {
    const verdict = gradeAnswer(card, answers[card.id]);
    if (verdict === null) continue;
    tally.answered += 1;
    tally[verdict] += 1;
  }
  return tally;
}

/** The axis cell a card belongs in: the cell of its (first) correct bin. */
export function axisCellFor(deck: ScenarioDeck, card: SorterCard): { row: string; column: string } | undefined {
  const best = correctOptions(card)[0];
  return best && deck.axis ? deck.axis.cells[best.id] : undefined;
}

const MIN_FEEDBACK = 20;

function checkOptions(where: string, options: SorterOption[], problems: string[]) {
  const seen = new Set<string>();
  for (const o of options) {
    if (seen.has(o.id)) problems.push(`${where}: duplicate option id "${o.id}"`);
    seen.add(o.id);
    if (!o.label.trim()) problems.push(`${where}: option "${o.id}" has no label`);
    if (o.feedback.trim().length < MIN_FEEDBACK) problems.push(`${where}: option "${o.id}" has no feedback`);
  }
  if (!options.some((o) => o.verdict === "correct")) problems.push(`${where}: no correct option`);
}

/** Every rule a deck must satisfy; an empty list means the deck is sound. */
export function validateDeck(deck: ScenarioDeck): string[] {
  const problems: string[] = [];
  const binIds = new Set(deck.bins.map((b) => b.id));
  if (binIds.size !== deck.bins.length) problems.push(`${deck.id}: duplicate bin id`);
  if (deck.cards.length === 0) problems.push(`${deck.id}: no cards`);
  const cardIds = new Set<string>();
  for (const card of deck.cards) {
    const where = `${deck.id}/${card.id}`;
    if (cardIds.has(card.id)) problems.push(`${where}: duplicate card id`);
    cardIds.add(card.id);
    if (!card.prompt.trim()) problems.push(`${where}: no prompt`);
    checkOptions(where, card.options, problems);
    for (const o of card.options) {
      if (!binIds.has(o.id)) problems.push(`${where}: option "${o.id}" is not a bin of the deck`);
    }
    if (card.source.length === 0 || card.source.some((s) => !s.ref.trim())) problems.push(`${where}: names no source`);
    if (card.followUp) {
      const after = optionById(card, card.followUp.after);
      if (!after) problems.push(`${where}: follow-up opens after unknown bin "${card.followUp.after}"`);
      else if (after.verdict !== "correct") problems.push(`${where}: follow-up must follow a correct bin`);
      checkOptions(`${where} follow-up`, card.followUp.options, problems);
    }
    if (card.stack) {
      if (!binIds.has(card.stack.layer)) problems.push(`${where}: stack layer "${card.stack.layer}" is not a bin`);
      else if (optionById(card, card.stack.layer)?.verdict !== "correct") problems.push(`${where}: the struck-out layer must be the correct bin`);
    }
    if (deck.axis && !axisCellFor(deck, card)) problems.push(`${where}: its correct bin has no axis cell`);
    if (card.log && card.reallyPassed === undefined) problems.push(`${where}: a log card must say whether the run really passed`);
  }
  if (deck.axis) {
    const rows = new Set(deck.axis.rows.map((r) => r.id));
    const columns = new Set(deck.axis.columns.map((c) => c.id));
    for (const [bin, cell] of Object.entries(deck.axis.cells)) {
      if (!binIds.has(bin)) problems.push(`${deck.id}: axis cell for unknown bin "${bin}"`);
      if (!rows.has(cell.row) || !columns.has(cell.column)) problems.push(`${deck.id}: axis cell for "${bin}" names an unknown row or column`);
    }
  }
  return problems;
}
