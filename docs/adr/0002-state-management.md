# ADR 0002: Context-First State Management With Local Persistence

- Status: Accepted
- Date: 2025-10-07
- Owners: Platform maintainers

## Context

- Shared state such as authentication and navigation lives in lightweight React context providers so it can wrap the App Router layout without introducing additional dependencies (`src/app/layout.tsx:35`).
- `AuthProvider` bridges Firebase auth events into a serializable context while exposing async helpers for sign-in/out (`src/contexts/AuthContext.tsx:1`).
- Navigation shortcuts, locale toggles, and theming follow the same pattern, keeping long-lived UI concerns colocated with the layout tree (`src/contexts/NavigationContext.tsx:1`).
- Feature teams rely on focused hooks for client persistence—curriculum progress is stored in localStorage through `useCurriculumProgress`, which manages loading, saving, and derived metrics (`src/hooks/useCurriculumProgress.ts:1`).
- No global state library (Redux, Zustand, etc.) is in use today, and existing data-fetching occurs through Next.js server components or feature-specific hooks.

## Decision

We will:

1. Continue using React context for cross-cutting, session-scoped state that every route needs (auth, navigation, theme, localization).
2. Keep feature state in colocated hooks that default to React primitives and only persist when the UX benefits from it (e.g., curriculum progress, dashboard filters).
3. Defer the introduction of a broader state library until we have a concrete need for cache sharing across routes or client-side data mutation that exceeds context complexity.
4. Require new contexts and hooks to expose typed interfaces and SSR-safe guards (hydration and persistence must live in `use client` modules).

## Consequences

- Most contributors can ship changes without learning an extra state library; adding new context providers simply extends `RootLayout`.
- Persisted state must guard against unavailable browser APIs to stay SSR-compatible, mirroring the patterns in `useCurriculumProgress`.
- When diverse features need shared client caches, we may need to revisit this decision and evaluate libraries like React Query or Zustand; that migration path remains open because current code favors hooks over bespoke stores.
- Testing remains straightforward—contexts expose hooks that Vitest can wrap with minimal scaffolding (`tests/hooks/useCurriculumProgress.test.ts:1`).

## Follow-Up

- Audit contexts each quarter to confirm they stay minimal and free of feature-specific logic.
- Document a playbook for adding persisted hooks so telemetry and recommendation features use consistent keys and error handling.
