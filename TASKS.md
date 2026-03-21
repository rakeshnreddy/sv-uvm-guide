# TASKS.md — sv-uvm-guide Next-Generation Backlog
# Generated: 2026-03-21 | Auditor: Principal Verification Engineer / Technical Curriculum Architect
# Purpose: Machine-readable backlog for autonomous AI coding agent execution.

---

## Active Backlog Summary

| Order | ID | Priority | Status | Depends On | Description |
|---|---|---|---|---|---|
| 1 | INFRA-1-REPO-CLEANUP | P0 | complete | none | Remove stray root-level developer artifacts and move LRM PDFs to git-lfs. |
| 2 | INFRA-2-LABS-DEDUP | P0 | complete | INFRA-1-REPO-CLEANUP | Reconcile dual labs/ directories and fix curriculum data generator path references. |
| 3 | INFRA-3-APPROUTER-MIGRATION | P0 | complete | none | Complete Next.js App Router migration by resolving src/pages/ vs src/app/ coexistence. |
| 4 | CONTENT-1-F3-SCHEDULING | P0 | complete | none | Author the missing F3_* module group: SV Scheduling Semantics, Regions & Delta Cycles. |
| 5 | VIZ-1-SV-SCHEDULER | P0 | complete | CONTENT-1-F3-SCHEDULING | Build SVSchedulerRegionVisualizer.tsx: animated delta-cycle and region stepper. |
| 6 | CONTENT-2-T1T2-BRIDGE | P1 | complete | CONTENT-1-F3-SCHEDULING | Author "Why UVM?" bridge module between I-SV-8 and I-UVM-1A. |
| 7 | VIZ-2-UVM-PHASE-TIMELINE | P0 | complete | none | Build UvmPhaseTimelineVisualizer.tsx: interactive phasing swimlane with click-to-expand. |
| 8 | VIZ-3-TLM-CONNECTION-BUILDER | P0 | todo | none | Build TlmConnectionBuilderVisualizer.tsx: drag-and-drop TLM port/socket wiring. |
| 9 | VIZ-4-FACTORY-OVERRIDE-EXPLORER | P0 | todo | none | Build FactoryOverrideExplorerVisualizer.tsx: live factory registry with override simulation. |
| 10 | VIZ-5-CONSTRAINT-HEATMAP | P1 | todo | none | Build ConstraintSolverHeatmapVisualizer.tsx: distribution heatmap for rand variables. |
| 11 | VIZ-6-SVA-WAVEFORM | P1 | todo | none | Build SvaSequenceWaveformVisualizer.tsx: waveform-style temporal sequence stepper. |
| 12 | VIZ-7-COVERAGE-CROSS-EXPLORER | P1 | todo | none | Build CoverageCrossExplorerVisualizer.tsx: interactive covergroup cross-bin matrix. |
| 13 | VIZ-8-RAL-REGISTER-MAP | P1 | todo | CONTENT-T3-RAL-ENHANCE | Build RalRegisterMapVisualizer.tsx: hierarchical register map with field-level drill-down. |
| 14 | VIZ-9-SEQUENCE-HIERARCHY | P1 | todo | none | Build UvmSequenceHierarchyVisualizer.tsx: collapsible tree of nested sequence invocations. |
| 15 | CONTENT-T3-SCOREBOARD | P0 | complete | none | Author A-UVM-6_Scoreboards_and_Reference_Models module in T3_Advanced. |
| 16 | CONTENT-T3-VIP | P1 | complete | CONTENT-T3-SCOREBOARD | Author A-UVM-7_VIP_Construction module in T3_Advanced. |
| 17 | CONTENT-T3-MULTI-AGENT | P1 | complete | CONTENT-T3-SCOREBOARD | Author A-UVM-8_Multi_Agent_Topologies module in T3_Advanced. |
| 18 | CONTENT-T4-PSS | P0 | complete | none | Author E-PSS-1_Portable_Stimulus_Standard module in T4_Expert. |
| 19 | VIZ-10-PSS-INTENT-MAP | P1 | todo | CONTENT-T4-PSS | Build PssIntentMapVisualizer.tsx: PSS action/resource graph with portability toggle. |
| 20 | CONTENT-T4-PYUVM | P0 | complete | none | Author E-PYUVM-1_Python_Based_Verification module in T4_Expert. |
| 21 | CONTENT-T4-AI-VERIF | P1 | complete | CONTENT-T4-PYUVM | Author E-AI-1_AI_Driven_Verification module in T4_Expert. |
| 22 | CONTENT-T4-RISCV | P1 | complete | none | Author E-RISCV-1_RISC_V_Verification_Methodology module in T4_Expert. |
| 23 | CONTENT-T4-UVM-ML | P2 | complete | CONTENT-T4-PYUVM | Author E-UVM-ML-1_Multi_Language_Verification module in T4_Expert. |
| 24 | CONTENT-T4-EMULATION | P2 | complete | CONTENT-T3-MULTI-AGENT | Author E-EMU-1_Emulation_Aware_Verification module in T4_Expert. |
| 25 | FLASH-1-T3-T4-COVERAGE | P1 | todo | CONTENT-T3-SCOREBOARD | Create flashcard sets for all T3 and new T4 modules. |
| 26 | LAB-1-T3-SCOREBOARD | P1 | todo | CONTENT-T3-SCOREBOARD | Author hands-on lab for scoreboard construction with self-checking assertions. |
| 27 | LAB-2-T4-PSS | P2 | todo | CONTENT-T4-PSS | Author PSS lab: write a portable test intent spec and compile to SV and C. |
| 28 | INFRA-4-VITEST-SUITE | P1 | todo | VIZ-1-SV-SCHEDULER | Write Vitest unit tests for all new visualizer components (VIZ-1 through VIZ-10). |
| 29 | INFRA-5-PLAYWRIGHT-E2E | P2 | todo | INFRA-4-VITEST-SUITE | Write Playwright E2E smoke tests for all new T3/T4 curriculum pages. |
| 30 | INFRA-6-3D-VIZ-PORT | P2 | todo | INFRA-3-APPROUTER-MIGRATION | Port 3dvisualization.html prototype to a proper react-three-fiber component. |

---

## Detailed Task Briefs

---

### `INFRA-1-REPO-CLEANUP`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `3dvisualization.html`
  - `check_pages.js`
  - `comprehensive_lrm_audit_report.md`
  - `curriculum_audit_findings.md`
  - `curriculum_modernization_tasks.md`
  - `prompt_to_resume_modernization.txt`
  - `agent_7_mop_up_and_infrastructure_prompt.md`
  - `system_verilog_lrm.pdf`
  - `uvm_lrm.pdf`
  - `.gitignore`
  - `.gitattributes` (create)
