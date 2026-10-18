# G29-B-AMBA accuracy review, round 1: `amba-protocols.json`

Reviewer: accuracy lens, round 1 (review-only pass of 2026-10-18; this file replaces the round-1 notes from the October run, which the restart guide says may not match the current text). Scope: all 28 questions in `content/interview-questions/amba-protocols.json` as it stands in the working tree (`git diff HEAD`: 786 insertions, 63 deletions). Read against the author log `G29-B-AMBA.author.md`, the G29 analysis (the `amba-protocols.json` section, "Coverage gaps" and "Requests for the lead"), G29-V ("Refuted or adjusted" and "Notes for the implementation author") and the spine. Every `modules` entry resolves to an existing lesson.

**Result: not clean.** 0 S1, 3 S2, 3 S3, 5 S4.
- Every original G29-AMBA issue (01 to 14) is resolved in substance.
- No IHI0022H, IHI0050F or IHI0024C section number remains.
- Every section number I looked up exists and is on point, including the IHI0033B.b numbers given in brackets.
- I hand-traced every worked example: the WRAP8 at 0x34, the INCR at 0x1002, the WRAP at 0x38, 0x0FF0 against 4KB, the APB and AHB cycle tables, the 2x2 W-ordering deadlock, the CleanUnique trace, and the snooped-UD end states. All are correct.
- The code compiles by inspection, apart from the gaps listed below.

The three S2 findings:
- the ACE snoop-flow key forbids a legal snoop;
- the AXI4-Lite item invents a "slave must honour WSTRB" rule;
- the CHI retry checker would fail on the legal case of a PCrdGrant that arrives before its RetryAck.

## Sources checked

| Source | Where | What I checked |
|---|---|---|
| Arm IHI0022E | `sources/arm_axi.txt` (header "ARM IHI 0022E") | A3.2.1; A3.3.1 (read and write dependencies, Caution, AXI4 write response dependency and its Note); A3.4.1 (4KB rule and Note, burst lengths, WRAP rules, "early termination of bursts is not supported", the WSTRB-low and discard text and its read-sensitive Note); A3.4.4 and Table A3-4; A4.3.1 (Table A4-2, Modifiable list, no change to a different 4KB space, exclusive AxSIZE/AxLEN exception); A4.3.2 and its Note; Table A4-5; A4.4.1; Table A4-6; A5.3; A5.3.1 to A5.3.6; A5.4; A5.4.1; A7.2.1 to A7.2.5; A7.3; A8.1.1; A8.1.2; A10.3.7 Caution; B1.1; Table B1-1; B1.1.3; C1.1; C1.2.3 (Table C1-2 and the cache state rules); C3.2.1; Table C3-22; C4.2; C4.3; C4.6.1 (Tables C4-13 and C4-14); C4.7.1 (Table C4-17); C4.10; C5.1 (Table C5-1 and Note); C5.1.1; C5.1.2; C5.1.3 (Table C5-2); C5.2.3; C5.3.2 (Table C5-8); C6.2; C6.3 (Table C6-1) |
| Arm IHI0033C | `sources/ahb5.txt` (header "ARM IHI 0033C") | Table of contents; Table 2-3; §2.4 Note (retimed multiplexor select); Table 2-5; §3.1; §3.2 Table 3-1; §3.6 (Table 3-4, the 1KB and alignment rules); §3.6.1; §3.6.2; §3.7.1 and §3.7.2 (transfer-type and address changes during waits); §4.2; §4.2.1; §4.3; §5.1 (Tables 5-1, 5-2); §5.1.2; §5.1.3; §6.1.1; Chapter 10 title |
| Arm IHI0033B.b | `sources/arm_ahb.txt` (header "ARM IHI 0033B.b") | Only the bracketed mappings: Chapter 3 contents (§3.5 Burst operation, §3.6 Waited transfers); §3.5.1; §3.5.2; §5.1.3; Table 5-2; Table 3-3 |
| Arm IHI0024E | `scratchpad/arm/apbE.txt` (header "ARM IHI 0024E"; the `sources/arm_apb.txt` copy is Issue C) | Change history; the APB4 revision note; §1.1; Table 2-1 (PWDATA 8, 16 or 32 bits); §3.1.2; §3.2; §3.2.1 Table 3-1; §3.3.2; §3.4; §3.4.1 to §3.4.3; §3.5 Table 3-2; §3.5.1; §4.1; Table B-1 |
| Arm IHI0051A | `sources/arm_axis.txt` | §2.2.1; §2.4.3 Table 2-2; §2.5; §2.6; the null-transfer suppression Note (only without TLAST) |
| Arm IHI0050E.b | The PDF fetched from developer.arm.com in the analyst's session (`tool-results/webfetch-1791063688327-k7ds9x.pdf`, header "ARM IHI 0050E.b"), extracted to `scratchpad/g29amba_r1/data/chi.txt` | §1.6; §1.7; §2.11 in full; §2.11.1; §2.11.2; §2.11.3; §3.3.1; §4.4.1; §4.4.2 Table 4-24; §4.11.1; §13.4.1 (RN and SN rules); §14.2; §14.2.1 |
| IEEE 1800-2023 | `sources/t1_lrm_clean.txt` | §19.6.1.1 (`! binsof(x) intersect {...}`, used in the AR covergroup) |

