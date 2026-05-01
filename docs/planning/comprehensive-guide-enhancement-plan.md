# Comprehensive Guide Enhancement Plan

Produced: 2026-04-26  
Last Updated: 2026-04-30
Status: Complete

## Summary

The audit-derived comprehensive guide enhancement backlog has been completed. The workstream upgraded `sv-uvm-guide` from a broad SV/UVM curriculum into a source-backed learning and interview-preparation guide for junior through staff/senior-staff verification engineers.

The active pending-task source is now `TASKS.md`. This planning document is retained only as historical context for the completed guide-enhancement wave.

## Completed Outcomes

- Corrected high-priority technical accuracy issues around AHB `HREADY`/`HREADYOUT`, AXI 4 KB burst boundaries, WRAP alignment, SV scheduling regions, SVA `$past`, and UVM phasing.
- Added or expanded staff/senior-level content for AMBA, ACE/CHI coherency, SoC verification strategy, debug, PSS, pyUVM, emulation, AI-assisted verification, RISC-V verification, and bridge integration.
- Added interview-question banks with rubrics and model answers for SystemVerilog, UVM, SVA/Formal, Debug, SoC/System Design, and AMBA.
- Added and registered advanced labs and capstones, including AXI deadlock, AHB-to-AXI bridge debug, mini UVM capstone, SoC strategy, scoreboard reference model, and PSS portable intent.
- Expanded flashcard coverage across advanced/expert modules and AMBA protocol topics.
- Added quality gates for source metadata, lab registry health, flashcard/deck integrity, and Playwright regression coverage for learner navigation flows.

## Source Policy For Future Work

Use primary sources for normative protocol, language, and UVM claims:

| Area | Required primary source |
|---|---|
| AXI/ACE | Arm AMBA AXI and ACE Protocol Specification, IHI0022H |
| AHB-Lite | Arm AMBA 3 AHB-Lite Protocol Specification, IHI0033B or current Arm-hosted revision |
| CHI | Arm AMBA 5 CHI Architecture Specification, IHI0050F or current Arm-hosted revision |
| SystemVerilog/SVA | IEEE 1800-2023 SystemVerilog standard |
| UVM | IEEE 1800.2-2020 UVM standard and Accellera UVM resources |
| PSS | IEEE 2401-2024 Portable Stimulus Standard and Accellera PSS resources |

Vendor documentation is acceptable for methodology examples. Blogs, forums, and university notes are tertiary and must be labeled as such.

## Next Planning Trigger

Start a new planning document only when a new audit or user-approved workstream introduces concrete pending tasks. Do not re-open this completed plan for active task tracking.
