# Model Solution: SoC Verification Strategy

This model answer is intentionally concise. A production strategy would link the verification plan (vplan), the IP integration checklist, the firmware bring-up plan and the formal property repository. Every number below (run times, timeouts, gates) is example project policy, not an industry standard.

## 1. Scope, Assumptions and Test Layers

SoC-owned verification covers behaviour that only appears after IP blocks are integrated: address decode, privilege policy, interrupt routing, shared-memory coherency, interconnect ordering, reset interactions, firmware-driven configuration, top-level connectivity and cross-master performance. Block teams remain responsible for deep protocol corner cases inside each IP. Firmware owns boot sequencing tests and driver-level checks, but UVM owns the observation and scoring infrastructure. Formal owns the unbounded liveness proofs (deadlock freedom, eventual response, reset convergence, interrupt delivery), security reachability and the connectivity check; simulation runs bounded safety versions of the same properties.

| Test layer | Processor model | What only this layer can catch | Reused from below |
| --- | --- | --- | --- |
| Block | none (bench plays the CPU) | protocol and datapath corner cases inside one IP | — |
| Subsystem (DMA + interconnect + memory) | BFM | routing, ID handling, DMA ordering, error responses | block envs nested, block virtual sequences |
| SoC | RTL CPU for boot and flows; ISS for long firmware runs | firmware flows, interrupt routing to cores, security policy, resets and power across blocks | subsystem envs, passive VIP, scoreboards |
| Emulation | RTL CPU | OS boot, long stress, performance | firmware tests |
| Silicon validation | real cores | analog, timing and long-run effects | firmware tests |

Assumptions to confirm:

- All block VIP can run in passive mode without source edits, and copies its mode into `is_active`.
- RAL models are delivered with predictor hooks and clean reset values.
- Firmware can emit boot phase markers and write mailbox progress codes.
- The interconnect exposes enough monitor points to correlate ingress and egress transactions.

## 2. Reuse Plan

The CPU cluster, DMA, PCIe and security subsystem environments are nested unchanged inside `soc_env`; each gets its configuration object one level deeper. Block virtual sequences run as children of SoC virtual sequences only where the bench still drives.

| Interface or IP | Who drives it in the SoC | SoC mode | Monitor placement | Reused checking (decision) | Activity evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| CPU cluster ACE/AXI | CPU cores | Passive | Cluster egress and interconnect (network on chip, NoC) ingress | Protocol and ordering checks (keep) | transfer count vs firmware contract | Coherency scoreboard needs line-state model |
| DMA AXI master | DMA engine | Passive | DMA master port and DDR egress | AXI checker (keep); descriptor scoreboard (adapt: descriptors from the APB monitor) | count per channel | Scatter-gather reference model required |
| PCIe endpoint, link side | off-chip link partner | Active (bench plays the link partner) | PCIe-to-NoC bridge ingress | Packet decode, completion status (keep) | completions per test | Error-injection hooks needed |
| Security controller APB | CPU firmware | Passive | APB bus and protected slave ingress | APB protocol monitor (keep); block policy scoreboard (disable: replaced by SoC policy scoreboard) | count | Policy scoreboard required |
| Boot flash pins | the chip's flash controller; the flash answers | Active responder (bench plays the flash) | flash pins | Command decode (keep) | boot reads seen | none |

Every passive VIP connection must prove activity: a per-monitor transfer count compared in `check_phase` with what the test or firmware contract promises, and an automatic build audit that fails if a firmware-owned interface has an active driver.

## 3. Firmware–Testbench Contract and Register Prediction

