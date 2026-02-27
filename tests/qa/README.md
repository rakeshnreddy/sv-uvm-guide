# QA-Owned Tests

Place QA-authored intent/regression tests here when they are not specific to an existing feature folder.

## Integration With Common Suite
- Files must follow `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx`.
- `npm run test` already includes this directory via `tests/**/*.{test,spec}.{ts,tsx}`.

## Guidance
- Prefer feature-local tests (for example `tests/components/` or `tests/api/`) when clear ownership exists.
- Use `tests/qa/` for cross-cutting or orchestration-level quality checks.
