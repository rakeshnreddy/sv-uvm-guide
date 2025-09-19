# SME Review Rotation – Tier 1 & Tier 2

_Last updated: 2025-09-22_

## Purpose
Subject-matter experts (SMEs) review refreshed modules every sprint so accuracy stays high while the curriculum evolves. This rotation covers Tier 1 foundational content and Tier 2 intermediate topics, with deeper tiers following after the migration finishes.

## Participants
- **Priya Singh** – SystemVerilog design specialist (Tier 1 lead)
- **Miguel Alvarez** – UVM methodology architect (Tier 2 lead)
- **Chen Li** – Functional coverage & metrics expert
- **Avery Patel** – Randomization & constraint solver expert
- **Elena Novak** – Documentation & pedagogy reviewer (style/voice)

## Cadence
| Week | Focus Area | SME On Point | Backup |
| --- | --- | --- | --- |
| Week 1 (Sprint kickoff) | Tier 1 modules F1–F3 | Priya | Elena |
| Week 2 | Tier 1 modules F4–F6 + new labs | Chen | Priya |
| Week 3 | Tier 2 SV topics (I-SV-1 → I-SV-3) | Avery | Miguel |
| Week 4 | Tier 2 UVM topics (I-UVM-1 → I-UVM-3) | Miguel | Chen |
| Week 5 (wrap) | Tier 2 UVM topics (I-UVM-4 → I-UVM-5) & backlog | Priya | Avery |
| Week 6 (retro) | Sprint report + backlog triage | Elena | Miguel |

> **Note:** Weeks cycle continuously; adjust ownership when team members are OOO. Tier 3/4 rotations will be added once those migrations reach alpha review.

## Review Workflow
1. **Prep (Friday prior):**
   - Curriculum steward posts which modules changed during the sprint.
   - SMEs skim commit diffs or content previews linked in the dashboard.
2. **Review Session (Monday/Tuesday):**
   - SME reads the module in the staging site, cross-checks technical facts, executes sample code or labs, and verifies interactive components work with keyboard + screen reader basics.
   - Capture findings in `docs/audits/<tier>-reviews.md` with status: `pass`, `pass-with-nits`, or `blocker`.
3. **Hand-off (Wednesday):**
   - File issues in GitHub using the `curriculum-review` template, tagging authors + product.
   - Update the coverage dashboard (`/dashboard/coverage`) via the status JSON to mark the module `Reviewing` or `Complete`.
4. **Retro (Week 6):**
   - Consolidate learnings, note recurring defects, feed into `TODO.md`.

## Checklists per Review
- ✔ Technical accuracy matches the Accellera LRM or agreed best practices.
- ✔ Examples compile/run (`make sim` where provided).
- ✔ Terminology aligns with `STYLE_GUIDE.md` (capitalization, voice, glossary entries).
- ✔ Interactive widgets pass keyboard navigation + focus sanity checks.
- ✔ References and cross-links point to canonical modules (no legacy folders).

## Communication
- Async updates stay in `#curriculum-reviews` Slack channel.
- Escalate blockers in weekly stand-up or tag @curriculum-steward in GitHub.
- Vacation swaps should be logged in this file with date ranges.

## Upcoming Rotations
- **Oct Sprint A:** add Tier 3 assertion content (assign Chen + Miguel).
- **Nov Sprint B:** bring RAL SMEs into the loop (invite Priya S. + external reviewer TBD).

Keep this document current. When ownership changes, append a dated note under "Upcoming Rotations" and update the table above.
