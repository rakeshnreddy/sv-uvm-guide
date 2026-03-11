# SV-UVM Guide Modernization Tracker

This file is the single source of truth for modernization status, ordering, dependencies, and implementation acceptance criteria.

## Tracker Policy

- Update **status only in this file**.
- Treat `comprehensive_lrm_audit_report.md`, `curriculum_modernization_tasks.md`, and `curriculum_audit_findings.md` as **context/evidence**, not live trackers.
- If a supporting document contains an old task ID or an outdated instruction to update that file directly, follow the canonical mapping in this file instead.
- A task remains `todo` until every unchecked deliverable in its task brief is complete.
- When a task creates or modifies curriculum code, the executing agent must run:
  - `npm run generate:curriculum`
  - `npm run lint`
  - `npx vitest --run`
  - targeted Playwright coverage when the task adds or rewires learner-facing routes/interactives

## Status Legend

- `todo`: not complete; eligible for execution
- `blocked`: cannot proceed until dependency or decision is resolved
- `complete`: implementation finished and validated

## Current Baseline

The repository has already completed the major Waves 1-4 structural modernization and several premium-interactive milestones.

Closed baseline work already reflected in the repo:
- Tier 1 foundations split and modernized into `F1A/F1B/F1C`, `F2A/F2B/F2C/F2D`, and `F4A/F4B/F4C`
- Legacy `CURR-REFACTOR-F3` intent is considered structurally landed in the repository; any remaining Tier 1 nomenclature drift is tracked under `W8-T1-NAMING`
- Tier 2 structural splits for `I-SV-1/2/3/4` and `I-UVM-1/2/3`
- Canonical UVM merges into `I-UVM-1B`, `I-UVM-1C`, and `I-UVM-3B`
- Core curriculum interactives: constraint solver, UVM tree, factory override, temporal logic explorer, interview playground
- 3D visualization backlog: mailbox, coverage, analysis, dataflow, constraint, phase timeline
- `E-PERF-1` modernization with `EventSchedulerVisualizer`
- Global cleanup of stale IEEE 1800-2017 references

## Supporting Document Roles

| File | Role | Update Status Here? |
| --- | --- | --- |
| `TASKS.md` | Canonical tracker and execution brief | Yes |
| `comprehensive_lrm_audit_report.md` | Historical architecture rationale and original modernization blueprint | No |
| `curriculum_modernization_tasks.md` | Archived detailed acceptance criteria from earlier planning waves | No |
| `curriculum_audit_findings.md` | 2026-03-06 audit evidence and gap analysis | No |
| `prompt_to_resume_modernization.txt` | Resume-work prompt pointing agents back to this file | Yes, when workflow instructions change |

## Canonical Task Crosswalk

Use this table to translate legacy IDs and audit IDs into the canonical tasks below.

| Canonical ID | Related Legacy / Audit IDs | Notes |
| --- | --- | --- |
| `W5-AUVM4-SPLIT` | `CURR-SPLIT-A-UVM-4`, `CURR-A-UVM-4-SPLIT`, `CURR-A-UVM-4A-LORE`, `CURR-A-UVM-4B-LAB`, `CURR-A-UVM-4-REVIEW`, `AUD-011` | Structural split already exists in the repo; remaining work is depth, interactive, lab, review, and testing. |
| `W5-AUVM3-DEPRECATE` | `CURR-REFACTOR-A-UVM-3`, `CURR-A-UVM-3-MERGE`, `CURR-A-UVM-3-REDIRECT`, `CURR-A-UVM-5-CREATE`, `CURR-A-UVM-3-REVIEW` | Some repo changes landed already; callbacks lesson still needs full completion and correctness pass. |
| `W6-ISV5-MOD` | `CURR-W6-ISV5`, `AUD-004` | Canonical IPC/deadlock modernization task. |
| `W6-IUVM2C-MOD` | `CURR-W6-IUVM2C`, `AUD-005` | Canonical config-db/resource-db modernization task. |
| `W6-ECUST1-MOD` | `CURR-W6-ECUST1` | Expert methodology modernization. |
| `W6-EDBG1-MOD` | `CURR-W6-EDBG1` | Expert debug modernization. |
| `W6-EINT1-MOD` | `CURR-W6-EINT1` | Expert formal-integration modernization; coordinated with `W7-ISV-API`. |
| `W6-ESOC1-MOD` | `CURR-W6-ESOC1`, part of `AUD-015`, `AUD-016` | Expert SoC modernization and SoC-specific practice/lab work. |
| `W7-ISV-CHECKERS` | `CURR-W7-ISV-CHECKERS`, `AUD-007` | New dedicated checkers lesson. |
| `W7-ISV-DIRECTIVES` | `CURR-W7-ISV-DIRECTIVES`, `AUD-017` | Directives/generate/elaboration semantics track. |
| `W7-ISV-API` | `CURR-W7-ISV-API`, `AUD-008` | Dedicated DPI/VPI/API expansion task. |
| `W7-IUVM-POLICY` | `CURR-W7-IUVM-POLICY`, `AUD-012` | New UVM policy-classes lesson. |
| `W7-IUVM-CONTAINER` | `CURR-W7-IUVM-CONTAINER`, `AUD-013` | New UVM container-classes lesson. |
| `W7-IUVM-RECORDING` | `CURR-W7-IUVM-RECORDING`, `AUD-014` | New UVM recording-classes lesson. |
| `W8-LABS-PLATFORM` | `AUD-001` | New planning task created from the 2026 audit. |
| `W8-NAV-CLEANUP` | `AUD-002` | New planning task created from the 2026 audit. |
| `W8-T1-NAMING` | `CURR-REFACTOR-F3`, `AUD-003` | Residual Tier 1 naming cleanup after the historical F3 consolidation. |
| `W8-IUVM2B-CORRECTNESS` | `AUD-006` | New planning task created from the 2026 audit. |
| `W8-ISV2B-DEEPEN` | `AUD-010` | New planning task created from the 2026 audit. |
| `W8-ISV3B-DEEPEN` | `AUD-009` | New planning task created from the 2026 audit. |
| `W8-EXPERT-CLEANUP` | `AUD-015` | Final expert-tier taxonomy and page-ownership cleanup after W6/W7 content lands. |
| `W8-ASSET-MAPPING` | `AUD-018` | Unused/orphaned visuals and diagrams mapping sweep. |
| `W8-CONCEPT-LINKS` | `AUD-019` | Canonical concept-linking sweep after content work stabilizes. |

