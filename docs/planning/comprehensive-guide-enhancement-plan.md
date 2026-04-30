# Comprehensive Guide Enhancement Plan

Produced: 2026-04-26  
Status: Ready for execution  
Source audit: `docs/planning/comprehensive-guide-audit-report-2026-04-26.md`  
Tracking source of truth: `TASKS.md` rows 61-75

## Objective

Upgrade `sv-uvm-guide` from a broad SV/UVM/AMBA curriculum into a comprehensive, source-backed learning and interviewing guide for junior, mid-level, senior, staff, and senior staff verification engineers.

The workstream must prioritize correctness first, then interview usefulness, then breadth and polish. Protocol, language, and UVM claims must be tied to primary sources before they are expanded.

## Audit Baseline

| Dimension | Score | Main Risk |
| --- | ---: | --- |
| Technical accuracy | 58/100 | AXI 4KB wording, AHB HREADY/HREADYOUT framing, SV scheduling regions, UVM phase concurrency |
| Interview readiness | 55/100 | Only AMBA has a reusable question bank; rubrics/model answers are missing |
| Learning progression | 65/100 | Good beginner scaffold, weak staff/senior-staff progression |
| Labs/projects | 52/100 | No full UVM capstone, staff SoC strategy capstone, or formalized lab schema gate |
| Visualizers | 60/100 | Strong AMBA visuals, missing scheduling/coherency/RAL mirror views and accessibility checks |
| Flashcards | 62/100 | Several protocol decks are thin and some topic families lack decks |
| QA/testing | 48/100 | No source metadata gate, interview-bank schema, lab schema, or broad broken-link regression |

Target readiness after this workstream: 85+/100 overall, with no open P0 technical accuracy findings.

## Source Policy

Use primary sources for normative protocol, language, and UVM claims:

| Area | Required primary source |
| --- | --- |
| AXI/ACE | Arm AMBA AXI and ACE Protocol Specification, IHI0022H |
| AHB-Lite | Arm AMBA 3 AHB-Lite Protocol Specification, IHI0033B or current Arm-hosted revision |
| CHI | Arm AMBA 5 CHI Architecture Specification, IHI0050F or current Arm-hosted revision |
| SystemVerilog/SVA | IEEE 1800-2023 SystemVerilog standard |
| UVM | IEEE 1800.2-2020 UVM standard and Accellera UVM resources |

Secondary sources, such as Siemens, Synopsys, Cadence, Arm implementation guides, and AMD/Xilinx docs, are allowed for methodology examples only. Blog posts, forums, and university notes are tertiary and must be explicitly labeled.

## Execution Protocol

1. Read `SESSION_HANDOFF.txt`, `TASKS.md`, and this plan before editing.
2. Pick the first `todo` task in `TASKS.md` rows 61-75 unless the user redirects.
3. Update status in `TASKS.md` before and after each task: `todo` -> `in_progress` -> `complete`.
4. Keep this plan as the detailed acceptance reference; update it only when scope or acceptance changes.
5. For each implementation batch, update `SESSION_HANDOFF.txt` with changed files, validation, residual risks, and next task.
6. Do not mark a task complete until the acceptance criteria pass or the limitation is documented in `SESSION_HANDOFF.txt`.

## Recommended Execution Order

1. P0 accuracy corrections: `BACK-01`, `BACK-02`, `BACK-03`.
2. Core interview infrastructure: `BACK-04`, `BACK-05`.
3. Senior/staff practice projects: `BACK-06`, `BACK-07`, `BACK-08`, `BACK-09`.
4. Coherency and senior-staff depth: `BACK-10`.
5. Quality gates and automation: `BACK-11`, `BACK-14`.
6. Visualizer and retention polish: `BACK-12`, `BACK-13`, `BACK-15`.

## Backlog Summary

