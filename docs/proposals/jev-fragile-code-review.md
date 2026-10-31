# Fragile parsing in this repo: what a decision model could and could not replace

Status: review with two live experiments (2026-10-31), done with the `typesafe-ai` skill. Nothing is changed in
the code yet; the proposals at the end are ranked and separate from `TASKS.md`.

## Method and budget

- Surveyed the scripts and runtime code with the most regex and heuristic parsing, then judged each against the
  skill's rules: Jev makes judgments a person could make at a glance from the state; code makes decisions;
  exact structure, arithmetic and lookups stay in code.
- Two experiments ran against the live API with the owner's key. Data sent: compile-error lines with about 28
  lines of the project's own lesson or lab code around each error, and search queries with section headings. No
  learner data, no standard text. Total 53,479 input tokens, about $0.0022.
- Weekly agent usage was at 97 % when this started, so the work was done solo with no workflows.

## Inventory of fragile code, with a verdict for each

| Code | What is fragile | Verdict |
|---|---|---|
| `scripts/compile-sv.mjs`, the `// compile` tag grammar (lines 105–112) and unit assembly (118–141, 265–283) | A hand-written mini-grammar (`add to X`, bare file names, free text in parentheses). This week six tags had to be rewritten by hand before the units assembled correctly. | **Code, not Jev.** Define a strict tag syntax, reject anything else with a clear error, and unit-test the parser. A judgment model would hide the ambiguity instead of removing it. |
| `scripts/compile-sv.mjs`, error classification (`known` kinds, line 325) | Each new failure's kind (tool limitation, code bug, harness) is assigned by an expensive fixer agent. | **Tested (experiment 1).** Jev separates "a bug in the code" cleanly, but cannot recognise a tool limitation unless the message says so, because that judgment needs the standard. See below. |
| `src/components/search/search-engine.ts` | Every typed word must match, so natural-language questions return nothing. Hand-tuned boosts (+30, +6, +3). | **Code first, then maybe Jev (experiment 2).** The shortlist has no recall for questions; reranking cannot fix an empty list. |
| `scripts/audit-uvm-factory.ts` | Regex over SystemVerilog to find `new()` on UVM-derived classes; exclusions are rules. | **Candidate for the pre-parsed-extraction cookbook**: regex finds every `new(`, Jev judges "is this a direct construction of a UVM-derived object?". Untested: the audit finds nothing today, so there are no positives. Craft cases before building. |
| `scripts/check-mdx.mjs` (lines 49–74) | Regexes parse TypeScript source to list the component registry and flashcard decks. | **Code, not Jev.** Import the modules, or use the TypeScript parser. |
| `src/server/ai/index.ts`, Feynman feedback | Prompt-and-parse: Gemini returns a 0–100 score and prose through a JSON schema. | **Composite-scoring pattern** (proposal B3): one Noul per required concept, score computed in code. Untested. |
| Workflow scripts, finding severity | The sweep gets severity from a schema-enforced enum (sound). Ad-hoc scripts parse free-text findings with `/^\s*S[12]\b/` (fragile). | **Code:** always use a schema with a severity field. A Jev Score is the fallback only when findings arrive as text. |

## Experiment 1: tool limitation or code bug, from the error and the code

- **Data.** 48 labelled compile units from this month's passes: 14 fixed as code bugs, 34 confirmed limitations.
  State per unit: the Verilator error lines and 28 lines of pre-fix code around the error. Three questions
  bundled per request: two Nouls and a three-way Choice.
- **Result.**
  - **Code bugs:** all 14 scored "not a tool limitation" below 0.3, mean 0.14. Reserved words, a missing
    `endmodule`, mixed time units and undeclared names are visible in the state, and the judgment is clean.
  - **Limitations:** mean 0.52; 18 of 34 landed in the unsettled band and 6 were called bugs. These are the
    cases where Verilator's message does not say "Unsupported": coverpoint member access, a clocking block through
    a modport, the implicit `std::process` import. Whether such code is legal is a clause-level question. It fails
    the skill's human test, since a smart person without the standard cannot tell from this state either.
  - **Choice top-1:** 27 of 48 against my labels. Five "misses" were my labels being coarser than the model: for
    I-SV-6 units 4, 6 and 7 and B-AHB-3 unit 3, Jev chose `missing_file_or_setup`, and their fix was in fact a
    compile-tag change, not a code edit.
