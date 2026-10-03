# Module, concept and competency coverage matrix (2026-10-03)

**Scale.**
- Depth runs from 1 (name-level) to 5 (independent mastery supported).
- Competency ratings: **0** absent · **1** shallow or mention · **2** solid, with evidence.
- Competency columns: **E** explain · **P** predict · **A** apply in code · **D** debug misuse · **T** transfer to an unfamiliar problem.

**Coverage.** Every module was reviewed exhaustively from source; per-module inventories, file:line evidence and per-concept tables are in [appendices A–E](appendices/). Browser verification was sampled (see [audit-report.md](audit-report.md) §1.2).

Rows changed by this session are marked ✅. Ratings describe the state after the change.

## 1. Every module

### T1 Foundational (13 modules / 16 MDX); appendix A

| Module | Depth | Strongest competency | Biggest gap | Sev |
|---|---|---|---|---|
| F1A Cost of Bugs | 3 | E: respin economics, ECO vs respin | No practice; ECO/metal-spin rows conflated | S4 |
| F1B Verification Mindset | 3 | E: methods trade-offs; code vs functional coverage | `one_hot()` is not a construct; no quiz | S4 |
| F1C Why SystemVerilog | 2 | E: feature overview | History inaccuracies; imprecise `logic` multi-driver rule | S4 |
| F2A Core Data Types | 3 | E: 4-state vs 2-state, X masking | Wrong net/variable driver rule (text + quiz); no sizing rules, struct/union, or operators | S2 |
| F2B Dynamic Structures | 3 | E/A/D: assoc-array scoreboard, leak debug | `new[]` default and bounded-queue semantics wrong; UVM code before UVM is taught | S3 |
| F2C Procedural & Flow ✅ | 2 | E: blocking vs NBA; `always_*` FSM | Region table and graded game fixed this session. Open: unlabeled TB race in flow-control, named-block `disable` advice. | S2 (was S1) |
| F2D Reusable & Parallel | 2 | E: static vs automatic | Events, `wait fork`, fork-in-loop absent; LRM-illegal initializer; lab mismatch | S2 |
| F3A Simulation Semantics ✅ | 2 | P: timescale/precision items | Delta demo and `$time` output fixed. Still explanation-heavy, with no interactive. | S3 (was S1) |
| F3B Scheduling Regions ✅ | 3 | E: regions; sampling vs evaluation | Table now renders; race/phasing claims corrected. Still no code exercise of its own (F3C supplies it). | S3 |
| **F3C Delta Cycles & Races ✅** | **4** | **E/P/D: model-driven trace, all-orders experiment, model-graded debug** | Katas need a real simulator; no runner-graded lab yet | S3 (was S2) |
| F4A Modules & Packages | 2 | E/A: shared types via package | Import collision rule mis-taught; `` `include``-into-two-packages trap missing | S3 |
| F4B Interfaces & Modports | 2 | E: modport views | Virtual-interface binding never shown; handshake example deadlocks | S2 |
| F4C Clocking Blocks ✅ | 2 | E: `#1step` input skew | Drive region, race example, `##`/`default clocking` and `@(cb)` timing corrected. Still missing a driver/monitor-through-`vif.cb` example and a lab. | S2 (was S1) |

### T2 Intermediate SystemVerilog (13); appendix B

