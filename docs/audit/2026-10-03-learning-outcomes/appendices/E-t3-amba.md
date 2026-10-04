> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# T3 AMBA Track Audit (B-AMBA-1/2, B-AHB-1..3, B-AXI-1..6, B-AMBA-F1..F3)

Audit date 2026-10-03. Repo main @ 488f7f43. Read-only. No repository files were changed.

Scope: 14 module `index.mdx` files. None of these modules has sub-lesson .mdx files; each directory holds only `index.mdx`. Also in scope: 14 flashcard decks, `content/interview-questions/amba-protocols.json`, 9 interactives plus `ProtocolWaveform` with `src/lib/wavedrom.ts` and `src/lib/axi-dependency-model.ts`, and 4 labs (`ahb_checker`, `axi_deadlock`, `axi_scoreboard`, `ahb_axi_bridge`).

---

## 0. Verification log (what was checked against primary sources)

| Source | How obtained | Used to verify |
|---|---|---|
| **ARM IHI 0033B.b, "AMBA 5 AHB Protocol Specification AHB5, AHB-Lite"** | Fetched from `documentation-service.arm.com/static/5f91607cf86e16515cdc3b4b`; text extracted locally from the PDF streams | 1KB rule (§3.5 Burst operation). Address phase "Lasts for a single HCLK cycle unless its extended by the previous bus transfer" (§3.1 Basic transfers). §3.5.2 Early burst termination. §3.6.1 Transfer type changes during wait states. §3.6.2 Address changes during wait states, including "After an ERROR response". §5.1.3 ERROR response and Table 5-2. Reset text: "During reset all masters must ensure … HTRANS[1:0] indicates IDLE". IDLE/BUSY get a zero-wait OKAY. 16-wait-state recommendation. Alignment of all transfers in a burst. §8.3/§8.4 exclusive (HEXCL). Section titles: §3.3 = Locked transfers, §3.7 = Protection control. |
| **ARM IHI 0022E, "AMBA AXI and ACE Protocol Specification"** (AXI3/AXI4/AXI4-Lite, ACE) | Fetched from `documentation-service.arm.com/static/5f915b62f86e16515cdc3b1c`; text extracted locally | A3.2.1 Handshake process. A3.3 (write data may appear before write address). A3.3.1 Dependencies (master must not wait for AWREADY/WREADY; slave may wait for AWVALID and/or WVALID; AXI4 write-response dependency). A3.4.1 Address structure (4KB rule and rationale, WRAP length 2/4/8/16, no early termination). WSTRB "HIGH only for byte lanes that contain valid data". A5.3.1 read ordering, A5.3.4 read/write interaction (no ordering even with the same ID), A5.3.5 interconnect ID extension, A5.4 removal of write interleaving. A6.2/A6.3 AXI4 ordering model. A7.2.2–A7.2.4 exclusive access, including an OKAY to an exclusive read meaning "not supported", and the restrictions. A4.3 AxCACHE. **In Issue E, ACE is Part C and Part D is Appendices.** |
| Secondary sources (Arm community, vlsiverify, readthedocs avl-axi) | WebSearch | Corroborated that for unaligned INCR bursts, every beat after the first is aligned to the transfer size |
| IHI 0022H (cited by the lessons), IHI 0050F (CHI) | Not obtained | **Unverified:** the section numbers the lessons cite for H, all CHI claims, and "ACE is Part D of IHI0022H" (F2 L50) together with "§D3/§D4/§D8". Rules were checked against Issue E. AXI4 handshake, burst, ordering and exclusive rules did not change normatively in later issues, as far as I know (Medium confidence). |

The APB spec (IHI0024C) was not checked.

---

## 1. Cross-cutting findings (highest impact first)

