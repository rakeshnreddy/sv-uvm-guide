# Curriculum Audit Findings

Status note (2026-03-06): This document is audit evidence, not the live tracker. All `AUD-*` items from this report are mapped into canonical tasks in `TASKS.md`. If this file conflicts with `TASKS.md`, follow `TASKS.md`. For session resume, use `prompt_to_resume_modernization.txt`, which routes agents back to `TASKS.md`.

Date: 2026-03-06
Repository: `sv-uvm-guide`
Scope reviewed: `content/curriculum/`, `labs/`, `content/curriculum/labs/`, `src/components/`, `src/app/practice/`, supporting docs in `docs/`, `TASKS.md`, `comprehensive_lrm_audit_report.md`

## Executive Summary

The curriculum has a strong foundation, especially in Tier 1 and the main Tier 2 index pages. The best modules already feel close to a premium engineering-learning product: they explain why the topic matters, use purposeful visuals, and connect the language feature to verification workflow. The factory, constrained randomization fundamentals, functional coverage fundamentals, UVM phasing, and UVM performance modules are the clearest examples.

The repository is not yet end-to-end curriculum-complete or premium-consistent.

Key current-state signals from the repository scan:
- There are **70 curriculum MDX files**.
- Only **33/70** include a `Quick Take` section.
- Only **27/70** include a `Mental Model` style section.
- Only **13/70** include an `Interview Pitfall` section.
- Only **1/70** explicitly includes `Debug Triage`; explicit `Failure Mode` sections are effectively absent.
- **32 files** still use the legacy `InfoPage` / `Level 1/2/3` format instead of the modern lesson template.
- Tier 4 is especially weak on standards traceability: only **1 of 12** expert-tier MDX files contains an explicit IEEE 1800-2023 or IEEE 1800.2-2020 clause reference.
- The repository contains **12 lab folders** (`9` under `labs/`, `3` under `content/curriculum/labs/`), but the curriculum contains **0 references to `/practice/lab/...` routes** and **0 references to the actual lab folder names**.
- The live lab runner is still a placeholder: `src/app/practice/lab/[labId]/page.tsx` always serves the same hard-coded demo lab, and `src/app/api/labs/run/route.ts` only validates dummy lab `"1"`.

Overall assessment:
- **Technical direction:** good
- **Standards completeness:** incomplete
- **Pedagogical consistency:** uneven
- **Navigation and discoverability:** materially broken in places
- **Lab integration:** mostly not real yet
- **Readiness for a serious learner path:** promising, but not yet coherent enough to claim full premium completion

## Phase 1: Content Gap and Accuracy Analysis

### 1. LRM Completeness

#### SystemVerilog coverage status

Well-covered or reasonably represented:
- Clause 6-7: data types, arrays, packed/unpacked distinctions
- Clause 8: classes/OOP
- Clause 10-15: procedural flow, tasks/functions, clocking, IPC/event primitives
- Clause 16: SVA fundamentals and some advanced temporal logic
- Clause 18: constrained randomization basics and some advanced material
- Clause 19: functional coverage basics and a small amount of advanced material
- Clause 23-26: modules, packages, interfaces, modports

Covered but underpowered for senior DV readiness:
- Clause 16: SVA is present, but advanced scheduling semantics are thin. The curriculum does not yet give first-class treatment to deferred assertions, Observed/Reactive/Postponed reasoning, `expect`, `accept_on`/`reject_on`, or realistic assertion-debug workflows.
- Clause 18: constrained randomization misses practical coverage of `randcase`, `randsequence`, `std::randomize()`, random stability/reproducibility, and more disciplined solver-debug methodology.
- Clause 19: functional coverage fundamentals are good, but advanced coverage is too small for the job. Coverage APIs, UCIS-style reporting workflows, closure dashboards, and real closed-loop stimulus refinement are underdeveloped.

Missing or mostly missing:
- **Clause 17 (Checkers):** cited in `I-SV-4B`, but not taught as a standalone skill. There is no actual checker lesson.
- **Clause 22 (Compiler directives):** no focused treatment.
- **Clause 27 (Generate):** no dedicated explanation of elaboration-time generation versus runtime control.
- **Clauses 28-33:** gate/switch primitives, UDPs, specify blocks, timing checks, SDF/config-style topics are absent or only indirectly implied.
- **Clause 35 (DPI):** only a 29-line overview page, far below production-verification depth.
- **Clauses 36-41 (VPI/PLI/assertion APIs/coverage APIs/data APIs):** absent.