## Active Backlog Summary

Execute tasks in this order unless the user explicitly reprioritizes.

| Order | ID | Priority | Status | Depends On | Summary |
| --- | --- | --- | --- | --- | --- |
| 1 | `W8-LABS-PLATFORM` | P0 | `complete` | none | Replace the placeholder lab runner with a real curriculum lab catalog and routing system. |
| 2 | `W8-NAV-CLEANUP` | P0 | `complete` | none | Repair stale routes, broken next-links, and obsolete path references across curriculum and lab docs. |
| 3 | `W8-T1-NAMING` | P0 | `complete` | `W8-NAV-CLEANUP` | Resolve foundational numbering/title/flashcard mismatches and legacy Tier 1 naming drift. |
| 4 | `W8-IUVM2B-CORRECTNESS` | P0 | `complete` | `W8-LABS-PLATFORM` | Correct the TLM lesson technically and add a proper monitor/scoreboard decoupling workflow. |
| 5 | `W6-IUVM2C-MOD` | P0 | `todo` | `W8-LABS-PLATFORM` | Modernize configuration/resources with accurate precedence, interactive visualization, and debug lab. |
| 6 | `W6-ISV5-MOD` | P0 | `todo` | `W8-LABS-PLATFORM` | Make `I-SV-5` the canonical IPC module with dedicated interactive and deadlock lab. |
| 7 | `W8-ISV2B-DEEPEN` | P1 | `todo` | none | Deepen advanced constrained-randomization beyond current basics. |
| 8 | `W8-ISV3B-DEEPEN` | P1 | `todo` | none | Deepen advanced coverage into APIs, closure loops, and real closure practice. |
| 9 | `W5-AUVM4-SPLIT` | P1 | `todo` | `W8-LABS-PLATFORM` | Finish the advanced RAL split with the missing hierarchy visual, mirror-bug lab, and deeper RAL treatment. |
| 10 | `W5-AUVM3-DEPRECATE` | P1 | `todo` | `W5-AUVM4-SPLIT` | Finish callback extraction/review and fully retire advanced redundancy from `A-UVM-3`. |
| 11 | `W6-EDBG1-MOD` | P1 | `todo` | `W8-LABS-PLATFORM` | Turn the debug module into a real telemetry/debug workflow with lab and visualizer. |
| 12 | `W6-EINT1-MOD` | P1 | `todo` | `W7-ISV-API`, `W8-LABS-PLATFORM` | Keep formal-integration focused on formal and remove misplaced API/methodology content. |
| 13 | `W6-ECUST1-MOD` | P1 | `todo` | `W8-LABS-PLATFORM` | Modernize methodology customization with custom-phase teaching and a schedule-injection lab. |
| 14 | `W6-ESOC1-MOD` | P1 | `todo` | `W8-LABS-PLATFORM` | Add SoC bring-up practice, VIP topology visualization, and SoC-specific reuse/debug workflows. |
| 15 | `W7-ISV-CHECKERS` | P1 | `todo` | none | Create a dedicated checkers lesson and integrate it with the SVA path. |
| 16 | `W7-ISV-DIRECTIVES` | P1 | `todo` | none | Create the directives/generate track with elaboration-vs-runtime teaching. |
| 17 | `W7-ISV-API` | P1 | `todo` | none | Create a dedicated DPI/VPI/API track and move DPI ownership out of formal integration. |
| 18 | `W7-IUVM-POLICY` | P1 | `todo` | none | Add the missing UVM policy-classes lesson. |
| 19 | `W7-IUVM-CONTAINER` | P1 | `todo` | none | Add the missing UVM container-classes lesson. |
| 20 | `W7-IUVM-RECORDING` | P1 | `todo` | `W6-EDBG1-MOD` | Add the missing UVM recording-classes lesson tied to debug telemetry architecture. |
| 21 | `W8-EXPERT-CLEANUP` | P2 | `todo` | `W6-EDBG1-MOD`, `W6-EINT1-MOD`, `W6-ESOC1-MOD`, `W7-ISV-API` | Re-home thin expert pages and normalize ownership after W6/W7 content work lands. |
| 22 | `W8-ASSET-MAPPING` | P2 | `todo` | `W5-AUVM4-SPLIT`, `W6-ECUST1-MOD`, `W6-ESOC1-MOD` | Map or retire unused verification visuals/diagrams. |
| 23 | `W8-CONCEPT-LINKS` | P2 | `todo` | all content tasks above | Run a final canonical concept-linking pass across the curriculum. |

