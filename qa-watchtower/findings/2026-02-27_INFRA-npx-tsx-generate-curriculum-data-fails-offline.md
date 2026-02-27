# Finding: npx tsx curriculum generation fails in network-restricted/offline environment

- Date: 2026-02-27
- Feature ID: INFRA-PRECOMMIT-COMMANDS
- Severity: P1
- Status: open

## Summary
The pre-submit command `npx tsx scripts/generate-curriculum-data.ts` fails when npm registry access is unavailable, which blocks the documented pre-commit flow used by the implementation agent.

## Affected Area
- Files:
  - `agent_7_mop_up_and_infrastructure_prompt.md`
  - `TASKS.md`
- Modules/Lessons:
  - Build/test infrastructure
- Test(s):
  - Pre-submit command execution

## Reproduction
1. Run `npx tsx scripts/generate-curriculum-data.ts`.
2. Observe command behavior in an environment without npm registry network access.
3. Command exits with ENOTFOUND on `registry.npmjs.org`.

## Expected
Curriculum generation command should run from local project dependencies without requiring network fetch during normal pre-submit validation.

## Actual
`npx` attempts to resolve/fetch `tsx` from npm and fails with:
- `npm error code ENOTFOUND`
- `npm error network request to https://registry.npmjs.org/tsx failed`

Observed local alternative:
- `npm run generate:curriculum` succeeds (uses `ts-node --project tsconfig.scripts.json scripts/generate-curriculum-data.ts`).

## Root Cause Hypothesis
`tsx` is not guaranteed as a local dependency for this workflow, and raw `npx tsx ...` can trigger remote package resolution.

## Suggested Fix Direction
- Prefer repository script `npm run generate:curriculum` (already defined) in handoff/checklist docs.
- Or add `tsx` as a pinned dev dependency and enforce local execution (`npx --no-install tsx ...`), then update docs accordingly.

## Verification to Close
- [ ] Pre-submit docs updated to a network-independent command.
- [ ] Command executes successfully in a restricted/offline environment.
- [ ] Findings status updated to `closed`.