#### UVM coverage status

Well-covered or reasonably represented:
- Core objects/components and hierarchy
- Factory basics
- Phasing and objections
- TLM1-style analysis/port/export/imp concepts
- Config/resource basics
- Sequence item / sequence / arbitration / layering concepts
- RAL fundamentals and prediction overview
- Callbacks
- High-level debug/performance/methodology themes

Covered but underpowered:
- Factory is taught well at the introductory level, but not with enough nuance on governance, override resolution debugging, and enterprise usage patterns.
- RAL is directionally good, but still thin on memories, volatile/W1C/W1S behavior, multi-map concerns, `set_auto_predict`, and realistic mirror-drift debugging.
- Synchronization classes appear in phasing/debug content, but not as a cohesive standards-anchored treatment.

Missing or weak:
- **Clause 7 (Recording classes):** effectively absent as a skill.
- **Clause 11 (`uvm_pool`, `uvm_queue`):** absent as a lesson.
- **Clause 12 (UVM TLM2):** absent; current TLM coverage is essentially TLM1/tutorial-level.
- **Clause 16 (policy classes: printer/comparer/packer/recorder/copier):** absent as a coherent topic.
- **Clause 17 (register layer globals and surrounding infrastructure):** not intentionally taught.
- Reporting and recording infrastructure are mentioned, but not taught rigorously enough for senior methodology ownership.

### 2. Technical Accuracy Spot Check

#### Areas that are technically solid or directionally sound
- `I-UVM-1B_The_UVM_Factory/index.mdx`: the register -> create -> override mental model is strong and practical.
- `I-UVM-1C_UVM_Phasing/index.mdx`: good introductory explanation of build/connect/run/report and objections.
- `I-UVM-3A_Fundamentals/index.mdx`: good explanation of item/sequence separation and the sequence-driver handshake.
- `A-UVM-4B_Advanced_RAL_Techniques/index.mdx`: adapter/predictor/mirror debugging workflow is directionally correct and useful.
- `E-PERF-1_UVM_Performance/index.mdx`: one of the strongest expert modules; it ties performance symptoms to event-scheduler thinking and architectural bottlenecks.

#### Confirmed factual or misleading issues
- `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx:55`
  The analysis-fabric explanation says `uvm_analysis_port` expects a `uvm_analysis_export` connected to an `imp`, but the example itself uses `uvm_analysis_imp` directly. This mixes up export versus imp roles and will confuse learners about terminal subscribers.
- `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx:86`
  The page recommends a `uvm_tlm_analysis_fifo` "between" driver and sequencer if they operate on different clocks. That is not how the sequence-driver handshake is normally decoupled; `uvm_tlm_analysis_fifo` is an analysis-side decoupling primitive, typically monitor-to-scoreboard/subscriber.
- `content/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index.mdx:75`
  The precedence summary is oversimplified and partly misleading. It explains config precedence as purely hierarchical (`uvm_env` beats `uvm_agent`, test always wins) without teaching the important runtime nuance that post-build/run-time sets collapse to default precedence and effectively become last-wins behavior.
- `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes.mdx:72`
  The mailbox page says `uvm_tlm_fifo` provides "analysis ports" and "broadcast behavior." That conflates `uvm_tlm_fifo` with `uvm_tlm_analysis_fifo` and blurs point-to-point FIFO semantics with analysis fan-out.
- `content/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries.mdx:65`
  The guidance says to call `type_id::set_priority(weight)` before `pick_sequence()`. That API is not a valid way to express sequence priority in normal UVM sequencing.
- `content/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries.mdx:72`
  The advice to emulate `try/finally` behavior for `grab()`/`ungrab()` using `uvm_resource_db` is not technically coherent and should not be presented as a recommended recovery pattern.
- `content/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index.mdx:72`
  The page refers to `uvm_callback` "system task APIs." These are class APIs/macros, not SystemVerilog system tasks.

#### Accuracy gaps by topic area
- **Factory overrides:** mostly sound, but missing nuance on override debugging at scale, wildcard specificity, and replacement policy behavior.
- **SVA scheduling:** fundamentals are good, but the curriculum does not yet teach event-region reasoning deeply enough for real assertion-debug work.
- **RAL prediction:** directionally useful, but missing deeper treatment of explicit versus implicit prediction tradeoffs for volatile fields, sideband updates, and memory models.
- **TLM connections:** this is the shakiest technically among sampled core modules because it mixes correct intuition with several API-role inaccuracies.

