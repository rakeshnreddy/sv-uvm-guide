# Prioritized improvement plan (2026-10-03)

**Status.** These are proposed tasks. `TASKS.md` remains the backlog authority. Its active rows are unchanged, apart from a progress note on T1-FOUNDATIONAL-UPGRADE and a "Proposed (not yet prioritized)" pointer to this plan.

**How tasks are written.** Each task is bounded: one reviewable PR, a named file scope, acceptance criteria, and a meaningful validation step. "Meaningful" means the check would fail on the defect it targets, not just render a component.

**Ordering principle.**
1. **Trust:** nothing on the site teaches a wrong model.
2. **Run what you teach.**
3. **Graded milestones.**
4. **Visual rollout:** prerequisite-first.
5. **Progress and assessment truth.**

Estimated sizes: S < 1 day, M 1–3 days, L 3–7 days.

---

## Phase P0-A: Trust (semantic correctness and plumbing)

| ID | Task | Scope | Acceptance | Validation | Size |
|---|---|---|---|---|---|
| TRUST-1 | UVM core-semantics correction sweep | I-UVM-1A (`super.build_phase`), 1B (instance-override precedence; "unregistered override → fatal"), 1C (connect/end_of_elab bottom-up; drain time; timeouts), 2B (`write()` is a zero-time function; port→export rule), 3A (clone/queue copy), 3B (remove invented APIs: `uvm_semaphore`, `mid_do` veto, `set_sequence_id_info`, `+UVM_SEQ_ITEM_TRACE`; fix null `start_item(req)`, deadlock, `local::`), I-UVM-4 quiz key | Every item in appendix C §5 at S1/S2 is resolved, or annotated as intentionally simplified with a citation | Extend `tests/qa/scheduling-semantics-lint.spec.ts` (or add `uvm-semantics-lint.spec.ts`) with forbidden phrases for each myth; snippets compile under Verilator lint + `uvm-core` in CI (`scripts/compile-sv-solutions.mjs` extended to MDX snippets tagged `// compile`) | L |
| TRUST-2 | UVM visuals that encode wrong rules | `FactoryOverrideVisualizer`, `FactoryOverrideExplorerVisualizer` (one shared resolver: instance overrides before type, first registered matching instance override wins), `UvmPhaseTimelineVisualizer`, `UvmPhaseSorterExercise`, `PhaseTimeline3D` (runtime phases concurrent with `run_phase`), `SequencerArbitrationSandbox` (`SEQ_ARB_WEIGHTED`, lock release), `TLMPortConnector`/`TlmConnectionBuilderVisualizer`, `UVMTreeExplorer` quiz | One tested model module per rule (`src/lib/uvm-factory-model.ts`, `uvm-phase-model.ts`, `uvm-arbitration-model.ts`), consumed by every visual for that rule | Vitest semantic tests per model (e.g. two instance overrides on the same path → first registered wins); remove the test that locks in "custom phases" | L |
| TRUST-3 | RAL terminology and semantics | A-UVM-4A/4B and sub-pages, `RALPredictorVisualizer`, `RalRegisterMapVisualizer` (field access policies), quizzes (`poke` updates the mirror) | Implicit = auto-predict; explicit = predictor on a bus monitor; peek/poke predict; invented APIs removed | Quiz-key tests; lint phrases ("predictor … implicit prediction") | M |
| TRUST-4 | AMBA correctness sweep | B-AMBA-F1 (+ lab, `BridgeTranslationExplorer`, flashcards, bank: AHB INCR bursts never cross 1KB), B-AXI-1 (W may precede AW; BVALID after both AW and last W), the 4 wrong waveforms, B-AXI-2 boundary assertion and unaligned lanes, AxPROT quiz and bins, B-AHB-2/3 ERROR assertions | Each claim cites IHI0033B.b / IHI0022E section; WaveDrom diagrams regenerated from a tested handshake model | `src/lib/axi-dependency-model.ts`-style tests for handshake legality and boundary math across WRAP/FIXED/INCR and unaligned starts | L |
| TRUST-5 | T2-SV correction sweep | Appendix B register S1/S2: `->>`, SVA local `static`, bare-sequence asserts, `##0`, DPI task timing, `svGetIntElement`, `type_option.auto_bin_max`, `find()`, genvar claim, checker restrictions, implication/unsigned myths, `storage s;` | All register items at S1/S2 closed | Snippets tagged `// compile` pass CI lint; lint phrases | L |
| TRUST-6 | T1 residuals | F2A driver rule + quiz Q2/Q3; F2B `new[]`/bounded queue; F2C named-`disable` advice and unlabeled TB race (flow-control:103); F2D illegal initializer, `$fatal`; F4A collision rule; F4B deadlocked handshake + vif binding; F4C driver/monitor via `vif.cb` example; F1B `$onehot` | Appendix A §7 register cleared | Lint + compile tags | M |
| PLAT-1 | Flashcard registry integrity | `src/lib/flashcard-decks.ts`, frontmatter IDs | Every frontmatter `flashcards` ID resolves (register existing JSON; alias split-module IDs; author missing decks) | New vitest: iterate MDX frontmatter, assert `flashcardDecks[id]` exists and is non-empty (currently 31 failures) | M |
| PLAT-2 | Authored navigation order | `scripts/generate-curriculum-data.ts`, frontmatter `order` | Generator honors authored order; in-content Next links match | Unit test on generated order for AMBA, I-UVM-3B, T4; strict link audit enabled in CI after fixing its route-group matcher | M |
| PLAT-3 | Dead ends and honest labels | Homepage CTAs (`/practice/lab` → `/practice`; AI card), `PracticeHub` coming-soon cards (non-links, tier order, prerequisites), `/practice/lab/mock-lab` (remove or gate), placeholder routes, lab UI "Reported coverage: 0%" → "not measured", placement copy | No default-flag dead link; every capability claim on the homepage is true by default or labeled "requires sign-in / coming soon" | Playwright with **default flags** (new project without `FEATURE_FLAGS_FORCE_ON`): crawl homepage and hub links → 200 | S |
| PLAT-4 | Test isolation for the auth secret test | `tests/security-config.test.ts` | Ordinary `npm test` passes without `NODE_OPTIONS` preload (mock the Prisma import, or stub env after the Prisma load) | `npm test` green on a machine with a populated `.env` | S |
| PLAT-5 | Mobile and table regression guard, plus the last 12 overflowing lessons | Playwright; fixed-width legacy components: ProceduralBlocksSimulator (F2C), the UVM phase explorer in `UVMTreeExplorer` (I-UVM-1A), FirstBugHuntGame (F1B), interview `<details>` cards (F3A) and the others listed in `test-results/learning-audit/mobile-sweep.json` | No horizontal overflow at 390 px on any lesson; F3B has `<table>`; no literal `[!NOTE]`; no page errors | New `tests/e2e/lesson-layout.spec.ts` over all 105 lesson URLs with default flags (port the session's sweep script: overflow, callouts, pipe tables, `[object Object]`, page errors) | S–M |

## Phase P0-B: Run what you teach

| ID | Task | Scope | Acceptance | Validation | Size |
|---|---|---|---|---|---|
| RUN-1 | Lab run/expect/mutant contract | `lab-manifest.ts` schema, `generate-lab-registry.mjs` | Manifests declare `run.files` (incl. read-only), `run.top`, `defines`, `expect.mustMatch/mustNotMatch`, `mutants[]`; generator rejects missing files / duplicate tops / available→coming-soon prerequisites / invalid module slugs | Registry tests with fixtures for each rejection | M |
| RUN-2 | Execute references and mutants in CI | new `scripts/run-lab-references.mjs`, `quality-gates.yml` | Every available lab's reference matches `expect`; every mutant fails with its signature; every starter compiles | CI job using `verilator/verilator:v5.050` + `uvm-core` 2020.3.1 (already fetched) | L |
| RUN-3 | Fix broken references | LAB-C1/C2 (capstone monitor `#1step`, scoreboard idle), P1, P3/P4, P5, U1–U6, S1–S6, G1 (appendix H §6.3) | Each lab meets RUN-2 | RUN-2 job | L |
| RUN-4 | UVM-capable runner | `simulation-runner/Dockerfile`, `run-simulator.py`, `CodeExecutionEnvironment.tsx` | Pinned Verilator proven in CI; precompiled UVM; full file set; coverage `null` unless measured; timeouts sized from CI timings | Capstone reference reaches `UVM_ERROR : 0` inside the runner image in CI | L |
| RUN-5 | Simulator-graded steps | `lab-graders.ts` (`sim-signature-v1`), `/api/labs/run` | A step passes only if the clean run matches and all hidden mutants are flagged; evidence `{graderId, seed, logDigest, mutantsCaught}` stored; solution reveal gated on graded completion or marked "assisted" | Server tests; E2E on one lab with a disposable DB | M |

## Phase P1: Graded milestone ladder

All tasks below depend on RUN-1/2/4/5. See [tb-mastery-progression.md](tb-mastery-progression.md) for acceptance detail.

| ID | Task | Pre-lab visual | Size |
|---|---|---|---|
| LAB-M0 | Enable `simple-dut-1` with real steps; replace the `basics-1` grader | — | S |
| LAB-M1 | "Race-Free Pipeline TB" (non-UVM) | F3C RaceDebugChallenge as a gate (✅ exists) | M |
| LAB-T2-ENV | "First runnable UVM env" at the end of T2 (I-SV-9's promise): top + interface + config_db vif + test/env/agent/sequence + analysis-FIFO scoreboard + objection | Sequencer–driver handshake visual (VIS-UVM-1) | L |
| LAB-M2 | Reusable stream agent with config object, active + passive reuse | Agent topology visual | M |
| LAB-M3 | Scoreboard EOT accounting with mutants | Scoreboard matching visual (VIS-UVM-4) | M |
| LAB-M5 | Config-then-data virtual sequence | Virtual-sequence coordination visual | M |
| LAB-M6 | AXI read scoreboard: multi-beat, interleaving, random READY, error responses | AXI ID ordering visual (fixed) | M |
| LAB-M7 | Build-a-RAL | RAL mirror visual (VIS-UVM-6) | M |
| LAB-M8 | Subsystem DMA capstone (unscaffolded) | — | L |

## Phase P1: Visual curriculum rollout

The design system and per-concept plan are in [docs/visual-learning/](../../visual-learning/). Every item reuses `src/components/visual-system/` and follows the F3C pattern:
1. a tested model in `src/lib/*-model.ts`;
2. a picture, an animation and an experiment;
3. a prediction gate;
4. a recap;
5. a debugging challenge;
6. a kata.

| ID | Concept (prerequisite order) | Replaces / upgrades | Size |
|---|---|---|---|
| VIS-SV-1 | Four-state values, net resolution, multiple drivers (`NetResolutionSimulator` from the spec, model-driven: wire/wand/wor/tri/trireg, strengths) | LogicStateDiagram (keep), F2A tables | M |
| VIS-SV-2 | Width, sign, extension and truncation; expression sizing (operators lesson) | SignednessVisualizer, OperatorDrill (wire in) | M |
| VIS-SV-3 | Handles, allocation, aliasing, shallow vs deep copy | new; I-SV-1 | M |
| VIS-SV-4 | fork/join variants, `disable fork` isolation, `wait fork`, fork-in-loop capture | ProceduralBlocksSimulator (rebuild on the scheduler model) | M |
| VIS-SV-5 | Clocking-block skew timeline (spec's `ClockingBlockSkewVisualizer`, extending the scheduler model with nonzero skews) | F4C | M |
| VIS-SV-6 | Constraint solution space, `dist` `:=` vs `:/`, solve-before, failure diagnosis (exact enumeration for small domains) | ConstraintSolver* (several; consolidate) | L |
| VIS-SV-7 | Coverage bins/crosses/holes with a sampling timeline | CoverageCrossExplorer, CovergroupBuilder | M |
| VIS-SV-8 | SVA trace evaluator: sampled values, attempts, vacuity, `disable iff` | SvaSequenceWaveformVisualizer, TemporalLogicExplorer | L |
| VIS-UVM-1 | Sequence → sequencer → driver handshake with response path | the 4 placeholders + AnimatedUvmSequenceDriverHandshakeDiagram | M |
| VIS-UVM-2 | Phases and objections with end-of-test, drain and timeout | phase visuals (consolidate onto TRUST-2 model) | M |
| VIS-UVM-3 | Factory + config_db resolver (scope, precedence, type mismatch) | ConfigDbExplorer, factory visuals | M |
| VIS-UVM-4 | Monitor → predictor → scoreboard; in-order vs out-of-order matching, EOT | new (A-UVM-6 has none) | M |
| VIS-UVM-5 | Virtual sequences and multi-agent coordination, reset mid-traffic | new (A-UVM-8 has none) | M |
| VIS-UVM-6 | RAL desired/mirrored/actual, frontdoor/backdoor, prediction paths | RALPredictorVisualizer, RalRegisterMapVisualizer | M |
| VIS-SYS-1 | AXI handshake/backpressure/ID ordering from one tested channel model | Axi* visualizers, ProtocolWaveform diagrams | L |

Also remove or relabel the 8 placeholders and the unused registrations (30 names) once replacements exist. Keep 3D only where spatial structure teaches something (packed/unpacked arrays), with text alternatives.

## Phase P2: Progress and assessment truth

| ID | Task | Acceptance | Size |
|---|---|---|---|
| PROG-1 | Single progression contract: `completeLesson` on a meaningful event (recap or kata self-check), local + Prisma `LessonProgress` writer, dashboard reads it | Completing F3C updates local and server progress; dashboard shows the real value with the tracking flag on | M |
| ASSESS-1 | Predict/debug items per technical module with simulated answer keys stored under `tests/sv_examples/` | ≥2 predict items in each of F2A–F4C, I-SV-*, I-UVM-*; key = simulator log | L |
| ASSESS-2 | Surface the interview banks (filterable by module); fix spec schema conflict with an adapter rather than weakening `bank-schema.test.ts` | Banks visible; `foundational_systemverilog.json` follows the existing schema | M |
| ASSESS-3 | Quiz upgrade: per-option diagnostic feedback, reveal correct, retry, record attempt | Quiz renders option-specific feedback for authored `feedback` fields | S |

## Phase P3: Documentation

- Replace the Firebase-era sections of `PROJECT_GUIDE.md` §7.
- Add the visual-language rules to `PROJECT_GUIDE.md` §6 (link `docs/visual-learning/visual-language.md`).
- Fix the foundational spec's clause numbers and region model (appendix A §6) before executing its remaining items.

---

## Recommended execution order

1. PLAT-3, PLAT-4, PLAT-5. Small; they stop learners hitting dead ends and prevent regressions.
2. TRUST-1 → TRUST-6 in parallel by area, each with its lint and compile tags.
3. PLAT-1, PLAT-2.
4. RUN-1 → RUN-2 → RUN-3 → RUN-4 → RUN-5.
5. LAB-M1 (reuses F3C), then LAB-T2-ENV, M2, M3, M5, M6, M7, M8.
6. VIS-* in the listed order, interleaved with the labs they gate.
7. PROG-1, ASSESS-1..3, P3 docs.
