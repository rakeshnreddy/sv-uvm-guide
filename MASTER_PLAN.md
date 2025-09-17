# SystemVerilog & UVM Learning Platform – Master Plan

This document is the single source of truth for strategy, scope, and execution of the sv-uvm-guide project. It consolidates the prior planning files (`maindata.md`, `enhance.md`, `enhancements.md`) and will guide future updates.

---

## 1. Vision & Outcomes
- **Product vision:** Deliver the definitive, open-source, visually rich learning experience that takes engineers from zero knowledge to confident SystemVerilog/UVM practitioners.
- **Tagline:** *Learn it. Apply it. Retain it.*
- **North-star outcomes:**
  - Learners complete each tier with runnable labs, self-assessment, and retained knowledge.
  - Contributors can extend curriculum or features without re-inventing structure or styles.
  - The platform is credible for industry adoption (accuracy, polish, accessibility, reliability).

## 2. Guiding Principles
1. **Learning Retention Loop:** every module supports *Learn → Apply → Solidify → Collaborate*.
2. **Progressive Disclosure:** reveal complexity gradually across four tiers and within each page (Level 1/2/3 narrative).
3. **Context before Mechanics:** explain why a construct exists before showing syntax; anchor examples to realistic verification problems.
4. **Code-first Accuracy:** each topic includes compilable SystemVerilog/UVM samples or labs with tooling instructions.
5. **Active Engagement:** quizzes, flashcards, exercises, AI or peer interaction reinforce recall.
6. **Digital Blueprint Aesthetic:** consistent visual language (deep navy background, cyan accent, warm CTA, Cal Sans/Inter/JetBrains Mono) and purposeful motion.
7. **Inclusive & Accessible:** meet WCAG 2.1 AA, support theming, responsive layouts, and accessible interactions (keyboard, ARIA, contrast).

## 3. Audience & Journey
- **Tier 1 – New to verification:** software or RTL engineers needing foundational concepts and first simulations.
- **Tier 2 – Practitioners:** engineers building UVM environments who need OOP, randomization, coverage, and methodology basics.
- **Tier 3 – Advanced users:** verification leads optimizing sequences, phasing, and RAL integration.
- **Tier 4 – Architects:** methodology customization, performance, debug, SoC-level strategy.
- **Supporting personas:** educators building coursework, contributors authoring new modules, reviewers ensuring technical accuracy.

## 4. Experience Pillars
- **Information architecture:**
  - Four-tier curriculum aligned with `COMPREHENSIVE_CURRICULUM_MODULE_MAP.md` (canonical module list).
  - Global nav: Home, Curriculum, Practice, Resources, Community, Dashboard, AI Tutor.
  - Persistent curriculum tree with breadcrumbs and cross-link suggestions between related topics.
- **Learning surfaces:** hero overview with assessment CTA, personalized dashboard, interactive diagrams, labs/workspaces, flashcards & quizzes, diagnostics.
- **Visual system:** adopt Tailwind tokens for colors/spacing/typography; use Framer Motion for subtle motion; ensure assets scale to mobile; align with blueprint diagrams.

## 5. Current Snapshot (Sep 2025)
| Area | Status | Notes |
| --- | --- | --- |
| Curriculum coverage | Tier 1 pages rich; Tier 2-4 mix of stubs & outlines | `PENDING_CONTENT.md` checklist exists but lacks depth tracking |
| Interactive experiences | Hero diagram, flashcards, drag-and-drop exercises prototyped | Scoring, persistence, and accessibility incomplete |
| Data & personalization | Mock data in home page; Firestore integration stubbed | Need abstraction + environment configuration guidance |
| QA & testing | Linting/type-check; limited unit tests; theming E2E | Need coverage for exercises, content routing, accessibility |
| Documentation | Multiple overlapping plans; style guide + contributing doc solid | This master plan supersedes previous planning files |

## 6. Workstreams & Roadmap

### WS-A: Curriculum & Structure
- **Goal:** Align routing, data, and navigation with the canonical curriculum map.
- **Key deliverables:**
  - Update curriculum data/config to match module map slugs; resolve duplicates.
  - Page ownership matrix with completion status and SMEs.
  - "Start Here" onboarding and progress tracker surfaced in Curriculum page.
- **Implementation steps:**
  1. Audit existing MDX slugs vs map; document gaps.
  2. Adjust `curriculum-data.ts`, dynamic routes, breadcrumbs.
  3. Publish status table (YAML/JSON) consumed by UI for progress badges.
- **Definition of done:** clicking every curriculum node loads a fully structured page (even if marked “In Progress”), and navigation tests confirm no 404s.

### WS-B: Experience & Visual System
- **Goal:** Ship a cohesive Digital Blueprint UI that performs across devices.
- **Key deliverables:**
  - Centralized design tokens (colors, typography, spacing, shadows) + component usage guidelines.
  - Glassmorphism component kit documented in `docs/visual-design-guide.md` with reusable utilities.
  - Responsive audit fixes for hero, diagrams, exercises, dashboards.
  - Accessibility report with remediation (focus order, ARIA, contrast, motion preferences).
- **Implementation steps:**
  1. Extract tokens into Tailwind/theme config; document usage.
  2. Update core surfaces (hero, cards, exercises) to use glass-card utilities and reduce text density with visuals.
  3. Replace mock personalization data with feature-flagged real data or empty states.
  4. Run manual + automated accessibility checks (axe, pa11y) and patch issues.
- **Definition of done:** UI matches design spec, passes responsiveness check, and meets accessibility standards.

