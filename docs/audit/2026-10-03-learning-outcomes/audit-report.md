# Learning-outcome audit: can sv-uvm-guide produce independent complex-testbench engineers?

**Date:** 2026-10-03 · **Commit audited:** `488f7f43` (`main`, identical to `origin/main` after a fresh fetch) · **Auditor stance:** hardware-verification educator, SV/UVM engineer, product designer, software reviewer.

Companion deliverables in this folder:

| Deliverable | File |
|---|---|
| 1. Comprehensive audit report | this file |
| 2. Intent-versus-implementation matrix | [intent-vs-implementation.md](intent-vs-implementation.md) |
| 3. Module / concept / competency coverage matrix | [coverage-matrix.md](coverage-matrix.md) |
| 4. Practical TB mastery progression | [tb-mastery-progression.md](tb-mastery-progression.md) |
| 5. Prioritized improvement plan with bounded tasks | [improvement-plan.md](improvement-plan.md) |
| 6. Copy-paste implementation handoff prompt | [implementation-handoff-prompt.md](implementation-handoff-prompt.md) |
| Area evidence (per module, per interactive, per lab) | [appendices/](appendices/) A–I and `inventory.json` |

---

## 0. Verdict

**No.** The current site cannot take a learner to independent complex-testbench competence. It can build vocabulary and a partial explanatory model, but it rarely asks learners to predict, almost never verifies that they can write code, and never verifies that they can debug or transfer.

Four structural reasons, in order of impact:

1. **The teaching surfaces were broken or misleading on the live site.** Verified in the browser before this session's fixes:
   - Every `InteractiveCode` block (55 uses in 35 lessons) showed `[object Object]` or an empty editor, so the OOP, randomization, coverage, SVA and IPC code was invisible.
   - Every markdown table rendered as raw pipe text, including F3B's core region table.
   - All 21 interview "playgrounds" had blank options.
   - 32 quiz questions graded the wrong option as correct.
   - Code fonts turned `<=` into `≤`.
2. **Core semantics are taught wrongly in several places.** Each surface contradicts another:
   - Scheduling regions and clocking-block timing (F2C, F3A, F4C, the region game, the interview banks).
   - UVM phasing direction, `super.build_phase`, analysis `write()`, factory precedence.
   - RAL prediction terminology inverted; a `poke` answer graded wrongly.
   - AHB burst boundaries (1KB, not "no restriction").
   - AXI write-before-address legality.

   All checked against IEEE 1800-2023 (`system_verilog_lrm.pdf` in the repo), IEEE 1800.2 behavior, or Arm IHI0033 text.
3. **There is no verified practice loop.**
   - 61 of 63 available lab steps are self-attested, and the only "graded" lab matches the tokens `int myVar ;`.
   - The simulation runner is off by default, has no UVM library, and sends only editable files. Its "coverage" is hard-coded to 0.
   - Several reference solutions do not do what their READMEs claim; the UVM capstone monitor samples after NBA.
4. **The milestone ladder has holes exactly where independence is built.** M1 (race-aware interface TB), M5 (multi-agent with virtual sequences) and M8 (subsystem capstone) have no runnable lab. No milestone has an unscaffolded, automatically checked task.

What *is* strong:
- The authored scope is broad: 69 modules spanning T1→T4 including AMBA.
- A few modules have real depth: B-AXI-5's deadlock analysis, A-UVM-5's callback-vs-factory table, E-SOC-1's strategy artifact, I-SV-2B's solver triage.
- The platform has sound bones: server-owned grading boundaries, versioned lab manifests, a sandboxed runner contract, lazy interactives.
- This session's F3C slice (§9) shows the curriculum can be made model-driven, prediction-first and test-backed without a rewrite.

---

## 1. Current state and method

### 1.1 Repository state

