# SV/UVM Project Guidebook

This guide consolidates the strategic, instructional, and visual references used across the SystemVerilog & UVM learning platform. Treat it as the single reference for product context, authoring standards, and supporting resources.

## 1. Product Vision & Outcomes
- **Purpose:** Deliver the definitive, open-source learning journey that takes engineers from no verification background to confident SystemVerilog/UVM practitioners.
- **North-star results:**
  - Every learner finishes each tier with runnable labs, self-assessment artifacts, and durable understanding.
  - Contributors can extend curriculum and features without reinventing structure, tone, or visuals.
  - The experience earns industry credibility—accurate content, inclusive design, disciplined QA.
- **Guiding principles:**
  1. **Learning retention loop** – every module supports *Learn → Apply → Solidify → Collaborate*.
  2. **Progressive disclosure** – reveal complexity in layers across tiers and inside each page.
  3. **Context before mechanics** – explain “why” before syntax; ground examples in real verification problems.
  4. **Code-first accuracy** – include compilable SV/UVM samples and labs with tooling instructions.
  5. **Active engagement** – reinforce with quizzes, flashcards, exercises, or AI prompts.
  6. **Digital Blueprint aesthetic** – consistent color, depth, and motion language.
  7. **Accessibility by default** – meet WCAG AA, support theming, keyboard flows, and responsive layouts.

## 2. Experience Pillars
- **Information architecture:** Four-tier curriculum (see §3) with persistent navigation, breadcrumbs, and related-topic cross-links.
- **Learning surfaces:** Hero assessment CTA, personalized recommendations, curriculum quick links (interactive diagram optional), labs, flashcards/quizzes, diagnostics.
- **Visual system:** Navy foundations, cyan accents, warm CTAs, glassmorphism cards, purposeful motion using Framer Motion.
- **Quality bar:** Responsive on all breakpoints, keyboard accessible, linted/tested, telemetry-ready where relevant.

## 3. Curriculum Outline
| Tier | Module | Focus |
| ---- | ------ | ----- |
| **Tier 1 – Foundational** | F1 Why Verification? | Verification purpose and landscape. |
|  | F2 Data Types | SystemVerilog scalar and aggregate types. |
|  | F3 Procedural Constructs | Flow control, tasks/functions, process control. |
|  | F4 RTL & Testbench Constructs | Interfaces, packages, clocking/program blocks. |
| **Tier 2 – Intermediate** | I-SV-1 OOP for Verification | Classes, inheritance, polymorphism. |
|  | I-SV-2 Constrained Randomization | `rand`/`randc`, constraints, solver hooks. |
|  | I-SV-3 Functional Coverage | Covergroups, coverpoints, crosses, metrics. |
|  | I-SV-4 Assertions (SVA) | Temporal properties, sequences, protocol checking. |
|  | I-UVM-1 Core Concepts | UVM component taxonomy, factory overview. |
|  | I-UVM-2 Base Class Library | Agents, drivers, sequencers, monitors. |
|  | I-UVM-3 Component Communication | TLM ports, analysis FIFOs, objections. |
|  | I-UVM-4 Factory & Overrides | `::type_id::create`, configuration DB, overrides. |
|  | I-UVM-5 Phasing & Sync | Phase flow, objections, synchronization primitives. |
| **Tier 3 – Advanced** | A-UVM-1 Advanced Sequencing | Virtual sequencers, arbitration, layered stimulus. |
|  | A-UVM-2 Factory Deep Dive | Policy classes, factory diagnostics, best practices. |
|  | A-UVM-3 Advanced Techniques | Virtual interfaces, DPI bridges, scoreboards. |
|  | A-UVM-4 Register Layer (RAL) | Register models, backdoor/frontdoor access, mirroring. |
| **Tier 4 – Expert** | E-CUST-1 Methodology Customization | Scaling teams, guidelines, custom phases. |
|  | E-DBG-1 Advanced Debug | Transaction tracing, waveform strategy, failure triage. |
|  | E-INT-1 UVM + Formal | Hybrid flows, assumptions/assertions alignment. |
|  | E-PERF-1 Performance | Optimization tactics, parallel regressions. |
|  | E-SOC-1 SoC Verification | Multi-IP integration, coherency, system scenarios. |

## 4. Learning Blueprint & Recommended Resources
- **SystemVerilog fundamentals:**
  - *SystemVerilog for Verification* (Spear & Tumbush) – definitive language primer.
  - Siemens Verification Academy SV track – free vendor-backed video curriculum.
  - Doulos tutorials & Sunburst Design papers – focused guidance on interfaces, CDC, assertions.
