# 6a page:resources, author log

Date: 2026-11-10. Author: Claude (page:resources).

## What I built

- `src/lib/resources.ts`: plain, client-safe data for the library. 6 groups by purpose (standards; Arm AMBA specifications; free simulators and sandboxes; Python verification and generators; waveform viewers; lint and conformance) and 21 resources. Each has a tag (standard or document number), publisher, URL, cost label, summary, "What it covers" facts taken from the resource's own pages, "When to use it", lesson refs and search keywords. `VERIFIED_ON = '2026-11-10'`. Also `matchesResourceQuery` (every word must match, case-insensitive) and `resourcesInGroup`.
- `src/lib/resources-lessons.ts`: server-side `resolveResources()` and `unresolvedLessonRefs()`, which resolve lesson refs (module codes or `<Module>/<lesson>`) through `resolveLessonRef` in `src/lib/practice-links.ts`. Nothing is hard-coded as a URL; unknown refs are dropped and the test keeps them at zero.
- `src/app/(learning)/resources/page.tsx`: a static server page with metadata, a short introduction (checked date, the GET Program, the note that Arm "latest" links and lesson issue letters can differ), and the library.
- `src/app/(learning)/resources/ResourceLibrary.tsx`: a client component with a labelled search box, group filter buttons (`aria-pressed`), a polite live count, and an empty-state message. Every card is in the server-rendered HTML; filtering only hides cards. External links open in a new tab with `rel="noopener noreferrer"` and an sr-only "(opens in a new tab)". Lesson links reuse `LessonLinkList` ("Used in").
- **The page is no longer gated by `SITE_FEATURES.draftPages`**: it has no placeholder content, so it is public. This needs the shared-file changes below.
- `tests/app/resources-page.test.tsx`: 9 tests covering data integrity (unique ids, https and an allow-list of hosts, all briefed URLs present, every group non-empty, every lesson ref resolves), static HTML (every link, group title and the checked date, no placeholder text, metadata), and filtering (search, no-match message, group buttons, count).

## Sources verified (2026-11-10)

| Resource | URL | How checked | Result |
|---|---|---|---|
| IEEE 1800-2023 | https://standards.ieee.org/ieee/1800/7743/ | WebFetch | Active; published 2024-02-28; page says the PDF is available at no cost through the GET Program, courtesy of Accellera |
| IEEE 1800.2-2020 | https://standards.ieee.org/ieee/1800.2/7567/ | WebFetch | Active; published 2020-09-14; PDF at no cost through the GET Program |
| GET Program confirmation | https://www.accellera.org/downloads/ieee | WebFetch | Marks 1800-2023 and 1800.2-2020 as no cost via the IEEE GET program |
| IEEE Xplore GET series page | https://ieeexplore.ieee.org/browse/standards/get-program/page/series?id=80 | WebFetch and curl | HTTP 418 to automated clients, so **not linked**; the page sends learners to the IEEE standard pages, which carry the GET link |
| uvm-core | https://github.com/accellera-official/uvm-core | WebFetch, `gh api` | Apache-2.0; matches 1800.2-2020; DEVIATIONS.md; releases 2020.3.1 (2024-09-03), 2020.3.0, 2020-2.0. No version number is stated on the page |
| Accellera UVM downloads | https://www.accellera.org/downloads/standards/uvm | WebFetch | Current 1800.2 kits and UVM 1.2 / 1.1 kits |
| Arm AMBA index | https://www.arm.com/architecture/system-architectures/amba/amba-specifications | WebFetch | Lists the developer.arm.com `/latest` links used below; says ACE is superseded by CHI |
| AXI IHI 0022, AHB IHI 0033, APB IHI 0024, AXI-Stream IHI 0051, CHI IHI 0050 | https://developer.arm.com/documentation/ihi00NN/latest/ | WebFetch | Each answers 301 to support.arm.com/documentation/ihi00NN/latest; that page is script-rendered and refuses automated clients (403), so its body could not be read. The URLs are the ones Arm's own index publishes |
| Verilator | https://www.veripool.org/verilator/ | WebFetch | LGPL-3.0 or Artistic-2.0; `--binary`; "most verification constructs including UVM" |
| Verilator languages guide | https://verilator.org/guide/latest/languages.html | WebFetch | Per-standard notes; `--timing`; classes, assertions and covergroups partial; mostly 2-state |
| Icarus Verilog | https://steveicarus.github.io/iverilog/ (and the GitHub README) | WebFetch, `gh api` | IEEE 1364 aim; "slowly growing" SystemVerilog subset; GPL-2.0; v13_0 release |
| EDA Playground | https://www.edaplayground.com/ | WebFetch | Running needs sign-in; Google login gives non-commercial simulators; UVM menu: 1.1d, 1.2, IEEE 1800.2-2017; EPWave |
| cocotb | https://www.cocotb.org/, https://docs.cocotb.org/en/stable/simulator_support.html | WebFetch | BSD; FOSSi Foundation project; Icarus 11.0+, Verilator 5.036+, GHDL, NVC and commercial simulators |
| pyuvm | https://github.com/pyuvm/pyuvm | WebFetch | Apache-2.0; parts of 1800.2 on cocotb; RAL gaps; no custom phasing |
| riscv-dv | https://github.com/chipsalliance/riscv-dv | WebFetch | Apache-2.0; SV/UVM; needs UVM 1.2 simulator (VCS, Xcelium, Questa, Riviera-PRO); spike, riscv-ovpsim, whisper, sail-riscv |
| GTKWave | https://github.com/gtkwave/gtkwave | WebFetch | GPL-2.0; VCD/EVCD, FST, GHW |
| Surfer | https://surfer-project.org/ | WebFetch | EUPL-1.2 (MIT and Apache also); browser version at app.surfer-project.org |
| Verible | https://github.com/chipsalliance/verible | WebFetch | Apache-2.0; parser, linter, formatter, language server |
| sv-tests results | https://chipsalliance.github.io/sv-tests-results/ | WebFetch | Per-clause results for 18 tools |

