# G29-B-SOC completeness review, round 1: `soc-system-design.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-18 (review-only restart pass). Read-only except for this file.

This file replaces the 2026-10-11 round-1 notes, which reviewed the bank before the author's fix round 1. Of those 10 findings, 9 are fixed in the current file. Finding 3 (E-RISCV-1 has no question) is still open; see finding 3 below.

Inputs read:
- `docs/curriculum-quality/README.md`;
- `analysis/G29.md`: the soc section, "Coverage gaps" and "Requests for the lead";
- `analysis/G29.verify.md`: the G29-SOC-01 adjustment, gaps 1 and 7, and the notes for the author;
- `curriculum-spine.md`: the cards for E-SOC-1, E-EMU-1, E-PSS-1, E-PWR-1, E-RISCV-1 and I-SV-8, plus citation style §5.7;
- `reviews/G29-B-SOC.author.md`, including fix round 1, and `G29-B-SOC.accuracy.r1.md`;
- the whole bank (21 questions) and `git diff HEAD` for it;
- the loader and renderer, `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`.

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 4 S3, 6 S4. Three of the S3s are for the lead or another group, not for this bank's author.

## Checks run

| Check | Result |
|---|---|
| JSON parses | OK. The file re-serialises byte-identically with `indent=2, ensure_ascii=False`. |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/app/interview-prep-page.test.tsx tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 5 files, **867 tests passed** |
| Every `modules` entry exists as `content/curriculum/*/<ref>.mdx` | All 63 refs (29 unique) resolve, checked with glob |
| Ids | All 7 original ids are kept and 14 are new. The 7 `INTERVIEW_QUESTION_LESSONS` entries in `src/lib/practice-links.ts` still match, but `modules` overrides them. |
| Levels | junior 3, mid 5, senior 4, staff 7, senior-staff 2. At least 3 are junior, and the levels run from junior to senior staff. |
| Categories | concept 4, trick 2, coding 1, waveform-debug 2, verification-plan 4, staff-system-design 8 |
| Coding and waveform items carry code or a cycle table | `soc-firmware-tb-sync` (coding) has the buggy code in `code` and the fix in the answer. `soc-lost-response-liveness` and `soc-interconnect-id-mismatch` (waveform-debug) carry cycle tables. I re-traced both: AW at edge 2, last W at edge 3, so `##[1:8]` covers edges 4–11 and fails at 11. AWID 0x3 becomes 0x13 at s0, and BID 0x13 becomes 0x3 at m1, consistent with port bit 4. |
| `follow_ups` and `common_mistakes` | Present on all 21: 2–5 follow-ups and 3–6 mistakes each. They are specific, and many come straight from spine misconceptions. |
| Rubrics separate strong from weak answers | All 21 have a "strong" and a "weak" paragraph, and each weak paragraph names a concrete misconception. Every rubric item appears in its model answer, except one (finding 6). |
| Known-wrong strings | 0 hits for IHI0022H, IHI0050F, "§2 (Architecture)", "§7 (RAL)", "§4 and §12", PrimePower, VCS-PA, vendor emulator names, an IEEE number for PSS, or `exclude_bin`. "Total store order" appears only in the out-of-scope sentence. |
| Practice and standard labelling | Methodology is labelled "Practice" in `sources` and "practice", "tool-dependent" or "example" in the text. Unverifiable documents are `verified: false`: IEEE 1801-2018 and 1801-2024, and SCE-MI. |
| Rendering hazards | No unpaired backticks. 186 `**bold**` spans, list runs separated by single newlines in 20 of 21 answers, and 4 markdown tables (finding 1). |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-SOC-01 (as adjusted by G29-V) | S2 | **Resolved.** <br>- Uses the five ACE states, with the MOESI mapping noted. <br>- Invariants: Unique plus *any* other valid copy, a lone SC legal, at most one Dirty copy (IHI0022E §C1.2.3; I checked the quote in `sources/arm_axi.txt`). <br>- Covers the Table C5-8 end states, the snoop-vs-WriteBack race (§C5.2.3), the overlapping CleanUnique (§C4.10.3), snoop-filter accuracy and exclusives. <br>- Barriers, DVM and ACE-Lite are separate checks; TSO/litmus tests are out of scope. <br>- The accuracy-r1 S2 (stale-memory false fail) is fixed: `dirty_in_flight`, and local stores feed the golden copy. |
| Headline 3 (citations), as it applies to this bank | S2 | **Resolved.** No IHI0022H, IHI0050F or wrong 1800.2 clause numbers remain. I spot-checked these AXI quotes in IHI0022E: §A3.4.4 (DECERR; all data transfers completed), §A3.4.1 (4KB note), §A5.3.2 (write data in address order), §A5.3.5 (appended ID bits) and §A8.1.1 (QoS use not specified). I also checked the 1800.2 quotes §10.1.1.2.2, §13.4.2.2 and §14.2.5.11 in `sources/uvm_lrm.txt`. |
| Navigation S2 (banks unreachable) | S2 | **Resolved by the lead.** `/interview-prep` loads this bank (`interview-banks.ts` `BANK_FILES`), and `modules` links every question to lessons. The page tests pass. |
| Accuracy r1 #1–#3 (S2) | S2 | **Resolved.** #1 is the coherency in-transit owner. #2 is §6.5 nets vs variables in `soc-agent-mode-reuse`. #3 is one BRESP per write burst in `soc-staff-dma-system-design`, with its follow-up and coverage rewritten. |
| SOC-02 to SOC-08 | S3/S4 | **All addressed.** <br>- SOC-02: UPF content and edition. <br>- SOC-03: SAM bullet and boundary rows. <br>- SOC-04: `bind`, `add_submap`, keep/adapt/disable. <br>- SOC-05: full corner list and roles. <br>- SOC-06: ordering, ID, exclusive, QoS and AxPROT rows; staffing labelled as an example. <br>- SOC-07: citations. <br>- SOC-08: 3 junior and 5 mid questions. |