- **Problem statement:** The repository root is polluted with stray developer artifacts (audit reports, agent prompts, prototype HTML) and contains two large PDF files (13+ MB combined) committed directly to git, bloating clone size and poisoning AI coding agent context windows with irrelevant noise.
- **Scope:**
  1. Move `system_verilog_lrm.pdf` and `uvm_lrm.pdf` to `git-lfs` by adding a `.gitattributes` rule (`*.pdf filter=lfs diff=lfs merge=lfs -text`) and running `git lfs track "*.pdf"`.
  2. Move `3dvisualization.html` to `docs/prototypes/3dvisualization.html` to preserve its content for the `INFRA-6-3D-VIZ-PORT` task.
  3. Move `check_pages.js` to `scripts/check_pages.js`.
  4. Create a `docs/archive/` directory and move all `*_audit_report.md`, `*_findings.md`, `*_tasks.md`, `prompt_to_resume_*.txt`, and `agent_*_prompt.md` files into it.
  5. Add `docs/archive/` and `*.pdf` (non-lfs) to `.gitignore`.
  6. Update `README.md` to remove any references to the moved files.
- **Deliverable checklist:**
  - [x] Repo root contains only standard project files (README, LICENSE, config files, package.json, source dirs)
  - [x] `.gitattributes` created with LFS tracking for `*.pdf`
  - [x] `git lfs ls-files` shows both PDFs tracked
  - [x] All stray `.md` artifact files are under `docs/archive/`
  - [x] `check_pages.js` is under `scripts/`
  - [x] `README.md` updated
- **Validation:**
  - `git lfs ls-files` — should list both PDFs
  - `ls -la` at repo root — should show clean directory
  - `npm run build` — should still pass after moves

---

### `INFRA-2-LABS-DEDUP`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `INFRA-1-REPO-CLEANUP`
- **Primary surfaces:**
  - `content/labs/` (entire directory)
  - `content/curriculum/labs/` (entire directory)
  - `labs/` (root-level directory)
  - `scripts/generate-curriculum.ts` (or equivalent)
  - `src/lib/curriculum.ts` (or equivalent data loader)
- **Problem statement:** Three potential `labs/` directories exist at different path levels (`labs/`, `content/labs/`, `content/curriculum/labs/`). This creates ambiguity in the curriculum data generator about which labs are canonical, risks broken links in the rendered app, and breaks the pedagogical loop for any module that references a lab by relative path.
- **Scope:**
  1. Audit all three `labs/` directories and create a mapping of all `.mdx` files found.
  2. Establish `content/curriculum/labs/` as the single canonical location.
  3. Merge any unique lab content from `content/labs/` and root `labs/` into `content/curriculum/labs/`, deduplicating exact copies.
  4. Delete the now-empty `content/labs/` and root `labs/` directories.
  5. Update `scripts/generate-curriculum.ts` (or the equivalent generator script) to use only `content/curriculum/labs/` as its labs source path.
  6. Update `src/lib/curriculum.ts` (or equivalent) data loader to use the canonical path.
  7. Run `npm run generate:curriculum` and verify all lab links resolve correctly.
- **Deliverable checklist:**
  - [x] Only one `labs/` directory exists at `content/curriculum/labs/`
  - [x] No broken lab links in `npm run build` output
  - [x] `npm run generate:curriculum` completes without path-not-found errors
  - [x] All previously-linked labs still resolve in the app
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`
  - `npx playwright test --grep "lab"` (if lab E2E tests exist)

---

### `INFRA-3-APPROUTER-MIGRATION`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/pages/` (entire directory — audit and migrate)
  - `src/app/` (target)
  - `next.config.mjs`
  - Any API routes under `src/pages/api/`
- **Problem statement:** The coexistence of `src/pages/` and `src/app/` indicates an incomplete migration from the Next.js Pages Router to the App Router. This creates routing conflicts, makes RSC (React Server Components) benefits unavailable for migrated pages, and will cause subtle hydration bugs. The App Router is the current standard for Next.js 14/15.
- **Scope:**
  1. Audit every file in `src/pages/` and categorize: page component, API route, or `_app`/`_document` special file.
  2. Migrate each page component to a corresponding `src/app/[route]/page.tsx` file, using RSC where the component has no client-side interactivity, and adding `"use client"` directive where required.
  3. Migrate each API route from `src/pages/api/[name].ts` to `src/app/api/[name]/route.ts` using the Next.js Route Handler format (`GET`, `POST` exports).
  4. Remove `_app.tsx` and `_document.tsx`, incorporating their logic into `src/app/layout.tsx`.
  5. Update `next.config.mjs` to remove any Pages Router-specific configuration.
  6. Delete `src/pages/` once all routes are confirmed working.
- **Deliverable checklist:**
  - [x] `src/pages/` directory no longer exists
  - [x] All routes previously under `src/pages/` are accessible under `src/app/`
  - [x] No Next.js build warnings about mixed router usage
  - [x] `npm run build` exits with code 0
  - [x] All Playwright E2E tests pass after migration
- **Validation:**
  - `npm run build`
  - `npx playwright test`

---

### `CONTENT-1-F3-SCHEDULING`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `content/curriculum/T1_Foundational/F3A_Simulation_Semantics/index.mdx` (create)
  - `content/curriculum/T1_Foundational/F3B_Scheduling_Regions/index.mdx` (create)
  - `content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** The T1_Foundational tier skips from `F2D_Reusable_Code_and_Parallelism` directly to `F4A_Modules_and_Packages`, leaving a complete gap in the `F3_*` numbering group. The missing content — SV simulation semantics, the 4-region scheduler (Active, NBA, Observed, Reactive), and delta cycles — is a critical prerequisite for understanding clocking blocks (`F4C`), and an absolute foundation for all testbench timing discussions in T2 and beyond.
- **Scope:**
  1. Author `F3A_Simulation_Semantics/index.mdx`: Cover the SV event-driven simulation model, time steps, and the distinction between simulation time and delta time. Include a prose explanation and at least 3 annotated SV code examples.
  2. Author `F3B_Scheduling_Regions/index.mdx`: Detail all four standard SV scheduling regions (Active, Inactive, NBA, Observed, Reactive, Re-Inactive, Pre-Active, Pre-NBA). Include a table of which constructs execute in which region. Embed the `<SVSchedulerRegionVisualizer />` MDX component (created in `VIZ-1`). Add a Knowledge Check quiz with 3 questions.
  3. Author `F3C_Delta_Cycles_and_Race_Conditions/index.mdx`: Explain delta cycles with a concrete race-condition example, then show how blocking vs. non-blocking assignments interact with the scheduler. Include a "common bug" callout box. Add 3 flashcard entries.
  4. Update `scripts/generate-curriculum.ts` to include the three new modules in the T1 curriculum manifest, ordered between `F2D` and `F4A`.
  5. Run `npm run generate:curriculum` and verify the three new modules appear in the nav.
- **Deliverable checklist:**
  - [x] `F3A`, `F3B`, `F3C` directories exist under `T1_Foundational/`
  - [x] Each module has a valid `index.mdx` with correct frontmatter (title, tier, order, prerequisites)
  - [x] `F3B` MDX embeds `<SVSchedulerRegionVisualizer />` without render error
  - [x] `F3C` includes at least one race-condition code example
  - [x] Curriculum generator includes all 3 new modules
  - [x] Nav order is: `F2D` → `F3A` → `F3B` → `F3C` → `F4A`
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`
  - Manual navigation to `/curriculum/t1-foundational/f3b-scheduling-regions`

