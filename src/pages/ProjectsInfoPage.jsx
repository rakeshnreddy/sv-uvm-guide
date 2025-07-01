import InfoPage from '../components/InfoPage';

export default function ProjectsInfoPage() {
  const content = `
    <h2>Mini-Projects: Capstone Learning Exercises</h2>
    <p>These are capstone exercises that require the learner to synthesize knowledge from multiple topics to solve a realistic verification problem. They are designed to provide hands-on experience in building and managing UVM testbenches.</p>

    <h3>Project 1: The FIFO Verification</h3>
    <h4>Task:</h4>
    <p>Build a complete UVM testbench for a simple synchronous First-In, First-Out (FIFO) memory buffer. The FIFO should have configurable depth and data width.</p>
    <h4>Key Requirements:</h4>
    <ul>
      <li>The testbench must use constrained-random stimulus to generate varied write and read scenarios, including:
        <ul>
          <li>Writing until full.</li>
          <li>Reading until empty.</li>
          <li>Simultaneous writes and reads.</li>
          <li>Alternating writes and reads.
          <li>Back-to-back writes and back-to-back reads.</li>
        </ul>
      </li>
      <li>Implement a scoreboard to check for data integrity (data written should match data read, in the correct order).</li>
      <li>Achieve 100% functional coverage for key conditions, such as:
        <ul>
          <li>Write to full FIFO (attempt and success/failure).</li>
          <li>Read from empty FIFO (attempt and success/failure).</li>
          <li>FIFO full and empty states being reached.</li>
          <li>Coverage of different data values written/read.</li>
        </ul>
      </li>
      <li>The testbench should include at least one test that specifically targets full and empty boundary conditions.</li>
      <li>Utilize a UVM agent with a driver, monitor, and sequencer for the FIFO's interface.</li>
    </ul>
    <h4>Learning Focus:</h4>
    <p>This project reinforces understanding of basic UVM components (agent, driver, monitor, sequencer, sequences), transaction creation, scoreboard logic, constrained randomization, and functional coverage implementation.</p>

    <h3>Project 2: The Priority Arbiter Verification</h3>
    <h4>Task:</h4>
    <p>Verify a 2-to-1 priority arbiter. The arbiter has two request inputs (req0, req1) and two grant outputs (gnt0, gnt1). Assume req0 has higher priority than req1. A grant should only be asserted if the corresponding request is active and no higher priority request is active or being granted.</p>
    <h4>Key Requirements:</h4>
    <ul>
      <li>Develop a UVM testbench with two active agents, one for each requester. Each agent will drive its respective request signal and monitor its grant signal.</li>
      <li>Implement sequences to generate various request scenarios, including:
        <ul>
          <li>Individual requests (only req0, only req1).</li>
          <li>Simultaneous requests (both req0 and req1 asserted at the same time).</li>
          <li>Overlapping requests (one request asserts while the other is already active or being granted).</li>
          <li>Requests asserting and de-asserting at different times relative to grants.</li>
        </ul>
      </li>
      <li>A virtual sequence and virtual sequencer should be used to coordinate the timing and generation of requests from the two agents to create interesting arbitration scenarios.</li>
      <li>The scoreboard must check for correct arbiter behavior:
        <ul>
          <li>No grant without a corresponding request.</li>
          <li>gnt0 is only asserted for req0. gnt1 is only asserted for req1.</li>
          <li>If req0 is asserted, gnt1 must not be asserted, even if req1 is also asserted (priority logic).</li>
          <li>Only one grant can be active at any given time.</li>
        </ul>
      </li>
      <li>Define functional coverage for different request/grant combinations and priority arbitration cases.</li>
    </ul>
    <h4>Learning Focus:</h4>
    <p>This project emphasizes multi-agent coordination using virtual sequences/sequencers, more complex scoreboard logic for checking state-dependent behavior and protocol rules, and verifying designs with interacting concurrent inputs.</p>
  `;

  return (
    <InfoPage
      title="/projects"
      content={content}
    />
  );
}
