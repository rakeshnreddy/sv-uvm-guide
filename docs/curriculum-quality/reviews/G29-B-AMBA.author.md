# G29-B-AMBA author log: `amba-protocols.json`

Author: G29-B-AMBA. Date: 2026-10-11. Verdict carried in: **major** (analysis G29, verifier G29-V: 2 S1, 5 S2, 5 S3, 2 S4).
Scope: `content/interview-questions/amba-protocols.json` only. No lesson, `src/` or test file was edited.

**Result.** 13 → 28 questions. Levels: junior 5, mid 9, senior 8, staff 5, senior-staff 1. Categories: concept 9, coding 6, trick 5, waveform-debug 4, verification-plan 2, staff-system-design 2. Every question has `modules`, `follow_ups` (3 each), `common_mistakes`, and structured `sources` (`{doc, section, verified: true}`). All 6 coding items contain code; all 4 waveform-debug items carry a text cycle table or bus trace in `code`. No ids were removed or renamed. Bank `id`, `topic` and `title` are unchanged; the `description` now names APB, AXI4-Lite and AXI4-Stream.

## Sources used (all read locally, sections checked in the text)

| Spec | Issue | Local text | Notes |
|---|---|---|---|
| AMBA AXI and ACE | IHI0022E | `scratchpad/axi1.txt` (page-marked extraction) | Citation standard from G29 Request 5. IHI0022H section numbers are not used anywhere. |
| AMBA AHB | **IHI0033C** | `scratchpad/audit/ahb5.txt` (header reads "ARM IHI 0033C") | Cited by Issue C section numbers. Where C differs from B.b (Chapter 3 from §3.5 on), the source string also gives the B.b number, because the B-AHB lessons cite B.b. Map checked against the table in B-AHB-1. |
| AMBA APB | IHI0024E | `scratchpad/n06/apbE.txt` | Analysis had APB as unverified; now verified (§1.1, §2.1, §3.1–§3.5, §4.1). |
| AMBA 5 CHI | IHI0050E.b | `scratchpad/L40V/e1.txt` (header "ARM IHI 0050E.b") | IHI0050F numbers are not used. |
| AMBA 4 AXI4-Stream | IHI0051A | `scratchpad/l32v/axis.txt` | §2.2.1, §2.4, §2.4.3, §2.5, §2.6. |

The brief suggested WebFetch for AXI/APB/CHI; local extractions of the exact issues were available and are the program's citation standard, so no web fetch was needed. Section numbers were checked by heading search in each text; no section number in the bank is unverified.

## Findings and how each was resolved

