# Model Solution: SoC Verification Strategy

This model answer is intentionally concise. A production strategy would include links to the V-plan, IP integration checklist, firmware bring-up plan, and formal property repository.

## 1. Scope and Assumptions

SoC-owned verification covers behavior that only appears after IP blocks are integrated: address decode, privilege policy, interrupt routing, shared-memory coherency, interconnect ordering, reset interactions, firmware-driven configuration, and cross-master performance. Block teams remain responsible for deep protocol corner cases inside each IP. Firmware owns boot sequencing tests and driver-level checks, but UVM owns the observation and scoring infrastructure. Formal owns bounded proofs for liveness, deadlock freedom, security reachability, and reset convergence.

Assumptions to confirm:

- All block VIP can run in passive mode without source edits.
- RAL models are delivered with predictor hooks and clean reset values.
- Firmware can emit boot phase markers and write scratchpad progress codes.
- The interconnect exposes enough monitor points to correlate ingress and egress transactions.

## 2. Reusable VIP Plan

| Interface or IP | SoC mode | Monitor placement | Reused checking | Gap |
| --- | --- | --- | --- | --- |
| CPU cluster ACE/AXI | Passive | Cluster egress and NoC ingress | Protocol and ordering checks | Coherency scoreboard needs line-state model |
| DMA AXI master | Passive | DMA master port and DDR egress | AXI checker, descriptor scoreboard | Scatter-gather reference model required |
| PCIe endpoint | Passive | PCIe-to-NoC bridge ingress | Packet decode, completion status | Error-injection hooks needed |
| Security controller APB | Passive | APB bus and protected slave ingress | APB protocol monitor | Policy scoreboard required |

Every passive VIP connection must prove activity with a heartbeat coverpoint: at least one observed transaction per enabled interface in smoke tests, and no active driver construction for firmware-owned interfaces.

## 3. Coverage Model

System-level coverage avoids chasing unreachable block states. Required goals:

- `master x slave x response`: CPU, DMA, and PCIe hit DDR, SRAM, peripherals, secure region, and unmapped holes.
- `interrupt_source x target_core x priority`: DMA, PCIe, timer, and security interrupts reach configured targets.
- `descriptor_type x cache_state x completion_path`: DMA linear, chained, and error descriptors under clean, dirty, and invalid cache-line states.
- `master x privilege x region x response`: user, supervisor, and secure masters exercise allowed and denied regions.
- `reset_source x active_traffic_class`: warm reset, cold reset, and peripheral reset while reads, writes, and interrupts are outstanding.
- `traffic_profile x latency_bucket x qos_class`: CPU-only, DMA-only, mixed, and PCIe-heavy loads meet latency thresholds.

Exit criteria: all planned system bins hit or waived with a written reachability reason, no open P0/P1 scoreboard mismatches, and no unexplained coverage drop across two nightly regressions.

## 4. Formal and Liveness Plan

| Property | Trigger | Obligation | Failure meaning |
| --- | --- | --- | --- |
| Accepted request eventually receives response | AXI/ACE address handshake | matching response or documented error within bounded time | interconnect can lose or indefinitely stall a transaction |
| No channel-dependency cycle | outstanding read/write with backpressure | at least one dependent channel can always make progress | circular wait deadlock |
| Reset convergence | reset asserted with outstanding traffic | all outstanding queues drain or invalidate and outputs reach idle | reset leaves stale transactions alive |
| Interrupt eventual delivery | enabled source asserts interrupt | target core sees pending interrupt or masked status is visible | lost interrupt or wrong router programming |
| Security isolation | denied access attempts protected region | request is blocked or returns error before protected slave side effects | privilege escape |

Simulation still stresses these behaviors, but formal owns the high-confidence liveness and unreachable-state arguments.

## 5. Debug and Triage Workflow

Every failure artifact must include RTL hash, firmware hash, UVM hash, random seed, plusargs, test name, failing transaction ID, 2,000-cycle bus trace window, firmware boot phase, and waveform trigger file. The triage script creates initial buckets:

- Firmware: boot marker missing, illegal driver sequence, or stale firmware hash.
- UVM infrastructure: null config, disconnected monitor heartbeat, RAL predictor mismatch with clean bus behavior.
- RTL: scoreboard mismatch, protocol violation, dropped response, or formal counterexample.
- Test intent: illegal scenario not allowed by the SoC integration contract.
- Tool/environment: simulator crash, license failure, or reproducibility failure across identical hashes.

The lead reviews all P0/P1 buckets daily and assigns owner plus next reproduction action.

## 6. Regression Plan

| Suite | Runtime target | Trigger | Content | Gate |
| --- | --- | --- | --- | --- |
| Pull-request smoke | 15 minutes | every RTL/UVM change | boot, monitor heartbeat, address decode, one DMA transfer | no fatal, all enabled monitors active |
| Nightly integration | 8 hours | nightly | randomized firmware tests, reset, interrupts, security, DMA, PCIe | no new P0/P1, coverage trend stable |
| Weekly stress | 48 hours | weekly | heavy backpressure, QoS, coherency, long random seeds | no deadlock, no unexplained timeout |
| Signoff | project milestone | release candidate | full V-plan, formal proofs, performance and power/reset tests | all P0/P1 closed, waivers reviewed |

## 7. Risk Register

| Risk | Mitigation | Exit criteria |
| --- | --- | --- |
| Passive VIP silently disconnected | monitor heartbeat coverpoints and build log audit | every enabled passive monitor observes expected smoke traffic |
| Firmware boot instability masks RTL bugs | boot phase markers and firmware-owned bucket | boot failures reproducible and separated from RTL checks |
| NoC deadlock appears only under rare backpressure | formal liveness plus weekly backpressure stress | no open liveness counterexamples or stress timeouts |
| Coverage model chases unreachable block states | system-level coverage review and waiver policy | every waived bin has reachability rationale |
| Debug artifacts insufficient for ownership | mandatory artifact schema in CI | triage owner assigned without manual rerun for P0/P1 failures |

## 8. Peer Review Score

A strong answer scores 18 or higher out of 21, with no zero in coverage, formal/liveness, debug, or risk management. A staff-level answer explicitly trades off simulation, formal, firmware, and block reuse responsibilities. A senior-staff answer also names the organizational review cadence, signoff owners, and escalation rules.

