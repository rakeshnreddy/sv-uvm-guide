# G29-B-AMBA completeness review, round 1: `amba-protocols.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-18 (review-only rerun; it replaces the 2026-10-11 version of this file). The bank has not changed since the author's run (file dated 2026-10-11 18:29). Read-only except for this file.

**Inputs read:**
- `docs/curriculum-quality/README.md`;
- `analysis/G29.md`: the `amba-protocols.json` section, "Coverage gaps" and "Requests for the lead";
- `analysis/G29.verify.md`: the AMBA-02, -03 and -07 adjustments, gaps 5 and 7, and "Notes for the implementation author";
- `curriculum-spine.md`: the B-AHB-1..3, B-AMBA-1/2/F1/F2/F3, B-AXI-1..6 and B-APB-1 cards, and §5.1 terminology;
- `reviews/G29-B-AMBA.author.md`;
- the whole bank (28 questions), and `git diff HEAD` for it;
- the loader and renderer: `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`;
- `src/lib/practice-links.ts` (`resolveLessonRefs`, `INTERVIEW_QUESTION_LESSONS`);
- the current B-* lessons, which are being rewritten in parallel.

**Spec texts I checked myself** (local extractions of the exact issues):
- AHB IHI0033C: `sources/ahb5.txt` (header "ARM IHI 0033C");
- AXI/ACE IHI0022E: `sources/arm_axi.txt`;
- APB IHI0024E: `scratchpad/arm/apbE.txt`, header "ARM IHI 0024E". The `sources/arm_apb.txt` copy is Issue C, so I did not use it.
- CHI IHI0050E.b: `scratchpad/g29amba_r1/data/chi.txt`, header "ARM IHI 0050E.b".

No web fetch was needed.

## Verdict

