# Visual Asset Contributor Guide

_Last updated: 2025-09-22_

This guide complements `docs/visual-design-guide.md` and explains how to propose, build, and ship new diagrams, animations, and interactive widgets.

## 1. Decide the Right Surface
| Asset Type | Use When | Implementation Notes |
| --- | --- | --- |
| **Static SVG** | Conceptual diagrams, quick reference cheats | Hand-author in Figma or Illustrator, export SVG with text converted to outlines only when ligatures misbehave. Keep strokes ≥ 1.25px. |
| **Lottie / JSON animation** | Reusable motion sequences (handshakes, timelines) | Create in After Effects → Bodymovin. Store under `public/lottie/`. Use `<LottiePlayer>` component. |
| **React interactive** | Learners need to manipulate inputs or see stateful behaviour | Build under `src/components/diagrams/` or `src/components/exercises/` depending on complexity. Follow accessibility checklist below. |

## 2. File & Naming Conventions
- Place source assets in `design/` (not tracked) and commit generated SVG/JSON/TSX only.
- Name assets with tier + topic prefix, e.g. `t2-uvm-handshake.svg` or `t1-sv-types.json`.
- For React components, co-locate tests under `tests/components/` using the suffix `*.test.tsx`.

## 3. Accessibility Checklist
- Provide meaningful `aria-label` or `aria-describedby` text for every visual.
- Ensure colour pairs meet WCAG AA contrast against Blueprint backgrounds (use tokens in `tailwind.config.ts`).
- Animations must respect `prefers-reduced-motion`; wrap motion in `useReducedMotion()` guard.
- Interactive diagrams require keyboard support (focusable elements, `Enter/Space` activation) and `aria-live` where dynamic feedback appears.

## 4. Performance & Delivery
- Inline SVGs with `<svg>` when the markup is < 40 KB; otherwise, load via `next/dynamic` + import the asset at runtime.
- Deduplicate gradients/defs—define them once and reference with `url(#id)`.
- Lottie animations: set `rendererSettings: { progressiveLoad: true }` and lazy load outside the viewport.
- Use the shared `GlassCard` or `Card` wrappers so visuals inherit blueprint styling automatically.

## 5. Review & Approval Workflow
1. Sketch concept → post screenshot in `#curriculum-ux` for validation.
2. Build asset following this guide.
3. Run `npm run lint` + relevant component tests.
4. Update module MDX with the new asset and note the change in the PR description, linking to the UX thread.
5. Request review from:
   - **Visual design steward** (`@design-lead`)
   - **Content owner** (module author)
   - **Accessibility champion** when interactive controls changed

## 6. Helpful Utilities
- `@/components/ui/CodeBlock` supports copy buttons and dark mode automatically—reuse for code overlays.
- `@/components/diagrams/DiagramSkeleton` gives a responsive frame with caption + legend slots.
- Use `npm run svgo` to optimize new SVGs (script runs SVGO with project presets).

## 7. Common Pitfalls to Avoid
- Embedding fonts in SVGs—use system fonts or project tokens instead.
- Exporting raster screenshots; always provide vector art for scalability.
- Forgetting to update `src/lib/curriculum-data.tsx` so navigation knows about the new visual.

Keep this guide close to `docs/visual-design-guide.md`. When adding new components or utilities, append instructions here so contributors have a single reference point.