### 3. Depth vs Breadth: "Wiki Problem" Assessment

Strong against the wiki problem:
- `I-UVM-1B_The_UVM_Factory`
- `I-UVM-1C_UVM_Phasing`
- `I-SV-2A_Constrained_Randomization_Fundamentals`
- `I-SV-3A_Functional_Coverage_Fundamentals`
- `E-PERF-1_UVM_Performance`

Most affected by the wiki problem:
- `I-SV-3B_Advanced_Functional_Coverage/index.mdx` (18 lines total)
- `I-SV-5_Synchronization_and_IPC/index.mdx` (20 lines total)
- `I-SV-4B_Advanced_Temporal_Logic/index.mdx` (23 lines total)
- `I-UVM-3B_Advanced_Sequencing_and_Layering/uvm-virtual-sequencer.mdx` (27 lines total)
- `E-INT-1_Integrating_UVM_with_Formal_Verification/dpi.mdx` (29 lines total)
- `E-SOC-1_SoC-Level_Verification_Strategies/coverage-closure.mdx` (34 lines total)
- `E-DBG-1_Advanced_UVM_Debug_Methodologies/effective-debug.mdx` (23 lines total)
- `E-DBG-1_Advanced_UVM_Debug_Methodologies/reusable-vip.mdx` (25 lines total)

General pattern:
- Many leaf pages explain "what it is" but not "how it fails in a real bench".
- Several expert-tier pages read like short internal notes rather than senior engineer training material.
- Tier 3 as a whole is especially thin: only **449 total lines** across 6 MDX files.

## Phase 2: Content Quality and Pedagogy

### 1. Definition of Done Audit Sample

Representative sample against the repository's premium lesson standard:

| Module | Quick Take | Mental Model | Interview Pitfall | Interactive | Runnable Lab | Assessment | Audit note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `F2A_Core_Data_Types/index.mdx` | Yes | Yes | No | Yes, multiple | No integrated lab | Yes | Strong foundational page, but not full premium completion |
| `I-UVM-1B_The_UVM_Factory/index.mdx` | Yes | Yes | Yes | Yes | Only inline lab prompt, not integrated | Yes | Strong model lesson |
| `I-SV-5_Synchronization_and_IPC` track | Partial | Weak at track level | Present only in leaves | No dedicated track interactive | No integrated lab | Yes in leaf pages | Content exists, but track-level experience is not premium-complete |
| `A-UVM-4A_RAL_Fundamentals/index.mdx` | Yes | Yes | No | No | No | Minimal | Important topic, under-instrumented |
| `A-UVM-4B_Advanced_RAL_Techniques/index.mdx` | Yes | Yes | Yes | Yes | No integrated lab | Limited | Better than 4A, still short of completion |
| `E-PERF-1_UVM_Performance/index.mdx` | Yes | Yes | Yes | Yes | Practice prompt only | Limited | Best expert-tier template to copy |
| `E-INT-1/.../dpi.mdx` | No modern template | No | No | Yes | No | No | Very shallow, wrong tier placement |
| `E-DBG-1/.../effective-debug.mdx` | No modern template | No | No | No | No | No | Reads like notes, not instruction |

Conclusion:
- The modern template is present in pockets, not yet the default.
- The biggest drop-off is in advanced leaf pages and expert support pages.
- "Lab" often means an inline block of prose, not a discoverable runnable experience.

### 2. Actionable Learning and Debug Teaching

Current strength:
- Interview framing is present in some of the better Tier 2 pages.
- Some modules explain classic failure signatures well, such as missing `item_done()` or null virtual interfaces.

Current weakness:
- The curriculum overwhelmingly teaches constructs and architecture, not debug workflow.
- Explicit failure-mode sections are nearly absent.
- Debug triage is not normalized as a lesson primitive outside a few isolated examples.

Repository-level evidence:
- Explicit `Failure Mode` sections: effectively none
- Explicit `Debug Triage` sections: 1