**Pass: no S1 or S2 remains.** Findings: 0 S1, 0 S2, 7 S3, 11 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 4 files, 863 tests passed |
| `tests/lib/remark-practice-slot.test.ts` (reads the banks) | 5 passed |
| `modules` resolve | All 17 distinct refs exist as `content/curriculum/*/<module>/index.mdx`. `interview-prep-banks.test.ts` "resolves every modules entry" also passes. B-APB-1 is in `curriculum-data`. Every B-* module has at least one question. |
| Levels | junior 5, mid 9, senior 8, staff 5, senior-staff 1. That meets the ≥ 3 junior requirement and spans junior to senior staff. G29 Request 3 asks for ≥ 2 at each of junior, mid, senior and staff; that holds too. |
| Categories | concept 9, coding 6, trick 5, waveform-debug 4, verification-plan 2, staff-system-design 2 |
| Coding and waveform items carry code or a cycle table | All 6 coding items have SV in the model answer. All 4 waveform-debug items have a cycle table or bus trace in `code`, which the page shows with the prompt, before the reveal. I traced each table against the answer; all are consistent (APB C1–C5, AHB C1–C4, 2x2 W-ordering, ACE trace t=100–151). |
| `follow_ups` / `common_mistakes` | Present on all 28: 3 follow-ups each, and 2–3 common mistakes each |
| Rubrics separate strong from weak | 25 of 28 describe both a strong and a weak answer. Three lack a weak line (finding 8). |
| Citations | Every source is a `{doc, section, verified: true}` object. No IHI0022H, IHI0050F or IHI0024C numbers remain. Spot checks held: IHI0033C §3.6.1 (fixed-length bursts end with SEQ; no BUSY after SINGLE), §3.6.2, §4.2 (1KB minimum region), §5.1.3, Table 3-4 (HBURST), Chapter 10 (exclusives). IHI0022E A3.4.1 (byte-lane equations), A4.3.2 and its Note, A7.2.2, Table C4-13. IHI0024E §3.1.2 ("PREADY can take any value when PENABLE is LOW"), §3.2.1 Table 3-1, §3.4.3 (Issue E no longer names SLVERR, so "a convention" is right), Table 3-2, PWDATA 8/16/32. IHI0050E.b §13.4.1 (RN and SN rules, word for word as the bank paraphrases them). |
| Rendering | Fenced blocks and `inline code` render. `**bold**` does not (finding 1). |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-AMBA-01 | S1 | **Resolved.** `check_line` fails when any Unique copy coexists with more than one valid copy, and when more than one copy is Dirty. So UD + SC fails, and the rubric and common mistakes name that case (IHI0022E C1.2.3). |
| G29-AMBA-02 (S1 after G29-V) | S1 | **Resolved.** The prompt says both cores start SC. The trace shows no AC to Core 1 and no AR from Core 1. The expected writer path is SC→UC (Table C4-13, RRESP 00 checked) then UD, or MakeUnique. The reader must end in **I**, and "SC or I" is listed as a weak answer. The snoop mapping is called recommended (C5.1), as G29-V asked. |
| G29-AMBA-03 (fix adjusted by G29-V) | S2 | **Resolved.** The answer gives the 2x2 W-ordering cycle (A5.4.1, A5.3.2), the single-interface case (A3.3.1 Caution) and same-ID multi-slave reads (A5.3.1). "Always accept responses" is labelled a design rule, and "IHI0022H §A10" is gone. |
| G29-AMBA-04 | S2 | **Resolved.** The answer lists the ordering duties. It labels stall vs reorder buffer, and AW admission vs store-and-forward, as implementation choices. |
| G29-AMBA-05 | S2 | **Resolved.** The answer covers known vs unknown lengths, per-beat or chunked or speculative strategies (labelled as choices), and early AHB termination vs no early AXI termination (WSTRB = 0, drain the reads). The WRAP16 downsizing case is corrected, and the code no longer uses a `remaining`-driven loop. |
| G29-AMBA-06 | S2 | **Resolved.** The answer covers TxnID reuse, the field list, PCrdGrant before RetryAck, PCrdReturn, the resend TgtID, starvation, the 1024-outstanding limit, and that credits are not bound to transactions. |
| G29-AMBA-14 | S2 | **Resolved in substance:** 15 questions added, 5 of them junior. One sub-topic of its list, narrow transfers, is only touched (finding 3, S3). |
| Navigation S2 (banks unreachable) | S2 | **Resolved (lead side).** `/interview-prep` renders the bank. B-AMBA-F3 links to `/interview-prep#amba-protocol-interview-question-bank` (`index.mdx:1023`), and B-AMBA-F2 links to `#q-amba-ace-snoop-flow` (`:905`), an anchor that `page.tsx:101` generates. |
| G29-AMBA-07 to -13 (S3/S4) | — | Applied as the author log says, including G29-V's correction to AMBA-07 (§13.4.1: an RN may wait for outbound RSP/DAT before inbound SNP; the Home refusing snoop responses is the design error). |

## Coverage gaps assigned to `amba` (G29.md "Coverage gaps")

