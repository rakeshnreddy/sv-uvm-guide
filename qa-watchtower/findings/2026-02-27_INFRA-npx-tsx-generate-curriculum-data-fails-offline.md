# Finding: npx tsx curriculum generation fails in network-restricted/offline environment

- Date: 2026-02-27
- Feature ID: INFRA-PRECOMMIT-COMMANDS
- Severity: P1
- Status: closed

## Summary
The old pre-submit command `npx tsx scripts/generate-curriculum-data.ts` was unreliable in network-restricted or non-interactive environments, which blocked the documented pre-commit flow used by implementation and QA agents. The repo now standardizes on `npm run generate:curriculum`, which already resolves locally through `ts-node` and executes successfully in this restricted shell.

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
3. Command either stalls while attempting package resolution or exits with a network-resolution failure.

## Expected
Curriculum generation command should run from local project dependencies without requiring network fetch during normal pre-submit validation.

## Actual
`npx` remains environment-sensitive and does not reliably execute the local script:
- `npm error code ENOTFOUND`
- `npm error network request to https://registry.npmjs.org/tsx failed`

On 2026-03-03 revalidation in this restricted non-interactive session:
- `npx tsx scripts/generate-curriculum-data.ts` exited with `ENOTFOUND` for `registry.npmjs.org`.

On 2026-03-04 revalidation in this restricted non-interactive session:
- `./node_modules/.bin/tsx` was not present locally.
- `npx tsx scripts/generate-curriculum-data.ts` hung without producing output.
- `npm run generate:curriculum` succeeded and rewrote the generated curriculum data as expected.

Observed local alternative:
- `npm run generate:curriculum` succeeds (uses `ts-node --project tsconfig.scripts.json scripts/generate-curriculum-data.ts`).

## Root Cause Hypothesis
Raw `npx tsx ...` is environment-sensitive; when `tsx` is not resolved immediately from the local project context, `npx` can trigger remote package resolution or stall before execution completes.

## Suggested Fix Direction
- Prefer repository script `npm run generate:curriculum` (already defined) in handoff/checklist docs.
- Or add `tsx` as a pinned dev dependency and enforce local execution (`npx --no-install tsx ...`), then update docs accordingly.

## Verification to Close
- [x] Pre-submit docs updated to a network-independent command.
- [x] `npm run generate:curriculum` executes successfully in this restricted/offline environment.
- [x] Findings status updated to `closed`.