| ID | Priority | Status | Depends On | Primary Surfaces |
| --- | --- | --- | --- | --- |
| BACK-01-HREADY-HREADYOUT-CORRECTION | P0 | complete | none | AHB curriculum, AHB visualizer, AHB flashcards |
| BACK-02-AXI-4KB-RULE-CORRECTION | P0 | complete | none | AXI burst curriculum, bridge curriculum, burst visualizer, AXI flashcards |
| BACK-03-SV-SCHEDULING-REGIONS | P0 | complete | none | SV scheduling modules, clocking-block content, scheduling visualizer, flashcards |
| BACK-04-INTERVIEW-BANKS-RUBRICS | P1 | complete | BACK-01, BACK-02, BACK-03 | `content/interview-questions/`, schema tests |
| BACK-05-UVM-PHASING-CONCURRENCY | P1 | complete | none | I-UVM phasing module, phase visualizer, UVM interview bank |
| BACK-06-AXI-DEADLOCK-LAB | P1 | complete | BACK-02 | AXI labs, deadlock curriculum, lab registry |
| BACK-07-BRIDGE-SPLIT-TRANSACTION-LAB | P1 | complete | BACK-01, BACK-02 | bridge labs, bridge curriculum, lab registry |
| BACK-08-MINI-UVM-CAPSTONE | P1 | complete | BACK-04 | UVM capstone lab, scoreboards/coverage/factory topics |
| BACK-09-SOC-VERIFICATION-STRATEGY | P1 | complete | BACK-04, BACK-08 | staff-level SoC module, strategy capstone lab |
| BACK-10-ACE-CHI-COHERENCY-DEEPENING | P1 | complete | BACK-04 | ACE/CHI curriculum, coherency interview bank, flashcards |
| BACK-11-SOURCE-METADATA-GATE | P1 | complete | BACK-01, BACK-02, BACK-03 | MDX frontmatter, source schema tests |
| BACK-12-VISUALIZER-ACCURACY-A11Y | P2 | complete | BACK-01, BACK-03 | Improve visualizer accuracy, accessibility labels, color-independent state cues, and reduced-motion behavior. |
| BACK-13-FLASHCARD-DEPTH-ALIGNMENT | P2 | complete | BACK-01, BACK-02, BACK-10 | Expand thin decks and add missing senior/staff flashcard decks with registration tests. |
| BACK-14-E2E-REGRESSION-GATES | P2 | complete | BACK-11 | Playwright navigation, lab links, broken-link crawler |
| BACK-15-AI-CONTENT-CLAIM-TIGHTENING | P3 | complete | none | AI-driven verification curriculum and flashcards |

## Task Details

### BACK-01-HREADY-HREADYOUT-CORRECTION

Priority: P0  
Problem: AHB content risks conflating `HREADY`, the bus-level signal observed by masters/slaves, with `HREADYOUT`, the per-slave ready output.  
Primary source: Arm AMBA 3 AHB-Lite Protocol Specification, IHI0033B.

Scope:
- Audit AHB curriculum, AHB labs, AHB flashcards, and `AhbPipelineBurstVisualizer`.
- Correct language that says or implies "HREADY is the slave's ready output."
- Teach that the selected slave drives `HREADYOUT`; interconnect/slave mux logic produces `HREADY`; slaves also sample `HREADY` for pipelined timing.
- Add or update quiz/flashcard checks around HREADY/HREADYOUT.

Acceptance criteria:
- `rg "HREADY indicates the slave|slave pulls HREADY" content src` returns no incorrect framing.
- AHB lesson includes a sourced explanation of `HREADY` vs `HREADYOUT`.
- AHB flashcard deck includes at least one HREADY/HREADYOUT card.
- If the visualizer is touched, it either shows HREADY/HREADYOUT distinctly or its simplified model is explicitly labeled.

Validation:
- `npm run generate:curriculum`
- `npm run type-check`
- `npm test -- tests/amba-curriculum-content.spec.ts tests/components/AhbPipelineBurstVisualizer.test.tsx`

### BACK-02-AXI-4KB-RULE-CORRECTION

Priority: P0  
Problem: Some AXI 4KB boundary wording may be too imprecise for interview or protocol-checker use.  
Primary source: Arm AMBA AXI and ACE Protocol Specification, IHI0022H.

Scope:
- Audit `B-AXI-2`, `B-AXI-5`, `B-AMBA-F1`, bridge labs, burst math flashcards, and burst visualizer labels.
- State that every beat address in a burst must remain inside the same 4KB page as the first transfer.
- Include formula-style checks using start page, last byte address, transfer size, and beat count.
- Separate INCR boundary rules from WRAP burst natural-alignment requirements.

Acceptance criteria:
- AXI burst math lesson has formula and sourced wording.
- AXI flashcards include the formula and wrap-burst distinction.
- Tests cover legal and illegal 4KB examples.

