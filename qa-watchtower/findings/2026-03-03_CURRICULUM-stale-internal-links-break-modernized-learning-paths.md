# Finding: stale internal curriculum links still point at deprecated module routes

- Date: 2026-03-03
- Feature ID: QA-CURRICULUM-INTEGRITY-AUDIT
- Severity: P1
- Status: closed

## Summary
Multiple curriculum lessons still link to deprecated pre-split module routes (`F3A`, `I-SV-2`, `I-UVM-2_Building_TB`), which breaks learner navigation after the Wave 5 curriculum restructures and leaves "next topic" guidance pointing at dead pages.

## Affected Area
- Files:
  - `content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/coverage-options.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/linking-coverage.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/immediate-vs-concurrent.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/events.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/semaphores.mdx`
- Modules/Lessons:
  - Foundational F2C/F2D
  - Intermediate coverage, SVA, and IPC tracks
- Test(s):
  - `tests/qa/curriculumCoverageAudit.spec.ts` (`QA_STRICT_LINK_AUDIT=1`)

## Reproduction
1. Run `QA_STRICT_LINK_AUDIT=1 npx vitest --run tests/qa/curriculumCoverageAudit.spec.ts`.
2. Observe the strict audit fail with broken internal links.
3. Open any reported source lesson and follow the flagged `/curriculum/...` link.

## Expected
Every internal curriculum link should resolve to an existing modernized lesson path or valid app route.

## Actual
The strict audit reports 11 broken links, including:
- old `F3A` references that should now target `F2C_Procedural_Code_and_Flow_Control`
- old `I-SV-2_Constrained_Randomization` references that should now target `I-SV-2A_Constrained_Randomization_Fundamentals`
- old `I-UVM-2_Building_TB` analysis-fabric references that should now target the split `I-UVM-2A` or `I-UVM-2B` pages

## Root Cause Hypothesis
Curriculum split/rename work landed, but dependent cross-links in neighboring lessons were not updated to the new route map and anchor structure.

## Suggested Fix Direction
- Rewrite deprecated `F3A` links to the corresponding `F2C` index or `flow-control` chapter.
- Rewrite deprecated `I-SV-2` links to `I-SV-2A_Constrained_Randomization_Fundamentals`.
- Rewrite deprecated `I-UVM-2_Building_TB` analysis-fabric links to `I-UVM-2B_TLM_Connections`, and add a stable section anchor if the existing prose expects a deep link into the analysis-fabric section.

## Verification to Close
- [x] `QA_STRICT_LINK_AUDIT=1 npx vitest --run tests/qa/curriculumCoverageAudit.spec.ts` passes.
- [ ] Spot-check the repaired lesson links in the browser.
- [x] Findings status updated to `closed`.
