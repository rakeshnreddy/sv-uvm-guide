# Test Intent Matrix

| Feature Type | Primary Intent | Test Layer | Recommended Location | Required Assertions |
|---|---|---|---|---|
| React visualizer/component | Correct UI behavior and learner interaction | Vitest + Testing Library | `tests/components/` or `tests/qa/` | Render state, interaction transitions, accessibility labels, invalid-state handling |
| Curriculum MDX lesson updates | Correct structure, links, and references | Vitest + link/navigation checks | `tests/` or `tests/unit/` | Page content hooks present, required sections, valid internal links |
| Navigation/routing changes | Users reach intended pages without regressions | Playwright | `tests/e2e/` or `tests/e2e/qa/` | Route resolves, nav controls work, back/forward behavior, no broken redirects |
| Labs/challenges | Learner task intent and guidance quality | Vitest + optional e2e smoke | `tests/` + `tests/e2e/qa/` | Lab metadata present, instructions load, challenge flow reachable |
| SV/UVM content examples | Technical correctness and consistency | Vitest/static checks | `tests/` or `tests/unit/` | Required clauses/topics present, terminology accuracy, file references valid |
| API or persistence behavior | Contract correctness and error handling | Vitest API tests | `tests/api/` or `tests/server/` | Success path, failure path, validation and response shape |

## Authoring Rules
- Encode feature intent directly in test names.
- Use explicit expectation messages where possible.
- Prefer small focused tests over broad end-to-end-only coverage.
