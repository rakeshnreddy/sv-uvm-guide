# Next Action Tracker

This file consolidates open implementation and feedback items so the team has a single queue to reference between sessions. Update the status column as items progress and prune tasks once they are delivered.

## Status Legend
- `todo`: Not started.
- `in-progress`: Work underway or partially delivered.
- `blocked`: Waiting on another task or external dependency.
- `ready-for-review`: Awaiting verification/approval.

## Active Tasks
| ID | Status | Area | Summary | Notes |
|----|--------|------|---------|-------|
| `VIS-3D-MAILBOX` | `todo` | Visualizations | Build 3D mailbox vs queue arbitration scene showing head/tail pressure and outstanding transactions. | Mirror queue semantics and highlight backpressure cues before integrating into Practice. |
| `VIS-3D-COVERAGE` | `todo` | Visualizations | Create 3D coverage bin heat-map towers to illustrate sampling progress over time. | Reuse coverage data from Coverage Analyzer to drive bar heights and color intensity. |
| `VIS-3D-ANALYSIS` | `todo` | Visualizations | Model UVM analysis fan-out as a layered 3D lattice linking monitors, scoreboards, and subscribers. | Should pair with component relationships lesson to emphasize TLM connections. |
| `VIS-3D-DATAFLOW` | `todo` | Visualizations | Build a 3D UVM data-flow pipeline that traces transactions from sequencer to driver to monitor to scoreboard. | Include animated arrows and latency cues to highlight hand-offs across TLM ports. |
| `VIS-3D-CONSTRAINT` | `todo` | Visualizations | Prototype a 3D constraint solver state tree that highlights active branches during randomize() calls. | Use branching transparency to depict pruned paths and constraint weighting. |
| `VIS-3D-PHASE-TIMELINE` | `todo` | Visualizations | Animate phase timelines in 3D to show overlapping run/cleanup windows across components. | Could extend the blocking simulator with depth to convey phasing concurrency. |

## Curriculum Modernization Tasks

| Task ID | Summary | Status |
|---|---|---|
| `CURR-SPLIT-F2` | Split F2 lesson (SV Basics) into four parts | `complete` |
| `CURR-SPLIT-F4` | Split F4 lesson (RTL Constructs) into three parts | `complete` |
| `CURR-SPLIT-I-UVM-1` | Split I-UVM-1 lesson (UVM Intro) into three parts | `todo` |
| `CURR-SPLIT-I-UVM-2` | Split I-UVM-2 lesson (Build TB) into two parts | `todo` |
| `CURR-SPLIT-I-UVM-3` | Split I-UVM-3 lesson (Sequences) into two parts | `todo` |
| `CURR-SPLIT-I-SV-2` | Split I-SV-2 lesson (Randomization) into two parts | `todo` |
| `CURR-SPLIT-I-SV-3` | Split I-SV-3 lesson (Coverage) into two parts | `todo` |
| `CURR-SPLIT-I-SV-4` | Split I-SV-4 lesson (Assertions) into two parts | `todo` |
| `CURR-SPLIT-A-UVM-4` | Split A-UVM-4 lesson (RAL) into two parts | `todo` |
| `CURR-REFACTOR-F3` | Deprecate F3 lesson and merge into F2 | `todo` |
| `CURR-REFACTOR-I-UVM-4` | Deprecate I-UVM-4 lesson and merge into I-UVM-1B | `todo` |
| `CURR-REFACTOR-I-UVM-5` | Deprecate I-UVM-5 lesson and merge into I-UVM-1C | `todo` |
| `CURR-REFACTOR-A-UVM-1` | Deprecate A-UVM-1 lesson and merge into I-UVM-3B | `todo` |
| `CURR-REFACTOR-A-UVM-2` | Deprecate A-UVM-2 lesson and merge into I-UVM-1B | `todo` |
| `CURR-REFACTOR-A-UVM-3` | Deprecate A-UVM-3 lesson and create new Callbacks lesson | `todo` |
| `CURR-MODERNIZE-F1` | Modernize F1 lesson (Why Verification?) | `ready-for-review` |
| `CURR-MODERNIZE-F2` | Modernize F2 data types & structures into Quick Take flow with interactives. | `ready-for-review` |
| `CURR-MODERNIZE-I-SV-1` | Modernize I-SV-1 lesson (OOP) | `todo` |
| `CURR-MODERNIZE-E-PERF-1` | Modernize E-PERF-1 lesson (UVM Performance) | `todo` |

## Recently Completed
- See `docs/feature-log.md` for the running history of shipped work.

Update this section as additional work ships.