I did not use WebFetch. Local copies of the exact issues the program cites were available.

## Findings

| # | Sev | Question id (field) | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | **S2** | amba-ace-snoop-flow (rubric "a ReadShared snoop, not an invalidating snoop"; `common_mistakes[1]` "Sending an invalidating snoop for a ReadShared"; model answer step 2) | The key forbids a legal snoop. For a ReadShared from the initiating master, the state change the snooped cache must reach is "Shared or Invalid". ReadShared is the *recommended* snoop. ReadClean, ReadNotSharedDirty, ReadUnique and CleanInvalid are listed as permitted options, and the C5.1 Note allows any mapping that forces the same state change. So an interconnect that sends ReadUnique or CleanInvalid is compliant; it only costs B its copy. The rubric and the common mistake therefore mark a correct answer wrong. They also contradict the verifier's note ("a checker should test the required state change, not the snoop name"), the bank's own `amba-ace-state-transition-debug` common mistake, and the B-AMBA-F2 lesson (line 888 lists ReadUnique and CleanInvalid as permitted for ReadShared). | Rubric: "the interconnect snoops the other caches on AC. ReadShared is the recommended snoop (Table C5-1). ReadClean, ReadNotSharedDirty, ReadUnique and CleanInvalid are also permitted, because the required end state is Shared or Invalid (Table C5-2, Table C6-1)." Step 2: add "the recommended snoop; an invalidating alternative would leave B in I". Replace `common_mistakes[1]` with "Checking the snoop opcode instead of the required end state, or accepting a snoop that leaves B Unique". Add "§C5.1.3 Table C5-2; §C6.3 Table C6-1" to `sources`. | IHI0022E C5.1 Table C5-1 and Note; C5.1.3 Table C5-2 (ReadShared row: "Shared or Invalid"; options ReadClean, ReadNotSharedDirty, ReadShared, ReadUnique, CleanInvalid); C6.3 Table C6-1 (same row: recommended ReadShared, optional ReadUnique, CleanInvalid) |
| 2 | **S2** | amba-axi4-lite-stream (model answer item 2) | "WSTRB is in the AXI4-Lite signal list (Table B1-1), so sparse writes still happen and **a Lite slave must honour the strobes**." B1.1.3 says the opposite: "Any slave component can choose whether to use the write strobes." The options are to use them fully, to ignore them and treat every write as full width, or to return an error for unsupported strobe combinations. Only "a slave that provides memory access must fully support write strobes." The answer key "(2) True" is right, but a candidate who repeats the reason states a rule that does not exist, and a VIP built on it fails compliant register slaves. The B-AMBA-1 lesson (line 278) states B1.1.3 correctly. | Replace the clause with: "Masters and interconnect must drive correct strobes. A Lite slave may use them, ignore them (treating every write as full width), or return an error for patterns it does not support; a slave that provides memory access must support them fully. After conversion from full AXI, a write with every strobe low can arrive (B1.1.3)." Add "§B1.1.3 Write strobes" to `sources`. Optionally add "Requiring every Lite slave to honour WSTRB" to `common_mistakes`. | IHI0022E B1.1.3 |
| 3 | **S2** | amba-chi-retry-verification (model answer, "Checker and scoreboard") | The checker is told to "flag ... a grant without any outstanding RetryAck". A Completer may send PCrdGrant before the RetryAck it belongs to, and the Requester must store the credit until the RetryAck arrives (§2.11; §2.11.3: "permitted, but not expected"). At that moment the ledger the answer defines (RetryAcks received minus resends) is zero, so the check fails on legal traffic. It also contradicts the answer's own corner case "PCrdGrant arriving before RetryAck (legal, rare)". | Make the check deferred: "an unmatched grant is legal while a request to that Completer with AllowRetry = 1 still awaits its response. Flag it only when grants for a (Completer, PCrdType) exceed the RetryAcks received for it once no such request is pending, or at end of test." Keep "a credit left unused and unreturned at end of test". | IHI0050E.b §2.11 ("the PCrdGrant is received by the Requester before the RetryAck ... the Requester must record the credit"); §2.11.3 |
| 4 | S3 | amba-chi-retry-verification (rubric "the first attempt has AllowRetry asserted and PCrdType 0"; model answer rule 1) | The rule has an exception that the plan turns into a false check: "Request Retry is not applicable to the PrefetchTgt transaction", and AllowRetry "must be deasserted" for PrefetchTgt. A checker built from rule 1 fires on every PrefetchTgt. The other §2.11.2 case, "using a pre-allocated P-Credit", is the resend: §3.3.1 uses the same words for it. Rule 3 already covers it. | Rule 1: "First attempt: AllowRetry asserted and PCrdType = 0b0000, except PrefetchTgt, which is never retried and is sent with AllowRetry deasserted (§2.11, §2.11.2)." Add the exclusion to the rubric and to coverage. | IHI0050E.b §2.11 ("except for PrefetchTgt, the AllowRetry field must be asserted the first time a transaction is sent"); §2.11.2; §3.3.1 |
| 5 | S3 | amba-coherency-scoreboard-design (model answer, "What the bus cannot show") | "A cache ... may drop a line without telling anyone (C1.2.3)" is too broad. C1.2.3 only removes the duty to inform *other caches*. A Dirty line carries the duty to update main memory (Table C1-2), so it leaves only through a write-back or by passing dirtiness. C4.3 allows a silent move to I only for a line in a Clean state, and only for a master that does not support an external snoop filter (C4.2: such a master "must be able to broadcast which cache lines are ... evicted"). As written, the sentence lets the model accept a UD or SD line that silently vanished. The rubric ("silent eviction of clean lines") is right. | "A cache may move UC to UD on a store, and may move a Unique line to the matching Shared state, without bus traffic. A **clean** line may also be dropped silently, unless the master supports an external snoop filter, which must broadcast its evictions (C4.2, C4.3). A Dirty line leaves only through a write-back or by passing dirtiness." Cite C4.3 next to C1.2.3. | IHI0022E C1.2.3 (cache state rules, Table C1-2); C4.2; C4.3 ("If an external snoop filter is not supported, a cache line that is in a Clean state can move to the Invalid state"; "A cache line that is in a Unique state is permitted to move to the equivalent Shared state") |
| 6 | S3 | amba-ace-snoop-flow (`common_mistakes[0]`) | "Saying exactly one cache must hold the line Dirty (it is at most one ...)" labels the specification's own rule a mistake. C1.2.3 says: "A line that has been updated, relative to main memory, must be in a Dirty state in one cache." "At most one Dirty copy" is the right *checker* invariant, because a clean line has none and a line passed to the interconnect for write-back is held Dirty by no cache. But "exactly one, for an updated line" is not an error. | "Using 'exactly one Dirty copy' as a checker invariant: a line that matches memory has none, and while dirtiness is passed to the interconnect for write-back no cache holds it. The rule is that an updated line is Dirty in one cache only, so check at most one (C1.2.3)." | IHI0022E C1.2.3 (last two cache state rules); C5.3.2 Table C5-8 and the ReadClean text (PassDirty to the interconnect, written back immediately) |
| 7 | S4 | amba-axi-read-scoreboard-per-id (code in `on_r`) | The code compares data only when `resp == 2'b00`, so it skips EXOKAY beats too. The prose says to skip only SLVERR and DECERR. An exclusive read that succeeds returns valid data with EXOKAY (A3.4.4). | Use `if (!resp[1] && !mem.check_beat(...))`, which compares on OKAY and EXOKAY, or say that EXOKAY beats are checked by the exclusive model. | IHI0022E A3.4.4 Table A3-4 |
| 8 | S4 | amba-bridge-4kb-split (model answer, "Early termination") | "Accept and discard the remaining R beats (A3.4.1)" is correct. But the A3.4.1 Note warns that "discarding read data that is not required can result in lost data when accessing a read-sensitive device such as a FIFO". A bridge that forwards a fixed-length AHB read as one AXI burst still performs the cancelled beats at the slave. | Add: "the discarded beats are still real reads, so for read-sensitive (Device) targets the bridge should forward reads as single transfers or as bursts it never needs to abandon (A3.4.1 Note)." | IHI0022E A3.4.1 and its Note |
| 9 | S4 | amba-apb-transfer-basics (model answer snippet) | The comment says the code is "evaluated at each rising PCLK edge (via a clocking block)", but it reads `vif.psel`, `vif.penable` and so on directly. It also refills one `item` handle each time and sends it through `ap.write`. A reader who copies the pattern aliases every transfer. | Sample through the clocking block (`vif.mon_cb.psel`, and so on), as the AHB monitor item does, and create the item per transfer (`item = apb_item::type_id::create("item");`) before filling it. | IEEE 1800-2023 Clause 14 (clocking blocks); README "Code in lessons" |
| 10 | S4 | amba-axi-valid-ready-rule, amba-apb-error-strobe, amba-ahb-error-two-cycle, amba-axi-checker-coverage-plan, amba-chi-credit-deadlock (second block) | These code blocks are fragments: `assert property` items with no enclosing module, and free signal names such as `aclk`, `pstrb`, `HRESP`, `SYM_TXNID` and `comp_for_sym_txnid`. None is marked `// snippet`, which the README code rule requires. Other blocks in the bank are marked. In the credit-deadlock block, also say that `rsp_lcrdv` is the credit return on the Home's **outbound** RSP channel. An assumption on the Home's own inbound credit return would assume away the loop the answer describes. | Add a one-line `// snippet: ...` header to each, naming where the signals come from. | README "Code in lessons" |
| 11 | S4 | amba-ace-state-transition-debug (expected flow; `sources`) | The answer cites Table C5-1 (recommended snoops) and the C5.1 Note for "Core 1 must end in I". Table C6-1 states the *required* snooped-cache change directly: Invalid for CleanUnique and MakeUnique. It is the stronger source. | Cite "C6.3 Table C6-1 (required state change: Invalid)" next to Table C5-1, and add it to `sources`. | IHI0022E C6.3 Table C6-1 |