Validation:
- `npm run generate:curriculum`
- `npm test -- tests/components/AxiMemoryMathVisualizer.test.tsx tests/components/BridgeTranslationExplorer.test.tsx tests/amba-flashcards.spec.ts`
- `npm run build`

### BACK-03-SV-SCHEDULING-REGIONS

Priority: P0  
Problem: SV scheduling content omits Observed/Reactive detail needed for clocking-block and SVA interview accuracy.  
Primary source: IEEE 1800-2023, scheduling semantics and assertion scheduling sections.

Scope:
- Audit F3 scheduling modules, F4 clocking-block module, and SVA fundamentals.
- Add clear explanation of major scheduling regions, especially Active, NBA, Observed, Reactive, and Postponed.
- Add code examples showing race-prone `@(posedge clk)` driving versus clocking-block sampling/driving.
- Create or enhance scheduling flashcards.
- Add a visual timeline task if no existing visualizer can be safely expanded.

Acceptance criteria:
- Scheduling content explains Observed/Reactive and clocking-block sampling/driving.
- New or updated deck has at least 8 scheduling cards.
- Interview/trick question exists for clocking-block region semantics.

Validation:
- `npm run generate:curriculum`
- `npm test -- tests/curriculum-navigation.spec.ts tests/topicTemplate.spec.ts`
- `npm run build`

### BACK-04-INTERVIEW-BANKS-RUBRICS

Priority: P1  
Problem: Interview preparation is not yet comprehensive outside AMBA and lacks rubrics/model answers.  
Primary surfaces: `content/interview-questions/`, schema tests, staff-level curriculum.

Scope:
- Define a reusable interview-bank schema with fields: `id`, `topic`, `level`, `category`, `prompt`, `rubric`, `model_answer`, `sources`.
- Add banks for SystemVerilog, UVM, SVA/Formal, Debug, SoC/System Design, and AMBA expansion.
- Include categories: concept, waveform/debug, coding, verification-plan, trick, staff system-design.
- Add tests that validate schema and coverage matrix.

Acceptance criteria:
- Each major topic family has at least junior/mid/senior coverage.
- Staff/senior-staff banks exist for methodology, SoC strategy, coherency, and system-design interviews.
- Every question has rubric and model answer.

Validation:
- `npm test -- tests/interview-questions`
- `npm run type-check`

### BACK-05-UVM-PHASING-CONCURRENCY

Priority: P1  
Problem: UVM phase content needs the senior-level trap detail that `run_phase` executes concurrently with runtime sub-phases.  
Primary source: IEEE 1800.2-2020 UVM.

Scope:
- Audit `I-UVM-1C_UVM_Phasing` and phase visualizer content.
- Add swimlane explanation of `run_phase` and runtime phases.
- Add trick interview question and model answer in UVM bank.

Acceptance criteria:
- UVM phasing page explicitly explains concurrency, objections, and common failure modes.
- Interview bank includes at least one staff-level phase-debug prompt.

Validation:
- `npm run generate:curriculum`
- `npm test -- tests/components/UvmPhaseTimelineVisualizer.test.tsx`

### BACK-06-AXI-DEADLOCK-LAB

Priority: P1  
Problem: Existing AXI deadlock content needs a formalized lab with broken RTL/SVA acceptance criteria if the current lab does not meet that bar.  
Primary source: Arm IHI0022H channel dependency rules.

Scope:
- Audit existing AXI deadlock lab before creating new files.
- Ensure starter RTL/testbench contains a clear circular/channel-dependency deadlock.
- Require learners to write an assertion or watchdog that catches the issue.
- Provide complete solution and expected output.

Acceptance criteria:
- Lab has `lab.json`, `README.md`, starter, checker, solution, acceptance criteria.
- Linked from the AXI deadlock curriculum page.
- Registered in lab registry.

Validation:
- `npm test -- tests/lib/lab-registry.test.ts`
- `npm run build`

### BACK-07-BRIDGE-SPLIT-TRANSACTION-LAB

Priority: P1  
Problem: Bridge practice should explicitly test address/data decoupling, split ordering, and source-side backpressure behavior.  
Primary sources: Arm IHI0022H and IHI0033B.