---

### `VIZ-1-SV-SCHEDULER`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `CONTENT-1-F3-SCHEDULING`
- **Primary surfaces:**
  - `src/components/visualizers/SVSchedulerRegionVisualizer.tsx` (create)
  - `src/components/visualizers/SVSchedulerRegionVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register component in MDX map)
- **Problem statement:** Delta cycles and scheduling regions are the single most visually demanding concept in T1. A static text description is pedagogically insufficient — learners need to see transactions moving through the Active → NBA → Observed → Reactive regions in real time, with the ability to step forward/backward and see the signal value at each stage.
- **Scope:**
  1. Create `SVSchedulerRegionVisualizer.tsx` as a `"use client"` React component.
  2. The component renders a horizontal timeline of SV regions (Pre-Active, Active, Inactive, NBA, Observed, Reactive, Re-Inactive) as labeled swim lanes.
  3. Include a hard-coded scenario of a clocked flip-flop with a non-blocking assignment. Buttons: **Play**, **Step Forward**, **Step Backward**, **Reset**.
  4. At each step, animate an arrow/token moving through the relevant region, with a side panel showing current signal values (`q`, `d`, `clk`).
  5. Add a second scenario toggle: **"Race Condition Example"** showing two competing assignments in the Active region.
  6. Use Framer Motion for animations.
  7. Register `SVSchedulerRegionVisualizer` in the MDX component map in `src/app/curriculum/[...slug]/page.tsx`.
  8. Write `SVSchedulerRegionVisualizer.test.tsx` with Vitest + React Testing Library:
     - Test: renders without crashing
     - Test: "Step Forward" button increments internal step state
     - Test: "Reset" button returns to step 0
     - Test: scenario toggle changes displayed scenario label
- **Deliverable checklist:**
  - [x] Component renders in isolation (`npm run dev`)
  - [x] Play/Step/Reset controls function correctly
  - [x] Both scenarios (normal flip-flop and race condition) are implemented
  - [x] Component is registered in MDX component map
  - [x] Vitest test file passes with `npx vitest run`
  - [x] No TypeScript errors (`npx tsc --noEmit`)
- **Validation:**
  - `npx vitest run src/components/visualizers/SVSchedulerRegionVisualizer.test.tsx`
  - `npm run build`

---

### `CONTENT-2-T1T2-BRIDGE`
- **Priority:** P1
- **Status:** `complete`
- **Depends On:** `CONTENT-1-F3-SCHEDULING`
- **Primary surfaces:**
  - `content/curriculum/T2_Intermediate/I-SV-9_Why_UVM/index.mdx` (created — renamed from `I-BRIDGE-0` to `I-SV-9` for correct alphabetical sort order)
  - `scripts/generate-curriculum.ts` (no changes needed — auto-discovers directories)
- **Problem statement:** Learners completing T1 and the SystemVerilog half of T2 (through `I-SV-8`) are cold-dropped into UVM components (`I-UVM-1A`) with no narrative transition. There is no module explaining the testbench scalability problems that UVM was designed to solve (duplication, non-reusability, lack of standardized phasing). This creates motivation failure and confusion about why UVM's complexity is justified.
- **Scope:**
  1. Author `I-SV-9_Why_UVM/index.mdx` as the final pre-UVM module.
  2. Content sections: (a) The Testbench Scaling Problem — illustrate a naive Verilog testbench with hard-coded stimulus, (b) The Reuse Problem — show code duplication across projects, (c) The Standardization Solution — introduce the OVM→UVM historical arc, (d) UVM's Core Value Propositions — factory, phasing, TLM, and sequences as the four pillars, (e) "What You'll Build" — preview of the UVM environment learners will construct across T2-T3.
  3. Include a comparison table: Naive TB vs. UVM TB across dimensions of reusability, configurability, scalability, and debug.
  4. Embedded `<InteractiveUvmArchitectureDiagram />` (already registered in MDX component map).
  5. Curriculum generator auto-discovers directories alphabetically — no manual update needed.
- **Deliverable checklist:**
  - [x] `I-SV-9_Why_UVM/index.mdx` exists with valid frontmatter
  - [x] Comparison table is present
  - [x] `<InteractiveUvmArchitectureDiagram />` is embedded
  - [x] Module appears in nav between `I-SV-8` and `I-UVM-1A`
  - [x] `npm run generate:curriculum` succeeds
- **Validation:**
  - `npm run generate:curriculum` ✅
  - `npm run build` ✅

---

### `VIZ-2-UVM-PHASE-TIMELINE`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/UvmPhaseTimelineVisualizer.tsx` (created)
  - `tests/components/UvmPhaseTimelineVisualizer.test.tsx` (created)
  - `src/app/curriculum/[...slug]/page.tsx` (registered)
  - `content/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index.mdx` (embedded)
- **Problem statement:** UVM phasing (`build_phase` → `connect_phase` → `run_phase` → `extract_phase` etc.) is the second-biggest confusion point after TLM for new UVM engineers. The standard is 12 phases with specific ordering guarantees and parallel execution semantics. No visualizer exists for this critical concept.
- **Scope:**
  1. Created `UvmPhaseTimelineVisualizer.tsx` as a `"use client"` component.
  2. Renders a vertical swimlane diagram: columns = UVM components (uvm_test, uvm_env, uvm_agent, uvm_driver, uvm_monitor), rows = phases in order.
  3. On click of any phase cell, expands a side panel showing: (a) the phase name, (b) which base class defines it, (c) typical operations, (d) a minimal SV code snippet.
  4. Added **"Run Animation"** button that lights up each phase row in sequence with a 600ms delay.
  5. `run_phase` highlighted distinctly with amber border and background.
  6. Added **"Show Custom Phases"** toggle to overlay 9 optional runtime phases.
  7. Embedded `<UvmPhaseTimelineVisualizer />` in `I-UVM-1C_UVM_Phasing/index.mdx`.
  8. Registered in MDX component map.
  9. Wrote 9 Vitest tests covering rendering, animation, cell clicks, custom phases toggle, and reset.
- **Deliverable checklist:**
  - [x] All 12 standard UVM phases rendered in correct order (plus 9 custom)
  - [x] Click-to-expand side panel works for each phase × component cell
  - [x] Animation runs and completes without error
  - [x] Custom phases toggle works
  - [x] Component registered in MDX map
  - [x] Vitest tests pass (9/9)
