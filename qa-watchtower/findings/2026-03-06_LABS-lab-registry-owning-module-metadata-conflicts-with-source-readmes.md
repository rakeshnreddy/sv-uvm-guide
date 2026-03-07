# Finding: Lab registry metadata conflicts with module ownership documented in source lab READMEs

- Date: 2026-03-06
- Feature ID: FEAT-W8-LABS-PLATFORM
- Severity: P2
- Status: open

## Summary
The centralized lab registry is intended to be the canonical metadata source for learner-facing lab ownership, but at least two entries currently disagree with the module context stated in the corresponding lab README files. This makes Practice Hub ownership labels unreliable and weakens the promised canonical lab mapping.

## Affected Area
- Files:
  - `src/lib/lab-registry.ts`
  - `labs/basics/lab1_refactoring/README.md`
  - `labs/simple_dut/lab1_first_tb/README.md`
- Modules/Lessons:
  - `basics-1`
  - `simple-dut-1`
- Test(s):
  - `tests/qa/labsPlatformAudit.spec.ts`

## Reproduction
1. Run `QA_STRICT_LABS_AUDIT=1 npx vitest --run tests/qa/labsPlatformAudit.spec.ts`.
2. Observe the metadata/readme consistency assertion fail.
3. Inspect the mismatches reported by the test:
   - `basics-1`: registry `F1A`, README `F2D`
   - `simple-dut-1`: registry `I-UVM-1B`, README `F4`

## Expected
The centralized registry should agree with the canonical lab docs about which curriculum module owns each lab, or the docs should be updated in the same change so the repo has one coherent ownership story.

## Actual
Practice Hub currently displays module ownership derived from `src/lib/lab-registry.ts`, but those labels conflict with the guidance embedded in the source lab materials.

## Root Cause Hypothesis
The registry appears to have been populated manually from rough curriculum buckets rather than from the existing lab docs, and older README ownership labels were not reconciled during the registry rollout.

## Suggested Fix Direction
- Reconcile `owningModule` against the intended canonical lesson for each lab.
- Update outdated READMEs in the same pass where the registry is corrected, especially for legacy Tier 1 names.
- Add a quick ownership reconciliation check whenever new labs are registered.

## Verification to Close
- [ ] `QA_STRICT_LABS_AUDIT=1 npx vitest --run tests/qa/labsPlatformAudit.spec.ts` passes the metadata/readme consistency assertion.
- [ ] Practice Hub ownership labels match the canonical curriculum/lab docs.
- [ ] Findings status updated to `closed`.