Scope:
- Audit existing AHB-to-AXI bridge debug lab first.
- Add missing HREADY/HREADYOUT, split/ordering, data-beat accounting, and acceptance criteria if needed.
- Avoid duplicating lab content; enhance the existing lab when possible.

Acceptance criteria:
- Lab catches incorrect 4KB split math and write-data ordering.
- Lab explains source-side backpressure behavior precisely.
- Solution and checker are complete.

Validation:
- `npm test -- tests/lib/lab-registry.test.ts tests/amba-curriculum-content.spec.ts`
- `npm run build`

### BACK-08-MINI-UVM-CAPSTONE

Priority: P1  
Problem: The curriculum lacks a unifying mid-to-senior UVM capstone.  
Primary source: IEEE 1800.2-2020 UVM.

Scope:
- Create a mini UVM environment lab around a simple FIFO or packet DUT.
- Require agent, sequencer, driver, monitor, scoreboard, coverage, factory override, and one deliberate DUT bug.
- Include a solution and acceptance criteria.

Acceptance criteria:
- Learner can run through the architecture from sequence to scoreboard.
- Solution demonstrates coverage closure and scoreboard failure on injected bug.
- Linked from relevant UVM modules.

Validation:
- `npm run generate:curriculum`
- `npm test -- tests/lib/lab-registry.test.ts`
- `npm run build`

### BACK-09-SOC-VERIFICATION-STRATEGY

Priority: P1  
Problem: Staff-level SoC verification strategy content and capstone are missing.  
Primary sources: UVM standard for methodology primitives; vendor docs only for methodology examples.

Scope:
- Create or deepen staff-level SoC strategy module.
- Add capstone requiring verification plan, coverage model, liveness/formal strategy, debug plan, and signoff risks.
- Include review rubric for staff/senior-staff answers.

Acceptance criteria:
- Staff-level module and capstone render in curriculum.
- Interview bank includes staff SoC design prompts with model answers.
- Lab/capstone has peer-review rubric.

Validation:
- `npm run generate:curriculum`
- `npm test -- tests/interview-questions tests/lib/lab-registry.test.ts`
- `npm run build`

### BACK-10-ACE-CHI-COHERENCY-DEEPENING

Priority: P1  
Problem: ACE/CHI are not future protocols; staff-level coherency content needs deeper current-protocol treatment.  
Primary sources: Arm IHI0022H and IHI0050F.

Scope:
- Rename or reframe "Future Protocols" language to "AMBA 4 ACE and AMBA 5 CHI" where appropriate.
- Add current-production context without overclaiming.
- Expand CHI/ACE cards and interview prompts around snoops, line states, node roles, request/response/data/snoop channels.
- Consider a dedicated coherency verification module if the existing page becomes too dense.

Acceptance criteria:
- No misleading "future protocols" framing remains except as historical transition text.
- Coherency deck has at least 10 cards.
- Staff-level coherency interview prompts include rubrics/model answers.

Validation:
- `rg -n "Future Protocols|future protocols" content src`
- `npm test -- tests/amba-flashcards.spec.ts tests/interview-questions`
- `npm run build`

### BACK-11-SOURCE-METADATA-GATE

Priority: P1  
Problem: Curriculum pages do not enforce source metadata for normative claims.  
Primary surfaces: MDX frontmatter, tests.

Scope:
- Design `sources` frontmatter schema.
- Apply it first to protocol, SV scheduling, SVA, and UVM pages touched by this workstream.
- Add tests validating required source fields: title, type, url or standard identifier, version/revision, and validated topic.
- Decide whether the gate applies to all MDX immediately or only new/modified source-critical pages.

Acceptance criteria:
- Source schema test exists and passes.
- Touched normative pages include source metadata.
- Test failure message tells authors how to fix missing metadata.

Validation:
- `npm test -- tests/curriculum/source-metadata.test.ts`
- `npm run generate:curriculum`

### BACK-12-VISUALIZER-ACCURACY-A11Y

Priority: P2  
Problem: Some visualizers need accuracy improvements and accessibility guarantees.  
Primary surfaces: visualizer components and tests.

Scope:
- Add HREADYOUT/HREADY distinction or explicit simplification labels to AHB visualizer.
- Add scheduling timeline visualizer or enhance existing scheduling visualizer.
- Add `$past` gating visualization to SVA content if feasible.
- Add aria labels, text alternatives, and reduced-motion support where missing.

