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

`playwright.config.ts` starts its own `next dev` server on `127.0.0.1:3100` with every feature flag on. Outside CI it reuses anything already listening on port 3100, so a production `next start` there changes what the suites see:

*   Flag-dependent checks read `/api/feature-flags` and skip, with a reason, when the flag is off. `NEXT_PUBLIC_FEATURE_FLAG_*` values are inlined at build time, so rebuild to change them.
*   `tests/e2e/mobile-navigation.spec.ts` runs on WebKit and is skipped until you run `npx playwright install webkit`. Pass `--browser=chromium` for a quicker run with iPhone emulation in Chromium.

### Auth-gated suites

`labs.spec.ts`, `learner-flow.spec.ts` and `regression-gates.spec.ts` (part of `npm run test:e2e:release`) sign in through the `test-credentials` provider in `src/lib/auth.ts`. That provider exists only when `NODE_ENV` is not `production` and `AUTH_TEST_MODE=true`, so these specs cannot pass against `next start`. Stop any server on port 3100 so Playwright starts its own `next dev`.

These specs also write to the database: each protected request upserts a user row for a fresh test identity, and labs record progress. Use a throwaway PostgreSQL database, never the one in `.env`:

```bash
docker run --rm -d --name sv-uvm-e2e-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sv_uvm_e2e -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sv_uvm_e2e
export AUTH_TEST_MODE=true
export AUTH_TEST_TOKEN=local-browser-test-token-at-least-32-characters
export SESSION_SECRET=local-session-secret-at-least-32-characters
npx prisma migrate deploy
npm run test:e2e:release
docker stop sv-uvm-e2e-db   # --rm discards the database
```

*   Export `DATABASE_URL` before `prisma migrate deploy`. Prisma falls back to `.env` when the variable is unset. Playwright's server is safer: it passes an empty `DATABASE_URL` when none is exported, and Next.js does not replace an empty value from `.env`.
*   Export `AUTH_TEST_TOKEN` and `SESSION_SECRET` in the same shell. The server and `tests/fixtures/auth.ts` must see the same token, and the server refuses to start auth without a secret.
*   This mirrors the `Required quality gates` workflow, which runs the same suites against a `postgres:16` service container.

## Definition of Done

For any new content to be merged, it must meet the following criteria:

*   Content is technically accurate.
*   Uses the required section order (Quick Take → References & Next Topics) and references the migration tracker when updated.
*   Includes at least one minimal, complete, compilable, and executable code example.
*   Adheres to the "Why before How" principle.
*   Includes a "Key Takeaways" summary.
*   Has been reviewed and approved by at least one designated SME.
