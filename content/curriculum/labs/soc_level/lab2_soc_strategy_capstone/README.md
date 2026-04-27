# Capstone: Staff-Level SoC Verification Strategy Review

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

1. **Scope and assumptions** - what is in scope, what remains block-owned, and what is delegated to firmware or formal.
2. **Reusable VIP plan** - active/passive agent strategy, RAL model ownership, and monitor placement.
3. **Coverage model** - system scenarios, cross-coverage, performance/QoS, security, reset, and firmware interactions.
4. **Formal and liveness plan** - deadlock freedom, response eventuality, reset convergence, and interrupt delivery properties.
5. **Debug and triage workflow** - evidence captured per failure, bucketing rules, and escalation path.
6. **Regression plan** - pull-request smoke, nightly, weekly stress, and signoff suites.
7. **Risk register** - top risks, owner, mitigation, and exit criteria.
8. **Signoff rubric** - concrete pass/fail criteria for strategy review.

Use `model_solution.md` after you draft your own answer. Do not copy it first; use it as a staff-level calibration artifact.

## Acceptance Criteria

- The plan distinguishes block-level, subsystem-level, and SoC-level responsibilities.
- At least five system-level coverage goals are defined with measurable bins or crosses.
- At least four formal/liveness properties are listed with trigger, obligation, and failure meaning.
- Debug workflow includes firmware hash, RTL hash, random seed, UVM plusargs, failing transaction window, and owner bucketing.
- Regression plan separates smoke, nightly, stress, and signoff gates.
- Risk register includes at least five risks and names concrete mitigation actions.
- Peer review rubric is filled out with evidence, not opinions.

## Review Questions

1. Which block-level coverpoints should explicitly not be chased at SoC scope?
2. What evidence proves that passive VIP reuse is working instead of silently disconnected?
3. Which liveness property would catch a NoC channel-dependency deadlock earlier than simulation timeout?
4. How do you decide whether a failure belongs to firmware, UVM infrastructure, RTL, or test intent?
5. What is the minimum signoff evidence before the strategy is ready for senior-staff review?

## References

- IEEE 1800.2-2020, UVM component configuration, report handling, and TLM connectivity.
- IEEE 1800-2023, assertion constructs for assume/assert/cover strategies.
- Arm AMBA AXI and ACE Protocol Specification IHI0022H, channel response and interconnect behavior for AXI/ACE systems.

