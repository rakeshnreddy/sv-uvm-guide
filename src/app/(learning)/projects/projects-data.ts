/**
 * Project briefs for /projects: one capstone-style project per milestone on
 * the ladder (MILESTONES in src/lib/learning-paths.ts, defined in
 * docs/audit/2026-10-03-learning-outcomes/tb-mastery-progression.md).
 *
 * Lessons are `<ModuleFolder>/<lesson>` refs and labs are lab registry ids.
 * The page resolves both through src/lib/practice-links.ts, and
 * tests/app/projects-page.test.tsx checks that every one resolves, so a brief
 * cannot link a lesson or lab that does not exist.
 *
 * Plain data, no imports of values: safe to read from a test.
 */
import type { MilestoneId } from '@/lib/learning-paths';

export interface ProjectBrief {
  milestone: MilestoneId;
  /** What the learner sets out to show, in one or two sentences. */
  goal: string;
  /** The design under test the learner writes (or reuses) for the project. */
  dut: { name: string; description: string };
  requiredFeatures: string[];
  /** Pass/fail checks the learner runs against their own testbench. */
  acceptance: string[];
  /** Lessons that prepare the project, as practice-links lesson refs. */
  lessons: string[];
  /** Labs that prepare the project, as lab registry ids. */
  labs: string[];
  stretch: string[];
  /** Honest effort range, for someone who has finished the preparing lessons. */
  effort: string;
  /** Which simulator the project needs. */
  tools: string;
  /** Optional source note for protocol rules the brief relies on. */
  sources?: string[];
}

const PLAIN_SV_TOOLS =
  'Plain SystemVerilog with no UVM. Any simulator works, including Verilator 5 with --timing.';
const UVM_TOOLS = 'A simulator that compiles and runs uvm-core 2020.3.1 (IEEE 1800.2-2020).';