| ID | Sev (after verify) | Question | Resolution |
|---|---|---|---|
| G29-AMBA-01 | S1 | amba-coherency-scoreboard-design | Fixed. Invariants now follow C1.2.3 exactly: a Unique line is in one cache only; a line in several caches is Shared in all; at most one Dirty. The SV `check_line` counts valid, unique and dirty copies, so UD + SC fails. Rubric names the UD + SC case. |
| G29-AMBA-02 | S1 (raised from S2 by verifier) | amba-ace-state-transition-debug | Rewritten. Prompt keeps "both cores share the line" (now explicit: both SC). Bus trace in `code` shows CleanUnique with no AC to Core 1 and no AR from Core 1. Model answer: writer SC→UC (Table C4-13) then UD on store, or MakeUnique; interconnect must snoop every holder (C6.3) with an invalidating snoop (Table C5-1, recommended mapping; C5.1 allows any mapping forcing the same change, per verifier refinement); **reader must end in I**; debug order; C6.2 RACK/CRRESP sequencing; root cause (snoop filter / domain / target mask). Rubric explicitly marks "SC or I for the reader" as wrong. IHI0022H Part D citations replaced with IHI0022E Part C. |
| G29-AMBA-03 | S2 (fix adjusted by verifier) | amba-axi-deadlock-channels | Rewritten around the rules: 2x2 W-ordering deadlock with a cycle table (A5.4.1 master W order, A5.3.2 interconnect forwards W in slave address order); single-interface case (A3.3.1 Caution); same-ID multi-slave reads (A5.3.1). Per verifier: "responses must always be accepted" is taught as a design rule, not an AXI rule (A3.3.1 lets a master wait for BVALID before BREADY); the "priority" remedy is replaced by concrete interconnect fixes labelled implementation choices. "IHI0022H §A10" removed. |
| G29-AMBA-04 | S2 | amba-staff-interconnect-design | Added the ordering duties (A5.3.1 same-ID reads across slaves, A5.3 same-AWID writes, A5.3.2/A5.4.1 W ordering) with the stall-vs-reorder-buffer and AW-admission-vs-store-and-forward choices labelled as implementation choices; vague "response priority" remedy removed; verification plan extended (crossing-traffic stress, ordering checks, formal on a reduced configuration with fairness assumptions). |
| G29-AMBA-05 | S2 | amba-bridge-4kb-split | Rewritten. Lengths known only for SINGLE, INCR4/8/16, WRAP4/8/16; undefined INCR handled by per-beat transfers, buffered chunked writes, or safe speculative reads (labelled implementation choices); no `remaining`-driven loop for undefined INCR. Early AHB termination (ERROR, multi-layer, IHI0033C §3.6.2) vs no early AXI termination (A3.4.1): complete with WSTRB = 0, drain reads. WRAP16 downsizing corrected: one INCR when the start is at the wrap boundary, two otherwise. |
| G29-AMBA-06 | S2 | amba-chi-retry-verification | Rewritten against IHI0050E.b §2.11: TxnID may change (reusable after RetryAck); full list of fields allowed to differ; PCrdGrant before RetryAck (§2.11.3); PCrdReturn (§2.11.1, §3.3.1); resend TgtID from RetryAck SrcID or original TgtID (§3.3.1); starvation prevention; 1024-outstanding limit; credit not bound to a transaction. IHI0050F citations replaced. |
| G29-AMBA-07 | S3 (text adjusted by verifier) | amba-chi-credit-deadlock | Rewritten. L-Credits (§14.2, §14.2.1: 1–15 per receiver) vs P-Credits (§2.11). Loop now hinges on the Home refusing snoop responses; the RN-F's wait on outbound RSP before inbound SNP is stated as permitted (§13.4.1), per verifier correction. Real rules quoted in paraphrase (§13.4.1 RN and SN rules, §4.11.1). Conservation identity replaced by per-link credit assertions; CTL "exists a sequence" property replaced by linear-time liveness under fairness assumptions (`s_eventually`) and bounded response labelled policy. Wrong "§2.3 (link layer credits)" removed. |
| G29-AMBA-08 | S3 | amba-axi-valid-ready-rule | Added VALID must stay asserted until handshake, READY may be asserted first and withdrawn before VALID (A3.2.1); SVA hold and stability properties; no "READY must stay high" check. Cited A3.2.1 and A3.3.1 of IHI0022E. |
| G29-AMBA-09 | S3 | amba-family-choose-bus | Bridge now converts every AXI beat to an APB transfer unless the port is AXI4-Lite (B1.1); PSLVERR→RRESP/BRESP (IHI0024E §3.4.3; SLVERR labelled a convention); PSTRB optional/APB4+ (§3.2.1 Table 3-1); 32-bit PWDATA (§2.1). Unverified citations removed; APB now verified. |
| G29-AMBA-10 | S4 | amba-ace-snoop-flow | "exactly one cache may hold a line Dirty" → "at most one". Added Table C5-8 end states for a snooped UD, C6.3 snoop-until rule, sources C5.1 Table C5-1, C5.2.3, C5.3.2 Table C5-8; WriteBack race as a follow-up. |
| G29-AMBA-11 | S3 | amba-chi-node-roles | Level staff → senior (analysis suggestion). HN-F "might include" a directory/snoop filter; added RN-D, MN (DVM), PoC/PoS, HN-I behaviour on snoopable requests, SN-I for Normal memory, data sources and DMT/DCT/DWT (§1.7). Citation fixed to §1.6, §1.7. |
| G29-AMBA-12 | S3 | amba-coherency-scoreboard-design | SV associative array `line_t lines[line_addr_t]`; real SV code; ACE state names throughout (MOESI only mentioned as a mapping); IHI0022E Part C citations. Added silent transitions (state as an upper bound) and race ordering (C6.2). |
| G29-AMBA-13 | S4 | amba-ahb-hready-hreadyout | Level senior → mid. Added §4.2 and the §2.4 Note (retimed select) to sources; added slave-side and multiplexor-select consequences. |
| G29-AMBA-14 | S2 | (bank) | 15 questions added, 5 of them junior (see question map). Coverage gaps addressed below. |
| Verify note: AXI responses | — | several | "Masters always accept responses" is labelled a design rule wherever it appears (deadlock, interconnect, checker plan). |
| Verify note: ACE Table C5-1 | — | ACE items | Snoop mappings described as recommended; checks target the required state change. |
| Verify note: CHI §13.4.1 / §4.11.1 | — | credit deadlock | Applied as stated by the verifier. |
| Verify note: citations | — | all | No IHI0022H or IHI0050F section numbers remain; the one correct "IHI0022E A6" citation is kept in the interconnect item. |
| Verify gap 7: visuals | — | bank | Deferred (schema has no visual field); see lead requests. |
| Verify gap 5: AHB5 HNONSEC/HEXCL | — | — | Exclusive AHB5 transfers appear as a follow-up in `amba-axi-exclusive-access`; B-AHB-1 now mentions both properties, so no lesson request needed. |
| Headline 3 (citations) | — | all | Resolved for this bank: every source is a verified `{doc, section}` object. |
| Headline 5 (no code, no follow-ups) | — | all | Resolved: 18 of 28 items carry code or a cycle table (16 fenced code blocks in answers, plus 4 tables or traces in `code`); every item has follow-ups and common mistakes. |