- **Validation:**
  - `npx vitest run tests/components/UvmPhaseTimelineVisualizer.test.tsx` ✅
  - `npm run build` ✅

---

### `VIZ-3-TLM-CONNECTION-BUILDER`
- **Priority:** P0
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/TlmConnectionBuilderVisualizer.tsx` (create)
  - `src/components/visualizers/TlmConnectionBuilderVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx` (embed)
- **Problem statement:** TLM ports, exports, and `uvm_tlm_fifo` connections are abstract and spatial — learners must understand which side initiates calls and which side implements them. Text descriptions of `uvm_analysis_port`, `uvm_blocking_put_port`, and FIFOs consistently cause confusion. A drag-and-connect visual builder directly addresses this.
- **Scope:**
  1. Create `TlmConnectionBuilderVisualizer.tsx` as a `"use client"` component using React Flow (or a lightweight canvas alternative).
  2. Provide a palette of draggable UVM component nodes: Driver, Monitor, Scoreboard, Coverage, Agent, Sequencer.
  3. Each node has typed ports on its boundary: blue circles = TLM ports (initiator), green circles = TLM exports (responder), orange circles = analysis ports.
  4. Users drag connections between compatible port types. Incompatible connections (e.g., port-to-port) are rejected with a red flash and tooltip error.
  5. A **"Check Connections"** button validates the topology and highlights missing connections in yellow.
  6. A **"Show Solution"** button reveals the canonical agent topology.
  7. Preset scenarios selectable from a dropdown: Basic Agent, Scoreboard Checker, Coverage Collector.
  8. Register in MDX map and embed in `I-UVM-2B`.
  9. Write Vitest tests: node renders, valid connection accepted, invalid connection rejected.
- **Deliverable checklist:**
  - [ ] Draggable component nodes render
  - [ ] Port-type validation rejects incompatible connections
  - [ ] "Check Connections" validation works
  - [ ] "Show Solution" overlay works
  - [ ] All 3 preset scenarios are implemented
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/TlmConnectionBuilderVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-4-FACTORY-OVERRIDE-EXPLORER`
- **Priority:** P0
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/FactoryOverrideExplorerVisualizer.tsx` (create)
  - `src/components/visualizers/FactoryOverrideExplorerVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory/index.mdx` (embed)
- **Problem statement:** The UVM factory's type and instance override mechanism is the most frequently misunderstood advanced feature for new verification engineers. Learners must understand the registry, how `create()` dispatches, and how type overrides propagate down the hierarchy — all of which are impossible to convey with static text alone.
- **Scope:**
  1. Create `FactoryOverrideExplorerVisualizer.tsx` as a `"use client"` component.
  2. Display a default UVM component tree (test → env → agent → driver).
  3. Show a **Factory Registry panel** listing registered types.
  4. Provide a form to apply a **Type Override**: select base type and override type from dropdowns. Apply changes to the tree in real time.
  5. Provide a form to apply an **Instance Override**: specify the full hierarchical path string and the override type.
  6. After overrides are applied, highlight changed nodes in the tree with a different color and badge showing "OVERRIDDEN".
  7. A **"Simulate create()"** button walks through the factory lookup algorithm step by step in a log panel on the right.
  8. Register in MDX map and embed in `I-UVM-1B`.
  9. Vitest tests: initial tree renders correctly, type override updates tree node, instance override at path updates only that node.
- **Deliverable checklist:**
  - [ ] Default component tree renders with all 4 levels
  - [ ] Type override form updates all matching nodes
  - [ ] Instance override form updates only the targeted path node
  - [ ] "Simulate create()" step log shows correct resolution order
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/FactoryOverrideExplorerVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-5-CONSTRAINT-HEATMAP`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/ConstraintSolverHeatmapVisualizer.tsx` (create)
  - `src/components/visualizers/ConstraintSolverHeatmapVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-SV-2A_Constrained_Randomization_Fundamentals/index.mdx` (embed)
- **Problem statement:** Students learning constrained randomization intuitively believe that `rand` variables with more constraints produce more uniform distributions. In reality, constraint interactions can create highly skewed probability distributions that are invisible without visualization. A live heatmap that updates as the user modifies constraints makes this immediately apparent.
- **Scope:**
  1. Create `ConstraintSolverHeatmapVisualizer.tsx` as a `"use client"` component.
  2. Hard-code a simple SV transaction class with two `rand` variables: `addr [0:15]` and `data [0:255]`.
  3. Render a 16×256 heatmap grid (or a downsampled 16×16 version for performance) showing simulated solve probability for each `(addr, data)` pair.
  4. Provide a constraint editor panel with checkboxes to enable/disable pre-written constraints (e.g., `addr inside {[0:3]}`, `data % 2 == 0`, `addr + data < 100`).
  5. When constraints are toggled, recompute the probability distribution (via a JS-side solver simulation) and update the heatmap colors.
  6. Add a bar chart below the heatmap showing the marginal distribution of `addr` values.
  7. Register in MDX map and embed in `I-SV-2A`.
  8. Vitest tests: renders without crash, constraint toggle changes heatmap data array.
- **Deliverable checklist:**
  - [ ] Heatmap renders initial uniform distribution
  - [ ] Each constraint toggle visibly changes heatmap
  - [ ] Marginal distribution bar chart updates synchronously
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/ConstraintSolverHeatmapVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-6-SVA-WAVEFORM`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/SvaSequenceWaveformVisualizer.tsx` (create)
  - `src/components/visualizers/SvaSequenceWaveformVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/index.mdx` (embed)
- **Problem statement:** SystemVerilog Assertions (SVA) sequences and properties operate on clock cycles and are defined using temporal operators (`##`, `|->`, `|=>`, `[*N]`, `[->N]`). These operators are completely opaque without a waveform-style time-axis view. Learners need to see the assertion match/fail condition across a signal trace.
- **Scope:**
  1. Create `SvaSequenceWaveformVisualizer.tsx` as a `"use client"` component.
  2. Display a 16-cycle waveform view with 4 signal rows (clk, req, ack, data_valid) with editable high/low values per cycle.
  3. A dropdown selects the active SVA property to evaluate (pre-loaded examples: `req ##2 ack`, `req |-> ##[1:3] ack`, `$rose(req) |=> ack [*2]`).
  4. After the user sets signal values, a **"Evaluate"** button runs a JS-side property checker and marks each clock cycle as: **PASS** (green), **FAIL** (red), **PENDING** (yellow), or **VACUOUS** (grey).
  5. Hovering a cycle shows a tooltip explaining why it passed/failed.
  6. Add a custom property text-input for advanced users to type their own simplified SVA syntax.
  7. Register in MDX map and embed in `I-SV-4A`.
  8. Vitest tests: renders, evaluation of known-passing trace returns PASS, evaluation of known-failing trace returns FAIL at correct cycle.