| ID | Category | Evidence | Learner consequence | Sev | Conf | Correction / Acceptance |
|---|---|---|---|---|---|---|
| **X1** | Confirmed defect | AHB bursts are taught as able to cross 4KB legally. **F1** L17 says AXI "enforces a 4KB boundary rule that AHB does not". L50 table: "4KB Boundary \| No enforcement". L107: "AHB has no such restriction". The worked example L109-116 (AHB 0x0FE0, 8×8B) and Quiz Q1 L340-348 (AHB INCR 0x0FE0, 8×4B) are illegal AHB bursts. **F3** L68, L78-79, L198 repeat this. **BridgeTranslationExplorer.tsx** scenarios at L49-56 use AHB INCR bursts at 0x0FF0 and 0x0F80 that cross 0x1000. **Lab README** `labs/ahb_axi_bridge/.../README.md` L5 says "An AHB master may legally issue a burst that crosses a 4KB page boundary", and Debug Q1 asks "Why is an AHB burst allowed to cross 4KB". The bank `amba-bridge-4kb-split` and the F1 flashcard say the same. | This contradicts AHB-2 L259 and the spec (IHI0033B.b §3.5: "Masters must not attempt to start an incrementing burst that crosses a 1KB address boundary"). Every 4KB boundary is also a 1KB boundary, so a legal AHB burst can never cross 4KB. The flagship bridge module, lab, and visual teach a false premise. Learners would build bridges and checkers around an impossible input and miss the real split reasons: undefined-length INCR longer than 256 beats, merging of AHB singles into one AXI burst, and AXI→AHB 1KB splitting. | **S1** | High (primary source) | Reframe AHB→AXI splitting around the real causes: AXI 256-beat cap and width conversion. Add the AXI→AHB direction, where an AXI INCR must be split at 1KB. Treat AHB inputs crossing 1KB as illegal stimulus and add an assertion for it. Acceptance: no lesson, lab, visual, flashcard or bank item presents an AHB burst crossing 1KB/4KB as legal. The lab adds a negative test where the AHB-side checker fires on a 1KB crossing. |
| **X2** | Confirmed defect | AXI W-before-AW is misstated as illegal. **AXI-1** L275: "Write data must not complete before the write address". This contradicts its own note at L218 and IHI0022E A3.3: "the write data can appear at an interface before the write address". The AXI4 dependency "BVALID only after the AW handshake and the WLAST handshake" (A3.3.1 "AXI4 write response dependency") appears in **no lesson**. AXI-1 L276 and F3 L237-239 mention only the W dependency. It is taught only in the `axi_deadlock` lab (`axi_deadlock_checker.sv` L34). | Learners will write monitors and checkers that flag legal W-first traffic. Their monitors will also assume AW arrives first; see AXI-6, where the monitor keys W on AW. They will also not know the B-after-AW obligation they must check. | **S1** | High | Replace L275 with the spec dependency list (A3.3.1), including the AXI4 B-after-AW rule. Add a W-before-AW scenario to AxiChannelHandshakeVisualizer. Acceptance: the AXI-1 rule list matches A3.3.1. A quiz item asks whether BVALID may assert before AWREADY when all W beats are already done (answer: no). |
| **X3** | Confirmed defect | Contradictory answers to the canonical trick question. **F3** L221-223 answers "Can an AXI master wait for AWREADY before asserting WVALID?" with "It depends on the full dependency graph". **AXI-5** L35 and IHI0022E A3.3.1 ("the master must not wait for the slave to assert AWREADY or WREADY before asserting AWVALID or WVALID") say No. The F3 flashcard also says No. | The interview-prep module gives the wrong answer to the most common AXI interview question. | **S2** | High | Answer "No — protocol violation (A3.3.1); the slave, however, may wait for WVALID before AWREADY". Acceptance: F3, AXI-5, the flashcard and the bank agree. |
| **X4** | Confirmed defect | **4KB checks fire on legal bursts.** AXI-2 SVA L216-225, F3 L160-164, AXI-5 `check_4kb_boundary` L129-137 and F1 `p_no_4kb_violation` L245-250 all omit AxBURST. A legal WRAP4×4B at 0x0FFC, or a FIXED burst near 0xFFC, fails `addr[11:0]+((len+1)<<size) <= 0x1000`. All of them also use `AxADDR + total` rather than the aligned start, so unaligned INCR bursts that end exactly at 4KB are false failures (e.g., 0x0FFE, size 2, len 0). AHB-2 L271-275 and AHB-3 L201-205 have the same problem for 1KB, where WRAP bursts are legal anywhere. | Learners copy checkers that fail legal traffic, and are taught that WRAP/FIXED bursts are subject to the INCR crossing math. AXI-2 L205 itself says WRAP cannot cross. | S2 | High | Gate on `AxBURST==INCR` (AHB: incrementing HBURST, including undefined INCR checked per beat) and compute from `aligned_addr`. Acceptance: SVA unit tests pass legal WRAP at the page edge, FIXED at 0xFFC, and unaligned INCR ending at 0xFFF; they fail INCR crossing by one byte. |
| **X5** | Confirmed defect | **The AHB two-cycle-ERROR assertion cannot catch the single-cycle ERROR it is meant to catch.** AHB-2 L179-182, AHB-3 L180-183 and the `ahb_checker` solution L95-99 all use `(HRESP && !HREADY) \|=> (HRESP && HREADY)`. A slave that drives ERROR for one cycle with HREADY high never satisfies the antecedent. The lab's broken DUT (`testbench.sv` L158-169) does exactly that: `bus.HRESP <= 1'b1` while `HREADY = !inserting_wait`. Lab README Part 3 claims "at least two assertions fire, identifying both injected bugs". Bug A (HWDATA sampled during wait states) is internal and invisible to the pin-level assertions supplied. | The lab's success criterion cannot be met, and learners conclude their checker is correct when it is blind to the bug. F3 L269 even asks how to detect this exact bug. | **S1** | High | Add `(HRESP && HREADY) \|-> $past(HRESP && !HREADY)` (with the $past also gated) plus "OKAY during wait states" (spec Table 5-2). Detect Bug A with a scoreboard or read-back check. Acceptance: in BROKEN_MODE=1 the new property fires on Bug B and a data mismatch is reported for Bug A. Run this in CI with a simulator, e.g., Verilator `--assert` or a commercial tool. |
| **X6** | Confirmed defect | **The AHB stability assertions fire on legal behavior.** AHB-3 `p_ctrl_stable` L169-173 requires `$stable(HTRANS)` during wait states, and F3 L122-125 uses `!HREADY \|=> $stable({HADDR,HTRANS,…})`. IHI0033B.b §3.6.1/§3.6.2 permits, during waited transfers: IDLE→NONSEQ, BUSY→SEQ (fixed-length), BUSY→any type (undefined INCR), address change for IDLE, and address change "after an ERROR response". §3.5.2 says a master that cancels after ERROR "must change HTRANS to indicate IDLE during the two-cycle Error response". AHB-2 L112 itself teaches that cancellation. | The checker flags spec-mandated cancellation and legal BUSY handling. Learners also never learn the exception list. | S2 | High | Encode the §3.6.1/§3.6.2 exceptions. Acceptance: tests where a cancel-after-ERROR sequence passes and a NONSEQ→SEQ change with a new address during a wait state fails. |
| **X7** | Confirmed defect | **Unaligned/narrow AXI byte-lane model is wrong in three places.** `AxiMemoryMathVisualizer.tsx` L45-46 uses `addr = start + i*bytesPerBeat` for INCR. Its own "Unaligned Start" preset (0x1003, size 4) produces 0x1003/0x1007/0x100B/0x100F; the spec gives 0x1003/0x1004/0x1008/0x100C, with all beats after the first aligned. AXI-2 `calculate_wstrb` L145-157 sets lanes start..start+size-1 even past the size-aligned container: 0x1001, size 4 on a 64-bit bus gives lanes 1-4 instead of 1-3. AXI-5 L147-149: "2 bytes starting at 0x1 → WSTRB must be 4'b0110". With AxSIZE=1 the container is 0x0-0x1, so only lane 1 is valid; 0110 is legal only with AxSIZE=2, as a sparse strobe. The AXI-2 flashcard has this right. AXI-2 L24 calls WSTRB "derived from address alignment and transfer size", but WSTRB may be any subset of the active lanes (IHI0022E: "HIGH only for byte lanes that contain valid data"). | Learners build WSTRB checkers that require equality, which is wrong for sparse strobes, and drivers that generate wrong lanes for unaligned starts. That is exactly the narrow/unaligned competency in the brief. | **S2** | High | Implement the spec equations (Aligned_Address, Address_N, Lower/Upper_Byte_Lane) in a shared, tested TS util. The visualizer and lesson tables should use it. A checker should enforce `WSTRB ⊆ active_lanes`. Acceptance: Vitest cases for unaligned INCR, narrow WRAP and FIXED; the lesson table is regenerated from the util. |
| **X8** | Interaction/design weakness | **Prev/Next navigation contradicts the authored order.** `findPrevNextTopics` (`src/lib/curriculum-data.tsx` L1081-1101) walks `curriculumData`, which `scripts/generate-curriculum-data.ts` L115 builds with alphabetical `.sort()`. It ignores frontmatter `order`: AMBA-1=1, AMBA-2=2, AHB 3-5, AXI 6-11, F 12-14. The "Next" chain is A-UVM-8 → **AHB-1** → AHB-2 → AHB-3 → **AMBA-1** (intro) → AMBA-2 → **F1 bridges → F2 ACE/CHI → F3 interview** → AXI-1 … AXI-6. AMBA-2 L106 says "next module… AHB", but its Next button goes to F1. | Learners reach AHB before the family intro, and bridges, coherency and the interview clinic before any AXI lesson. | S2 | High | Sort by frontmatter `order`, or rename the directories. Acceptance: a Playwright `curriculum-nav` test asserts the AMBA Next chain AMBA-1→AMBA-2→AHB-1…→AXI-6→F1→F2→F3. |
| **X9** | Missing coverage | Normative topics absent from every lesson (grep across all 14 modules): AXI4 removal of write interleaving and WID (A5.4; mentioned only in the AXI-3 flashcard); read-data interleaving across IDs; AxREGION and AxUSER; AXI3 vs AXI4 AxLOCK (locked transfers removed); AXI5 atomics (AWATOP) despite the AXI-4 title "…& Atomics"; AXI4-Lite rules beyond "no bursts"; the AHB-Lite vs AHB5 distinction (HNONSEC, HEXCL/HEXOKAY, HMASTER); the absence of SPLIT/RETRY in AHB-Lite; AHB early burst termination (§3.5.2); BUSY rules; slave sampling with `HSEL && HREADY` (flashcard only); IDLE/BUSY needing a zero-wait OKAY (flashcard only). | A learner cannot build complete checkers or stimulus for these spaces. | S2 | High | Add short normative sections, each with one predict question. |
| **X10** | Missing coverage | **No AXI or AHB UVM driver, sequencer, sequence or randomized-READY slave model exists anywhere in the track or its labs** (grep: no `uvm_driver`; A-UVM-7 VIP Construction uses APB). Every lab drives pins with hard-coded `<=` and `ARREADY=RREADY=1` (e.g., `axi_scoreboard/testbench.sv` L112-114). No covergroup covers ID × burst × resp × backpressure for AXI; AXI-6 has no coverage section at all. | The track cannot produce the target outcome of building an agent with stimulus. See §4. | S2 | High | See §4. |
| **X11** | Confirmed defect | **Section citations are wrong or unverified.** Interview bank `amba-ahb-hready-hreadyout` cites "IHI0033B §3.3", which is *Locked transfers*. `amba-bridge-4kb-split` cites "IHI0033B §3.7", which is *Protection control*. "IHI0022H §A8 (ID signaling)", "§A10 (ordering)", "Part D §D3/§D4/§D8" (bank and F2 L232/L239) are unverified; in Issue E, IDs are in A5, the ordering model in A6, and ACE in Part C. AHB-1/AHB-2 frontmatter cite "Arm AMBA 3 AHB-Lite Protocol Specification, IHI0033B", but IHI0033B is the AMBA 5 AHB spec and AMBA 3 AHB-Lite is IHI0033A. | Erodes trust and sends learners to the wrong clauses. | S3 | High (IHI0033B items, Issue-E structure), Low-Med (Issue H numbering) | Verify every citation against the PDF named in frontmatter, or drop the clause numbers. Acceptance: a citation-lint script checks each `§` against a curated index. |
| **X12** | Interaction/design weakness | Protocol requirements vs design policy. **Done well:** AXI-5 (L12-19, L64-73), the `axi_deadlock` lab and README, AXI-3 L51 (outstanding depth is a design parameter), and the `ahb_checker` lab.json L27. **Not done:** AHB-3 checker L188-196 and Quiz Q2 L476-485 list the HREADY timeout as an "essential protocol assertion". The ahb_checker README L32 calls it a protocol property, contradicting its own lab.json. AHB-2 L49 says "The AMBA spec recommends … a configurable timeout counter"; the spec only recommends ≤16 wait states. AHB-2 L201-202 says "Production rule: … forcibly revoke the grant after a timeout", which would break lock atomicity. AXI-4 L126-130 presents an "exclusive write must be preceded by exclusive read" SVA as protocol, but an unpaired exclusive write is legal and simply fails. AXI-3 L159-163 presents a read-after-write ordering SVA that asserts a guarantee A5.3.4 explicitly does not give. The `axi_scoreboard` solution monitor raises `uvm_error` on SLVERR/DECERR (L108-109), which mixes protocol monitoring with test policy. | Learners cannot tell checker obligations from integration policy. | S2 | High | Tag every assertion as [Protocol §x] or [Integration policy]. Acceptance: each SVA block in the track carries a tag, and the quiz answers are consistent. |
| **X13** | Interaction/design weakness | Checker vs scoreboard responsibilities are never separated explicitly. AHB-3 L452-459 has a 4-layer table, which is good. No AXI module states what belongs in the checker (handshake, dependencies, LAST, ID-existence, 4KB, WRAP legality, exclusive constraints) versus the scoreboard (data, per-ID ordering vs a reference, read-after-write ambiguity, error-response semantics). | Learners put ordering in SVA (AXI-3 L245-255) and protocol checks in monitors. | S3 | Med | Add a responsibility matrix to AXI-6. |

---

## 2. Per-module audit

Coverage scale: 0 = absent, 1 = shallow or recall only, 2 = substantive with an exercise. Competencies are E=Explain, P=Predict, A=Apply in code, D=Debug misuse, T=Transfer.

### B-AMBA-1 Protocol Families & Tradeoffs (118 lines)
- **Inventory:** H2s are Why standard buses; Family tree; Key terminology; Design tradeoffs. Interactive: `AmbaFamilyExplorer` (static tabbed fact cards, no task). 3 MCQ. Flashcards `B-AMBA-1_…` (5). No labs. No prerequisite or next links in frontmatter; nav issue X8.
- **Coverage:** E1 (L37-54, table L78-85). P0. A0. D0. T1 (Q3 L107 picks a protocol for a use case).
- **Accuracy:**
  - L81 "Channels: AHB-Lite 1 (Multiplexed)". AHB has separate HWDATA and HRDATA buses with a pipelined address/data phase, not one multiplexed channel. S4, High.
  - L54 "slaves can return responses out of order" needs "for different IDs only". S4.
  - L66 omits EXOKAY from the response list. S4.
  - L25 "scales exponentially" should be quadratic. S4.
- **Requirement vs policy:** n/a.

### B-AMBA-2 Intuition & Memory Hooks (142 lines)
- **Inventory:** H2s are Shared-bus analogy; Point-to-point analogy; Mail-delivery hook; VALID/READY; Summary. `ProtocolAnalogyExplorer` steps strictly AW→W→B. 3 MCQ. Flashcards (5). No `tier` frontmatter.
- **Coverage:** E1. P0. A0. D0. T0.
- **Accuracy:**
  - L53 "These three actions happen independently". B depends on the AW and WLAST handshakes, and R on AR. The analogy plants the misconception behind X2. S3, High.
  - L104 and the explorer imply the label (AW) precedes the box (W), which reinforces "W after AW". S3.
  - L95 states the VALID-hold rule but omits "VALID must not depend on READY" and "READY may wait for VALID". S4.
  - L34-36 "stalls the entire system / terrible for high-performance" ignores multi-layer AHB. S4.

### B-AHB-1 Design & Timing (158 lines)
- **Inventory:** Signal taxonomy; Pipelining; Wait states; Burst types; Summary. 2 `ProtocolWaveform` plus `AhbPipelineBurstVisualizer` (4 fixed playback scenarios: single, pipeline, wait, INCR4). 3 MCQ. Flashcards (10, the best AHB facts are here). Source metadata is mislabeled (X11).
- **Coverage:** E2 (L55-102). P1 (Q2 L137). A0. D0. T0.
- **Accuracy:**
  - **AHB1-1 (S2, High).** The wait-state waveform L87-98 is wrong. `HREADY "101.1..."` puts the low cycle in A's *address* phase, not its data phase. HWDATA `"xx..=x.."` shows Data A only in cycle 4 and never shows Data B. The data list contains an unused "C". The caption claims behavior the diagram does not show. The visualizer (L78-106) models it correctly, so the two visuals contradict each other.
    - Fix: HADDR `x=B.C`, HWDATA `xx==.=`, HREADY `11011`.
    - Acceptance: a WaveDrom-spec unit test asserts that the HREADY=0 cycle coincides with the extended data phase.
  - AHB1-2 (S3). L58 "Address Phase: Lasts exactly one clock cycle" contradicts L85 and §3.1 ("unless its extended by the previous bus transfer").
  - AHB1-3 (S3). L100-102 says the master must hold address and control while HREADY is low, with no exceptions (see X6).
  - AHB1-4 (S3). The section never teaches that a slave samples address/control only when `HSEL && HREADY` (it is in a flashcard only). No HBURST encoding table, no BUSY semantics, no HRDATA/read timing, no 1KB rule here.
- **Requirement vs policy:** n/a.

### B-AHB-2 Pitfalls & Deadlocks (382 lines)
- **Inventory:** HREADY pitfalls; Two-cycle ERROR; Arbitration deadlocks; Boundary violations; Reset; Summary. 1 waveform. 3 MCQ. Flashcards (5).
- **Coverage:** E1. P1 (L264-267 1KB example). A1 (SVA). D2 (buggy-vs-correct RTL L38-82, L135-173). T0.
- **Accuracy:**
  - X5. The ERROR assertion L179-182 cannot catch Pitfall 2A. S1.
  - AHB2-1 (S3, High). L49 says "The AMBA spec recommends that every slave include a configurable timeout counter". The spec says "recommended that slaves do not insert more than 16 wait states" (IHI0033B.b), with exceptions such as boot ROM.
  - **AHB2-2 (S2, Med-High).** The priority-inversion scenario L223-231 and Quiz Q3 L371-381 are incoherent. In AHB the arbiter must not re-grant during a locked sequence (§3.3 Locked transfers; AMBA 2 arbitration). With fixed priority, M2 outranks M1, so M1 cannot be "kept granted" over M2. The Mars Pathfinder bug was an OS mutex issue. The quiz enshrines the flawed model.
  - AHB2-3 (S3). The lock watchdog L204-218 counts `HMASTLOCK && HREADY`, i.e., transfers. It therefore misses the stated "many wait states" scenario, where HREADY is low. The advice to "forcibly revoke the grant" breaks atomicity; label it as policy.
  - AHB2-4 (S3, High). The 1KB SVA L271-275 false-fires on WRAP (X4). `burst_total_bytes` is undefined, and undefined-length INCR cannot be checked this way; a per-beat `HADDR[31:10]` stability check on SEQ is needed.
  - AHB2-5 (S3, Med). L280 says a crossing burst is "decoded to the *first* slave for all beats". The decoder decodes every address phase. Per the spec rationale, the second slave would see a burst starting with SEQ.
  - AHB2-6 (S3, High). The alignment SVA L290-292 uses a non-constant part-select `HADDR[size_mask(HSIZE)-1:0]`, which is illegal SV. It checks only NONSEQ and frames alignment as "burst start". The spec says "All transfers in a burst must be aligned".
  - AHB2-7 (S3, High). The reset SVA L313-316 (`$rose(HRESETn) \|-> ##[0:2] HTRANS==IDLE`) checks the wrong thing. The spec rule is IDLE *during* reset, and HREADYOUT high during reset.
  - AHB2-8 (S3). L238-251: "AHB requires a default master" and an assertion that the default master always drives IDLE. A default master may be a real master. The livelock described is really a slave violating "zero-wait OKAY to IDLE", and the lesson never says so.
  - AHB2-9 (S4). The two-cycle ERROR waveform L115-127 holds HADDR=A through the first ERROR cycle instead of showing the pipelined transfer B being cancelled to IDLE, which is the point of the section.
  - AHB2-10 (S3). The module cites the AHB-Lite spec but discusses multi-master arbitration (HBUSREQ/HGRANT are AMBA 2 AHB and absent from AHB-Lite) without saying so.