## Verified correct (selected, for the next round)

- **APB (IHI0024E).**
  - §1.1: not pipelined; at least two cycles per transfer.
  - Table 2-1: PWDATA is 8, 16 or 32 bits.
  - §3.1.2: the hold list while PREADY is low, and PREADY is a don't-care while PENABLE is low.
  - §3.2: PSTRB is low on reads. Table 3-1: compatibility.
  - §3.4: PSLVERR is valid only in the last cycle; driving it low elsewhere is recommended, not required; an errored write may have changed state; data from an errored read may be invalid but used; PSLVERR is optional and tied low when absent.
  - §3.4.3: PSLVERR mapping. Table 3-2: polarities.
  - §4.1: SETUP lasts one cycle; ACCESS goes directly to SETUP for back-to-back transfers.
  - PSTRB and PPROT are from Issue C (APB4).
  - The C1 to C5 table.
- **AHB (IHI0033C).**
  - The pipeline trace (A accepted at edge 1, data at edge 3; B accepted at edge 3, HWDATA at edge 4).
  - The WRAP8 sequence and `ahb_next_addr`.
  - Table 3-1: zero-wait OKAY for IDLE and BUSY; BUSY shows the next beat.
  - §3.6.1: BUSY rules. §3.6.2: cancelling is optional; HTRANS is IDLE when cancelling; no need to rebuild the burst.
  - §5.1.2 and §5.1.3: OKAY during the waits before an ERROR; the two-cycle reason.
  - Both ERROR properties: they accept back-to-back pairs and reject a 1-cycle ERROR, a cut-short pair and a stretched pair. The colleague's property is vacuous on a 1-cycle ERROR.
  - The monitor's two-step order at HREADY-high edges.
  - §4.2: slaves sample only when HREADY is high; 1KB minimum region.
  - §2.4 Note: retimed multiplexor select.
  - The B.b bracket mappings.
