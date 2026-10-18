# G29-B-SOC author log: `soc-system-design.json`

Author: G29-B-SOC. Date: 2026-10-11. Verdict carried in: **major** (analysis G29, confirmed by G29-V).

Scope: `content/interview-questions/soc-system-design.json` only. The bank's `id`, `topic` and `title` are unchanged. All 7 existing question ids are kept. 14 questions were added, so the bank has **21 questions**:

| Level | Count |
|---|---|
| junior | 3 |
| mid | 5 |
| senior | 4 |
| staff | 7 |
| senior-staff | 2 |

Every question has `modules`, `follow_ups` and `common_mistakes`. Sources are structured `{doc, section, verified}` objects or labelled practice strings. The two waveform-debug items carry a text cycle table in `code`, and the coding item carries the buggy code in `code` and the fix in the model answer.

## How sources were verified

| Source | Where I checked it |
|---|---|
| IHI0022E (AXI/ACE) | `scratchpad/axiE.txt`, header "ARM IHI 0022E". Checked: A3.1.2, A3.3.1, A3.4.1, A3.4.3, A3.4.4, A4.7 / Table A4-6, A5.3.1, A5.3.2, A5.3.5, A7.2.3, A8.1.1, C1.2.3 (cache state rules), C3.2.1 / Table C3-15, C4.2, C4.10 and C4.10.3, C5.2.3, C5.3.2 / Table C5-8, and the chapter titles C8, C10, C11, C12 |
| AHB | `scratchpad/audit/ahb5.txt`. Its header reads **ARM IHI 0033C**, not B.b. Checked: §4.2 (minimum 1KB region on a 1KB boundary) and §4.2.1 (Default Subordinate: ERROR for NONSEQ/SEQ, zero-wait OKAY for IDLE/BUSY). I cite it as IHI0033C. |
| IEEE 1800.2-2020 | `scratchpad/audit/uvm_lrm.txt`. Checked: 10.1.1.2.2, 10.1.1.2.4, 10.4.1.2.3, 10.4.1.2.4, 13.3 (quote), 13.4.2.2, 18.2.3.5, 18.2.5.2, 18.4.4.1, 18.4.4.3, 18.4.4.5, 18.5.4.6 (W1C), 18.6, 19.3, 19.3.2.3; F.7.4.2 from the spine's Appendix A |
| IEEE 1800-2023 | `scratchpad/audit/t1_lrm_clean.txt`. Checked: 16.12.2 (unqualified sequence is weak in `assert property`), 16.12.13, 20.9, 23.11, Clause 19; 6.5, 9.6.3 and 16.9.3 from Appendix A |
| Accellera PSS | WebFetch of accellera.org: 3.0 is the current release, 2024-08-28. Section titles 12.3.4, 12.3.5, 13.1, 14.2, 17.1 and 22.8 checked in the local PSS 3.0 text (`scratchpad/L44V/pss30.txt`). |
| CHI (IHI0050E.b) | No text available to me. §3.1 is cited with `verified: false`; G29-V reports it holds. |
| IEEE 1801 (UPF) | Not checked by me. The edition and command names follow I-SV-8 (1801-2018 names; 1801-2024 is current), cited with `verified: false`. |
| SCE-MI | Not checked by me; cited with `verified: false`. |