| Gap row | Status |
|---|---|
| APB transfer, junior | Filled: `amba-apb-transfer-basics` (junior), `amba-apb-error-strobe` (mid) |
| AHB basics, junior | Filled: `amba-ahb-pipeline-basics`, `amba-ahb-htrans-burst` |
| AHB two-cycle ERROR, mid | Filled: `amba-ahb-error-two-cycle` |
| AXI burst types and address math | Filled: `amba-axi-burst-math` |
| Narrow and unaligned transfers, WSTRB lanes | **Partly filled.** Unaligned and WSTRB are covered; narrow transfers appear only in an unanswered follow-up (finding 3). |
| Responses, junior–mid | Filled: `amba-axi-responses` |
| AXI ordering, including RAW hazards | Filled: `amba-axi-id-ordering` (d), `amba-axi-read-scoreboard-per-id` |
| AXI3 vs AXI4, AXI4-Lite | **Partly filled.** AXI4-Lite is covered. The AXI3/AXI4 differences are scattered, and AxREGION/AxUSER are absent (finding 5). |
| Exclusive access; AxCACHE/AxPROT/QoS; AXI-Stream; checker and coverage model | Filled |
| ACE-Lite / I/O coherency, DVM, barriers (staff) | **Not filled; deferred** (finding 4) |
| CHI flows: DMT/DCT/DWT, CompAck, ordering (staff) | Concept level only. I agree with the deferral (finding 14). |
| Verifier gap 5 (AHB5 HNONSEC/HEXCL) | Taught now in B-AHB-1..3; a follow-up in `amba-axi-exclusive-access` points at IHI0033C Chapter 10. Not a bank requirement. |
| Verifier gap 7 (visuals) | Deferred to the lead's schema decision (author request 6). I agree. |

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | (all; lead, cross-bank) | `/interview-prep` renders bank text through `toRichBlocks`/`splitInlineCode`, which understand only fenced blocks, blank-line paragraphs and backticks. This bank has 143 `**bold**` pairs (286 markers), and every one shows as literal asterisks in model answers and rubrics. debug, soc and sva-formal have the same problem (229, 372 and 272 markers); systemverilog and uvm have none. | Lead: render `**…**` as `<strong>` in `splitInlineCode` and `InlineText`, with a unit test next to "splits inline code". The bank author should not strip the bold, because the markup is otherwise clean (no single-newline lists, no unpaired backticks). | `src/app/(learning)/interview-prep/interview-banks.ts:264-297`; `page.tsx:37-80`; `grep -o '\*\*'` per bank |
| 2 | S3 | amba-apb-transfer-basics | The monitor snippet, the one piece of TB code a junior will copy, has two problems. (1) It fills a single `item` handle and calls `ap.write(item)` on every transfer without creating a new object. The analysis port passes that same handle to every subscriber, so a scoreboard that stores items sees them overwritten. This is the shared-handle bug G29-UVM-01 corrected in the UVM bank. (2) Its comment says "via a clocking block", but it reads raw `vif.psel`, `vif.penable` and so on. The bank's own AHB monitor uses `vif.mon_cb.*`. | Inside the `if`, start with `item = apb_item::type_id::create("item");` and add a one-line comment: subscribers keep the handle. Read `vif.mon_cb.psel` and the other signals through the monitor clocking block, as in `amba-ahb-monitor-pipeline`. | uvm-core 2020.3.1 `uvm_analysis_port.svh:82-92` (confirmed in G29.verify.md, G29-UVM-01); bank `amba-ahb-monitor-pipeline` |
| 3 | S3 | amba-axi-burst-math | Residue of G29-AMBA-14 ("WSTRB and narrow transfers") and of the gap row "Narrow and unaligned transfers". Both worked cases use AxSIZE equal to the bus width. The narrow case exists only as follow-up 1, with no answer. The spine's B-AXI-5 misconception 3, "2 bytes at 0x1 with AxSIZE=1 → WSTRB `4'b0110`", is never exercised. B-AXI-2 teaches narrow transfers (`:229-233`, `:374`), so the bank lags the lesson. | Add case (c): 32-bit bus, INCR, AxSIZE = 1, AxLEN = 1, AxADDR = 0x1. Aligned_Address is 0x0. Beat 1 has Lower_Byte_Lane = 1 and Upper_Byte_Lane = 0 + 1 − 0 = 1, so one byte on lane 1 (WSTRB ⊆ `4'b0010`, not `4'b0110`). Beat 2 is at 0x2, lanes 2–3 (`4'b1100`). Optionally add an INCR4 of bytes from 0x1, where the lanes rotate 1, 2, 3, 0. Put the `4'b0110` answer in the rubric's weak line. | IHI0022E A3.4.1 byte-lane equations ("Upper_Byte_Lane = Aligned_Address + (Number_Bytes − 1) − INT(Start_Address/Data_Bus_Bytes) × Data_Bus_Bytes"); spine B-AXI-5 card |
| 4 | S3 | (bank) | The staff gap "ACE-Lite / I/O coherency, DVM, barriers" is unfilled. The deferral reason ("bank already at 28") is weak. B-AMBA-F2 now teaches ACE-Lite in detail: no AC/CR/CD, no RACK/WACK; ReadOnce, WriteUnique, WriteLineUnique, CleanShared, CleanInvalid and MakeInvalid; never snooped (`:184`, citing §C11.1 and Tables C11-1, C11-2). It also names DVM and barriers (`:55`, `:216`). I/O coherency (a DMA or GPU reading a CPU-dirty line) is a standard senior and staff interview topic, and the coherency scoreboard's follow-up 2 already asks about ReadOnce/WriteUnique with no item that answers it. | Add one senior or staff item mapped to B-AMBA-F2 covering: what an ACE-Lite master can issue and why it has no snoop channels; what the interconnect does for a ReadOnce of a line that is UD in a CPU (it snoops, and the line stays coherent while the DMA keeps no copy); why WriteUnique must invalidate other copies; DVM and barriers at awareness level. Verify every claim in C11.1, C12.1 and C8.1 before citing. If the lead defers instead, record it in the plan backlog. | IHI0022E chapter list: C8 "Barrier Transactions", C11 "ACE-Lite", C12 "Distributed Virtual Memory Transactions"; B-AMBA-F2 grep |
| 5 | S3 | (bank) | The mid gap "AXI3 vs AXI4 (WID removal, 256-beat INCR, QoS/REGION/USER)" is only partly filled. WID removal sits inside `amba-axi-id-ordering` (c) and the deadlock answer, locked transfers inside the exclusive item, and AXI3 appears only in follow-ups. AxREGION and AxUSER appear nowhere. B-AXI-1 has an "AXI3 versus AXI4" practitioner subsection (`:36`), so a learner asked the common screening question "what changed from AXI3 to AXI4?" finds no bank item. | Either add true/false items to `amba-axi4-lite-stream` (it is already a trick list), or add a short mid trick mapped to B-AXI-1 and B-AXI-3. Points to cover: WID and write interleaving removed (A5.4, A5.4.1); INCR up to 256 beats, other types up to 16 (A3.4.1); locked transfers removed (A7.3); AxQOS, AxREGION and AxUSER added (A8.1, A8.2, A8.3); BVALID also waits for the AW handshake (A3.3.1). | IHI0022E titles: A5.4, A7.3 "Locked accesses", A8.1 "QoS signaling", A8.2 "Multiple region signaling", A8.3 "User-defined signaling"; bank grep for REGION/USER |
| 6 | S3 | amba-bridge-4kb-split | The bank cites AHB as IHI0033C, whose §3.5 adds optional write strobes. Table 3-3 is the Write_Strobes property, which is why burst operation moved from B.b §3.5 to C §3.6. The bridge code derives WSTRB only from address and size (`lanes(buf_addr, hsize, i)`) and never mentions HWSTRB, so an AHB5 Issue C bridge built from it drops sparse writes. B-AHB-1 (`:630`) and B-AMBA-F1 (`:101`, `:886`) now teach HWSTRB, so the bank is behind the lessons. | Add two sentences. If the AHB interface has Write_Strobes = True, copy HWSTRB to WSTRB for each beat (a beat with an all-zero HWSTRB still goes out with WSTRB = 0). Otherwise derive the lanes from HADDR and HSIZE. Add IHI0033C §3.5 and Table 3-3 to the sources. | `ahb5.txt`: chapter 3 contents (§3.5 Write strobes), Table 3-3 "Write_Strobes property"; lesson grep |
| 7 | S3 | amba-axi4-lite-stream | Sub-question (5) tests the TKEEP/TSTRB byte types: data, position, null, and reserved (IHI0051A §2.4, Table 2-2). No lesson teaches them: `grep -i "position byte\|null byte"` under `content/curriculum` finds nothing. B-AMBA-1, the only module listed, mentions TKEEP and TSTRB only as optional signals (`:288`, `:345`, `:374`). The model answer is self-contained, but the "Learn it in" link points at a lesson that does not cover the rule. | Lead request to the B-AMBA-1 author: add the Table 2-2 byte types, and TLAST as the packet boundary, to the AXI4-Stream subsection. No bank change. | B-AMBA-1 grep; bank text (Table 2-2 not re-checked; the 2026-10-11 run checked `axis.txt` §2.4) |
| 8 | S4 | amba-axi-4kb-boundary; amba-ace-snoop-flow; amba-staff-interconnect-design | These three rubrics give no weak answer, so an interviewer or self-grader cannot see what failing looks like (the other 25 do). The 4KB rubric also has no "Must have": it restates the model answer's arithmetic. | **4KB:** "Must have: 32 bytes, last byte 0x100F, crosses 0x1000, illegal, two bursts. Weak: measures the end from the unaligned start, applies the rule to WRAP or FIXED, or says the interconnect will split it." **ACE snoop:** "Weak: an invalidating snoop for ReadShared, 'exactly one Dirty copy', or no PassDirty and no write-back owner." **Interconnect:** "Weak: a datapath with no ordering duties, or 'give B/R priority' as the deadlock fix." | Bank text |
| 9 | S4 | amba-coherency-scoreboard-design | "A cache ... may drop a line without telling anyone (C1.2.3)" reads as if any line can be dropped silently. Only a clean line can: with Evict, or silently when no snoop filter needs Evict. A Dirty line needs a WriteBack or WriteClean. The rubric already says "silent eviction of clean lines". | Write: "may drop a **clean** line without telling anyone (or with an Evict); a Dirty line must be written back (C1.4)". | IHI0022E C1.4 (WriteBack/WriteClean for dirty lines, Evict for clean lines); B-AMBA-F2 `:313` |
| 10 | S4 | amba-axi-valid-ready-rule | The AR stability assertion lists `araddr, arlen, arsize, arburst, arid, arprot, arcache` but leaves out `arlock`, `arqos`, `arregion` and `aruser`. A mid-level learner will copy it as the complete check. | Add the missing AR payload signals, or add the comment "plus every other AR payload signal the interface has (A3.2.1)". | Bank text; IHI0022E A3.2.1 |
| 11 | S4 | amba-axi-checker-coverage-plan | `cp_len` bins only lengths 1, 2, 4, 8, 16 and 17–256, so the common legal INCR lengths 3, 5–7 and 9–15 beats are never required. The rubric and text speak of a burst × length × size × alignment cross, but the shown cross is burst × length only. | Add `bins other_short = {2, [4:6], [8:14]};` (AxLEN values). Either add `cp_size` and `cp_align` to a cross, or say they belong to "coverage to add". | Bank text |
| 12 | S4 | amba-ahb-error-two-cycle | "so it passes vacuously" (answer and rubric) does not use the spine §5.1 term. | Write "every attempt is a **vacuous success**: the antecedent never matches, so the property can never fail". | Spine §5.1 canonical terminology |
| 13 | S4 | (bank) | Spine items that no question touches, outside G29's assigned gaps: AXI reset (B-AXI-1 objective 4, §A3.1); AHB reset and locked transfers (B-AHB-2 objective "HTRANS not IDLE in reset", §7.1; B-AHB-1 must-cover §3.3); the APB agent as a RAL bus (B-APB-1 objective 4, adapter `reg2bus`/`bus2reg`, PSLVERR to status). | Cheapest fix: one follow-up each. "What must VALID do during and just after reset?" for `amba-axi-five-channels`. "What must HTRANS be during reset?" for `amba-ahb-pipeline-basics`. "Write `reg2bus`/`bus2reg` for this agent; how does PSLVERR reach the register model?" for `amba-apb-error-strobe`, which already discusses register-model prediction. | Spine cards B-AXI-1, B-AHB-1, B-AHB-2, B-APB-1; B-APB-1 lesson objectives `:23-29` |
| 14 | S4 | amba-chi-node-roles (bank) | The CHI flow gap (DMT/DCT/DWT, CompAck, ordering) is covered at concept level only. I agree with deferring a flow-level item: the B-AMBA-F2 spine card puts "detailed transaction flows beyond awareness" out of scope. | Optional: add a follow-up on CompAck (which transactions need it, and why the Home waits for it). Otherwise record the deferral in the plan backlog. | Spine B-AMBA-F2 card |
| 15 | S4 | (bank, B-AMBA-F2 items) | All six B-AMBA-F2 items are senior or above. Nothing checks the module's core objective 1 (why coherency exists: stale and dirty copies, the role of snoops) or its misconception 2 ("CHI is AXI with more signals"; it is packetized and credit-based) at mid level. | Optional: a short mid concept item ("Two CPUs cache the same line without coherency; show the stale-read bug, then say what ACE adds and how CHI differs: packets on REQ/RSP/SNP/DAT, link credits"). | Spine B-AMBA-F2 card |
| 16 | S4 | amba-ahb-pipeline-basics (and all AHB items) | The AHB items cite IHI0033C but use master/slave, while Issue C itself says Manager/Subordinate. The APB items follow IHI0024E's Requester/Completer. A learner who opens Issue C sees different words. | Add one sentence to the first junior AHB item: "IHI0033C calls these Manager and Subordinate". It belongs with the lead's AHB citation decision (author request 1). | `ahb5.txt` (Issue C uses "Manager", "Subordinate" throughout); spine B-AMBA-1 "terminology: master/slave as in the cited issues" |
| 17 | S4 | (lead, schema) | `follow_ups` carry no expected answers. On `/interview-prep` the page tells learners to "check yourself", but they cannot check any of the 84 follow-ups. Many are not answered in the model answer either: for example the narrow-lane follow-up in `amba-axi-burst-math`, and every "write the assertion" follow-up. | Lead: consider an optional `follow_up_answers` (or short hints) field in the loader schema; bank authors can then fill it. Low priority. | `page.tsx:136-137`; bank text |
| 18 | S4 | (lead, schema) | `src/types/interview-question.ts` and `tests/interview-questions/bank-schema.test.ts` still declare `sources: string[]` and none of `modules`, `code`, `follow_ups` or `common_mistakes`. The real schema is the zod `questionSchema` in `interview-banks.ts`. The shape test passes only because it checks `Array.isArray(sources)`. | Lead: align the type and the schema test with the zod schema (G29 Request 2), so a future bank cannot drop the new fields silently. | Files named |

## Requests for the lead (carried, with my notes)

1. **AHB citation standard (author request 1).** Settle one issue for the AHB track. Issue C differs from B.b in content, not only in numbering: optional HWSTRB (§3.5), signal validity (Chapter 8), parity (Chapter 12), and the Manager/Subordinate terms (findings 6, 16).
2. **Close author requests 2 and 3.** The parallel lesson rewrites resolved both. B-AMBA-F2 `:328` now says HN-F "*might* include a directory or snoop filter". B-AMBA-F1 `:98`, `:102` and `:168` cover the undefined-length INCR and "No component can terminate a burst early".
3. **B-AMBA-1:** add the IHI0051A Table 2-2 byte types (finding 7).
4. **Renderer:** support `**bold**` (finding 1, cross-bank).
5. **Schema:** follow-up answers (finding 17); align the type and the shape test (finding 18).
6. **Keep author requests 4 to 7:**
   - request 4: a `debug` category for `amba-ace-state-transition-debug`;
   - request 5: optional cleanup of `INTERVIEW_QUESTION_LESSONS`, whose 13 AMBA entries are now overridden by `modules`;
   - request 6: three pictures; do not link `AxiDeadlockSimulator` to the W-ordering case;
   - request 7: a compile check of the fenced SV blocks.

   I read every code block by inspection. I found no syntax error; the closest call is the `!binsof(cp_len) intersect {...}` select in finding 11's covergroup, which is legal per §19.6.1.1. Finding 2 shows why a semantic review still matters.

## Differences from the 2026-10-11 version of this review

- **Kept, after re-checking:** that review's findings 1–9 and 11–14, renumbered here.
- **Dropped:** its finding 10, that `amba-axi-five-channels` should list B-AXI-1 first. The B-AMBA-2 spine objective is literally "Recall the five AXI channels, their directions, and who drives VALID and READY", so B-AMBA-2 is a correct first lesson for this junior item.
- **New:**
  - finding 3: narrow transfers were not actually filled; the old review counted them as filled;
  - finding 2(2): raw `vif` sampling despite the clocking-block comment;
  - findings 12 and 15–18.
