# SoC Verification Strategy Template

## 1. Scope and Assumptions

- SoC scope:
- Block-owned scope:
- Firmware-owned scope:
- Formal-owned scope:
- Assumptions requiring confirmation:

## 2. Reusable VIP Plan

| Interface or IP | Block VIP owner | SoC mode | Monitor placement | Scoreboard or checker reused | Gaps |
| --- | --- | --- | --- | --- | --- |
| CPU cluster AXI/ACE | | Passive | | | |
| DMA AXI master | | Passive or active emulation | | | |
| PCIe endpoint | | Passive | | | |
| Security controller APB | | Passive | | | |

## 3. Coverage Model

| Coverage goal | Bins or crosses | Owner | Collection point | Exit criteria |
| --- | --- | --- | --- | --- |
| Address decode | master x slave x response | | | |
| Interrupt delivery | source x target core x priority | | | |
| DMA coherency | descriptor type x cache state x completion path | | | |
| Security policy | master x privilege x region x response | | | |
| Reset recovery | reset source x active traffic class | | | |
| QoS/performance | traffic profile x latency bucket x arbitration state | | | |

## 4. Formal and Liveness Plan

| Property | Trigger | Obligation | Failure meaning | Owner |
| --- | --- | --- | --- | --- |
| Accepted AXI request eventually receives response | | | | |
| No interconnect channel-dependency cycle | | | | |
| Reset eventually quiesces outstanding transactions | | | | |
| Interrupt source eventually reaches configured target | | | | |
| Security-denied access never reaches protected slave | | | | |

## 5. Debug and Triage Workflow

- Required evidence per failure:
  - RTL hash:
  - Firmware hash:
  - UVM/environment hash:
  - Random seed:
  - UVM plusargs:
  - Failing transaction window:
  - Firmware log window:
  - Waveform trigger:
- Bucketing rules:
  - Firmware:
  - UVM infrastructure:
  - RTL:
  - Test intent:
  - Tool or environment:

## 6. Regression Plan

| Suite | Runtime target | Trigger | Content | Gate |
| --- | --- | --- | --- | --- |
| Pull-request smoke | | | | |
| Nightly integration | | | | |
| Weekly stress | | | | |
| Signoff | | | | |

## 7. Risk Register

| Risk | Impact | Likelihood | Owner | Mitigation | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| Passive VIP silently disconnected | | | | | |
| Firmware boot instability masks RTL bugs | | | | | |
| NoC deadlock only appears under rare backpressure | | | | | |
| Coverage model chases unreachable block states | | | | | |
| Debug artifacts are insufficient for failure ownership | | | | | |

## 8. Peer Review Rubric

Score each row from 0 to 3.

| Area | 0 | 1 | 2 | 3 | Evidence |
| --- | --- | --- | --- | --- | --- |
| Scope clarity | Missing | Vague | Mostly clear | Clear ownership and assumptions | |
| VIP reuse | Missing | Active/passive mentioned | Modes and paths defined | Modes, owners, monitors, and checkers mapped | |
| Coverage | Missing | Scenario list only | Bins/crosses partly measurable | Measurable coverage with exit criteria | |
| Formal/liveness | Missing | Generic assertions | Some properties named | Trigger, obligation, failure meaning defined | |
| Debug | Missing | Manual waveform plan | Basic bucketing | Evidence package and ownership workflow defined | |
| Regression | Missing | One suite | Multiple suites | Smoke/nightly/stress/signoff gates defined | |
| Risk management | Missing | Risks listed | Mitigations partial | Owners, mitigations, and exit criteria defined | |

