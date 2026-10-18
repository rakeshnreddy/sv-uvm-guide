# G29-B-AMBA accuracy review, round 2: `amba-protocols.json`

Reviewer: accuracy lens, round 2 (2026-10-18). Scope: all 28 questions in `content/interview-questions/amba-protocols.json` as they stand in the working tree after fix round 1. Inputs read first: the brief (`docs/curriculum-quality/README.md`); `analysis/G29.md` (the `amba-protocols.json` section, "Coverage gaps" and "Requests for the lead"); `analysis/G29.verify.md` ("Refuted or adjusted" and "Notes for the implementation author"); the spine; the author log, including "Fix round 1"; and `G29-B-AMBA.accuracy.r1.md`. Every `modules` entry resolves to a lesson that exists.

**Result: clean for S1 and S2.** 0 S1, 0 S2, 3 S3, 3 S4.

- **All 11 round-1 accuracy findings are fixed correctly.** I re-checked each fix against the source text (see "Round-1 fixes re-verified").
- **The round-1 completeness additions are also correct:** narrow unaligned case (c), HWSTRB masking in the bridge, the `other_short` length bin, and the new formal assumption.
- **The three S3 findings are new.** None of them was raised in round 1:
  - The exclusive-access model leaves out the A7.2.5 rule for slaves that do not support exclusives.
  - The Device-region check in the AxCACHE item would flag legal Non-modifiable splits.
  - The CHI credit-deadlock item calls the data-packet case "the one exception" to §4.11.1, but SnpDVMOp(Sync) is also excepted.

## Sources checked

| Source | Where | What I checked |
|---|---|---|
| Arm IHI0022E | `sources/arm_axi.txt` (header "ARM IHI 0022E") | **Chapter A3:** A3.2.1; A3.3.1 (read, write and AXI4 write-response dependencies, and the Caution); A3.4.1 (4KB rule and Note, burst lengths, WRAP rules, no early termination, the read-sensitive Note, the "INCR longer than 16 may be split even if Non-modifiable" paragraph, the address and byte-lane equations); A3.4.3 (WSTRB rule); A3.4.4 and Table A3-4, with the OKAY, SLVERR and DECERR texts. **Chapter A4:** A4.3.1 (Table A4-2, the Non-modifiable exceptions, the Modifiable list, the 4KB limit); A4.3.2 and its Note; Table A4-5; A4.4.1. **Chapters A5 to A10:** A5.3; A5.3.1 to A5.3.6; A5.4; A5.4.1; A7.2.1 to A7.2.5; A7.3; A8.1.1; A8.1.2; A8.1.3; A10.3.7. **Part B:** B1.1; Table B1-1; B1.1.2; B1.1.3; B1.3.1. **Part C:** C1.2.3 and Table C1-2; C4.2; C4.3; C4.3.3; C4.6.1 (Tables C4-13 and C4-14); C4.7.1 (Table C4-17); C4.8.6 (WriteEvict); C4.9.1 (Table C4-29); C5.1 (Table C5-1 and Note); C5.1.1; C5.1.2; C5.1.3 (Table C5-2); C5.3.2 (Table C5-8); C5.3.5 (Table C5-11); C6.2; C6.3 (Table C6-1); C10.1 (Table C10-1) |
| Arm IHI0033C | `sources/ahb5.txt` (header "ARM IHI 0033C") | Change history (write strobes are new in Issue C); §2.4 and its Note (retimed multiplexor select); §2.5 Table 2-5; §3.1; §3.2 Table 3-1; §3.5, §3.5.1, §3.5.2 and §3.5.3 (Table 3-3); §3.6 (Table 3-4, the 1KB and alignment rules); §3.6.1; §3.6.2; §3.7.1; §3.7.2; §4.2; §4.2.1; §4.3; §5.1.3; §6.1.1; the Chapter 10 title |
| Arm IHI0033B.b | `sources/arm_ahb.txt` | Only the bracketed mappings: §2.3 to §2.5, §3.1, §3.2, §3.5, §3.5.1, §3.5.2, §3.6, §4.2, §4.3, §5.1, §5.1.3, §6.1.1. All are correct. |
| Arm IHI0024E | `scratchpad/arm/apbE.txt` (header "ARM IHI 0024E") | §1.1; §2.1 (PWDATA is 8, 16 or 32 bits); §3.1.2; §3.2; §3.2.1 Table 3-1; §3.4; §3.4.3; §3.5 Table 3-2; §4.1 |
| Arm IHI0050E.b | `scratchpad/g29amba_r1/data/chi.txt` (header "ARM IHI 0050E.b") | §1.6; §1.7; §2.11 in full; §2.11.1; §2.11.2; §2.11.3; §3.3.1; §4.11.1; §13.4.1 (RN and SN rules); §14.2; §14.2.1 |
| Arm IHI0051A | `sources/arm_axis.txt` | §2.2.1; §2.4.1; §2.4.2; §2.4.3 Table 2-2; §2.5; §2.6 |

