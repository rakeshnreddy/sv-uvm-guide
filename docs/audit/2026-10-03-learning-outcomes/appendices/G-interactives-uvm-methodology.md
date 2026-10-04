> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# UVM / Methodology / Expert Interactives: Evaluation as Teaching Instruments

Audit date 2026-10-03 · repo `main @ 488f7f43` · read-only. No repository files were modified.
Scope: every UVM, methodology and expert interactive registered in `src/components/mdx/lazy-mdx-interactives.ts` (loaders in `src/components/mdx/LazyMdxInteractive.tsx`), plus the UVM practice tooling (`/practice`, `/exercises`), the homepage `UvmHeroDiagram`, and the lab workspace and simulation path. The AMBA visuals are only listed (§9). Another agent covers them.

Method: I read every in-scope component source end to end. I mapped MDX usage with a script that strips fenced code blocks (`scratchpad/audit/tagmap.py`). I cross-read the lesson text next to each interactive, and I read the unit tests that cover these components. I checked UVM semantics against expert knowledge of IEEE 1800.2-2020 and the Accellera reference implementation. One source was checked on the web: the UVM 1.2 class reference for `uvm_factory` on verificationacademy.com. It says, for instance overrides, that "the instance queue is processed in order of override registrations, and the first override match prevails". It also says that type overrides apply "provided no instance override applies", and that `replace=1` replaces an earlier type override. I believe 1800.2 keeps this behaviour, with Medium-High confidence. I do not cite clause numbers. Where a number would be needed, it is marked "clause unverified".

---

## 1. Headline verdict

- **None of the UVM interactives is a simulator, and none asks the learner to predict before it reveals.** Of 42 in-scope instruments, 20 are scripted animations or static explorers and 8 are "coming soon" placeholders (4 of the 8 sit in live lessons, in 6 placements). 8 are small rule engines ("conceptual models"), 4 are drag/connect checkers and 2 are MCQ drills.
- **The rule engines that do exist get the most interview-relevant UVM rules wrong:**
  - **Factory override precedence:** the two factory interactives and the lesson text give three different rules, and none of them is UVM's.
  - **Sequencer arbitration:** SEQ_ARB_WEIGHTED is implemented as strict priority, and `lock()` auto-releases.
  - **Phase concurrency:** three tools teach that `run_phase` comes before the runtime phases, or that runtime phases are "custom" or unsynchronized.
  - **RAL:** "implicit prediction" is applied to the explicit-predictor path.
- **The flagship UVM mechanisms have no working interactive:** the sequencer/driver handshake, objections and drain, config_db precedence, RAL desired vs mirrored values, and callbacks, scoreboards and multi-agent topologies. The handshake slot is a placeholder in 3 lessons, including the dedicated handshake page.
- **Lab workspace:** the "Run workspace" simulator cannot compile UVM. Its Docker image has Icarus and Verilator but no UVM library. "Passed" means the code compiled and the process exited with status 0. Coverage is hard-coded to 0. Only 1 of 29 labs (`basics-1`) has any grader, and that grader is a token-sequence match. Every UVM lab is self-attested.

---

## 2. Usage map

### 2.1 Registered names → lessons (UVM / methodology / expert subset; full map via `tagmap.py`)

| Registered name | Used in (content/curriculum/…) |
|---|---|
| AnimatedUvmSequenceDriverHandshakeDiagram | I-UVM-2B index; I-UVM-3A index; I-UVM-3B `sequencer-driver-handshake.mdx` |
| UvmPhasingDiagram | I-UVM-1C index (also `/practice/visualizations/uvm-phasing`) |
| AnimatedUvmTestbenchDiagram | I-UVM-2A index |
| UvmVirtualSequencerDiagram | I-UVM-3B `virtual-sequences.mdx` |
| InteractiveUvmArchitectureDiagram | I-SV-9 index (also `/practice/visualizations/uvm-architecture`; `src/components/UvmHeroDiagram.tsx` wraps it but is imported nowhere = dead code) |
| ConfigDbExplorer | I-UVM-2C index |
| VirtualSequencerExplorer | I-UVM-3B `uvm-virtual-sequencer.mdx` |
| TelemetryEventBusVisualizer | E-DBG-1 index |
| Analysis3D, Dataflow3D, TLMPortConnector, TlmConnectionBuilderVisualizer | I-UVM-2B index (+ handshake placeholder) |
| PhaseTimeline3D, UvmPhaseTimelineVisualizer | I-UVM-1C index |
| FactoryOverrideVisualizer, FactoryOverrideExplorerVisualizer | I-UVM-1B index |
| UVMTreeExplorer | I-UVM-1A index |
| UvmSequenceHierarchyVisualizer | I-UVM-3A index |
| UvmPolicyVisualizer / UvmContainerVisualizer / TransactionRecordingVisualizer | I-UVM-4 / I-UVM-5 / I-UVM-6 index |
| RalRegisterMapVisualizer | A-UVM-4A index |
| RALPredictorVisualizer | A-UVM-4B index |
| MethodologyPhaseVisualizer | E-CUST-1 index |
| VIPReuseVisualizer | E-SOC-1 index |
| PssIntentMapVisualizer | E-PSS-1 index |
| DebuggingSimulator | E-DBG-1 `hang-lab.mdx` (passed `scenario="hang"`, which the component ignores; see F7) |
| EventSchedulerVisualizer (SV scheduler) | E-PERF-1 index |
| Mailbox3D (SV) | F2D `ipc.mdx` |
| Constraint3D (SV) | I-SV-2A index |
| PacketSorterGame (SV) | F2B index |
| InterviewQuestionPlayground | 21 SV lesson pages; also embedded inside FactoryOverrideVisualizer and UVMTreeExplorer |

**UVM modules with no interactive at all:** A-UVM-5 Callbacks, A-UVM-6 Scoreboards & Reference Models, A-UVM-7 VIP Construction, A-UVM-8 Multi-Agent Topologies. Also none of the T4 modules E-AI-1, E-EMU-1, E-PYUVM-1, E-RISCV-1 or E-UVM-ML-1 has one (by grep).

### 2.2 Registered but unused (18)
`DataTypeComparisonChart, UvmHierarchySunburstChart, UvmTestbenchVisualizer, UvmComponentRelationshipVisualizer, UvmPhasingInteractiveTimeline, UvmFactoryWorkflowVisualizer, SystemVerilogDataTypesAnimation, CoverageAnalyzer, RandomizationExplorer, InterfaceSignalFlow, AssertionBuilder, DataTypeExplorer, BlockingSimulator, OperatorDrill, OperatorVisualizer, Coverage3D, CovergroupBuilder, RALHierarchy`.
(`UvmComponentRelationshipVisualizer` and `UvmPhasingDiagram` are still reachable through the practice routes.)

### 2.3 Used but unregistered
**None.** Every capitalised JSX tag outside code fences resolves to either the lazy registry or a static component in `src/generated/mdx-component-registry.tsx`.
Note: many MDX files carry `import X from '@/components/...'` lines. Lessons are rendered with `next-mdx-remote/rsc` (`src/app/(learning)/curriculum/[...slug]/page.tsx:3,92`), which does not honour those imports. Resolution always goes through the registry, so props such as `scenario="hang"` are passed to components that ignore them.

### 2.4 Practice tooling (not in registry)
- **`/practice`** (`src/components/practice/PracticeHub.tsx`): 14 items, all `status: 'completed'`. This includes "UVM Component Relationships" and "UVM Phasing Diagram" (lines ~103–115), which render only `DiagramPlaceholder`. The status overstates what is built.
- **`/exercises`:** `UvmAgentBuilderExercise`, `UvmPhaseSorterExercise`, `ScoreboardConnectorExercise` and `SequencerArbitrationSandbox`. The sandbox is linked from I-UVM-3B `sequence-arbitration.mdx:27`, which says it "mirrors the patterns in this lesson". It does not (F2).

---

## 3. Counts by classification (42 instruments)

