# Concept → visual map and phased coverage plan (2026-10-03)

For each concept:
- the **mental picture** a learner should recall when they meet it in real code;
- the **existing visuals** and their status (from audit appendices F and G);
- the **representations present**, using the codes below;
- what is **missing**;
- the **phase** (P1a/P1b/P1c, matching [improvement-plan.md](../audit/2026-10-03-learning-outcomes/improvement-plan.md) VIS-* items).

Representation codes:
- **Dg:** conceptual diagram.
- **An:** temporal or behavioral animation.
- **CT:** synchronized code trace.
- **Ex:** interactive experiment.
- **Rc:** compact recap.
- **Db:** visual debugging exercise.

Status:
- **✅ model:** tested model.
- **⚠ wrong:** encodes a wrong rule; fix or replace.
- **◇ illus.:** illustration only.
- **⌛ placeholder.**
- **— none.**

A concept is "covered" only when Dg + (An or CT) + Ex + Rc + Db exist and are model-backed where behavior is involved.

## SystemVerilog

Status as of 2026-10-03 (end of wave 3). "Phase" now records delivery; unfinished items keep their P-label.

| Concept | Mental picture | Visuals (status) | Present | Still missing | Phase |
|---|---|---|---|---|---|
| **Scheduling regions, blocking vs NBA, delta cycles, races** | A *ladder* of regions inside one instant; reads drop in Active (▼), `<=` writes land in NBA (◆), the scheduler loops back up | ✅ TimeSlotRegionMap, TimeSlotTraceVisualizer, RaceConditionDebugger, TestbenchDriveComparison, RaceDebugChallenge (F3C; `sv-scheduler-model`). SVSchedulerRegionVisualizer (F3B, region map) and EventRegionGame (F2C, questions generated from the model) | Dg An CT Ex Rc Db | Runner-graded lab (LAB-M1) | **done (pilot)** |
| Clocking blocks: skews, `@(cb)`, `##`, default clocking | A clock edge with a *photo* taken just before it (Preponed) and a *delivery truck* arriving after the design updates (Re-NBA); `@(cb)` rings in Observed | ✅ ClockingBlockSkewVisualizer (F4C; `sv-clocking-model`: nonzero input/output skews, `#1step`, `@(cb)`, `##`), TestbenchDriveComparison (F3C) | Dg An CT Ex Rc | Db (sampling with `#0` input skew) | **done** (P1a VIS-SV-5) |
| Value systems, 4-state, X/Z, X-optimism in `if`/`case` | Values as chips: hatched X spreads through gates; an `if (X)` takes the *else* road silently | ✅ LogicStateDiagram, CurriculumDataTypeExplorer (F2A; `sv-four-state-model`) | Dg CT Ex Rc | Db ("X masked by 2-state" challenge) | **done** (P1a VIS-SV-1) |
| Nets vs variables, resolution, multiple drivers | Several *drivers* pushing on one wire; the resolution table decides (wire/wand/wor/tri/trireg; strength) | ✅ NetResolutionSimulator (F2A; resolution, strengths, driver legality) | Dg CT Ex Rc | Db | **done** (P1a VIS-SV-1) |
| Widths, signedness, casting, extension, truncation | Bit strips that *stretch* (sign or zero extend) or get *cut*; the expression's context width decides | ✅ OperatorExplorer, SignednessVisualizer (F2A; `sv-expression-model`, context-determined sizing). OperatorVisualizer/OperatorDrill removed | Dg CT Ex Rc | Db | **done** (P1a VIS-SV-2) |
| Packed/unpacked arrays | 3D block: packed = one contiguous bit row, unpacked = separate drawers | ✅ SystemVerilog3DVisualizer (F2B; index-aware). PackedUnpackedPlayground removed (duplicate, wrong rule) | Dg Ex Rc | Text alternative for 3D; Db (slice/index mistakes) | P1b |
| Dynamic arrays, queues, associative arrays | Dynamic array = *reallocated* block (copy on `new[]`); queue = deque; assoc = sparse key map | ✅ DynamicStructureVisualizer, QueueOperationLab, ArrayMethodExplorer (F2B; `systemverilog-array-model`, `sv-array-methods-model`). PacketSorterGame (◇) | Dg CT Ex Rc Db | — | **done** |
| Class handles, allocation, aliasing, shallow vs deep copy | *Handles are arrows* to objects on a heap; `new` makes a box; `=` copies the arrow; shallow copy duplicates the box but shares inner boxes | ✅ ObjectHandleVisualizer (I-SV-1; `sv-object-model`) | Dg An CT Ex Rc Db | — | **done** (P1a VIS-SV-3) |
| Inheritance, polymorphism, virtual methods, `$cast` | A handle's *type label* vs the object's *real class*; virtual calls follow the object | ✅ PolymorphismDispatchVisualizer (I-SV-1; `sv-object-model`) | Dg CT Ex Rc | Db (missing `virtual`) | **done** |
| Processes: fork/join variants, `disable fork`, `wait fork`, fork-in-loop | Threads as *lanes* branching from a parent; join gates; `disable fork` cuts every child lane of the calling thread | ✅ ForkJoinVisualizer, ProceduralBlocksSimulator (F2C, I-SV-5; `sv-process-model`). Mailbox3D removed | Dg An CT Ex Rc Db | — | **done** (P1a VIS-SV-4) |
| Events, mailboxes, semaphores, deadlock | Mailbox = bounded *tube*; semaphore = *key bucket*; deadlock = circular wait graph | ✅ MailboxSemaphoreGame (F2D, I-SV-5; `sv-process-model`), ForkJoinVisualizer events mode | Dg CT Ex Rc Db | Deadlock wait-for graph | **done** |
| Interfaces, modports, virtual interfaces | Interface = *cable bundle*; modport = *view mask*; virtual interface = *handle* to the bundle passed via config_db | ✅ ModportExplorer (F4B; `sv-interface-model`). InterfaceSignalFlow (practice; `sv-interface-flow-model`, null-vif and modport-direction debug cases) | Dg CT Ex Db | Rc | **done** (P1b) |
| Constraint solving, `dist`, solve-before, failures | The *solution space* as a grid of legal points; `dist` weights tiles; solve-before reshapes probabilities, not legality | ✅ ConstraintSolverExplorer, ConstraintSolverHeatmapVisualizer, ConstraintSolverVisualizer (I-SV-2A/2B; `constraint-solver-model`, exact enumeration). RandomizationExplorer and Constraint3D removed | Dg CT Ex Rc | Db (over-constraint diagnosis challenge) | **done** (P1a VIS-SV-6) |
| Functional coverage, bins, crosses, holes | A *bin grid* filling as samples arrive; cross = 2D grid; holes stay dark | ✅ CoverageCrossExplorerVisualizer, CovergroupBuilder (I-SV-3A/3B; `coverage-model`, sampling timeline). CoverageAnalyzer and Coverage3D removed | Dg An CT Ex Rc Db | — | **done** (P1a VIS-SV-7) |
| Assertions: sampling, temporal sequences, vacuity, `disable iff` | A waveform with *attempt ribbons* starting at each clock; each reads Preponed samples; vacuous attempts are grey | ✅ SvaSequenceWaveformVisualizer, TemporalLogicExplorer (I-SV-4A/4B; `sva-model`). AssertionBuilder removed | Dg An CT Ex Rc | Db (four failing traces) | **done** (P1a VIS-SV-8) |
| DPI, generate, bind, directives | Elaboration *unrolls* generate; DPI is a *border crossing* with type adapters | ✅ GenerateElaborationVisualizer, BindDirectiveVisualizer (`sv-elaboration-model`), DPIBoundaryInspector (`sv-dpi-model`) | Dg CT Ex | Rc | **done** (P1c) |