- `git fetch --all --prune` found no new commits: `HEAD = origin/main = 488f7f43d2523840efebb0c4d1f87e9087807c2d` (PR #391).
- Pre-existing uncommitted work was preserved, not modified or reverted:
  - `SESSION_HANDOFF.txt` and `TASKS.md` pointer edits from the earlier 2026-10-03 analysis;
  - the untracked `docs/project-analysis-2026-10-03.md` and `docs/agent-context-prompt.md`.
- Node 20.12.2 / npm 10.5.0 (engine warnings for some transitive packages, as before).

### 1.2 What was examined

| Layer | Coverage | How |
|---|---|---|
| Curriculum content | **Exhaustive**: all 69 module indexes and 105 MDX files | Nine parallel read-only reviews (T1, T2-SV, T2-UVM, T3-UVM+T4, T3-AMBA, SV interactives, UVM interactives, labs, platform). Each produced per-module inventories and 0/1/2 competency ratings with file:line evidence (appendices A–E). |
| Interactives | **Exhaustive by source**: all 94 registered lazy interactives plus practice/exercise components | Classification, semantic-model review, prediction/feedback/transfer, accessibility (appendices F, G) |
| Labs | **Exhaustive**: 29 manifests, every starter/solution asset, graders, runner, simulate API | Hand-traced semantics; no simulator was available locally (appendix H) |
| Platform | **Exhaustive recount** of every prior-audit inventory claim; routes with default flags; persistence; mocks | Commands recorded in appendix I |
| Running site | **Sampled**: production build served locally on :3100 with default feature flags | In-app browser plus headless Playwright: home, placement quiz, curriculum, practice hub, F3B, F3C, I-SV-1, desktop and 375–390 px. 62 route HTTP probes. |
| Normative claims | **Targeted** | IEEE 1800-2023 text extracted from the repo PDF; Arm IHI0033B.b and IHI0022E obtained by the AMBA reviewer; UVM 1.2 class reference where cited. CHI and IHI0022H claims are marked unverified. |

Default-flag experience and forced-on test configurations are kept separate throughout. Release Playwright tests force all flags on (`playwright.config.ts:15-20`), so they do **not** describe what a default visitor sees.

### 1.3 Confidence conventions

- **High:** reproduced in source, in the browser, or against the standard's text.
- **Medium:** strong inference without execution, such as lab runtime behavior traced by hand.
- **Low:** suspicion.

Severities:
- **S1:** misleads on core semantics or blocks the outcome.
- **S2:** a significant competency gap.
- **S3:** moderate.
- **S4:** polish.

---

## 2. Re-verification of the earlier 2026-10-03 analysis

Every prior inventory claim was recounted from source (appendix I §1 has commands and outputs).

| Prior claim | Verdict |
|---|---|
| 69 module indexes / 105 MDX (T1 13/16, T2 24/51, T3 20/23, T4 12/15) | CONFIRMED |
| 29 lab manifests: 21 available, 8 coming soon; 63 steps, 61 self-attested, 2 graded | CONFIRMED |
| 64 flashcard files (412 cards); 53 registered keys (363 cards); 32 unregistered MDX references (29 in module indexes) | CONFIRMED. After this session: 54 keys, 31 unregistered references (F3C wired). |
| Lesson/exercise progress is browser-local; Prisma `LessonProgress` has no writer; legacy Firestore remains | CONFIRMED, and worse: `completeLesson()` is never called, so local progress also stays at 0% (appendix I PLAT-03) |
| Dashboard / assessment / projects / social features use sample data; all 5 flags default off | CONFIRMED |
| Foundational upgrade pending: 0/6 visuals, no foundational bank, no katas | CONFIRMED at `488f7f43`. This session delivered the F3C `RaceConditionDebugger` plus four companions (§9). |
| Interview-spec schema (`question/difficulty/answer_type/key_points`) conflicts with `bank-schema.test.ts` | CONFIRMED |
| Five optional audits skipped; enabling them gives 14 pass / 1 fail (link matcher, 41 hits) | CONFIRMED |
| Ordinary `npm test`: 1 missing-secret failure from Prisma reloading `.env`; preload gives 790 pass / 5 skip | CONFIRMED by reproduction (§3). Not fixed: it is a test-isolation issue, and the workaround is not presented as a fix. |

New issues not in the earlier analysis (all High confidence):
- `InteractiveCode` extraction is broken.
- GFM tables and callouts don't render.
- Quiz numeric answer keys are inverted.
- Interview playgrounds are blank.
- Code ligatures render `<=` as `≤`.
- Lesson pages overflow horizontally on phones.
- Homepage "Live Code Editor" links to a 404.
- Coming-soon lab cards link to 404s.
- Navigation order is alphabetical rather than authored.
- Interview banks are not surfaced anywhere in the UI.
- Many S1/S2 semantic errors (§7.1).

---

## 3. Technical and operational evidence (fresh, local)

Historical CI (PR #391, run 29693855900, July 19) is reported separately: it passed the required gates on Linux with PostgreSQL, Verilator lint of 23 reference files, and 12 forced-flag Playwright flows. **Nothing below re-runs CI.**

| Check (2026-10-03, this machine) | Before this session's changes | After |
|---|---|---|
| `npm test` (ordinary) | 119/120 files; **789 pass, 1 fail, 5 skip**. Same `security-config` missing-secret failure (Prisma loads `.env`). | Not separately re-run; the failure mechanism is unchanged |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run` | 120 files; 790 pass, 5 skip | **128 files; 836 pass, 5 skip** (46 new tests) |
| `npm run type-check` / `npm run lint` | pass / pass | pass / pass |
| `npm run generate:curriculum` | pass, no drift | pass (curriculum-data unchanged) |
| `npm run validate:content` | 105 MDX / 29 manifests | 105 MDX / 29 manifests |
| `npm run validate:redirects`, `npm run test:labs:strict` | 27 redirects / 4 pass | unchanged |
| `ANALYZE=true npm run build` + `npm run bundle:check` | built at the same commit earlier today | **pass**: 156 static pages; budget pass; curriculum entry 133,383 B gzip (prior 132,211 B) |
| Full lesson sweep (headless Chromium, 390 px, default flags, all 105 lessons) | not run before the fixes; the spot checks below found the defects | **0** literal `[!NOTE]` callouts, **0** raw pipe tables, **0** `[object Object]` editors, **0** non-200s, **0** page errors (7 lessons showed hydration errors before D-21; their cause is MDX 2 parsing of multi-line JSX, so they predate this session), **12** lessons with horizontal overflow (28 before the table fix; all traced to specific legacy components) |
| Browser, default flags | homepage CTA 404 (`/practice/lab`); `#ai-tutor` anchor missing; 8 coming-soon lab cards → 404; `/practice/lab/mock-lab` publicly shows fake test results; F3B table as pipes; I-SV-1 editors contain `[object Object]`; F3C flashcards empty; B-AXI-6 at 390 px renders 872 px wide | F3B table renders; I-SV-1 editors show code; F3C deck loads; F3C has no console errors at 1440 and 390 px. The phone-overflow fix is in the final build; re-verify with `node` + Playwright per the improvement plan. |
| Not run | Migration rehearsal (needs a disposable PostgreSQL), SV compile (no Verilator/Icarus locally), Docker runner, authenticated E2E, live Gemini/OAuth | Same. No production data was touched; no secrets were printed. |

Labs require sign-in. With no Google OAuth configured locally, an anonymous visitor cannot open any lab, which was expected. Lab behavior was audited from source.

---

## 4. Part A: intent versus actual experience (summary)

The full matrix is in [intent-vs-implementation.md](intent-vs-implementation.md). The six learner journeys:

| Journey | What the learner can actually do today | Where it breaks |
|---|---|---|
| **1. Beginner: verification and basic SV** | Read motivation (F1A–F1C), data types and procedural basics; answer recall MCQs. | Region table and game taught `final`/assertions in Postponed (fixed this session). F3A's delta demo was wrong (fixed). No operators/expressions lesson; struct/union never taught; F2B/F2D lean on UVM/OOP syntax before it is taught; the only T1 lab grades `int myVar;`. |
| **2. SV → first working UVM env** | Read component/factory/phase/sequence concepts. | T2 lessons never show an agent or a monitor in code. Most snippets wouldn't compile, and there are no compile/run instructions. I-SV-9 promises "a fully functioning, reusable UVM testbench" by the end of T2, but the only assembled env is the T3 capstone (self-attested, solution shipped). The runner cannot run UVM. |
| **3. Reusable agent + scoreboard** | A-UVM-6's analysis-FIFO pattern; the scoreboard-reference-model lab (self-attested). | No agent config object anywhere. The in-order scoreboard example has no end-of-test accounting, and the out-of-order example overwrites reused IDs. VIP assertions use `$error`, which UVM's count never sees. |
| **4. Multiple agents, complex stimulus** | Virtual sequencer vs virtual sequence vocabulary (I-UVM-3B, A-UVM-8). | I-UVM-3B contains invented APIs, a null `start_item`, and a deadlock. A-UVM-8's example hangs (`forever` inside `fork…join`). Protocol layering is never taught. The "Coordinated Attack" lab is read-the-solution. There is no M5 lab. |
| **5. Debug races, hangs, ordering, coverage holes** | Semaphore-deadlock lab (seed-dependent); AXI deadlock analysis; **F3C race debugger and challenge (new)**. | Hang Lab (`DebuggingSimulator`) ignores its scenario. E-DBG-1 lacks report catcher, `+uvm_set_*`, recording and seed reproduction. Coverage closure lab cannot reach 100% as written. Runner coverage is hard-coded 0, with no waveforms. |
| **6. Advanced methodology and corner cases** | E-SOC-1 strategy artifact; E-INT-1 assumption pitfalls; B-AXI-5 dependency cycles. | E-PERF-1 makes false scheduler claims. E-CUST-1's custom phase can't execute (no `exec_task`). Several vendor/standard facts are wrong: ZeBu/Veloce swapped, UVM-Connect origin, PSS standard number. |

Features that imply capabilities they do not provide (default flags):
- The homepage promises "Write, compile, and run SystemVerilog… instant feedback" (link 404s), "Earn points, badges, and climb the leaderboard" (flag off), and "AI Tutor… 24/7" (needs sign-in and a provider; the homepage anchor doesn't exist).
- The placement page promises "Baseline telemetry that feeds the personalized dashboard" (dashboard 404).
- The lab UI prints "Reported coverage: 0%" from a hard-coded value.
- `CurriculumDataTypeExplorer` is described as testing "against the simulator"; it is a static lookup.

---

## 5. Part B: concept and competency coverage (summary)

The full matrix is in [coverage-matrix.md](coverage-matrix.md): every module gets a depth rating, its strongest competency and its biggest gap, plus a concept-to-evidence matrix over the full SV/UVM/system list in the brief.

| Competency | Typical rating across 69 modules | Evidence |
|---|---|---|
| Explain | 1–2 (often solid prose) | Most modules |
| Predict | 0–1 | Fewer than 10 modules ask a genuine predict-the-output question. The best are F3A timescale and B-AXI-2 burst math. |
| Apply in code | 0–1 | Code is mostly fragments, often non-compiling, and was invisible in 35 lessons |
| Debug misuse | 0–1 | A handful of labs (semaphore, RAL mirror, AXI deadlock) and the new F3C challenge |
| Transfer | 0 | No unscaffolded tasks anywhere |

Concepts entirely missing from the curriculum (grep-verified by the reviewers):
- **SV:** operators and expression sizing; struct/union; `wait fork` and the fork-in-loop capture bug; `$rose/$fell/$stable/$past`; SVA repetition operators; vacuity; `disable iff` semantics.
- **UVM:** `uvm_analysis_imp_decl`; `check_config_usage`; config_db type-mismatch silent failure; `uvm_report_catcher`; `UVM_PREPEND`; RAL desired-vs-mirrored with `set/update`; `add_hdl_path`.
- **Protocols and systems:** AXI5 atomics; reset and error-injection strategy at SoC level.

---

## 6. Part C: quality of interactive learning (summary)

There are 94 registered lazy interactives before this session (99 after). The appendix F and G reviewers assessed 95 instruments in all (including practice-only components), split into SV-side and UVM-side; some components fall into more than one class.

| Class | SV-side (53 units) | UVM/methodology (42) |
|---|---|---|
| Real simulator | 0 | 0 |
| Conceptual / rule model | 19 | 8 |
| Static checker | 2 (both "fake" analysis) | 4 |
| Scripted animation / illustration | 24 | 20 |
| Quiz / drill | 6 | 2 |
| Placeholder ("coming soon") | — | 8 (4 inside live lessons) |

Systemic weaknesses:
- **No prediction-before-reveal** anywhere before this session.
- **Reduced motion** was respected nowhere in `src/`.
- **Feedback** is right/wrong only; there is no misconception diagnosis except in the broken playground.
- **Accessibility:** several core interactions are clickable `div`s.
- **Wrong rules:**
  - Factory override precedence: three different rules across the lesson and two widgets, none of them UVM's.
  - Phase order and runtime-phase concurrency.
  - Arbitration: `SEQ_ARB_WEIGHTED` treated as strict priority.
  - SVA: a bare sequence treated as vacuously passing.
  - Data structures: dynamic arrays given `push_back`/`capacity`; `soft` modelled as 90% probability; `Mailbox3D`'s `try_put` inserts into a full mailbox.
- **3D views** have no text alternative.
- **Unused registrations:** 18 UVM-side and 12 SV-side registered components are used in no lesson.

Honest labels: every interactive is a conceptual illustration or a hand-coded model; none is simulator execution. The lab "Run workspace" is real compilation via Icarus/Verilator, but only when an operator enables it, and it cannot run UVM.

---

## 7. Findings by category

Each finding lists: ID · evidence · learner consequence · severity / confidence · correction · acceptance and validation. Appendix IDs (T1-xxx, X-xx, T2U-xx, PLAT-xx, LAB-xx…) give full detail. Items marked **✅ fixed** were corrected in this session (§9).

### 7.1 Confirmed defects

| ID | Evidence | Learner consequence | Sev / Conf | Correction | Acceptance / validation |
|---|---|---|---|---|---|
| D-01 ✅ | `InteractiveCode.tsx` one-level child extraction stringifies MDX v2 `<pre><code>`; `code=` prop unsupported. Browser: Monaco models contained `[object Object]` (I-SV-1). | Code invisible in 35 lessons (OOP, rand, coverage, SVA, IPC, UVM) | S1 / High | Recursive `extractCodeText`, `code` prop, fabricated metrics behind `showHeuristicAnalysis` | `tests/components/InteractiveCodeExtraction.test.tsx`. Browser: I-SV-1 Monaco models contain the class source. |
| D-02 ✅ | No `remark-gfm` in `[...slug]/page.tsx` MDX options | ~90 T1 table rows (and all others) render as pipe text; 34 `[!NOTE]`-style callouts literal | S1 / High | `remark-gfm@3` + new `remarkCallouts` | F3B: 2 `<table>`, 7 body rows, no `\|---\|` text. `tests/lib/remark-callouts.test.ts`. |
| D-03 ✅ | `Quiz.tsx` treated numeric `correctAnswer`/`correctIndex` as absent → `options[0]` | 32 questions in 10 T3/T4 lessons grade the correct choice "Incorrect." | S1 / High | 0-based index support | `tests/quiz.spec.tsx` (2 new cases) |
| D-04 ✅ | `InterviewQuestionPlayground` expects `{id,label,explanation}`; MDX passes `{text,isCorrect,feedback}` | All 21 checkpoints blank; Submit never enables | S1 / High | `normalizePlaygroundOptions` adapter | `tests/components/InterviewQuestionPlayground.test.tsx` |
| D-05 ✅ | Scheduling cluster: F2C table and `EventRegionGame` grade `final`/assertions as Postponed. F3A NBA "delta" demo wrong. F4C drives "NBA or Re-NBA by origin"; F4C "race" example is deterministic; `##` without `default clocking`. Two SV-bank and two SVA-bank answers say assertions sample in Observed or drive in "Re-Active"; F4C flashcards 1 and 3. | Learners drilled into wrong answers before F3B, then contradicted; interview prep reinforces errors | S1 / High (IEEE 1800-2023 §4.4.2, §9.2.3, §14.10, §14.11, §14.13, §14.16, §16.5.1) | Content rewritten; game answer key rebuilt with 8 regions and per-question prompts | `tests/components/EventRegionGame.test.tsx`; `tests/qa/scheduling-semantics-lint.spec.ts` fails on 5 misconception patterns across content, banks and visual data |
| D-06 ✅ | JetBrains Mono ligatures on (`font-variant-ligatures: normal`) | `<=` (NBA) renders as `≤`; `===`/`!==` merged | S2 / High | Global CSS disables ligatures on code, pre and Monaco | DOM computed style. Visual check in F3C screenshots. |
| D-07 ✅ (partial) | Lesson grid had no explicit column template below `lg`; `main` lacked `min-w-0`; GFM tables had no scroll container | Lessons with long code lines or wide tables overflow phones (B-AXI-6: 872 px at 390) | S2 / High | `grid-cols-[minmax(0,1fr)]`, `min-w-0`, `break-words`; prose tables scroll in place | Playwright sweep of all 105 lessons at 390 px: overflowing lessons fell from 28 to 12. Each remaining case traces to one legacy component (ProceduralBlocksSimulator, the UVM phase explorer, FirstBugHuntGame, an interview card; list in `test-results/learning-audit/mobile-sweep.json`). Tracked as PLAT-5. |
| D-21 ✅ | Multi-line `<p>`/`<summary>`… JSX blocks in MDX compile to `<p><p>…</p></p>` (MDX 2 parses indented text as markdown) | React hydration errors #418/#423 on 7 lessons (F2C flow-control, F2D tasks-functions, I-SV-2B solver-debug, I-SV-3B closure-workflow, I-UVM-1B, 2A, 2B); the client re-renders the page | S2 / High (dev-mode warning "<p> cannot be a descendant of <p>") | `remarkJsxParagraphs` unwraps markdown paragraphs inside phrasing-only JSX elements | `tests/lib/remark-jsx-paragraphs.test.ts` (reproduces, then removes, the nesting). Sweep: 0 page errors across 105 lessons. |
| D-08 | Homepage "Live Code Editor → Try It Now" → `/practice/lab` (404); "AI Tutor" → `#ai-tutor` (no anchor) | First-click dead end; overclaims | S2 / High | Point to `/practice`, or remove the card. Make the AI card open the assistant or remove it. | Playwright: every homepage CTA returns 200 / reaches its anchor with default flags |
| D-09 | `PracticeHub.tsx:165-183` links 8 coming-soon labs to `notFound()` routes | Foundational labs (FIFO, simple DUT, arbiter, assertions) dead-end | S2 / High | Render coming-soon as non-links with a status badge; order by tier | Playwright: coming-soon cards are not anchors |
| D-10 | Curriculum generator orders topics alphabetically, ignoring authored order | AHB before AMBA intro; ACE/CHI before AXI-1; handshake 6th of 9 in I-UVM-3B; T2 SV "Next" links skip or go backwards | S2 / High | Honor frontmatter `order` / an explicit sequence file | Unit test on `curriculum-data` order; link audit |
| D-11 | 31 MDX flashcard IDs unregistered (after F3C fix) | "No flashcards available" on most T2 and many T1/T3 pages | S2 / High | Register existing JSON; alias split-module IDs; build-time check | Test: every frontmatter `flashcards` id resolves |
| D-12 | `completeLesson()` never called; no Prisma `LessonProgress` writer | Progress UI permanently 0%; dashboards can't be truthful | S2 / High | One progression contract (local + server) | Unit + E2E: completing a lesson updates both stores |
| D-13 | Lab completion: 61/63 steps self-attested; `basics-1` grader = token match unrelated to its README; self-attesting reveals solutions | Completion means nothing; solutions on demand | S1 / High | Simulator-signature grader + mutants (improvement plan P2) | CI runs references and mutants; steps store `{graderId, mutantsCaught, logDigest}` |
| D-14 | Runner: no UVM; only editable files sent; `coverage: 0`, `waveformKey: null` hard-coded; pass = exit code | Even when enabled, 10/21 labs can't compile; the UI shows "0% coverage" | S1 / High | UVM-capable image; full file set; `null` for unmeasured coverage | Capstone reference reaches `UVM_ERROR : 0` inside the runner in CI |
| D-15 | Reference solutions wrong: capstone monitor `default input #0` samples post-NBA; AHB checker can't catch its own bugs; bridge never asserts WLAST and prints PASS unconditionally; callbacks registered on a null handle; custom phase lacks `exec_task` | Learners copy broken "gold" code | S1 / Medium–High (hand-traced) | Per-lab fixes LAB-C1…S6 (appendix H §6.3) | Each reference meets its README signature in CI; each mutant fails |
| D-16 | UVM semantics: `super.build_phase` "stops child construction" (1A:23); connect/end_of_elab "top-down" (1C:21); analysis `write()` "blocks the monitor" (2B:86); cloned queues "share a pointer" (3A:45); invented APIs (3B); factory instance-override precedence wrong (1B:88) | Wrong mental model of UVM's core machinery | S1 / High (spot-checked) | Rewrite against IEEE 1800.2 / UVM reference | Content lint for each misconception; predict-the-output items |
| D-17 | RAL "implicit" vs "explicit" prediction inverted (4B:21, `RALPredictorVisualizer`); quizzes grade "poke needs manual predict" correct | Wrong RAL integration decisions | S1 / High | Correct terminology; peek/poke update the mirror | Quiz key test; lint |
| D-18 | AMBA: AHB bursts said to cross 4KB legally (B-AMBA-F1 and its lab, visual, flashcards, bank). AHB spec: "Masters must not attempt to start an incrementing burst that crosses a 1KB address boundary." B-AXI-1 calls W-before-AW illegal. Four wrong timing diagrams; wrong AxPROT key | Protocol checkers and bridges built on false premises | S1 / High (IHI0033B.b, IHI0022E) | Rewrite with spec citations; fix diagrams | Spec-derived assertion tests in visual models |
| D-19 | T2-SV semantics: `->>` "persists"; SVA local vars "static"; bare-sequence assertions fail every idle cycle; DPI tasks "block on I/O while SV runs"; `type_option.auto_bin_max`; invented `find()`, `svGetIntElement` | Non-compiling, misleading code | S1–S2 / High | Per-item fixes (appendix B register) | Compile-checked snippets under `tests/sv_examples/` |
| D-20 | `DebuggingSimulator` ignores `scenario="hang"` and shows generic null-pointer/leak cards | E-DBG Hang Lab teaches the wrong thing | S2 / High | Scenario-driven content | Component test per scenario |

### 7.2 Missing educational coverage

| ID | Gap | Consequence | Sev | Correction | Acceptance |
|---|---|---|---|---|---|
| M-01 | Operators, expression bit-length/sign rules, struct/union | Width and sign bugs in TB code | S2 | New F2A-2 lesson; wire `OperatorDrill` | Lesson + ≥2 predict items with simulated answers |
| M-02 | Process control: `fork/join_any`+`disable fork` isolation, `wait fork`, fork-in-loop capture, `process` | Driver timeouts and thread leaks | S2 | F2D/I-SV-5 section + debugger visual | Predict and debug items; model test |
| M-03 | SVA operator core: `$rose/$fell/$stable/$past`, repetition, `throughout/within/intersect`, vacuity, `disable iff`, `assume` | Can't write handshake checkers | S1 | I-SV-4A/4B rewrite + SVA trace lab | Golden pass/fail traces |
| M-04 | Coverage bin semantics (auto, wildcard, transition, default), sampling timing, `per_instance` | Wrong closure numbers | S2 | I-SV-3A/3B rewrite | Bin-count predict items |
| M-05 | UVM: reporting and pass/fail, `+UVM_TESTNAME`, timeouts, `analysis_imp_decl`, `check_config_usage`, responses, objections from sequences, layering | Can't run or debug a real bench | S1 | T2-UVM "first runnable env" path (plan P3) | Runner-graded env |
| M-06 | RAL desired/mirrored, `set/update/mirror`, `add_hdl_path`, built-in sequences, coverage | RAL misuse | S2 | A-UVM-4A/4B rewrite + Build-a-RAL lab | Mutant-graded lab |
| M-07 | Multi-agent coordination, reset mid-traffic, error injection, end-of-test accounting with outstanding items | No path to M5/M8 | S1 | Labs M5/M8 (plan P5) | Mutant-graded |
| M-08 | Seeds and regression triage, report catcher, recording, `+uvm_set_*` | Weak debug practice | S2 | E-DBG-1 rewrite | Triage exercise with logs |

### 7.3 Interaction and design weaknesses

- **W-01:** Recall-only assessment; `<details>` interview Q&As reveal answers with no attempt step (S2).
- **W-02:** No predict-first interactives before this session (S2).
- **W-03:** No reduced-motion support; clickable `div`s; 3D without text alternatives (S2).
- **W-04:** The practice hub is alphabetical with no prerequisites shown (S3).
- **W-05:** Quiz feedback is one explanation per question, with no score, retry or record (S2).
- **W-06:** Long lessons with competing animations (e.g. F2B mounts 6 interactives) and no recap (S3).
- **W-07:** "Teach it back" fails silently when signed out (S3).

### 7.4 Prototype or gated capabilities (default off)

- Dashboard: hard-coded 65%, badges, rank.
- `ProjectBasedEvaluator`: random scores.
- Certification, social and gamification panels: fixed mock data.
- Notebook and `createFlashcard` actions: placeholders with no callers.
- Community: Firestore, cross-provider identity unresolved.
- `/practice/lab/mock-lab`: fake test output, **publicly routable**.
- `/learning-strategies`, `/history`, `/resources`: placeholder pages, publicly routable.
- AI tutor and Feynman: real, but need a session and a provider.
- Simulation runner: real, but needs an operator to enable it, and has no UVM.

Label them honestly or hide them; don't market them on the homepage.

### 7.5 Unverified concerns

- **U-01:** Lab reference runtime behavior was traced by hand (no simulator locally). Confirm by running the CI references with UVM (plan P2).
- **U-02:** Default-argument semantics on virtual methods (I-SV-1 playground) need a primary-source check.
- **U-03:** I-SV-5 `wait(mbx.num() < 4)` may never re-evaluate (hang).
- **U-04:** AXI IHI0022H and CHI claims (spec not obtained).
- **U-05:** Whether Verilator `--binary` builds within the runner's 15 s budget.
- **U-06:** Mobile overflow on non-lesson routes was not swept.

---

## 8. Part D: practical TB-building readiness (summary)

See [tb-mastery-progression.md](tb-mastery-progression.md). Instruction exists for all eight milestones, but practice stops at "fill a TODO in a provided file and click complete".

| Milestone | Status |
|---|---|
| M1 race-aware interface TB | No reachable lab. Now taught interactively in F3C. |
| M2 reusable agent | Partial (weak) |
| M3 reference-model scoreboard | Partial |
| M4 coverage-driven env | Partial (weak) |
| M5 multi-agent / virtual sequences | Absent |
| M6 out-of-order protocol | Partial |
| M7 RAL-integrated env | Partial (weak) |
| M8 subsystem capstone | Absent in code; partial as a planning document |

No milestone has simulator-verified completion or an unscaffolded build-from-spec task.

---

## 9. What this session changed (implementation slice)

The user's follow-up request asked for a visual-first learning system. The slice was chosen at the intersection of the P0 task (T1-FOUNDATIONAL-UPGRADE), prerequisite importance (the gate from SV into UVM drivers and monitors) and audit severity (the S1 scheduling cluster). The design system and the per-concept plan are in [`docs/visual-learning/`](../../visual-learning/).

**New: deterministic scheduler model with tests.**
- `src/lib/sv-scheduler-model.ts` implements the §4.5 reference-algorithm loops over one time slot.
- It explores every ordering §4.7 permits, attributes race hazards statically, and models Preponed sampling, NBA/Re-NBA, `#0`, `$display`/`$strobe`, and `@(cb)` in Observed (§14.10).
- `src/lib/sv-scheduler-scenarios.ts` builds scenarios as data, so code text is generated from the executed model.
- 23 unit tests.

**New: reusable visual system** in `src/components/visual-system/`:
- visual-language tokens with non-color cues;
- `usePlayback` with reduced-motion awareness;
- `PlaybackControls` (keyboard, scrubber, speed);
- `CodeTrace` (synchronized highlighting, ligatures off);
- `ValueChip` (four-state);
- `StepWaveform` (labeled step axis);
- `PredictionPrompt` (diagnostic feedback);
- `FidelityBadge` (assumptions);
- `VisualRecap`.

**New lesson visuals** in `src/components/visuals/`:
- `TimeSlotRegionMap`: the mental picture.
- `TimeSlotTraceVisualizer`: synchronized code, ladder, values, waveform and narration.
- `RaceConditionDebugger`: edit operators and `#0`, predict, explore all orders, compare two executions.
- `TestbenchDriveComparison`: `=` vs `<=` vs clocking block.
- `RaceDebugChallenge`: symptom → culprit → model-graded fix, with fading hints.
- 8 component tests.

**Rebuilt lesson:** F3C, with a picture → animation → experiment → comparison → recap → debug → independent kata sequence; clause references verified against the PDF; F3C flashcards registered and extended.

**Platform fixes:** D-01, D-02 (plus callouts), D-03, D-04, D-06, D-07 (partial), D-21 above.

**Semantic fixes:**
- D-05 across F2C, F3A, F3B, F4C, `EventRegionGame`, F4C flashcards, and four interview-bank entries.
- `SVSchedulerRegionVisualizer` text no longer says an `always_ff` samples in Preponed.
- A content lint prevents regressions.

**Dependency:** `remark-gfm@3.0.1` (the MDX 2-compatible line). Lockfile additions are its nested mdast/micromark dependencies.

Not done (in the plan): D-08…D-20, M-01…M-08, the remaining five foundational visuals, the foundational interview bank, labs.

---

## 10. Can the current site produce independent complex-TB competence?

**Not yet.**

A diligent learner today finishes with broad vocabulary and some correct mental pictures. They also finish with several wrong ones (scheduling, phasing, RAL prediction, AHB boundaries), little ability to predict behavior, and no evidence of being able to build, run, debug or extend a testbench. The site never checks any of those outcomes.

The gaps that prevent the outcome:
1. Semantic errors in core lessons, now partly fixed for scheduling.
2. No compile-and-run practice with automated, mutation-based checking.
3. No unscaffolded tasks.
4. Missing M1, M5 and M8 labs and a broken capstone reference.
5. Broken rendering and assessment plumbing, now partly fixed.
6. Navigation order that contradicts prerequisites.

**Best implementation order** (bounded tasks in [improvement-plan.md](improvement-plan.md)):
1. **P0 Trust:** finish the semantic-correction sweep with content lints (UVM phasing/build/TLM/factory, RAL, AHB/AXI, T2-SV list), plus the remaining platform plumbing (flashcard registry check, navigation order, homepage/hub dead links, honest labels).
2. **P0 Run what you teach:** a UVM-capable runner, a full file-set contract, CI that executes every lab reference and its mutants, and fixes for the broken references.
3. **P1 Graded milestone ladder:** an M1 race-free TB lab (reusing the F3C model as its pre-lab), then a first runnable UVM env at the end of T2, M2 agent, M3 scoreboard with mutants, M5 virtual sequences, M7 Build-a-RAL, and an M8 unscaffolded subsystem capstone.
4. **P1 Visual curriculum rollout** on the new visual system, ordered by prerequisite: X/4-state and nets, then handles and copy, fork/join, constraints, coverage, SVA traces, the sequencer–driver handshake, phasing and objections, the factory/config resolver, scoreboard matching, and RAL mirror.
5. **P2 Progress truth and assessment:** one progression contract, predict/debug items with simulated answer keys, and surfacing the interview banks.