## Coverage gaps from G29 assigned to this bank

| Gap row | Question(s) |
|---|---|
| APB transfer (setup/access, PREADY, PSLVERR, PSTRB/PPROT), junior | `amba-apb-transfer-basics` (junior), `amba-apb-error-strobe` (mid) |
| AHB basics (pipeline, HTRANS with BUSY, HBURST, HSIZE, waits), junior | `amba-ahb-pipeline-basics`, `amba-ahb-htrans-burst` (junior) |
| AHB two-cycle ERROR, mid | `amba-ahb-error-two-cycle` (mid, coding) |
| AXI burst types and address math | `amba-axi-burst-math` (mid, coding) |
| Narrow/unaligned transfers, WSTRB | `amba-axi-burst-math` |
| Responses OKAY/EXOKAY/SLVERR/DECERR, junior–mid | `amba-axi-responses` (junior) |
| AXI ordering (same ID, read/write independence) | `amba-axi-id-ordering` (mid), `amba-axi-read-scoreboard-per-id` (senior) |
| AXI3 vs AXI4, AXI4-Lite | `amba-axi4-lite-stream` (mid); AXI3 WID/write interleaving in `amba-axi-id-ordering` and the deadlock follow-ups |
| Exclusive access, senior | `amba-axi-exclusive-access` |
| AxCACHE/AxPROT (and QoS), senior | `amba-axi-cache-prot-qos` |
| AXI-Stream | `amba-axi4-lite-stream` |
| AXI protocol checker and coverage model, senior | `amba-axi-checker-coverage-plan` |
| CHI flows: DMT/DCT/DWT | `amba-chi-node-roles` (concept level); full flow question deferred |
| ACE-Lite/IO coherency, DVM, barriers, staff | Deferred (see below) |
| Uncovered modules B-AHB-2, B-AHB-3, B-AMBA-2, B-AXI-3, B-AXI-4 | B-AHB-2: `amba-ahb-error-two-cycle`; B-AHB-3: `amba-ahb-monitor-pipeline`, `amba-ahb-hready-hreadyout`; B-AMBA-2: `amba-axi-five-channels`, `amba-axi-valid-ready-rule`; B-AXI-3: `amba-axi-id-ordering` and three more; B-AXI-4: `amba-axi-exclusive-access`, `amba-axi-cache-prot-qos`. B-APB-1 (new module) is also covered. Every B-* module now has at least one question. |

## Question map

All sources below were verified in the local spec text (every `sources` entry has `verified: true`).