## Detailed Task Briefs

### `W8-LABS-PLATFORM`
- Priority: P0
- Status: `complete`
- Depends On: none
- Related IDs: `AUD-001`
- Primary surfaces: `src/app/practice/lab/[labId]/page.tsx`, `src/app/practice/lab/[labId]/LabClientPage.tsx`, `src/app/api/labs/run/route.ts`, `src/components/practice/PracticeHub.tsx`, `labs/`, `content/curriculum/labs/`
- Problem statement: The repo contains 12 lab folders, but the learner-facing platform still serves a hard-coded demo lab and the curriculum cannot deep-link to real labs.
- Scope:
  1. Define one canonical lab metadata model: lab ID, title, owning module, route slug, prerequisites, asset location, readiness status, and grader/runtime type.
  2. Decide how root `labs/` and `content/curriculum/labs/` coexist. Either unify them under one index or deliberately classify them (for example: production labs vs embedded content labs) without leaving orphaned folders.
  3. Replace the placeholder demo lab route with data-driven loading by `labId`.
  4. Extend the practice hub so labs are first-class items, not absent from discovery.
  5. Provide a mapping convention so curriculum MDX pages can link to labs consistently.
- Deliverable checklist:
  - [x] Canonical lab ID scheme is documented in code/docs.
  - [x] Existing lab folders are indexed and discoverable.
  - [x] `practice/lab/[labId]` renders real lab metadata instead of `My First Lab`.
  - [x] The API can validate or dispatch real lab steps for at least the first migrated labs.
  - [x] `PracticeHub` exposes labs explicitly.
  - [x] Curriculum pages can deep-link to labs via stable routes.
- Validation:
  - Regenerate curriculum data.
  - Add/extend route tests for at least one real lab.
  - Verify no curriculum lab link lands on the placeholder demo.

### `W8-NAV-CLEANUP`
- Priority: P0
- Status: `todo`
- Depends On: none
- Related IDs: `AUD-002`
- Primary surfaces: curriculum MDX files, lab READMEs, any route redirects or curriculum-data generators that still mention removed paths
- Problem statement: The audit found stale links to removed or renamed modules (`I-UVM-1_UVM_Intro`, `I-SV-4A_Assertions_SVA_Fundamentals`, `I-SV-4B_Advanced_SVA`, `F2C_Operators_and_Expressions`, `F2_SystemVerilog_Basics`). These break learner flow.
- Scope:
  1. Scan and repair stale internal links in curriculum MDX and lab READMEs.
  2. Normalize next-topic links to canonical current routes.
  3. Update any route-level redirect logic if the repo still needs compatibility redirects.
  4. Verify no modernized page points back to removed split predecessors.
- Deliverable checklist:
  - [x] Known broken links from the 2026 audit are fixed.
  - [x] Lab READMEs stop pointing to deleted legacy lesson names.
  - [x] Canonical next-topic flow matches the current curriculum structure.
  - [x] Redirect coverage is intentional rather than accidental.
- Validation:
  - Run a repository-wide link/path grep for known stale route strings.
  - Run targeted Playwright or link-audit coverage for updated pages.

### `W8-T1-NAMING`
- Priority: P0
- Status: `todo`
- Depends On: `W8-NAV-CLEANUP`
- Related IDs: `CURR-REFACTOR-F3`, `AUD-003`
- Primary surfaces: `content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/*`, `content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/*`, associated flashcard identifiers, lab README references
- Problem statement: Foundational modules still expose `F3A`/`F3D` titles and flashcard IDs from an older taxonomy, which makes Tier 1 look partially migrated.
- Scope:
  1. Align folder names, titles, descriptions, flashcard IDs, and next-topic links for `F2C` and `F2D`.
  2. Decide whether the learner-facing taxonomy should explicitly preserve an `F3` concept or fully collapse it into the current `F2` structure; then update all references consistently.
  3. Update Tier 1 lab READMEs so prerequisites and "going further" sections reference current canonical module names.