**WebFetch.** The brief asked for WebFetch of the Arm documents. `developer.arm.com/documentation/ihi0022/latest` redirects (301) to `support.arm.com/documentation/ihi0022/latest`. That page renders its content with JavaScript, so the fetch returned only the page title. The "latest" issue would also number its sections differently from IHI0022E, the program's citation standard. Every check above therefore uses the local text of the exact issue the bank cites.

## Findings

| # | Sev | Question id (field, JSON line) | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | amba-axi-exclusive-access (model answer "Slave's view", the reference-model snippet and "Scenarios to cover"; `:473`) | **The answer leaves out the A7.2.5 rule for slaves without exclusive support.** Such a slave returns OKAY to both halves, and the A7.2.5 Note says its exclusive write **always updates the memory location**. The answer says only "returns OKAY". The snippet's fallback path is commented "OKAY, no update". "An exclusive to a slave without support" is a listed scenario, but no expected result is given for it. A scoreboard built from the snippet therefore goes wrong in that scenario. Either the memory model goes stale (OKAY predicted, update skipped), or, if `on_excl_read_done` armed the monitor on the OKAY read, it predicts EXOKAY. The B-AXI-4 lesson states the rule correctly (`index.mdx:366` and `:896`, both citing §A7.2.5), so the bank and the lesson disagree. | Add to "Slave's view": "Its exclusive write also gets OKAY, and the write is performed: an exclusive write to a slave without exclusive support always updates memory (A7.2.5 Note)." In the model: arm the monitor only when the exclusive read returned EXOKAY, and give each slave a `supports_excl` flag. When the flag is clear, predict OKAY and apply the write. Give the scenario its expected result (OKAY, OKAY, memory updated), and add §A7.2.5 to `sources`. | IHI0022E A7.2.3 ("must provide an OKAY response for both normal and exclusive accesses"); A7.2.5 and its Note ("An exclusive write to a slave that does not support exclusive access always updates the memory location"); A3.4.4 (OKAY covers "an exclusive access to a slave that does not support exclusive access") |
| 2 | S3 | amba-axi-cache-prot-qos (model answer, "Verification follow-through"; `:502`) | **The proposed check flags legal behaviour.** It says to "check that Device-mapped regions never see modified transactions (length, size or address changes, merging)". Device memory is Non-modifiable, but A4.3.1 allows four changes to Non-modifiable transactions: <ul><li>A burst longer than 16 beats may be split, with a reduced burst length and adapted addresses. A3.4.1 repeats this for INCR "even if the transaction attributes indicate that the transaction is Non-modifiable".</li><li>A Non-modifiable exclusive may change AxSIZE and AxLEN if the total bytes stay the same.</li><li>AxCACHE may change from Bufferable to Non-bufferable.</li><li>The A4.3 Note accepts a modification when downsizing below AxSIZE.</li></ul>A checker built as written fires on a legal split of a 32-beat INCR to a Device FIFO. The B-AXI-2 (`index.mdx:811`) and B-AXI-4 (`index.mdx:680–681`) lessons state these exceptions correctly. | "...check that Device-mapped regions never see merging, prefetching or any change outside the Non-modifiable exceptions of A4.3.1. Those exceptions are: a burst longer than 16 beats split into shorter bursts with adapted addresses; an exclusive with AxSIZE and AxLEN changed but the same byte count; AxCACHE Bufferable to Non-bufferable; and the downsizing case. Compare bytes per address, not bursts." Add §A3.4.1 (the INCR-split paragraph) to `sources`. | IHI0022E A4.3.1 ("A Non-modifiable transaction with burst length greater than 16 can be split into multiple transactions"; the exclusive AxSIZE/AxLEN exception; the AxCACHE exception; Table A4-2); the A4.3 Note (downsizing); A3.4.1 (the INCR longer-than-16 paragraph) |
| 3 | S3 | amba-chi-credit-deadlock (model answer, "The rules that break loops"; `:845`) | "An RN-F answers snoops without any protocol-layer dependency on completion of its outstanding requests; **the one exception** is that it waits for all data packets of a pending request that has already received one." **There are two exceptions, not one.** The first sentence of §4.11.1 excepts SnpDVMOp(Sync): an RN-F "must respond to received Snoop requests, except for SnpDVMOp(Sync), in a timely manner without creating any Protocol layer dependency". The data-packet rule also applies only to a pending request **to the same cache line**, which the answer omits. At senior-staff level, "the one exception" is the kind of claim an interviewer probes. | "Apart from SnpDVMOp(Sync), an RN-F answers snoops without any protocol-layer dependency on completion of its outstanding requests. It must also wait for all data packets of a pending request to the same cache line that has already received one before it responds (§4.11.1)." | IHI0050E.b §4.11.1 (first sentence, and the "pending request to the same cache line" paragraphs) |
| 4 | S4 | amba-chi-credit-deadlock (second code block, the formal harness; `:845`) | The sketch has two gaps that a reader who builds it will hit. **(a) The symbolic transaction is keyed on TxnID alone.** The configuration has "two RN-F models", and a TxnID is unique only per Requester, so `comp_for_sym_txnid` can be satisfied by the other RN-F's completion. A retried request may also change TxnID (§2.11), as the bank's own retry item teaches. **(b) Only one channel has a fairness assumption.** `asm_rsp_fair` covers the Home's outbound RSP channel only. With no fairness on the environment's other channels, a model that never returns SNP, REQ or DAT credits makes `ast_done` fail for an environment reason. The SNP assumption must be conditional (the RN-F returns SNP credits once its outbound RSP and DAT can progress, §13.4.1), or it assumes away the very loop the answer describes. | **For (a):** declare `SYM_SRCID` next to `SYM_TXNID`, and either constrain the environment models to resend a retried request with the same TxnID, or have the harness follow the resend. **For (b):** add one line saying that each environment-side channel needs its own §13.4.1-derived fairness assumption: RN-F inbound SNP conditional on outbound RSP and DAT progress; SN-F inbound REQ and DAT; and eventual responses. Each must be conditional in the same way as `asm_rsp_fair`. | IHI0050E.b §2.11 (TxnID may differ on the resend; TxnID reuse after RetryAck); §13.4.1; §14.2.1 |
| 5 | S4 | amba-coherency-scoreboard-design (model answer, "What the bus cannot show"; `:783`) | "Such a master must signal its evictions (C4.2, C4.3; **it uses Evict**, C4.9.1)" is narrower than the spec. A master that supports an external snoop filter can also evict a UniqueClean line with WriteEvict. WriteEvict writes the clean line to a lower-level cache (C4.8.6), and the snoop filter treats the line as evicted (C10.1, Table C10-1). A model that recognises only Evict as a clean-eviction signal would miss WriteEvict. | "...must signal its evictions (C4.2, C4.3): with Evict (C4.9.1), or with WriteEvict for a UniqueClean line written to a lower-level cache (C4.8.6). A snoop filter treats both as evictions (C10.1 Table C10-1)." | IHI0022E C4.8.6; C4.9.1 (Table C4-29); C10.1 and Table C10-1 |
| 6 | S4 | amba-ahb-monitor-pipeline (model answer, "Changes during waits"; `:258`) | "The master may change HTRANS from IDLE to NONSEQ, and in some BUSY cases the address, during a wait (§3.7)" does not list all the permitted changes. §3.7.1 also permits BUSY to SEQ in a fixed-length burst, and BUSY to any type in an undefined-length INCR. §3.7.2 permits address changes during IDLE transfers and after an ERROR response, as in Figure 3-17. The conclusion, "trust only values at the HREADY-high edge", is right, so only the list is incomplete. | "During a wait the master may change HTRANS from IDLE to NONSEQ, or from BUSY to SEQ (and, in an undefined-length INCR, from BUSY to any type). It may change the address during IDLE transfers and after an ERROR response (§3.7.1, §3.7.2)." | IHI0033C §3.7.1; §3.7.2 (Figures 3-13 to 3-17) |

