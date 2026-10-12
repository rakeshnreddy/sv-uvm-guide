# G29-B-SOC completeness review, round 1: `soc-system-design.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-11. Read-only except for this file.

Inputs read: `docs/curriculum-quality/README.md`; `analysis/G29.md` (soc section, Coverage gaps, Requests for the lead); `analysis/G29.verify.md` (G29-SOC-01 adjustment, gap 7, notes for the author); `curriculum-spine.md` (E-SOC-1, E-EMU-1, E-PSS-1, E-PWR-1, E-RISCV-1, E-INT-1 cards); `reviews/G29-B-SOC.author.md`; the whole bank (21 questions) and its diff; the loader `src/app/(learning)/interview-prep/interview-banks.ts`.

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 3 S3, 7 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 4 files, 543 tests passed. The author's run showed 408; other banks have changed since then. |
| Every `modules` entry exists as `content/curriculum/*/<module>/<page>.mdx` | All 59 refs resolve (checked with glob) |
| Levels | junior 3, mid 5, senior 4, staff 7, senior-staff 2: at least 3 junior, and the levels run from junior to senior staff |
| Coding and waveform items carry code or a cycle table | `soc-firmware-tb-sync` (coding) has buggy code plus the fix. `soc-lost-response-liveness` and `soc-interconnect-id-mismatch` (waveform-debug) have cycle tables. |
| `follow_ups` and `common_mistakes` | Present on all 21 questions: 2–4 follow-ups and 3–4 mistakes each |
| Rubrics separate strong from weak answers | All 21 have a "strong answer" and a "weak answer" paragraph, and each weak paragraph names a specific misconception |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-SOC-01 (as adjusted by G29-V) | S2 | **Resolved.** The answer uses the ACE state names with the MOESI mapping noted. The invariants are Unique plus *any* other valid copy, a lone SC is legal, and at most one Dirty copy (checked against IHI0022E C1.2.3, the cache state rules in `scratchpad/axiE.txt`). It also covers the Table C5-8 end states, the snoop-vs-WriteBack race (C5.2.3), the overlapping CleanUnique (C4.10.3), snoop-filter accuracy, and exclusives. TSO/litmus testing is explicitly out of scope; barriers and DVM are separate checks. A checker code block was added. |
| Headline 3 (citations), as it applies to this bank | S2 | **Resolved.** No IHI0022H, IHI0050F or wrong 1800.2 clause numbers remain. Unverifiable sources are marked `verified: false`. |
| Navigation S2 (banks unreachable) | S2 | Lead-side. `/interview-prep` now loads this bank, and `modules` links every question to lessons. |
| SOC-02 to SOC-08 | S3/S4 | All addressed. SOC-03 is only partly done; see finding 1. |

## Coverage gaps assigned to `soc` (G29.md "Coverage gaps")