| Item | Decision |
| --- | --- |
| Image load | `$readmemh` into the boot ROM model before reset release; image chosen by a plusarg; image hash logged at time 0 |
| Mailbox | reserved SRAM word; codes BOOT_DONE, CFG_DONE, PASS, FAIL (reason in upper bits), PRINT; firmware writes, bench reads; codes in one shared package |
| Events | `uvm_event_pool::get_global` keys from the shared package; tests wait with `wait_on()` inside a watchdog sized from the firmware's worst-case boot time |
| Checks during boot | protocol checks and liveness always on; data scoreboards start at CFG_DONE |
| Register predictors | one per writing bus: CPU AXI, debug APB, PCIe inbound; auto-predict off |
| Memories and volatile fields | memories checked by scoreboards and backdoor reads (not predicted); status fields volatile, checked by the scoreboard that knows the hardware events |

## 4. Coverage Model and Traceability

System-level coverage avoids chasing unreachable block states. Each goal traces to a feature in the specification and to a named check. Required goals:

- `master x slave x response`: CPU, DMA, and PCIe hit DDR, SRAM, peripherals, secure region, and unmapped holes (check: routing scoreboard expects DECERR for holes, IHI0022E §A3.4.4).
- `interrupt_source x target_core x priority`: DMA, PCIe, timer, and security interrupts reach configured targets (check: interrupt checker).
- `descriptor_type x cache_state x completion_path`: DMA linear, chained, and error descriptors under clean, dirty, and invalid cache-line states (check: descriptor and coherency scoreboards).
- `master x privilege x region x response`: user, supervisor, and secure masters exercise allowed and denied regions, using `AxPROT` (IHI0022E §A4.7) (check: policy scoreboard).
- `reset_source x active_traffic_class`: warm reset, cold reset, and peripheral reset while reads, writes, and interrupts are outstanding (check: reset liveness and scoreboard flush accounting).
- `traffic_profile x latency_bucket x qos_class`: CPU-only, DMA-only, mixed, and PCIe-heavy loads meet latency thresholds (check: latency checker on ingress/egress timestamps).

Exit criteria: all planned system bins hit or waived with a written reachability reason and a reviewer, every goal linked to a check, no open P0/P1 scoreboard mismatches, and no unexplained coverage drop across two nightly regressions.

## 5. Formal and Liveness Plan

| Property | Kind | Trigger | Obligation | Failure meaning |
| --- | --- | --- | --- | --- |
| Accepted request eventually receives response | liveness in formal (`s_eventually`); bounded `##[1:N]` safety check in simulation, N from the interconnect's worst-case latency budget | AXI/ACE address handshake (for writes, the last W beat) | matching response or documented error | interconnect can lose or indefinitely stall a transaction |
| No channel-dependency cycle | liveness in formal | outstanding read/write with backpressure | at least one dependent channel can always make progress | circular wait deadlock |
| Reset convergence | liveness in formal; bounded in simulation | reset asserted with outstanding traffic | all outstanding queues drain or invalidate and outputs reach idle | reset leaves stale transactions alive |
| Interrupt eventual delivery | liveness in formal; bounded in simulation | enabled source asserts interrupt | target core sees pending interrupt or masked status is visible | lost interrupt or wrong router programming |
| Security isolation | safety (never) | denied access attempts protected region | request is blocked or returns error before protected slave side effects | privilege escape |

Liveness proofs need fairness assumptions (every slave eventually accepts), reviewed with the property. Simulation still stresses these behaviours, but a weak unbounded sequence in `assert property` never fails in simulation (IEEE 1800-2023 §16.12.2), so simulation uses the bounded versions.

## 6. System Scenarios

| Scenario | Stimulus | Check | Coverage evidence |
| --- | --- | --- | --- |
| Reset during traffic | each reset source during each traffic class | reset convergence; scoreboard flush; no stale completion | reset source x traffic class x transfer phase |
| Error injection | slave errors, decode errors, ECC errors from responders and firmware | right master gets the right error; status and interrupt agree; expected errors demoted and counted by a report catcher (IEEE 1800.2-2020 §6.6) | error type x master x response |
| Power transitions | firmware powers domains down and up with traffic pending | isolation and retention; no hang to an off domain | power state x traffic class |
| Concurrency | all masters together; interrupt storms | per-master scoreboards; ordering; liveness | master pairs x target |
| Connectivity | formal connectivity check from the integration spreadsheet | every listed connection proven | 100% of listed connections |
| CDC/RDC | structural CDC/RDC analysis, IP abstract models where supplied | clean report or reviewed waivers | report sign-off by the CDC owner |