| Classification | n | Members |
|---|---|---|
| Real simulator | **0** | (the lab "Run workspace" is the only real simulator, and it cannot run UVM; see §7) |
| Conceptual model (rule engine driven by learner input) | 8 | ConfigDbExplorer, FactoryOverrideVisualizer, FactoryOverrideExplorerVisualizer, SequencerArbitrationSandbox, MethodologyPhaseVisualizer, RalRegisterMapVisualizer, UvmContainerVisualizer, Mailbox3D |
| Static checker / construction drill | 4 | TlmConnectionBuilderVisualizer, ScoreboardConnectorExercise, UvmAgentBuilderExercise, UvmPhaseSorterExercise |
| Scripted animation / illustration / static explorer | 20 | InteractiveUvmArchitectureDiagram, UvmHierarchySunburstChart, VirtualSequencerExplorer, TelemetryEventBusVisualizer, Analysis3D, Dataflow3D, PhaseTimeline3D, Constraint3D, Coverage3D, RALHierarchy, RALPredictorVisualizer, TLMPortConnector, UVMTreeExplorer, VIPReuseVisualizer, UvmPolicyVisualizer, TransactionRecordingVisualizer, UvmPhaseTimelineVisualizer, UvmSequenceHierarchyVisualizer, PssIntentMapVisualizer, DebuggingSimulator |
| Quiz / drill | 2 | InterviewQuestionPlayground, PacketSorterGame |
| Placeholder (non-functional "coming soon") | 8 | AnimatedUvmSequenceDriverHandshakeDiagram, UvmPhasingDiagram, AnimatedUvmTestbenchDiagram, UvmVirtualSequencerDiagram, UvmTestbenchVisualizer, UvmComponentRelationshipVisualizer, UvmPhasingInteractiveTimeline, UvmFactoryWorkflowVisualizer |

Pedagogy counts:
- **Prediction before reveal: 0 of 42.** The embedded MCQs in FactoryOverrideVisualizer and UVMTreeExplorer come after the visual. Nothing asks "what will happen?" before showing the answer.
- **Diagnostic feedback on a learner-built artefact: 4.** TlmConnectionBuilder, ScoreboardConnector, AgentBuilder and PhaseSorter. All four give only pass/fail or a missing-item count, and two of them grade a wrong rule.
- **Connected to real UVM code:** 6 show plausible code (UvmPhaseTimelineVisualizer, MethodologyPhaseVisualizer, VIPReuseVisualizer, PssIntentMapVisualizer, ConfigDbExplorer, UvmPolicyVisualizer). Two of those snippets are wrong (F9, F12).
- **Reduced-motion support: 0.** `grep useReducedMotion|prefers-reduced-motion|MotionConfig` over `src/` returns nothing.
- **ARIA usage:** across all `visuals/`, `curriculum/interactives/` and the 6 UVM `visualizers/`, the only non-`aria-hidden` attributes are 1 in TLMPortConnector and 1 in PssIntentMapVisualizer. The exercises (dnd-kit) are the exception and have keyboard sensors and labels.

---

## 4. Per-interactive records

Legend:
- **Cls** = classification.
- **Sem** = semantic accuracy against IEEE 1800.2 / the UVM reference.
- **Ped** = pedagogy, scored on 6 features: P = prediction-first, I = meaningful inputs or corner cases, W = explains why, C = connects to real UVM code, D = diagnostic feedback, T = transfer.
- **A11y** = accessibility and small screens.

### 4.1 Placeholders (8)
**Sources:**
- `src/components/diagrams/AnimatedUvmSequenceDriverHandshakeDiagram.tsx`
- `UvmPhasingDiagram.tsx`
- `AnimatedUvmTestbenchDiagram.tsx`
- `UvmVirtualSequencerDiagram.tsx`
- `UvmTestbenchVisualizer.tsx`
- `UvmComponentRelationshipVisualizer.tsx`
- `UvmPhasingInteractiveTimeline.tsx`
- `UvmFactoryWorkflowVisualizer.tsx`

Each is a 14-line wrapper around `DiagramPlaceholder` ("We are rebuilding this animation…"). The data files they once used are empty: `uvm-phasing-data.ts:1 export const uvmPhases = [];`, `uvm-factory-workflow-data.ts:1`, `uvm-data-model.ts:18-19`.

- **Lesson impact:**
  - The I-UVM-3B handshake page introduces its centrepiece with "Walk the Timeline" (`sequencer-driver-handshake.mdx:18-20`), and shows a placeholder.
  - In I-UVM-3A the placeholder's CTA links back to I-UVM-3A itself (`AnimatedUvmSequenceDriverHandshakeDiagram.tsx:10`), a self-loop.
  - In I-UVM-1C, `UvmPhasingDiagram` also links back to itself (`UvmPhasingDiagram.tsx:10`).
- **Verdict:** Replace (handshake, phasing, virtual sequencer). Remove the rest from lessons and the registry until they are built. Mark the PracticeHub entries as "wip".

### 4.2 InteractiveUvmArchitectureDiagram (+ UvmHeroDiagram, SimplifiedUvmDiagram)
`src/components/diagrams/InteractiveUvmArchitectureDiagram.tsx`, data in `verification-stack-links.ts`. Used in I-SV-9 and the practice route.
- **Cls:** static explorer (select a layer → read text → link to a lesson).
- **Sem:** broadly fine. Minor: the test layer "Sets factory overrides and analysis connections for downstream components" (`verification-stack-links.ts:39`). Analysis connections belong in env/agent `connect_phase`, not in the test.
- **Ped:** P–, I–, W partial, C–, D–, T–. A navigation aid, not an instrument. In selectable mode the "See the full visualization" card sets `activeId='interactive'`, which has no flow entry. The UI silently falls back to node 0 (`:27-29`, `:186-190`).
- **A11y:** good. Real `<button>` elements with `aria-pressed` / `aria-current` and a `focus-visible` ring. The responsive grid works at 375px.
- **`UvmHeroDiagram.tsx`** is imported nowhere (dead).
- **Verdict:** Keep as navigation. Do not count it as a UVM interactive.

### 4.3 UvmHierarchySunburstChart (unused)
`src/components/charts/UvmHierarchySunburstChart.tsx`
- **Cls:** static chart.
- **Sem:** wrong inheritance. `uvm_sequence_base` is drawn as a sibling of `uvm_transaction` directly under `uvm_object` (`:21-43`). In UVM, `uvm_sequence_base` extends `uvm_sequence_item`, which extends `uvm_transaction`. Arc values are arbitrary. The legend calls depth-1 "Data & sequences", but `uvm_report_object` is also at depth 1.
- **A11y:** `role="application"` (`:104`) with no keyboard interaction. Information appears only in SVG `<title>` tooltips, and colour is the only cue.
- **Verdict:** Remove (or fix the tree if ever used).

### 4.4 ConfigDbExplorer
`src/components/curriculum/interactives/ConfigDbExplorer.tsx`. Used in I-UVM-2C, directly after the lesson's precedence rules (`I-UVM-2C…/index.mdx:77-83`).
- **Cls:** conceptual model (glob matcher).
- **Sem:**
  - Path composition (`cntxt.get_full_name() + "." + inst_name`, null context → `""`) is correct (`:65-69`). The `*` glob is correct.
  - The title is "uvm_config_db Precedence & Matching" (`:92`), but **no precedence is modelled**. There is one `set()`, so the learner cannot see that during build a higher-context set wins and that last-write wins after build. These are exactly the rules the lesson states one paragraph earlier (`index.mdx:80-81`).
  - The type parameter and field name are fixed, so the #1 real-world failure (a type mismatch between set and get, e.g. `virtual apb_if` vs `virtual apb_if#(...)`) cannot be explored.
  - The text "`get()` … will only succeed if the caller's `get_full_name()` precisely matches this resolved glob pattern" (`:151`) omits the field-name and type matching rules.
  - `Execute set()` is decorative (`:71-74`).
- **Ped:** I partial (free-text glob), W partial, C yes (code-shaped form), P–, D–, T–.
- **A11y:**
  - The `<select>` and `<input>` have no `<label>` or `aria-label` (`:105-127`).
  - Emoji icons are not hidden from AT (`:210`).
  - The match state of each node is conveyed by background colour; there is only a count summary.
  - No reduced motion.
- **Verdict:** Upgrade to prediction-first. Add multiple `set()` calls with context and phase-time, and editable type and field. Ask "which value does `drv` get?" before revealing.

