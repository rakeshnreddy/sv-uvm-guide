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