| id | level | category | modules | sources (verified) |
|---|---|---|---|---|
| amba-family-choose-bus | mid | concept | B-AMBA-1, B-APB-1, B-AMBA-F1 | IHI0024E §1.1, §2.1, §3.2.1, §3.4, §3.4.3; IHI0022E A3.4.3, B1.1 |
| amba-axi-five-channels (new) | junior | concept | B-AMBA-2, B-AXI-1 | IHI0022E A3.2.1, A3.3.1, A5.3.4 |
| amba-apb-transfer-basics (new) | junior | waveform-debug | B-APB-1 | IHI0024E §1.1, §3.1.1, §3.1.2, §3.4, §4.1 |
| amba-apb-error-strobe (new) | mid | trick | B-APB-1 | IHI0024E §3.2, §3.2.1, §3.4, §3.4.3, §3.5 |
| amba-ahb-pipeline-basics (new) | junior | waveform-debug | B-AHB-1 | IHI0033C §3.1, §3.7, §4.2, §6.1.1, §2.5 |
| amba-ahb-htrans-burst (new) | junior | concept | B-AHB-1 | IHI0033C §3.2, §3.6, §3.6.1 |
| amba-ahb-hready-hreadyout | mid (was senior) | trick | B-AHB-1, B-AHB-3 | IHI0033C §2.3, §2.4 Note, §2.5, §4.2, §4.3 |
| amba-ahb-error-two-cycle (new) | mid | coding | B-AHB-2, B-AHB-1, I-SV-4A | IHI0033C §5.1, §5.1.3, §3.6.2 |
| amba-ahb-monitor-pipeline (new) | senior | coding | B-AHB-3, B-AHB-1 | IHI0033C §3.1, §3.2, §3.6.1, §3.6.2, §3.7, §4.2, §5.1.3, §6.1.1 |
| amba-axi-valid-ready-rule | mid | concept | B-AXI-1, B-AMBA-2, B-AXI-5 | IHI0022E A3.2.1, A3.3.1 |
| amba-axi-responses (new) | junior | concept | B-AXI-1, B-AXI-6 | IHI0022E A3.4.4, B1.1 |
| amba-axi-burst-math (new) | mid | coding | B-AXI-2 | IHI0022E A3.4.1, A3.4.3 |
| amba-axi-4kb-boundary | mid | concept | B-AXI-2, B-AXI-5 | IHI0022E A3.4.1, A4.3.1 |
| amba-axi-id-ordering (new) | mid | trick | B-AXI-3 | IHI0022E A5.3, A5.3.1, A5.3.4, A5.4, A4.3.2 |
| amba-axi4-lite-stream (new) | mid | trick | B-AMBA-1 | IHI0022E B1.1; IHI0051A §2.2.1, §2.4, §2.4.3, §2.5, §2.6 |
| amba-axi-exclusive-access (new) | senior | concept | B-AXI-4 | IHI0022E A7.2–A7.2.4, A7.3, A3.4.4, B1.1, A4.3.1 |
| amba-axi-cache-prot-qos (new) | senior | trick | B-AXI-4 | IHI0022E A4.3.1, A4.4, A4.4.1, A4.7, A8.1.1, A8.1.2, A10.3.7 |
| amba-axi-deadlock-channels | senior | waveform-debug | B-AXI-5, B-AXI-3, B-AMBA-F3 | IHI0022E A3.3.1, A5.3.1, A5.3.2, A5.4.1 |
| amba-axi-checker-coverage-plan (new) | senior | verification-plan | B-AXI-6, B-AXI-5, B-AXI-2 | IHI0022E A3.2.1, A3.3.1, A3.4.1, A3.4.3, A3.4.4, A5.3.1, A5.4.1, A7.2.4 |
| amba-axi-read-scoreboard-per-id (new) | senior | coding | B-AXI-6, B-AXI-3, A-UVM-6 | IHI0022E A5.3.1, A5.3.4, A5.3.5, A3.4.1, A3.4.4 |
| amba-bridge-4kb-split | senior | coding | B-AMBA-F1, B-AHB-1, B-AXI-2 | IHI0033C §3.6, §3.6.1, §3.6.2, §4.2; IHI0022E A3.4.1 |
| amba-staff-interconnect-design | staff | staff-system-design | B-AXI-3, B-AXI-5, B-AXI-6, B-AMBA-F3 | IHI0022E A3.4.1, A3.4.4, A5.3, A5.3.1, A5.3.2, A5.3.5, A5.3.6, A5.4.1, A6, A8.1.1 |
| amba-chi-node-roles | senior (was staff) | concept | B-AMBA-F2 | IHI0050E.b §1.6, §1.7 |
| amba-ace-snoop-flow | staff | concept | B-AMBA-F2 | IHI0022E C1.2.3, C3.2.1, C3.7 Table C3-22, C4.2, C5.1, C5.2.3, C5.3.2, C6.3 |
| amba-ace-state-transition-debug | staff | waveform-debug | B-AMBA-F2, B-AMBA-F3 | IHI0022E C1.2.3, C4.2, C4.6.1, C4.7.1, C5.1, C6.2, C6.3, Ch. C10 |
| amba-coherency-scoreboard-design | staff | coding | B-AMBA-F2, A-UVM-6 | IHI0022E C1.1, C1.2.3, C3.2.1, C4.6.1, C4.10, C5.2.3, C5.3.2, C6.2 |
| amba-chi-retry-verification | staff | verification-plan | B-AMBA-F2 | IHI0050E.b §2.11, §2.11.1, §2.11.2, §2.11.3, §3.3.1 |
| amba-chi-credit-deadlock | senior-staff | staff-system-design | B-AMBA-F2 | IHI0050E.b §2.11, §2.11.2, §4.11.1, §13.4.1, §14.2, §14.2.1 |

