# Finding: Available labs are not linked from curriculum content

- Date: 2026-03-06
- Feature ID: FEAT-W8-LABS-PLATFORM
- Severity: P2
- Status: closed

## Summary
The centralized lab platform adds stable `/practice/lab/<id>` routes and a reusable `LabLink` component, but no curriculum MDX page currently links to the only learner-available lab (`basics-1`). The feature therefore works from the Practice Hub only, not from lesson flow, which leaves the "curriculum pages can deep-link to labs via stable routes" acceptance target unmet.

## Affected Area
- Files:
  - `content/curriculum/**/*.mdx`
  - `src/components/mdx/LabLink.tsx`
- Modules/Lessons:
  - W8 labs platform
  - Available lab `basics-1`
- Test(s):
  - `tests/qa/labsPlatformAudit.spec.ts`

## Reproduction
1. Run `QA_STRICT_LABS_AUDIT=1 npx vitest --run tests/qa/labsPlatformAudit.spec.ts`.
2. Observe the strict discoverability assertion fail for `basics-1`.
3. Confirm with `rg -n "LabLink|/practice/lab/" content/curriculum` that no curriculum MDX file links to a lab route.

## Expected
Available labs should be reachable from the relevant curriculum lesson(s) through a stable direct link, ideally using the canonical `LabLink` mechanism.

## Actual
`basics-1` is reachable from `PracticeHub`, but there are zero curriculum MDX references to `/practice/lab/basics-1` or `<LabLink labId="basics-1" />`.

## Root Cause Hypothesis
The registry/routing work added the reusable link primitive and route surface, but the implementation stopped short of wiring those links into curriculum MDX, so lesson-to-lab entry points were never created.

## Suggested Fix Direction
- Add a canonical lab CTA in the owning curriculum lesson for each learner-available lab.
- Prefer `<LabLink labId="...">` from MDX so future slug changes stay registry-driven.
- Re-run the strict labs audit after wiring the first migrated labs into lessons.

## Verification to Close
- [x] `QA_STRICT_LABS_AUDIT=1 npx vitest --run tests/qa/labsPlatformAudit.spec.ts` passes the discoverability assertion.
- [x] Each `status: "available"` lab currently has an intentional inbound curriculum link.
- [x] Findings status updated to `closed`.