Protocol facts in the AMBA cards (AHB two-cycle ERROR response; APB IDLE/SETUP/ACCESS and PSLVERR; AXI-Stream TKEEP/TSTRB/TID/TDEST; issue E of AXI covering AXI3, AXI4, AXI4-Lite and ACE) were checked in the local copies of IHI0033C, IHI0024C, IHI0051A and IHI0022E. Lesson issue letters were counted in `content/curriculum` (AXI mostly E; AHB B.b and C; APB C and E; AXI-Stream A; CHI E.b).

## Verilator

`verilator --version`: Verilator 5.052 2026-09-05. This item ships no SystemVerilog files, so there was nothing to compile.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/app/resources-page.test.tsx`: 9 passed.
- `npx tsc --noEmit -p .`: clean.
- `npx eslint "src/app/(learning)/resources" src/lib/resources.ts src/lib/resources-lessons.ts tests/app/resources-page.test.tsx`: clean.
- `tests/components/Navbar.test.tsx` and `tests/lib/site-features.test.ts` pass. `tests/app/feature-gating.spec.tsx`: "resources calls notFound when personalization is off" now fails, as expected, because the page is public (see the requests below). The "projects renders its draft" failure in the same file comes from another author's in-progress `/projects` work, not from this item.
- No MDX was touched, so `check-mdx` was not needed.

## Shared-file requests

1. `tests/app/feature-gating.spec.tsx`: remove the `resources` entry from `draftRoutes` (the page is no longer a draft).
2. `src/app/sitemap.ts`: add `"/resources"` to `PUBLIC_PAGES`, and drop `/resources` from the hidden-pages comment.
3. `src/lib/site-features.ts`: drop `/resources` from the `draftPages` doc comment.
4. Navigation (Navbar or footer, wherever Learning strategies and Interview Prep are linked): add a "Resources" link to `/resources`; update `tests/components/Navbar.test.tsx`, which lists `/resources` among the hidden routes.
5. Optional: lessons that tell learners to fetch IEEE 1800/1800.2 or an Arm specification could link `/resources`.