Acceptance criteria:
- Visualizer roots have stable labels/test IDs.
- Color-only state indicators have text or pattern alternatives.
- Reduced-motion mode has static step-through behavior.

Validation:
- `npm test -- tests/components`
- relevant Playwright visualizer specs

### BACK-13-FLASHCARD-DEPTH-ALIGNMENT

Priority: P2  
Problem: Some decks are thin or missing senior/staff discriminators.  
Primary surfaces: `content/flashcards/`, `src/lib/flashcard-decks.ts`.

Scope:
- Expand AHB/AXI decks to at least 10 strong cards each where appropriate.
- Add scheduling, AXI deadlock, RAL mirror, ACE/CHI, methodology, and senior-staff interview decks.
- Add deck registration tests if not already present.

Acceptance criteria:
- Expanded decks have no duplicate IDs and are registered.
- Cards include source-sensitive corrections from P0/P1 tasks.

Validation:
- `npm run validate:flashcards`
- `npm test -- tests/flashcards tests/amba-flashcards.spec.ts`

### BACK-14-E2E-REGRESSION-GATES

Priority: P2  
Problem: Navigation and broken-link coverage is not yet a strong regression gate.  
Primary surfaces: Playwright suites.

Scope:
- Add or strengthen breadcrumb, previous/next, lab-link, flashcard flip, quiz failure, and internal-link crawler specs.
- Keep long crawlers isolated so developers can run targeted suites locally.

Acceptance criteria:
- Broken-link crawler reports source page and target URL.
- Lab links from curriculum pages are covered.
- Flashcard flip test verifies question/answer visibility.

Validation:
- `npm run test:e2e`
- targeted Playwright specs

### BACK-15-AI-CONTENT-CLAIM-TIGHTENING

Priority: P3  
Problem: AI-driven verification language may overstate autonomous coverage closure.  
Primary sources: vendor docs only as secondary support.

Scope:
- Audit AI-driven verification curriculum and flashcards.
- Replace overclaims with careful wording: ML-guided tools accelerate closure but depend on coverage quality and do not guarantee autonomous signoff.
- Add source labels where marketing/vendor claims are used.

Acceptance criteria:
- No uncited "AI closes coverage automatically" style language remains.
- AI cards and curriculum distinguish tool-assistance from signoff responsibility.

Validation:
- `rg -n "automatically close|guarantee.*coverage|closes coverage" content src`
- `npm run build`

## New Test Inventory To Add During Workstream

Recommended unit/schema tests:
- `tests/curriculum/source-metadata.test.ts`
- `tests/flashcards/deck-schema.test.ts`
- `tests/flashcards/deck-registration.test.ts`
- `tests/interview-questions/bank-schema.test.ts`
- `tests/interview-questions/coverage-matrix.test.ts`
- `tests/labs/lab-schema.test.ts`
- `tests/labs/solution-present.test.ts`
- `tests/visualizers/accessibility.test.ts`

Recommended Playwright tests:
- `tests/e2e/navigation/breadcrumb.spec.ts`
- `tests/e2e/navigation/prev-next.spec.ts`
- `tests/e2e/navigation/lab-link.spec.ts`
- `tests/e2e/flashcards/flip.spec.ts`
- `tests/e2e/quiz/quiz-wrong-redirect.spec.ts`
- `tests/e2e/broken-links/internal-links.spec.ts`

## Validation Baseline

For doc-only tracking changes:
- `git diff --check`

For implementation batches:
- `npm run generate:curriculum`
- `npm run type-check`
- `npm test`
- targeted Playwright suites
- `npm run build`

For release readiness:
- `npm run validate:flashcards`
- `npm run generate:curriculum`
- `npm run type-check`
- `npm test`
- `npm run test:e2e` or a documented scoped Playwright pass
- `npm run build`

## Cleanup Notes

- The previous AMBA protocol expansion workstream is complete. Do not resume it from the old planning text.
- `docs/planning/ahb-axi-protocol-guide-plan.md` is historical context, not the active plan.
- `docs/prototypes/3dvisualization.html` is intentionally retained as prototype archive.
- `scripts/check_pages.js` is intentionally retained as a script artifact unless a future cleanup task proves it unused.
