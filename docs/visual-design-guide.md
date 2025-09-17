# Visual Design Guide

This guide translates the "Digital Blueprint" vision into concrete design rules so every page feels modern, colorful, and visually rich without overwhelming learners.

## Core Principles
- **Visual-first storytelling:** Lead with diagrams, charts, or interactive components. Text should support visuals, not the other way around.
- **Glassmorphism aesthetic:** Use layered translucency (background blur, semi-transparent panels) to create depth and keep focus on content cards.
- **Vibrant but disciplined palette:** Combine deep navy foundations with neon cyan accents and warm call-to-action highlights.
- **Motion with meaning:** Apply subtle hover states, parallax, or micro-animations to illustrate state changes and guide attention.
- **Responsive harmony:** Ensure visual elements adapt gracefully from large displays to mobile, preserving hierarchy and readability.

## Color System
| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Background | `--bg-base` | `#050B1A` | Page canvas with optional grid overlay. |
| Surface glass | `--bg-glass` | `rgba(20, 33, 61, 0.65)` | Semi-transparent cards with blur (`backdrop-filter: blur(18px)`). |
| Accent primary | `--accent-primary` | `#64FFDA` | Links, key icons, gradients. |
| Accent secondary | `--accent-secondary` | `#FFCA86` | Primary CTAs, success states. |
| Neutral foreground | `--fg-base` | `#E6F1FF` | Primary text. |
| Supporting gradient | `--gradient-hero` | `linear-gradient(120deg, #64FFDA 0%, #7C4DFF 100%)` | Hero and highlight borders. |

Update `tailwind.config.ts` tokens or CSS variables so components can reference these consistently.

## Typographic System
- **Display / Headings:** `Cal Sans`, 600-700 weight.
- **Body copy:** `Inter`, 400-500 weight; aim for line lengths under 70 characters.
- **Code / diagrams:** `JetBrains Mono`, 500 weight with neon highlight theme (Night Owl or SynthWave).
- **Microcopy:** Use uppercase tracking (`letter-spacing: 0.15em`) for section labels.

## Layout & Components
- **Glass cards:** Rounded 24px corners, border `1px solid rgba(255,255,255,0.12)`, shadow `0 20px 45px rgba(15, 24, 45, 0.45)`.
- **Section dividers:** Use gradient hairlines (`height: 2px`) or animated dotted lines rather than plain rules.
- **Iconography:** Prefer line-based icons (Lucide) with gradient strokes; pair with subtle glow.
- **Data visualizations:** Employ D3/Recharts with neon accent palettes and glow-style gridlines to reinforce the futuristic aesthetic.
- **Interactive labs:** Embed mini canvases (WaveDrom, Monaco, D3) inside glass panels with contextual tooltips.

## Content Density Guidelines
- Deliver complete, crystal-clear explanations—use as many words as needed, then stage them with headings, lists, and visuals so the page breathes.
- Max 3-4 sentences per paragraph; break long explanations into callouts or diagrams.
- Every major section should include at least one visual: chart, GIF, animation, or interactive widget.
- Leverage `<Note>`/`<Warning>` as floating glass chips that summarize key takeaways.
- Use progressive disclosure (tabs, accordions, popovers) to hide extended textual detail until the learner asks for it.

## Motion & Interaction
- **Hover states:** Scale cards subtly (`transform: translateY(-4px)`) and adjust blur for depth.
- **Section reveals:** Use Framer Motion fade-slide combos (`opacity 0→1`, `y 30→0`) with 0.4s ease-out.
- **Scroll-linked visuals:** Consider parallax backgrounds or animated outlines following the scroll position.
- Respect reduced-motion preferences—provide fallbacks without animation.

## Implementation Checklist
- Define Tailwind theme extensions (`colors`, `boxShadow`, `backdropBlur`) for the tokens above.
- Create shared utility classes (`glass-card`, `hero-gradient`, `glow-border`).
- Refactor existing components (HeroSection, Cards, Exercises) to use the new utilities and ensure consistent blur/gradient usage.
- Add Storybook or component gallery screenshots to validate aesthetic consistency.
- Validate contrast ratios (target WCAG AA even with translucency) using dark/light overlays.

## Visual Asset Library
- Maintain SVG icon sets and background patterns under `public/visuals/` with naming like `grid-bg.svg`, `hero-uvm.svg`.
- Store Figma frames or design tokens JSON in `docs/design/` for cross-tool synchronization.

## Next Actions
1. Update Tailwind configuration with the color/blur tokens and document usage in `docs/visual-design-guide.md`.
2. Refresh global surfaces (`src/app/page.tsx`, navigation, cards) to adopt glassmorphism panels.
3. Audit content pages to ensure each major section pairs text with a visual artefact.
4. Track compliance during reviews—use pull request checklist items referencing this guide.