- **Reading.** Where the message already says "Unsupported" or "Internal Error", a regex is enough. Where it does
  not, Jev adds nothing, and the LRM lookup by an agent stays necessary. The promising part is the
  setup-versus-code split, which the current pipeline does not make at all.
- **Cost.** 47,967 input tokens, about $0.0020, for 144 questions.

## Experiment 2: rerank the real search engine's shortlist

- **Data.** 12 natural-language queries with the module a learner should land in, run through the real
  `searchCurriculum`, then one Noul per candidate ("Does this section answer `query`?") with the full question
  as state.
- **Result.**
  - The engine returned **no candidates for 11 of the 12 questions**, and none for 6 of 12 keyword forms. The
    engine requires every token to match: "mailbox semaphore" finds one result, "mailbox or semaphore" and "use
    mailbox semaphore" find none. The search box's own hint ("Try mailbox, WSTRB, uvm_config_db") shows it was
    built for keyword lookup.
  - Where a keyword shortlist existed (6 queries), lexical top-1 was already right in 6 of 6 and Jev in 5 of 6.
    The one swap was between two lessons' "disable fork" sections, both defensible.
  - Jev's probabilities were low (0.22–0.76), because the state is thin: the index carries headings and
    normalised field text, not the section body. A judgment needs what a person would read.
- **Reading.** The fragile part is the shortlist, not the ranking. Reranking becomes worth testing only after the
  engine scores partial matches and the index carries section text.
- **Cost.** 4,812 input tokens, about $0.0002.

## Cookbooks that apply

| Cookbook or pattern | Where it fits here | Status |
|---|---|---|
| Citation check | Verifying every § cite against the local standards' text (proposal A1) | Not tested here; needs an eval set of known-wrong cites |
| Extraction cascade (verify and escalate) | Triage of sweep findings before the three-skeptic stage (A2); CI compile-failure triage | Partially supported by experiment 1 (setup-versus-code) |
| Re-ranking | Search, after the engine is fixed | Blocked on the code fix |
| Pre-parsed value extraction | Factory audit; lab-error fix-note selection | Untested |
| Composite scoring | Feynman feedback; interview-answer scoring | Untested |

## Proposed changes, ranked

1. **Search: score partial matches and index section text** (code only). Match any token, rank by coverage and
   field weight, and add the first paragraph of each section to the index. This is the highest learner-impact
   fix found, and it costs nothing per query. Measure with the 12 queries in `jev-experiments/exp2_rerank.mts`
   before and after. Rerank with Jev only if top-1 is still weak afterwards.
2. **Compile tags: a strict grammar with validation** (code only). Accept `// compile`, `// compile: <file>`,
   `// compile: add to <file|package>`; reject everything else at check time with the offending line. This
   removes the class of failure that cost a fix pass this week.
3. **CI compile-failure triage: a setup-versus-code Noul** (Jev, small). When the compile check finds a new
   failure, ask "Does the error say a module, include or file the code depends on was not found?" and route
   those to a tag check instead of a fixer agent. Build a finer-labelled set first (code bug, setup, limitation);
   experiment 1's labels were too coarse to measure this properly.
4. **Learner lab errors: an authored fix note chosen by Jev** (Jev, after 3). Regex extracts the error and
   construct; Jev picks among a curated taxonomy, each entry with a lesson link. Keep the limitation-versus-bug
   decision in code, on `Unsupported|Internal Error`, plus the `known` list.
5. **Citation check script** (Jev). The strongest use case in the proposal, still untested. Assemble 20 known
   wrong cites from the sweep history and 50 verified ones, then run the cookbook's three-way Choice.

Not worth building: Jev deciding whether rejected code is legal SystemVerilog; Jev reranking today's search.

## Artefacts and hygiene

- Scripts: `docs/proposals/jev-experiments/exp1_compile_errors.py` and `exp2_rerank.mts`. They read
  `TYPESAFE_API_KEY` from the environment and contain no secrets. Experiment 1 also needs this session's
  compile-fix and probe result files, which are not in the repo; experiment 2 runs from the repo alone with
  Node 22 (`npx tsx`).
- The API key was pasted into the chat for this work, so it exists in that transcript. Rotate it in the TypeSafe
  console and keep the new one in a Worker secret or a local env file outside the repo.
- Raw results: `exp1_rows.json` in the session scratchpad (per-unit probabilities), not committed.