Methodology content (vplans, triage, synchronizer structures, Little's law, team split) is labelled as practice in `sources`, and as "example" or "tool-dependent" in the text where relevant.

## Findings and resolutions

| ID | Sev | Question | Resolution |
|---|---|---|---|
| G29-SOC-01 (adjusted by G29-V; stays S2) | S2 | soc-coherency-verification | **Rewritten.** <br>- Uses the five ACE states, and notes the one-to-one MOESI mapping, so MOESI naming is not wrong in itself (G29-V). <br>- Invariants come from the §C1.2.3 cache state rules: Unique means no other valid copy (not just "two Modified"); a lone SC is legal; one Dirty owner; data checked against a golden copy; memory checked when no Dirty owner exists. <br>- Table C5-8 permitted end states for a ReadShared-class snoop to UD (I, SC or SD, with matching PassDirty and IsShared). The checker tests permitted changes, not the recommended Table C5-1 mapping. <br>- Hard races added: snoop vs in-flight WriteBack/WriteClean (C5.2.3), overlapping stores with a CleanUnique that loses its line (C4.10.3), snoop-filter accuracy (C4.2, C10), exclusive sequences (C5.3.2). <br>- Barriers (C8), DVM (C12) and ACE-Lite (C11) are separate checks. <br>- Memory-consistency litmus tests are out of scope (they belong to the processor team). <br>- Added an invariant-checker code snippet, formal abstraction and coverage. <br>- Removed the IHI0022H and IHI0050F citations. |
| G29-SOC-02 | S3 | soc-power-verification | **Rewritten.** <br>- Vendor tool names (PrimePower, "VCS-PA", Questa) removed; static and dynamic checks are described as methods, with tools named as tool-dependent. <br>- Edition: 1801-2018 command names (the I-SV-8 lesson's choice), with 1801-2024 (UPF 4.0) named as current. <br>- Added the missing content: power states and supply sets, `add_power_state` and legal and illegal transitions; corruption semantics (X; 2-state `bit` hides corruption; power-up restores nothing); clamp values; save and restore control order; static vs dynamic checks. <br>- Added two power-aware SVA properties that match I-SV-8's PMU timing, and testbench behaviour across power events. |
| G29-SOC-03 | S3 | soc-address-map-decode | **Rewritten.** <br>- IHI0022H §A4 replaced by IHI0022E §A3.4.4, §A3.4.1 and §A4.7, plus IHI0033C §4.2 and §4.2.1, plus CHI §3.1 (marked unverified). <br>- Added: the AHB default subordinate's ERROR/OKAY behaviour, the AHB 1KB region granularity, AXI 4KB alignment, all beats completing on DECERR, per-master views, aliases and remaps, security, single-source generation, and a formal decode proof. <br>- The prompt now includes an address map and asks for boundary addresses and expected responses. |
| G29-SOC-04 | S3 | soc-block-to-system | **Rewritten.** <br>- Qualified "active becomes passive": passive only where an on-chip master drives. <br>- Added: env-of-envs reuse (1800.2 §13.3 quote verified), `bind` reuse of block assertions (1800-2023 §23.11), the SoC register model with `add_submap` (§18.2.3.5), explicit predictors (§19.3), the firmware–testbench contract, PSS, emulation, and the keep/adapt/disable decision per scoreboard (ID widening §A5.3.5, DECERR). <br>- Removed the "§2 (Architecture)" citation. |
| G29-SOC-05 | S3 | soc-staff-dma-system-design | **Rewritten.** <br>- Correct roles: the bench is the APB master and the AXI slave responder; the DUT is the AXI master. <br>- Added: descriptor ownership and cache coherency; unaligned addresses and WSTRB (§A3.4.3); 4KB splitting (§A3.4.1); overlapping source and destination; abort, pause and resume; reconfiguration while active; out-of-order completion; SLVERR/DECERR mid-burst with all beats completed (§A3.4.4); arbitration; reset; liveness. <br>- Replaced the "§7 (RAL)" citation with §18.6 and §19.3. <br>- Category changed from staff-system-design to **verification-plan**, as the analysis suggested; the id is unchanged. |
| G29-SOC-06 | S3 | soc-senior-staff-interconnect | **Rewritten** as an area / interconnect-owned rule / technique table. <br>- Added: same-ID order across slaves (§A5.3.1), write-data order at a shared slave (§A5.3.2), ID widening (§A5.3.5), exclusive monitors (§A7.2), QoS semantics left open by AXI (§A8.1.1), AxPROT (§A4.7), width and clock conversion, deadlock (formal with fairness), and reset. <br>- The staffing and milestones are labelled as an example. <br>- IHI0022H removed. |
| G29-SOC-07 | S4 | soc-signoff-strategy-review | The strong answer is kept and extended: connectivity and CDC/RDC sign-off items, a flaky-test policy, and weak vs strong liveness. The "1800.2 §4 and §12" sources are replaced by 1800-2023 §16.12.2, §16.12.13 and Clause 19, plus a practice label. |
| G29-SOC-08 | S3 | (bank) | **Resolved.** The bank had no junior questions and one mid question; it now has 3 junior and 5 mid. Interrupts, reset and boot, CDC/RDC, security, performance, HW/SW co-verification with PSS, and emulation each have a question (see the gap table below). |
| Headline 3 (citations) | S2 | all | No IHI0022H, IHI0050F or wrong 1800.2 clause numbers remain. Each section number was checked as described above, or is marked `verified: false`. |
| G29-V notes: ACE | — | soc-coherency-verification | Table C5-1 mappings are recommended, so the check targets the required state change. Applied. |
| G29-V notes: AXI responses | — | interconnect, DMA | "Masters always accept responses" is not used anywhere. |
| G29-V gap 7 (visuals) | — | waveform items | Text cycle tables are in `code`. Linking visualizers needs the `visual` schema field, which is a lead request. |
| Analysis question-map note | — | soc-staff-dma-system-design | The category now fits (verification-plan). |

## Coverage gaps assigned to this bank (G29 "Coverage gaps")

| Gap | Level asked | Question added |
|---|---|---|
| Interrupt verification (sources, masking, priority, level/edge) | mid–senior | `soc-interrupt-basics` (junior), `soc-interrupt-verification-plan` (mid) |
| Reset and boot sequencing; RDC | senior | `soc-reset-boot-sequencing` (senior) |
| CDC verification (structural, metastability, formal) | senior | `soc-cdc-rdc-verification` (senior) |
| Security: TrustZone, AxPROT, firewalls | staff | `soc-security-verification` (staff) |
| Performance verification (latency, bandwidth, QoS) | staff | `soc-performance-qos` (staff) |
| HW/SW co-verification and PSS | staff | `soc-pss-hw-sw-coverification` (staff) |
| Emulation and FPGA prototyping | staff | `soc-emulation-strategy` (staff) |
| Entry-level SoC items (SOC-08) | junior/mid | `soc-integration-only-bugs`, `soc-agent-mode-reuse` (junior); `soc-firmware-tb-sync` (coding), `soc-ral-firmware-prediction` (trick), `soc-lost-response-liveness` (waveform-debug), all mid |
| E-SOC-1 assessment misconceptions (spine card) | — | Auto-predict and firmware: `soc-ral-firmware-prediction`. Block scoreboards unchanged: `soc-interconnect-id-mismatch` (senior waveform-debug), `soc-block-to-system`. Closure is the union of block coverage: `soc-integration-only-bugs`, `soc-signoff-strategy-review`. |

## Question map

"Sources verified" lists the sections I checked myself. "Unverified" items are marked `verified: false` in the JSON.

| id | Level | Category | Modules | Sources verified |
|---|---|---|---|---|
| soc-integration-only-bugs | junior | concept | E-SOC-1/index | practice label only |
| soc-agent-mode-reuse | junior | trick | E-SOC-1/index, I-UVM-2A/index, A-UVM-7/index | 1800.2 §13.4.2.2, F.7.4.2; 1800-2023 §6.5 |
| soc-interrupt-basics | junior | concept | I-UVM-3B/interrupt-handling, E-SOC-1/index, A-UVM-4A/index | 1800.2 §18.5.4.6; practice |
| soc-address-map-decode | mid | concept | E-SOC-1/index, B-AMBA-F1/index, A-UVM-4A/index | IHI0022E §A3.4.4, §A3.4.1, §A4.7; IHI0033C §4.2, §4.2.1; CHI §3.1 unverified |
| soc-firmware-tb-sync | mid | coding | E-SOC-1/index, I-UVM-1C/index | 1800.2 §10.1.1.2.2, §10.1.1.2.4, §10.4.1.2.3, §10.4.1.2.4; 1800-2023 §9.6.3 |
| soc-ral-firmware-prediction | mid | trick | E-SOC-1/index, A-UVM-4B/explicit-vs-implicit | 1800.2 §18.4.4.1, §18.4.4.3, §18.2.5.2, §19.3, §19.3.2.3, §18.6 |
| soc-lost-response-liveness | mid | waveform-debug | E-SOC-1/index, E-INT-1/index, I-SV-4A/index | 1800-2023 §16.12.2, §16.12.13; IHI0022E §A3.3.1 |
| soc-interrupt-verification-plan | mid | verification-plan | E-SOC-1/index, I-UVM-3B/interrupt-handling, A-UVM-8/index | 1800-2023 §16.12.13; practice |
| soc-block-to-system | senior | verification-plan | E-SOC-1/index, A-UVM-7/index, A-UVM-8/index, I-SV-4C/index | 1800.2 §13.3, §18.2.3.5, §19.3; 1800-2023 §23.11; IHI0022E §A5.3.5 |
| soc-reset-boot-sequencing | senior | verification-plan | A-UVM-9/index, E-SOC-1/index | IHI0022E §A3.1.2; 1800.2 §18.4.4.5; practice |
| soc-cdc-rdc-verification | senior | concept | E-SOC-1/index, B-AMBA-F1/index | 1800-2023 §20.9, §16.9.3; practice |
| soc-interconnect-id-mismatch | senior | waveform-debug | E-SOC-1/index, B-AXI-3/index, A-UVM-6/index | IHI0022E §A5.3.5, §A5.3.1, §A5.3.2 |
| soc-coherency-verification | staff | staff-system-design | B-AMBA-F2/index, E-SOC-1/index, E-INT-1/index | IHI0022E §C1.2.3, Table C5-8 (§C5.3.2), §C5.2.3, §C4.10/§C4.10.3, §C4.2, Chapters C8, C10, C11, C12 |
| soc-staff-dma-system-design | staff | verification-plan | E-SOC-1/index, A-UVM-8/index, A-UVM-4A/index, B-AXI-2/index | IHI0022E §A3.4.1, §A3.4.3, §A3.4.4; 1800.2 §18.6, §19.3 |
| soc-power-verification | staff | staff-system-design | I-SV-8/index, E-PWR-1/index | 1800-2023 §16.9.3; IEEE 1801-2018 and 1801-2024 unverified |
| soc-security-verification | staff | staff-system-design | B-AXI-4/index, E-SOC-1/index, E-INT-1/index | IHI0022E §A4.7 / Table A4-6; practice |
| soc-performance-qos | staff | staff-system-design | B-AXI-6/index, B-AXI-4/index, E-SOC-1/index | IHI0022E §A8.1.1, §A5.3.1; practice |
| soc-pss-hw-sw-coverification | staff | staff-system-design | E-PSS-1/index, E-SOC-1/index | PSS 3.0 (accellera.org) §12.3.4, §12.3.5, §13.1, §14.2, §17.1, §22.8 |
| soc-emulation-strategy | staff | staff-system-design | E-EMU-1/index, E-SOC-1/index | SCE-MI unverified; practice |
| soc-senior-staff-interconnect | senior-staff | staff-system-design | B-AXI-5, B-AXI-3, B-AXI-4, B-AXI-6, B-AMBA-F3, E-SOC-1 (all /index) | IHI0022E §A3.4.4, §A5.3.1, §A5.3.2, §A5.3.5, §A7.2, §A8.1.1, §A4.7 |
| soc-signoff-strategy-review | senior-staff | staff-system-design | E-SOC-1/index, I-SV-3B/linking-coverage, I-SV-3B/closure-workflow, E-DBG-1/index | 1800-2023 §16.12.2, §16.12.13, Clause 19 |

Every `modules` entry resolves: `tests/app/interview-prep-banks.test.ts` "resolves every modules entry" passes.

## Ids removed or renamed

None. One category changed: `soc-staff-dma-system-design` moved from `staff-system-design` to `verification-plan`.

New ids:
- `soc-integration-only-bugs`
- `soc-agent-mode-reuse`
- `soc-interrupt-basics`
- `soc-firmware-tb-sync`
- `soc-ral-firmware-prediction`
- `soc-lost-response-liveness`
- `soc-interrupt-verification-plan`
- `soc-reset-boot-sequencing`
- `soc-cdc-rdc-verification`
- `soc-interconnect-id-mismatch`
- `soc-security-verification`
- `soc-performance-qos`
- `soc-pss-hw-sw-coverification`
- `soc-emulation-strategy`

## Deferred

| Item | Reason |
|---|---|
| Linking model-backed visualizers to questions (for example `VIPReuseVisualizer`, `RALPredictorVisualizer`, `PowerDomainVisualizer`) | The schema has no `visual` field; the page would ignore it. This is a lead request (G29-V gap 7). |
| CHI-specific coherency items (DMT/DCT/DWT, CompAck) | They are assigned to `amba-protocols.json`, and no CHI text was available to verify sections. |
| Verifying IEEE 1801 clause numbers and SCE-MI version text | No primary text available in this session; cited as unverified and kept at the method level. |
| A `debug` / `predict-output` category for log-based items | The bank-schema test allows only the six current categories. |

## Requests for the lead

1. **Optional practice-map cleanup.** All 21 questions now carry `modules`, which take precedence over `INTERVIEW_QUESTION_LESSONS` (`src/lib/practice-links.ts`). The seven existing map entries can stay: no id was removed. The new ids need no map entry.
2. **B-AMBA-F2 consistency.** The lesson still has a heading "Coherency States (MOESI Model)" and a coherency-scoreboard section. Ask its author to align it with the ACE invariants used here: Unique means no other valid copy, a lone SC is legal, at most one Dirty copy, and the Table C5-8 end states.
3. **AHB citation label.** `scratchpad/audit/ahb5.txt` is IHI0033C (2021), not IHI0033B.b. The spine's Appendix A and citation style name B.b. Decide whether the curriculum standard should be IHI0033C, or confirm that the B.b numbering matches. §4.2 and §4.2.1 match the analysis's B.b citations.
4. **Schema.** Add `visual?: {component, props}` (G29-V gap 7), so questions can link visualizers. Also consider `debug` and `predict-output` categories in `tests/interview-questions/bank-schema.test.ts`.
5. **E-SOC-1/`pss.mdx`.** The spine plans to merge it into E-PSS-1. This bank maps the PSS question to E-PSS-1/index and E-SOC-1/index, not to `pss.mdx`, so the merge breaks nothing here.

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/soc-system-design.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, **408 tests passed**.
- Extra check: inline backticks are balanced in every paragraph and list item, so RichText renders no stray code spans. The coding item contains code.

## Fix round 1

Inputs: `G29-B-SOC.accuracy.r1.md` (3 S2, 4 S3, 4 S4) and `G29-B-SOC.completeness.r1.md` (no S1/S2; 3 S3, 7 S4, addressed where they were in this bank). Edits are in `content/interview-questions/soc-system-design.json` only. No id was removed or renamed; the bank's id, topic and title are unchanged.

Sources rechecked this round:
- IHI0022E (`scratchpad/axiE.txt`, flattened): §A3.3.1 (the slave must not wait for BREADY before asserting BVALID), §A3.4.4 ("For a write transaction, a single response is signaled for the entire burst"), §A7.2.3 (monitor per exclusive-capable master ID, addressed to the slave), §C3.2.1 / Table C3-15 (PassDirty), §C4.3 heading, §C5.3.2 ReadClean/ReadShared text and Table C5-8.
- IEEE 1800-2023 §6.5 (`audit/t1_lrm_clean.txt`): variables take procedural writes *or* one continuous assignment or one port, and a mixture is an error.
- IEEE 1800.2-2020 (`audit/uvm_lrm.txt`): §13.4.2.2 (default UVM_ACTIVE unless overridden through the configuration database), §18.5.4.6 (RC: read clears all bits), §19.3.2.1 (the predictor applies the access policy), §14.2.5.11 / §14.2.5.12 (kill, stop_sequences).
- uvm-core 2020.3.1 `uvm_agent.svh` (`scratchpad/g29b/src`, `UVM_VERSION_STRING` 2020.3.1): `uvm_agent::build_phase` reads `is_active` (lines 74-92).
- accellera.org WebFetch, 2026-10-11: PSS 3.0, released 2024-08-28, no IEEE number listed.

| Finding | Sev | Question | Resolution |
|---|---|---|---|
| acc 1 | S2 | soc-coherency-verification | **Fixed.** The checker takes a `dirty_in_flight` input: a PassDirty response not yet complete at the initiator, or the interconnect's write-back after a ReadClean snoop, counts as an owner. The memory check reads "no cache and no in-flight transaction holds dirty responsibility". The answer explains the ReadShared and ReadClean hand-offs (§C3.2.1, §C5.3.2) and offers checking memory only when the line is quiescent as the alternative. The golden copy must include local stores to a Unique line (cache probes or the core's store stream); a bus-only checker compares the data when it next appears on the bus. Added a follow-up, two common mistakes, and §C3.2.1 and §C4.3 sources. |
| acc 2 | S2 | soc-agent-mode-reuse | **Fixed.** Rubric and answer: on a net, conflicting drivers resolve to X. A variable driven by a port or `assign` cannot also be written procedurally, so the tool reports an error. Only two procedural writers give a silent last write (§6.5). Added that drivers often drive idle values before any sequence runs, and a matching common mistake. |
| acc 3 | S2 | soc-staff-dma-system-design | **Fixed.** Reads have per-beat RRESP; writes have one BRESP per burst after all write data (§A3.4.4). Beat-position coverage is limited to reads; writes are covered per burst of a split transfer. The follow-up now covers a read error on beat 2 and a write burst with BRESP = SLVERR. Added a common mistake. Also completeness #9: the stale-descriptor test is now concrete. |
| acc 4 | S3 | soc-agent-mode-reuse | **Fixed.** §13.4.2.2 is cited only for the return value and the default. The build guard is labelled as VIP practice. The `super.build_phase` point is labelled uvm-core 2020.3.1 behaviour, with its own source entry. |
| acc 5 | S3 | soc-lost-response-liveness | **Fixed.** Fairness goes on the environment: a downstream memory or slave model eventually responds, and the master eventually supplies all W beats. The answer warns against assuming the property and notes that BVALID must not wait for BREADY (§A3.3.1). |
| acc 6 | S3 | soc-ral-firmware-prediction | **Fixed.** Now reads "hardware-set bits (including the set side of clear-on-read status bits)". The clearing side is predicted by the access policy (§18.5.4.6, §19.3). Added a §18.5.4.6 source. |
| acc 7 | S3 | soc-power-verification | **Fixed.** Labelled "a typical control sequence (practice; design- and retention-specific)". Two invariants are kept as rules, matching the assertions: isolate before power off, and restore before releasing isolation. Rubric and a common mistake updated. Also completeness #4: the answer names how to stop stimulus (quiesce flag, `stop_sequences()` / `kill()`, §14.2.5.11). |
| acc 8 / comp 6 | S4 | soc-interrupt-verification-plan | **Fixed.** The stray follow-up is replaced by: two equal-priority sources asserting in the same cycle. |
| acc 9 | S4 | soc-pss-hw-sw-coverification | **Fixed.** The output form is "tool-dependent; a common pattern is a UVM sequence for simulation and bare-metal C". The release and IEEE-number statements say "as of 2026". Added the accellera.org WebFetch source. |
| acc 10 | S4 | soc-senior-staff-interconnect | **Fixed.** The monitor recommendation is attributed to slaves, with the interconnect possibly providing monitors on their behalf. The citation is now §A7.2.3. |
| acc 11 / comp 1 | S4 / S3 | soc-address-map-decode | **Fixed.** Added a CHI bullet: each requester's SAM must provide a complete decode (§3.1), and holes map to an error-returning target (labelled practice). The CHI source is now `verified: true`, noting that G29-V checked it (G29.verify.md item 6). Also completeness #10: added boundary rows `0x4001_1FFC`, `0x5000_FFFC` and `0x5001_0000`. |
| comp 2 | S3 | soc-lost-response-liveness, soc-signoff-strategy-review | **Fixed.** Added `I-SV-4B_Advanced_Temporal_Logic/index` to `modules` on both questions. |
| comp 3 | S3 | (lead) | **Not changed.** The E-RISCV-1 question needs a lead decision; carried as a lead request. |
| comp 5 | S4 | soc-firmware-tb-sync | **Fixed.** Added `A-UVM-8_Multi_Agent_Topologies/index`. |
| comp 7 | S4 | soc-performance-qos | **Fixed.** The follow-up specifies 64-byte reads. |
| comp 8 | S4 | soc-interconnect-id-mismatch | **Fixed.** The cycle-table IDs are now in hex (`0x3`, `0x13`), matching the prose. |

### Validation (fix round 1)

- `python3 -c "import json;json.load(open('content/interview-questions/soc-system-design.json'))"`: OK. The file re-serialises byte-identically with `indent=2, ensure_ascii=False`.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, **863 tests passed** (the schema suite has grown since round 0 because other banks changed).
- Inline backticks are balanced in every rubric and answer paragraph and in every list item.

### Ids removed or renamed

None.

### Lead requests (new or still open)

- comp 3: decide whether this bank or another gets an E-RISCV-1 question, such as an ISS trace compare that fails after an asynchronous interrupt.
- Still open from round 0: the `visual` schema field, the `debug` / `predict-output` categories, and B-AMBA-F2's MOESI heading. Also: B-AMBA-F2's coherency scoreboard should treat dirty responsibility in transit as an owner, the same fix made here.

## Fix round 1 (2026-10-18 review-only pass)

Inputs: `G29-B-SOC.accuracy.r1.md` of 2026-10-18 (1 S2, 3 S3, 3 S4; no S1) and `G29-B-SOC.completeness.r1.md` of 2026-10-18 (no S1 or S2; 4 S3 and 6 S4, of which findings 2 and 5 to 9 are for this author). Edits are in `content/interview-questions/soc-system-design.json` only. No id was removed or renamed. The bank's id, topic and title are unchanged, and so is the question order.

Sources rechecked this round:
- IEEE 1800.2-2020 (`sources/uvm_lrm.txt`): §18.2.5.2 (auto-predict covers `write()`/`read()` through the map; the predictor mode captures accesses "not directly descendant from calls to uvm_reg::write"), §18.4.4.1 (desired and mirrored are identical unless `set()` was called), §18.4.4.2, §18.4.4.3, §18.4.4.15 (predict "Updates the mirrored and desired value"), §14.2.5.11, §14.2.5.12, §15.3.2.14 (stop_sequences removes all queued requests, locks and responses).
- uvm-core 2020.3.1 (`~/Downloads/1800.2-2020.3.1/src`, `UVM_VERSION_STRING` "Accellera:1800.2:UVM:2020.3.1"): `uvm_reg_field::do_predict` ends with `m_mirrored = field_val; m_desired = field_val;`. `uvm_sequencer::stop_sequences` flushes `m_req_fifo`, and `item_done` fatals with `SQRBADITMDN` when `try_get` finds the FIFO empty. `uvm_sequencer_base::kill_sequence` does not touch `m_req_fifo`, so the FIFO hazard is stated for `stop_sequences()` only.
- IHI0022E (`sources/arm_axi.txt`): §C3.2.1 / Table C3-15 (RRESP[2] PassDirty, to the initiating master); §C3.7 (CRRESP[2] PassDirty: responsibility "passed to the initiating master or the interconnect"; ReadClean written back by the interconnect); §C4.2 (masters that support an external snoop filter broadcast allocations and evictions); §C10.3 (in-progress transactions can require the filter to track additional lines).
- IHI0050E.b §3.1, from a text extract of the stored PDF (`scratchpad/g29amba_r1/data/chi.txt`): "The SAM must provide a complete decode of the entire address space", followed by the recommendation that an address with no physical component goes to an agent that can give an error response.
- IEEE 1800-2023 (`sources/t1_lrm_clean.txt`): §16.5.1 (default sampled value), §16.9.3 (`$rose`/`$fell` at the first clocking event compare against the default sampled value), §16.12 (`disable iff` syntax).
- E-PWR-1 `index.mdx` "Stopping stimulus" (one owner per item; callbacks cannot abort a sequence), so the bank matches the lesson.

| Finding | Sev | Question | Resolution |
|---|---|---|---|
| acc 1 | S2 | soc-ral-firmware-prediction | **Fixed.** Missing prediction is now the single cause: auto-predict covers only bus operations the model starts through the map, never firmware traffic (§18.2.5.2), so CTRL keeps its old value. The get/get_mirrored_value point is a side note. The two are equal unless `set()` was called (§18.4.4.1), and `predict()` updates both (§18.4.4.15), so `get_mirrored_value()` alone would still read 0x0, and with a predictor `get()` reads 0x1. The rubric now rewards the single cause plus knowing that switching to `get_mirrored_value()` changes nothing. It lists "blames `get()`" as a weak answer. Added the common mistake "Thinking `get_mirrored_value()` would have shown 0x1 without a predictor". The "get() as a DUT read" mistake now says that `read()` or `peek()` does the read. Added a follow-up (`set(32'h5)` without `update()`) and sources §18.4.4.2, §18.4.4.15 and uvm-core `do_predict`. |
| acc 2 | S3 | soc-power-verification | **Fixed.** The quiesce flag is the preferred method. `kill()` / `stop_sequences()` are for abrupt power loss and need the driver's co-operation, with one owner per item. Either the driver finishes or aborts the item and calls `item_done()` before the sequences are stopped, or, after `stop_sequences()`, it abandons the item without `item_done()` and idles the interface in a reset/power-down branch of `run_phase`. The answer states the uvm-core 2020.3.1 `SQRBADITMDN` fatal. The rubric and a new common mistake match. |
| acc 3 | S3 | soc-power-verification | **Fixed.** Added `a_iso_release_after_restore: $fell(cpu_iso_en) \|-> cpu_restore_done`. `cpu_restore_done` is a PMU status bit, set when the restore completes, or, on a cold power-up with nothing to restore, when the domain reset completes; it is cleared at power-off. The text now says that the first and third assertions check the two invariants and the second checks that the restore starts while the domain is powered and isolated. I also added `disable iff (!pmu_rst_n)` to all three assertions, so the first tick cannot fail against the X default sampled value (§16.5.1, §16.9.3). |
| acc 4 | S3 | soc-coherency-verification | **Fixed.** The snoop-response hand-off now cites CRRESP[2], §C3.7. The initiator's RRESP[2] PassDirty keeps §C3.2.1, and the ReadClean write-back by the interconnect cites §C3.7 and §C5.3.2. Added a §C3.7 source entry. |
| acc 5 | S4 | soc-power-verification | **Fixed.** The source now reads "§14.2.5.11 kill; §15.3.2.14 stop_sequences". Added a uvm-core `uvm_sequencer.svh` source for the FIFO flush and `SQRBADITMDN`, labelled implementation behaviour. |
| acc 6 | S4 | soc-address-map-decode | **Fixed.** Now "(recommended, §3.1)". I re-verified the recommendation against the IHI0050E.b text extract, and the source entry now names both the rule and the recommendation. |
| acc 7 | S4 | soc-coherency-verification | **Fixed.** Follow-up 4 now reads: "(for example, it still lists a line whose Evict or WriteBack is in progress, or it always snoops a master that does not broadcast its evictions)". This is consistent with §C4.2 and §C10.3; the C10 source entry names §C10.3. |
| comp 2 | S3 | soc-agent-mode-reuse | **Fixed.** The passive path is now `env.spi_env.apb_agent` (the CPU drives the register port), and `env.flash_env.flash_agent` stays active as an SPI-VIP responder. Each bullet names its path. The wildcard sentence now says that mode is set per instance path, and that a broad `"*agent*"` sets every match alike. Follow-up 1 uses `cfg_seq` / `apb_sqr`. |
| comp 5 | S4 | soc-power-verification | **Fixed.** A testbench bullet and a common mistake now say that a callback does not stop a sequence by itself, and §15.3.2.14 is cited (see acc 5). |
| comp 6 | S4 | soc-security-verification | **Fixed.** Added a negative-test bullet labelled practice: a secure peripheral's interrupt reaches only the secure world, and non-secure software cannot mask, clear or observe it. Added a matching common mistake. |
| comp 7 | S4 | soc-block-to-system | **Fixed.** Added `A-UVM-4B_Advanced_RAL_Techniques/index` (root maps and `add_submap`). |
| comp 8 | S4 | soc-address-map-decode | **Fixed.** Added `B-AHB-1_AHB_Design_Timing_Mechanics/index` and `B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks/index`. |
| comp 9 | S4 | soc-emulation-strategy | **Fixed (without the optional snippet).** Added a paragraph labelled practice, naming no vendor: emulators use different architectures (custom silicon, commercial FPGAs), which changes compile time, capacity and debug visibility. Updated the rubric and added a common mistake. |
| comp 1 | S3 | (lead) tables and bold | **Not changed.** This is a renderer request for the lead. The ```` ```text ```` stop-gap applies only if the lead declines; it is carried as a lead request. |
| comp 3, 4, 10 | S3/S3/S4 | (lead / B-AMBA-F2) | **Not changed.** They are lead or cross-group items; see below. |

### Validation (fix round 1, 2026-10-18)

- `python3 -c "import json;json.load(open('content/interview-questions/soc-system-design.json'))"`: OK. The file re-serialises byte-identically with `indent=2, ensure_ascii=False`. The question ids and order are identical to the pre-edit copy.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, **873 tests passed**.
- Inline backticks are balanced in every line of every rubric, answer, follow-up and mistake, and fences are paired. All `modules` refs resolve under `content/curriculum/`.

### Ids removed or renamed

None.

### Lead requests (new or still open)

- comp 1: render `**bold**`, `- ` / `N. ` list runs and GFM pipe tables in `toRichBlocks` / `InlineText`. This bank has 4 tables. If the lead declines, the author will wrap them in ```` ```text ```` fences.
- comp 3: decide which bank gets an E-RISCV-1 question (ISS step-and-compare after an asynchronous interrupt).
- comp 4: B-AMBA-F2's coherency checker (`index.mdx:437`, `:532-533`) should treat dirty responsibility in transit as an owner.
- comp 10 and earlier rounds: the `visual?: {component, props}` schema field, the `debug` / `predict-output` categories, and B-AMBA-F2's MOESI heading.
