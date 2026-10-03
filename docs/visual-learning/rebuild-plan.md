# Visual component rebuild plan (2026-10-03)

**Scope.** Every visual, animation and interactive used by lessons, sub-lessons, practice routes and exercises: 94 registered lazy interactives, the 4 exercises, 13 practice visualization routes, and the homepage feature cards.

**Sources.** Each verdict comes from the audit appendices: [F](../audit/2026-10-03-learning-outcomes/appendices/F-interactives-systemverilog.md) for SystemVerilog, [G](../audit/2026-10-03-learning-outcomes/appendices/G-interactives-uvm-methodology.md) for UVM and methodology, and [E](../audit/2026-10-03-learning-outcomes/appendices/E-t3-amba.md) §3 for AMBA. The section numbers below (§2.x, §4.x) point into those appendices.

**Standards.** Every rebuild follows [visual-language.md](visual-language.md):
- a tested model in `src/lib/*-model.ts`;
- a fidelity label with assumptions;
- prediction before reveal;
- non-color cues;
- keyboard operation;
- reduced motion;
- no overflow at 390 px.

## Status (2026-10-03, end of wave 3)

Waves 0–3 are implemented and committed on `visual-curriculum-rebuild`. Wave 4 (leftovers, full sweep, trackers) is in progress.

| Measure | Result |
|---|---|
| Pure models in `src/lib/*-model.ts` | 44, each with a semantic test file (about 1,070 model tests citing IEEE 1800-2023, IEEE 1800.2-2020 / uvm-core 2020.3.1, Arm IHI0022E or IHI0033B.b) |
| Lesson components backed by a model | 71 of the 86 registered components embedded in lessons (the rest are illustrations, code explainers, quizzes or navigation) |
| Components with a prediction gate | 65 |
| Components with a hinted debug challenge (`HintLadder`) | 17, plus debug presets in the AXI, AHB, power and formal visuals |
| Removed from the registry and deleted | 22 orphan or decorative components (6 decorative 3D views, 5 UVM placeholders, superseded simulators), plus their dead data files |

**Workstreams.**
- **A (SV foundations):** done. F1A/F1B/F1C, F2A–F2D, F3C, F4B/F4C visuals rebuilt on models: four-state, expressions, enum/string, arrays, processes, clocking and interfaces.
- **B (T2 SV):** done. OOP handles and dispatch, constraints (exact enumeration), coverage, SVA trace evaluator, elaboration/bind, DPI.
- **C (UVM core):** done. Factory, config_db, phasing, sequencer/driver handshake, arbitration, TLM/analysis, agents, policies, containers, recording, reporting and hang debug.
- **D (advanced UVM):** done.
  - RAL: map and predictor.
  - Callbacks, scoreboards, multi-agent coordination and VIP reuse.
- **E (AMBA):** done. AXI burst math, channel handshakes, ID ordering, exclusive access and bridge translation; AHB pipeline. B-AXI-1 waveforms are generated from the channel model.
- **F (expert):** done. Formal vs simulation, power sequencing, PSS and the FSM designer.

**Wave 4 (in progress):**
- F3B scheduler region visual, EventRegionGame, InterfaceSignalFlow, DataTypeComparisonChart, HallOfShameCarousel;
- AMBA family/analogy explorers and the deadlock wrapper;
- AMBA and expert content and lab corrections;
- the full Playwright sweep.

**Known limits** (not fixed in this pass):
- No simulator runs in CI, so lab SystemVerilog is still reviewed by reading it, not compiled (see the improvement plan, LAB-M1).
- Models are teaching models: each states its assumptions in its `VisualFrame`. They are not cycle-accurate simulators.

## Decision rules