- **Requirement vs policy:** weak. Timeouts, lock limits and grant-after-reset rules (L201, L327) are presented as "production rules" mixed with spec rules.

### B-AHB-3 Verification (503 lines)
- **Inventory:** Transaction modeling; Monitor; Checker; Coverage; Scoreboard; Debug patterns; Interview Q&A; Summary; Hands-on lab. No interactive. 3 MCQ. Flashcards (5). Lab `ahb-checker-lab`.
- **Coverage:** E1. P0. A2 (L30-389 plus lab). D1 (L397-419). T1 (L427-446).
- **Accuracy:**
  - X5 and X6 (the checker L159-185).
  - AHB3-1 (S3, High). The coverage code does not compile. `ahb_wait_state_cg` L308-319 crosses `cp_burst`, and `ahb_error_cg` L325-336 crosses `cp_write` and `cp_burst`, but neither covergroup defines those coverpoints. `cp_burst` L286-293 omits WRAP16/INCR16. There is no BUSY, HTRANS-transition, error-mid-burst or early-termination coverage.
  - AHB3-2 (S3, High). The scoreboard L363-387 keys `shadow_mem` by byte address. A byte write at 0x1001 and a word read at 0x1000 never meet, and full 32-bit compares on narrow reads are wrong. `apply_strobe` is undefined; AHB has no strobes, so lanes come from HSIZE/HADDR. It ignores error-response write semantics (a policy decision that is not discussed).
  - AHB3-3 (S4). L400 says "the arbiter's HSEL signal". HSEL comes from the decoder. L410 says "Go back two cycles", which is only valid with no OKAY wait states before the ERROR.
  - AHB3-4 (S3). The interview Q2 L433 rationale for 4KB vs 1KB is invented. Spec: 1KB is the minimum slave region (§4); the AXI 4KB rule "prevents a burst from crossing a boundary between two slaves… limits address increments" (A3.4.1). Q3 L435-442 repeats AHB2-2.
  - AHB3-5 (S3). Quiz Q2 L476-485 marks "HREADY timeout" and "IDLE after reset" as essential protocol assertions (X12). Missing assertions include: SEQ address = previous + size; HBURST/HSIZE/HWRITE constant within a burst; fixed-length burst beat count; BUSY only inside bursts; no BUSY after SINGLE; IDLE/BUSY get a zero-wait OKAY; HRESP OKAY during wait states; HREADYOUT high during reset.
  - AHB3-6 (S4). L461 says "next module… lab"; the next module per nav is AMBA-1 (X8).