## UVM

| Concept | Mental picture | Visuals (status) | Present | Still missing | Phase |
|---|---|---|---|---|---|
| Testbench hierarchy and responsibilities | A *tree* of components (parent owns child) with objects flowing along it | ✅ UVMTreeExplorer (I-UVM-1A), AnimatedUvmTestbenchDiagram (I-UVM-2A; `uvm-agent-model`), InteractiveUvmArchitectureDiagram (navigation). Sunburst and UvmTestbenchVisualizer removed | Dg CT Ex Rc | Db (missing parent → orphan) | **done** (P1b) |
| Construction, factory registration, overrides | Factory = *switchboard* routing `create` requests; instance overrides checked before type overrides | ✅ FactoryOverrideVisualizer, FactoryOverrideExplorerVisualizer (I-UVM-1B; one resolver, `uvm-factory-model`). UvmFactoryWorkflowVisualizer removed | Dg CT Ex Rc Db | — | **done** (P1a VIS-UVM-3) |
| Configuration lookup and scope | config_db as *layered transparencies* by hierarchy; higher context wins at build; type must match exactly | ✅ ConfigDbExplorer (I-UVM-2C; `uvm-config-db-model`, `uvm-glob-model`) | Dg CT Ex Rc Db | — | **done** (P1a VIS-UVM-3) |
| Phases, objections, end of test | Phase *timeline* with a run_phase lane alongside 12 runtime lanes; objections as *raised hands*; drain/timeout clocks | ✅ UvmPhaseTimelineVisualizer, UvmPhasingDiagram (I-UVM-1C), MethodologyPhaseVisualizer (E-CUST-1), DebuggingSimulator hang lab (E-DBG-1; `uvm-hang-model`). PhaseTimeline3D and the placeholder timeline removed | Dg An CT Ex Rc Db | — | **done** (P1a VIS-UVM-2) |
| Sequence → sequencer → driver handshake | A *turnstile*: `start_item` waits for grant, `finish_item` hands off, `get_next_item`/`item_done` close the loop; responses return | ✅ AnimatedUvmSequenceDriverHandshakeDiagram (I-UVM-2B/3A/3B; `uvm-sequencer-model`, responses and missing `item_done`) | Dg An CT Ex Rc | Hinted Db challenge | **done** (P1a VIS-UVM-1) |
| Arbitration, lock/grab, priorities | Sequencer *queue* with arbitration modes as rules | ✅ SequencerArbitrationSandbox (I-UVM-3B; weighted, strict, lock/grab per uvm-core 2020.3.1), UvmSequenceHierarchyVisualizer | Dg An CT Ex Rc | — | **done** (P1b) |
| Virtual sequences, multi-agent coordination | A *conductor* (virtual sequence) cueing several orchestras (agents' sequencers) with sync points | ✅ VirtualSequencerExplorer, MultiAgentCoordinationVisualizer (A-UVM-8; `vseq-coordination-model`, includes reset mid-traffic). UvmVirtualSequencerDiagram (◇) | Dg An CT Ex Db | Rc in A-UVM-8 | **done** (P1b VIS-UVM-5) |
| TLM, analysis broadcast | Analysis port = *loudspeaker* (0..N listeners, zero time); FIFO = *mailbox* giving the subscriber its own thread | ✅ TLMPortConnector, TlmConnectionBuilderVisualizer, AnalysisBroadcastVisualizer (I-UVM-2B; `uvm-tlm-model`). Analysis3D/Dataflow3D removed | Dg An CT Ex Rc Db | — | **done** (P1b) |
| Monitor, predictor, scoreboard, coverage relationships | Two *conveyor belts* (expected from predictor, actual from monitor) meeting at a comparator; leftovers at EOT are failures | ✅ ScoreboardMatchingVisualizer (A-UVM-6; `scoreboard-model`: in-order, per-ID, EOT accounting) | Dg An CT Ex Db | Rc in A-UVM-6 | **done** (P1a VIS-UVM-4) |
| Out-of-order matching with IDs | Per-ID *queues*; reorder across IDs is legal, within an ID it is a bug | ✅ ScoreboardMatchingVisualizer per-ID mode; AxiIdOrderingVisualizer (`axi-channel-model`) | Dg An CT Ex Db | — | **done** |
| Reset and outstanding transactions | Reset as a *wipe* that must flush in-flight items in driver, monitor and scoreboard | Partial: MultiAgentCoordinationVisualizer reset handling (none / flush / restart) | Dg Ex | Driver/monitor/scoreboard flush model; tie to M8 | P1c |
| Register model, prediction, mirroring, access paths | Three *columns*: desired / mirrored / actual DUT; arrows for set/update/write/read/peek/poke; the predictor path from the bus monitor | ✅ RalRegisterMapVisualizer (access policies), RALPredictorVisualizer (explicit vs auto prediction) (A-UVM-4A/4B; `ral-model`). RALHierarchy removed | Dg An CT Ex Rc Db | — | **done** (P1a VIS-UVM-6) |
| Callbacks, policies, containers, recording | Callback = *plug-in socket* on a component | ✅ CallbackTimingVisualizer (A-UVM-5; null handle → type-wide), UvmPolicyVisualizer, UvmContainerVisualizer, TransactionRecordingVisualizer | Dg CT Ex Rc Db | — | **done** (P1c) |
| Debugging failures across the environment | Failure *triage funnel*: symptom → first divergence → owning component → root cause | ✅ DebuggingSimulator (`uvm-hang-model`), TelemetryEventBusVisualizer (`uvm-report-model`; catcher THROW/CAUGHT) | Dg CT Ex Rc Db | Cross-environment challenge combining scoreboard + handshake models | P1c |

## System-level verification

| Concept | Mental picture | Visuals | Present | Still missing | Phase |
|---|---|---|---|---|---|
| Protocol transfers and backpressure | VALID/READY as a *handshake*: data moves only on the edge both are high; READY may wait, VALID may not depend on READY | ✅ AxiChannelHandshakeVisualizer (B-AXI-1; `axi-channel-model` generates the lesson's ProtocolWaveform figures), AhbPipelineBurstVisualizer (B-AHB-1; `ahb-model`, waits, BUSY, two-cycle ERROR) | Dg An CT Ex Rc Db | — | **done** (P1b VIS-SYS-1) |
| IDs, ordering, latency, outstanding requests | Per-ID lanes with credit counters | ✅ AxiIdOrderingVisualizer (B-AXI-3) | Dg An Ex | Outstanding-limit Ex; Rc | P1b |
| Burst math, 4KB (AXI) / 1KB (AHB) boundaries | Address line with *fences* at 4KB/1KB; WRAP folds back at the aligned window | ✅ AxiMemoryMathVisualizer (B-AXI-2; `axi-burst-model`, A3.4 equations, byte lanes, WSTRB), BridgeTranslationExplorer (B-AMBA-F1; `amba-bridge-model`) | Dg CT Ex Rc Db | — | **done** |
| Deadlock and channel dependencies | Dependency *graph* with a cycle highlighted | ✅ AxiDeadlockSimulator (`axi-deadlock-model` over `axi-dependency-model`; prediction gate, all 256 configurations tested), ExclusiveAccessVisualizer (`axi-exclusive-model`) | Dg An Ex | Rc | P1c |
| Error injection and recovery | Error as a *red packet* that must be counted, recovered from, and not crash the scoreboard | Partial: AHB ERROR scenarios, exclusive-access failure (OKAY), report-catcher demotion | Dg Ex | Scoreboard-side error accounting; tie to M8 | P1c |
| Reproducible failures, seeds | Seed = *recipe*; same recipe, same run; a race = same recipe, different kitchen | Partial: F3C ordering explorer; FormalVsSimulationVisualizer seeded runs (seed 1 finds the bug, seed 2 misses it) | Dg Ex | Seed/regression triage exercise | P1c |
| Coverage closure and regression reasoning | Coverage curve flattening; holes mapped to plan rows | Partial: CoverageCrossExplorerVisualizer closure workflow (I-SV-3B), DesignGapChart (◇) | Dg Ex | Closure loop with a budget | P1c |

## Phased plan

- **Pilot (done).** Scheduling and races (F3C). The visual-system primitives exist and are tested.
- **P1a (prerequisite core): delivered 2026-10-03.** VIS-SV-1, SV-2, SV-3, SV-4, SV-5, SV-6, SV-7, SV-8, then VIS-UVM-1, UVM-2, UVM-3, UVM-4, UVM-6. Each gates a lab in the TB ladder. The labs themselves are still only checked by reading them (LAB-M1).
- **P1b (breadth): mostly delivered.** Open: packed/unpacked text alternative, outstanding-limit exercise. Scope was: dynamic structures fix, polymorphism, IPC, interfaces/vif, hierarchy consolidation, arbitration, virtual sequences, TLM, protocols (VIS-SYS-1).
- **P1c (advanced): partly delivered** (DPI/generate, callbacks timing). Open: reset/outstanding flush, cross-environment debug, error injection, seed triage, closure budget. Scope was: reset and outstanding transactions, callbacks timing, cross-environment debug, error injection, seeds and regressions, closure.

**Exit criterion per concept.** Dg + (An or CT) + Ex + Rc + Db present; the model has semantic tests citing clauses; a prediction gate exists; the visual passes the accessibility checklist in [visual-language.md](visual-language.md) §7; a flashcard references the visual anchor; at least one kata or lab exercises the concept in real code.

**Tracking.** Update this table's "Present" column and status emoji as items land. The coverage matrix ([coverage-matrix.md](../audit/2026-10-03-learning-outcomes/coverage-matrix.md) §2) should show P and D rising to 2 for each covered concept.