### 4.5 FactoryOverrideVisualizer
`src/components/curriculum/interactives/FactoryOverrideVisualizer.tsx`. Used in I-UVM-1B.
- **Cls:** conceptual model + MCQ.
- **Sem (S1):**
  - Instance-override resolution is **longest-path-string wins**:
    ```ts
    // FactoryOverrideVisualizer.tsx:43, 61-63
    // 1. Instance overrides checked first. Longest matching path wins.
    if (o.instPath.length > longestMatchLen) { longestMatchLen = o.instPath.length; bestMatch = o; }
    ```
    UVM processes instance overrides in **registration order, and the first match wins** (verified against the UVM 1.2 reference; Medium-High that 1800.2 keeps it).
  - With the shipped defaults (o2 `uvm_test_top.env.agt.*` registered before o3 `uvm_test_top.env.agt.sqr`), UVM yields `good_packet` for the `sqr` path. The tool shows `secure_packet`.
  - No override chaining (A→B, B→C ⇒ C).
  - Glob only handles `*`.
  - The quiz explanation "registration order matters for identical overrides of the same category" (`:200`) is vague and misses the point.
- **Ped:** I = toggles only, P– (the quiz comes after), W partial, C– (no `set_inst_override_by_type` code shown), D–.
- **A11y:** override rows are clickable `<div>`s with no role, tabIndex or keyboard handler (`:99-106`), so they are **keyboard-inaccessible**. On/off state is shown by icon and colour.
- **Verdict:** Fix semantics. Merge into a single factory engine (see F1).

### 4.6 FactoryOverrideExplorerVisualizer
`src/components/visualizers/FactoryOverrideExplorerVisualizer.tsx`. Used in I-UVM-1B.
- **Cls:** conceptual model (tree + "simulate create()" log).
- **Sem (S1):**
  - **The tree and the log disagree.** The tree loops through all overrides and lets the **last** matching instance override win (`:90-99`). The log uses `.find` and lets the **first** win (`:118-122`).
  - For type overrides the tree lets the last win (consistent with `replace=1`), but the log again shows the first (`:134-136`).
  - Add two instance overrides on the same path and the badge and log show different types.
  - There is no `$cast` / type-compatibility check: you can override `base_driver` with `my_monitor` (`:325-339`). Real UVM fails at the `type_id::create` `$cast` with a fatal; this is a missed diagnostic.
  - No chaining.
  - Overrides apply retroactively to an already-built tree, so the classic "override set after `create()`" bug cannot be shown.
  - Regex dots are not escaped (`:93`).
- **Tests:** `tests/components/FactoryOverrideExplorerVisualizer.test.tsx` checks only rendering and badges, so the inconsistency is untested.
- **Ped:** I = good free-form inputs, D = a log (but a contradictory one), P–, C partial (log text), T–.
- **A11y:**
  - Form labels are not associated (`<label>` without `htmlFor`, `:304-345`).
  - The tree toggle buttons have no accessible name (`:177-183`).
  - Badges add text, which is good.
  - The log animates with per-line delay, with no reduced motion.
- **Verdict:** Fix semantics, then make it the base of a flagship (§8).

### 4.7 UVMTreeExplorer
`src/components/curriculum/interactives/UVMTreeExplorer.tsx`. Used in I-UVM-1A.
- **Cls:** scripted animation + MCQ.
- **Sem:**
  - Only build, connect and run are shown. end_of_elaboration, start_of_simulation, extract, check, report, final and the runtime schedule are absent.
  - Traversal is animated level by level (breadth-first, `:100-109`). UVM traverses depth-first: pre-order for top-down, post-order for bottom-up. The direction is right but the order is wrong.
- **MCQ is wrong (S1):** the question asks what happens to the *driver* if the *agent* omits `super.build_phase(phase)`. The "correct" answer says "The field macros for the driver won't be automatically extracted" (`:281-283`).
  - Skipping `super.build_phase` in the agent affects only the **agent's own** auto-configuration (for example `is_active`).
  - The driver is still created by the agent's explicit `create()`, and its own `build_phase` and `super` call still run.
  - The explanation for opt1 (`:271`) contradicts itself.