1. **Fix in place** when the component's interaction idea is sound but its rules are wrong. The file path and export stay the same, so lessons keep working.
2. **Rebuild on a model** when behavior is scripted, random, or encodes a wrong rule. The new component replaces the old one in its lessons.
3. **Remove from lessons** (keep the file only if a practice route needs it, and label it) when the visual adds nothing or cannot be made accurate cheaply: decorative 3D, placeholders, duplicates.
4. **Never ship a placeholder in a lesson.** A "coming soon" box is worse than no box.

## Shared foundations (built first, by the lead)

| Primitive | Purpose | Used by |
|---|---|---|
| `VisualFrame` | Section shell: eyebrow, title, summary, fidelity badge, assumptions | all new visuals |
| `SegmentedControl` | Accessible radio-style scenario picker (arrow keys, roving tabindex) | all |
| `CycleWaveform` | Cycle-based waveform. Values change just after the edge; sample markers sit at edges; per-cycle markers and editable bits use keyboard buttons. | SVA, clocking skew, AXI/AHB, coverage sampling, handshakes |
| `BlockDiagram` | SVG component diagram: UVM port/export/imp/analysis symbols, edge styles, transaction tokens on edges, selectable nodes | all UVM and architecture visuals |
| `HintLadder` | Progressive hints with a count | debug challenges |

## Workstreams and decisions

Status codes: **Fix** (in place) · **Rebuild** (model-driven) · **New** · **Remove** (from lessons) · **Keep**.

### A. SystemVerilog foundations (T1)