- **Lab `ahb_checker`:** self-attested. README Part 2 lists the timeout as a protocol rule, contradicting lab.json L27. X5 means the Part 3 success criterion is unattainable. The solution checker copies the flawed properties.

### B-AXI-1 Channel Architecture & Handshake (369 lines)
- **Inventory:** Five channels; VALID/READY; Combinational loops; Write flow; Read flow; Independence/backpressure; Reset; Summary. 4 waveforms plus `AxiChannelHandshakeVisualizer` (4 fixed scenarios; all have AW before W; no outstanding transactions, IDs, or READY-before-VALID). 4 MCQ. Flashcards (5).
- **Coverage:** E2. P1 (three scenarios). A1 (SVA L160-170, L297-306). D0. T0.
- **Accuracy:**
  - **AXI1-1 (S2, High).** The canonical handshake waveform L65-78 is wrong. VALID is high in cycles 1-4 and READY in cycles 2-3, so **two** handshakes occur (edges after cycles 2 and 3), yet "Transfer" marks one. VALID then stays high in cycle 4 without READY and drops in cycle 5, which withdraws an offered transfer. The canonical figure therefore depicts a protocol violation.
    - Fix: VALID `01..0`, READY `0..10`.
    - Acceptance: a test parses each AXI WaveDrom spec and checks that VALID never falls without a handshake and that the number of handshakes matches the labelled transfers.
  - AXI1-2 (S3, High). In "Three legal orderings" L93-116, the Scenario B waveform (READY rising in the same cycle as VALID) is identical in relationship to Scenario C. READY-before-VALID is never actually shown.
  - AXI1-3 (S3, High). In the write-flow waveform L207-211, BRESP "OK" is in cycle 5 while BVALID is high in cycle 6, so BRESP is X at the handshake.
  - X2 (L275-279, S1). L219 says "the spec allows interleaving", which is the wrong term (interleaving refers to W beats of different IDs, removed in AXI4 per A5.4). L279 "Different transactions… can interleave freely" is wrong for AXI4 W.
  - AXI1-4 (S3, High). The `p_valid_stable` SVA L160-162 triggers only on `$rose(valid)`. It misses back-to-back transfers where VALID stays high, and it checks no payload stability. Use `valid && !ready \|=> valid && $stable(payload)`, as AXI-5 L57-61 does correctly.
  - AXI1-5 (S3, High). Reset L289-293 inverts terminology: "When ARESETn is deasserted (low)… after ARESETn is asserted (high)". It also says "wait at least one clock cycle". The spec allows VALID high at a rising edge after ARESETn is HIGH. "Asynchronous reset protocol" omits that deassertion is synchronous.
  - AXI1-6 (S4). L145 says "synthesis generates a latch"; the real result is a combinational loop. The summary row "Outstanding txns: AHB 1" is acceptable.