## Ids removed or renamed

None. All 13 original ids survive, so every `INTERVIEW_QUESTION_LESSONS` entry in `src/lib/practice-links.ts` still resolves. Every question (old and new) now carries `modules`, which take precedence over the map.

## Deferred items

| Item | Reason |
|---|---|
| ACE-Lite / I/O coherency, DVM, barriers (staff) | Bank already at 28 items; a correct answer needs IHI0022E C8, C11 and C12 checked in depth. Good next addition for B-AMBA-F2. |
| Full CHI transaction-flow question (DMT/DCT/DWT flows, CompAck, ordering §2.8) | Covered only at concept level in `amba-chi-node-roles`; a flow-level item needs Chapter 5 of IHI0050E.b traced. |
| Visual links (`AxiMemoryMathVisualizer`, `AhbPipelineBurstVisualizer`, `BridgeTranslationExplorer`, sequence diagrams) | The bank schema has no visual field (G29 Request 2, verifier gap 7). |
| Compile check of the SV code | No simulator is installed locally (verilator, iverilog, slang, xrun, vcs all absent). Code was hand-checked against IEEE 1800-2023 syntax; partial code is marked `// snippet`. |
| AXI5/ACE5 features (atomics, etc.) | Out of scope of IHI0022E, the citation standard. |

## Requests for the lead

1. **AHB citation standard.** The brief and this bank use IHI0033C (the local text), while the B-AHB lessons cite IHI0033B.b numbers. The bank's AHB sources give both where they differ (§3.6 = B.b §3.5, §3.7 = B.b §3.6). Please settle one standard for the AHB track; the mapping table in B-AHB-1 matches what I found in Issue C.
2. **B-AMBA-F2 lesson disagrees with IHI0050E.b §1.6.** Its node table (about line 129) says HN-F "maintains directory/snoop filter"; the spec says an HN-F *might* include one. Its CHI walk-through (about lines 162 and 167) uses "Modified" and "Shared Clean" rather than CHI state names. Pass to the B-AMBA-F2 author.
3. **B-AMBA-F1 lesson and undefined-length INCR (G29-AMBA-05).** Its text (about line 117) speaks of an INCR "that would translate to more than 256 AXI transfers", which presumes the bridge knows the length; it does not cover that an undefined INCR's length is unknown when AWLEN must be driven, nor early AHB termination versus no early AXI termination. Pass to the B-AMBA-F1 author.
4. **Schema: a `debug` category.** `amba-ace-state-transition-debug` is a bus-trace triage item filed as `waveform-debug`; the loader already labels `debug`, but `tests/interview-questions/bank-schema.test.ts` rejects it. Consider adding `debug` (G29 Request 2).
5. **Optional map cleanup.** `INTERVIEW_QUESTION_LESSONS` entries for the 13 AMBA ids are now overridden by `modules`; they can be removed or left as fallbacks.
6. **Pictures (verifier gap 7).** Requested static diagrams for this bank: a `<SequenceDiagram>` of the ACE invalidation path (CleanUnique → CleanInvalid → reader to I), a diagram of the 2x2 W-ordering deadlock, and a `<SequenceDiagram>` of CHI retry with PCrdGrant before RetryAck. Do not link `AxiDeadlockSimulator` to the W-ordering case (verifier: it models single-interface handshakes only).
7. **Compile-check pipeline.** The bank now has 16 fenced code blocks in model answers; a lead-side compile check of non-snippet blocks (G29 Request 2) would catch syntax drift.

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/amba-protocols.json'))"`: passes.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 618 tests, all passed.
- Extra checks run: every `modules` entry resolves to an existing `.mdx`; every fenced block renders as code; levels and categories are in the schema's lists; no `IHI0022H`, `IHI0050F` or `IHI0024C` citation remains.

## Fix round 1 (2026-10-18)

Input: `G29-B-AMBA.accuracy.r1.md` (0 S1, 3 S2, 3 S3, 5 S4). All 11 findings are fixed. `G29-B-AMBA.completeness.r1.md` passed (0 S1, 0 S2) and was not part of this round's brief. I also applied its cheap items on questions I was already editing; they are listed separately below. Scope stayed the same: only `content/interview-questions/amba-protocols.json` and this log. No lesson, `src/` or test file was edited.