## Round-1 fixes re-verified

All 11 round-1 accuracy findings are resolved, and each resolution matches the source.

| r1 # | Question | Verified against |
|---|---|---|
| 1 | amba-ace-snoop-flow | Table C5-1 (ReadShared is the recommended snoop); the C5.1 Note; Table C5-2 and Table C6-1 (ReadShared row: required change "Shared or Invalid"; ReadClean, ReadNotSharedDirty, ReadShared, ReadUnique and CleanInvalid permitted); C6.3 (the snoop-until conditions); Table C5-8 (snooped UD ends I 1/0, SC 1/1 or SD 0/1) |
| 2 | amba-axi4-lite-stream | B1.1.3 (masters and interconnect drive correct strobes; a slave may use, ignore or reject them; a memory slave must fully support them; an all-strobes-low write after conversion, whose suppression is permitted but not required) |
| 3 | amba-chi-retry-verification | §2.11 (the Requester must record a PCrdGrant that arrives before its RetryAck); §2.11.1 ("in a timely manner"); §2.11.3 (the resend waits for both). The ledger, which flags excess credit only when no request with AllowRetry = 1 is pending, does not fire on legal traffic. |
| 4 | amba-chi-retry-verification | §2.11 ("except for PrefetchTgt, the AllowRetry field must be asserted the first time"); §2.11.2 (AllowRetry is deasserted for PrefetchTgt). No PCrdType is claimed for PrefetchTgt, which is right because the text states none. |
| 5 | amba-coherency-scoreboard-design | Table C1-2 (a silent store to UC); C4.3 (Unique to Shared is permitted but not expected; Clean to Invalid only without an external snoop filter); C4.2; C4.9.1; C4.3.3 (WriteBack and WriteClean); C5.3.5 Table C5-11 (UD or SD to I with PassDirty 0 or 1, so a MakeInvalid snoop may discard dirty data). The author's MakeInvalid correction is right. The one remaining gap is S4 finding 5. |
| 6 | amba-ace-snoop-flow | C1.2.3 (the last two cache state rules). The rewording of `common_mistakes[0]` is accurate. |
| 7 | amba-axi-read-scoreboard-per-id | Table A3-4. `!resp[1]` compares on OKAY and EXOKAY. |
| 8 | amba-bridge-4kb-split | The A3.4.1 Note ("a master must use a burst length that exactly matches the size of the required data transfer") |
| 9 | amba-apb-transfer-basics | The snippet now samples through `vif.mon_cb` and creates a new item per transfer. The §3.1.2 hold list matches. |
| 10 | five items (snippet headers) | Every fragment now starts with `// snippet:`. The definition of `rsp_lcrdv` (the Home's outbound RSP channel) and the conditional `asm_rsp_fair` are sound: the condition `rsp_held < RSP_LCRD_MAX` means the assumption never forces the Home to send. S4 finding 4 covers the rest of the harness. |
| 11 | amba-ace-state-transition-debug | Table C6-1 (CleanUnique and MakeUnique: "Invalid"); Table C4-13 (CleanUnique SC to UC with RRESP 00; legal end states UC or SC with a snoop filter, and I, UC or SC without one); C4.7.1 Table C4-17; C6.2 (the RACK and CRRESP sequencing rules) |

The completeness items applied in round 1 also check out:

- **amba-axi-burst-math case (c).** I worked it by hand through the A3.4.1 equations: Aligned_Address 0x0; beat 1 uses lane 1 only; beat 2 is at 0x2 and uses lanes 2–3, so the strobes are 4'b0010 then 4'b0100. With AxSIZE = 2, lanes 1–3 are active, so 4'b0110 is legal there. The `axi_beat_addr(64'h1, 1, 1, INCR, 2) == 64'h2` example matches.
- **amba-bridge-4kb-split write strobes.** IHI0033C §3.5.2 says strobes for inactive lanes "can be HIGH or LOW", sparse writes are allowed, and a transfer with every strobe low is permitted. The change history confirms write strobes are new in Issue C, and B.b has no HWSTRB. Masking with the active lanes is correct.
- **amba-axi-checker-coverage-plan `other_short`.** The values {2, [4:6], [8:14]} contain no legal WRAP AxLEN (1, 3, 7, 15), so `wrap_illegal` removes them correctly. Every value is a legal FIXED length, so `fixed_long` correctly leaves them in.