- **AXI (IHI0022E).**
  - The A3.2.1 and A3.3.1 rules and the Caution example; the AXI4 write response dependency and its hazard-checking Note.
  - Table A3-4 and per-beat read responses.
  - `axi_beat_addr`, checked by hand against both worked cases, including the 64-bit `len + 1` width.
  - `axi_crosses_4kb`.
  - The ID-ordering verdicts (a) to (d), with A4.3.2 and its Note.
  - A5.3.1: the interconnect's duty for same-ID reads across slaves. A5.3.2: W forwarded in address order. A5.4.1.
  - The 2x2 W-ordering trace: the wait-for cycle is real, and every interface obeys A3.3.1.
  - Table A4-5, A4.4.1, Table A4-6, A8.1.1, A8.1.2, A10.3.7.
  - A7.2.1 to A7.2.4, including the 128-byte monitor granularity, and the exclusive reference-model code.
  - B1.1 (burst length 1; 32 or 64 bits; no EXOKAY; AxCACHE 0b0000).
  - The A3.4.1 no-early-termination text with WSTRB-low completion.
  - The AR covergroup's `! binsof(cp_len) intersect {...}` against IEEE 1800-2023 §19.6.1.1.
- **ACE.**
  - The C1.2.3 invariants and `check_line`: UD plus SC fails.
  - Table C4-13: CleanUnique SC to UC with response 00. Table C4-17: MakeUnique to UD.
  - Table C5-8: snooped-UD end states I 1/0, SC 1/1, SD 0/1.
  - C5.2.3 WriteBack race; C6.2 RACK and CRRESP sequencing; the C6.3 snoop-until conditions.
  - The CleanUnique bus-trace diagnosis and root cause.
