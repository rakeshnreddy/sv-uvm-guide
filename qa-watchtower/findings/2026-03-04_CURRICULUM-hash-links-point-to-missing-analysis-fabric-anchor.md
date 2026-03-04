# Finding: curriculum hash links point to a missing analysis-fabric anchor in I-UVM-2B

- Date: 2026-03-04
- Feature ID: FEAT-W5-IUVM2-SPLIT
- Severity: P2
- Status: closed

## Summary
Several curriculum lessons deep-link into the new `I-UVM-2B_TLM_Connections` page using the hash `#monitors-scoreboards-and-the-analysis-fabric`, but the target lesson no longer defines that anchor. Learners still reach the page, but the intended section jump is broken and cross-topic guidance lands at the wrong place.

## Affected Area
- Files:
  - `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/coverage-options.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/linking-coverage.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/events.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes.mdx`
- Modules/Lessons:
  - I-UVM-2B TLM connections
  - I-SV-3A coverage options
  - I-SV-3B linking coverage
  - I-SV-5 events and mailboxes
- Test(s):
  - `tests/qa/curriculumCoverageAudit.spec.ts` (`QA_STRICT_ANCHOR_AUDIT=1`)

## Reproduction
1. Run `QA_STRICT_ANCHOR_AUDIT=1 npx vitest --run tests/qa/curriculumCoverageAudit.spec.ts`.
2. Observe the strict anchor audit fail on four links targeting `/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections#monitors-scoreboards-and-the-analysis-fabric`.
3. Open `I-UVM-2B_TLM_Connections/index.mdx` and compare the current heading text with the requested hash.

## Expected
Curriculum hash links should resolve to an existing heading ID or explicit anchor in the target lesson.

## Actual
The callers still point to `#monitors-scoreboards-and-the-analysis-fabric`, but the target lesson only defines the section heading `### The Analysis Fabric (Publish/Subscribe)`, which generates a different anchor slug.

## Root Cause Hypothesis
The I-UVM-2B rewrite changed the section heading text without preserving the old anchor contract or updating the dependent deep links in neighboring lessons.

## Suggested Fix Direction
- Either add an explicit stable anchor on the analysis-fabric section in `I-UVM-2B_TLM_Connections/index.mdx`, or
- Update the four calling lessons to use the new generated anchor slug for that section.
- Preserve one canonical anchor and keep dependent references aligned to it.

## Verification to Close
- [x] `QA_STRICT_ANCHOR_AUDIT=1 npx vitest --run tests/qa/curriculumCoverageAudit.spec.ts` passes.
- [ ] Cross-topic analysis-fabric links jump to the intended section in the browser.
- [x] Findings status updated to `closed`.