- **Requirement vs policy:** L218-219 ("most practical designs send AW first") is the only nod to it.

### B-AXI-2 Burst Math (318 lines)
- **Inventory:** Burst parameters; Address calculation; WSTRB; 4KB rule; Narrow transfers; Summary. `AxiMemoryMathVisualizer` (editable address, len ≤ 15, size, burst, bus width; presets). 4 MCQ. Flashcards (10).
- **Coverage:** E2. P2 (computational quizzes L275-317 plus the editable visualizer). A1 (wstrb function, SVA). D1 (L169-171). T0.
- **Accuracy:**
  - **AXI2-1 (S2, High).** In the "ILLEGAL" example L210-211 (`0x0FF0`, AxLEN=3, AxSIZE=2: "End = 0x0FFF + 1 = 0x1000 → crosses"), the last byte is 0x0FFF, so the burst is **legal**. This contradicts the module's own formula L193-200, F3 Quiz Q2 L291-299 (which correctly says legal), and F3 L233-235. Learners get opposite answers to the same question.
  - X4: the SVA L216-225.
  - X7: the wstrb function L145-157, L24, the visualizer.
  - AXI2-2 (S3). The visualizer caps AxLEN at 15 (`max={15}`), so AXI4 INCR up to 256 cannot be explored. It does not flag a WRAP length outside {2,4,8,16} or an unaligned WRAP start as illegal (only an "Unaligned" badge).
  - AXI2-3 (S4). L181 "most commonly violated rule… countless silicon bugs" is unsupported. L185-187 rationale differs from A3.4.1 (which is about crossing slave boundaries and incrementer size).
  - Missing: the unaligned-transfer address equations; RDATA lanes for narrow reads; FIXED length limit (AXI4: up to 16); "no early termination; deassert strobes instead" (A3.4.1).

### B-AXI-3 Ordering & IDs (328 lines)
- **Inventory:** Outstanding; IDs; Same-ID; Different-ID; Read/Write ordering; Interconnect ID mgmt; Verification strategy; Summary. `AxiIdOrderingVisualizer` (4 fixed playbacks; R shown as a single event with no beats or interleaving; B shown without W). 3 MCQ. Flashcards (5).
- **Coverage:** E2. P2 (Q1/Q2). A1 (non-compiling skeleton). D0. T1 (interconnect L184-196).
- **Accuracy:**
  - AXI3-1 (S3, High). L102-106 lists "Write-then-read verification" as a same-ID ordering benefit. That contradicts §5 L138 and A5.3.4 ("even if the ARID… is the same as the AWID").
  - **AXI3-2 (S2, High).** The scoreboard L210-238 does not compile and is conceptually wrong:
    - It uses `ahb_transaction` queues but pops into `axi_txn`.
    - It matches B to the expected transaction via `b_txn.matched_addr`, but B carries no address.
    - Reads pop only on RLAST with no beat accumulation and no data compare.
    - It ignores R interleaving across IDs.
    - It reads a missing associative-array key.
    - The ID-aware OoO scoreboard is the core competency, and the lesson's reference code would not run.
  - AXI3-3 (S3). The `p_war_ordering` L159-163 uses `before`, which is not an SVA operator, and asserts a non-guarantee (X12). `p_write_order` L245-249 uses undefined objects.
  - AXI3-4 (S3, Med). In L188-191 ("Interconnect MUST deliver A before B") with the same ID to different slaves, the A6.2/A6.3 obligation is response order. Arrival order is required only for Device memory or same/overlapping addresses (A6.2). The lesson never distinguishes Device from Normal.
  - AXI3-5 (S4). L33 says "In AHB, a master must wait for the current transfer to complete before starting the next", which contradicts pipelining. L26 "merge, split, or reorder transactions across different IDs" conflates AxCACHE-modifiable merging with ID reordering.
  - AXI3-6 (S4, verified). `AxiIdOrderingVisualizer.tsx` L98 labels "ID=0_10 (4)", but 0_10 = 2. ID prepend: A5.3.5 does say the interconnect "appends additional bits", so this is spec-described; the bit position is implementation-defined, and the lesson should say so.
- **Requirement vs policy:** good at L51 (outstanding depth is not protocol). Missing: interconnect strategies such as the single-slave-per-ID rule or a reorder buffer, presented as implementation choices.

