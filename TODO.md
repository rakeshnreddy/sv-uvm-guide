
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
- [ ] Implement Randomization Explorer enhancements (if any outstanding)
- [x] Build sequencer↔driver handshake animation for the I-UVM-2 module to reinforce the transaction flow
- [x] Prototype a sequencer arbitration sandbox (lock/unlock, grab/release) to accompany I-UVM-3 sequencing drills

## Content Operations
- [x] Create coverage dashboard showing migration status per topic – live at `/dashboard/coverage`
- [x] Define SME review rotation for Tier 2 & Tier 3 content
- [x] Draft contributor guide for adding visuals (SVG/animations)
- [ ] Conduct comprehensive content QA: review each section for accuracy, fill missing details, and ensure explanations stay approachable *(Tier 1/2 pass completed; Tier 3/4 pending)*
- [ ] Audit and remove redundant pages/data so the site stays lean and maintainable (legacy UVM folders archived; continue Tier-1 consolidation)
- [x] Drive homepage CTAs (learning paths, recommendations) from curriculum data to avoid stale slugs

## Technical Debt
- [ ] Address outstanding lint TODOs (e.g., animations hooking pattern)
- [ ] Replace remaining mock data (home personalization) with feature flag/empty states
- [ ] Investigate Monaco sourcemap warning during tests
- [ ] Drive curriculum sidebar completion states from actual module metadata instead of hard-coded flags
- [x] Audit secondary tsconfig overrides to ensure `moduleResolution: bundler` stays compatible with emitted module targets
- [ ] Replace breadcrumb progress mock with a dynamic progress source to prevent stale or invalid slugs showing in navigation
- [ ] Fix outstanding TypeScript errors (KnowledgeGraphVisualizer, AudioLearningSystem, AI Assistant tests, simulation mocks) so `npm run type-check` passes