- **UVM methodology:**
  - *UVM Cookbook* and Accellera user guide – canonical library behaviors.
  - Verification Academy UVM courses & DVCon papers – advanced factory, phasing, and register techniques.
  - Blogs/podcasts (Verification Gentleman, AgileSoC) – applied tips and war stories.
- **Deliberate practice:**
  - Scaffold labs with simulation tool checklists.
  - Blend constrained-random and directed tests; tie coverage bins back to verification plan items.
  - Maintain a personal debugging log (issue → hypothesis → fix) to reinforce lessons.

## 5. Authoring Standards
Use this structure for each curriculum topic (H2 order is mandatory):
1. **Quick Take** – crisp definition, why it matters, analogy (`**The Analogy:**`).
2. **Build Your Mental Model** – mechanics, visuals, common pitfalls with `###` subsections.
3. **Make It Work** – runnable walkthrough, step-by-step checklist.
4. **Push Further** – advanced patterns, methodology insights.
5. **Practice & Reinforce** – quizzes, flashcards, labs, AI prompts (bullet list).
6. **References & Next Topics** – cite primary sources, link prerequisites/follow-ups.

Additional rules:
- Do not add explicit `#` H1 in MDX (provided by layout).
- Bold the first appearance of key terms and UI labels; use inline code for keywords/commands.
- Embed runnable examples (` ```systemverilog`) and mark partial snippets (`// snippet`).
- Provide at least one visual per major section (diagram, chart, animation). If pending, leave `*Visual coming soon*` placeholder.
- Required front matter keys: `title`, `description`, `flashcards`; add `tags` when useful.
- Definition of Done: template followed, runnable example + practice element included, checklist present, references mapped to blueprint resources, lint/tests run, SME review requested.

## 6. Visual & Interaction Guidelines
- **Palette:** navy base (`#050B1A`), glass surfaces (`rgba(20,33,61,0.65)` with blur), neon cyan accent (`#64FFDA`), warm CTA accent (`#FFCA86`), gradient hero (`linear-gradient(120deg, #64FFDA 0%, #7C4DFF 100%)`).
- **Typography:** `Cal Sans` (display), `Inter` (body), `JetBrains Mono` (code). Cap body line length at ~70 characters.
- **Glass cards:** 24px radius, 1px translucent border, `backdrop-filter: blur(18px)`, shadow `0 20px 45px rgba(15,24,45,0.45)`.
- **Content density:** Max 3–4 sentences per paragraph; break long sections with callouts, diagrams, or accordions.
- **Motion:** Subtle translateY(-4px) hover, fade/slide reveals (0.4s ease-out). Respect reduced motion preferences.
- **Utilities:** Provide shared Tailwind tokens/utilities for colors, shadows, blur, and gradient dividers.
- **Assets:** Store SVGs/backgrounds under `public/visuals/`; maintain design token parity with Figma or JSON exports.

## 7. Data & Security Snapshot
- User documents are keyed by Firebase Auth UID; learners may read/write only their own profile and sub-collections (`progress`, `flashcardProgress`, `exerciseScores`).
- Topic/resource collections are read-only from the client; writes occur via admin tooling.
- Default rule stance is deny-unless-allowed. Incorporate validation checks on `request.resource.data` in production.
- Introduce admin custom claims for elevated access and test rules with the Firebase emulator before deploying.

## 8. Testing & Quality Expectations
- Automated coverage evolves with features: add/update unit, integration, and E2E specs as part of each change (`TASKS.md` → `QA-4`).
- Focused Playwright suites: `tests/e2e/curriculum-links.spec.ts`, `tests/e2e/curriculum-nav.spec.ts`, `tests/e2e/exercise-feedback.spec.ts`.
- Full health check before release: `npm run lint && npm run test && npm run build && npm run test:e2e`.

## 9. Contribution Workflow
- Day-to-day contribution process lives in `CONTRIBUTING.md` (branching, review, Definition of Done).
- `TASKS.md` tracks active engineering/content work; update status as part of each PR.
- `prompt_to_resume.txt` captures handoff notes between sessions.

## 10. Reference Summary
- **Code:** curriculum content under `content/curriculum`, layouts/components in `src/components` and `src/app`.
- **Data/config:** `src/lib/curriculum-data.tsx`, `next.config.mjs`, `tailwind.config.ts`.
- **Testing:** `tests/e2e`, `vitest.config.mts`.
- **Assets:** `public/visuals/`, `public/diagrams/`.

## 11. Changelog
- **2025-10-10:** Consolidated planning, style, blueprint, and visual guides into this handbook; migrated outstanding work to `TASKS.md`.
- **2025-10-07:** Homepage personalization sourced from `/api/engagement/:userId`; navigation polish added placement quiz, privacy, terms, settings, notifications routes.
- **2025-09-17:** Adopted Quick Take → References structure; refreshed style and visual guidelines.