Each gap is filled: interrupts (junior and mid), reset and boot/RDC (senior), CDC (senior), security/AxPROT/firewalls (staff), performance/QoS (staff), HW/SW co-verification and PSS (staff), and emulation and FPGA prototyping (staff). The modules the analysis listed as unquestioned now have questions: B-AXI-3, B-AXI-4, B-AXI-6 and E-PSS-1. The three E-SOC-1 assessment misconceptions on the spine card (auto-predict and firmware, block scoreboards reused unchanged, closure as the union of block coverage) are each targeted. So are the three E-EMU-1 misconceptions and the E-PSS-1 misconceptions about an IEEE number, resources passed as inputs, and "PSS replaces UVM".

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | soc-address-map-decode | The sources cite "Arm IHI0050E.b (CHI) §3.1 (the System Address Map must provide a complete decode)", but no prompt, rubric or answer text mentions CHI or the SAM. The cited source supports no claim, and that part of the SOC-03 fix (CHI's complete-decode requirement) is missing from the content. The author log says it was added. | Add one bullet under "What else to cover": in CHI, each requester's System Address Map must provide a complete decode, so every address maps to some target, and holes go to a node that returns an error. Keep the source at `verified: false`. Alternatively, drop the source. | G29.md SOC-03; G29.verify.md item 6 (SOC-03 sources hold); `grep CHI` on the bank finds it only in `sources` and in a B-AMBA-F2 module name |
| 2 | S3 | soc-lost-response-liveness (also soc-signoff-strategy-review) | Both questions turn on weak vs strong sequences and `s_eventually`, but neither links I-SV-4B. The linked I-SV-4A covers only the "pending is not a failure" half, and says "Strong sequences and liveness are in I-SV-4B" (`I-SV-4A_SVA_Fundamentals/index.mdx:801`). | Add `I-SV-4B_Advanced_Temporal_Logic/index` to `modules` on both questions. Its objective 3 is "explain what weak and strong mean"; s_eventually is at :13 and :20. | `content/curriculum/T2_Intermediate/I-SV-4A…/index.mdx:166,801`; `I-SV-4B…/index.mdx:13,20,191` |
| 3 | S3 | (bank / lead) | E-RISCV-1 still has no question in any bank, and neither do E-AI-1, E-UVM-ML-1 or E-PYUVM-1 (grep of all six banks). G29.verify.md gap 1 lists E-RISCV-1 and E-AI-1 as uncovered modules with no proposed question. E-RISCV-1 sits immediately before E-SOC-1 (nav #67). A CPU core inside an SoC is a natural fit for this bank: ISS step-and-compare, asynchronous interrupts in a trace compare, and ISA coverage. | Lead decision. Either assign one E-RISCV-1 question (mid or senior) to this bank, for example "your trace compare against an ISS fails after an interrupt; why, and how do you make the compare robust?" (spine misconception 3), or assign it to another bank. Not blocking for this author, because the analysis did not assign it. | G29.verify.md "Completeness and depth gaps" item 1; spine E-RISCV-1 card |
| 4 | S4 | soc-power-verification | Follow-up 3 asks how to stop a running sequence safely, and the spine's first E-PWR-1 misconception is "callbacks can abort a running sequence". The model answer only says "stimulus … is quiesced first". | Add one line: stop stimulus with a quiesce flag that the sequence polls between items, or with `sequencer.stop_sequences()` / `seq.kill()` (kill removes the sequence's locks, grabs and requests: IEEE 1800.2-2020 §14.2.5.11, verified in `audit/uvm_lrm.txt`). Callbacks cannot abort a sequence. | Spine E-PWR-1 card; `uvm_lrm.txt` §14.2.5.11, §14.2.5.12 |
| 5 | S4 | soc-firmware-tb-sync | The `modules` list is E-SOC-1 and I-UVM-1C. A-UVM-8 teaches exactly this `wait_on` vs `wait_trigger` race, including a `fork + uvm_event` row that uses `wait_on()` (`A-UVM-8…/index.mdx:373,442-448,485-491`). | Add `A-UVM-8_Multi_Agent_Topologies/index`. Optionally add `I-SV-5_Synchronization_and_IPC/events` for the underlying SV event race. | Lesson grep |
| 6 | S4 | soc-interrupt-verification-plan | Follow-up 3, "turn a recovery write into stimulus that pre-empts background traffic", uses a term defined only inside I-UVM-3B/interrupt-handling, and has nothing to do with the plan in the prompt. | Reword: "Your interrupt-service sequence must write the clear register ahead of queued background traffic on the same sequencer. How (`grab()`/`lock()`, priority), and what goes wrong without it?" | `I-UVM-3B…/interrupt-handling.mdx:396` |
| 7 | S4 | soc-performance-qos | The Little's-law follow-up ("outstanding reads for 16 GB/s at 200 ns") gives no transaction size, so it cannot be answered with a count. | Add "using 64-byte reads": 16 GB/s × 200 ns = 3200 bytes, so 50 reads outstanding. | Arithmetic |
| 8 | S4 | soc-interconnect-id-mismatch | The cycle table prints IDs as `3` and `13`, while the prose and the error message use `0x3` and `0x13`. The answer depends on "port bits above a 4-bit ID", so a decimal reading of 13 confuses a junior or mid reader. | Label the ID rows "(hex)", or write `0x3` and `0x13` in the table. | Bank text |
| 9 | S4 | soc-staff-dma-system-design | "Test the stale-descriptor case the protocol permits" is vague: which protocol, and what is the expected outcome? | Reword: "with non-coherent DMA, also test firmware omitting the cache clean: the DMA must read the stale descriptor that is in memory, and the bench must predict from memory, not from the CPU's intended value." | Bank text |
| 10 | S4 | soc-address-map-decode | The boundary table skips the end of SEC_SRAM (`0x5000_FFFC`, and one past at `0x5001_0000`, which falls into an unmapped area) and the last SPI word (`0x4001_1FFC`). The rubric asks for "first and last byte of each region, the bytes on either side". | Add the two rows, so the model answer does what its own rubric asks. | Bank text |

## Deferred items (agree with the author)

- Linking visualizers needs the lead's `visual` schema field (G29-V gap 7). The cycle tables in `code` cover the waveform items for now. The analysis also suggested two pictures for this bank: an `<ArchitectureDiagram>` of the DMA environment and a `<SequenceDiagram>` of the ACE snoop flow. Carry both in the lead request.
- `debug`/`predict-output` categories. The loader already labels them, but `tests/interview-questions/bank-schema.test.ts` still allows only six categories, so this is the lead's decision.
- CHI flows belong in `amba-protocols.json`. IEEE 1801 and SCE-MI are cited with `verified: false` and kept at the level of method.