## Coverage gaps assigned to `soc` (G29.md "Coverage gaps")

| Gap | Level asked | Question(s) | Filled? |
|---|---|---|---|
| Interrupt verification (sources, masking, priority, level/edge) | mid–senior | `soc-interrupt-basics` (junior), `soc-interrupt-verification-plan` (mid; senior depth on latency, liveness, connectivity) | Yes |
| Reset and boot sequencing; RDC | senior | `soc-reset-boot-sequencing` | Yes |
| CDC (structural, metastability, formal) | senior | `soc-cdc-rdc-verification` | Yes |
| Security: TrustZone, AxPROT, firewalls | staff | `soc-security-verification` | Yes (see finding 6) |
| Performance: latency, bandwidth, QoS | staff | `soc-performance-qos` | Yes |
| HW/SW co-verification and PSS | staff | `soc-pss-hw-sw-coverification`. PSS 3.0 (2024-08-28, no IEEE number) re-verified today by WebFetch of accellera.org. | Yes |
| Emulation and FPGA prototyping | staff | `soc-emulation-strategy` | Yes (see finding 9) |
| SOC-08 entry-level items | junior/mid | 3 junior, 5 mid | Yes |

The analysis listed B-AXI-3, B-AXI-4, B-AXI-6 and E-PSS-1 as modules with no question. All four now have one.

Spine misconceptions targeted:
- **E-SOC-1:** all 3 (auto-predict, scoreboards reused unchanged, closure as the union of block coverage).
- **E-PSS-1:** all 3.
- **I-SV-8:** all 3.
- **E-PWR-1:** 2 of 3 (finding 5).
- **E-EMU-1:** 2 of 3 (finding 9).

