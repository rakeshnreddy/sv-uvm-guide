# 6a author log: page:history (/history)

Date: 2026-11-10. Author: Claude (page:history).

## What I built

- `src/app/(learning)/history/page.tsx`: a static `/history` page with metadata, a short summary, the two visuals, a reserved-words-by-edition section, a "why this matters for your testbench" section and a numbered References list. The page has no placeholder copy and no draft gate: `notFound()` and `SITE_FEATURES.draftPages` are gone, so the page renders at 200 (see shared-file requests).
- `src/app/(learning)/history/history-timeline.ts`: all the facts as data. There are 21 events in 5 eras and 26 sources, and each event has `what`, `why` and source ids. The file also holds the keyword-edition cards from IEEE 1800-2023 §22.14, Tables 22-2 to 22-6.
- `src/app/(learning)/history/HistoryTimeline.tsx`: server components with no client JS.
  - `HistoryLineage` (◇ illustration): two family-tree columns, SystemVerilog and UVM, joined by labelled arrows ("standardized as", "merged with 1364-2005 into", and so on).
  - `HistoryTimeline` (◇ illustration): an ordered list of eras and events in one column at every width.
  - Non-colour cues: the lane is a text chip (Language or Methodology), and the publisher is a text tag plus a marker shape (square for an IEEE standard, filled circle for Accellera, hollow circle for a vendor).
  - Each event has `<time dateTime>`, a "Why:" line and in-text citations `[n]` that link to `#source-<id>`. Nothing is shown only on hover.
  - The markers are small SVGs. On the event markers the shape carries `data-role="timeline-point"`, inside `data-testid="history-timeline-chart"`, so the existing `tests/e2e/visualizations.spec.ts` check still holds.
- `tests/app/history-page.test.tsx`: 12 tests. They cover:
  - data integrity: dates are valid, every source exists and is cited, eras are in date order, every event has a what and a why;
  - pinned IEEE approval dates and the complete keyword tables (22-3 and 22-6);
  - rendering: no placeholder text, one entry and one point per event, lane and kind shown as text, every citation anchor resolves, coverage of every brief milestone, and the curriculum link.

## Sources verified (WebFetch, 2026-11-10)

| Fact | Source |
|---|---|
| IEEE 1364-1995 approved 1995-12-12, published 1996-10-14 | standards.ieee.org/standard/1364-1995.html |
| IEEE 1364-2001 approved 2001-03-17, published 2001-09-28 | standards.ieee.org/ieee/1364/2052/ |
| IEEE 1364-2005 approved 2005-11-08, published 2006-04-07, superseded by 1800-2009 | standards.ieee.org/standard/1364-2005.html |
| Accellera SV 3.0 vote completed 3 Jun 2002 | accellera.org/images/eda/vlog-pp/0678.html |
| Superlog ESS (Co-Design) and DAS (Co-Design and Real Intent) donations | Accellera release, reprinted by Electronicstalk on 4 Jul 2002 (old.electronicstalk.com/news/acc/acc104.html) |
| Synopsys donation for 3.1 (OpenVera testbench, OpenVera Assertions, C/C++ model interface, coverage API), 11 Jun 2002 | accellera.org/images/eda/vlog-pp/0708.html |
| Accellera board approved SV 3.1 on 29 May 2003 | accellera.org/images/eda/sv-bc/0860.html |
| SV 3.1a published 2004 and the base of IEEE 1800 | IEEE 1800-2023 Introduction and §1.4 (local LRM) |
| P1800 (1800-2005) approved by IEEE-SASB 8 Nov 2005 | accellera.org/images/eda/sv-bc/3419.html (IEEE letter forwarded) |
| 1800-2005 was extensions only; the 2009 merger and its reason | IEEE 1800-2023 §1.3 NOTE (local LRM) |
| IEEE 1800-2009 approved 2009-11-09, published 2009-12-11 | standards.ieee.org/ieee/1800/3989/ |
| P1800 revision (1800-2012) approved by SASB 5 Dec 2012 | accellera.org/images/eda/sv-ec/8431.html |
| IEEE 1800-2017 approved 2017-12-06, published 2018-02-22 | standards.ieee.org/ieee/1800/6700/ |
| IEEE 1800-2023 approved 2023-12-06, published 2024-02-28 | standards.ieee.org/ieee/1800/7743/ |
| Reserved words added per edition; 2017 and 2023 add none | IEEE 1800-2023 §22.14, Tables 22-2 to 22-6, §22.14.9 (local LRM) |
| 1800-2023 purpose (correct, clarify, enhance) | IEEE 1800-2023 §1.2 (local LRM) |
| IEEE 1647 'e' ratified, IEEE release dated 5 Apr 2006 | design-reuse.com/news/13013 (reprint) |
| VMM book: Springer release 21 Sep 2005, co-authored by ARM and Synopsys; Crossref issued 2006 | design-reuse.com/news/11413 (reprint); api.crossref.org for DOI 10.1007/b135575 |
| AVM: Mentor release 8 May 2006, TLM framework in SystemC and SystemVerilog, Apache 2.0 | design-reuse.com/news/13294 (reprint) |
| OVM: Cadence and Mentor release 9 Jan 2008, based on 1800-2005, Apache 2.0, compatible with AVM and URM | design-reuse.com/news/17416 (reprint) |
| OVM = AVM + URM + eRM concepts; UVM adds VMM concepts and code; TLM based on OSCI; "first verification methodology to be standardized"; the interoperability motivation | IEEE 1800.2-2020 Introduction (local LRM) |
| UVM 1.0: Accellera release 21 Feb 2011; derived from OVM; phasing, VMM-derived register package, TLM-2.0 | design-reuse.com/news/25729 (reprint) |
| UVM 1.0 (2011-02), 1.1 (2011-06), 1.1d (2013-03), 1.2 (2014-06), 2017 libraries, 2020.1.0 (2020-12) | accellera.org/downloads/standards/uvm (its "date modified" values) |
| UVM 1.2 released 24 Jun 2014; review to 1 Oct 2014; commitment to the IEEE | accellera.org/news/newsletters/2014-july |
| IEEE 1800.2-2017 approved 2017-02-14, published 2017-05-26 | standards.ieee.org/ieee/1800.2/6021/ |
| 1800.2 based on UVM 1.2; LRM moves to the IEEE (Accellera release 11 Apr 2017) | accellera.org/news/press-releases/239-... |
| IEEE 1800.2-2020 approved 2020-06-04, published 2020-09-14 | standards.ieee.org/ieee/1800.2/7567/ |
| uvm-core releases 2020-2.0 (2023-07-06), 2020.3.0 (2024-03-01), 2020.3.1 (2024-09-03) | GitHub API, accellera-official/uvm-core releases |