- **Deliverable checklist:**
  - [ ] 16-cycle waveform editor renders and is editable
  - [ ] All 3 pre-loaded SVA examples evaluate correctly
  - [ ] Cycle-level PASS/FAIL/PENDING/VACUOUS status is displayed
  - [ ] Hover tooltip explains result
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/SvaSequenceWaveformVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-7-COVERAGE-CROSS-EXPLORER`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/CoverageCrossExplorerVisualizer.tsx` (create)
  - `src/components/visualizers/CoverageCrossExplorerVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index.mdx` (embed)
- **Problem statement:** Functional coverage cross-products between coverpoints are a major source of coverage holes and wasted simulation time. The combinatorial explosion of cross bins is difficult to reason about statically — learners need an interactive matrix that shows which bins are hit and which remain uncovered.
- **Scope:**
  1. Create `CoverageCrossExplorerVisualizer.tsx` as a `"use client"` component.
  2. Define two default coverpoints: `cp_addr` with bins `low`, `mid`, `high` and `cp_op` with bins `READ`, `WRITE`, `BURST`.
  3. Render a 3×3 matrix (cross-product) where each cell represents a cross bin. Initially all cells are grey (unhit).
  4. Provide a **"Randomize Transactions"** button that simulates 10 random transactions and lights up corresponding matrix cells green.
  5. Provide a **"Run Until 100% Coverage"** button that keeps simulating until all bins are hit, reporting the number of transactions needed.
  6. Allow users to add `ignore_bins` via a checkbox list, which grays out those cells and removes them from the coverage calculation.
  7. Display a coverage percentage counter updating in real time.
  8. Register in MDX map and embed in `I-SV-3A`.
  9. Vitest tests: matrix renders 9 cells initially, randomize button hits at least one cell, coverage percentage increases.
- **Deliverable checklist:**
  - [ ] 3×3 cross-product matrix renders
  - [ ] Randomize adds green cells correctly
  - [ ] 100% coverage mode works
  - [ ] Ignore bins mechanism removes cells from count
  - [ ] Real-time percentage counter works
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/CoverageCrossExplorerVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-8-RAL-REGISTER-MAP`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `CONTENT-T3-SCOREBOARD` (ensures T3 content is being built)
- **Primary surfaces:**
  - `src/components/visualizers/RalRegisterMapVisualizer.tsx` (create)
  - `src/components/visualizers/RalRegisterMapVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals/index.mdx` (embed)
- **Problem statement:** The UVM Register Abstraction Layer (RAL) models hardware register maps hierarchically (block → regfile → register → field). Learners struggle to understand how the model maps to hardware address spaces without an interactive hierarchical browser.
- **Scope:**
  1. Create `RalRegisterMapVisualizer.tsx` as a `"use client"` component.
  2. Define a sample register model: an I2C controller block with 4 registers (CTRL, STATUS, TX_DATA, RX_DATA), each with 2-4 bit fields.
  3. Render a collapsible tree on the left: `i2c_block` → registers → fields.
  4. Clicking any register opens a right panel showing: register name, base offset, access policy (RW/RO/WO/W1C), reset value, and a bit-field diagram.
  5. The bit-field diagram shows each field as a colored rectangle proportional to its width, with name and bit-range tooltip on hover.
  6. Add a **"Simulate frontdoor write"** button for any register that animates a write transaction and shows the mirror value updating.
  7. Register in MDX map and embed in `A-UVM-4A`.
  8. Vitest tests: tree renders, clicking register shows correct fields, bit-field diagram renders correct number of field blocks.
- **Deliverable checklist:**
  - [ ] Collapsible tree renders `i2c_block` hierarchy
  - [ ] Register details panel shows correct metadata
  - [ ] Bit-field diagram renders proportional field widths
  - [ ] Frontdoor write animation works
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/RalRegisterMapVisualizer.test.tsx`
  - `npm run build`

---

### `VIZ-9-SEQUENCE-HIERARCHY`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `none`
- **Primary surfaces:**
  - `src/components/visualizers/UvmSequenceHierarchyVisualizer.tsx` (create)
  - `src/components/visualizers/UvmSequenceHierarchyVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index.mdx` (embed)
- **Problem statement:** UVM sequences can call sub-sequences which call further sub-sequences, forming a call tree. The `start()` / `body()` / `finish_item()` lifecycle is non-obvious when nesting is involved. Learners need a tree visualization that shows the call hierarchy and execution order.
- **Scope:**
  1. Create `UvmSequenceHierarchyVisualizer.tsx` as a `"use client"` component.
  2. Hard-code a 3-level sequence example: `top_sequence` calls `write_burst_sequence` and `read_check_sequence`; each child calls a `base_rw_sequence`.
  3. Render a collapsible tree diagram with expand/collapse on each node.
  4. Each node shows: sequence class name, the sequencer it runs on, and status (idle/running/done).
  5. A **"Step Execute"** button walks through the execution order, highlighting the currently executing sequence and showing a log panel with `start()`, `body()`, `finish_item()` lifecycle events.
  6. Add a second preset: a virtual sequencer example with multiple sequencer targets.
  7. Register in MDX map and embed in `I-UVM-3A`.
  8. Vitest tests: tree renders, step execution advances, collapse/expand works.
- **Deliverable checklist:**
  - [ ] 3-level sequence tree renders
  - [ ] Expand/collapse works per node
  - [ ] Step execution highlights correct node and adds to log
  - [ ] Virtual sequencer preset works
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/UvmSequenceHierarchyVisualizer.test.tsx`
  - `npm run build`

---

### `CONTENT-T3-SCOREBOARD`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `content/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** The T3_Advanced tier has only 3 modules and stops at RAL and Callbacks. There is no scoreboard module, despite scoreboards being the central self-checking mechanism in every real UVM environment. This is the most critical content gap in T3.
- **Scope:**
  1. Author `A-UVM-6_Scoreboards_and_Reference_Models/index.mdx`.
  2. Sections: (a) The Role of the Scoreboard — why passive checking beats assertion-only approaches; (b) `uvm_scoreboard` base class; (c) Building a Transaction-Level Reference Model in SV; (d) Analysis FIFO pattern for connecting monitor to scoreboard; (e) Handling Out-of-Order Transactions with an associative array predictor; (f) Common Pitfalls — comparing objects by reference vs. value, phase ordering issues; (g) Knowledge Check — 4 questions; (h) Lab pointer linking to `LAB-1-T3-SCOREBOARD`.
  3. Include at least 5 annotated SV code blocks.
  4. Include a static architecture diagram showing `monitor → analysis port → scoreboard → reference model → comparator`.
  5. Update `scripts/generate-curriculum.ts` to include this module after `A-UVM-5_UVM_Callbacks`.