- Deliverable checklist:
  - [x] `F2C` no longer presents itself as `F3A`.
  - [x] `F2D` no longer presents itself as `F3D` or mixed `F3E` flashcard lineage.
  - [x] Tier 1 READMEs reference current module names only.
  - [x] The foundational sequence reads as intentional, not half-migrated.
- Validation:
  - Search for `F3A`, `F3D`, `F3E`, `F2_SystemVerilog_Basics`, and other legacy Tier 1 labels after the pass.

### `W8-IUVM2B-CORRECTNESS`
- Priority: P0
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `AUD-006`
- Primary surfaces: `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx`, associated exercises/lab assets, TLM diagrams/interactives
- Problem statement: The current TLM lesson contains several technically misleading statements around analysis export/imp roles and FIFO placement.
- Scope:
  1. Correct the explanation of `uvm_analysis_port`, `uvm_analysis_export`, `uvm_analysis_imp`, and subscriber patterns.
  2. Separate sequence-driver handshake material from analysis-fabric decoupling material.
  3. Add a concrete monitor -> analysis FIFO -> scoreboard design example and associated debug/failure-mode walkthrough.
  4. Add a real lab or exercise focused on diagnosing bad TLM wiring or missing scoreboard decoupling.
- Deliverable checklist:
  - [ ] Terminal analysis subscriber patterns are explained correctly.
  - [ ] `uvm_tlm_analysis_fifo` is taught in the correct architectural place.
  - [ ] The page includes at least one failure-mode/debug walkthrough.
  - [ ] Learners can practice a connection/debug scenario through a lab or exercise.
- Validation:
  - Review terminology against IEEE 1800.2-2020 Clause 12.
  - Add/extend tests for any new exercise/lab route.

### `W6-IUVM2C-MOD`
- Priority: P0
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-IUVM2C`, `AUD-005`
- Primary surfaces: `content/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index.mdx`, new `ConfigDbExplorer.tsx`, new config debug lab assets
- Problem statement: The module exists, but it needs standards-accurate precedence teaching, better visual explanation, and a real debug lab.
- Scope:
  1. Ground the lesson explicitly in IEEE 1800.2-2020 Clause 23.
  2. Teach `set()`/`get()` resolution with correct hierarchy and runtime semantics, including wildcard risk and `resource_db` nuance.
  3. Add `ConfigDbExplorer.tsx` to visualize path matching and precedence.
  4. Add a null virtual interface debugging lab.
  5. Add failure-mode triage for typo bugs, wildcard collisions, and late runtime overrides.
- Deliverable checklist:
  - [ ] Clause 23 anchoring is explicit and accurate.
  - [ ] The precedence explanation includes runtime/default-precedence nuance.
  - [ ] `ConfigDbExplorer.tsx` exists and is embedded.
  - [ ] A real null-VIF debug lab is linked from the lesson.
  - [ ] The lesson includes explicit failure/debug guidance, not only syntax.
- Validation:
  - Unit-test the visualizer.
  - Add a route smoke/E2E check for the lesson or lab.

### `W6-ISV5-MOD`
- Priority: P0
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-ISV5`, `AUD-004`
- Primary surfaces: `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/*`, `src/components/visuals/MailboxSemaphoreGame.tsx`, new IPC lab assets
- Problem statement: The IPC material exists, but the track is weaker than the foundational introduction. The key interactive sits in the wrong tier and there is no canonical deadlock lab.
- Scope:
  1. Make `I-SV-5` the canonical intermediate IPC module.
  2. Move or intentionally duplicate `MailboxSemaphoreGame` into `I-SV-5` and keep Tier 1 as the lightweight introduction.
  3. Add a deadlock/backpressure lab (for example dining philosophers, lost semaphore key, or mailbox overflow/backlog).
  4. Expand the track with explicit failure modes: lost event pulses, `->` vs `->>`, deadlock, semaphore leaks, mailbox growth.
  5. Add stronger UVM-bridge guidance where raw SV IPC transitions into UVM synchronization/dataflow patterns.
- Deliverable checklist:
  - [ ] `I-SV-5` has a dedicated embedded interactive.
  - [ ] The track contains a real lab.
  - [ ] Clause 15 anchoring is clear across the track.
  - [ ] Failure-mode/debug triage is explicit.
  - [ ] Tier 1 IPC now clearly points advanced learners into `I-SV-5`.
- Validation:
  - Add tests for the lab route and/or interactive if new logic is introduced.

