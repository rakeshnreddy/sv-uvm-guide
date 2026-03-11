# Finding: Randomization advanced lab registry entry points to a missing asset folder

- Date: 2026-03-06
- Feature ID: FEAT-W8-LABS-PLATFORM
- Severity: P2
- Status: closed

## Summary
The centralized lab registry includes `randomization-advanced-1`, but its `assetLocation` points to `content/curriculum/labs/randomization_advanced/lab1_state_machine_bug_hunt`, which does not exist in the repo. This breaks the registry's role as an accurate source of truth for real lab assets and causes the shared QA audit to fail in the default Vitest suite.

## Affected Area
- Files:
  - `src/lib/lab-registry.ts`
  - `content/curriculum/labs/randomization_advanced/lab1_dependent_fields/README.md`
- Modules/Lessons:
  - `randomization-advanced-1`
- Test(s):
  - `tests/qa/labsPlatformAudit.spec.ts`
  - `npx vitest --run`

## Reproduction
1. Run `npx vitest --run tests/qa/labsPlatformAudit.spec.ts`.
2. Observe the baseline asset-path assertion fail for `randomization-advanced-1`.
3. Compare the registry path with the actual directory under `content/curriculum/labs/randomization_advanced/`, which contains `lab1_dependent_fields/`.

## Expected
Every registered lab should point to an existing canonical asset folder so the registry can reliably drive discovery, routing, and future lab execution.

## Actual
The registry references a non-existent `lab1_state_machine_bug_hunt` path, while the real asset folder is `lab1_dependent_fields`.

## Root Cause Hypothesis
The registry entry likely reused an older lab concept/title and was not updated to the final on-disk folder name when the centralized metadata file was created.

## Suggested Fix Direction
- Correct the `assetLocation` for `randomization-advanced-1` to the real asset directory, or rename the asset folder if the registry naming is intended.
- Re-audit the remaining registry entries for the same drift pattern.

## Verification to Close
- [x] `QA_STRICT_LABS_AUDIT=1 npx vitest --run tests/qa/labsPlatformAudit.spec.ts` passes the asset-path assertion.
- [x] `npx vitest --run` returns to green for the shared suite.
- [x] Findings status updated to `closed`.