### B-AXI-4 Cache, Prot, QoS & "Atomics" (193 lines)
- **Inventory:** AxCACHE; AxPROT; AxQOS; Exclusive; Verification strategy. `ExclusiveAccessVisualizer` (3 fixed playbacks, single-slot monitor). 3 MCQ. Flashcards (5). No `sources`.
- **Coverage:** E1. P1 (Q2 L171-181). A1. D0. T0.
- **Accuracy:**
  - **AXI4-1 (S2, High).** Quiz Q3 L183-192 gives "Secure, Privileged Data = 3'b000", with the explanation "AxPROT[0]=0 (Privileged)". This contradicts the module's own table L50 and the spec: AxPROT[0]=1 means privileged, so the correct answer is 3'b001. The coverage bins L137-142 are all mislabeled: secure_priv=000 should be 001, nonsec_priv=010 should be 011, secure_user=001 should be 000, nonsec_user=011 should be 010.
  - AXI4-2 (S3, High). The AxCACHE table L30 calls bit 1 "Cacheable… If 0, the access must be strictly ordered". In AXI4, bit 1 is *Modifiable*, and ordering is a separate attribute (A4.3/A6). It omits the AXI4 constraint that the allocate bits require Modifiable. L37 calls 4'b0011 "bufferable and cacheable", but it is Normal Non-cacheable Bufferable.
  - AXI4-3 (S3, High). The exclusive flow L87-97 omits that an OKAY to an exclusive *read* means exclusives are not supported (A7.2.2). It also omits the restrictions in A7.2.4: total bytes a power of 2 up to 128, AXI4 burst length ≤ 16, address aligned, identical control signals, AxCACHE visibility. The SVA L126-130 makes an unpaired exclusive write a protocol error, but per A7.2.2 it just fails (X12).
  - AXI4-4 (S2, missing). The title promises atomics, yet there is no AXI5 AtomicStore/Load/Swap/Compare (AWATOP) content, no AxREGION, and no AxUSER.
  - AXI4-5 (S4). L73 "guaranteeing its bandwidth" contradicts the L76 note that QoS is a hint.
  - AXI4-6 (S4, Interaction). In the `ExclusiveAccessVisualizer` "interleaved" scenario, M1's exclusive *read* overwrites M0's reservation. The lesson says M1's successful *write* clears it. A single-entry monitor is a legal implementation choice but is not labelled as one.

### B-AXI-5 Pitfalls & Deadlocks (199 lines)
- **Inventory:** Channel dependency deadlocks; Cyclic interconnect deadlocks; 4KB violation; Misaligned strobes; Hands-on. `AxiDeadlockSimulator` (dependency-graph playback; model `axi-dependency-model.ts` matches A3.3.1). 3 MCQ. Flashcards (5). Lab `axi-deadlock-hunt-lab`.
- **Coverage:** E2. P1. A1 (SVA L57-73 plus lab). D2 (L33-46, the simulator, the lab). T1 (L79-103).
- **Accuracy:** this is the strongest module for separating protocol rules from policy (L12-19, L35-37, L64-73 match A3.3.1).
  - X7: L147-153 (S2).
  - X4: `check_4kb_boundary` L129-137.
  - AXI5-1 (S3, Med). The cyclic-interconnect section L79-103 is generic NoC material. It omits the classic AXI4 W-ordering deadlock: the interconnect must forward W in AW order, and two slaves can accept AW in an order inconsistent with W. It also omits the same-ID-to-different-slaves hazard.
  - AXI5-2 (S4). The L113-118 MMU rationale is not the spec rationale (A3.4.1).
  - Lab: good; it teaches the B-after-AW dependency. The solution flags (L31-45) model only one outstanding write, which is fine for the lab but should be noted.

### B-AXI-6 Verification & Performance (245 lines)
- **Inventory:** Monitor reconstruction; Per-ID scoreboards; Protocol assertions; Latency; Summary; Hands-on lab. No interactive. 3 MCQ. Flashcards (5). Lab `axi-scoreboard-lab`.
- **Coverage:** E1. P0. A1. D0. T0.
- **Accuracy:**
  - **AXI6-1 (S2, High).** The monitor L41-65 keys `pending_writes[int]` by AWID with **one transaction per ID**, so a second outstanding same-ID write overwrites the first. That contradicts AXI-3 and the lab. W association is unaddressed: AXI4 W has no ID and follows AW order (A5.4), and W may precede AW (A3.3). This is the hard part of an AXI monitor.
  - AXI6-2 (S3). The scoreboard L114-138 has no reference model, so expected transactions appear from nowhere. It does not handle read/write same-address races (A5.3.4), has no `check_phase` for leftover expected transactions, and has no error-response policy.
  - AXI6-3 (S3, Med). `p_wdata_unknown` L163-166 fails on legal X in strobe-disabled lanes. Restrict it to `WSTRB`-enabled lanes.
  - AXI6-4 (S2, missing). There is no coverage section, no stimulus (driver, random READY, error injection), no AXI checker list (LAST, ID existence, WRAP legality, exclusive constraints, B-after-AW), and no checker-vs-scoreboard split (X13). The summary L202 claims "channel dependency rules" SVA that is never shown.
- **Lab `axi_scoreboard`:**
  - The starter does not compile as shipped. `axi_scoreboard.sv` L4-5 uses `uvm_analysis_imp_expected/_actual`, but `uvm_analysis_imp_decl` exists only in `solution.sv` L5-6, not in the starter or `testbench.sv`. S3, High.
  - The README L21-31 is stale relative to the starter: it describes "RLAST only, associative array by ID" versus per-ID queues and per-beat capture.
  - The testbench L67-102 has two single-beat reads with different IDs, `ARREADY=RREADY=1`, no same-ID outstanding (despite lab.json L5 promising it), no multi-beat, no interleaving, no errors, and no backpressure.
  - The solution's per-ID queue and beat accumulation are correct and implicitly handle cross-ID interleaving. Self-attested.

### B-AMBA-F1 Bridges & Integration (372 lines)
- **Inventory:** Why bridges; Architecture; Burst translation; Response mapping; Reset/CDC; Formal; Common bugs; Test plan. `BridgeTranslationExplorer` (AHB→AXI only; the `axi-to-ahb` type is declared at L10 but unused). 3 MCQ. Flashcards (5). Lab `ahb-axi-bridge-debug`.
- **Coverage:** E2. P1. A1. D1 (L279-297 plus lab). T1.
- **Accuracy:**
  - X1 (S1).
  - **F1-1 (S2, High).** Error handling L171-193 and Quiz Q3 L362-371 speak of "SLVERR on beat 3 of an 8-beat **write** burst". AXI writes have exactly one BRESP after all beats; per-beat responses exist only on R. The code L183-193 latches `axi_rresp` and never clears `error_flag`. It drives `ahb_hresp` for one cycle with no HREADY-low first cycle, which violates the two-cycle ERROR rule taught in AHB-2.
  - F1-2 (S2, Med-High). The write flow L76-90 buffers the whole AHB burst and then maps BRESP→HRESP. AHB data phases complete per beat, so this only works if the bridge holds HREADY low on the last beat (non-posted) or posts the write and loses the error. The posted vs non-posted tradeoff, the central bridge design decision, is never discussed.
  - F1-3 (S3, High). WRAP translation L149-156 and Bug 4 L291-293 describe AHB WRAP lengths that "don't match AXI's supported wrap lengths". AHB WRAP4/8/16 are all legal AXI WRAP lengths, so the mismatch they describe can never occur.
  - F1-4 (S3, Med). CDC L210 recommends "Two-flop synchronizers on control signals (VALID/READY handshakes)". Synchronizing VALID/READY directly is a classic CDC error. Use async FIFOs or a req/ack handshake with stable payload.
  - F1-5 (S4). The formal assumption L267-268 caps HSIZE at 4 bytes, but the examples use 8-byte beats. L49 says AHB INCR is "up to 16 beats", but undefined INCR is unbounded (L99 says so). L167 says "AHB has no exclusive"; AHB5 does (HEXCL/HEXOKAY, §8).