### `W8-ISV2B-DEEPEN`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `AUD-010`
- Primary surfaces: `content/curriculum/T2_Intermediate/I-SV-2B_Advanced_Constrained_Randomization/*`
- Problem statement: Advanced constrained-randomization is present, but it still misses high-value workplace topics and deeper solver-debug methodology.
- Scope:
  1. Add `randcase`, `randsequence`, and `std::randomize()` use cases.
  2. Add reproducibility/seed stability guidance and practical debug workflows for flaky random bugs.
  3. Expand solver-debug content into a real triage flow, not just a syntax note.
  4. Add or link a lab that forces the learner to debug a randomization failure or biased solution space.
- Deliverable checklist:
  - [ ] `randcase`, `randsequence`, and `std::randomize()` are taught.
  - [ ] Seed stability and replay/debug guidance is explicit.
  - [ ] There is at least one failure-driven exercise or lab.
- Validation:
  - Verify cross-links to coverage and solver-debug exercises.

### `W8-ISV3B-DEEPEN`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `AUD-009`
- Primary surfaces: `content/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/*`
- Problem statement: The advanced coverage track is far too small for its intended role and cannot support later expert coverage-closure content.
- Scope:
  1. Expand beyond V-Plan linking into coverage APIs, querying, dashboard/report workflows, and closure loops.
  2. Add a real closure practice loop: identify uncovered bins, adjust stimulus, and re-run.
  3. Make the track the prerequisite foundation for expert coverage-closure discussion.
- Deliverable checklist:
  - [ ] Advanced coverage is more than a single thin deep-dive.
  - [ ] Coverage APIs/report querying are taught.
  - [ ] The track includes a genuine closure workflow exercise or lab.
  - [ ] Expert pages can link back here as the canonical prerequisite.
- Validation:
  - Verify cross-links into SoC/expert coverage pages.