- **CHI (IHI0050E.b) and AXI4-Stream (IHI0051A).**
  - §1.6 node definitions: HN-F "might include" a filter; HN-I answers a snoopable request; SN-I serves peripherals or Normal memory; MN handles DVM. §1.7 DMT, DCT and DWT.
  - §2.11: the resend-field list, TxnID reuse after RetryAck, no credit-to-transaction binding, the 1024-outstanding limit, the CopyBack options, and starvation prevention.
  - §3.3.1: resend TgtID; PCrdReturn TgtID.
  - §4.11.1 and its data-packet exception; §13.4.1 RN and SN rules.
  - §14.2.1: 1 to 15 L-Credits; a credit cannot be used in the cycle it arrives, which matches the registered `held` counter.
  - AXI4-Stream §2.2.1, Table 2-2, §2.5, §2.6.

**Not raised as a finding.** I considered whether §14.2.1 ("the Receiver must provide L-Credits ... without requiring any action on the part of the Transmitter") is a Home-side rule that the credit-deadlock answer should cite. I left it out. Read literally, it would also forbid the RN-F's SNP-on-RSP wait, which §13.4.1 explicitly permits. The bank's wording ("treat this as a design requirement for the Home") is the defensible position.

## Requests for the lead

1. **B-AMBA-F2 (lesson disagrees with C1.2.3, C4.2 and C4.3).** Line 158 says "a cache may discard a Shared copy *without telling anyone*". C1.2.3 only removes the duty to inform other caches. A SharedDirty copy still owes memory the update; the lesson's own table at line 132 says so. C4.3 also limits silent eviction to Clean lines of masters without an external snoop filter. Suggested wording: "a cache may discard a **clean** Shared copy without telling the other caches, so 'Shared' may mean 'the only copy left'. A SharedDirty copy must be written back, and a master that supports an external snoop filter must signal the eviction (C1.2.3, C4.2, C4.3)." Pass to the B-AMBA-F2 author. Lines 313 and 693 already state this correctly.
2. **B-AMBA-F2, optional.** Line 697, "The first attempt is sent with AllowRetry asserted", could add "except PrefetchTgt, which is never retried (§2.11)", to match finding 4.
3. Nothing further beyond the author's seven requests. Request 1 still stands: the bank cites IHI0033C with B.b numbers in brackets, while B-AMBA-F1 still cites B.b only.