## 7. Debug and Triage Workflow

Every failure artifact must include RTL hash, firmware hash, UVM hash, random seed, plusargs, test name, failing transaction ID, 2,000-cycle bus trace window, firmware boot phase, and waveform trigger file. Triage starts from the first point where observed behaviour diverged from expectation. The triage script then assigns an initial bucket, which a person confirms:

- Firmware: boot marker missing, illegal driver sequence, or stale firmware hash.
- UVM infrastructure: null config, a monitor whose transfer count is below the contract, RAL predictor mismatch with clean bus behaviour.
- RTL (initial bucket only): scoreboard mismatch, protocol violation, dropped response, or formal counterexample. A mismatch moves to the reference-model or test-intent bucket if the first divergence is there.
- Reference model: the model's prediction disagrees with the specification.
- Test intent: illegal scenario not allowed by the SoC integration contract.
- Tool/environment: simulator crash, license failure, or reproducibility failure across identical hashes.

The lead reviews all P0/P1 buckets daily and assigns owner plus next reproduction action.

## 8. Regression Plan and Closure Gates

| Suite | Runtime target | Trigger | Content | Gate |
| --- | --- | --- | --- | --- |
| Pull-request smoke | 15 minutes | every RTL/UVM/firmware change | boot, monitor activity counts, address decode, one DMA transfer | no fatal, all enabled monitors active |
| Nightly integration | 8 hours | nightly | randomized firmware tests, reset, interrupts, security, DMA, PCIe | no new P0/P1, coverage trend stable |
| Weekly stress | 48 hours | weekly | heavy backpressure, QoS, coherency, long random seeds | no deadlock, no unexplained timeout |
| Signoff | project milestone | release candidate | full vplan, formal proofs, performance and power/reset tests | all closure gates met |

| Closure gate | Threshold (example policy) | Owner |
| --- | --- | --- |
| vplan rows closed | 100% of P0 and P1 rows: check linked, coverage hit or waived with reviewer | SoC DV lead |
| Open failures | 0 open P0/P1; every other failure bucketed with an owner | SoC DV lead |
| Formal | all liveness and security properties proven or bounded with an agreed depth; 0 open counterexamples | formal lead |
| Regression stability | last 5 nightly runs with no new failure and no coverage drop | SoC DV lead |
| CDC/RDC | report clean or waivers reviewed | design lead |

## 9. Risk Register

| Risk | Mitigation | Exit criteria |
| --- | --- | --- |
| Passive VIP silently disconnected | per-monitor transfer counts checked against the contract; build audit | every enabled passive monitor observes expected smoke traffic |
| Firmware boot instability masks RTL bugs | boot phase markers and firmware-owned bucket | boot failures reproducible and separated from RTL checks |
| Interconnect (NoC) deadlock appears only under rare backpressure | formal liveness plus weekly backpressure stress | no open liveness counterexamples or stress timeouts |
| Coverage model chases unreachable block states | system-level coverage review and waiver policy | every waived bin has reachability rationale |
| Debug artifacts insufficient for ownership | mandatory artifact schema in CI | triage owner assigned without manual rerun for P0/P1 failures |

## 10. Peer Review Score

A strong answer scores 22 or higher out of 27, with no zero in coverage, formal/liveness, system scenarios, debug, or risk management. A staff-level answer explicitly trades off simulation, formal, firmware, and block reuse responsibilities, and justifies every agent mode by who drives the interface. A senior-staff answer also names the organizational review cadence, signoff owners, and escalation rules.