## Verified correct this round (selected)

- **APB.**
  - §1.1: not pipelined; at least two cycles per transfer.
  - §2.1: PWDATA is at most 32 bits.
  - §3.1.2: the hold list while PREADY is low, and PREADY may take any value while PENABLE is low.
  - §3.2: PSTRB must be low on reads. Table 3-1: compatibility.
  - §3.4: PSLVERR is valid only in the last cycle; driving it low elsewhere is recommended, not required; an errored write may have changed state.
  - §3.4.3: PSLVERR mapping. Table 3-2: PPROT polarities.
  - §4.1: SETUP lasts one cycle; ACCESS goes directly to SETUP when another transfer follows.
- **AHB (Issue C).**
  - Table 3-1: zero-wait OKAY for IDLE and BUSY; BUSY shows the next beat; only an undefined-length burst may end with BUSY.
  - §3.6.1: no BUSY directly after a SINGLE.
  - §3.6.2: cancelling after ERROR is optional; HTRANS is IDLE when the master cancels; there is no need to rebuild the burst; multi-layer termination.
  - Table 3-4: HBURST encodings, including the `ahb_known_beats` table.
  - §4.2: sample only when HREADY is high; 1KB minimum region. §2.4 Note: retimed multiplexor select.
  - §5.1.3: the two-cycle ERROR, with OKAY during the waits before it. I re-traced both ERROR properties.