### Omitted because I could not verify them against an official source

- Verilog's origin at Gateway Design Automation and its dates.
- The Open Verilog International public-domain release.
- The Vera origin before Synopsys.
- The Accellera founding year.
- The UVM early-adopter (May 2010) date.
- The UVM 1.1 board approval date. Only a forum post gave one, and that post returned 403.
- The approval wording for UVM 1.1a, 1.1b and 1.1c.
- The Accellera 2020.3.2 row. The download page shows it with "date modified 2026-08", but the GitHub releases list does not show it.

Where only a reprint of a vendor or IEEE announcement could be fetched, the References entry names the reprint.

## Verilator

`verilator --version` reports Verilator 5.052 2026-09-05. This item ships no SystemVerilog files: the only code on the page is reserved-word chips. There was nothing to compile, so Verilator was not run.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/app/history-page.test.tsx`: 12 of 12 passed.
- `tests/app/sitemap.test.ts`: 1 test fails, "hides every hidden page behind notFound() in its page.tsx". `/history` is no longer hidden, and `/resources`, which another author un-gated, fails the same assertion first. This needs the shared-file change below.
- `npx eslint "src/app/(learning)/history" tests/app/history-page.test.tsx`: clean.
- `npx tsc --noEmit -p .`: no errors in my files. The remaining errors are in `src/components/knowledge/LearningPathGenerator.tsx`, which is not mine.
- No MDX was touched, so `check-mdx` does not apply.
- Not run: a 390 px browser capture, because servers are not allowed for this item. The layout is a single column with `break-words` references, wrapping chips and `auto-fit minmax(min(100%,260px),1fr)` for the lineage grid.

## Shared-file requests

1. `src/app/sitemap.ts`: add `"/history"` to `PUBLIC_PAGES`, and drop `/history` from the hidden-pages comment.
2. `tests/app/sitemap.test.ts`: remove `"/history"` from `HIDDEN_PAGES`.
3. `tests/e2e/feature-flags.spec.ts`: remove the `/history` entry from `HIDDEN_PAGES`, since it now answers 200.
4. `tests/e2e/visualizations.spec.ts`: drop the draft-page skip and comment for `/history`. The `history-timeline-chart` and `timeline-point` selectors still match.
5. `tests/components/Navbar.test.tsx`: remove `'/history'` from the hidden list if a navigation link is added.
6. Navigation and footer: optionally link `/history`, for example from the footer or the Resources group.
7. `src/lib/site-features.ts`: update the `draftPages` comment so it no longer lists `/history`.
8. `src/components/charts/HistoryTimelineChart.tsx` is now unused by `/history`. Its owner can delete it, after checking that nothing else imports it.

## Fix round 1

- S2: the IEEE 1800-2017 "why" no longer states a five-year maintenance rule (current IEEE SA Bylaws 9.2 differ). It now says, from IEEE 1800-2023, that the 2017 revision added no reserved words (§22.14.9) and deprecated the 1800-2012 operator overloading construct (Annex C.2.8). The IEEE SA 1800-2017 page (fetched 2026-11-10) gives no revision rationale, so none is claimed. `ieee-1800-2005-approval` was removed from that event's sources; the `lrm-1800-2023` label now names Annex C.2.8.
- S3: the timeline summary and first assumption now say IEEE 1647 is dated by its IEEE news release, not a board approval.
- S3: the uvm-core entry now lists the Accellera downloads page releases (2020-1.0 2020-12, 2020-1.1 2021-02, 2020-2.0 2023-02, 2020-3.0 2024-02, 2020-3.1 2024-08, 2020-3.2 2026-08, fetched 2026-11-10) and notes that GitHub dates differ (2020-2.0 shown 6 Jul there).
- S3: IEEE 1800.2-2017 is now "developed from UVM 1.2, which Accellera transferred to the IEEE".
- S3: test count corrected to 12.
- Validation: `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/app/history-page.test.tsx`: 12 of 12 passed. `npx eslint "src/app/(learning)/history" tests/app/history-page.test.tsx`: clean. `npx tsc --noEmit -p .`: no errors in history files. No SystemVerilog ships, so Verilator does not apply.
