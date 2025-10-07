# ADR 0001: Next.js App Router As Source Of Truth

- Status: Accepted
- Date: 2025-10-07
- Owners: Platform maintainers

## Context

- Navigation is implemented with the Next.js App Router so layouts, metadata, and data fetching live beside route segments (`src/app/layout.tsx:1`).
- Curriculum content lives in MDX files under `content/curriculum/` and is delivered through a catch-all route that normalizes slugs and wires shared providers (`src/app/curriculum/[...slug]/page.tsx:1`).
- Global application chrome (sidebar, keyboard shortcuts, AI assistant entry point) must wrap every route to guarantee consistent affordances (`src/app/layout.tsx:35`).
- We surface curriculum visualizations and dashboards under `/practice`, `/dashboard`, and other feature folders that depend on shared server components and dynamic imports embedded directly in route files (`src/app/curriculum/page.tsx:1`).

## Decision

We will:

1. Keep the App Router as the canonical definition of navigation, favoring nested layouts and route groups over custom routers.
2. Load curriculum topics through the existing MDX pipeline, using `generateStaticParams` sparingly and deferring to runtime lookups so new lessons ship without rebuilds.
3. Encapsulate long-lived wrappers (theme, session, auth, navigation context) in `RootLayout` so feature teams add pages without repeating providers.
4. Use route-level dynamic imports for heavy client components (interactive diagrams, charts) to keep SSR footprints small while preserving client interactivity.

## Consequences

- Adding new routes requires placing a folder or file under `src/app/` with optional layout overrides; no additional registry is needed.
- Shared layout providers must remain compatible with React Server Components—client-only dependencies stay inside annotated `use client` boundaries.
- Dynamic imports must be audited when routes become critical to SEO, because `ssr: false` components shift rendering to the client.
- The MDX-backed catch-all route is now the single integration point for curriculum metadata; changes to slug formats must update both `normalizeSlug` utilities and link maps before release.

## Follow-Up

- Document route naming conventions in onboarding materials so contributors align slugs with `curriculumData` IDs.
- Explore granular route segment caching if curriculum growth introduces performance regressions.