### WS-C: Learning Mechanics & Personalization
- **Goal:** Transform prototypes into retention-driving tools.
- **Key deliverables:**
  - Flashcard system with local storage + Firestore sync (deck mapping to curriculum topics).
  - Gamified exercises with scoring, feedback, retries, and progress storage.
  - AI Tutor/API strategy (scope, prompts, safeguards) with opt-in UX.
- **Implementation steps:**
  1. Define shared progress service (local first, optional remote) and wire to widgets.
  2. Expand exercises (agent builder, phase sorter, scoreboard connector) with validation logic and animations per backlog.
  3. Design AI tutor interaction model, guardrail flows, and resource usage limits.
- **Definition of done:** Learners can start an activity, receive meaningful feedback, leave and return with state preserved; analytics capture usage.

### WS-D: Content Production & Editorial
- **Goal:** Deliver authoritative multi-level content across all tiers.
- **Key deliverables:**
  - Content pipeline (issue templates, SME review, style linting) documented in `CONTRIBUTING.md`.
  - Topic template applied (Quick Take → References & Next Topics) with runnable examples and retention assets per topic.
  - Reusable MDX starter (docs/topic-template.mdx) and author checklist available.
  - Cross-linking strategy & glossary anchored in `SYSTEMVERILOG_UVM_BLUEPRINT.md`.
- **Implementation steps:**
  1. Prioritize topics per tier and assign authors/reviewers.
  2. Integrate MDX linting and terminology checks; automate CI validation.
  3. Populate flashcards/quizzes automatically from blueprints where possible.
  4. Review drafts for both completeness and presentation—ensure thorough explanations remain intact while spacing and visuals keep readability high.
- **Definition of done:** Each published topic meets Definition of Done checklist, and review history is tracked.

### WS-E: Platform, QA & Launch
- **Goal:** Ensure the platform is reliable, testable, and deployable anywhere.
- **Key deliverables:**
  - Test suite covering routing, key components, exercises, and theming.
  - Deployment documentation for local, Docker, Vercel, and on-prem installs.
  - Monitoring/analytics proposal (privacy-conscious) and performance budget.
- **Implementation steps:**
  1. Add unit tests (Vitest/RTL) for helpers and widgets; extend Playwright flows.
  2. Document environment configuration (Firebase, Prisma) and provide sample `.env.local`.
  3. Set up CI pipelines (lint, type-check, tests) and publish release checklist.
- **Definition of done:** CI passes green, smoke tests succeed post-deploy, and launch playbook is documented.

## 7. Execution Phases
| Phase | Focus | Exit Criteria |
| --- | --- | --- |
| 0. Alignment (1 week) | Adopt this master plan, inventory curriculum & components, set ownership | Plan approved; audits logged in tracker; unnecessary docs removed |
| 1. Foundations (3-4 weeks) | WS-A core tasks + initial WS-B tokenization; baseline tests | Curriculum nav stable; design tokens merged; regression tests added |
| 2. Learning Mechanics (4 weeks) | WS-C implementation; begin Flashcard/Exercise persistence | Activities score & persist; AI tutor spec ready; analytics events defined |
| 3. Content Expansion (ongoing sprints) | WS-D heavy lift, cross-linking, glossary, labs | Tier 1-2 complete; Tier 3 underway; content QA workflow running |
| 4. Launch Readiness (2 weeks) | WS-E polish, a11y re-check, performance tuning, marketing prep | Lighthouse/accessibility benchmarks hit; deployment docs vetted |
| Continuous | Retro, backlog grooming, contributor onboarding | Quarterly vision review; backlog prioritized |

## 8. Governance & Contribution Model
- **Roles:** Product steward (owns backlog), Content lead (curriculum & accuracy), UX lead (visual/tone), Engineering lead (platform/tooling), SME reviewers.
- **Workflow:**
  1. Create issue aligned with workstream + topic.
  2. Draft content/feature in branch; ensure tests + lint.
  3. Peer review (code + SME). Use Definition of Done checklist.
  4. Merge after CI passes; update progress tracker.
- **Definition of Done (content):** accurate, follows style guide, includes all required sections (Quick Take → References & Next Topics), at least one runnable example, one practice element, checklist, and references.
- **Definition of Done (feature):** responsive, accessible, tested, documented, analytics instrumented if applicable.

## 9. Reference Artifacts (retain)
- `COMPREHENSIVE_CURRICULUM_MODULE_MAP.md` – canonical curriculum hierarchy.
- `SYSTEMVERILOG_UVM_BLUEPRINT.md` – detailed topic breakdown, resources, analogies.
- `STYLE_GUIDE.md` – content formatting rules.
- `docs/visual-design-guide.md` – aesthetic system, glassmorphism rules.
- `CONTRIBUTING.md` – workflow, pedagogy, Definition of Done.
- `PENDING_CONTENT.md` – convert into dynamic progress tracker or integrate into dashboard (keep until superseded).

## 10. Change Management
- Update this plan whenever scope or priorities shift; note changes in a "Changelog" section appended below.
- Major changes require agreement from Product, Content, UX, and Engineering leads.
- Retired documents: `maindata.md`, `enhance.md`, `enhancements.md`. Do not reintroduce separate plans; append or link additions here.

---

### Changelog
- **2025-09-17:** Template update – adopted Quick Take → References & Next Topics structure, published docs/topic-template.mdx, refreshed style guide.
- **2025-09-17:** Initial consolidation authored by project steward.