- **Deliverable checklist:**
  - [x] `A-UVM-6_Scoreboards_and_Reference_Models/index.mdx` created
  - [x] All 6 content sections present
  - [x] 4 Knowledge Check questions included
  - [x] Lab pointer to `LAB-1-T3-SCOREBOARD` included
  - [x] Curriculum generator includes the new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T3-VIP`
- **Priority:** P1
- **Status:** `complete`
- **Depends On:** `CONTENT-T3-SCOREBOARD`
- **Primary surfaces:**
  - `content/curriculum/T3_Advanced/A-UVM-7_VIP_Construction/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** Professional verification engineers are frequently tasked with building or extending Verification IP (VIP) for standard protocols (AXI, APB, I2C, SPI). No module exists covering VIP architecture principles, reuse packaging, or the standard VIP internal structure (agent + interface + sequence library).
- **Scope:**
  1. Author `A-UVM-7_VIP_Construction/index.mdx`.
  2. Sections: (a) What is a VIP and why it matters; (b) VIP Internal Architecture — interface, agent, sequence library, protocol checker; (c) Passive vs. Active Agent Mode and the `is_active` flag; (d) Packaging a VIP for Reuse — directory structure, package files, parameter passing; (e) A concrete mini-VIP example for the APB protocol with annotated code; (f) Integrating a 3rd-party VIP — common pitfalls; (g) Knowledge Check — 3 questions.
  3. Include a directory-tree code block showing recommended VIP package structure.
  4. Update curriculum generator to include after `A-UVM-6`.
- **Deliverable checklist:**
  - [x] `A-UVM-7_VIP_Construction/index.mdx` created
  - [x] APB mini-VIP code example is complete and syntactically correct SV
  - [x] VIP directory structure code block present
  - [x] Curriculum generator includes the new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T3-MULTI-AGENT`
- **Priority:** P1
- **Status:** `complete`
- **Depends On:** `CONTENT-T3-SCOREBOARD`
- **Primary surfaces:**
  - `content/curriculum/T3_Advanced/A-UVM-8_Multi_Agent_Topologies/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** Real SoC-level testbenches have multiple protocol agents (AXI master, AXI slave, APB, interrupt controller) coordinated by virtual sequences via a virtual sequencer. No module exists covering this multi-agent topology, virtual sequencer construction, or cross-agent synchronization — all of which are daily tasks for senior verification engineers.
- **Scope:**
  1. Author `A-UVM-8_Multi_Agent_Topologies/index.mdx`.
  2. Sections: (a) Scaling Beyond a Single Agent; (b) The Virtual Sequencer Pattern — `uvm_sequencer #(uvm_sequence_item)` as coordinator; (c) Virtual Sequence Construction — calling child sequences on typed sub-sequencer handles; (d) Cross-Agent Synchronization — using events and semaphores between virtual sequences; (e) Topology configuration with `uvm_config_db`; (f) A worked example: 2-agent AXI+APB environment; (g) Knowledge Check — 4 questions.
  3. Embed `<UvmSequenceHierarchyVisualizer />` (from `VIZ-9`) in section (c).
  4. Update curriculum generator to include after `A-UVM-7`.
- **Deliverable checklist:**
  - [x] `A-UVM-8_Multi_Agent_Topologies/index.mdx` created
  - [x] Virtual sequencer code example is complete
  - [x] `<UvmSequenceHierarchyVisualizer />` embedded (requires `VIZ-9` to be deployed)
  - [x] Curriculum generator includes the new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T4-PSS`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** The Portable Stimulus Standard (Accellera PSS / IEEE 2401) is now a core competency for senior verification engineers at companies like Intel, Arm, and Qualcomm. PSS allows test intent to be written once and compiled to simulation, emulation, or post-silicon targets. This is a complete gap in the current T4 content and represents the largest industry relevance deficit in the guide.
- **Scope:**
  1. Author `E-PSS-1_Portable_Stimulus_Standard/index.mdx`.
  2. Sections: (a) The Portability Problem PSS Solves; (b) PSS 2.0 Language Fundamentals — actions, components, activity graphs; (c) Data Constraints in PSS — similar to SV but declarative; (d) Compiling PSS to SystemVerilog UVM sequences; (e) Compiling PSS to C for bare-metal firmware tests; (f) Tool ecosystem — Cadence PSS Compiler, Synopsys VC PSS, open-source `pss-parser`; (g) Hands-on Example — PSS spec for a memory access test with portability target comparison; (h) Knowledge Check — 4 questions.
  3. Include a side-by-side comparison: PSS action graph vs. equivalent hand-written UVM virtual sequence.
  4. Embed `<PssIntentMapVisualizer />` (from `VIZ-10`) in section (b).
  5. Update curriculum generator to add as first new T4 Expert module after existing content.
- **Deliverable checklist:**
  - [x] `E-PSS-1_Portable_Stimulus_Standard/index.mdx` created
  - [x] All 8 content sections present
  - [x] PSS-to-SV and PSS-to-C examples included
  - [x] Tool ecosystem section current as of 2025
  - [x] Curriculum generator includes the new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `VIZ-10-PSS-INTENT-MAP`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `CONTENT-T4-PSS`
- **Primary surfaces:**
  - `src/components/visualizers/PssIntentMapVisualizer.tsx` (create)
  - `src/components/visualizers/PssIntentMapVisualizer.test.tsx` (create)
  - `src/app/curriculum/[...slug]/page.tsx` (register)
  - `content/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx` (embed)
- **Problem statement:** PSS action graphs are directed acyclic graphs of actions and data flows that are fundamentally visual artifacts. A static code block cannot convey the portability concept — learners need to see the same abstract action graph and then see it "compiled" to different target representations.
- **Scope:**
  1. Create `PssIntentMapVisualizer.tsx` as a `"use client"` component.
  2. Render a PSS action graph with nodes for: `write_mem_action`, `read_mem_action`, `verify_data_action`, connected by data-flow and ordering edges.
  3. A **"Compile Target"** toggle with three options: **UVM Sequence**, **C Bare-Metal**, **Emulation**.
  4. When a target is selected, the action graph animates a transformation: nodes rearrange/relabel to show the target representation (e.g., UVM mode shows sequence classes, C mode shows function calls).
  5. A generated-code panel on the right updates to show the pseudocode output for the selected target.
  6. Register in MDX map and embed in `E-PSS-1`.
  7. Vitest tests: renders, compile target toggle changes displayed code, all 3 targets render without error.
- **Deliverable checklist:**
  - [ ] Action graph renders with all 3 nodes and edges
  - [ ] All 3 compile targets produce distinct output
  - [ ] Generated code panel updates on target change
  - [ ] Component registered in MDX map
  - [ ] Vitest tests pass
- **Validation:**
  - `npx vitest run src/components/visualizers/PssIntentMapVisualizer.test.tsx`
  - `npm run build`

---

### `CONTENT-T4-PYUVM`
- **Priority:** P0
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-PYUVM-1_Python_Based_Verification/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** Python-based hardware verification (cocotb, pyUVM 3.x) has crossed the threshold from niche to mainstream, driven by ML hardware teams and the open-source RISC-V ecosystem. An Expert-tier guide that omits Python co-verification is no longer competitive or industry-relevant in 2026.
- **Scope:**
  1. Author `E-PYUVM-1_Python_Based_Verification/index.mdx`.
  2. Sections: (a) Why Python in Hardware Verification — ML framework integration, faster iteration, open-source ecosystem; (b) cocotb Architecture — coroutines, triggers, DUT handle; (c) A minimal cocotb testbench for an AXI4-Lite slave; (d) pyUVM 3.x — mapping UVM phases and components to Python classes; (e) Side-by-side: UVM SV agent vs. pyUVM agent; (f) Interoperability — running pyUVM alongside SV UVM using DPI; (g) Limitations and when to use SV UVM vs. pyUVM; (h) Knowledge Check — 3 questions.
  3. Include a full cocotb testbench code example with syntax highlighting.
  4. Update curriculum generator to include after `E-PSS-1`.
- **Deliverable checklist:**
  - [x] `E-PYUVM-1_Python_Based_Verification/index.mdx` created
  - [x] cocotb code example is syntactically correct Python
  - [x] pyUVM vs SV UVM comparison table present
  - [x] Curriculum generator includes new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T4-AI-VERIF`
