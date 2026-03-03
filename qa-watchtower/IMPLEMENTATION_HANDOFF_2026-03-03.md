# Implementation Handoff Prompt (2026-03-03)

Use this prompt verbatim with the implementation/coding agent:

```text
Read and implement the QA findings in this repo. Start by reading these files in order:

1. /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/IMPLEMENTATION_HANDOFF_2026-03-03.md
2. /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/findings/2026-03-03_CURRICULUM-stale-internal-links-break-modernized-learning-paths.md
3. /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/findings/2026-03-03_CURRICULUM-mdx-component-registry-missing-modernized-interactives.md
4. /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/findings/2026-03-03_CURRICULUM-learner-facing-practice-routes-lack-coursework-entry-points.md
5. /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/findings/2026-03-03_TESTING-interactive-demo-e2e-suite-disabled.md
6. /Users/Rakesh/Projects/sv-uvm-guide/tests/qa/curriculumCoverageAudit.spec.ts
7. /Users/Rakesh/Projects/sv-uvm-guide/src/app/curriculum/[...slug]/page.tsx
8. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/F2_F3_lessons.spec.ts
9. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/f2-revamp.spec.ts
10. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/navigation.spec.ts
11. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/phase9-visuals.spec.ts
12. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/module5.spec.ts
13. /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/theming.spec.ts

Then fix the real implementation/content gaps, not just tests.

A. Repair stale curriculum links.
The strict QA link audit found deprecated routes still embedded in modernized lessons. Update the content in:
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/coverage-options.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/linking-coverage.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/immediate-vs-concurrent.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/events.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes.mdx
- /Users/Rakesh/Projects/sv-uvm-guide/content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/semaphores.mdx

Use current split routes, not deprecated ones.
Likely replacements:
- old F3A links -> /curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control and /flow-control
- old I-SV-2 links -> /curriculum/T2_Intermediate/I-SV-2A_Constrained_Randomization_Fundamentals
- old I-UVM-2_Building_TB analysis-fabric links -> /curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections (add a stable anchor if deep-linking into the analysis-fabric section)

B. Fix the missing MDX component wiring.
The MDX `components` map in:
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/curriculum/[...slug]/page.tsx
does not cover multiple JSX tags currently used in curriculum MDX.

The implementation already exists on disk. Register the missing components with dynamic imports and `components` map entries for all current tags, including at minimum:
- Analysis3D
- Constraint3D
- ConstraintSolverExplorer
- ConstraintSolverVisualizer
- Coverage3D
- CovergroupBuilder
- DPIBoundaryInspector
- Dataflow3D
- EventSchedulerVisualizer
- FactoryOverrideVisualizer
- InterviewQuestionPlayground
- Mailbox3D
- PhaseTimeline3D
- RALPredictorVisualizer
- TemporalLogicExplorer
- UVMTreeExplorer

The current component files already exist under:
- /Users/Rakesh/Projects/sv-uvm-guide/src/components/visuals
- /Users/Rakesh/Projects/sv-uvm-guide/src/components/visualizers
- /Users/Rakesh/Projects/sv-uvm-guide/src/components/curriculum/interactives
- /Users/Rakesh/Projects/sv-uvm-guide/src/components/curriculum/interactives/3d

C. Restore logical learner paths to retained features.
These pages exist but currently have weak or missing coursework entry points:
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/randomization-explorer/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/assertion-builder/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/uvm-phasing/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/uvm-component-relationships/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/systemverilog-data-types/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/concurrency/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/procedural-blocks/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/coverage-analyzer/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/data-type-comparison/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/interface-signal-flow/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/practice/visualizations/state-machine-designer/page.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/src/app/exercises/uvm-agent-builder/page.tsx

If a page is meant to stay learner-facing, add obvious inbound links from the relevant curriculum lessons or a dedicated practice hub. If not, remove or consolidate it deliberately.

D. Decide the fate of the skipped interactive demo surface.
The Playwright suite is disabled in:
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/interactive-demo.spec.ts
If the route is still supported, re-enable and repair it. If not, cleanly remove the dead route/test pairing.

E. Keep the QA-added tests aligned.
The following QA files are now the current reference tests and should stay accurate after the implementation changes:
- /Users/Rakesh/Projects/sv-uvm-guide/tests/qa/curriculumCoverageAudit.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/components/visuals/EventRegionGame.test.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/tests/components/visuals/MailboxSemaphoreGame.test.tsx
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/F2_F3_lessons.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/f2-revamp.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/navigation.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/phase9-visuals.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/module5.spec.ts
- /Users/Rakesh/Projects/sv-uvm-guide/tests/e2e/theming.spec.ts

Constraints:
- Fix implementation/content first; do not paper over real defects by weakening tests.
- Preserve current curriculum split structure unless a deliberate redirect/update is required.
- Do not modify qa-watchtower records unless you are resolving a finding and intentionally closing it.

Validation required before finishing:
1. npm run generate:curriculum
2. npx vitest --run tests/components/visuals/EventRegionGame.test.tsx tests/components/visuals/MailboxSemaphoreGame.test.tsx tests/qa/curriculumCoverageAudit.spec.ts
3. QA_STRICT_LINK_AUDIT=1 npx vitest --run tests/qa/curriculumCoverageAudit.spec.ts
4. npx vitest --run
5. If Playwright is available:
   - npx playwright test tests/e2e/F2_F3_lessons.spec.ts
   - npx playwright test tests/e2e/f2-revamp.spec.ts
   - npx playwright test tests/e2e/navigation.spec.ts
   - npx playwright test tests/e2e/phase9-visuals.spec.ts
   - npx playwright test tests/e2e/module5.spec.ts
   - npx playwright test tests/e2e/theming.spec.ts

Definition of done:
- QA_STRICT_LINK_AUDIT=1 passes with zero broken links
- all currently used MDX JSX tags resolve through the curriculum topic renderer
- each retained learner-facing visualization/exercise has an intentional inbound path
- the targeted Vitest and Playwright checks pass
- final report lists exact files changed and any intentionally deferred gaps
```