- **AXI.**
  - A3.2.1: there must be no combinatorial input-to-output paths.
  - A3.3.1: every read and write dependency bullet, and the Caution.
  - Table A3-4, and the rule that every transfer is completed even after an error.
  - DECERR: routing to a default slave is recommended.
  - A5.3: the same-AWID completion order. A5.3.1: read interleaving and the interconnect's duty for same-ID reads across slaves. A5.3.2: W forwarded in address order, even across masters and IDs. A5.3.4: read-after-write needs a completed earlier transaction.
  - A5.3.5 and A5.3.6: ID extension and the recommended widths. A5.4.1.
  - A4.3.2 and its Note: no read-write ordering unless one direction waits for the other's response, so (d) in `amba-axi-id-ordering` holds.
  - A4.4.1: both Device types are Non-modifiable; they behave the same for reads; no prefetch; no merge.
  - Table A4-5, Table A4-6, A8.1.1, A8.1.2, A10.3.7.
  - A7.2.1 to A7.2.4: the restrictions, the 128-byte monitor granularity, and "must not start the write part ... until the read part is complete".
  - B1.1: burst length 1; 32 or 64 bits; Non-modifiable and Non-bufferable; no exclusives; no EXOKAY; AxCACHE 0b0000.
- **ACE.** Covered in the round-1 table above. In addition: C4.6.1 (CleanUnique response bits) and C4.7.1 (MakeUnique only with a full-line store).
- **CHI.**
  - §1.6 (all node definitions as stated) and §1.7 (data sources, DMT, DCT and DWT).
  - §2.11: the resend-field list; TxnID reuse after RetryAck; no fixed credit-to-transaction binding; the 1024 limit; the CopyBack options; starvation prevention in §2.11.2.
  - §3.3.1: resend TgtID; PCrdReturn TgtID.
  - §13.4.1: the RN and SN rules. §14.2.1: 1 to 15 L-Credits; a credit cannot be used in the cycle it arrives.
- **AXI4-Stream.** §2.2.1, Table 2-2, §2.4.1 (an all-null transfer may be suppressed unless TLAST is high), §2.5 and §2.6.
- **Code.** By inspection, every block is legal IEEE 1800-2023 and does what its answer says, apart from the two harness gaps in finding 4. I checked:
  - the associative-array-of-queues scoreboard;
  - the named-member assignment pattern in the exclusive model;
  - the covergroup `@(posedge aclk iff ...)` event and the `! binsof(...) intersect` selects;
  - the 64-bit context of `len + 1`;
  - the `uvm_error` macros used as `if` bodies;
  - `localparam` in a class;
  - automatic initialisers in class methods.

## Requests for the lead

1. **Still open: B-AMBA-F2 `index.mdx:158`.** It still reads "a cache may discard a Shared copy *without telling anyone*". This disagrees with IHI0022E C1.2.3, C4.2 and C4.3:
   - C1.2.3 only removes the duty to inform other caches.
   - A SharedDirty copy must still be written back or have its dirtiness passed on.
   - A master that supports an external snoop filter must signal its evictions with Evict, or with WriteEvict for a UniqueClean line (C4.9.1, C4.8.6).

   The author log's suggested wording stands. Pass to the B-AMBA-F2 author.
2. **Still open (optional): B-AMBA-F2 `index.mdx:697`.** After "The first attempt is sent with AllowRetry asserted", add "except PrefetchTgt, which has no response, is never retried and is sent with AllowRetry deasserted (IHI0050E.b §2.11, §2.11.2)".
3. **No new lesson disagreements.** For findings 1 and 2 the lessons already agree with the spec (B-AXI-4 `:366` and `:896` for A7.2.5; B-AXI-2 `:811` and B-AXI-4 `:680–681` for the Non-modifiable exceptions). Only the bank needs to change. B-AMBA-F2 `:685` quotes §4.11.1 without the "one exception" claim, so finding 3 is bank-only too.
4. **Citation tooling.** WebFetch cannot read Arm specifications: developer.arm.com redirects to support.arm.com, whose pages render only with JavaScript. For future accuracy passes, keep the local copies of the cited issues as the verification standard.
