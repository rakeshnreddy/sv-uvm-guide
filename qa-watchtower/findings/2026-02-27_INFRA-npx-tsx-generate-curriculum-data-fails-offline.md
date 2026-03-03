# Finding: npx tsx curriculum generation fails in network-restricted/offline environment

- Date: 2026-02-27
- Feature ID: INFRA-PRECOMMIT-COMMANDS
- Severity: P1
- Status: open

## Summary
The pre-submit command `npx tsx scripts/generate-curriculum-data.ts` remains unreliable in network-restricted or non-interactive environments, which blocks the documented pre-commit flow used by the implementation agent. The 2026-03-03 revalidation reproduced the failure and again required a fallback to `npm run generate:curriculum`.

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
3. Command exits with `ENOTFOUND` on `registry.npmjs.org`.

## Expected
Curriculum generation command should run from local project dependencies without requiring network fetch during normal pre-submit validation.

## Actual
`npx` remains environment-sensitive and does not reliably execute the local script:
- `npm error code ENOTFOUND`
- `npm error network request to https://registry.npmjs.org/tsx failed`

On 2026-03-03 revalidation in this restricted non-interactive session:
- `npx tsx scripts/generate-curriculum-data.ts` exited with `ENOTFOUND` for `registry.npmjs.org`.

Observed local alternative:
- `npm run generate:curriculum` succeeds (uses `ts-node --project tsconfig.scripts.json scripts/generate-curriculum-data.ts`).

## Root Cause Hypothesis
Raw `npx tsx ...` is environment-sensitive; when `tsx` is not resolved immediately from the local project context, `npx` can trigger remote package resolution or stall before execution completes.

## Suggested Fix Direction
- Prefer repository script `npm run generate:curriculum` (already defined) in handoff/checklist docs.
- Or add `tsx` as a pinned dev dependency and enforce local execution (`npx --no-install tsx ...`), then update docs accordingly.

## Verification to Close
- [ ] Pre-submit docs updated to a network-independent command.
- [ ] Command executes successfully in a restricted/offline environment.
- [ ] Findings status updated to `closed`.
