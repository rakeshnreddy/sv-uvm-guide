# Capstone: Staff-Level SoC Verification Strategy Review

This capstone belongs to [E-SOC-1: SoC-Level Verification Strategies](/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/index). It is the planning step of the milestone M8 code capstone, a DMA subsystem bench (`dma-1`, planned and not yet available): the strategy you write here is the one that bench would implement.

## Scenario

You are the verification lead for a new application SoC. The design includes:

- Two coherent CPU clusters.
- One AXI DMA engine with scatter-gather descriptors.
- One PCIe endpoint.
- One security controller that gates access to protected peripherals.
- A shared AXI/ACE-capable interconnect.
- DDR, SRAM, boot ROM, and peripheral register space.
- Boot firmware that configures clocks, resets, interrupts, DMA descriptors, and security policy.

The block teams already have local UVM environments. Your task is not to write one more test. Your task is to create the staff-level verification strategy that decides what must be reused, what must be newly checked at SoC scope, how coverage closes, how deadlocks and liveness are proven, and how failures are triaged.

## Deliverables

Complete `strategy_template.md` with:

1. **Scope, assumptions and test layers** - what is in scope, what remains block-owned, what is delegated to firmware or formal, and which processor model each test layer uses.
2. **Reuse plan** - which environments are nested, the mode of every agent justified by who drives each interface (passive where an on-chip master drives, active where the bench plays an off-chip device), monitor placement, a keep/adapt/disable decision for each reused checker, and the evidence that each passive monitor is really observing.
3. **Firmware–testbench contract and register prediction** - image load, mailbox codes, events and timeouts, and one register predictor per bus that can write registers.
4. **Coverage model and traceability** - system goals traced from features to checks: cross-coverage, performance/QoS, security, reset, and firmware interactions.
5. **Formal and liveness plan** - deadlock freedom, response eventuality, reset convergence, and interrupt delivery, each marked as an unbounded liveness proof or a bounded safety check.
6. **System scenarios** - reset during traffic, error injection with expected-error accounting, power transitions, concurrency, connectivity, and CDC/RDC sign-off.
7. **Debug and triage workflow** - evidence captured per failure, first-divergence triage, bucketing rules, and escalation path.
8. **Regression plan and closure gates** - pull-request smoke, nightly, weekly stress, and signoff suites, plus numeric closure gates with owners.
9. **Risk register** - top risks, owner, mitigation, and exit criteria.
10. **Peer review rubric** - score your own plan, with evidence for every row.

Score your plan against the rubric **before** you open `model_solution.md`. Do not copy the model answer; use it as a staff-level calibration artifact after your own review.

## Acceptance Criteria

- The plan distinguishes block-level, subsystem-level, and SoC-level responsibilities.
- At least five system-level coverage goals are defined with measurable bins or crosses.
- At least four formal/liveness properties are listed with trigger, obligation, and failure meaning.
- Debug workflow includes firmware hash, RTL hash, random seed, UVM plusargs, failing transaction window, and owner bucketing.
- Regression plan separates smoke, nightly, stress, and signoff gates.
- At least three closure gates have a number (where one applies) and a named owner, and are labelled as project policy.
- Every agent's mode is justified by who drives its interface in the SoC, and at least one interface keeps an active agent.
- Every liveness property says whether it is an unbounded liveness proof (formal) or a bounded safety check (simulation).
- Risk register includes at least five risks and names concrete mitigation actions.
- Peer review rubric is filled out with evidence, not opinions.

## Review Questions

1. Which block-level coverpoints should explicitly not be chased at SoC scope?
2. What evidence proves that passive VIP reuse is working instead of silently disconnected?
3. Which liveness property would catch an interconnect (network on chip, NoC) channel-dependency deadlock earlier than simulation timeout?
4. How do you decide whether a failure belongs to firmware, UVM infrastructure, RTL, or test intent?
5. What is the minimum signoff evidence before the strategy is ready for senior-staff review?

## References

- IEEE 1800.2-2020: §13.3 (environments reused as sub-environments), §13.4.2.2 (`is_active`), §6.6 (report catchers for expected errors), §10.1.1.2.2 (`wait_on`), §18.2.5.2 (auto-prediction), §19.3 (register predictor).
- IEEE 1800-2023: §16.12.2 (weak and strong sequences), §16.12.13 (`s_eventually`), §16.14 (assert, assume and cover).
- Arm AMBA AXI and ACE Protocol Specification, issue E (IHI0022E): §A3.4.4 (DECERR from the interconnect), §A4.7 (access permissions, `AxPROT`), §A5.3.5 (interconnect use of transaction IDs).