- **Priority:** P1
- **Status:** `complete`
- **Depends On:** `CONTENT-T4-PYUVM`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-AI-1_AI_Driven_Verification/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** AI/ML-assisted verification — including ML-driven stimulus generation, coverage closure prediction, and LLM-assisted assertion writing — is now an active area of both commercial tool investment (Synopsys.ai, Cadence Cerebrus) and academic research. Expert-tier engineers must understand the landscape even if they don't implement ML models themselves.
- **Scope:**
  1. Author `E-AI-1_AI_Driven_Verification/index.mdx`.
  2. Sections: (a) The Coverage Closure Bottleneck that AI addresses; (b) ML-Driven Stimulus Generation — reinforcement learning approaches, genetic algorithms; (c) LLM-Assisted Verification — generating assertions, sequences, and scoreboard checkers from natural language specs; (d) Commercial Tools — Synopsys VSO.ai, Cadence JasperGold ML, Mentor Questa AutoCheck overview; (e) Open research approaches — using Python (scikit-learn/PyTorch) via cocotb to build a coverage-closure predictor; (f) Ethical and reliability considerations — why AI-generated assertions must be reviewed; (g) Knowledge Check — 3 conceptual questions (no coding).
  3. This module is intentionally conceptual — no heavy code examples required.
  4. Update curriculum generator to include after `E-PYUVM-1`.
- **Deliverable checklist:**
  - [x] `E-AI-1_AI_Driven_Verification/index.mdx` created
  - [x] All 7 sections present
  - [x] Tool overview is accurate for 2025/2026 tool versions
  - [x] Curriculum generator includes new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T4-RISCV`
- **Priority:** P1
- **Status:** `complete`
- **Depends On:** `none`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-RISCV-1_RISC_V_Verification_Methodology/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** RISC-V has become the dominant open ISA in custom ASIC design. Verifying a RISC-V processor requires specialized methodology — instruction generation (RISCV-DV), ISA-level compliance checking (RISC-V ISAC), and formal ISA property checking. None of this is covered in the current guide, making it incomplete for the single largest emerging hardware verification domain.
- **Scope:**
  1. Author `E-RISCV-1_RISC_V_Verification_Methodology/index.mdx`.
  2. Sections: (a) RISC-V Verification Challenges vs. ASIC Peripherals; (b) RISCV-DV — Google's open-source constrained-random instruction generator (Python/SV); (c) RISC-V ISAC — instruction-level coverage and tracing; (d) Formal ISA verification with JasperGold riscv-formal; (e) Step-and-compare methodology — RTL sim vs. ISS (Spike, QEMU); (f) UVM integration — wrapping RISCV-DV in a UVM sequence; (g) Knowledge Check — 4 questions.
  3. Include a RISCV-DV configuration snippet showing a custom instruction distribution YAML.
  4. Update curriculum generator to include after `E-AI-1`.
- **Deliverable checklist:**
  - [x] `E-RISCV-1_RISC_V_Verification_Methodology/index.mdx` created
  - [x] RISCV-DV config snippet included
  - [x] Step-and-compare methodology explained with diagram description
  - [x] Curriculum generator includes new module
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T4-UVM-ML`
- **Priority:** P2
- **Status:** `complete`
- **Depends On:** `CONTENT-T4-PYUVM`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-UVM-ML-1_Multi_Language_Verification/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** Complex SoC environments mix SV UVM agents with SystemC TLM-2.0 models and C++ reference models. Accellera UVM-ML provides a framework for connecting these multi-language components under a unified phase and TLM communication infrastructure. Expert engineers at large semiconductor companies encounter this regularly.
- **Scope:**
  1. Author `E-UVM-ML-1_Multi_Language_Verification/index.mdx`.
  2. Sections: (a) When multi-language verification is needed; (b) UVM-ML architecture and the Open Architecture framework; (c) Connecting a SV UVM agent to a SystemC TLM-2.0 model; (d) Unified phasing across language boundaries; (e) Practical limitations and commercial support status; (f) Knowledge Check — 3 questions.
  3. Update curriculum generator.
- **Deliverable checklist:**
  - [x] Module created with all 6 sections
  - [x] SV↔SystemC connection example included
  - [x] Curriculum generator updated
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `CONTENT-T4-EMULATION`
- **Priority:** P2
- **Status:** `complete`
- **Depends On:** `CONTENT-T3-MULTI-AGENT`
- **Primary surfaces:**
  - `content/curriculum/T4_Expert/E-EMU-1_Emulation_Aware_Verification/index.mdx` (create)
  - `scripts/generate-curriculum.ts`
- **Problem statement:** Hardware emulation (Cadence Palladium Z2, Synopsys ZeBu, Siemens Veloce) is used for SoC-level verification where RTL simulation is too slow. UVM environments must be modified to run efficiently on emulators: transaction-level acceleration, virtual probes, compile-time vs. run-time tradeoffs. No content exists for this essential senior-engineer topic.
- **Scope:**
  1. Author `E-EMU-1_Emulation_Aware_Verification/index.mdx`.
  2. Sections: (a) Why emulation — speed/capacity tradeoffs; (b) Emulation platforms overview (Palladium, ZeBu, Veloce); (c) Transaction-Level Acceleration (TLA) — replacing pin-level UVM drivers with TL models; (d) Virtual Probes and in-emulation debug; (e) Compile-time vs. run-time configuration for emulation; (f) UVM modifications required — time precision, no `$display` in synthesized code; (g) Knowledge Check — 3 questions.
  3. Update curriculum generator.
- **Deliverable checklist:**
  - [x] Module created with all 7 sections
  - [x] TLA explanation includes code comparison (pin-level vs. TL driver)
  - [x] Curriculum generator updated
  - [x] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `FLASH-1-T3-T4-COVERAGE`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `CONTENT-T3-SCOREBOARD`