| Module | Depth | Strongest | Biggest gap | Sev |
|---|---|---|---|---|
| I-SV-1 OOP | 2 | E: virtual dispatch, `$cast` | Static members, lifetime, `typedef class`, interface classes, polymorphic `copy`/`clone` missing; wrong default-specialization answer | S2 |
| I-SV-2A Rand fundamentals | 2 | E/A: soft vs inline override | `dist :=` vs `:/` never explained; solve-before described three ways | S2 |
| I-SV-2B Advanced rand | 2.5 | D: randomize-failure triage | "Implication evaluates A first"; "rand unsigned by default"; lab premise false | S2 |
| I-SV-3A Coverage fundamentals | 2 | E: covergroup anatomy, `iff` | Bin semantics and sampling timing absent; non-compiling `type_option.auto_bin_max`; invented `find()` | S2 |
| I-SV-3B Advanced coverage | 2 | E: closure-loop narrative | `per_instance` omitted; lab can't close | S3 |
| I-SV-4A SVA fundamentals | 1.5 | E: `\|->` vs `\|=>` | No sampled-value functions, repetition, vacuity, `disable iff`; lab coming soon | S1 |
| I-SV-4B Advanced temporal | 1.5 | E: per-attempt local variables | Bare-sequence assertions; "static local vars"; `##0` misdescribed | S1 |
| I-SV-4C Checkers & bind | 2 | E/A: bind mechanics | Checker restrictions misstated; no exercise | S2 |
| I-SV-5 Sync & IPC | 2.5 | D: semaphore key-leak | `->>` "persists"; no fork/join_any/`disable fork`/`wait fork` | S1 |
| I-SV-6 Directives & generate | 3 | E: macro hygiene | "genvar illegal in always"; broken bind-in-generate | S2 |
| I-SV-7 DPI | 2.5 | E: import/export, type table | DPI task timing wrong; nonexistent `svGetIntElement` | S1 |
| I-SV-8 UPF | 1.5 | E: vocabulary | No SV-side power verification; orphan placement | S3 |
| I-SV-9 Why UVM | 2 | E: motivation | No layered-SV-TB bridge or readiness check; wrong IEEE date | S3 |

### T2 Intermediate UVM (11); appendix C

| Module | Depth | Strongest | Biggest gap | Sev |
|---|---|---|---|---|
| I-UVM-1A Components | 2 | E: object vs component, macros | Wrong `super.build_phase` mechanism; no field macros/`do_*`/naming | S1 |
| I-UVM-1B Factory | 3 | E/A: create + type override | Wrong instance-override precedence; visualizers disagree | S2 |
| I-UVM-1C Phasing | 3 | E: `run_phase` in parallel with runtime phases | connect/end_of_elab "top-down"; drain time as hang fix; no timeouts | S1 |
| I-UVM-2A Component Roles | 2 | E: role vocabulary | No agent/monitor/sequencer code; no `get_is_active()` | S2 |
| I-UVM-2B TLM | 2 | E: analysis fan-out | `write()` back-pressure myth; wrong port→export rule; no `analysis_imp_decl` | S1 |
| I-UVM-2C Config & Resources | 3 | E/A: vif via config_db | Precedence half right; no type-mismatch trap, tracing, `check_config_usage` | S2 |
| I-UVM-3A Sequences & Items | 3 | E: `uvm_do` expansion, handshake | "Cloned queues share a pointer"; no responses; no objection | S1 |
| I-UVM-3B Advanced Sequencing | 2 | E: virtual seq vs sequencer | Invented APIs, deadlocking exemplars; layering never taught | S1 |
| I-UVM-4 Policy Classes | 3 | E: macros vs `do_*` | Quiz key wrong; overclaims | S2 |
| I-UVM-5 Container Classes | 2 | E: native vs UVM containers | Overstated `uvm_pool`/`uvm_queue` policy; compile error | S3 |
| I-UVM-6 Recording Classes | 2 | E: `begin_tr`/`end_tr` | Recording must be enabled (unstated); no practice | S3 |

### T3 Advanced UVM (6); appendix D

| Module | Depth | Strongest | Biggest gap | Sev |
|---|---|---|---|---|
| A-UVM-4A RAL Fundamentals | 2 | E: block/reg/field/map | No desired/mirrored, `set/update`, `add_hdl_path` | S2 |
| A-UVM-4B Advanced RAL | 2 | D: mirror debug checklist + lab | Inverted implicit/explicit; wrong poke/predict graded correct; invented APIs | S1 |
| A-UVM-5 Callbacks | 3 | E: callback vs factory table | Attachment on a null handle; no `UVM_PREPEND` | S2 |
| A-UVM-6 Scoreboards | 3 | E/A: analysis-FIFO + reference model | No end-of-test accounting; ID-reuse overwrite; timer-based drain | S2 |
| A-UVM-7 VIP Construction | 2 | E: packaging, active/passive | No driver/monitor/vif/reset code; `$error` invisible to UVM | S2 |
| A-UVM-8 Multi-Agent | 2 | E: virtual sequencer dispatch | Hanging fork/join example; passive-agent sequencer used | S2 |