| Component | Lessons | Decision | Model / notes |
|---|---|---|---|
| LogicStateDiagram | F2A | Rebuild → prediction-first four-state explorer | `sv-four-state-model.ts`: 4-state operator tables, `==` vs `===`, `if (x)` takes else, X→0 on 2-state assignment |
| NetResolutionSimulator | F2A | **New** (foundational spec) | Same model: wire/tri/wand/wor/tri0/tri1/trireg, strengths (supply/strong/pull/weak/highz), variable-vs-net driver legality |
| OperatorVisualizer, OperatorDrill | orphan | Rebuild as `OperatorExplorer` (4-state, reduction, shift `>>>`, `inside` wildcard, streaming) and wire into F2A | `sv-expression-model.ts` |
| SignednessVisualizer | F2A | Rebuild: expression width/sign context rules, mixed signed/unsigned, `$signed`, truncation | `sv-expression-model.ts` |
| CurriculumDataTypeExplorer, CurriculumDataTypeQuiz | F2A | Fix (int width, wrong claims, focus loss; quiz Q2/Q3, per-option feedback) | — |
| EnumMethodVisualizer, StringMethodExplorer | F2A | Fix (invalid enum value, `next(N)`, `num`; `getc`/`putc` out of range) | — |
| DynamicStructureVisualizer | F2B | Fix (no `push_back` on dynamic arrays, `new[N]` vs `new[N](arr)`, no capacity, assoc key order, `exists`) | extend `systemverilog-array-model.ts` |
| QueueOperationLab | F2B | Fix (`q[$]` vs `q[$:N]` declaration, discard-with-warning, invalid index) | same |
| PackedUnpackedPlayground | F2B | Remove from lesson (duplicate, wrong rule) | — |
| SystemVerilog3DVisualizer | F2B, practice | Fix (init values, responsive panel, 2D fallback / text alternative) | same |
| ArrayMethodExplorer | F2B | Rebuild (return types: `min/max` return queues; `sum` width overflow; editable `with`) | same |
| PacketSorterGame | F2B | Fix (queue answer, feedback, honest score) | — |
| ProceduralBlocksSimulator | F2C, practice | Rebuild on a process model (initial/always/final, `fork` variants) | `sv-process-model.ts` |
| ForkJoinVisualizer | F2C, F2D, I-SV-5 | **New** | `sv-process-model.ts`: threads, `#` delays, join/join_any/join_none, `disable fork`, `wait fork`, fork-in-loop capture |
| MailboxSemaphoreGame | F2D, I-SV-5 | Rebuild on the process model (blocking with FIFO wake-up, `try_*`, `peek`, `get(n)`) | same |
| Mailbox3D | F2D | Remove from lesson | — |
| ConcurrencyVisualizer | practice | Remove (fake priorities); the route shows ForkJoinVisualizer | — |
| BlockingSimulator, DataTypeExplorer (animations), SystemVerilogDataTypesAnimation dynamic-array tab | orphan / practice | Remove BlockingSimulator registration (superseded by F3C); fix the dynamic-array tab | — |
| EventSchedulerVisualizer | E-PERF-1 | Remove; lesson uses TimeSlotTraceVisualizer | — |
| FirstBugHuntGame | F1B | Rebuild: a real bug whose code and waveform agree, pick the cycle and the line, then write the assertion | small model in the component |
| InteractiveCostOfBugGraph | F1A | Fix (formatting bug, keyboard slider, cited ranges) | — |
| DesignGapChart, VerificationMethodologiesDiagram, VerilogVsSystemVerilog | F1A–F1C | Fix (a11y title/source; emulation stage, pause control; keyword-compat text) | — |
| ModportExplorer | F4B | Rebuild: modport code, direction arrows, illegal-drive compile error, clocking-block modport | — |
| ClockingBlockSkewVisualizer | F4C | **New** (foundational spec) | `sv-clocking-model.ts`: input skew (#1step / #N), output skew, sample and drive times across cycles |
| InterfaceSignalFlow | practice | Fix (`inout` on a variable) | — |
| BindDirectiveVisualizer, GenerateElaborationVisualizer | I-SV-4C, I-SV-6 | Fix (labels; hierarchical names `gen_chk[i].chk_inst`, `genblkN`) | — |
| DPIBoundaryInspector | I-SV-7 | Rebuild as type-mapping explorer + pure/context legality quiz | — |

### B. SystemVerilog verification (T2)

| Component | Lessons | Decision | Model |
|---|---|---|---|
| ConstraintSolverHeatmapVisualizer | I-SV-2A | Rebuild as flagship `ConstraintLab`-style explorer (keep name) | `constraint-solver-model.ts`: exact enumeration, `dist :=`/`:/`, soft priority, solve-before, inline `with`, unsatisfiable core |
| ConstraintSolverVisualizer | I-SV-2A | Fix (simultaneous solving wording) and run it on the model | same |
| ConstraintSolverExplorer | I-SV-2B | Rebuild on the model (soft = priority, not probability) | same |
| Constraint3D | I-SV-2A | Remove from lesson | — |
| RandomizationExplorer | practice | Replace with the heatmap explorer | — |
| CoverageCrossExplorerVisualizer | I-SV-3A | Rebuild flagship (valid `binsof(cp.bin)`, illegal vs ignore, biased stimulus, predict-N) | `coverage-model.ts` |
| CovergroupBuilder | orphan | Fix and merge into I-SV-3A (bins editor: explicit/auto/wildcard/transition/default/ignore/illegal) | same |
| CoverageAnalyzer, Coverage3D | practice / orphan | Remove; practice route shows the flagship | — |
| SvaSequenceWaveformVisualizer | I-SV-4A | Rebuild flagship (sequence-as-property fails, Preponed sampling markers, parse errors, predict per attempt) | `sva-model.ts` |
| TemporalLogicExplorer | I-SV-4B | Rebuild on `sva-model.ts` (valid operators, prediction moment) | same |
| AssertionBuilder | practice | Replace with the SVA flagship | — |
| ObjectHandleVisualizer | I-SV-1 | **New**: handles, `new`, aliasing, shallow vs deep copy, null | `sv-object-model.ts` |
| PolymorphismDispatchVisualizer | I-SV-1 | **New**: static vs virtual dispatch, `$cast` success/failure | same |

### C. UVM (T2)

| Component | Lessons | Decision | Model |
|---|---|---|---|
| FactoryOverrideExplorerVisualizer | I-UVM-1B | Rebuild flagship on one engine (instance overrides first, first registered match wins, type override replace, chaining, `$cast` failure, override-after-create) | `uvm-factory-model.ts` |
| FactoryOverrideVisualizer | I-UVM-1B | Rebuild as prediction-first scenarios on the same engine | same |
| ConfigDbExplorer | I-UVM-2C | Rebuild: multiple sets, build-time hierarchy precedence vs last-write after build, exact type match, wildcards, field names | `uvm-config-db-model.ts` |
| UvmPhaseTimelineVisualizer | I-UVM-1C | Rebuild: run_phase lane parallel to 12 runtime phases, DFS top-down/bottom-up order, objections | `uvm-phase-model.ts` |
| UVMTreeExplorer | I-UVM-1A | Fix (DFS order, all common phases, correct MCQ, className bug, dark mode) | same |
| UvmPhasingDiagram (placeholder) | I-UVM-1C, practice | **Implement**: objections and end-of-test (raise/drop, drain, timeout, phase_ready_to_end) | same |
| PhaseTimeline3D | I-UVM-1C | Remove from lesson | — |
| UvmPhaseSorterExercise | /exercises | Fix: two lanes (run_phase ∥ runtime schedule) | same |
| MethodologyPhaseVisualizer | E-CUST-1 | Fix: schedule vs common domain, `exec_task`, pre/post phases | same |
| AnimatedUvmSequenceDriverHandshakeDiagram (placeholder) | I-UVM-2B, I-UVM-3A, I-UVM-3B | **Implement** flagship handshake: start_item/finish_item ↔ get_next_item/item_done, responses, missing item_done hang | `uvm-sequencer-model.ts` |
| SequencerArbitrationSandbox | /exercises, I-UVM-3B | Rebuild: FIFO/WEIGHTED(random, seeded)/RANDOM/STRICT_FIFO/STRICT_RANDOM, lock queued + held until unlock, grab | same |
| UvmSequenceHierarchyVisualizer | I-UVM-3A | Fix: pre/post_start/body hooks, handshake detail, prediction | same |
| VirtualSequencerExplorer, UvmVirtualSequencerDiagram (placeholder) | I-UVM-3B | Rebuild/implement: virtual sequence on sub-sequencers, `p_sequencer`, fork vs ordered coordination | same |
| TlmConnectionBuilderVisualizer | I-UVM-2B | Fix flagship: directional `port.connect(export)`, hierarchical promotion, interface compatibility, generated `connect_phase` | `uvm-tlm-model.ts` |
| TLMPortConnector | I-UVM-2B | Rebuild: pull model with item flowing sequencer → driver | same |
| Analysis3D, Dataflow3D | I-UVM-2B | Remove from lesson → `AnalysisBroadcastVisualizer` (**New**): zero-time ordered `write()` calls, FIFO decoupling | same |
| AnimatedUvmTestbenchDiagram (placeholder) | I-UVM-2A | **Implement**: agent topology active/passive, connections | `BlockDiagram` |
| UvmTestbenchVisualizer, UvmComponentRelationshipVisualizer, UvmFactoryWorkflowVisualizer, UvmPhasingInteractiveTimeline (placeholders), UvmHierarchySunburstChart | unused / practice | Remove from registry; practice routes point to real visuals | — |
| UvmAgentBuilderExercise | /exercises | Fix: grade membership + active/passive, not order | — |
| UvmPolicyVisualizer, UvmContainerVisualizer, TransactionRecordingVisualizer | I-UVM-4/5/6 | Fix (1800.2 default printer API, copy aliasing; `uvm_pool::get` creates; recording enable) | — |
| DebuggingSimulator | E-DBG-1 hang lab | Rebuild: hang-triage (missing item_done, stuck objection, grab leak) with objection trace | uses phase + sequencer models |
| TelemetryEventBusVisualizer | E-DBG-1 | Rebuild as report catcher / severity-action explorer | `uvm-report-model.ts` |

### D. UVM advanced (T3)

| Component | Lessons | Decision | Model |
|---|---|---|---|
| ScoreboardMatchingVisualizer | A-UVM-6 | **New**: in-order vs per-ID out-of-order matching, EOT accounting, mutant detection | `scoreboard-model.ts` |
| CallbackTimingVisualizer | A-UVM-5 | **New**: `add` before/after create, null handle → type-wide, append/prepend order | small model |
| MultiAgentCoordinationVisualizer | A-UVM-8 | **New**: virtual sequence ordering, config-before-data, reset mid-traffic | `uvm-sequencer-model.ts` |
| VIPReuseVisualizer | A-UVM-7 (new use), E-SOC-1 | Fix (prediction: which components exist in passive mode) | — |
| RalRegisterMapVisualizer | A-UVM-4A | Rebuild flagship: field access policies, desired/mirrored/DUT, set/update/write/read/mirror/peek/poke | `ral-model.ts` |
| RALPredictorVisualizer | A-UVM-4B | Rebuild: explicit (predictor) vs implicit (auto-predict) correctly named; missing-connection debug | same |
| RALHierarchy | unused | Remove from registry | — |

### E. AMBA (T3)

| Component | Lessons | Decision | Model |
|---|---|---|---|
| AxiMemoryMathVisualizer | B-AXI-2 | Fix with spec equations (unaligned, narrow, WRAP legality, 4KB) | `axi-burst-model.ts` |
| AxiChannelHandshakeVisualizer | B-AXI-1 | Rebuild: W-before-AW, READY-before-VALID, B after AW + WLAST, stalls; predict the handshake cycle | `axi-channel-model.ts` |
| AxiIdOrderingVisualizer | B-AXI-3 | Fix: R beats, interleaving across IDs, same-ID order, ID arithmetic | same |
| ExclusiveAccessVisualizer | B-AXI-4 | Fix: label monitor policy as implementation choice; OKAY on unsupported exclusive | — |
| BridgeTranslationExplorer | B-AMBA-F1 | Fix premise: AHB INCR never crosses 1KB; real split reasons; AXI→AHB 1KB split | `axi-burst-model.ts` |
| AhbPipelineBurstVisualizer | B-AHB-1 | Fix: add BUSY and two-cycle ERROR scenarios | — |
| ProtocolWaveform instances | B-AHB-1, B-AXI-1 | Fix the 3 wrong diagrams in MDX | — |
| AxiDeadlockSimulator, AmbaFamilyExplorer, ProtocolAnalogyExplorer | B-AXI-5, B-AMBA-1/2 | Keep (analogy order text fix) | — |

### F. Expert and other

| Component | Lessons / route | Decision |
|---|---|---|
| FormalVsSimulationVisualizer | E-INT-1 | Fix (assumption ↔ assertion pairing, real CEX replay) |
| PowerDomainVisualizer | E-PWR-1 | Fix (isolation state, UPF snippet per step, reduced motion) |
| PssIntentMapVisualizer | E-PSS-1 | Fix (show PSS source; checks in scoreboard not sequence) |
| InteractiveUvmArchitectureDiagram | I-SV-9, practice | Keep (navigation) |
| Practice hub and visualization routes | /practice | Point each route at the rebuilt component; remove dead "completed" placeholders |
| Homepage feature cards | / | Only claim what works by default |

## Execution

Each wave is built by parallel workers with disjoint file ownership. The lead integrates registries, reviews semantics, runs the full validation, then commits and pushes.

| Wave | Workstreams | Checkpoint |
|---|---|---|
| 0 | Shared primitives, stubs, registry entries for new components | commit + push |
| 1 | A (foundations), B (T2 SV) | commit + push |
| 2 | C (UVM), D (advanced UVM) | commit + push |
| 3 | E (AMBA), F (expert/other), practice routes | commit + push |
| 4 | Full sweep (build, 105-lesson Playwright, captures), docs and trackers | commit + push |