export const PROJECT_BRIEFS: readonly ProjectBrief[] = [
  {
    milestone: 'M0',
    goal: 'Write a directed testbench that decides pass or fail on its own, so that nobody has to read a waveform to know whether the design under test (DUT) works.',
    dut: {
      name: '4-bit up counter',
      description:
        'Inputs clk, rst_n (synchronous, active low) and en; output q[3:0]. On each rising edge q clears when rst_n is low, counts up when en is high, and holds otherwise. It wraps from 15 to 0.',
    },
    requiredFeatures: [
      'A clock generator and a reset sequence at the start of the test.',
      'Inputs (rst_n and en) driven on the falling edge of clk, never with a blocking assignment at the rising edge; a comment says why.',
      'An expected value kept in the testbench (TB) and checked once per cycle, on the falling edge, when q has settled: first update the expected value for the rising edge that has just passed, using the inputs the TB drove at the previous falling edge, then compare it with q, then drive the next inputs. Do not compare q in a process woken by @(posedge clk): it runs before the DUT\'s nonblocking update of q, so it reads the value from before the edge.',
      'A pass and a fail counter; every mismatch prints the time, the expected value and the actual value with $error.',
      'Directed cases for counting, holding with en low, wrapping from 15 to 0 and a reset in the middle of a count.',
      'A final summary line, PASS=<n> FAIL=<m>, followed by $finish.',
    ],
    acceptance: [
      'On the clean DUT the last line matches PASS=<n> FAIL=0 with n greater than zero.',
      'A run that made no checks fails: PASS=0 is a failure, not a pass.',
      'With bit 2 of q stuck at 0 the TB reports FAIL greater than zero.',
      'With the wrap removed (q saturating at 15) the TB reports FAIL greater than zero.',
      'With en ignored (always counting) the TB reports FAIL greater than zero.',
    ],
    lessons: [
      'F1B_The_Verification_Mindset/index',
      'F2C_Procedural_Code_and_Flow_Control/index',
      'F2D_Reusable_Code_and_Parallelism/index',
      'F2E_First_Self_Checking_Testbench/index',
    ],
    labs: ['simple-dut-1', 'basics-1'],
    stretch: [
      'Parameterize the width and run the same TB at 4 and 8 bits.',
      'Add a phase with a random en pattern from $urandom, and print the seed so a failure can be repeated.',
      'Write a small script that builds each bug above as a mutant and checks that every one fails.',
    ],
    effort: '3 to 5 hours',
    tools: PLAIN_SV_TOOLS,
  },
  {
    milestone: 'M1',
    goal: 'Build a TB whose results cannot depend on simulator scheduling order: every drive and every sample goes through a clocking block in an interface.',
    dut: {
      name: 'Two-stage pipeline',
      description:
        'Inputs rst_n (synchronous, active low), in_valid and in_data[7:0]; outputs out_valid and out_data[7:0]. Both stages are flip-flops clocked on the rising edge of clk. An input is accepted at a rising edge where rst_n and in_valid are both high. Two rising edges later, out_valid is high and out_data equals in_data + 1 (modulo 256). A rising edge with rst_n low clears both stages.',
    },
    requiredFeatures: [
      'An interface pipe_if that declares rst_n, in_valid and in_data with initial values (rst_n = 0, in_valid = 0), so reset is asserted from time 0. It has two clocking blocks, both on @(posedge clk): drv_cb, with output skew #0 (the default) or any skew shorter than one clock period, drives rst_n, in_valid and in_data; mon_cb, with the default input skew #1step, samples all five DUT signals. It also has modports for the driver and the monitor.',
      'A driver that drives DUT inputs only through drv_cb, and a monitor that samples only through mon_cb. Each one runs a single loop that waits for exactly one clocking block event per clock cycle (@(vif.drv_cb) or @(vif.mon_cb)) and does all of its work for that cycle right after the wait. No ## cycle delay is used on a drive.',
      'Two private cycle counters, one per process, never shared: the driver adds 1 to drv_cycle as the first statement after each @(vif.drv_cb), and the monitor adds 1 to mon_cycle as the first statement after each @(vif.mon_cb). Both start at 0 at time 0, and both clocking blocks use the same clocking event, so at the k-th rising edge both counters equal k. Do not share one counter between processes: the driver and the monitor wake in the same time step, and whether one of them sees a value the other has just updated depends on process order (IEEE 1800-2023, 14.10 and 4.7).',
      'Intended-cycle stamping: in the cycle where drv_cycle is c, the driver drives an item and pushes {in_data, accept = c + 1} onto a sent queue. The stamp is c + 1 because a #0-skew drive updates the signal in the Re-NBA region of edge c (IEEE 1800-2023, 14.16), after the DUT flip-flops have already sampled at edge c. The DUT therefore accepts the input at edge c + 1, and that is also the edge at which mon_cb first sees in_valid high (an input skew of #1step samples the value from just before the edge, 14.13). On the clean DUT the stamp equals the mon_cycle at which mon_cb first sees in_valid high for that item. A nonzero output skew shorter than one period gives the same stamp. In a cycle where the driver drives rst_n low, it also drives in_valid low and pushes nothing.',
      'A monitor that does three steps, in this order, after each mon_cb event (k is the mon_cycle value). Step 1, outputs: if mon_cb.out_valid === 1, pop the head of the expected-output queue and flag an error if the queue is empty, if out_data differs or if the item is not due at k. If out_valid is not 1 while the head item is due at k, pop that item and flag an error. Step 2, inputs: if mon_cb.rst_n and mon_cb.in_valid are both 1, pop the head of the sent queue and flag an error if the queue is empty, if in_data differs or if its stamp is not k (the intended-cycle check). Then push {in_data + 1, due = k + 2} onto the expected-output queue (the latency check). Step 3, reset: if mon_cb.rst_n is 0, delete every item left in the expected-output queue, because the reset at this edge clears both stages. Step 1 runs first, so an output that is already valid at this edge is still checked.',
      'Each queue is written in one time step and read in a later one: the driver pushes at edge c and the monitor pops at edge c + 1 at the earliest. So no result depends on which process runs first within a time step.',
      'An end-of-test check that the sent queue and the expected-output queue are both empty, so an input that is never accepted or an output that never arrives counts as a failure. Run at least two idle cycles after the last item before this check.',
      'Back-to-back inputs, inputs with idle cycles between them and a reset in the middle of traffic (rst_n low for at least one cycle while items are still in the pipeline).',
      'The same PASS=<n> FAIL=<m> summary as M0.',
      'A short note (a paragraph in the README is enough) that explains why a blocking drive at the rising edge (the experiment below) can give results that depend on source order.',
    ],
    acceptance: [
      'On the clean DUT: PASS=<n> FAIL=0 with n greater than zero.',
      'Mutant 1, both DUT stages are clocked on the falling edge of clk instead of the rising edge: FAIL greater than zero. The values are unchanged, but an input driven at edge c is captured at the next falling edge and reaches out_valid after the falling edge after that. So mon_cb sees out_valid one rising edge early (at k + 1 for an input accepted at k), and the latency check catches it.',
      'Mutant 2, the DUT has one extra cycle of latency: FAIL greater than zero (the latency check catches it: out_valid is not 1 at the edge where the item is due).',
      'Mutant 3, a TB mutant: the driver bypasses drv_cb and drives each item one cycle later than the cycle it stamped (for example with a blocking assignment after the next @(posedge clk)). FAIL greater than zero (the intended-cycle check catches it: mon_cb first sees the input one edge after its stamp).',
      'Experiment, not a pass/fail check: change the driver to a blocking drive at @(posedge clk), run it with two compile orders (or two simulators) and record whether the result changes. It may not change: a race is not reported by the simulator, and its outcome depends on the tool and on process order.',
      'No TB code assigns a DUT input outside drv_cb, apart from the initial values in the pipe_if declarations (a text search of the TB finds none).',
      'The clean result is the same with the TB files compiled in a different order.',
    ],
    lessons: [
      'F3A_Simulation_Semantics/index',
      'F3B_Scheduling_Regions/index',
      'F3C_Delta_Cycles_and_Race_Conditions/index',
      'F4A_Modules_and_Packages/index',
      'F4B_Interfaces_and_Modports/index',
      'F4C_Clocking_Blocks/index',
    ],
    labs: ['constructs-1', 'basics-1'],
    stretch: [
      'Add a concurrent assertion in the interface that checks the two-cycle latency (I-SV-4A).',
      'Add an out_ready input and make the pipeline stall; the checker must still match every item.',
      'Run the clean bench and all three mutants on two different simulators and compare the results.',
    ],
    effort: '5 to 8 hours',
    tools: PLAIN_SV_TOOLS,
  },
  {
    milestone: 'M2',
    goal: 'Write one UVM agent for a valid/ready stream and reuse it, unchanged, as an active instance on the input side and a passive instance on the output side of the same environment.',
    dut: {
      name: 'Valid/ready stream buffer',
      description:
        'A 4-entry FIFO with a valid/ready stream on each side: s_valid, s_ready, s_data[7:0] in and m_valid, m_ready, m_data[7:0] out. A transfer happens on a rising edge when valid and ready are both high.',
    },
    requiredFeatures: [
      'A stream_item sequence item, registered with `uvm_object_utils and created through the factory.',
      'A stream_if interface with drv_cb and mon_cb clocking blocks.',
      'stream_drv drives through vif.drv_cb; stream_mon samples through vif.mon_cb and writes a new object to its analysis port for every transfer.',
      'A stream_agent_cfg configuration object holding vif, is_active and coverage_enable, passed through the configuration database (uvm_config_db), with the vif set in tb_top before run_test(). The agent overrides get_is_active() to return cfg.is_active (IEEE 1800.2-2020 13.4.2.2 lets an agent developer override get_is_active()), or the test sets "is_active" for the agent through uvm_config_db.',
      'stream_agent builds its driver and sequencer only when get_is_active() returns UVM_ACTIVE.',
      'One environment with two instances of the same agent class: an active instance on the input side and a passive instance on the output side. In this configuration tb_top ties m_ready high, so the FIFO never stalls.',
      'Objections raised and dropped in the test or the top sequence only. The objection is not dropped when the last item has been driven, because up to four items can still be in the FIFO: the test drops it only after the output monitor has counted N transfers (for example by waiting on a count or an event the environment exposes), with a timeout that reports an error if they never arrive.',
    ],
    acceptance: [
      'The active run drives N items, and the input monitor reports N transfers.',
      'The passive agent has no driver and no sequencer in the print_topology() output.',
      'The passive monitor on the output side reports the same N transfers.',
      'The report summary shows UVM_ERROR : 0 and UVM_FATAL : 0.',
      'Both instances use the same agent source files: only the configuration changes.',
    ],
    lessons: [
      'I-SV-9_Why_UVM/index',
      'I-UVM-1A_Components/index',
      'I-UVM-1B_The_UVM_Factory/index',
      'I-UVM-1C_UVM_Phasing/index',
      'I-UVM-2A_Component_Roles/index',
      'I-UVM-2B_TLM_Connections/index',
      'I-UVM-2C_Configuration_and_Resources/index',
      'I-UVM-3A_Fundamentals/index',
      'I-UVM-3C_First_Complete_Testbench/index',
      'A-UVM-7_VIP_Construction/index',
    ],
    labs: ['config-debug', 'scoreboard-decoupling', 'uvm-mini-capstone'],
    stretch: [
      'Let the driver insert random idle cycles, and replace the tied-high m_ready with a responder that applies random backpressure.',
      'Add an interface assertion that valid stays high, with stable data, until ready is high.',
      'Add a coverage subscriber that the agent builds only when coverage_enable is set.',
    ],
    effort: '10 to 16 hours',
    tools: UVM_TOOLS,
  },
  {
    milestone: 'M3',
    goal: 'Check every output of a pipelined DUT against a reference model, and prove at end of test that nothing was left unmatched.',
    dut: {
      name: 'Pipelined ALU',
      description:
        'Inputs in_valid, op[1:0] (ADD, SUB, AND, XOR), a[7:0] and b[7:0]; outputs out_valid and result[7:0], three cycles after the input. One output for every input, in order.',
    },
    requiredFeatures: [
      'An input monitor and an output monitor, each publishing transactions on an analysis port.',
      'A predictor that turns each input transaction into an expected result with a reference model written in SystemVerilog.',
      'A scoreboard that copies before it stores, compares by value, and counts matches and mismatches.',
      'A check_phase report of every expected result still waiting and every actual result that had no expected one.',
      'End of test that waits for the scoreboard to drain (an objection or a drain condition), not a fixed #delay.',
      'A final line SCB_SUMMARY matches=<n> mismatches=<m> pending=<p>.',
    ],
    acceptance: [
      'Clean DUT: SCB_SUMMARY matches=N mismatches=0 pending=0 with N greater than zero, and UVM_ERROR : 0.',
      'Mutant 1, the DUT drops one output: at least one UVM_ERROR.',
      'Mutant 2, the DUT decodes one opcode wrongly: at least one UVM_ERROR.',
      'Mutant 3, the DUT produces one extra output: at least one UVM_ERROR.',
      'A run in which the monitors observe zero transactions fails.',
    ],
    lessons: [
      'I-UVM-2B_TLM_Connections/index',
      'I-UVM-4_UVM_Policy_Classes/index',
      'A-UVM-6_Scoreboards_and_Reference_Models/index',
    ],
    labs: ['scoreboard-reference-model', 'scoreboard-decoupling', 'uvm-mini-capstone'],
    stretch: [
      'Check the latency too: report any result that arrives earlier or later than three cycles.',
      'Write the reference model in C and call it through DPI-C (I-SV-7).',
      'Tag each input and let the scoreboard accept results out of order, then add a mutant that reorders.',
    ],
    effort: '8 to 12 hours',
    tools: UVM_TOOLS,
  },
  {
    milestone: 'M4',
    goal: 'Turn a short verification plan (vplan) into a coverage model, measure the holes, and close them with constrained-random and targeted stimulus within a seed budget you set in advance.',
    dut: {
      name: 'ALU with flags',
      description:
        'The M3 ALU extended to op[2:0] with five legal operations (ADD, SUB, AND, OR, XOR) and three reserved encodings, plus a carry flag and a zero flag. Reuse the M3 environment.',
    },
    requiredFeatures: [
      'A vplan excerpt of six rows written before any code: operations, operand corners (0, all ones, alternating bits), operation crossed with corners, carry out of ADD, zero results, and back-to-back operations.',
      'One covergroup with a coverpoint or cross for each row, and the row ID in option.comment.',
      'The reserved opcodes in illegal_bins, and exclusions written down with a reason.',
      'A constrained-random sequence, then directed or biased sequences for the holes the first runs leave.',
      'A regression log that lists each seed and the coverage after it.',
    ],
    acceptance: [
      'The coverage report shows 100% of the bins in the plan, with every exclusion documented.',
      'No illegal bin is ever hit, and the M3 scoreboard still reports 0 mismatches.',
      'Closure is reached within the seed budget written in the plan (for example 10 seeds).',
      'Every coverpoint traces to a plan row, and every plan row to a coverpoint.',
    ],
    lessons: [
      'I-SV-2A_Constrained_Randomization_Fundamentals/index',
      'I-SV-2B_Advanced_Constrained_Randomization/index',
      'I-SV-3A_Functional_Coverage_Fundamentals/index',
      'I-SV-3A_Functional_Coverage_Fundamentals/coverage-options',
      'I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
      'I-SV-3B_Advanced_Functional_Coverage/linking-coverage',
    ],
    labs: ['coverage-advanced-1', 'randomization-advanced-1'],
    stretch: [
      'Add transition bins for back-to-back operation pairs.',
      'Merge coverage across seeds and plot coverage against seed count.',
      'Find the smallest set of seeds that reaches the same coverage.',
    ],
    effort: '8 to 12 hours',
    tools: `${UVM_TOOLS} It must also report covergroup coverage.`,
  },
  {
    milestone: 'M5',
    goal: 'Coordinate two agents from one virtual sequence: configure the DUT before any data flows, then reconfigure it in the middle of a stream without losing a check.',
    dut: {
      name: 'Configurable stream scrambler',
      description:
        'An APB configuration port with two registers, CTRL (enable bit) and KEY[7:0], and a valid/ready data stream: when enabled, each output byte is the input byte XOR KEY. Each byte uses the KEY value in effect at the rising edge where the DUT accepts that input byte, so a byte already accepted keeps the old KEY even if it comes out after a KEY write. A KEY write takes effect from the rising edge after its APB access phase completes (PSEL, PENABLE and PREADY high).',
    },
    requiredFeatures: [
      'An APB configuration agent and the stream agent from M2.',
      'A virtual sequencer with handles to both sequencers, and a virtual sequence that writes KEY and CTRL before it starts the data sequence.',
      'A mid-stream reconfiguration: stop the data sequence, wait until the KEY write has completed on the bus, then resume.',
      'A scoreboard whose reference model also receives configuration transactions from the APB monitor and predicts each output byte when the input monitor reports the input transfer, using the KEY in effect at that moment. Because the virtual sequence never lets an input transfer and a KEY write complete at the same rising edge, the order in which the two monitors call write() within one time step never decides a prediction.',
      'An ordering check: no data transfer is accepted before CTRL.enable is written.',
      'A test that ends through objections, with no fork left hanging.',
    ],
    acceptance: [
      'Scoreboard reports 0 mismatches with at least one reconfiguration in the run.',
      'The ordering check never fires on the clean run.',
      'A mutant virtual sequence that forks configuration and data with no ordering is caught by your checks.',
      'UVM_ERROR : 0 on the clean run, and the test ends without a timeout.',
    ],
    lessons: [
      'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences',
      'I-UVM-3B_Advanced_Sequencing_and_Layering/uvm-virtual-sequencer',
      'I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration',
      'I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab',
      'A-UVM-8_Multi_Agent_Topologies/index',
      'B-APB-1_APB_Protocol_and_Verification/index',
    ],
    labs: ['multi-agent-vseq', 'uvm-mini-capstone', 'config-debug'],
    stretch: [
      'Add a third agent for an interrupt output, with an ordering rule of its own.',
      'Use lock() or grab() so a high-priority configuration sequence cannot be interleaved with another.',
      'Collect the virtual sequences into a sequence library and run it randomly.',
    ],
    effort: '12 to 20 hours',
    tools: UVM_TOOLS,
  },
  {
    milestone: 'M6',
    goal: 'Verify AXI4 reads from a slave that legally reorders and interleaves its responses, accepting every legal order and rejecting every illegal one.',
    dut: {
      name: 'Reordering AXI4 read slave',
      description:
        'A memory model behind an AXI4 read address (AR) and read data (R) channel. It returns read data for different ARID values in any order and interleaves their beats, keeps same-ARID responses in order, inserts random RVALID delays, and can return SLVERR.',
    },
    requiredFeatures: [
      'A master agent that issues multi-beat INCR bursts with several ARID values outstanding at once, and drives RREADY with random backpressure.',
      'A burst generator that never crosses a 4KB address boundary.',
      'A scoreboard with one expected queue per ID, filled from a memory model when the address handshake completes.',
      'Checks for same-ID ordering, RLAST on exactly the last beat, beat count, RID and RRESP.',
      'Coverage that records whether cross-ID reordering and interleaving really happened.',
      'An end-of-test check that every per-ID queue is empty.',
    ],
    acceptance: [
      'Clean run: MATCH=<n> with n greater than zero and no errors.',
      'Coverage shows at least one cross-ID reorder and one interleaved response; a run with neither proves nothing.',
      'Mutant 1, two same-ID responses swapped: at least one error.',
      'Mutant 2, RLAST missing on a last beat: at least one error.',
      'Mutant 3, one extra beat in a burst: at least one error.',
      'Mutant 4, a wrong RID on one beat: at least one error.',
    ],
    lessons: [
      'B-AXI-1_AXI_Channel_Architecture/index',
      'B-AXI-2_AXI_Burst_Math/index',
      'B-AXI-3_AXI_Ordering_and_IDs/index',
      'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks/index',
      'B-AXI-6_AXI_Verification_Performance/index',
    ],
    labs: ['axi-scoreboard-lab', 'axi-deadlock-hunt-lab'],
    stretch: [
      'Add the write channels, with B responses checked per AWID.',
      'Make the slave read data reordering depth a parameter and cover each depth.',
      'Measure latency per ID and report the worst case.',
    ],
    effort: '15 to 25 hours',
    tools: UVM_TOOLS,
    sources: [
      'Read ordering by ARID, and interleaving of read data with different ARID values: Arm IHI 0022E, A5.3.1 Read ordering.',
      'The 4KB rule: Arm IHI 0022E, A3.4.1 Address structure.',
    ],
  },
  {
    milestone: 'M7',
    goal: 'Build a register model for a small block, keep its mirrored values right with an explicit register predictor, and catch register bugs with built-in and custom sequences.',
    dut: {
      name: 'APB register block',
      description:
        'Four registers behind an APB slave: CTRL (read-write), STATUS (read-only), INT_STATUS (write 1 to clear, bits set by a hardware event input) and EVT_COUNT (read-only counter that hardware increments). An access to an unmapped address returns PSLVERR.',
    },
    requiredFeatures: [
      'uvm_reg classes with the access policies "RW", "RO" and "W1C", and the counter field configured as volatile.',
      'A uvm_reg_block with an address map, and an adapter with reg2bus and bus2reg for the APB agent.',
      'Explicit prediction: a uvm_reg_predictor connected to the APB monitor, with auto prediction left off.',
      'A run of uvm_reg_hw_reset_seq.',
      'A write to CTRL of a value different from its reset value, followed by mirror() with UVM_CHECK, so a stale mirrored value shows up as an error (writing the reset value would leave a stale mirror equal to the DUT and hide the bug).',
      'A W1C test: raise the hardware event, read the bit set, write 0 (no effect), write 1 (cleared), read again.',
      'A short written explanation of desired value and mirrored value, using your own log as the example.',
    ],
    acceptance: [
      'Clean run: UVM_ERROR : 0.',
      'Mutant 1, a wrong reset value in CTRL: at least one register error.',
      'Mutant 2, INT_STATUS implemented as read-write: at least one register error.',
      'Mutant 3, the register predictor disconnected: at least one register error.',
      'An access the DUT does not decode comes back with status UVM_NOT_OK: add a register to the model at an address the DUT does not decode (the DUT already answers it with PSLVERR), and have the adapter\'s bus2reg() map PSLVERR to UVM_NOT_OK. Exclude that register from the built-in sequences, or uvm_reg_hw_reset_seq reads it, gets UVM_NOT_OK and breaks the clean run: set the bit-type resource "NO_REG_TESTS" (or "NO_REG_HW_RESET_TEST") in the "REG::" namespace for the register\'s full name (IEEE 1800.2-2020 Annex E.1), or put it in a separate test that the built-in sequences do not run.',
    ],
    lessons: [
      'A-UVM-4A_RAL_Fundamentals/index',
      'A-UVM-4B_Advanced_RAL_Techniques/explicit-vs-implicit',
      'A-UVM-4B_Advanced_RAL_Techniques/built-in-ral-sequences',
      'A-UVM-4B_Advanced_RAL_Techniques/frontdoor-vs-backdoor',
      'B-APB-1_APB_Protocol_and_Verification/index',
    ],
    labs: ['ral-mirror-bug'],
    stretch: [
      'Add backdoor access with HDL paths and compare frontdoor and backdoor reads.',
      'Run uvm_reg_bit_bash_seq, excluding the registers it cannot test, and say why each is excluded.',
      'Add register coverage of which fields were written and read.',
    ],
    effort: '10 to 16 hours',
    tools: UVM_TOOLS,
    sources: [
      'Access policies, including "W1C": IEEE 1800.2-2020, 18.5.4.6 (uvm_reg_field::set_access).',
      'uvm_reg_hw_reset_seq: IEEE 1800.2-2020, Annex E.1.',
      'PSLVERR: Arm IHI 0024C, 3.4 Error response.',
    ],
  },
  {
    milestone: 'M8',
    goal: 'Plan and build the verification of a small subsystem on your own: reset in the middle of work, injected errors, concurrent traffic and measured closure, with no starter code.',
    dut: {
      name: 'Single-channel DMA',
      description:
        'APB configuration registers (SRC, DST, LEN, CTRL with a start bit, STATUS with done and error bits, and a W1C interrupt status), an AXI memory port that reads from SRC and writes to DST, and an irq output raised on done or error.',
    },
    requiredFeatures: [
      'A written strategy before any code: what is verified at this level, with which agents, checks, coverage and exit criteria.',
      'At least two agents: the APB configuration agent and a responder agent on the memory port.',
      'The register model and register predictor from M7, the reference-model scoreboard pattern from M3 (it checks memory contents after each transfer), the coverage approach from M4 and the virtual sequences from M5.',
      'Reset asserted in the middle of a transfer, with checks that the DMA recovers and the next transfer is correct.',
      'Error-response injection on the memory port, checked through STATUS.error and irq.',
      'Configuration writes concurrent with a running transfer, and a regression that runs every test over several seeds with one command.',
    ],
    acceptance: [
      'Zero mismatches over K seeds, with K chosen in the strategy before the first run.',
      'Coverage at or above the target in your plan.',
      'Five mutants planted by someone else (or written before you build the checks) are all detected, for example: LEN off by one, irq not raised on error, W1C write ignored, STATUS.done or the transfer state not cleared by reset, a write to the wrong address.',
      'No false failure on three clean seeds.',
    ],
    lessons: [
      'E-SOC-1_SoC-Level_Verification_Strategies/index',
      'A-UVM-9_Reset_and_Error_Injection/index',
      'A-UVM-8_Multi_Agent_Topologies/index',
      'A-UVM-7_VIP_Construction/index',
      'B-AMBA-F1_Bridges_and_System_Integration/index',
      'E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
    ],
    labs: ['soc-strategy-capstone', 'soc-vip-reuse', 'debug-waveform-trigger'],
    stretch: [
      'Add a second channel and verify arbitration between the two.',
      'Prove one interrupt property with a formal tool (E-INT-1), and keep the same property as an assertion in simulation.',
      'Profile the regression and remove the slowest hotspot (E-PERF-1).',
    ],
    effort: '40 to 60 hours, over several weeks',
    tools: UVM_TOOLS,
  },
];