### `W5-AUVM4-SPLIT`
- Priority: P1
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-SPLIT-A-UVM-4`, `CURR-A-UVM-4-SPLIT`, `CURR-A-UVM-4A-LORE`, `CURR-A-UVM-4B-LAB`, `CURR-A-UVM-4-REVIEW`, `AUD-011`
- Primary surfaces: `content/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals/*`, `content/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/*`, new `RALHierarchy.tsx`, new RAL lab assets
- Problem statement: The repo already contains the split directories, but the task is not functionally done. The missing work is the deeper RAL teaching, the hierarchy visual, the mirror-bug lab, and the final review/test pass.
- Current progress snapshot:
  - [x] `A-UVM-4A_RAL_Fundamentals` exists
  - [x] `A-UVM-4B_Advanced_RAL_Techniques` exists
  - [x] `RALPredictorVisualizer.tsx` is present and embedded in 4B
  - [ ] `RALHierarchy.tsx` does not exist yet
  - [ ] Mirror Bug Lab does not exist yet
  - [ ] 4A still needs richer fundamentals depth
  - [ ] 4B still needs more production-depth on memories, maps, volatile behavior, and mirror strategy
- Scope:
  1. Build `RALHierarchy.tsx` and embed it in 4A.
  2. Strengthen 4A with adapter, map, frontdoor sequence, generation-flow, and RAL object hierarchy teaching.
  3. Strengthen 4B with predictor flow, explicit vs implicit prediction, frontdoor/backdoor tradeoffs, built-in sequences, memories, volatile/W1C/W1S semantics, multi-map concerns, and `set_auto_predict` strategy.
  4. Create `labs/ral_advanced/lab1_mirror_bug` and link it from 4B.
  5. Finish tests, navigation, and route coverage for the split track.
- Deliverable checklist:
  - [ ] `RALHierarchy.tsx` exists and is embedded.
  - [ ] 4A is LRM-anchored and covers core RAL building blocks in depth.
  - [ ] 4B includes realistic prediction/mirror debugging content.
  - [ ] Mirror Bug Lab exists with buggy code, solution, and learner instructions.
  - [ ] Internal links, tests, and curriculum data are updated.
- Validation:
  - Unit-test the new hierarchy visual.
  - Add a lesson route smoke/E2E check for the advanced RAL path.

### `W5-AUVM3-DEPRECATE`
- Priority: P1
- Status: `todo`
- Depends On: `W5-AUVM4-SPLIT`
- Related IDs: `CURR-REFACTOR-A-UVM-3`, `CURR-A-UVM-3-MERGE`, `CURR-A-UVM-3-REDIRECT`, `CURR-A-UVM-5-CREATE`, `CURR-A-UVM-3-REVIEW`
- Primary surfaces: `content/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index.mdx`, redirect config, any surviving references to `A-UVM-3`
- Problem statement: The structural deprecation of `A-UVM-3` is partially in place, but the callbacks lesson still needs to be completed and corrected.
- Current progress snapshot:
  - [x] `A-UVM-3` content was redistributed/deleted
  - [x] redirect work appears to exist
  - [x] `A-UVM-5_UVM_Callbacks` exists
  - [ ] callbacks lesson still needs production-depth and correctness cleanup
  - [ ] callback lab is missing
  - [ ] final redirect/link review is still required
- Scope:
  1. Rewrite `A-UVM-5` into a complete callbacks lesson with accurate API terminology.
  2. Add a real callback lab where a driver behavior is altered without subclass replacement.
  3. Verify redirects, internal links, and any leftover references to `A-UVM-3`.
- Deliverable checklist:
  - [ ] Callback terminology is technically correct.
  - [ ] The lesson explains registration, add/delete behavior, and when callbacks beat factory overrides.
  - [ ] A real callback lab exists.
  - [ ] Old path redirects and internal links are verified.
- Validation:
  - Add redirect verification and route smoke coverage.

### `W6-EDBG1-MOD`
- Priority: P1
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-EDBG1`
- Primary surfaces: `content/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/*`, new `TelemetryEventBusVisualizer.tsx`, debug lab assets
- Problem statement: The expert debug module has a strong index page directionally, but key supporting pages are still note-length and the module lacks a proper telemetry/event-bus visualizer and runnable lab.
- Scope:
  1. Build `TelemetryEventBusVisualizer.tsx` showing structured logs, event bus subscribers, and waveform trigger mapping.
  2. Add a lab where debug events trigger targeted waveform capture.
  3. Expand debug content into a real triage playbook: logs, trace metadata, objection/hang diagnosis, event-bus instrumentation.
  4. Keep the module focused on debug; do not let reusable VIP ownership remain here after expert cleanup.
- Deliverable checklist:
  - [ ] Telemetry visualizer exists and is embedded.
  - [ ] Waveform-trigger lab exists.
  - [ ] Debug content includes failure triage rather than generic advice only.
  - [ ] Module ownership stays centered on debug instrumentation and triage.
- Validation:
  - Unit-test the visualizer.
  - Add route smoke/E2E coverage for the lab and/or visualizer.

### `W6-EINT1-MOD`
- Priority: P1
- Status: `todo`
- Depends On: `W7-ISV-API`, `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-EINT1`
- Primary surfaces: `content/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/*`, new `FormalVsSimulationVisualizer.tsx`, formal lab assets
- Problem statement: The index page has solid high-level intent, but the track is diluted by misplaced DPI/PSS content and lacks a formal-specific visualizer and practice lab.
- Scope:
  1. Build `FormalVsSimulationVisualizer.tsx` to compare simulation waveforms and formal counterexamples.
  2. Add a lab translating a constrained-random scenario into a formal assumption/property harness.
  3. Keep this module focused on formal/simulation interaction.
  4. Coordinate with `W7-ISV-API` so DPI moves out to its own track and `E-INT-1` links to it rather than owning it.
- Deliverable checklist:
  - [ ] Formal vs simulation visualizer exists and is embedded.
  - [ ] Formal assumption/counterexample lab exists.
  - [ ] The module no longer serves as the home for DPI/API content.
  - [ ] Formal prerequisite links and follow-on links are explicit.
- Validation:
  - Add route smoke/E2E coverage for the updated expert path.

### `W6-ECUST1-MOD`
- Priority: P1
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-ECUST1`
- Primary surfaces: `content/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index.mdx`, new `MethodologyPhaseVisualizer.tsx`, methodology lab assets
- Problem statement: The page is one of the stronger expert pages conceptually, but it still lacks the dedicated visual and lab needed to make it implementation-ready.
- Scope:
  1. Build `MethodologyPhaseVisualizer.tsx` around custom phase insertion and scheduling.
  2. Add a lab focused on injecting a custom UVM phase and verifying schedule behavior.
  3. Expand governance content: project-wide base classes, method hooks, phase ownership, migration strategy.
- Deliverable checklist:
  - [ ] Methodology phase visualizer exists.
  - [ ] Custom-phase lab exists.
  - [ ] The module includes real failure scenarios for methodology drift and phase misuse.
- Validation:
  - Unit-test the visualizer.
  - Add route smoke coverage for the lesson/lab.

### `W6-ESOC1-MOD`
- Priority: P1
- Status: `todo`
- Depends On: `W8-LABS-PLATFORM`
- Related IDs: `CURR-W6-ESOC1`, `AUD-016`
- Primary surfaces: `content/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/*`, new `VIPReuseVisualizer.tsx`, SoC bring-up lab assets
- Problem statement: The main SoC page is directionally useful, but the supporting subpages are thin and the module lacks a real SoC bring-up practice path.
- Scope:
  1. Build `VIPReuseVisualizer.tsx` around active/passive topology switching and block-to-SoC reuse.
  2. Add an SoC bring-up lab using passive/active VIP personalities and firmware/UVM coordination.
  3. Strengthen SoC-specific topics: interconnect observability, firmware/UVM handshake, regression telemetry, and bring-up sequencing.
  4. Prepare the module to absorb or supersede generic pages like `coverage-closure.mdx` and `regression-triage.mdx` during `W8-EXPERT-CLEANUP`.
- Deliverable checklist:
  - [ ] VIP reuse visualizer exists.
  - [ ] SoC bring-up lab exists.
  - [ ] SoC-specific reuse/debug/telemetry workflows are explicit.
  - [ ] The module is ready to own SoC-specific supporting material during expert cleanup.
- Validation:
  - Unit-test the visualizer.
  - Add route smoke/E2E coverage for the lab or key updated pages.

### `W7-ISV-CHECKERS`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `CURR-W7-ISV-CHECKERS`, `AUD-007`
- Primary surfaces: new `content/curriculum/T2_Intermediate/I-SV-4C_Checkers/*`, supporting visual or exercise assets
- Problem statement: Clause 17 is cited but not actually taught.
- Scope:
  1. Create a dedicated checkers lesson.
  2. Explain checker composition, bind usage, SVA interplay, and when a checker is the right abstraction.
  3. Add an interactive or lab showing how checkers attach to DUTs without source edits.
- Deliverable checklist:
  - [ ] `I-SV-4C_Checkers` exists.
  - [ ] Checkers are taught as a first-class language construct.
  - [ ] Integration with SVA/bind is explicit.
  - [ ] The lesson includes an interactive or lab.
- Validation:
  - Add route smoke coverage and tests for any new interactive.

### `W7-ISV-DIRECTIVES`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `CURR-W7-ISV-DIRECTIVES`, `AUD-017`
- Primary surfaces: new `content/curriculum/T2_Intermediate/I-SV-6_Compiler_Directives_and_Generates/*`, new generate visualizer
- Problem statement: The curriculum does not currently teach compiler directives or generate/elaboration semantics in a focused way.
- Scope:
  1. Create a module covering directives, include/macro hygiene, and generate constructs.
  2. Build an interactive showing elaboration-time `generate` behavior versus runtime `if` behavior.
  3. Include practical verification usage: feature flags, bench variants, config headers, and macro pitfalls.
- Deliverable checklist:
  - [ ] The new module exists and is linked into the Tier 2 path.
  - [ ] The generate-vs-runtime interactive exists.
  - [ ] Macro/directive hygiene pitfalls are taught explicitly.
- Validation:
  - Unit-test the interactive and add route smoke coverage.

### `W7-ISV-API`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `CURR-W7-ISV-API`, `AUD-008`
- Primary surfaces: new or re-homed API lesson(s) for DPI/VPI, plus updates to `E-INT-1`
- Problem statement: DPI is currently a short page inside the formal module, which is both shallow and taxonomically incorrect.
- Scope:
  1. Create a dedicated SV API/foreign-interface track that owns DPI and future VPI/PLI coverage.
  2. Move DPI ownership out of `E-INT-1` and replace it there with canonical backlinks.
  3. Expand content to production-grade topics: marshaling, `context`/`pure`, memory ownership, blocking behavior, build/link concerns, and common failure modes.
  4. Include at least one practical demo or lab path.
- Deliverable checklist:
  - [ ] A dedicated API lesson path exists.
  - [ ] DPI is no longer misfiled under formal integration.
  - [ ] VPI/PLI/API expansion direction is laid out explicitly.
  - [ ] The content includes practical failure/debug treatment and not just a syntax snippet.
- Validation:
  - Add route smoke coverage and tests for any new interactive/demo.

### `W7-IUVM-POLICY`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `CURR-W7-IUVM-POLICY`, `AUD-012`
- Primary surfaces: new policy-classes lesson, `UvmPolicyVisualizer.tsx`
- Problem statement: Policy classes are a major UVM gap for senior learners.
- Scope:
  1. Teach printer/comparer/packer/recorder/copier classes coherently.
  2. Build `UvmPolicyVisualizer.tsx` so learners can see the same object under different policy behaviors.
  3. Add an exercise or lab using one object through multiple policies.
- Deliverable checklist:
  - [ ] Policy lesson exists.
  - [ ] Visualizer exists.
  - [ ] Learners can compare policy-class roles and customization points.
- Validation:
  - Unit-test the visualizer and add route coverage.

### `W7-IUVM-CONTAINER`
- Priority: P1
- Status: `todo`
- Depends On: none
- Related IDs: `CURR-W7-IUVM-CONTAINER`, `AUD-013`
- Primary surfaces: new container-classes lesson and comparison lab
- Problem statement: `uvm_pool` and `uvm_queue` are not taught at all.
- Scope:
  1. Create a lesson contrasting UVM container classes with native SV queues/associative arrays.
  2. Add a lab demonstrating where UVM containers help and where plain SV is simpler.
- Deliverable checklist:
  - [ ] Container lesson exists.
  - [ ] Comparison lab exists.
  - [ ] Native SV versus UVM tradeoffs are explicit.
- Validation:
  - Add route smoke coverage for the lesson/lab.

### `W7-IUVM-RECORDING`
- Priority: P1
- Status: `todo`
- Depends On: `W6-EDBG1-MOD`
- Related IDs: `CURR-W7-IUVM-RECORDING`, `AUD-014`
- Primary surfaces: new recording-classes lesson, debug telemetry links
- Problem statement: Recording classes are missing, and they should connect naturally to the debug telemetry/event-bus architecture.
- Scope:
  1. Create a dedicated recording-classes lesson.
  2. Show how recording ties into transaction-viewing databases and structured debug flows.
  3. Reuse the debug event-bus architecture from `W6-EDBG1-MOD` where appropriate.
- Deliverable checklist:
  - [ ] Recording lesson exists.
  - [ ] Integration with the debug/telemetry path is explicit.
  - [ ] Vendor-specific viewing/database concepts are taught responsibly without overfitting one tool.
- Validation:
  - Add route smoke coverage and tests for any new visual/demo logic.

### `W8-EXPERT-CLEANUP`
- Priority: P2
- Status: `todo`
- Depends On: `W6-EDBG1-MOD`, `W6-EINT1-MOD`, `W6-ESOC1-MOD`, `W7-ISV-API`
- Related IDs: `AUD-015`
- Primary surfaces: thin expert pages under `E-DBG-1`, `E-INT-1`, and `E-SOC-1`
- Problem statement: Several expert pages are too short to stand alone and/or belong under the wrong parent module.
- Scope:
  1. Re-home `reusable-vip.mdx` out of debug.
  2. Reassess `coverage-closure.mdx` and `regression-triage.mdx` so they either become SoC-specific or merge into stronger parent lessons.
  3. Remove or re-home `pss.mdx` and `dpi.mdx` ownership after the new API track exists.
  4. Ensure expert-tier page ownership is intentional and non-overlapping.
- Deliverable checklist:
  - [ ] Thin expert pages are either expanded, merged, or re-homed.
  - [ ] Debug/formal/SoC modules each own the right concepts.
  - [ ] No expert page remains as a note-length orphan without a rationale.
- Validation:
  - Re-run link and route coverage for all affected expert paths.

### `W8-ASSET-MAPPING`
- Priority: P2
- Status: `todo`
- Depends On: `W5-AUVM4-SPLIT`, `W6-ECUST1-MOD`, `W6-ESOC1-MOD`
- Related IDs: `AUD-018`
- Primary surfaces: verification-themed assets in `src/components/diagrams/`, `src/components/visuals/`, related practice/curriculum routes
- Problem statement: The repo contains useful-looking verification visuals that appear unused by curriculum or practice routes.
- Scope:
  1. Audit each apparently unused verification asset.
  2. Decide whether it should be embedded into curriculum, exposed via practice, or archived/deleted.
  3. Avoid keeping unused premium assets with no roadmap owner.
- Deliverable checklist:
  - [ ] Each currently orphaned verification visual has an owner decision.
  - [ ] Unused assets are either mapped or intentionally retired.
- Validation:
  - Re-run the usage audit after the pass.

### `W8-CONCEPT-LINKS`
- Priority: P2
- Status: `todo`
- Depends On: all content tasks above
- Related IDs: `AUD-019`
- Primary surfaces: curriculum MDX across tiers
- Problem statement: The curriculum does not consistently link recurring concepts back to canonical lessons.
- Scope:
  1. Establish canonical pages for recurring concepts: `uvm_config_db`, analysis ports, objections, phases, coverage closure, formal replay, virtual sequences, etc.
  2. Add consistent back-links from higher-tier mentions to those canonical lessons.
  3. Ensure the final path feels like a graph of reinforcing lessons rather than isolated pages.
- Deliverable checklist:
  - [ ] Canonical pages are defined for repeated concepts.
  - [ ] Higher-tier pages link back to canonical foundations/intermediate lessons.
  - [ ] The curriculum no longer relies on plain-text concept mentions where a canonical link is expected.
- Validation:
  - Run a targeted grep-based audit for major repeated concepts after the pass.

## Agent Handoff Protocol

### Generic Resume Prompt

Users should reuse this file through `prompt_to_resume_modernization.txt`.

### Agent Workflow

If you are the coding agent picking up this work:
1. Read `TASKS.md` first.
2. In `Active Backlog Summary`, find the first row whose status is `todo` and whose dependencies are already satisfied.
3. Read that task's full brief in `Detailed Task Briefs`.
4. Use the `Related IDs` and supporting documents only for deeper context; do **not** update status outside `TASKS.md`.
5. Implement the task, run required validation, then change only that task's status in `TASKS.md` from `todo` to `complete`.
6. If your task unlocks downstream tasks or changes routing/workflow assumptions, update the dependency/order notes in this file before handing off.
7. When yielding, instruct the next session to use `prompt_to_resume_modernization.txt` again.
