# ADR 0003: Managed Static Assets And Bundle Guardrails

- Status: Accepted
- Date: 2025-10-07
- Owners: Platform maintainers

## Context

- Visual assets and diagrams are version-controlled in dedicated folders so designers and authors can collaborate without touching application code (`public/visuals`, `public/diagrams`).
- Fonts are loaded through `next/font/local` to guarantee deterministic rendering and declarative preloading across the app shell (`src/app/fonts.ts:1`).
- Performance guardrails rely on bundle analysis output and a custom checker that enforces compressed entrypoint budgets (`scripts/check-bundle-size.cjs:1`, `docs/bundle-baseline.json`).
- Documentation and curriculum content reference these assets via Next.js `Image` components and MDX imports to keep optimizations in place (`src/components/diagrams/SimplifiedUvmDiagram.tsx:1`, `src/app/curriculum/page.tsx:1`).
- Contributors frequently add diagrams and lesson visuals; we need a documented approach so assets stay optimized, accessible, and traceable to curriculum updates.

## Decision

We will:

1. Keep canonical static assets under `public/visuals/` and `public/diagrams/`, using descriptive file names that mirror curriculum slugs.
2. Prefer `next/image` for UI surfaces so responsive sizing and lazy loading remain automatic; fall back to `<img>` only for content generated at runtime.
3. Manage typography via `src/app/fonts.ts` and Tailwind token integration, avoiding redundant font packages.
4. Treat bundle budgets as release gates—any feature that increases initial payloads must update `docs/bundle-baseline.json` intentionally through `npm run bundle:update`.
5. Require new asset-heavy features to document loading behavior or placeholders so skeleton states stay consistent (`src/components/diagrams/DiagramPlaceholder.tsx`).

## Consequences

- Designers have a predictable drop zone for assets, and engineers can trace usage via import paths without scanning unrelated directories.
- Converting assets to `next/image` may require providing `width`, `height`, and `sizes`; reviewers should enforce these details during PRs.
- Bundle regressions surface locally through `npm run bundle:check`, reducing unexpected CI failures.
- Adding large media requires thoughtful trade-offs (e.g., streaming video, 3D models); teams must decide whether to inline, host externally, or provide downloadable resources.

## Follow-Up

- Capture asset naming conventions and thumbnail requirements in `docs/components/visuals-contributor-guide.md` when workflows evolve.
- Periodically regenerate the bundle baseline after significant dependency upgrades to keep tolerances realistic.
