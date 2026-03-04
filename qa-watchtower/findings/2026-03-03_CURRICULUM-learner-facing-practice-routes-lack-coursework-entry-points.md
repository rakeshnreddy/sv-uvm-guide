# Finding: learner-facing practice routes exist without coursework entry points

- Date: 2026-03-03
- Feature ID: QA-CURRICULUM-INTEGRITY-AUDIT
- Severity: P2
- Status: closed

## Summary
Several practice visualization and exercise routes are implemented but have no clear inbound path from curriculum lessons or learner-facing hubs, so the features are effectively hidden unless a user guesses the URL.

## Affected Area
- Files:
  - `src/app/practice/visualizations/randomization-explorer/page.tsx`
  - `src/app/practice/visualizations/assertion-builder/page.tsx`
  - `src/app/practice/visualizations/uvm-phasing/page.tsx`
  - `src/app/practice/visualizations/uvm-component-relationships/page.tsx`
  - `src/app/practice/visualizations/systemverilog-data-types/page.tsx`
  - `src/app/practice/visualizations/concurrency/page.tsx`
  - `src/app/practice/visualizations/procedural-blocks/page.tsx`
  - `src/app/practice/visualizations/coverage-analyzer/page.tsx`
  - `src/app/practice/visualizations/data-type-comparison/page.tsx`
  - `src/app/practice/visualizations/interface-signal-flow/page.tsx`
  - `src/app/practice/visualizations/state-machine-designer/page.tsx`
  - `src/app/exercises/uvm-agent-builder/page.tsx`
- Modules/Lessons:
  - Practice visualizations and UVM exercises
- Test(s):
  - Static route reference audit performed during QA analysis

## Reproduction
1. Search the repository for references to the route paths above.
2. Observe that they are not linked from curriculum MDX, curriculum navigation, or a domain-specific practice hub (beyond the generic `/exercises` landing page for some exercises).
3. Attempt to reach the features only through normal learner progression.

## Expected
Retained learner-facing routes should be reachable from the relevant lesson, a thematic practice hub, or another obvious user-facing navigation surface.

## Actual
Multiple routes are implemented but effectively orphaned from the coursework, making the feature discoverability and educational flow incomplete.

## Root Cause Hypothesis
Standalone practice pages were added incrementally without corresponding lesson links or practice-hub curation updates.

## Suggested Fix Direction
- Add contextual links from the matching curriculum lessons to the relevant visualization/exercise pages.
- If a route is intended to stay independent, add it to a dedicated practice hub with topical grouping.
- If a route is not intended for learners, remove it or mark it as internal-only.

## Verification to Close
- [x] Each retained learner-facing route has at least one clear inbound path from coursework or a learner-facing hub.
- [x] Route coverage is updated where needed.
- [x] Findings status updated to `closed`.
