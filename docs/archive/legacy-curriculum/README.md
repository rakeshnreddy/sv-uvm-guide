# Legacy Curriculum Archive

_Updated: 2025-09-24_

This folder captures where the legacy Tier-1/Tier-2 UVM content was relocated so contributors can trace history without keeping duplicate curriculum nodes live in production.

## Retired Modules and Replacements

| Legacy Path | Status | Live Replacement |
| --- | --- | --- |
| `content/curriculum/uvm-core/fundamentals/base-classes.mdx` | merged | `T2_Intermediate/I-UVM-2_Building_TB` (base-class primer + mnemonic) |
| `content/curriculum/uvm-core/fundamentals/component-communication.mdx` | merged | `T2_Intermediate/I-UVM-2_Building_TB` (TLM harness cheat sheet) |
| `content/curriculum/uvm-core/fundamentals/factory.mdx` | merged | `T2_Intermediate/I-UVM-4_Factory_and_Overrides` |
| `content/curriculum/uvm-core/fundamentals/phasing.mdx` | merged | `T2_Intermediate/I-UVM-5_Phasing_and_Synchronization` |
| `content/curriculum/uvm-building/essentials/agents-and-environment.mdx` | merged | `T2_Intermediate/I-UVM-2_Building_TB` |
| `content/curriculum/uvm-building/essentials/analysis-components.mdx` | merged | `T2_Intermediate/I-UVM-2_Building_TB` |
| `content/curriculum/uvm-building/essentials/architecture-overview.mdx` | merged | `T2_Intermediate/I-UVM-2_Building_TB` (Quick Take + diagrams) |
| `content/curriculum/uvm-building/essentials/stimulus-generation.mdx` | merged | `T2_Intermediate/I-UVM-3_Sequences` |
| `content/curriculum/interactive-tools/uvm-visualizers/interactive-testbench.mdx` | replaced | Visualizer embedded directly in `I-UVM-2_Building_TB` |
| `content/curriculum/T1_Foundational/F2_Data_Types/index.mdx` | merged | `T1_Foundational/F2_SystemVerilog_Basics` (data type quick take + drills) |
| `content/curriculum/T1_Foundational/F2_SystemVerilog_Primer/index.mdx` | merged | `T1_Foundational/F2_SystemVerilog_Basics` (Digital Logic & HDL primer section) |
| `content/curriculum/T1_Foundational/F3_SystemVerilog_Intro/index.mdx` | merged | `T1_Foundational/F2_SystemVerilog_Basics` introduction & quick take |
| `content/curriculum/T1_Foundational/F3_Behavioral_RTL_Modeling/index.mdx` | merged | `T1_Foundational/F3_Procedural_Constructs` (redirect stub with note) |
| `content/curriculum/T1_Foundational/F4_Verification_Basics_without_UVM/index.mdx` | merged | `T1_Foundational/F1_Why_Verification` (Verification Essentials section) |
| `content/curriculum/T1_Foundational/F4_Your_First_Testbench/index.mdx` | moved | `labs/simple_dut/lab1_first_tb/` lab README |
| `content/curriculum/T1_Foundational/F5_Intro_to_OOP_in_SV/index.mdx` | merged | `T2_Intermediate/I-SV-1_OOP` Foundation Refresh section |

## Reviewer Notes
- Diagrams (`AnimatedUvmTestbenchDiagram`, `UvmComponentRelationshipVisualizer`, `UvmPhasingDiagram`) remain in use inside the Tier-2 lessons.
- Quiz content was consolidated into the Tier-2 modules to avoid duplicate assessments.
- If you need the original prose for SME review, refer to Git history prior to commit `cleanup-legacy-uvm`.

> When archiving additional legacy folders, extend this table so the coverage dashboard reflects a single canonical location per topic.