- **Lab:** good mechanics (split function, W accounting, WLAST per split), built on the X1 premise. HRDATA "held stable" during wait states (README L48) is not required. Self-attested.

### B-AMBA-F2 ACE & CHI (345 lines)
- **Inventory:** Why AXI is not enough; ACE; CHI; Verification shift; Debug patterns; Industry; Summary. No interactive. 4 MCQ. Flashcards (12).
- **Coverage:** E2 (overview). P0. A1 (line-state struct L208-222). D1 (L263-272). T1.
- **Accuracy:** CHI claims are Medium confidence because IHI0050 was not obtained.
  - F2-1 (S3, Med-High). L74 says "MakeUnique… Assumes local copy is valid". That describes CleanUnique; MakeUnique is for full-line writes and needs no data.
  - F2-2 (S3, Med). The ACE flow L92-100 says the snoop for a ReadShared is a "ReadOnce snoop". It then says the owner goes "Modified→Invalid (if MakeInvalid) or SC (if CleanShared)", mixing request names with snoop outcomes. "Modified" is not an ACE state name; the dirty unique state is UD. The interview bank `amba-ace-snoop-flow` says to snoop the dirty owner with "MakeInvalid", which would discard dirty data, and then claims data is returned. It also uses MESI terms ("Exclusive").
  - F2-3 (S3, Med). L138-146 says "five logical channel families" including "Misc — protocol credits, DVM messages". CHI has four channel types (REQ, RSP, DAT, SNP). Link credits are link-layer signalling, and DVM travels on REQ/SNP. The F2 flashcard says four, which contradicts the lesson.
  - F2-4 (S3, Med). The CHI flow L159-168 uses SnpCleanInvalid together with direct cache transfer (DCT). DCT uses Fwd-type snoops. The completion is the CompData from the forwarding RN, and the requester sends CompAck; there is no separate HN "Comp".
  - F2-5 (S3). L50, L232 and L239 cite "IHI0022H Part D / §D3" (X11). In Issue E, ACE is Part C.

### B-AMBA-F3 Interview & Debug Clinic (312 lines)
- **Inventory:** Whiteboard; Waveform triage; Test-plan prompts; Trick questions; Rubric; Rapid practice. No interactive. 3 MCQ. Flashcards (5).
- **Coverage:** E1. P1. A0. D2 (drills L106-175: classify the master/slave/checker bug). T2 (whiteboard prompts L31-94).
- **Accuracy:**
  - X3: L221-223, S2.
  - X6: the Drill 1 assertion L122-125.
  - X4: the Drill 3 SVA L160-164.
  - X1: L68, L78-79, L198.
  - L237-239: B-after-W is given without B-after-AW.
  - Good: Drill 4 L167-175, a correct checker-bug diagnosis; Quiz Q2, which is correct and contradicts AXI-2.
- **Requirement vs policy:** L175 ("unless the interconnect promised stricter ordering") is good.

### Interview bank `amba-protocols.json` (13 items)
- **Errors:**
  - `amba-ace-snoop-flow` L72-75: wrong snoop type and states (F2-2).
  - `amba-chi-node-roles` L84: says "RN-I non-coherent", but RN-I is I/O-coherent; this contradicts F2.
  - `amba-chi-retry-verification` L134: "PCrdGrant credit type matches the original request's channel" is wrong. PCrdType is a credit class, and retry applies only to REQ. "Retry uses same TxnID" is unverified (Low).
  - `amba-chi-credit-deadlock` L114: mixes link-layer credits with protocol-layer blocking. CHI requires RNs to make progress on snoops independently of their outstanding requests. S4.
  - Citation errors (X11).
- **Gaps:** no items on exclusive access, WSTRB/unaligned transfers, W-before-AW and B-after-AW, the AHB two-cycle ERROR, HTRANS/BUSY, or the AXI4 removal of write interleaving.

### Shared component defects
- `ProtocolWaveform.tsx` L36 tests `waveformIndexRef.current === undefined`, but `useRef(null)` makes it `null`, so `createWaveDromIndex()` is never called. Every waveform renders with WaveDrom index 0, so pages with several waveforms (AXI-1 has 4) produce duplicate SVG ids. That can cause marker/arrow/gradient collisions. S4, High on the code path; visible impact unverified.
- `AmbaFamilyExplorer.tsx`, `ProtocolAnalogyExplorer.tsx`: hard-coded light palette (`bg-white`, `text-slate-*`), so dark mode is likely broken. Polish, out of scope.
- Every AMBA interactive is passive playback or a static explorer. None asks the learner to predict before revealing (e.g., "which cycle completes the handshake?"). `AxiMemoryMathVisualizer` is the only manipulable one, and its model is wrong for unaligned transfers (X7).

---

## 3. Visual vs spec semantic-model check

| Visual | Model matches spec? | Notes |
|---|---|---|
| AhbPipelineBurstVisualizer | **Yes** for the 4 scenarios shown | Correct wait-state timing (contrast AHB-1 waveform AHB1-1). No BUSY, ERROR, WRAP, read, or IDLE→NONSEQ-in-wait scenarios. |
| AxiChannelHandshakeVisualizer | Yes for what it shows | All scenarios have AW first. W-before-AW, READY-before-VALID, outstanding transactions and IDs are absent, which reinforces X2. |
| AxiMemoryMathVisualizer | **No** for unaligned INCR addresses and lanes; incomplete legality | X7. AxLEN ≤ 15. WRAP legality not enforced. |
| AxiIdOrderingVisualizer | Yes (ordering) | Single-event R, so no beats or interleaving. ID arithmetic error "0_10 (4)". |
| ExclusiveAccessVisualizer | Partly | Single-slot monitor with replace-on-read is not labelled as an implementation choice. No "exclusive unsupported → OKAY on read". No constraint checks. |
| AxiDeadlockSimulator (+ axi-dependency-model.ts) | **Yes** | Edge legality matches A3.3.1. The best-modelled visual. |
| BridgeTranslationExplorer | **No** (premise) | Treats AHB bursts crossing 1KB/4KB as legal inputs (X1). AXI→AHB direction declared but unused. |
| AmbaFamilyExplorer / ProtocolAnalogyExplorer | n/a (descriptive) | The analogy sequence implies AW before W. |
| ProtocolWaveform instances | **3 of 7 wrong** | AHB-1 wait-state (AHB1-1), AXI-1 handshake (AXI1-1), AXI-1 write B channel (AXI1-3). The AXI-1 Scenario B ordering is mislabelled (AXI1-2). |

---

## 4. Practical readiness: can a learner build the target environment from these modules and labs?

