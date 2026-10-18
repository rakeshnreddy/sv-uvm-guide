# SoC Verification Strategy Template

Fill in every section. Where a number is project policy (a timeout, a gate, a run time), write the number and say who agreed it.

## 1. Scope, Assumptions and Test Layers

- SoC scope (bugs that only exist between blocks):
- Block-owned scope:
- Subsystem-owned scope:
- Firmware-owned scope:
- Formal-owned scope:
- Assumptions requiring confirmation:

| Test layer | Processor model (RTL, ISS, BFM or none) | What only this layer can catch | Reused from the layer below |
| --- | --- | --- | --- |
| Block | | | |
| Subsystem | | | |
| SoC | | | |
| Emulation or FPGA | | | |
| Silicon validation | | | |

## 2. Reuse Plan (Environments and Agents)

Nested environments (which block or subsystem envs become children of the SoC env, and what configuration changes):

-

| Interface or IP | Block VIP owner | Who drives it in the SoC test | SoC mode (active, passive, disabled) | Monitor placement | Scoreboard or checker reused: keep, adapt or disable | Evidence it is observing (count or coverage) | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CPU cluster AXI/ACE | | | Passive | | | | |
| DMA AXI master | | | Passive | | | | |
| PCIe endpoint (link side) | | | | | | | |
| Security controller APB | | | Passive | | | | |
| Off-chip device pins (for example a boot flash) | | | | | | | |

## 3. Firmware–Testbench Contract and Register Prediction

| Item | Decision |
| --- | --- |
| Image load (how, when, image hash logged) | |
| Mailbox address and codes (writer and reader of each) | |
| Events, pool keys, wait method and timeouts | |
| What is checked before and after boot completes | |
| Register predictors (one per bus that can write registers, with its map) | |
| Memories and volatile fields (how they are checked) | |

## 4. Coverage Model and Traceability

| Feature (spec reference) | Scenario | Check | Coverage goal (bins or crosses) | Owner | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| Address decode | | | master x slave x response | | |
| Interrupt delivery | | | source x target core x priority | | |
| DMA coherency | | | descriptor type x cache state x completion path | | |
| Security policy | | | master x privilege x region x response | | |
| Reset recovery | | | reset source x active traffic class | | |
| QoS/performance | | | traffic profile x latency bucket x arbitration state | | |

## 5. Formal and Liveness Plan

For each property, say whether it is a **liveness** property (proven unbounded in formal, for example with `s_eventually`) or a **bounded safety** check (`##[1:N]`, used in simulation), and why N is what it is.

| Property | Kind (liveness or bounded safety) | Trigger | Obligation | Failure meaning | Owner |
| --- | --- | --- | --- | --- | --- |
| Accepted AXI request eventually receives response | | | | | |
| No interconnect channel-dependency cycle | | | | | |
| Reset eventually quiesces outstanding transactions | | | | | |
| Interrupt source eventually reaches configured target | | | | | |
| Security-denied access never reaches protected slave | | | | | |

## 6. System Scenarios

| Scenario | Stimulus | Check | Coverage evidence | Owner |
| --- | --- | --- | --- | --- |
| Reset during traffic | | | | |
| Error injection (with expected-error accounting) | | | | |
| Power-state transitions with traffic pending | | | | |
| Concurrency stress (all masters, interrupt storms) | | | | |
| Top-level connectivity | | | | |
| CDC/RDC sign-off (structural analysis, waivers, reviewer) | | | | |

## 7. Debug and Triage Workflow

- Required evidence per failure:
  - RTL hash:
  - Firmware hash:
  - UVM/environment hash:
  - Random seed:
  - UVM plusargs:
  - Failing transaction window:
  - Firmware log window:
  - Waveform trigger:
- How the first divergence is found:
- Bucketing rules:
  - Firmware:
  - UVM infrastructure:
  - RTL:
  - Reference model:
  - Test intent:
  - Tool or environment:

## 8. Regression Plan and Closure Gates

| Suite | Runtime target | Trigger | Content | Gate |
| --- | --- | --- | --- | --- |
| Pull-request smoke | | | | |
| Nightly integration | | | | |
| Weekly stress | | | | |
| Signoff | | | | |

Closure gates (at least three, each with a number where one applies and an owner):

| Gate | Threshold (project policy) | Owner | Evidence |
| --- | --- | --- | --- |
| | | | |
| | | | |
| | | | |

## 9. Risk Register

| Risk | Impact | Likelihood | Owner | Mitigation | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| Passive VIP silently disconnected | | | | | |
| Firmware boot instability masks RTL bugs | | | | | |
| Interconnect (network on chip, NoC) deadlock only appears under rare backpressure | | | | | |
| Coverage model chases unreachable block states | | | | | |
| Debug artifacts are insufficient for failure ownership | | | | | |

## 10. Peer Review Rubric

Score each row from 0 to 3, and write the evidence (a section and line of your plan) for every score.

| Area | 0 | 1 | 2 | 3 | Evidence |
| --- | --- | --- | --- | --- | --- |
| Scope clarity | Missing | Vague | Mostly clear | Clear ownership, assumptions and test layers | |
| VIP reuse | Missing | Active/passive mentioned | Modes and paths defined | Modes justified by who drives each interface; owners, monitors, checker decisions and activity evidence mapped | |
| Firmware contract | Missing | Mailbox mentioned | Codes and events defined | Codes, events, timeouts and one predictor per writing bus defined | |
| Coverage and traceability | Missing | Scenario list only | Bins/crosses partly measurable | Every goal traced from a feature to a check, with exit criteria | |
| Formal/liveness | Missing | Generic assertions | Some properties named | Trigger, obligation, failure meaning and liveness vs bounded kind defined | |
| System scenarios | Missing | Reset only | Several scenarios | Reset, errors, power, concurrency, connectivity and CDC/RDC each with a check and evidence | |
| Debug | Missing | Manual waveform plan | Basic bucketing | Evidence package, first-divergence triage and ownership workflow defined | |
| Regression and gates | Missing | One suite | Multiple suites | Smoke/nightly/stress/signoff suites plus numeric gates with owners | |
| Risk management | Missing | Risks listed | Mitigations partial | Owners, mitigations and exit criteria defined | |