- **UI defect (S2, High):** the Simulate button's className escapes the template substitution:
  ```tsx
  // UVMTreeExplorer.tsx:224
  className={`flex items-center ... text-white transition-colors \${
  ```
  The ternary is emitted as literal class text (`"bg-blue-600 …`), so there is no base background. The result is white text on a light card, and the primary control is near-invisible in light mode. Also, `animate` forces `backgroundColor: "#ffffff"` on nodes (`:141`), overriding `dark:bg-slate-900`. In dark mode that gives light slate-200 text on white.
- **A11y:** the tree uses `min-w-[600px]` inside `overflow-x-auto` (scrolls at 375px). State is colour-only. No live region. The select has no label.
- **Verdict:** Fix semantics and replace the MCQ. Fold into the phasing flagship.

### 4.8 PhaseTimeline3D
`src/components/curriculum/interactives/3d/PhaseTimeline3D.tsx`. Used in I-UVM-1C.
- **Cls:** scripted 3D animation.
- **Sem (S1):** the subtitle reads "Time-consuming phases overlap across components" (`:55`). The blocks show Comp A in `main` while Comp B and C are still in `configure` (`:71-93`). In the default `uvm` domain, runtime phases are **synchronized across all components**: no component enters `configure` until every component's `reset`-phase objections have dropped. The visual teaches the opposite of the lesson's own sentence "proceed sequentially within their domain" (`I-UVM-1C/index.mdx:65`). Pre/post phases are omitted.
- **A11y:**
  - WebGL only. The fallback (`WebGLFallbackBoundary.tsx:30-31`) is a fixed `h-[600px]` box reading "3D Visualization unavailable", with no text alternative.
  - Labels are rendered via `<Html>` inside the canvas and are not reachable by AT.
  - OrbitControls are mouse/touch only.
  - The 10 s sweeping animation is not pausable and has no reduced motion.
- **Verdict:** Remove (or Replace with a 2D, accessible domain/sync diagram).

### 4.9 UvmPhaseTimelineVisualizer
`src/components/visualizers/UvmPhaseTimelineVisualizer.tsx`. Used in I-UVM-1C.
- **Cls:** static explorer (table + row animation + code panel).
- **Sem:**
  - **(S1)** The 12 standard runtime phases are flagged `isCustom: true` (`:40-51`), toggled by a "Show Custom Phases" button (`:194`) and labelled "(optional)" (`:260`). They are standard 1800.2 phases, not custom.
  - **(S1)** They are rendered and animated as rows *after* `run_phase`. The animation lights rows sequentially (`:157-168`), so `run_phase` appears to finish before `pre_reset_phase` starts. The concurrency the lesson highlights as a "Senior/Staff Interview Trap" (`index.mdx:60`) is contradicted.
  - Within a row, all components light up at once, so top-down vs bottom-up ordering is never shown.
  - Objections and phase-ending conditions are absent.
- **Code defects (S2):**
  - `'uvm_env:check_phase'` code calls `scoreboard.check_phase(phase);` (`:104`). The phasing engine already calls every component's `check_phase`, so this executes it twice.
  - Declarations appear after statements in `run_phase` snippets: `phase.raise_objection(this);\n  my_sequence seq = ...` (`:89`) and `@(posedge vif.clk);\n    my_txn txn = ...` (`:93`). This is illegal ordering in SV blocks; tools may error (Medium-High).
  - The env connect snippet uses an undeclared `coverage` (`:69`).
  - `uvm_test` "Defined By: uvm_component" (`:61`) should be `uvm_test`.
- **Tests lock in the mislabel:** `tests/components/UvmPhaseTimelineVisualizer.test.tsx:22,38` ("custom hidden" / "shows custom phases").
- **A11y:**
  - About 100 cell buttons contain only a coloured dot, with no accessible name (`:269-295`).
  - The close button has no name (`:322-328`).
  - The table is `min-w-[600px]` with horizontal scroll at 375px.
  - The dynamic `hover:${colors.active}` (`:274`) applies `hover:` only to the first of two classes.
- **Verdict:** Fix semantics. Render `run_phase` as a parallel lane beside the 12-phase schedule, label it "uvm schedule", and drop "custom".

### 4.10 UvmSequenceHierarchyVisualizer
`src/components/visualizers/UvmSequenceHierarchyVisualizer.tsx`. Used in I-UVM-3A.
- **Cls:** scripted stepper.
- **Sem:**
  - The order `start()` → `body()` → children → done (`:111-124`) omits `pre_start/pre_body/post_body/post_start`.
  - Each leaf compresses "start_item → randomize → finish_item handshake" into one step (`:116`), with no sequencer arbitration, no `get_next_item` and no `item_done`.
  - The virtual-sequence preset runs AXI and APB children sequentially. Real virtual sequences typically `fork…join` them. Not wrong, but the key coordination idea is missed.
- **Ped:** one Next button. No inputs, prediction or diagnosis.
- **A11y:** nodes are clickable `motion.div`s (`:178-185`) and not focusable. Status has a text badge (good). Light-only palette.
- **Verdict:** Upgrade to prediction-first (ask for the next event before stepping). Merge into the handshake flagship.

### 4.11 VirtualSequencerExplorer
`src/components/curriculum/interactives/VirtualSequencerExplorer.tsx`. Used in I-UVM-3B.
- **Cls:** scripted 5-step slideshow.
- **Sem:**
  - Dispatching is shown as sequential steps ("Dispatch PCIe" then "Concurrently … Ethernet"). The text says concurrent, but the visual is sequential.
  - Nothing shows `p_sequencer` / `m_sequencer` handles, `uvm_declare_p_sequencer`, or `start(p_sequencer.pcie_sqr)`.
- **A11y:** arrows are `hidden md:flex` (gone on mobile). There is a fixed `w-48` column. State is colour-only. There is no Back.
- **Verdict:** Replace (fold into the handshake/arbitration flagship) or Remove.

### 4.12 TLMPortConnector
`src/components/curriculum/interactives/TLMPortConnector.tsx`. Used in I-UVM-2B.
- **Cls:** scripted toggle.
- **Sem:**
  - **(S2)** The "txn packet" animates from Driver (left) to Sequencer (right) (`:89-99`). In the pull model the request/control call goes driver → sequencer, but the **item data flows sequencer → driver**. Showing the transaction moving toward the sequencer is backwards.
  - The unconnected-port error "unbound (null pointer)" (`:30`) is roughly right for `seq_item_port`, which has `min_size=0` so UVM does not flag it at elaboration. The tool does not teach the general rule that ports with `min_size>=1` are flagged at end of elaboration.
  - Titled "TLM Handshake" but there is no `get_next_item` / `item_done`.
- **A11y:**
  - On screens below `sm`, both the wire and the traffic animation are `hidden sm:flex/sm:block` (`:75,95`), so a 375px learner sees no connection at all.
  - The error message has no `role="alert"`.
- **Verdict:** Replace.

### 4.13 TlmConnectionBuilderVisualizer
`src/components/visualizers/TlmConnectionBuilderVisualizer.tsx`. Used in I-UVM-2B.
- **Cls:** static checker (learner builds connections, checks against an expected list). This is the best-structured instrument in scope.
- **Sem (S2):**
  - Compatibility is symmetric and kind-only:
    ```ts
    // TlmConnectionBuilderVisualizer.tsx:46-49
    if (a === 'port' && b === 'export') return true;
    if (a === 'export' && b === 'port') return true;
    ```
    UVM requires `port.connect(export)` (direction matters).
  - Legal hierarchical promotions (child port → parent port, `analysis_port` → parent `analysis_port`, parent export → child export/imp) are **rejected**.
  - Interface-type compatibility (blocking_put vs get) is not checked.
  - Scenario "Basic Agent … within a basic UVM agent" includes a Scoreboard (`:75-110`); scoreboards live in the env.
  - The error text says only "Cannot connect port to export"-style. It gives no *why* and no real UVM message.
- **Ped:** I good, D partial (missing-connection highlight), C– (no generated `connect_phase` code), P n/a, T 3 tiny scenarios.
- **A11y:**
  - Ports are SVG `<circle onClick>` with no tabIndex or role (`:457-469`), so it is **not keyboard operable**.
  - Port kind is colour-only, plus a `<title>` tooltip.
  - Fixed `NODE_W=180` geometry with `min-w-[500px]` scrolls at 375px.
- **Verdict:** Fix semantics, then make it a flagship (§8).

### 4.14 Analysis3D / Dataflow3D
`src/components/curriculum/interactives/3d/Analysis3D.tsx`, `Dataflow3D.tsx`. Both in I-UVM-2B.
- **Cls:** scripted 3D.
- **Sem (S3):**
  - Analysis3D draws `uvm_analysis_port` as a separate node between the monitor and subscribers (`:89`). It is a member of the monitor.
  - Fan-out pulses travel with time delay. In fact `write()` calls each subscriber's `write()` in zero time, in connection order, and a slow subscriber blocks nothing because `write` is a function. The animation hides why `write()` must not block.
  - Dataflow3D's pulse timing is decorative (`(t+delay)%4` reorders hops).
- **A11y:** same as 4.8. Analysis3D also `autoRotate` (`:115`) indefinitely.
- **Verdict:** Remove (keep one 2D broadcast diagram with an ordered call trace).

### 4.15 RALPredictorVisualizer
`src/components/visuals/RALPredictorVisualizer.tsx`. Used in A-UVM-4B.
- **Cls:** scripted stepper with a "mismatch" mode.
- **Sem (S1):**
  - The monitor → `uvm_reg_predictor` → `bus2reg` path is labelled **"Standard Implicit Prediction Flow"** and "Implicit Prediction" (`:55`, `:138`), and "mirror is implicitly updated" (`:251`).
  - In UVM terminology, *implicit/auto* prediction is `map.set_auto_predict(1)`, where the map updates the mirror on completion of `read()`/`write()` with no monitor. The predictor path shown is *explicit* prediction. The terminology is inverted.
  - The mirror simply becomes the written value (`:92`). Field access policies (W1C/RO/WO), `predict()` kinds and desired-vs-mirror are absent.
- **Ped:** debug mode offers hints ("Is AP connected?", "map/adapter null?"), which is good diagnostic framing, but they are scripted, not caused by the learner.
- **A11y:**
  - Light-only palette.
  - `px-12` three-column layout with absolute `w-[200px]` / `-left-32 -translate-x-full` labels (`:97-98,147`) overflows at 375px.
  - The step-5 text is `whitespace-nowrap` (`:251`).
- **Verdict:** Fix semantics and merge into the RAL flagship.

### 4.16 RalRegisterMapVisualizer
`src/components/visualizers/RalRegisterMapVisualizer.tsx`. Used in A-UVM-4A.
- **Cls:** conceptual model (field map + "frontdoor write" → mirror).
- **Sem (S1/S2):**
  ```ts
  // RalRegisterMapVisualizer.tsx:132-135
  let hasWritable = selectedReg.fields.some(f => ['RW','WO','W1C'].includes(f.access));
  if (hasWritable) { setMirrorValue(writeVal); ...
  ```
  - Writing `0xFFFF_FFFF` to CTRL sets the mirror to `0xFFFF_FFFF`, although bits [31:4] are RO reserved. UVM's predicted value is computed per field from its access policy.
  - There is no input validation: any string, e.g. "hello", becomes the "mirror".
  - No desired value, no `set()` / `update()` / `mirror(UVM_CHECK)` / `read()`. No volatile field (STATUS.BUSY), so the canonical mismatch scenario cannot be shown.
- **Tests:** `RalRegisterMapVisualizer.test.tsx` covers rendering only.
- **A11y:**
  - Field details are **hover-only** (`onMouseEnter`, `:252`), so they are unavailable to keyboard and touch.
  - The write input has no label (`:312-317`).
  - Access type is colour-coded, and the text appears only on hover.
- **Verdict:** Fix semantics, then upgrade into the RAL flagship.

### 4.17 RALHierarchy (unused)
`src/components/visuals/RALHierarchy.tsx`
- **Cls:** static explorer.
- **Sem:** draws `uvm_reg` as a child of `uvm_reg_map` (`:26-90`). Registers are owned by the block, and maps only reference them (one register can appear in several maps). It cites "IEEE 1800.2-2020 §18.1/18.2/18.4/18.5" (clause unverified by this audit).
- **A11y:** real buttons, the most accessible of the RAL set.
- **Verdict:** Remove, or fix the ownership model and reuse it inside the RAL flagship.

### 4.18 UvmPolicyVisualizer
`src/components/visuals/UvmPolicyVisualizer.tsx`. Used in I-UVM-4.
- **Cls:** scripted tabs (print/compare/pack/record/copy) over fixed data.
- **Sem (S3):**
  - Shows `uvm_default_printer = uvm_{fmt}_printer` (`:119`). In 1800.2 the global variables are replaced by `uvm_printer::set_default()` / `get_default()` (Medium-High).
  - The copy tab claims `uvm_copier` "recursively clones rather than aliasing" (`:279-281`). The actual behaviour depends on the field macro flags or the user's `do_copy`. A hand-written `do_copy` that does `cfg = rhs.cfg` aliases, which is a classic bug the tool could teach.
  - The compare result string "2 field(s) differ" is hard-coded (`:180`).
- **Ped:** no inputs. The learner cannot change a field or policy knob (e.g. `show_max`, `UVM_REFERENCE`) and see an effect.
- **A11y:** tab buttons have no `role=tab` / `aria-selected`. Dark-only palette.
- **Verdict:** Upgrade to prediction-first (e.g., predict the compare output with `UVM_NOCOMPARE` on a field).

### 4.19 UvmContainerVisualizer
`src/components/visuals/UvmContainerVisualizer.tsx`. Used in I-UVM-5.
- **Cls:** conceptual model (generic key/value demo).
- **Sem (S2):**
  - `uvm_pool` is described as a "Global singleton associative container with string keys" with weakness "No type safety on values" (`:27-30`).
  - In fact `uvm_pool #(KEY,T)` is parameterized and type-safe. Only `get_global_pool()` gives a per-specialization singleton, and instances are ordinary objects.
  - `uvm_pool::get(key)` **creates** a missing entry, the important gotcha, but the demo returns "Not found" (`:91-94`).
  - The same key/value demo is used for `uvm_queue` and SV queues. The `container` prop is never read (0 uses inside `ContainerDemo`, `:67-145`), so queues are taught as dictionaries.
- **A11y:** delete icon buttons have no name (`:111`). Inputs have only placeholders.
- **Verdict:** Fix semantics.

### 4.20 TransactionRecordingVisualizer
`src/components/visuals/TransactionRecordingVisualizer.tsx`. Used in I-UVM-6.
- **Cls:** scripted, with random data.
- **Sem:** plausible (`begin_tr` / `end_tr` → `do_record`). It does not mention that recording must be enabled (`recording_detail` / `enable_recording`), the most common "why is my stream empty" issue. Side effects run inside a state updater (`:34`).
- **Verdict:** Keep (low priority). Add the enablement knob as a corner case.

### 4.21 MethodologyPhaseVisualizer
`src/components/visuals/MethodologyPhaseVisualizer.tsx`. Used in E-CUST-1.
- **Cls:** conceptual model (insert a custom phase into a linear list, with warnings).
- **Sem (S2):**
  - The schedule is a single linear list that omits `run_phase` and all pre/post runtime phases (`:14-27`).
  - Only "insert after a cleanup phase" is flagged. Inserting a task phase between build and connect is not.
  - The generated code always targets the common domain:
    ```ts
    // MethodologyPhaseVisualizer.tsx:214-218
    uvm_phase after = uvm_${selectedInsertAfter}_phase::get();
    uvm_domain::get_common_domain()
      .add(${...}::get(), .after_phase(after));
    ```
  - For anchors like `reset` or `main`, which live in the `uvm` schedule, this should target `uvm_domain::get_uvm_schedule()` (Medium: I believe `add()` errors when the anchor is not in that schedule).
  - After a custom insert, `selectedInsertAfter` can be `custom_<timestamp>`, generating `uvm_custom_1696…_phase::get()`.
  - No `before_phase` is given, so the parallel-branch semantics are not explained.
  - "Cleanup phases … run after simulation time ends" (`:69`) is imprecise: they are zero-time functions at the end of the run.
- **Verdict:** Fix semantics.

### 4.22 VIPReuseVisualizer
`src/components/visuals/VIPReuseVisualizer.tsx`. Used in E-SOC-1.
- **Cls:** scripted toggle (active/passive).
- **Sem:** OK. The code says "Driver & Sequencer are NOT created" while the visual still draws them greyed out, a mild inconsistency. `uvm_config_db#(uvm_active_passive_enum)::set(...,"is_active",UVM_PASSIVE)` is correct.
- **Verdict:** Keep. Add a prediction ("which components exist after build in passive mode?").

### 4.23 TelemetryEventBusVisualizer
`src/components/visuals/TelemetryEventBusVisualizer.tsx`. Used in E-DBG-1.
- **Cls:** scripted (inject INFO/ERROR/hang).
- **Sem:** generic and not tied to UVM APIs (`uvm_report_catcher`, report server, `UVM_ERROR` actions, `set_report_severity_action`). `isPlaying` is unused.
- **Verdict:** Replace with a report-catcher / severity-action explorer, or Remove.

### 4.24 PssIntentMapVisualizer
`src/components/visualizers/PssIntentMapVisualizer.tsx`. Used in E-PSS-1.
- **Cls:** scripted target switcher.
- **Sem (S3):**
  - No PSS source is shown (no `action`, `activity` or flow-object/buffer declarations), only the graph and the "generated" outputs.
  - The UVM output models checking as a `verify_seq` sequence (`:104-107`), which is an anti-pattern (checks belong in a scoreboard).
  - The emulation output is pseudo-code.
- **Verdict:** Upgrade. Show the PSS model text and flow objects.

### 4.25 DebuggingSimulator (in the "Hang Lab")
`src/components/ui/DebuggingSimulator.tsx`. Used in E-DBG-1 `hang-lab.mdx`.
- **Cls:** scripted log viewer.
- **Sem (S1 for the lesson):**
  - The lesson promises three UVM hangs: missing `item_done()`, stuck objection, `grab()` leak, with "objection traces" (`hang-lab.mdx:16-23`).
  - The component takes **no props** (`export const DebuggingSimulator = () =>`, `:109`), so `scenario="hang"` is ignored.
  - It shows generic software scenarios instead (null pointer "at address 0x00", race, memory leak) (`:16-60`).
  - The memory-leak strategy, "Track allocations and ensure proper deallocation" (`:57`), is wrong for SystemVerilog, which is garbage-collected. Leaks come from retained handles (e.g. unbounded scoreboard queues).
- **Verdict:** Replace (this is the natural home of a hang-triage flagship).

### 4.26 Exercises
**UvmPhaseSorterExercise** (`src/components/exercises/UvmPhaseSorterExercise.tsx`)
- **Cls:** static checker.
- **Sem (S1):** `run_phase` has `correctOrder: 4` and `pre_reset` `4.1`, … `post_shutdown` `4.93` (`:39-52`). Scoring is positional against that list (`:195-198`). A learner who knows `run_phase` runs **concurrently** with the 12 runtime phases and places `pre_reset` first is marked wrong. The page's objective is "Understand the sequential nature of UVM phasing".
- **A11y:** good (dnd-kit KeyboardSensor, labelled grip buttons).
- **Verdict:** Fix semantics. Accept both orders, or model two lanes.

**SequencerArbitrationSandbox** (`src/components/exercises/SequencerArbitrationSandbox.tsx`)
- **Cls:** conceptual model.
- **Sem (S1):**
  - **SEQ_ARB_WEIGHTED is deterministic highest-priority with FIFO tie-break** (`evaluateWeightedWinner`, `:155-178`). That is SEQ_ARB_STRICT_FIFO behaviour. In UVM, WEIGHTED is a random choice weighted by priority. The linked lesson itself says weights give "more turns" (`sequence-arbitration.mdx:48`).
  - **The lock auto-releases** when its owner has no pending items (`:194-198`, `:272-275`). In UVM a lock is held until `unlock()`. Forgetting `unlock()` starves everyone, which is the lesson's own pitfall (`sequence-arbitration.mdx:46`). The sandbox hides the bug it should teach.
  - The lock is granted instantly on toggle. Real `lock()` is a request that waits in the arbitration queue.
  - A lock and a grab can be held simultaneously by different sequences (`lockOwner` and `grabOwner` are independent), which is impossible.
  - The lock always beats the grab regardless of acquisition order.
  - STRICT_FIFO, STRICT_RANDOM and USER are missing.
  - Arbitration happens on a button press, not when the driver calls `get_next_item`.
- **Verdict:** Fix semantics, then rebuild as a flagship.

**UvmAgentBuilderExercise** (`src/components/exercises/UvmAgentBuilderExercise.tsx`)
- **Sem (S3):** grades the *order* of Sequencer, Driver and Monitor inside the agent (`:48-56`, `:68-70`). There is no such order in UVM, so this is arbitrary. An agent config object is a valid inclusion but appears as a distractor.
- **Verdict:** Fix (grade membership plus the active/passive rule).

**ScoreboardConnectorExercise** (`src/components/exercises/ScoreboardConnectorExercise.tsx`)
- One port to two imps. Trivial but correct.
- **Verdict:** Keep (or fold into the TLM builder).

### 4.27 Out-of-UVM but in task list
- **Mailbox3D** (F2D):
  - `try_put()` overflows the bound:
    ```ts
    // Mailbox3D.tsx (try_put onClick)
    onClick={() => setMessages(Math.min(messages + 1, Math.min(messages + capacity, messages + 1)))}
    ```
    The expression is just `messages+1`. The button is never disabled, so the count goes to 6/5 and higher, and the "BACKPRESSURE" banner disappears (it checks `=== capacity`). `try_put` on a full bounded mailbox must return 0 and insert nothing.
  - Blocking `put()` / `get()` is modelled as a *disabled button* rather than a blocked process.
  - **Verdict:** Fix semantics (S2).
- **Constraint3D** (I-SV-2A): presents solving as branch pruning to a single "Solution", hiding that SV draws uniformly from the solution space. **Verdict:** Replace (SV agent).
- **Coverage3D:** unused. **Verdict:** Remove.
- **PacketSorterGame** (F2B):
  - Quiz. Item "don't know how many packets will arrive → Dynamic Array" is debatable; a queue is the idiomatic answer for unknown-count append.
  - Item "pre-empt the oldest … push_front()/pop_back()" is confusingly worded.
  - **Verdict:** Keep after fixing the two items.
- **EventSchedulerVisualizer** (E-PERF-1): SV scheduler; out of scope (SV agent).
- **InterviewQuestionPlayground:** MCQ with per-option explanations. **Verdict:** Keep as a pattern. Move it *before* the paired visual so it becomes prediction-first.

---

## 5. Findings

Format: ID · category · severity · confidence.

**F1 · Confirmed defect · S1 · High.** Factory override precedence is wrong in two interactives and inconsistent across the module.
- **Evidence:**
  - `FactoryOverrideVisualizer.tsx:43,61-63` (longest path wins).
  - `FactoryOverrideExplorerVisualizer.tsx:90-99` (tree: last match wins) vs `:118-122,134-136` (log: first match wins).
  - The lesson claims "the highest component in the hierarchy wins" (`I-UVM-1B/index.mdx:88`), which is config_db's rule, not the factory's.
  - UVM reference: instance overrides are first-registered-match; type overrides follow `replace` (latest wins by default); chaining applies.
- **Consequence:** learners cannot predict override outcomes. A predicted answer can be "right" in one widget and "wrong" in the other on the same page.
- **Correction:** one shared resolver module (`src/lib/uvm/factory-model.ts`) implementing registration-ordered instance queues, type-override `replace`, chaining, and a `$cast` compatibility error. Both widgets consume it, and the lesson text is corrected.
- **Acceptance:** table-driven Vitest cases. These include the default scenario, which expects `good_packet` for `uvm_test_top.env.agt.sqr`. Golden traces come from running the same overrides in a real UVM simulator, comparing against `factory.print()` / `debug_create_by_type` output.

**F2 · Confirmed defect · S1 · High.** The sequencer arbitration sandbox misimplements WEIGHTED, lock and grab.
- **Evidence:** `SequencerArbitrationSandbox.tsx:155-178`, `:194-198`, `:272-275`. It contradicts `sequence-arbitration.mdx:46-48`, which links to it as a mirror of the lesson.
- **Consequence:** learners internalize "weighted = highest priority wins" and "lock is released automatically". Both cause real starvation and hang bugs to be misdiagnosed.
- **Correction:** model the request queue with per-request priority. Implement all six modes, with WEIGHTED as a seeded weighted random and a histogram over N grants. Make lock/grab requests queue entries (grab at the front, lock at the back), with no auto-release, and show a starvation warning when a lock owner has no pending items.
- **Acceptance:**
  - Over 10k seeded grants with priorities 1:3, WEIGHTED gives ≈25/75%.
  - STRICT_FIFO is deterministic.
  - A lock held with no pending items blocks others indefinitely and shows a "starvation: missing unlock()" diagnostic.
  - Simultaneous lock and grab by different sequences is impossible.

**F3 · Confirmed defect · S1 · High.** Phase concurrency and synchronization are taught wrongly by three instruments.
- **Evidence:**
  - `UvmPhaseTimelineVisualizer.tsx:40-51,194,260` ("custom"/"optional"; sequential row animation `:157-168`).
  - `UvmPhaseSorterExercise.tsx:39-52` (`run_phase` graded before `pre_reset`).
  - `PhaseTimeline3D.tsx:55,71-93` (components in different runtime phases at once).
  - The lesson states the opposite (`I-UVM-1C/index.mdx:60-66`).
- **Consequence:** directly undermines the outcome "predict when a phase ends" and the interview point the lesson highlights.
- **Correction:** a two-lane model (common: `run_phase`; uvm schedule: 12 phases), with cross-component sync barriers per runtime phase and per-phase objection counters. Relabel as standard phases. Sorter: accept the concurrent placement or use two lanes.
- **Acceptance:** a unit test asserts `isCustom` is absent for the 12 standard phases. A sorter test accepts `pre_reset` before or alongside `run_phase`. A scenario test: if comp A's `reset_phase` holds an objection, no component enters `configure_phase`.

**F4 · Prototype/gated + Missing coverage · S2 · High.** Core UVM mechanisms have only placeholders or nothing.
- **Evidence:**
  - Handshake placeholder in I-UVM-2B, I-UVM-3A and I-UVM-3B (`sequencer-driver-handshake.mdx:18-20`).
  - Self-referential CTAs (`AnimatedUvmSequenceDriverHandshakeDiagram.tsx:10`, `UvmPhasingDiagram.tsx:10`).
  - Placeholders in I-UVM-1C, I-UVM-2A and I-UVM-3B `virtual-sequences.mdx`.
  - PracticeHub marks placeholder pages "completed" (`PracticeHub.tsx` items "UVM Component Relationships", "UVM Phasing Diagram").
  - No interactive at all for objections/drain, config_db precedence, RAL desired/mirror, callbacks, scoreboards or multi-agent (A-UVM-5..8).
- **Correction:** remove placeholders from lessons now (render nothing, or a static diagram with a caption). Build the flagships in §8.
- **Acceptance:** `grep DiagramPlaceholder` finds no consumers reachable from `content/curriculum`. PracticeHub statuses are derived from a manifest that a test checks against component type.

**F5 · Confirmed defect · S1 · High.** RAL prediction terminology is inverted, and the mirror model ignores field access.
- **Evidence:** `RALPredictorVisualizer.tsx:55,138,251`; `RalRegisterMapVisualizer.tsx:132-135`.
- **Consequence:** learners mislabel auto vs explicit prediction (a staple interview and debug distinction) and believe RO bits mirror written values.
- **Correction:** label the paths "auto-predict (`set_auto_predict(1)`)" and "explicit predictor (`uvm_reg_predictor` + monitor)". Compute the predicted value per field access policy (RW, RO, WO, W1C, W1S, RC…). Show desired and mirrored values side by side with `set` / `update` / `write` / `read` / `mirror(UVM_CHECK)`. Add a volatile STATUS field to provoke a mismatch.
- **Acceptance:** Vitest table of (access, old, written) → predicted mirror for each policy. Writing `0xFFFFFFFF` to CTRL yields `0x0000000F`. `mirror(UVM_CHECK)` after a hardware change to BUSY reports a mismatch.

**F6 · Confirmed defect · S1 (quiz) / S2 (UI) · High.** UVMTreeExplorer teaches a wrong `super.build_phase` consequence and hides its main control.
- **Evidence:** `UVMTreeExplorer.tsx:281-283`; `:224` escaped `\${…}`; `:141` forced white background.
- **Correction:**
  - Rewrite the item. Correct answer: the driver is unaffected. The agent's own auto-config (e.g. `is_active`) is skipped, so a passive config may be ignored and the driver created anyway.
  - Fix the template literal and the background.
- **Acceptance:** a snapshot or RTL test that the button has a `bg-*` class, and an axe colour-contrast pass in light and dark modes.

**F7 · Confirmed defect · S1 · High.** The Hang Lab is not a hang lab.
- **Evidence:** `hang-lab.mdx:16-23` vs `DebuggingSimulator.tsx:16-60,109`. The "ensure proper deallocation" advice is wrong for SV.
- **Correction:** scenario-driven triage. Inject a missing `item_done`, a stuck objection or a grab leak. Show `+UVM_OBJECTION_TRACE`-style output, `phase_timeout` fatal text and the sequencer state. The learner names the root cause before the fix is revealed.
- **Acceptance:** each of the 3 scenarios requires a correct diagnosis choice before the reveal, and the explanations cite the UVM mechanism.

**F8 · Confirmed defect · S2 · High.** TLM direction and hierarchy rules are misrepresented.
- **Evidence:** `TLMPortConnector.tsx:89-99` (data shown moving driver→sequencer); `TlmConnectionBuilderVisualizer.tsx:44-51,75-110`.
- **Correction:** directional connect (`port.connect(export|imp|port-up)`). Accept legal hierarchical promotions and reject `export.connect(port)`. Add interface-type checks and emit UVM-like messages (e.g. connection count below `min_size`, clause unverified). Generate the `connect_phase` code.
- **Acceptance:** a unit test matrix over (src kind, dst kind, hierarchy relation), with expected legality matching the UVM reference.

**F9 · Confirmed defect · S2 · Medium.** The custom-phase code pattern is wrong for runtime anchors and can emit garbage.
- **Evidence:** `MethodologyPhaseVisualizer.tsx:214-218`.
- **Correction:** emit `uvm_domain::get_uvm_schedule()` (or a user domain) for runtime anchors. Add `before_phase`. Disallow custom anchors in the generated code.
- **Acceptance:** generated code compiles and runs in a real UVM environment (validated once by the team with a commercial or UVM-capable simulator).

**F10 · Confirmed defect · S2 · High.** UVM containers are misdescribed.
- **Evidence:** `UvmContainerVisualizer.tsx:27-30,67-145`.
- **Correction:** describe `uvm_pool#(KEY,T)` accurately, show `get()` auto-create, and give queues push/pop semantics.

**F11 · Confirmed defect · S2 · High.** `Mailbox3D` `try_put` exceeds the bound (§4.27).

**F12 · Confirmed defect · S2 · Medium-High.** Phase-timeline code snippets would mislead (double `check_phase` call; declarations after statements).
- **Evidence:** `UvmPhaseTimelineVisualizer.tsx:89,93,104`.

**F13 · Interaction weakness · S2 · High.** ConfigDbExplorer omits precedence, type/field mismatch and set timing (§4.4).

**F14 · Interaction weakness (a11y) · S2 · High.**
- **Evidence:**
  - Zero reduced-motion handling in `src/`.
  - Keyboard-inaccessible controls: `FactoryOverrideVisualizer.tsx:99-106`, `UvmSequenceHierarchyVisualizer.tsx:178-185`, `TlmConnectionBuilderVisualizer.tsx:457-469`.
  - Hover-only content: `RalRegisterMapVisualizer.tsx:252`.
  - Unnamed controls: `UvmPhaseTimelineVisualizer.tsx:269-295,322`.
  - 3D canvases with no text alternative (`WebGLFallbackBoundary.tsx:30-31`).
  - Mobile-hidden essentials: `TLMPortConnector.tsx:75,95`; `VirtualSequencerExplorer.tsx:35`.
  - Overflow at 375px: `RALPredictorVisualizer.tsx:97-98,147`.
  - Lab workspace: fixed `w-80` aside with no stacking (`LabClientPage.tsx:262`), which leaves about 55px for the editor at 375px.
- **Correction:** shared `useReducedMotion` gating. Every interactive control is a `<button>` or has role/tabIndex/keyboard handlers. Use text plus colour. Provide a 2D/text fallback for every canvas. Use a responsive lab layout.
- **Acceptance:** Playwright + axe at 375×812 and 1280 for every UVM lesson page, with 0 serious/critical violations. Keyboard-only completion of each checker. Reduced-motion emulation stops all looping animation.

**F15 · Confirmed defect (capability vs claim) · S1 · High.** The lab workspace and simulation cannot verify UVM work. See §7.

**F16 · Unverified concern → Confirmed process gap · S3 · High.** The unit tests for these components assert only rendering and UI state, never semantics. Some lock in defects:
- `UvmPhaseTimelineVisualizer.test.tsx:22,38` (custom phases).
- `FactoryOverrideExplorerVisualizer.test.tsx` (no precedence case).

**Correction:** semantic golden tables per model (F1, F2, F3, F5, F8).

**F17 · Confirmed defect · S3/S4.**
- Sunburst inheritance (`UvmHierarchySunburstChart.tsx:21-43`; unused).
- Agent builder grades order (`UvmAgentBuilderExercise.tsx:48-70`).
- Analysis broadcast timing (`Analysis3D.tsx:89,101-109`).
- Deprecated printer global (`UvmPolicyVisualizer.tsx:119`).
- RALHierarchy ownership (`RALHierarchy.tsx:26-90`).

---

## 6. Top 10 issues (ranked by learner harm)

1. **F15** The lab "simulation" cannot compile UVM and "passed" means only that it compiled and exited 0. All UVM labs are self-attested, so there is no verified apply/debug outcome anywhere in the UVM track.
2. **F1** Factory precedence: three contradictory rules on one page, none of them UVM's.
3. **F3** Phase concurrency and sync are contradicted by three instruments, against the lesson's own "interview trap".
4. **F2** The arbitration sandbox treats WEIGHTED as strict priority and auto-releases `lock()`. It is linked as the lesson's hands-on mirror.
5. **F4** The handshake, phasing, virtual-sequencer and testbench diagrams are placeholders in live lessons, and there are no interactives for objections, config precedence, RAL desired/mirror, callbacks, scoreboards or multi-agent.
6. **F5** RAL: implicit and explicit prediction are swapped, and the mirror ignores access policies.
7. **F7** The Hang Lab shows generic null-pointer and memory-leak cards and ignores its promised UVM hang scenarios.
8. **F6** The UVMTreeExplorer quiz answer is wrong, and its Simulate button is invisible in light mode.
9. **F8** TLM direction and hierarchy rules: the pull data flow is drawn backwards, and legal port→port and analysis_port→analysis_port promotions are rejected.
10. **F14** Accessibility: no reduced motion anywhere, keyboard-inaccessible core controls, hover-only RAL details, canvas-only 3D, and a lab workspace unusable at 375px.

(Close runners-up: F13 config_db precedence missing, F10 containers, F12 code snippets.)

---

## 7. What the lab workspace and simulation actually verify

**Flow:** `src/app/(learning)/practice/lab/[labId]/LabClientPage.tsx` → `CodeExecutionEnvironment.tsx` → `/api/simulate` → `src/server/simulation/{index,worker,docker-sandbox}.ts` → `simulation-runner/{Dockerfile,run-simulator.py}`.

1. **Availability:**
   - Simulation runs only if `SIMULATION_QUEUE_URL` is set or `SIMULATION_LOCAL_DOCKER=true` (`src/server/simulation/index.ts:107-110,141-147`).
   - Otherwise it errors with `SIMULATION_EXECUTION_NOT_CONFIGURED`.
   - The runner image is built locally (`package.json:23`) from `debian:bookworm-slim` + `apt install iverilog verilator` (`simulation-runner/Dockerfile:3-4`).
2. **No UVM:**
   - The image contains **no UVM library** (no `uvm_pkg`, no `uvm_macros.svh`, no `+incdir`).
   - The compile commands are `iverilog -g2012 -o … *.sv` and `verilator --binary --timing -Wno-fatal …` (`run-simulator.py:39-45`).
   - Every UVM lab source that does `import uvm_pkg::*` / `` `include "uvm_macros.svh" `` (20+ files: `config_debug`, `scoreboard*`, `uvm_capstone`, `ral_advanced`, `uvm_callbacks`, `methodology_customization`, `axi_scoreboard`, `uvm_debug`, `soc_level`, …) **cannot compile**.
   - Even with a UVM tree added, Icarus cannot elaborate UVM. Debian bookworm's Verilator (5.0.x) is not a reliable UVM host (Medium).
3. **Missing files:**
   - Only editable `.sv` files are sent (`LabClientPage.tsx:69-72,336-343`).
   - Reference testbenches, interfaces and DUTs are omitted, e.g. `config-debug` sends `driver.sv`/`testbench.sv` but not `env.sv`/`my_if.sv`, and `ahb-checker-lab` omits `testbench.sv`.
   - So many labs would fail to elaborate even without UVM.
4. **What "passed" means:**
   - `passed = compile_rc == 0 and run_rc == 0` (`run-simulator.py:53`).
   - `$error`, `` `uvm_error ``, scoreboard mismatches or a "TEST FAILED" print do **not** change the result unless the process exits non-zero.
   - Output is truncated to 1,800 chars.
5. **Coverage:** always `0` (`run-simulator.py:56`). The UI shows "Reported coverage: 0%" (`CodeExecutionEnvironment.tsx:157`) because `coverage` is a number (0), not null. This is misleading.
6. **Grading:**
   - Of 29 lab manifests, only `basics-1` has a `graderId` (`sv-basics-v1`). That grader tokenises the source and checks for an expected token subsequence (`src/lib/lab-graders.ts:34-57`), with no compile.
   - Every other available lab (18 available, including all UVM, RAL, AXI and AHB labs) uses `completion: "self_attested"`. A "Mark step complete & continue" button records completion with no check (`LabClientPage.tsx:217-258,328-331`).
   - Graders with `requiresSandbox` return `GRADING_QUEUE_UNAVAILABLE` (`src/app/api/labs/run/route.ts:53-55`).
7. **Learner feedback in practice:**
   - For UVM labs: raw compiler errors from Icarus/Verilator about unknown `uvm_*` identifiers, or a "configure SIMULATION_QUEUE_URL" error. Then self-attestation.
   - **Nothing in the platform verifies that a learner can build, run or debug a UVM testbench.**

**Recommended correction:**
- A UVM-capable runner: pin a UVM 1800.2 reference release plus a simulator verified to run it. Validate with a known-good `hello_uvm` and each lab's solution.
- Send all lab assets (read-only ones included).
- A per-lab trusted harness that parses `UVM_ERROR`/`UVM_FATAL` counts from the report summary and scoreboard results. `passed` should require 0 errors and the expected checks executed.
- `coverage: null` unless measured.
- Grade by behaviour (mutation tests: the buggy starter must fail and the solution pass).

**Acceptance:** for every available UVM lab in CI, the solution passes, the starter fails, and the failure diagnostic names the injected bug.

---

## 8. Recommended flagship interactives (build or fix these five; retire the rest)

Each should be a single deterministic model in `src/lib/uvm/*`, with golden tests derived from real UVM runs. It should follow prediction-first (commit an answer → run → see trace → explanation) and show the exact UVM code and the log text a simulator would print. It needs bug injection for debug practice, keyboard and screen-reader support, reduced motion, and 375px layouts.

1. **Sequencer–Driver Handshake & Arbitration Lab.** Replaces the handshake placeholder, VirtualSequencerExplorer and UvmSequenceHierarchyVisualizer, and fixes SequencerArbitrationSandbox.
   - Model: `start_item → wait_for_grant → (arbitration) → get_next_item → item_done(rsp) → put_response/get_response`, and the 6 arbitration modes.
   - Lock/grab queue semantics, `is_relevant`, and virtual sequences forking onto sub-sequencers.
   - Bugs: missing `item_done` (hang), forgotten `unlock` (starvation), response-queue overflow.
2. **Phasing & Objections Lab.** Replaces the PhaseTimeline3D, UVMTreeExplorer and phasing placeholders, and fixes UvmPhaseTimelineVisualizer and PhaseSorter.
   - Two lanes (`run_phase` ∥ uvm schedule), depth-first top-down/bottom-up traversal order, and cross-component runtime sync.
   - Objection counters with drain time and `phase_timeout`.
   - Prediction: "When does `main_phase` end?"
   - Bugs: objection raised only in `run_phase`, never-dropped objection.
3. **Factory + config_db Resolver.** Replaces both factory widgets and ConfigDbExplorer.
   - Factory: registration-ordered instance overrides, type `replace`, chaining, `$cast` failure, and override timing relative to `create()`.
   - config_db: context precedence during build vs last-write after, type and field mismatch, wildcard scope.
   - Shows `factory.print()`-style and `+UVM_CONFIG_DB_TRACE`-style output.
4. **RAL Desired/Mirror Lab.** Replaces RALPredictorVisualizer, RalRegisterMapVisualizer and RALHierarchy.
   - Per-field access policies, `set` / `update` / `write` / `read` / `mirror(UVM_CHECK)` / `predict`.
   - Auto vs explicit prediction with a toggle.
   - Volatile fields, a missing predictor connection, and a wrong `bus2reg`.
5. **TLM Connection Builder v2.** Fixes TlmConnectionBuilderVisualizer and absorbs TLMPortConnector and ScoreboardConnector.
   - Directional, hierarchy-aware legality and interface-type compatibility.
   - Generated `connect_phase` code.
   - Synchronous analysis `write()` fan-out trace (zero-time, ordered).
   - Scenarios: agent, env with FIFO, hierarchical promotion through agent and env, multi-agent scoreboard (fills the A-UVM-6/8 gap).

**Keep as-is or with light fixes:** InteractiveUvmArchitectureDiagram (as navigation), VIPReuseVisualizer (add a prediction), TransactionRecordingVisualizer (add the enablement knob), InterviewQuestionPlayground (move before visuals), ScoreboardConnectorExercise.

**Remove:** Analysis3D, Dataflow3D, PhaseTimeline3D, Coverage3D, UvmHierarchySunburstChart, the 8 placeholders (from lessons and registry), TelemetryEventBusVisualizer (unless rebuilt around `uvm_report_catcher`), and the dead `UvmHeroDiagram`.

---

## 9. AMBA visuals (listed only; covered by a separate agent)
- `ProtocolWaveform` (`src/components/mdx/ProtocolWaveform.tsx`): B-AHB-1, B-AHB-2, B-AXI-1
- `AmbaFamilyExplorer`: B-AMBA-1
- `ProtocolAnalogyExplorer`: B-AMBA-2
- `AhbPipelineBurstVisualizer`: B-AHB-1
- `AxiChannelHandshakeVisualizer`: B-AXI-1
- `AxiMemoryMathVisualizer`: B-AXI-2
- `AxiIdOrderingVisualizer`: B-AXI-3
- `ExclusiveAccessVisualizer`: B-AXI-4
- `AxiDeadlockSimulator`: B-AXI-5
- `BridgeTranslationExplorer`: B-AMBA-F1

(All in `src/components/visualizers/` unless noted. Not audited here. B-AHB-3, B-AMBA-F2, B-AMBA-F3 and B-AXI-6 have no interactive.)

---

## 10. Confidence and limits
- **Factory first-match rule:** verified against the UVM 1.2 class reference text (verificationacademy.com, `uvm_factory`). Carry-over to 1800.2-2020 is Medium-High.
- **Arbitration mode semantics, phase sync, auto vs explicit prediction, `uvm_pool::get` auto-create, `super.build_phase` scope:** expert knowledge, High.
- **Custom-phase `add()` behaviour (F9), `uvm_default_printer` deprecation, Verilator UVM capability:** Medium.
- **Rendering and visual effects (F6 invisible button, dark-mode contrast, 375px overflow):** inferred from source, not observed in a browser (no dev server or browser run in this read-only audit). Confidence Medium-High.