| Required capability | Taught? | Evidence | Gap |
|---|---|---|---|
| AXI/AHB UVM **agent** (driver, sequencer, sequences, config, active/passive) | **No** | No `uvm_driver` for AXI or AHB anywhere. A-UVM-7 uses APB. Labs drive pins with hard-coded `<=`. | Need an AXI master driver handling five independent channels, W-before-AW option, outstanding window and ID allocation, and a slave responder with random READY, reorder and errors. Same for AHB master and slave (BUSY insertion, wait states, ERROR). |
| **Protocol assertions** | Partial, with defects | AXI: AXI-5 stability SVA is correct, and the deadlock lab adds B-after-AW. AHB: AHB-3 checker. | AHB assertions miss single-cycle ERROR (X5) and fire on legal behavior (X6). 4KB/1KB checks are wrong for WRAP/FIXED/unaligned (X4). No WLAST/AxLEN beat-count SVA, WRAP-length legality, AxSIZE ≤ bus width, ID-exists, exclusive-constraint, X-on-strobed-lanes, or reset checks. No AHB SEQ-address/burst-consistency checks. |
| **Out-of-order, ID-aware scoreboard** | Partial | The `axi_scoreboard` lab solution (per-ID queues, beat accumulation) is correct. | Lesson code (AXI-3 L210-238, AXI-6 L41-138) is wrong or non-compiling. The lab is read-only, with two single-beat reads; no write path, same-ID outstanding, interleaving or reference memory model. Read/write same-address races (A5.3.4) are never discussed. |
| **Backpressure / random-READY stimulus** | **No** | Only described in prose (F3 L188, the AXI-6 flashcard). | No READY-randomization knobs or sequences; no lab exercises stalls. |
| **Error responses** (SLVERR/DECERR, AHB ERROR, EXOKAY/OKAY) | Partial | AHB two-cycle ERROR explained. Bridge mapping table. | No error injection in any AXI lab. Write-error semantics are confused (F1-1). The meaning of OKAY on an exclusive read is missing. |
| **Coverage of burst/ID/response space** | Weak | AHB-3 covergroups (non-compiling crosses), AXI-3/AXI-4 fragments. | No AXI covergroup over AxBURST × AxLEN × AxSIZE × alignment × ID-reuse × outstanding depth × RESP × READY-stall pattern. AXI-6 has no coverage. |
| **Narrow/unaligned and WSTRB** | Incorrect | X7. | Spec equations missing. Visual and lesson are wrong for unaligned transfers. |
| **Grading** | None | All 4 labs are `self_attested`. | No automated simulation run; e.g., the `axi_scoreboard` starter compile failure went unnoticed. |

**Verdict:** No. A learner could explain handshakes, 4KB math (once AXI2-1 is fixed) and per-ID ordering. They could reproduce a read-only per-ID scoreboard and a single-transaction dependency checker. They could not, from this material, build an AXI or AHB agent with stimulus, a complete protocol checker, a write-path or reference-model scoreboard, backpressure randomization, or closed coverage. Several reference snippets they would copy are wrong.

**Minimum additions to reach the outcome:**
1. **Lab "AXI agent".** Build a master driver with five independent channel threads and a configurable outstanding/ID policy, plus a slave responder with a memory model, random READY, configurable reorder, SLVERR/DECERR injection and EXOKAY. Graded by a regression with fixed seeds checking assertion counts and coverage.
2. **Corrected `axi_checker` SV module.** Include the A3.3.1 dependencies, stability, LAST count, WRAP/4KB with burst-type gating, strobes ⊆ active lanes, and exclusive constraints. Each property carries a [Protocol]/[Policy] tag.
3. **Extend `axi_scoreboard`.** Add a write path with W-in-AW-order association, same-ID multiple outstanding transactions, R interleaving, error responses, and a reference memory with an RAW-race policy.
4. **AXI coverage model and closure exercise.**
5. **AHB counterpart.** Master driver with BUSY/IDLE insertion, slave with random waits and two-cycle ERROR, and the corrected checker from X5/X6.

---

## 5. Module summary

| Module | Depth (1-5) | Strongest competency | Biggest gap | Severity |
|---|---|---|---|---|
| B-AMBA-1 Families | 1.5 | Explain (family comparison) | No predict/apply; "1 multiplexed channel" for AHB | S4 |
| B-AMBA-2 Intuition | 1 | Explain (analogies) | "Three actions happen independently" seeds the X2 misconception | S3 |
| B-AHB-1 Timing | 2 | Explain (pipeline) | Wrong wait-state waveform; no HSEL/HREADY sampling, BUSY or HBURST table | S2 |
| B-AHB-2 Pitfalls | 2.5 | Debug (buggy-vs-fixed RTL) | ERROR assertion cannot catch the single-cycle bug; incoherent priority-inversion scenario; 1KB SVA wrong for WRAP | S1 |
| B-AHB-3 Verification | 3 | Apply (monitor/checker/coverage code) | Checker flags legal cancel-after-ERROR and misses single-cycle ERROR; coverage does not compile; byte-address scoreboard | S1 |
| B-AXI-1 Channels | 3 | Explain (handshake contract) | "W must not complete before AW"; B-after-AW missing; canonical handshake waveform shows a violation | S1 |
| B-AXI-2 Burst Math | 3 | Predict (computational quizzes) | Legal burst labelled ILLEGAL; 4KB SVA false-fires on WRAP/FIXED; unaligned lanes wrong | S2 |
| B-AXI-3 Ordering | 3 | Explain/Predict (same-ID vs different-ID) | Reference scoreboard non-compiling and wrong; RAW contradiction; no interleaving or write-interleaving removal | S2 |
| B-AXI-4 Cache/Prot/Excl | 2 | Explain (exclusive flow) | AxPROT quiz and coverage bins wrong; no AXI5 atomics; exclusive restrictions missing | S2 |
| B-AXI-5 Pitfalls | 3.5 | Debug (dependency-cycle analysis plus lab) | Wrong unaligned WSTRB example; generic interconnect deadlock | S2 |
| B-AXI-6 Verification | 2 | Apply (per-ID queue idea plus lab solution) | Monitor overwrites same-ID outstanding; no W association, coverage or stimulus; lab starter does not compile | S2 |
| B-AMBA-F1 Bridges | 2.5 | Transfer (bridge test plan) | Premise that AHB bursts cross 4KB (illegal); per-beat write error; one-cycle HRESP; posted/non-posted missing | S1 |
| B-AMBA-F2 ACE/CHI | 2 | Explain (why coherency; ownership model) | Several ACE/CHI transaction and channel inaccuracies; unverified clause cites | S3 |
| B-AMBA-F3 Clinic | 3 | Debug/Transfer (triage drills, whiteboard) | Wrong answer to "can WVALID wait for AWREADY"; inherits X1/X4/X6 | S2 |

**Top 8 corrections by learner impact:** X1, X2, X5, AXI1-1, AXI2-1, X7, X3/AXI4-1, X8.

**Validation strategy for all fixes:**
1. Add a Vitest suite for (a) a shared AXI burst/lane util checked against spec equation vectors and (b) WaveDrom-spec semantic checks.
2. Add a simulator CI job (Verilator `--assert` or equivalent) that compiles every lab starter and solution and runs good and broken modes with expected assertion-fire counts.
3. Add a Playwright nav test for the AMBA Next chain.
4. Add a citation lint against a verified section index.
