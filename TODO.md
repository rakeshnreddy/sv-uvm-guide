
# TODO (remaining work)

## Tier 2 Curriculum Migration
- [x] I-SV-2 Constrained Randomization – completed ✅
- [x] I-SV-3 Functional Coverage – completed ✅
- [x] I-SV-4 Assertions & SVA – migrate to new template, add visuals/flashcards ✅
- [x] I-UVM-1 UVM Intro – migrate to new template, add visuals/flashcards ✅
- [x] I-UVM-2 Building TB – update to template, verify assets ✅
- [x] I-UVM-3 Sequences – update template, add practice links ✅
- [x] I-UVM-4 Factory & Overrides – update template, ensure diagrams ✅
- [x] I-UVM-5 Phasing & Sync – update template + visuals ✅

## Tier 3/4 Planning
- [x] Audit Tier 3/4 topics for template adoption and create migration plan
- [x] Identify missing visual assets for advanced topics (RAL, performance, debug)

## Glassmorphism Rollout
- [x] Practice Hub – completed ✅
- [x] Apply glass-card utilities to dashboard/community pages
- [x] Update remaining legacy components (navbar, footer) to new design tokens

## Coverage & Automation
- [x] Add regression test coverage for slug normalization so 2-segment curriculum routes stay routable
- [x] Add lint/test check in CI for template compliance on all tiers
- [x] Build PR checklist referencing template + visual design guide
- [x] Script a factory audit that flags `uvm_*` classes still using direct `new()` instead of `::type_id::create`

## Interactive Components
- [x] Finish UVM exercises (Agent Builder, Phase Sorter, Scoreboard) – scoring, feedback, persistence (local persistence + feedback shipped; add analytics + accessibility polish)
- [x] Implement Randomization Explorer enhancements (batch sampling, success metrics, conflict demo)
- [x] Build sequencer↔driver handshake animation for the I-UVM-2 module to reinforce the transaction flow
- [x] Prototype a sequencer arbitration sandbox (lock/unlock, grab/release) to accompany I-UVM-3 sequencing drills

## Content Operations
- [x] Create coverage dashboard showing migration status per topic – live at `/dashboard/coverage`
- [x] Define SME review rotation for Tier 2 & Tier 3 content
- [x] Draft contributor guide for adding visuals (SVG/animations)
- [x] Conduct comprehensive content QA: review each section for accuracy, fill missing details, and ensure explanations stay approachable *(See `docs/audits/content-qa-plan.md` for sign-off details.)*
- [x] Audit and remove redundant pages/data so the site stays lean and maintainable (legacy UVM folders archived; Tier-1 F2 primer + F3 intro/behavioral merged; finish F4 stub cleanup + SME sign-off)
- [x] Drive homepage CTAs (learning paths, recommendations) from curriculum data to avoid stale slugs

## Technical Debt
- [x] Address outstanding lint TODOs (e.g., animations hooking pattern) *(Repository scan confirms no remaining lint TODO suppressions; animation hooks use standard effect patterns.)*
- [x] Replace remaining mock data (home personalization) with feature flag/empty states *(EngagementEngine now fetches `/api/engagement/:userId` with feature-flagged mock fallback and empty-state defaults.)*
- [x] Investigate Monaco sourcemap warning during tests *(Vitest setup suppresses noisy logs; custom plugin strips missing sourceMappingURL so runs stay quiet)*
- [x] Drive curriculum sidebar completion states from actual module metadata instead of hard-coded flags ✅
- [x] Audit secondary tsconfig overrides to ensure `moduleResolution: bundler` stays compatible with emitted module targets
- [x] Replace breadcrumb progress mock with a dynamic progress source to prevent stale or invalid slugs showing in navigation
- [x] Fix outstanding TypeScript errors (KnowledgeGraphVisualizer, AudioLearningSystem, AI Assistant tests, simulation mocks) so `npm run type-check` passes *(`npm run type-check` clean as of 2025-10-06.)*

## Navigation & Experience Polish
- [x] Add privacy and terms pages so footer links resolve without 404s
- [x] Provide a dedicated placement quiz landing route and align homepage CTAs
- [x] Normalize assessment layout usage to avoid double-rendered navigation chrome
- [x] Wire homepage personalization to the engagement API fallback instead of hard-coded mock data

## Next Focus Candidates
- [ ] Expand the placement quiz into an interactive assessment with scoring and analytics instrumentation
- [ ] Power notifications with real activity events and per-user preferences
- [ ] Replace the settings stub with persisted profile, theme, and communication preferences