**Result.** 28 questions, unchanged in number, ids, levels (junior 5, mid 9, senior 8, staff 5, senior-staff 1) and categories. 16 questions changed. Bank `id`, `topic` and `title` are unchanged.

**Sources re-read for this round.** All are local copies of the cited issues; no web fetch was needed.
- IHI0022E (`sources/arm_axi.txt`): C1.2.3 and Table C1-2; C4.2; C4.3 and C4.3.3; C4.9.1 and Table C4-29; C5.1, Table C5-1 and its Note; C5.1.3 and Table C5-2; Table C5-3; C5.3.2 and Table C5-8; C5.3.5 and Table C5-11; C6.3 and Table C6-1; A3.2.1; A3.4.1 (byte-lane equations, no early termination, and the read-sensitive Note); Table A3-4; B1.1.3.
- IHI0050E.b (`scratchpad/g29amba_r1/data/chi.txt`): §2.11; §2.11.1; §2.11.2; §2.11.3; §3.3.1.
- IHI0033C (`sources/ahb5.txt`): §3.5, §3.5.2 and Table 3-3.

### Accuracy findings

| # | Sev | Question | Resolution |
|---|---|---|---|
| 1 | S2 | amba-ace-snoop-flow | Rubric and step 2 now say that ReadShared is the **recommended** snoop (Table C5-1). ReadClean, ReadNotSharedDirty, ReadUnique and CleanInvalid are also permitted, because the required end state is Shared or Invalid (C5.1.3 Table C5-2, C6.3 Table C6-1). An invalidating snoop is legal and leaves B in I. Step 3 now ties the Table C5-8 end states to a ReadShared, ReadClean or ReadNotSharedDirty snoop. `common_mistakes[1]` is now "checking the snoop opcode instead of the required end state, or accepting a snoop that leaves B Unique". Added the Weak line (completeness #8), reworded so that it no longer penalises an invalidating snoop. Sources now include the C5.1 Note, C5.1.3 Table C5-2 and C6.3 Table C6-1. |
| 2 | S2 | amba-axi4-lite-stream | Item (2) now follows B1.1.3. Masters and interconnect must drive correct strobes. A Lite slave may use them, ignore them (treating every write as full width) or return an error. A slave that provides memory access must support them fully. A write with every strobe low can arrive after conversion from full AXI, and suppressing it is permitted but not required. Rubric updated to match. New common mistake: "requiring every Lite slave to honour WSTRB". Source §B1.1.3 added. |
| 3 | S2 | amba-chi-retry-verification | The checker now defers the unmatched-grant check. Its ledger tracks retries waiting and spare credits. Spare credits are legal while a request to that Completer with AllowRetry = 1 still awaits its response, because a PCrdGrant may overtake its RetryAck and must be stored (§2.11, §2.11.3). Excess credits are flagged only when no such request is pending and the Requester fails to use or return them within a policy bound ("in a timely manner", §2.11.1), and every unused, unreturned credit is flagged at end of test. Resends are still checked against both the RetryAck and a grant (§2.11.3). Rubric, Weak line and common mistakes updated. |
| 4 | S3 | amba-chi-retry-verification | Rule 1, the rubric and coverage now exclude PrefetchTgt. It has no response, is never retried, and is always sent with AllowRetry deasserted (§2.11, §2.11.2). Coverage now includes PrefetchTgt mixed with retried traffic. No PCrdType value is claimed for PrefetchTgt, because the text does not state one. |
| 5 | S3 | amba-coherency-scoreboard-design | "What the bus cannot show" rewritten. A cache may silently move UC to UD on a store (Table C1-2), and Unique to the matching Shared state, though that is not expected (C4.3). A **clean** line may be dropped silently only by a master without an external snoop filter (C4.2, C4.3); a master with one signals evictions with Evict (C4.9.1). Dirtiness ends only through a write-back (WriteBack or WriteClean, C4.3.3), a snoop response with PassDirty, or a MakeInvalid snoop, after which the dirty data may be discarded (C5.3.5 Table C5-11). I found the MakeInvalid case while checking the fix: the reviewer's suggested wording, "only through a write-back or PassDirty", would have been wrong for a UD line snooped by MakeInvalid. Rubric, common mistakes and sources (C4.2, C4.3, C4.3.3, C4.9.1, C5.3.5) updated. |
| 6 | S3 | amba-ace-snoop-flow | `common_mistakes[0]` now reads: "'exactly one Dirty copy' fails as a checker invariant, because a line that matches memory has none, and no cache holds it while dirtiness passed to the interconnect is being written back. The rule is that an updated line is Dirty in one cache only, so check at most one (C1.2.3)." Step 6 says the same. |
| 7 | S4 | amba-axi-read-scoreboard-per-id | `on_r` now compares when `!resp[1]`, that is on OKAY and EXOKAY. The prose now says that SLVERR and DECERR beats are skipped and EXOKAY beats are compared (Table A3-4). |
| 8 | S4 | amba-bridge-4kb-split | Added the A3.4.1 Note. Discarded R beats are still real reads, so for Device or other read-sensitive targets the bridge forwards reads as single AXI transfers. Added a common mistake, and the Note to the sources. |
| 9 | S4 | amba-apb-transfer-basics | The monitor snippet is now a `forever @(vif.mon_cb)` loop that samples through `vif.mon_cb.*`. It creates the item with `apb_item::type_id::create("item")` for each transfer, with a comment on why subscribers need a new handle each time. This is also completeness #2. |
| 10 | S4 | amba-axi-valid-ready-rule, amba-apb-error-strobe, amba-ahb-error-two-cycle, amba-axi-checker-coverage-plan, amba-chi-credit-deadlock | Each block now starts with a `// snippet:` header that says where the signals come from. In the credit-deadlock harness, `rsp_lcrdv` is now defined as the credit the RN-F model returns on the Home's **outbound** RSP channel, with a warning not to assume anything about the LCRDV the Home drives on its inbound channels. I also replaced the unconditional `s_eventually rsp_lcrdv`. Its trouble is the credit cap: with at most 15 credits, it can hold only while the Home keeps sending RSP flits, so it would exclude the traces where the Home stops sending, which are exactly the deadlocks the proof must find. The new assumption, `(rsp_held < RSP_LCRD_MAX) \|-> s_eventually rsp_lcrdv`, encodes the §13.4.1 RN rule. Also added `asm_sym_stable` for `SYM_TXNID`. The configuration now reads "one HN-F with two RN-F models and one SN-F model". |
| 11 | S4 | amba-ace-state-transition-debug | The answer now cites C6.3 Table C6-1 for the required change (Invalid for CleanUnique and MakeUnique), alongside Table C5-1. The rubric and `common_mistakes[2]` say the same, and Table C6-1 is in the sources. |

### Completeness r1 items also applied (cheap, on questions already in this round)

| Completeness # | Sev | Question | Change |
|---|---|---|---|
| 2 | S3 | amba-apb-transfer-basics | Same fix as accuracy #9. |
| 3 | S3 | amba-axi-burst-math | Added case (c), a narrow, unaligned INCR: AxSIZE = 1, AxLEN = 1, AxADDR = 0x1 on a 32-bit bus. Aligned_Address is 0x0. Beat 1 uses lane 1 only; beat 2 is at 0x2 and uses lanes 2-3. To write just 0x1 and 0x2 the strobes are 4'b0010, then 4'b0100. The answer explains why one AxSIZE = 1 beat with 4'b0110 is wrong, and why an AxSIZE = 2 beat makes it legal. I checked these against the A3.4.1 byte-lane equations. Updated the prompt, rubric (Must and Weak), the function's example comment (`axi_beat_addr(64'h1, 1, 1, INCR, 2) == 64'h2`) and common mistakes. |
| 6 | S3 | amba-bridge-4kb-split | Added a "Write strobes" paragraph and code. With Write_Strobes = True (IHI0033C §3.5), WSTRB is HWSTRB masked to the active lanes, because HWSTRB bits for inactive lanes can be high (§3.5.2). A beat with every strobe low is still sent with WSTRB = 0. The code buffers `sbuf` alongside `wbuf`. Sources now include §3.5 and §3.5.2, labelled "new in Issue C". |
| 8 | S4 | amba-axi-4kb-boundary, amba-staff-interconnect-design (and amba-ace-snoop-flow, see #1) | Added Weak lines. |
| 9 | S4 | amba-coherency-scoreboard-design | Covered by accuracy #5. |
| 10 | S4 | amba-axi-valid-ready-rule | Added a comment to list every AR payload signal the port has (arlock, arqos, arregion, aruser). |
| 11 | S4 | amba-axi-checker-coverage-plan | Added `bins other_short = {2, [4:6], [8:14]};` to `cp_len`. Neither ignore_bins rule excludes it wrongly: it holds no WRAP length, and every value is a legal FIXED length. |
| 12 | S4 | amba-ahb-error-two-cycle | "passes vacuously" is now "every attempt is a vacuous success and the property can never fail" (the spine §5.1 term). |

### Ids removed or renamed

None. All 28 ids survive.

### Deferred (not in this round's brief)

| Item | Reason |
|---|---|
| Completeness #4: an ACE-Lite / I/O coherency / DVM / barriers item | New question; it needs IHI0022E C8, C11 and C12 checked in depth. Best done in a content round, not a fix round. |
| Completeness #5: AXI3-to-AXI4 differences item (AxREGION, AxUSER, locked transfers) | New content; needs A7.3 and A8.1 to A8.3 verified. |
| Completeness #13 to #15: reset follow-ups, an APB RAL follow-up, a CompAck follow-up, a mid-level coherency item | Optional S4 items. |
| Completeness #1, #7, #16 to #18 | For the lead or for lessons (renderer bold, B-AMBA-1 byte types, Manager/Subordinate wording, follow-up answers, schema alignment); see requests below. |

### Lesson checks (lessons not edited)

- **Agree with the spec:**
  - B-AMBA-1 `:278` and `:544` (B1.1.3);
  - B-AMBA-F1 `:854` and `:863` (discarded reads and the read-sensitive Note);
  - B-APB-1 `:681–693` (monitor through `mon_cb`, new item per transfer);
  - B-AXI-6 (EXOKAY);
  - B-AMBA-F2 `:224` and `:231` (recommended mapping, Table C5-3 end states) and `:697` (PCrdGrant before RetryAck).
- **Closed:** earlier author requests 2 and 3 are resolved by the parallel rewrites. B-AMBA-F2 `:328` now says HN-F "*might* include a directory or snoop filter". B-AMBA-F1 `:98`, `:102` and `:168` cover undefined-length INCR and no early AXI termination.

### Requests for the lead (this round)

1. **B-AMBA-F2 `:158` disagrees with IHI0022E C1.2.3, C4.2 and C4.3.** It says "a cache may discard a Shared copy *without telling anyone*". C1.2.3 only removes the duty to tell *other caches*. A SharedDirty copy must still be written back or have its dirtiness passed on. C4.3 allows a silent move to I only for Clean lines, and only for masters without an external snoop filter; masters with one must signal evictions (C4.2, Evict in C4.9.1). Suggested wording: "a cache may discard a **clean** Shared copy without telling the other caches, so 'Shared' may mean 'the only copy left'. A SharedDirty copy must be written back or passed on, and a master that supports an external snoop filter must signal the eviction (C1.2.3, C4.2, C4.3)." Pass to the B-AMBA-F2 author. This carries forward accuracy r1 request 1.
2. **B-AMBA-F2 `:697` (optional).** After "The first attempt is sent with AllowRetry asserted", add "except PrefetchTgt, which has no response, is never retried and is sent with AllowRetry deasserted (§2.11, §2.11.2)", to match the bank.
3. **Carried from the completeness review:**
   - render `**bold**` in `splitInlineCode` and `InlineText` (#1, cross-bank; this bank keeps its bold, as that review advised);
   - add the IHI0051A Table 2-2 byte types to B-AMBA-1 (#7);
   - follow-up answers and schema alignment (#17, #18).
4. **Still open from the first author log:**
   - request 1: the AHB citation standard (Issue C versus B.b);
   - request 4: a `debug` category;
   - request 5: optional cleanup of `INTERVIEW_QUESTION_LESSONS`;
   - request 6: pictures;
   - request 7: a compile check of the fenced SV blocks. This round adds two more blocks that would benefit: the `sbuf` bridge path and the new formal assumptions.

### Validation (fix round 1)

- `python3 -c "import json;json.load(open('content/interview-questions/amba-protocols.json'))"`: passes.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 873 tests, all passed.
- Extra checks:
  - fences, inline backticks and `**` pairs are balanced in every field;
  - every `modules` entry resolves to an existing `.mdx`;
  - no IHI0022H, IHI0050F or IHI0024C citation remains;
  - every code block is either a complete unit (a typedef or function) or starts with `// snippet:`;
  - the JSON round-trips through `json.dumps(indent=2, ensure_ascii=False)`, so formatting is unchanged.
