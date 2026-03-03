# Finding: curriculum topic renderer does not register several modernized MDX interactives

- Date: 2026-03-03
- Feature ID: QA-CURRICULUM-INTEGRITY-AUDIT
- Severity: P1
- Status: open

## Summary
The curriculum topic renderer's MDX component registry is out of sync with the modernized lessons. Multiple MDX files reference interactive tags that are not registered in `src/app/curriculum/[...slug]/page.tsx`, which risks lesson render failures or missing visuals on core learner pages.

## Affected Area
- Files:
  - `src/app/curriculum/[...slug]/page.tsx`
  - `content/curriculum/T2_Intermediate/I-SV-2A_Constrained_Randomization_Fundamentals/index.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-2B_Advanced_Constrained_Randomization/index.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index.mdx`
  - `content/curriculum/T2_Intermediate/I-SV-4B_Advanced_Temporal_Logic/index.mdx`
  - `content/curriculum/T2_Intermediate/I-UVM-1A_Components/index.mdx`
  - `content/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory/index.mdx`
  - `content/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/index.mdx`
  - `content/curriculum/T4_Expert/E-INT-1_Integrating_UVM_with_Formal_Verification/dpi.mdx`
- Modules/Lessons:
  - Randomization, coverage, temporal logic, UVM basics, RAL, DPI
- Test(s):
  - Static QA inspection against `tests/qa/curriculumCoverageAudit.spec.ts`

## Reproduction
1. Compare the JSX tags used in curriculum MDX files against the `components` map in `src/app/curriculum/[...slug]/page.tsx`.
2. Note that tags such as `ConstraintSolverExplorer`, `CovergroupBuilder`, `DPIBoundaryInspector`, `TemporalLogicExplorer`, `UVMTreeExplorer`, `FactoryOverrideVisualizer`, `RALPredictorVisualizer`, `Mailbox3D`, `Analysis3D`, `Constraint3D`, `Coverage3D`, `Dataflow3D`, `PhaseTimeline3D`, and `InterviewQuestionPlayground` are used in lessons but not registered in the renderer.
3. Open an affected lesson and verify the tag cannot resolve through the MDX runtime.

## Expected
Every custom JSX tag used by curriculum MDX should be dynamically imported or mapped in the topic renderer so the page renders successfully.

## Actual
The renderer currently omits a large subset of modernized interactive tags, even though the corresponding component files exist in `src/components/`.

## Root Cause Hypothesis
Wave 5 lesson content expanded faster than the renderer's MDX component registry was updated, leaving the `components` map incomplete.

## Suggested Fix Direction
- Add dynamic imports and `components` map entries in `src/app/curriculum/[...slug]/page.tsx` for every currently used MDX interactive tag.
- Smoke-test the affected lesson routes after wiring the tags into `MDXRemote`.

## Verification to Close
- [ ] The `components` map in `src/app/curriculum/[...slug]/page.tsx` covers all current MDX interactive tags.
- [ ] Affected lesson pages render without unresolved component failures.
- [ ] Findings status updated to `closed`.