High-value topics that still need debug-first teaching:
- `I-UVM-2C_Configuration_and_Resources`: null VIF, wildcard collision, scope mismatch, runtime overwrite races
- `I-SV-5_Synchronization_and_IPC`: deadlock, lost event pulses, mailbox backlog, semaphore key leaks
- `A-UVM-4A/A-UVM-4B`: mirror drift, adapter mismatch, predictor not connected, stale desired/mirrored values
- `E-CUST-1_UVM_Methodology_Customization`: phase insertion failure, inconsistent config seeding, methodology drift between teams
- `E-SOC-1_SoC-Level_Verification_Strategies`: active/passive misconfiguration, firmware/UVM handshake mismatches, cross-fabric observability gaps

### 3. Tone and Consistency

What is consistent:
- The stronger modernized pages use confident engineering language, concrete examples, and practical analogies.
- Tier 1 and some Tier 2 indices feel authored as a structured learning system.

What is inconsistent:
- Many leaf pages fall back to generic `Level 1 / Level 2 / Level 3` exposition.
- Some expert pages read like short wiki entries or internal notes.
- Tone shifts from polished coaching to generic summary page depending on file generation era.
- Foundational naming itself is inconsistent: the `F2C` and `F2D` folders still carry `F3A` and `F3D` titles/flashcards, which makes the curriculum look partially migrated rather than intentionally designed.

Evidence:
- `content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx:2`
- `content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index.mdx:2`
- `content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc.mdx:2`

## Phase 3: Learning Path, Structure, and Logical Linking

### 1. Curriculum Taxonomy Issues

Confirmed taxonomy problems:
- **IPC duplication across tiers:** `F2D_Reusable_Code_and_Parallelism/ipc.mdx` already teaches mailboxes and semaphores and hosts the `MailboxSemaphoreGame`, while `I-SV-5_Synchronization_and_IPC` exists as a deeper Tier 2 track with no dedicated track interactive. The current split creates redundancy and weakens the intermediate track.
- **DPI is misplaced:** `E-INT-1_Integrating_UVM_with_Formal_Verification/dpi.mdx` is an SV foreign-language interface topic, not a formal-integration subtopic.
- **PSS is loosely placed:** `pss.mdx` under formal integration is more of a methodology/platform-stimulus topic than a formal lesson.
- **Reusable VIP is misplaced:** `E-DBG-1_Advanced_UVM_Debug_Methodologies/reusable-vip.mdx` belongs under methodology customization or SoC/VIP reuse, not debug.
- **Coverage closure page is not SoC-specific enough:** `E-SOC-1/.../coverage-closure.mdx` reads like a generic coverage note, not a SoC verification strategy lesson.
- **Tier naming debt persists in foundational modules:** `F2C` and `F2D` still expose `F3A`/`F3D` titles and flashcard IDs.

### 2. Prerequisite Chain Assessment

Mostly coherent:
- `I-UVM-1A -> I-UVM-1B -> I-UVM-1C -> I-UVM-2A -> I-UVM-2B -> I-UVM-2C -> I-UVM-3A -> I-UVM-3B` is a sensible UVM flow.
- `I-SV-1 -> I-SV-2A -> I-SV-2B -> I-SV-3A -> I-SV-3B -> I-SV-4A -> I-SV-4B` is also broadly coherent.

Where the chain breaks:
- Stale next-links point learners to removed or renamed modules.
- Expert modules assume closure infrastructure that has not been taught earlier at sufficient depth.
- The advanced coverage track is too thin to support later expert coverage-closure discussions.
- The formal-integration track assumes mature assertion packaging and counterexample replay workflows that the earlier SVA path does not yet fully teach.

Concrete broken examples:
- `content/curriculum/T2_Intermediate/I-SV-4B_Advanced_Temporal_Logic/index.mdx:23` -> points to removed `I-UVM-1_UVM_Intro`
- `content/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/index.mdx:18` -> points to removed `I-SV-4A_Assertions_SVA_Fundamentals`
- `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index.mdx:20` -> points to removed `I-SV-4A_Assertions_SVA_Fundamentals`
- `content/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/immediate-vs-concurrent.mdx:37` -> points to removed `I-SV-4B_Advanced_SVA`
- `content/curriculum/T1_Foundational/F2B_Dynamic_Structures/index.mdx:89` -> points to non-existent `F2C_Operators_and_Expressions`

### 3. Navigation and Interlinking

What works:
- There are some meaningful intra-curriculum links between randomization, coverage, TLM analysis fabric, and sequencing.
- Better pages do attempt to pull learners forward into adjacent modules.