Across all six banks, the only spine modules with no question are E-RISCV-1, E-AI-1, F2E and I-UVM-3C (finding 3).

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | (all; lead, cross-bank) plus soc-senior-staff-interconnect, soc-address-map-decode, soc-cdc-rdc-verification, soc-emulation-strategy | The page renders bank text with `toRichBlocks`/`splitInlineCode`, which handle only ``` fences, blank-line paragraphs and backticks. Paragraphs render as `<p>` with collapsed whitespace. <br>- Bold: 186 `**bold**` spans show as literal asterisks. <br>- Lists: list runs separated by single newlines (20 of 21 answers) run together. <br>- Tables: the **4 markdown tables** become one run-on paragraph of `\|` characters. This is the worst case. The whole "what must be proven" core of `soc-senior-staff-interconnect` is a 12-row table, and the boundary-address answer of `soc-address-map-decode` is a table. <br>The other banks' reviews raised the bold and list part (G29-B-DBG and G29-B-AMBA completeness r1, finding 1), and RESTART.md lists it as a lead request. Tables were not raised. | Lead: in `toRichBlocks`/`InlineText`, render `**…**` as `<strong>`, line runs starting `- ` or `N. ` as lists, and GFM pipe tables as `<table>`. Add a test that renders one table from this bank. Bank-side stop-gap if the lead declines: put each of the 4 tables in a ```` ```text ```` fence, which already renders as preformatted text. | `src/app/(learning)/interview-prep/interview-banks.ts:265-297`; `page.tsx:56-80`; script count over the bank |
| 2 | S3 | soc-agent-mode-reuse | The prompt says "use the configuration below in your answer", but the answer key never ties its two bullets to the two paths in `code`. <br>- The answer's passive agent is the SPI block's **APB register-port** agent. The code sets `env.spi_env.spi_agent` passive, and a junior reads that name as the SPI-pin agent, which the answer says must stay active. <br>- The next sentence, "the same VIP class can be passive on one instance and active on another … `*.spi_agent` is risky", implies that `spi_agent` and `flash_agent` are one class. Yet `*.spi_agent` would not match `flash_agent`. <br>This is a junior item, and the mapping is the point of the question. | Rename the first path to `env.spi_env.apb_agent` (UVM_PASSIVE: the CPU drives the register port). Keep `env.flash_env.flash_agent` (UVM_ACTIVE: an SPI-VIP instance answering as the flash). Name each path in its bullet. Reword the wildcard sentence: "mode is set per instance path, so one VIP class can be passive in one place and active in another; a broad wildcard such as `*agent*` would set every match alike". | Bank text; I-UVM-2A objectives 2, 4, 5 (`index.mdx:24-27`) |
| 3 | S3 | (bank; lead) | E-RISCV-1 still has no question in any of the six banks, and neither does E-AI-1. This was open finding 3 of the 2026-10-11 notes. G29-V gap 1 proposes the topic "lock-step comparison against a reference ISS" but names no bank. E-RISCV-1 is nav #67, immediately before E-SOC-1, and a CPU core is part of every SoC: this bank already assumes "RTL core, instruction-set simulator" in three answers. | Lead decision, not blocking for this author. Assign one mid or senior E-RISCV-1 question here, for example: "Your ISS step-and-compare fails right after an external interrupt. Why, and how do you make the trace compare robust (length checks, synchronising asynchronous events)?" That question covers spine misconceptions 1 and 3. Alternatively, assign it to another bank. | `G29.verify.md` gap 1; spine E-RISCV-1 card; script over all six banks' `modules` |
| 4 | S3 | soc-coherency-verification (cross-group: B-AMBA-F2) | The question's first "Learn it in" link, B-AMBA-F2, still teaches the uncorrected memory invariant. Its text says "when no cache is Dirty, memory equals the golden value" (`index.mdx:437`). Its checker raises `"no cache is Dirty but memory is stale"` with no in-transit term (`:532-533`). That checker false-fails the legal ReadShared PassDirty=1, IsShared=1 transient, which the bank now handles with `dirty_in_flight` (accuracy r1 #1). A learner who follows the link meets the opposite rule. The author already logged this as a lead request. | Lead: send it to the B-AMBA-F2 author. Treat dirty responsibility in transit (a PassDirty R not yet complete, or the interconnect's write-back after ReadClean) as an owner, or check memory only when the line is quiescent. No bank change. | B-AMBA-F2 `index.mdx:437`, `:515-533`; IHI0022E §C5.3.2, §C3.2.1 |
| 5 | S4 | soc-power-verification | The answer now names the right ways to stop stimulus, but no mistake or sentence targets the first E-PWR-1 spine misconception: "callbacks can abort a running sequence". The spine's must-cover says "callbacks do not abort sequences", and E-PWR-1 objective 5 teaches it. The `stop_sequences()` source is also cited only via §14.2.5.12 `do_kill`. | Add a common mistake: "Expecting a callback to abort a running sequence; use a quiesce flag, `kill()` or `stop_sequences()`." Add the source "§15.3.2.14 stop_sequences", which kills all sequences on the sequencer and removes queued requests, locks and responses. | Spine E-PWR-1 card; E-PWR-1 `index.mdx:28`; `uvm_lrm.txt` §14.2.5.11, §14.2.5.12, §15.3.2.14 |
| 6 | S4 | soc-security-verification | The rubric expects "interrupts" among the things a strong plan covers, but the model answer never mentions interrupts. | Add a negative-test bullet labelled practice: "secure peripherals' interrupts are routed only to the secure world, and non-secure software cannot mask, clear or observe them (per the interrupt controller's security configuration)". Alternatively, drop "interrupts" from the rubric. | Bank text |
| 7 | S4 | soc-block-to-system | The answer builds the SoC register model with `add_submap` (§18.2.3.5), but `modules` lists none of the lessons that teach it. A-UVM-4B teaches root maps and submaps (`index.mdx:323`, `:1282`). | Add `A-UVM-4B_Advanced_RAL_Techniques/index`. | Lesson grep |
| 8 | S4 | soc-address-map-decode | The answer's AHB points (default subordinate, 1KB region) and its "a 4-beat read of a hole returns 4 DECERR beats; a write must still accept all its data" point are taught in B-AHB-1 and B-AXI-5. Neither is linked. | Add `B-AHB-1_AHB_Design_Timing_Mechanics/index` (default slave at `:59-66`, "The 1KB rule" at `:289`) and `B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks/index` (a default slave that does not drain W, `:236`, `:290`). | Lesson grep |
| 9 | S4 | soc-emulation-strategy | E-EMU-1 spine misconception 3, "vendor architectures are interchangeable", is not targeted: the answer covers only vendor *figures*. The answer also describes the HDL/HVL split in prose only, although the split is E-EMU-1's hands-on. | Add a sentence and a mistake, labelled practice and naming no vendor: "emulators are built on different architectures (custom-processor and FPGA-based), which changes compile time, capacity and debug visibility; do not assume one platform's flow or limits transfer". Optionally add a 10-line `// snippet`: an interface task `drive_txn()` (HDL side) called once per item by a class proxy (HVL side). | Spine E-EMU-1 card ("vendor platform architectures verified", misconception 3) |
| 10 | S4 | (lead) soc-staff-dma-system-design, soc-coherency-verification and others | G29-V gap 7 asks for pictures. For this bank they are an `<ArchitectureDiagram>` of the DMA environment with correct roles, and links to model-backed visualizers (`RALPredictorVisualizer`, `PowerDomainVisualizer`, `VIPReuseVisualizer`). The schema has no `visual` field, so the author could not add them. | Lead: carry the `visual?: {component, props}` schema request (still open in RESTART.md) and the DMA diagram. | `G29.verify.md` gap 7; author log "Deferred" |

## Notes

- Lens overlap with accuracy: I found no new accuracy error. The spot checks match their sources: the IHI0022E quotes above, the UVM §10.1.1.2.2, §13.4.2.2 and §14.2.5.11 texts, and PSS 3.0 on accellera.org.
- Cross-bank consistency: `amba-coherency-scoreboard-design` checks read data against "golden (or memory when no cache is dirty)". That is a read-data rule, not the stale-memory invariant, so it does not contradict this bank. Overlaps with `uvm-staff-env-architecture` (DMA env) and `uvm-senior-staff-methodology` (sim and emulation) take different angles and need no change.
- For the author: fix findings 2 and 5–9 if there is a round 2 (all small). Findings 1, 3, 4 and 10 belong to the lead or another group.
