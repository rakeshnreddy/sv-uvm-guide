# Contributing to the SystemVerilog and UVM Learning Platform

First off, thank you for considering contributing. This project is a community effort, and we welcome any and all contributions.

## Project Vision & Pedagogy

Our vision is to be the world's leading open-source, curriculum-based guide for SystemVerilog and UVM. To achieve this, we adhere to five core pedagogical principles:

1.  **Progressive Disclosure:** Content is structured to reveal complexity gradually, preventing cognitive overload.
2.  **Context is King:** We explain *why* a feature exists before explaining *how* it works.
3.  **Code-First:** Every concept is illustrated with a minimal, complete, compilable, and executable code example.
4.  **Why before How:** We emphasize the design rationale behind language features and methodologies.
5.  **Active Learning:** We encourage active participation through labs, exercises, and quizzes.

## Content Structure

All new content should be created as `.mdx` files within the `content/curriculum/` directory. The content is organized into a three-level hierarchy:

1.  **Tier:** The top-level directory, representing a broad level of expertise (e.g., `T1_Foundational`, `T2_Intermediate`).
2.  **Module:** A subdirectory within a tier, representing a specific topic (e.g., `F1A_The_Cost_of_Bugs`).
3.  **Topic:** An `.mdx` file within a module, representing a specific sub-topic (e.g., `index.mdx`).

All new content must follow this structure.

## Content Style Guide

*   **Tone:** Authoritative but accessible.
*   **Topic Template:** Follow the Quick Take → References & Next Topics structure documented in `STYLE_GUIDE.md`. Use `docs/topic-template.mdx` as your starting point when creating or refreshing a page.
*   **Visual Direction:** Align with the glassmorphism and visual density guidance outlined in `docs/visual-design-guide.md`; every major section should include a supporting visual while preserving full explanatory depth.
*   **Text Formatting:** Use Markdown for all content.
*   **Code Style:** Follow industry-standard SystemVerilog and UVM formatting conventions.

## Contribution Workflow

1.  **Fork the repository.**
2.  **Create a feature branch.**
3.  **Make your changes.**
4.  **Run through the [PR checklist](docs/pr-checklist.md).**
5.  **Submit a pull request.**

All pull requests must be linked to an existing issue in the issue tracker.

## Running the Playwright suites locally

`playwright.config.ts` starts its own `next dev` server in one of two modes. Every value it passes to that server is set explicitly, so variables exported in your shell (or by CI) for the other mode never leak in.

| | Anonymous (default) | Accounts (`E2E_ACCOUNTS=true`) |
|---|---|---|
| Server | `127.0.0.1:3100` | `127.0.0.1:3101` |
| Feature flags | every `NEXT_PUBLIC_FEATURE_FLAG_*` is `false` unless you export it as `true` | `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true`; the others as in anonymous mode |
| Test sign-in | off: `AUTH_TEST_MODE=false`, empty `AUTH_TEST_TOKEN` | on: `AUTH_TEST_MODE=true`, your `AUTH_TEST_TOKEN` |
| Database | none: `DATABASE_URL` is empty | your `DATABASE_URL` (a disposable database) |
| `SESSION_SECRET` | yours, or a dummy of at least 32 characters | yours, or the same dummy |
| Script | `npm run test:e2e:release` | `npm run test:e2e:accounts` |

Outside CI, Playwright reuses anything already listening on the mode's port, so a production `next start` there changes what the suites see. The two modes use different ports, so a server left running in one mode is never reused by the other. Both modes share `.next/`, so run them one after the other, not at the same time.

### Anonymous mode (the default)

This is the site as deployed: no sign-in, no database, and learner data kept in browser storage. It needs nothing beyond `npm ci` and the Playwright browsers:

```bash
npm run test:e2e:release
```

*   `NEXT_PUBLIC_FEATURE_FLAG_*` values are inlined at build time. To preview a draft feature, export its flag as `true` before the run, for example `NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION=true npm run test:e2e:release`. Specs that depend on a flag read `/api/feature-flags` from the running server and skip, with a reason, when it is off. There is no global force-on switch: `FEATURE_FLAGS_FORCE_ON` was removed and is ignored.
*   The AI tutor (`NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR`), simulation (`NEXT_PUBLIC_FEATURE_FLAG_SIMULATION`) and community flags also need accounts, so they show nothing in this mode even when exported.
*   `tests/e2e/mobile-navigation.spec.ts` runs on WebKit and is skipped until you run `npx playwright install webkit`. Pass `--browser=chromium` for a quicker run with iPhone emulation in Chromium.

### Accounts mode

`account-preferences.spec.ts` and the account cases in `navigation.spec.ts` exercise the code that returns when accounts are switched on. Specs like these call `requireAccountsMode(test)` from `tests/fixtures/auth.ts`, which skips them in the anonymous default, and then sign in with `authenticateTestLearner(page)`. That fixture uses the `test-credentials` provider in `src/lib/auth.ts`, which exists only when `NODE_ENV` is not `production` and `AUTH_TEST_MODE=true`, so these specs cannot pass against `next start`. Stop any server on port 3101 so Playwright starts its own `next dev`.

These specs write to the database: each protected request upserts a user row for a fresh test identity. Use a throwaway PostgreSQL database, never the one in `.env`:

```bash
docker run --rm -d --name sv-uvm-e2e-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sv_uvm_e2e -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sv_uvm_e2e
export AUTH_TEST_TOKEN=local-browser-test-token-at-least-32-characters
export SESSION_SECRET=local-session-secret-at-least-32-characters
npx prisma migrate deploy
npm run test:e2e:accounts        # sets E2E_ACCOUNTS=true, which turns AUTH_TEST_MODE on for the server
docker stop sv-uvm-e2e-db        # --rm discards the database
```

*   Export `DATABASE_URL` before `prisma migrate deploy`. Prisma falls back to `.env` when the variable is unset. Playwright's server is safer: it passes an empty `DATABASE_URL` when none is exported, and Next.js does not replace an empty value from `.env`.
*   Export `AUTH_TEST_TOKEN` and `SESSION_SECRET` in the same shell. The server and `tests/fixtures/auth.ts` must see the same token (without one, both use the fixture's default), and the server refuses to load auth without a secret.
*   The accounts gate (`src/server/persistence-gate.ts`) also needs that database: without `DATABASE_URL`, `/api/auth/*` answers 404 and the sign-in fixture fails with a pointer to this section.
*   Accounts mode does not turn on the AI tutor or simulation. Export `NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR=true` (with `GEMINI_API_KEY`) or `NEXT_PUBLIC_FEATURE_FLAG_SIMULATION=true` (with `SIMULATION_QUEUE_URL` and `SIMULATION_QUEUE_TOKEN`) only when that backend is configured.
*   This mirrors the `Required quality gates` workflow: `Run Playwright learner flows` runs the anonymous suites, and `Run Playwright account-mode flows` runs the accounts suites against a `postgres:16` service container.

`npm run test:e2e` (`scripts/run-e2e-tests.cjs`) builds the app and then runs the whole Playwright suite, in anonymous mode by default or in accounts mode with `E2E_ACCOUNTS=true`. Extra arguments go to `playwright test`.

## Definition of Done

For any new content to be merged, it must meet the following criteria:

*   Content is technically accurate.
*   Uses the required section order (Quick Take → References & Next Topics) and references the migration tracker when updated.
*   Includes at least one minimal, complete, compilable, and executable code example.
*   Adheres to the "Why before How" principle.
*   Includes a "Key Takeaways" summary.
*   Has been reviewed and approved by at least one designated SME.