### T3 Advanced AMBA (14); appendix E

| Module | Depth | Strongest | Biggest gap | Sev |
|---|---|---|---|---|
| B-AMBA-1 Protocol families | 1.5 | E: family comparison | AHB drawn as one multiplexed channel; no predict/apply | S4 |
| B-AMBA-2 Intuition | 1 | E: analogies | "Three actions independent" seeds the write-ordering misconception | S3 |
| B-AHB-1 Timing | 2 | E: pipeline | Wrong wait-state waveform; no BUSY or HBURST table | S2 |
| B-AHB-2 Pitfalls | 2.5 | D: buggy vs fixed RTL | ERROR assertion misses one-cycle ERROR | S1 |
| B-AHB-3 Verification | 3 | A: monitor/checker/coverage code | Checker flags legal behavior; coverage doesn't compile | S1 |
| B-AXI-1 Channels | 3 | E: handshake contract | W-before-AW called illegal; B-after-AW missing; main waveform wrong | S1 |
| B-AXI-2 Burst math | 3 | P: calculation quizzes | Legal burst labelled illegal; boundary assertion fails legal bursts | S2 |
| B-AXI-3 Ordering & IDs | 3 | E/P: ID ordering | Reference scoreboard broken | S2 |
| B-AXI-4 Expert features | 2 | E: exclusive flow | AxPROT key wrong; no AXI5 atomics | S2 |
| B-AXI-5 Deadlocks | 3.5 | D: dependency cycles + lab | Wrong unaligned strobe example | S2 |
| B-AXI-6 Verification & perf | 2 | A: per-ID queue idea | Monitor overwrites same-ID writes; lab starter doesn't compile | S2 |
| B-AMBA-F1 Bridges | 2.5 | T: bridge test plan | False premise: AHB bursts cross 4KB (they can't cross 1KB) | S1 |
| B-AMBA-F2 ACE/CHI | 2 | E: coherency ownership | Inaccuracies; CHI unverified | S3 |
| B-AMBA-F3 Debug clinic | 3 | D/T: triage drills | Wrong WVALID/AWREADY answer; repeats boundary errors | S2 |

### T4 Expert (12); appendix D

| Module | Depth | Strongest | Biggest gap | Sev |
|---|---|---|---|---|
| E-CUST-1 Methodology customization | 2 | E: governance | Custom phase lacks `exec_task` | S2 |
| E-DBG-1 Debug | 1 | E: triage-playbook concept | No report catcher, `+uvm_set_*`, recording, seed reproduction; Hang Lab mismatched | S2 |
| E-INT-1 UVM + formal | 3 | D: assumption pitfalls | Overclaimed constraint↔assumption mapping | S3 |
| E-PERF-1 Performance | 1 | E: measure before tuning | False scheduler claims; no real UVM hotspots | S2 |
| E-SOC-1 SoC strategy | 3 | T: staff-level strategy artifact | Auto-predict misuse; no SoC reset/error strategy | S2 |
| E-AI-1 AI-driven | 2 | E: LLM-SVA risks | Tool misdescribed; unsupported ROI | S3 |
| E-EMU-1 Emulation | 2 | E: sync bottleneck | ZeBu/Veloce swapped; no SCE-MI | S3 |
| E-PSS-1 PSS | 2 | E: portable intent | Wrong standard number; invalid syntax | S3 |
| E-PWR-1 Power-aware | 2 | A: power-cycle vseq | Callbacks said to abort sequences | S3 |
| E-PYUVM-1 Python | 2 | E: SV↔pyUVM map | Protocol bug in cocotb example | S3 |
| E-RISCV-1 RISC-V | 2 | E: step-and-compare | Made-up RISCV-DV YAML; truncated-trace compare passes | S3 |
| E-UVM-ML-1 Multi-language | 2 | E: DPI vs backplane | UVM-Connect origin wrong | S3 |

**Distribution.**
- Depth ≥ 3 in 22 of 69 modules; only F3C reaches 4.
- No module reaches 5, because no module has graded, unscaffolded practice.

## 2. Concept → evidence → competency

Ratings are across the whole curriculum (best evidence anywhere). "Evidence" names the strongest location; "Blocking issue" names what keeps the rating down.

### SystemVerilog

| Concept | E | P | A | D | T | Evidence | Blocking issue |
|---|---|---|---|---|---|---|---|
| Value systems, 4-state, X/Z | 2 | 1 | 0 | 1 | 0 | F2A:26-38, LogicStateDiagram | Told rather than predicted; `==` with X overstated |
| Nets vs variables, resolution, multiple drivers | 1 | 0 | 0 | 0 | 0 | F2A:44-65 | Variable driver rule wrong (text + quiz); no resolution table (spec's NetResolutionSimulator pending) |
| Types, signedness, sizing, casting | 2 | 1 | 0 | 0 | 0 | F2A, SignednessVisualizer | Expression sizing absent; wrong clause numbers |
| Arrays, queues, associative arrays | 2 | 1 | 1 | 1 | 1 | F2B, QueueOperationLab | `new[]` default wrong; dynamic-array model has `push_back` |
| Operators, expression evaluation | 0 | 0 | 0 | 0 | 0 | none (OperatorDrill unused) | Lesson missing |
| Control flow, tasks/functions, lifetimes | 2 | 1 | 1 | 1 | 0 | F2C flow-control, F2D tasks-functions | Named-block `disable` advice; LRM-illegal initializer |
| Processes, fork/join, events, mailboxes, semaphores, cancellation, deadlocks | 2 | 0 | 1 | 1 | 0 | F2D/ipc, I-SV-5, ipc-deadlock lab | No `wait fork`/`disable fork` isolation/fork-in-loop; `->>` wrong |
| **Scheduling regions, blocking/NBA, delta cycles, races** ✅ | **2** | **2** | **1** | **2** | **1** | **F3C model visuals (all-orders exploration, challenge)** | Katas need a real simulator for A=2 |
| Modules, packages | 2 | 0 | 1 | 1 | 0 | F4A | Collision rule mis-taught |
| Interfaces, modports, virtual interfaces, clocking blocks | 2 | 1 ✅ | 1 | 1 ✅ | 0 | F4B, F4C, F3C drive comparison | vif binding never shown; no driver/monitor-via-cb example |
| Classes, handles, lifetime, inheritance, polymorphism, parameterization | 2 | 1 | 1 ✅ | 1 | 0 | I-SV-1 (code visible again) | Statics, `typedef class`, `clone`/`copy` pattern absent |
| Constrained randomization, distributions, solver pitfalls | 2 | 1 | 1 | 1 | 0 | I-SV-2B solver-debug | `dist` semantics unexplained; implication myth |
| Functional coverage, crosses, sampling, exclusions, closure | 1 | 0 | 1 | 0 | 0 | I-SV-3A/3B | Bin semantics and sampling timing absent |
| Assertions, temporal reasoning, reset, vacuity, checkers, bind | 1 | 1 | 0 | 0 | 0 | I-SV-4A, TemporalLogicExplorer | Sampled-value functions, repetition, vacuity, `disable iff` absent; bare-sequence examples |
| DPI, elaboration, directives | 2 | 0 | 1 | 0 | 0 | I-SV-6, I-SV-7 | DPI timing wrong; nonexistent API |

### UVM

| Concept | E | P | A | D | T | Evidence | Blocking issue |
|---|---|---|---|---|---|---|---|
| Component/object architecture, ownership | 1 | 0 | 0 | 0 | 0 | I-UVM-1A | `super.build_phase` myth; no hierarchy code |
| Factory, overrides, configuration, resources | 2 | 1 | 1 | 1 | 0 | I-UVM-1B, 2C, config-debug lab | Override precedence wrong in lesson and visuals |
| Phases, objections, reset, termination, timeouts | 2 | 0 | 0 | 0 | 0 | I-UVM-1C | Phase direction wrong; drain-time myth; no timeouts |
| Transactions, sequences, sequencer↔driver handshake | 2 | 0 | 1 | 1 | 0 | I-UVM-3A | Handshake visual a placeholder; no responses |
| Arbitration, responses, layering, virtual sequences | 1 | 0 | 0 | 0 | 0 | I-UVM-3B, A-UVM-8 | Invented APIs; arbitration sandbox wrong |
| Active/passive agents, reusable VIP | 1 | 0 | 1 | 0 | 0 | A-UVM-7, soc-vip-reuse | No agent config object; no driver/monitor code |
| TLM, analysis ports/FIFOs, decoupling | 1 | 0 | 1 | 0 | 0 | I-UVM-2B | `write()` myth; no `analysis_imp_decl` |
| Predictors, reference models, scoreboards, EOT accounting | 2 | 0 | 1 | 1 | 0 | A-UVM-6, scoreboard lab, capstone | No EOT accounting; broken capstone monitor |
| Out-of-order, IDs, concurrency | 2 | 1 | 1 | 0 | 0 | B-AXI-3/6, axi-scoreboard lab | Reference overwrites same-ID; starter doesn't compile |
| Multi-agent coordination | 1 | 0 | 0 | 0 | 0 | A-UVM-8 | Hanging example; no lab |
| Coverage-driven stimulus, verification planning | 2 | 0 | 1 | 0 | 0 | I-SV-3B, E-SOC-1 | No measured closure loop |
| RAL: models, adapters, prediction, mirror, frontdoor/backdoor | 1 | 0 | 1 | 1 | 0 | A-UVM-4A/4B, ral-mirror-bug | Terminology inverted; desired/mirror absent |
| Reporting, recording, callbacks, debug, performance | 1 | 0 | 1 | 0 | 0 | A-UVM-5, I-UVM-6, E-DBG-1 | No reporting or catcher; perf claims false |
| Reuse block → subsystem → SoC | 2 | 0 | 0 | 0 | 1 | E-SOC-1, strategy capstone | No code-level reuse task |

### System-level practice

| Concept | E | P | A | D | T | Evidence | Blocking issue |
|---|---|---|---|---|---|---|---|
| Protocol behavior, backpressure, ordering | 2 | 1 | 0 | 1 | 0 | B-AXI-1..6, AHB | Wrong diagrams; no random-READY stimulus |
| Reset and error injection | 0 | 0 | 0 | 0 | 0 | none | Absent at block, protocol and SoC level |
| Reproducible seeds, regression organization, triage, CI | 1 | 0 | 0 | 0 | 0 | E-DBG-1, E-SOC-1 | No seed/regression exercise |
| Protocol requirement vs design policy | 2 | 0 | 0 | 1 | 1 | B-AXI-5, axi-deadlock lab | Done well only there; AHB-2/3 conflate them |
| Tool limitations and portability | 1 | 0 | 0 | 0 | 0 | scattered | Runner and simulator differences never taught |

## 3. Reading the matrix

- **The curriculum is broad and explanation-first.** E is ≥1 almost everywhere.
- **P, A, D and T collapse to 0–1.** That is the core finding. Lessons describe, but rarely make the learner predict, write, break or extend.
- **The F3C row shows the target pattern.** Raising one concept to E2/P2/D2/T1 took four model-driven visuals on one tested model, plus two katas. Applying that pattern prerequisite-first is the plan in [docs/visual-learning/concept-visual-map.md](../../visual-learning/concept-visual-map.md).
