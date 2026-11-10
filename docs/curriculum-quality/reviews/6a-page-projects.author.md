# 6a page: /projects (author log)

## What I built

- `src/app/(learning)/projects/projects-data.ts`: nine project briefs, one per milestone M0-M8 (`MILESTONES` in `src/lib/learning-paths.ts`). Each brief has a goal, a design under test, required features, acceptance criteria with planted mutants, the lessons and labs that prepare it, stretch goals, an effort range and the simulator it needs. The briefs follow the milestone definitions and acceptance in `docs/audit/2026-10-03-learning-outcomes/tb-mastery-progression.md`, and use the §5.1 terminology of the curriculum spine.
- `src/app/(learning)/projects/resolve-projects.ts`: resolves each brief against `MILESTONES`, lessons through `resolveLessonRef`, and labs through `getLabById` + `toLabPracticeItem` (practice-links). It throws on a ref that does not resolve. It is kept out of `page.tsx` because Next pages may only export the page and its metadata.
- `src/app/(learning)/projects/page.tsx`: the placeholder page has been replaced. It has a lead, "How to use these briefs" (which says plainly that nothing on the site runs or grades a project), a milestone ladder with anchors, the nine project sections and a suggested repository layout. Labs that are not available (`constructs-1`, `dma-1`) appear as text marked "(lab coming soon)" and are never linked. M5 has no milestone lab; it lists `uvm-mini-capstone` and `config-debug` as preparation.
- Progress tracking: none. No learner-store repository exists for projects (`src/lib/learner-store/repositories` has activity, assessments, flashcards, labs, legacy, lessons, meta and notebook only), so the page is static, as the brief allows.
- Gate kept: the page still calls `notFound()` unless `SITE_FEATURES.draftPages` is on, because `tests/app/sitemap.test.ts`, `tests/components/Navbar.test.tsx` and `tests/e2e/feature-flags.spec.ts` pin `/projects` as hidden. The content has no placeholder text and can go public once the shared files below change.
- `tests/app/projects-page.test.tsx` (10 tests): one brief per milestone in ladder order; every part filled; each milestone's lab is listed; every lab is in the registry and not archived; every lesson resolves to a canonical URL; 404 while draft pages are off; static, no placeholder text; every milestone section, anchor and heading renders; every lesson and available lab is linked and no unavailable lab is; the self-checked statement is there and nothing claims progress tracking.

## Sources verified (read in place)

- IHI0022E A5.3.1 Read ordering. Same-ARID read data returns in order; different ARIDs may arrive in any order and may be interleaved. This supports the M6 brief.
- IHI0022E A3.4.1 Address structure: "A burst must not cross a 4KB address boundary." This supports the M6 burst generator.
- IEEE 1800.2-2020, 18.5.4.6 `set_access`. The access policy list includes "RW", "RO" and "W1C" (W1C: 1/0 clears/no effect). `is_volatile` is 18.5.4.10. Both support M7.
- IEEE 1800.2-2020, Annex E.1 `uvm_reg_hw_reset_seq` (reads every register and compares it with the reset value), 18.2.5.2 `set_auto_predict`, 19.3 `uvm_reg_predictor`, 13.4.2.2 `get_is_active` and F.7.4.2 `print_topology`. These support M2 and M7.
- IHI0024C 3.4 Error response, for PSLVERR (M7).
- No external URLs or historical facts are used on the page.

## Verilator

`verilator --version` reports Verilator 5.052 2026-09-05. No SystemVerilog file ships with this page: the briefs describe designs for the learner to write and contain no SV code, so there was nothing to lint or run. The page says Verilator 5 with `--timing` can run M0 and M1 because they are plain SystemVerilog with timing controls. It makes no claim about UVM or covergroup support in any particular tool.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/app/projects-page.test.tsx tests/app/sitemap.test.ts tests/components/Navbar.test.tsx tests/lib/practice-links.test.ts`: all pass (10 + 9 + Navbar/practice-links 222).
- `npx tsc --noEmit -p .`: clean.
- `npx eslint "src/app/(learning)/projects/" tests/app/projects-page.test.tsx`: clean.
- No MDX was touched, so `check-mdx` does not apply.

## Shared-file requests

To make /projects public:

1. `src/app/sitemap.ts`: add `/projects` to `PUBLIC_PAGES`, and drop it from the hidden-pages comment.
2. `tests/app/sitemap.test.ts`: remove `/projects` from `HIDDEN_PAGES`.
3. `tests/components/Navbar.test.tsx`: remove `/projects` from the hidden list, and add a nav link if the owner wants one (for example next to Practice).
4. `tests/e2e/feature-flags.spec.ts`: remove the `/projects` entry from `HIDDEN_PAGES`.
5. `src/lib/site-features.ts`: drop `/projects` from the `draftPages` comment. After items 1-4, the `notFound()` gate in `page.tsx` can be removed (I can do that in my own file).

Optional:

6. `src/lib/practice-links.ts` or the Practice Hub: link to /projects from the hub.
7. `src/lib/learner-store`: a `projects` repository (status per milestone: not started, in progress, done), if the owner wants progress tracking. The page would then gain a small client toggle.