- **Primary surfaces:**
  - `content/flashcards/t3-advanced.json` (create or augment)
  - `content/flashcards/t4-expert.json` (create or augment)
- **Problem statement:** The flashcard system is a critical component of the pedagogical loop (Learn → Visualize → Quiz → Lab → **Flashcard Review**). Given that T3 previously had only 3 modules and T4 had 6 modules with no new topics, flashcard coverage for Advanced/Expert content is minimal. Every new module authored in `CONTENT-T3-*` and `CONTENT-T4-*` tasks needs a corresponding flashcard set.
- **Scope:**
  1. Audit existing `content/flashcards/` for T3 and T4 coverage.
  2. Create or augment `t3-advanced.json` with flashcard sets for all T3 modules: RAL Fundamentals (10 cards), Advanced RAL (8 cards), UVM Callbacks (8 cards), Scoreboards (12 cards), VIP Construction (8 cards), Multi-Agent Topologies (10 cards).
  3. Create or augment `t4-expert.json` with flashcard sets for all T4 modules: UVM Methodology Customization (8 cards), Advanced Debug (8 cards), Formal Integration (8 cards), Performance (8 cards), Power Aware (8 cards), SoC Verification (10 cards), PSS (12 cards), pyUVM (10 cards), AI Verification (6 cards), RISC-V (10 cards).
  4. Each flashcard must have: `front` (question), `back` (answer), `moduleId` (linking to the module slug), `difficulty` (`beginner`/`intermediate`/`advanced`).
  5. Validate JSON schema against existing flashcard format.
- **Deliverable checklist:**
  - [ ] `t3-advanced.json` has ≥56 cards covering all 6 T3 modules
  - [ ] `t4-expert.json` has ≥88 cards covering all 11 T4 modules
  - [ ] All cards have valid `front`, `back`, `moduleId`, `difficulty` fields
  - [ ] JSON validates against existing flashcard schema
  - [ ] Flashcard viewer app can load and render the new sets without error
- **Validation:**
  - `node scripts/validate-flashcards.js` (create this script if it doesn't exist)
  - `npm run build`

---

### `LAB-1-T3-SCOREBOARD`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `CONTENT-T3-SCOREBOARD`
- **Primary surfaces:**
  - `content/curriculum/labs/t3-scoreboard-lab/index.mdx` (create)
  - `content/curriculum/labs/t3-scoreboard-lab/starter/` (create — SV source files)
  - `content/curriculum/labs/t3-scoreboard-lab/solution/` (create — SV source files)
- **Problem statement:** The `CONTENT-T3-SCOREBOARD` module teaches scoreboards conceptually, but without a hands-on lab the pedagogical loop is broken. Learners need to construct a self-checking scoreboard from a starter template, which solidifies both the analysis FIFO pattern and the reference model comparison.
- **Scope:**
  1. Author `index.mdx` as the lab guide with: objectives, prerequisites (`A-UVM-6`), step-by-step instructions, and expected output.
  2. Create `starter/` directory with: a minimal UVM environment stub (`my_env.sv`, `my_scoreboard.sv` with `TODO` comments), a simple DUT (`fifo_dut.sv`), and a testbench top (`tb_top.sv`).
  3. The lab objective: complete `my_scoreboard.sv` to: (a) connect to the analysis port, (b) implement a FIFO-based reference model, (c) compare DUT output to expected and call `uvm_error` on mismatch.
  4. Create `solution/` directory with the complete, working scoreboard implementation.
  5. The lab instructions must reference the `CoverageCrossExplorerVisualizer` (from `VIZ-7`) for extending the lab with coverage.
  6. Include expected `run_test()` output showing `UVM_INFO` pass messages.
- **Deliverable checklist:**
  - [ ] `index.mdx` lab guide created with clear step-by-step instructions
  - [ ] `starter/` has syntactically valid SV with `TODO` markers
  - [ ] `solution/` has complete, working SV that produces passing output
  - [ ] Lab is reachable from `A-UVM-6` module page via "Lab" link
  - [ ] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`
  - Manual: starter code compiles with a SV simulator (e.g., `vcs`, `iverilog` if available)

---

### `LAB-2-T4-PSS`
- **Priority:** P2
- **Status:** `todo`
- **Depends On:** `CONTENT-T4-PSS`
- **Primary surfaces:**
  - `content/curriculum/labs/t4-pss-lab/index.mdx` (create)
  - `content/curriculum/labs/t4-pss-lab/starter/` (create — PSS source files)
  - `content/curriculum/labs/t4-pss-lab/solution/` (create — PSS + generated SV/C)
- **Problem statement:** PSS is a declarative language that learners must write, not just read. Without a hands-on lab writing a PSS spec and observing the compiled output, the "write once, run anywhere" value proposition remains abstract. This lab bridges the concept to practice.
- **Scope:**
  1. Author `index.mdx` as the lab guide.
  2. `starter/` contains: a partial PSS spec for a memory test (`mem_test.pss`) with `TODO` sections for the data constraint and the activity graph ordering.
  3. Lab objective: complete the PSS spec so it expresses: (a) a write action followed by a read-verify action, (b) an address constraint ensuring 4-byte alignment, (c) data ranging from 0x0 to 0xFFFF.
  4. `solution/` contains: the complete PSS spec, a pre-generated SV UVM sequence equivalent, and a pre-generated C bare-metal equivalent.
  5. The lab guide includes side-by-side diffs showing how each PSS construct maps to its compiled target.
- **Deliverable checklist:**
  - [ ] `index.mdx` created with clear objectives
  - [ ] `starter/mem_test.pss` has valid partial PSS with `TODO` markers
  - [ ] `solution/` has complete PSS and both compiled outputs
  - [ ] Lab linked from `E-PSS-1` module page
  - [ ] `npm run build` succeeds
- **Validation:**
  - `npm run generate:curriculum`
  - `npm run build`

---

### `INFRA-4-VITEST-SUITE`
- **Priority:** P1
- **Status:** `todo`
- **Depends On:** `VIZ-1-SV-SCHEDULER`
- **Primary surfaces:**
  - `src/components/visualizers/*.test.tsx` (all new visualizer test files)
  - `vitest.config.mts`
  - `package.json` (test script)
- **Problem statement:** The existing `vitest.config.mts` exists but there is currently only one visualizer component (`EventSchedulerVisualizer.tsx`) and no evidence of a comprehensive test suite. With 10 new visualizer components being added across `VIZ-1` through `VIZ-10`, a formal test governance pass is needed to verify all test files are correctly discovered, run, and reported in CI.
- **Scope:**
  1. Audit `vitest.config.mts` and update if needed to ensure all `src/components/visualizers/*.test.tsx` files are included in the test glob.
  2. Ensure `@testing-library/react` and `@testing-library/user-event` are installed and configured in the Vitest setup file