What does not work:
- A noticeable set of links still reference pre-split path names.
- Several conceptual mentions are not linked back to the canonical lesson.
- `uvm_config_db` is referenced in expert modules but those mentions do not point back to `I-UVM-2C`.
- The curriculum does not appear to use a disciplined canonical-linking pattern for recurring concepts.

Examples of weak interlinking:
- `E-CUST-1_UVM_Methodology_Customization/index.mdx` uses `uvm_config_db` but does not link to `I-UVM-2C`.
- `E-SOC-1_SoC-Level_Verification_Strategies/index.mdx` uses `uvm_config_db` and active/passive reuse ideas without linking back to config or component-role lessons.
- The foundational lab READMEs still refer to legacy module names like `F2_SystemVerilog_Basics` and generic `F4` content rather than current canonical paths.
  - Evidence: `labs/simple_dut/lab1_first_tb/README.md:5`, `:12`, `:41`

### 4. Lab and Interactive Mapping

#### Lab discoverability

This is one of the largest structural gaps in the repository.

Facts from the scan:
- Root lab folders: `9`
- Embedded `content/curriculum/labs` folders: `3`
- Curriculum references to `/practice/lab/...`: `0`
- Curriculum references to actual lab folder names/IDs: `0`

Platform reality:
- `src/app/practice/lab/[labId]/page.tsx:4-32` serves a hard-coded `My First Lab` object regardless of `labId`.
- `src/app/api/labs/run/route.ts:3-30` only validates a trivial regex-based demo for lab `1`.
- `src/components/practice/PracticeHub.tsx` lists exercises, animations, diagrams, charts, and tools, but no real curriculum labs.

Implication:
- Most labs currently exist as repository assets or README exercises, not as integrated learner experiences.
- The curriculum often claims to have labs, but from a learner-discoverability perspective the mapping is effectively missing.

Likely orphaned labs:
- `content/curriculum/labs/coverage_advanced/lab1_state_machine_bug_hunt`
- `content/curriculum/labs/randomization_advanced/lab1_dependent_fields`
- `content/curriculum/labs/uvm_performance/lab1_bottleneck`
- plus the root `labs/...` corpus

#### Interactive mapping

Good news:
- The main curriculum-specific interactive components appear to be wired into lessons.
- Examples: `ConstraintSolverVisualizer`, `FactoryOverrideVisualizer`, `TemporalLogicExplorer`, `TLMPortConnector`, `VirtualSequencerExplorer`, `RALPredictorVisualizer`, `EventSchedulerVisualizer`, `DebuggingSimulator`.

Weaknesses:
- Some important interactives are placed in the wrong pedagogical tier. Example: `MailboxSemaphoreGame` is only embedded in foundational `F2D/ipc.mdx`, not in the canonical intermediate IPC track.
- Several broader verification diagrams/visualizers appear unused by curriculum or practice routes in a best-effort search:
  - `src/components/diagrams/UvmFactoryWorkflowVisualizer.tsx`
  - `src/components/diagrams/UvmPhasingInteractiveTimeline.tsx`
  - `src/components/diagrams/UvmSequenceFlowDiagram.tsx`
  - `src/components/diagrams/UvmTestbenchVisualizer.tsx`
  - `src/components/diagrams/InteractiveCdcSketches.tsx`
  - `src/components/visuals/OperatorVisualizer.tsx`

Implication:
- The repository has enough visual assets to feel premium, but the learning-path mapping is incomplete. The problem is not asset scarcity; it is orchestration and integration.

## Critical Gaps and Inaccuracies

### Missing or underrepresented LRM topics
- SystemVerilog Clause 17 checkers as a first-class lesson
- Compiler directives and macro hygiene
- Generate/elaboration semantics versus runtime control flow
- DPI at production depth, including marshaling, context/pure function rules, memory ownership, and simulator blocking behavior
- VPI/PLI and assertion/coverage APIs
- `randcase`, `randsequence`, `std::randomize()`, random stability/reproducibility
- Coverage APIs, UCIS-style workflows, automated closure loops, and coverage database querying
- UVM policy classes (`uvm_printer`, `uvm_comparer`, `uvm_packer`, `uvm_recorder`, `uvm_copier`)
- UVM recording classes and transaction recording workflows
- UVM container classes (`uvm_pool`, `uvm_queue`)
- UVM TLM2 and a clearer distinction from the current TLM1-oriented lessons
- Deeper RAL topics: memories, multi-map usage, volatile behavior, sideband updates, `set_auto_predict`, mirror strategy tradeoffs

