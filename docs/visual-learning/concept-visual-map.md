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

| Concept | Mental picture | Existing visuals (status) | Present | Missing | Phase |
|---|---|---|---|---|---|
| **Scheduling regions, blocking vs NBA, delta cycles, races** | A *ladder* of regions inside one instant; reads drop in Active (▼), `<=` writes land in NBA (◆), the scheduler loops back up | ✅ TimeSlotRegionMap, TimeSlotTraceVisualizer, RaceConditionDebugger, TestbenchDriveComparison, RaceDebugChallenge (F3C). SVSchedulerRegionVisualizer (◇, text corrected). EventRegionGame (answer key fixed) | Dg An CT Ex Rc Db | Runner-graded lab (LAB-M1) | **done (pilot)** |
| Clocking blocks: skews, `@(cb)`, `##`, default clocking | A clock edge with a *photo* taken just before it (Preponed) and a *delivery truck* arriving after the design updates (Re-NBA); `@(cb)` rings in Observed | F3C drive comparison (✅ model, default skews). ModportExplorer (◇) | Dg Ex | Skew timeline with nonzero input/output skews (extend the scheduler model to multiple time slots), CT, Db (sampling with `#0` input skew), Rc | P1a VIS-SV-5 |
| Value systems, 4-state, X/Z, X-optimism in `if`/`case` | Values as chips: hatched X spreads through gates; an `if (X)` takes the *else* road silently | LogicStateDiagram (◇), DataType explorers (◇) | Dg | Model of operator truth tables + `if`/`case`/`casex` X behavior; Ex (feed X into expressions); Db ("X masked by 2-state"); Rc | P1a VIS-SV-1 |
| Nets vs variables, resolution, multiple drivers | Several *drivers* pushing on one wire; the resolution table decides (wire/wand/wor/tri/trireg; strength) | none (spec's NetResolutionSimulator absent) | — | All six; model with strengths; Db "variable with two continuous drivers → compile error vs net → X" | P1a VIS-SV-1 |
| Widths, signedness, casting, extension, truncation | Bit strips that *stretch* (sign or zero extend) or get *cut*; the expression's context width decides | SignednessVisualizer (◇), OperatorVisualizer/OperatorDrill (unused) | Dg | Expression-sizing model (context-determined), CT, Ex, Db ("unsigned compare surprise"), Rc | P1a VIS-SV-2 |
| Packed/unpacked arrays | 3D block: packed = one contiguous bit row, unpacked = separate drawers | SystemVerilog3DVisualizer (index-aware, OK), PackedUnpackedPlayground | Dg Ex | Text alternative for 3D; Db (slice/index mistakes); Rc | P1b |
| Dynamic arrays, queues, associative arrays | Dynamic array = *reallocated* block (copy on `new[]`); queue = deque; assoc = sparse key map | DynamicStructureVisualizer (⚠ `push_back`/capacity), QueueOperationLab, ArrayMethodExplorer, PacketSorterGame | Dg Ex | Fix models (LRM defaults, bounded-queue discard); Db (delete while iterating, handle aliasing in queue); Rc | P1b |
| Class handles, allocation, aliasing, shallow vs deep copy | *Handles are arrows* to objects on a heap; `new` makes a box; `=` copies the arrow; shallow copy duplicates the box but shares inner boxes | none | — | All six (object/heap view primitive needed) | P1a VIS-SV-3 |
| Inheritance, polymorphism, virtual methods, `$cast` | A handle's *type label* vs the object's *real class*; virtual calls follow the object | Polymorphism content (text); InterviewQuestionPlayground (fixed render) | Rc (partial) | Dispatch model (static vs virtual, default args), Ex, Db (missing `virtual`), CT | P1b |
| Processes: fork/join variants, `disable fork`, `wait fork`, fork-in-loop | Threads as *lanes* branching from a parent; join gates; `disable fork` cuts every child lane of the calling thread | ProceduralBlocksSimulator (◇), MailboxSemaphoreGame, Mailbox3D (⚠ `try_put`) | Dg | Process model on the scheduler engine (multi-time-slot), An CT Ex Db (loop-variable capture, leaked threads), Rc | P1a VIS-SV-4 |
| Events, mailboxes, semaphores, deadlock | Mailbox = bounded *tube*; semaphore = *key bucket*; deadlock = circular wait graph | MailboxSemaphoreGame (◇), Mailbox3D (⚠) | Dg Ex | Fix try_put; `->` vs `->>` vs `.triggered` timeline (CT, Db); deadlock graph Db; Rc | P1b |
| Interfaces, modports, virtual interfaces | Interface = *cable bundle*; modport = *view mask*; virtual interface = *handle* to the bundle passed via config_db | ModportExplorer (◇), InterfaceSignalFlow (◇) | Dg | vif binding CT (null-vif Db), Rc | P1b |
| Constraint solving, `dist`, solve-before, failures | The *solution space* as a grid of legal points; `dist` weights tiles; solve-before reshapes probabilities, not legality | ConstraintSolverExplorer/Heatmap/Visualizer, Constraint3D, RandomizationExplorer (⚠ `soft` as 90%, `grid-cols-16`, 97% false failure) | Dg Ex | One exact-enumeration model for small domains; `:=` vs `:/` predict; Db (over-constraint diagnosis); Rc; remove duplicates | P1a VIS-SV-6 |
| Functional coverage, bins, crosses, holes | A *bin grid* filling as samples arrive; cross = 2D grid; holes stay dark | CoverageCrossExplorer (⚠ invalid ignore_bins), CovergroupBuilder (unused), CoverageAnalyzer, Coverage3D | Dg Ex | Sampling-timeline model (when `sample()` fires; double sampling), bin-semantics predict, Db (unreachable bin), Rc | P1a VIS-SV-7 |
| Assertions: sampling, temporal sequences, vacuity, `disable iff` | A waveform with *attempt ribbons* starting at each clock; each reads Preponed samples; vacuous attempts are grey | SvaSequenceWaveformVisualizer (⚠ bare sequence "vacuous"), TemporalLogicExplorer (OK for `\|->`/`\|=>`), AssertionBuilder | Dg Ex | SVA trace evaluator model (sampled-value functions, repetition, `disable iff`), CT, Db (four failing traces), Rc | P1a VIS-SV-8 |
| DPI, generate, bind, directives | Elaboration *unrolls* generate; DPI is a *border crossing* with type adapters | GenerateElaborationVisualizer, DPIBoundaryInspector, BindDirectiveVisualizer (◇) | Dg | DPI context/timing Ex; Rc | P1c |

## UVM

| Concept | Mental picture | Existing visuals (status) | Present | Missing | Phase |
|---|---|---|---|---|---|
| Testbench hierarchy and responsibilities | A *tree* of components (parent owns child) with objects flowing along it | UVMTreeExplorer (⚠ quiz key), UvmHierarchySunburst, InteractiveUvmArchitectureDiagram, UvmTestbenchVisualizer (◇) | Dg | Consolidate to one hierarchy view; `print_topology` CT; Db (missing parent → orphan); Rc | P1b |
| Construction, factory registration, overrides | Factory = *switchboard* routing `create` requests; instance overrides checked before type overrides | FactoryOverrideVisualizer, FactoryOverrideExplorerVisualizer, UvmFactoryWorkflowVisualizer (⚠ three different precedence rules) | Dg Ex | One tested resolver (TRUST-2), CT, Db ("override not taking effect": `new` vs `create`, path typo), Rc | P1a VIS-UVM-3 |
| Configuration lookup and scope | config_db as *layered transparencies* by hierarchy; higher context wins at build; type must match exactly | ConfigDbExplorer (◇) | Dg | Model shared with the factory resolver; Db (silent type mismatch, wildcard scope); Rc | P1a VIS-UVM-3 |
| Phases, objections, end of test | Phase *timeline* with a run_phase lane alongside 12 runtime lanes; objections as *raised hands*; drain/timeout clocks | UvmPhaseTimelineVisualizer, UvmPhasingDiagram/InteractiveTimeline, PhaseTimeline3D, UvmPhaseSorter (⚠ order/concurrency) | Dg | Phase/objection model (TRUST-2), An CT, Db (test ends early / hangs), Rc | P1a VIS-UVM-2 |
| Sequence → sequencer → driver handshake | A *turnstile*: `start_item` waits for grant, `finish_item` hands off, `get_next_item`/`item_done` close the loop; responses return | AnimatedUvmSequenceDriverHandshakeDiagram (⌛/◇), placeholders | — | Handshake model incl. responses and `item_done` omission hang; all six | P1a VIS-UVM-1 |
| Arbitration, lock/grab, priorities | Sequencer *queue* with arbitration modes as rules | SequencerArbitrationSandbox (⚠ weighted = strict; lock auto-release), UvmSequenceHierarchyVisualizer | Dg Ex | Fix model; predict-the-grant Ex; Rc | P1b |
| Virtual sequences, multi-agent coordination | A *conductor* (virtual sequence) cueing several orchestras (agents' sequencers) with sync points | VirtualSequencerExplorer, UvmVirtualSequencerDiagram (◇) | Dg | Coordination model (ordering, reset mid-traffic), Ex, Db (missing sync → DUT drops data), Rc | P1b VIS-UVM-5 |
| TLM, analysis broadcast | Analysis port = *loudspeaker* (0..N listeners, zero time); FIFO = *mailbox* giving the subscriber its own thread | TLMPortConnector, TlmConnectionBuilderVisualizer (⚠ pull flow backwards; rejects legal hierarchy), Analysis3D/Dataflow3D | Dg Ex | Fix rules; Db ("write() can't block": move work to FIFO + run_phase); Rc | P1b |
| Monitor, predictor, scoreboard, coverage relationships | Two *conveyor belts* (expected from predictor, actual from monitor) meeting at a comparator; leftovers at EOT are failures | none in A-UVM-6 | — | Matching model (in-order, per-ID out-of-order, EOT accounting), all six | P1a VIS-UVM-4 |
| Out-of-order matching with IDs | Per-ID *queues*; reorder across IDs is legal, within an ID it is a bug | AxiIdOrderingVisualizer (check against TRUST-4) | Dg An | Shared with VIS-UVM-4; Db (same-ID overwrite) | P1a |
| Reset and outstanding transactions | Reset as a *wipe* that must flush in-flight items in driver, monitor and scoreboard | none | — | All six; tie to M8 | P1c |
| Register model, prediction, mirroring, access paths | Three *columns*: desired / mirrored / actual DUT; arrows for set/update/write/read/peek/poke; the predictor path from the bus monitor | RALHierarchy, RALPredictorVisualizer (⚠ inverted terms), RalRegisterMapVisualizer (⚠ ignores access policies) | Dg | Model with access policies (RW/RO/W1C/RC), explicit vs auto prediction; Db (stale mirror); Rc | P1a VIS-UVM-6 |
| Callbacks, policies, containers, recording | Callback = *plug-in socket* on a component | UvmPolicyVisualizer, UvmContainerVisualizer, TransactionRecordingVisualizer (◇) | Dg | Attachment timing Db (null handle → type-wide) | P1c |
| Debugging failures across the environment | Failure *triage funnel*: symptom → first divergence → owning component → root cause | TelemetryEventBusVisualizer (◇), DebuggingSimulator (⚠ ignores scenario) | Dg | Cross-env debug challenge using the scoreboard + handshake models; Rc | P1c |

## System-level verification

| Concept | Mental picture | Existing visuals | Present | Missing | Phase |
|---|---|---|---|---|---|
| Protocol transfers and backpressure | VALID/READY as a *handshake*: data moves only on the edge both are high; READY may wait, VALID may not depend on READY | AxiChannelHandshakeVisualizer, AhbPipelineBurstVisualizer, ProtocolWaveform (⚠ 4 wrong diagrams) | Dg An | One tested channel model generating diagrams (TRUST-4); Ex (random READY); Db | P1b VIS-SYS-1 |
| IDs, ordering, latency, outstanding requests | Per-ID lanes with credit counters | AxiIdOrderingVisualizer | Dg An | Outstanding-limit Ex; Rc | P1b |
| Burst math, 4KB (AXI) / 1KB (AHB) boundaries | Address line with *fences* at 4KB/1KB; WRAP folds back at the aligned window | AxiMemoryMathVisualizer (⚠ unaligned lanes), BridgeTranslationExplorer (⚠ AHB 4KB premise) | Dg Ex | Fix models; predict items | P1b |
| Deadlock and channel dependencies | Dependency *graph* with a cycle highlighted | AxiDeadlockSimulator (good), ExclusiveAccessVisualizer | Dg An Ex | Rc; Db already in lab | P1c |
| Error injection and recovery | Error as a *red packet* that must be counted, recovered from, and not crash the scoreboard | none | — | All six; tie to M8 | P1c |
| Reproducible failures, seeds | Seed = *recipe*; same recipe, same run; a race = same recipe, different kitchen | F3C trace shows tool-order dependence | Dg (partial) | Seed/regression triage exercise | P1c |
| Coverage closure and regression reasoning | Coverage curve flattening; holes mapped to plan rows | DesignGapChart, CoverageAnalyzer (◇) | Dg | Closure-loop Ex with budget | P1c |

## Phased plan

- **Pilot (done).** Scheduling and races (F3C). The visual-system primitives exist and are tested.
- **P1a (prerequisite core).** VIS-SV-1, SV-2, SV-3, SV-4, SV-5, SV-6, SV-7, SV-8, then VIS-UVM-1, UVM-2, UVM-3, UVM-4, UVM-6. Each gates a lab in the TB ladder.
- **P1b (breadth).** Packed/unpacked text alternative, dynamic structures fix, polymorphism, IPC, interfaces/vif, hierarchy consolidation, arbitration, virtual sequences, TLM, protocols (VIS-SYS-1).
- **P1c (advanced).** DPI/generate, reset and outstanding transactions, callbacks timing, cross-environment debug, error injection, seeds and regressions, closure.

**Exit criterion per concept.** Dg + (An or CT) + Ex + Rc + Db present; the model has semantic tests citing clauses; a prediction gate exists; the visual passes the accessibility checklist in [visual-language.md](visual-language.md) §7; a flashcard references the visual anchor; at least one kata or lab exercises the concept in real code.

**Tracking.** Update this table's "Present" column and status emoji as items land. The coverage matrix ([coverage-matrix.md](../audit/2026-10-03-learning-outcomes/coverage-matrix.md) §2) should show P and D rising to 2 for each covered concept.