### Confirmed factual errors or misleading explanations
- Misstated analysis export/imp relationships in `I-UVM-2B`
- Misuse of `uvm_tlm_analysis_fifo` as a driver-sequencer decoupling recommendation in `I-UVM-2B`
- Oversimplified and partially misleading config precedence rules in `I-UVM-2C`
- Mailbox/TLM FIFO broadcast conflation in `I-SV-5/mailboxes`
- Invalid priority API guidance in `I-UVM-3B/sequence-libraries`
- Incorrect callback API classification as system tasks in `A-UVM-5`

## Structural and Taxonomy Recommendations

1. Re-home SV foreign-interface content.
   Move DPI out of `E-INT-1` and create a dedicated SystemVerilog API/foreign-interface track. Treat PSS separately as methodology/platform stimulus, not formal.

2. Consolidate and tier the IPC story intentionally.
   Keep Tier 1 focused on intuition and race awareness; make `I-SV-5` the real canonical IPC module with deadlock labs, mailbox backpressure cases, and UVM bridging.

3. Re-home `reusable-vip.mdx` and strengthen SoC/module-methodology structure.
   VIP reuse belongs in `E-CUST-1` or `E-SOC-1`, not `E-DBG-1`.

4. Split expert strategy pages into real lessons or merge them into stronger canonical pages.
   `effective-debug.mdx`, `coverage-closure.mdx`, `regression-triage.mdx`, `pss.mdx`, and `dpi.mdx` are too short to stand alone in their current form.

5. Repair foundational numbering and migration debt.
   Align `F2C`/`F2D` folder names, titles, flashcards, and next-links. Right now the foundational tier visibly exposes the migration scar tissue.

6. Establish canonical concept back-links.
   Every occurrence of `uvm_config_db`, analysis ports, objections, coverage closure, and virtual sequencers in higher tiers should link back to the canonical lesson that teaches it.

7. Make labs a first-class content primitive.
   Each major module should have a concrete lab ID, route, and discoverability rule. README-only labs should be treated as incomplete, not complete.

8. Use a consistent lesson contract for leaf pages.
   Quick Take -> Mental Model -> Failure Mode/Debug Triage -> Interactive -> Lab -> Assessment -> References/Next.

## Modernization Backlog (Actionable Tasks)

| Priority | ID | Area | Action | Done When |
| --- | --- | --- | --- | --- |
| P0 | AUD-001 | Labs platform | Replace the placeholder lab system with a real registry that maps curriculum modules to actual lab assets in `labs/` and `content/curriculum/labs/`. | `/practice/lab/[labId]` resolves real labs, the API validates real exercises, and at least the existing 12 lab folders are discoverable from curriculum pages. |
| P0 | AUD-002 | Navigation | Repair stale links and canonical names across the curriculum. | All links to removed paths (`I-UVM-1_UVM_Intro`, `I-SV-4A_Assertions_SVA_Fundamentals`, `I-SV-4B_Advanced_SVA`, `F2C_Operators_and_Expressions`, `F2_SystemVerilog_Basics`) are eliminated and replaced with working canonical routes. |
| P0 | AUD-003 | Tier 1 migration debt | Rename/relabel the foundational `F2C` and `F2D` modules so titles, flashcards, next-links, and folder meaning align. | No foundational page presents `F3A/F3D` titles from inside `F2C/F2D` folders; the learner-facing path is consistent. |
| P0 | AUD-004 | I-SV-5 | Modernize `I-SV-5_Synchronization_and_IPC` into the canonical IPC module. Move or duplicate `MailboxSemaphoreGame` into this track, add a deadlock/backpressure lab, and add explicit failure-mode triage. | The track has a dedicated interactive, a real lab, and sections on lost pulses, deadlock, semaphore leaks, and mailbox overflow/backpressure debugging. |
| P0 | AUD-005 | I-UVM-2C | Rewrite `I-UVM-2C_Configuration_and_Resources` for clause-accurate precedence, wildcard resolution, runtime set behavior, and resource-db nuance. Add a `ConfigDbExplorer` interactive and null-VIF lab. | The page includes accurate precedence rules, a path-resolution visualizer, and a runnable debug lab. |
| P0 | AUD-006 | I-UVM-2B | Correct the TLM lesson technically and expand it with a monitor/scoreboard decoupling lab. | Port/export/imp terminology is correct, analysis FIFO guidance is accurate, and learners can practice a real connection/debug workflow. |
| P0 | AUD-007 | SVA | Create `I-SV-4C_Checkers` and expand advanced assertion scheduling coverage. | Checkers, bind strategy, deferred assertions, event-region reasoning, and practical assertion-debug triage are taught coherently. |
| P0 | AUD-008 | DPI/VPI | Move DPI out of `E-INT-1`, then expand it into a production-grade API lesson. | DPI has a dedicated module with marshaling, context/pure rules, blocking pitfalls, C boundary ownership, and at least one realistic lab/demo. |
| P1 | AUD-009 | Advanced coverage | Expand `I-SV-3B_Advanced_Functional_Coverage` beyond its current single thin deep-dive. | The track includes coverage APIs, closure dashboards, UCIS/reporting concepts, targeted stimulus loops, and a real closure lab. |
| P1 | AUD-010 | Advanced randomization | Extend `I-SV-2B` with `randcase`, `randsequence`, `std::randomize()`, and reproducibility/seed-debug guidance. | Learners can explain solver strategy choices and debug random stability issues, not just write constraints. |
| P1 | AUD-011 | RAL | Deepen `A-UVM-4A/A-UVM-4B` with memories, multi-map behavior, volatile/W1C/W1S semantics, explicit `set_auto_predict` strategy, and a mirror-drift lab. | RAL moves from conceptual overview to environment-debug readiness. |
| P1 | AUD-012 | UVM policy classes | Create a dedicated lesson for policy classes (`printer`, `comparer`, `packer`, `recorder`, `copier`). | Learners can see the same object under different policies and know when to customize each. |
| P1 | AUD-013 | UVM containers | Create a lesson for `uvm_pool` and `uvm_queue`, contrasted against native SV containers. | The lesson includes a comparison lab showing when UVM containers help and when native SV is better. |
| P1 | AUD-014 | UVM recording | Create a recording/transaction-recording lesson connected to the debug telemetry architecture. | Learners can wire `uvm_recorder` or equivalent recording flow into debug/trace pipelines. |
| P1 | AUD-015 | Expert tier cleanup | Re-home or merge thin expert pages (`reusable-vip`, `coverage-closure`, `regression-triage`, `pss`, `effective-debug`) into stronger canonical modules. | Expert pages are either real lessons with labs and interactives or supporting sections inside better parent modules. |
| P1 | AUD-016 | SoC path | Add a real SoC bring-up lab and VIP topology interactive to `E-SOC-1`. | SoC verification teaches active/passive reuse, firmware/UVM synchronization, and observability through runnable examples. |
| P2 | AUD-017 | Compiler/elaboration topics | Add a SystemVerilog lesson covering directives, include/macro hygiene, and generate/elaboration semantics. | Learners can distinguish preprocessor, elaboration, and runtime behavior using code and an interactive visualizer. |
| P2 | AUD-018 | Orphaned visuals | Audit unused diagrams/visualizers and either map them into curriculum/practice or remove/archive them. | Every verification-themed visual asset has a clear learning-path home or is intentionally retired. |
| P2 | AUD-019 | Canonical linking | Implement a repository-wide pass for concept cross-links (`uvm_config_db`, analysis ports, objections, phases, coverage closure, formal replay). | Repeated concepts always link back to their canonical teaching page from higher-tier pages. |

## Recommended Sequence

If this audit is used to drive execution order, the highest-leverage sequence is:
1. Fix labs and navigation first (`AUD-001`, `AUD-002`, `AUD-003`).
2. Repair the most visible intermediate gaps next (`AUD-004`, `AUD-005`, `AUD-006`).
3. Close the biggest standards holes after that (`AUD-007`, `AUD-008`, `AUD-009`, `AUD-010`, `AUD-012`, `AUD-013`, `AUD-014`).
4. Then modernize the thin expert pages into real capstone content (`AUD-015`, `AUD-016`).

## Bottom Line

The repository already contains enough good material and enough visual assets to become an excellent SV/UVM guide. The main problem is not lack of ambition or lack of content volume. The problem is **integration quality**:
- standards coverage is incomplete,
- leaf-page pedagogy is uneven,
- navigation still leaks old structure,
- labs are mostly not wired into the learner experience,
- and several expert pages are still note-length rather than lesson-length.

With the backlog above, the guide can move from "promising modernization in progress" to a coherent, standards-anchored, premium verification curriculum.
