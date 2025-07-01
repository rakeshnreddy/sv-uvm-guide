import InfoPage from '../components/InfoPage';

export default function HistoryInfoPage() {
  const content = `
    <h2>The "Why" Behind the "What": Historical Context and Design Rationale</h2>
    <p>Understanding the evolution of SystemVerilog and UVM is not merely an academic exercise; it is essential for grasping the design intent behind their features. These technologies were forged in response to acute, industry-wide pain points. Knowing this history explains why certain constructs exist, why specific methodologies are considered best practice, and how the entire ecosystem is designed to solve the monumental challenge of modern chip verification.</p>

    <h3>The Journey from Verilog to SystemVerilog</h3>
    <p>The story of SystemVerilog is a direct response to the growing inadequacy of its predecessor, Verilog, in the face of escalating design complexity.</p>
    <h4>The Verilog-95/2001 Era and its Limitations:</h4>
    <p>In the 1990s, Verilog (IEEE 1364) was effective for Register-Transfer Level (RTL) design. However, its verification capabilities were primitive. Testbenches were procedural, data types weak, and constructs for constrained-random stimulus, functional coverage, or assertions were absent. As designs grew to millions of gates, exhaustive directed testing became intractable, and verifying complex interactions was perilous.</p>
    <h4>The "Aha!" Moment - The Rise of HVLs:</h4>
    <p>In the late 1990s and early 2000s, specialized Hardware Verification Languages (HVLs) like OpenVera (Synopsys) and 'e' (Verisity) emerged. They introduced powerful concepts like OOP, constrained randomization, and functional coverage. The industry realized verification was a distinct discipline needing its own abstract tools.</p>
    <h4>SystemVerilog's Birth (IEEE 1800-2005):</h4>
    <p>Accellera pursued unification, accepting technology donations: Superlog (Co-Design Automation) for design enhancements, and OpenVera (Synopsys) for verification features. The result was SystemVerilog, a superset of Verilog. This ensured backward compatibility and a smoother adoption path for design engineers but also created a large, multifaceted language serving dual roles: an enhanced HDL for design and a powerful, class-based HVL for verification.</p>

    <h3>The Genesis of UVM: From Chaos to Standardization</h3>
    <p>Just as Verilog's limitations spurred SystemVerilog, the chaos of competing verification methodologies drove the industry to consolidate around UVM.</p>
    <h4>The Methodology Wars (pre-2010):</h4>
    <p>With SystemVerilog's power, EDA vendors created their own SystemVerilog-based methodologies (frameworks of base classes and best practices). This led to fragmentation: Synopsys championed the Verification Methodology Manual (VMM), influenced by Vera. Cadence and Mentor Graphics collaborated on the Open Verification Methodology (OVM), derived from the 'e' language's eRM.</p>
    <h4>The Pain of Fragmentation:</h4>
    <p>Incompatibility between VMM and OVM was a major inefficiency. Verification IP (VIP) reuse was difficult, training costs increased, and tool lock-in was significant. This friction hampered productivity as design complexity grew.</p>
    <h4>The "Aha!" Moment - The Need for a Universal Standard:</h4>
    <p>The industry recognized this fragmentation was unsustainable. Accellera formed a technical subcommittee in 2009 to create a single, unified verification methodology.</p>
    <h4>UVM's Emergence (2011):</h4>
    <p>The Accellera committee chose OVM 2.1.1 as the foundation for the new standard, based on its technical merits, open-source nature, and multi-vendor support. With contributions from Synopsys and others, OVM evolved into the Universal Verification Methodology (UVM). Accellera approved UVM 1.0 in 2011. This consolidation created a stable, interoperable foundation for reusable VIP, tools, and training.</p>

    <h3>Interactive Timeline</h3>
    {/* The InfoPage component will add a placeholder here based on the title "/history" */}
  `;

  // Note: The InfoPage component is already set up to add
  // "[Interactive Timeline Chart Placeholder]" when the title is "/history".
  // So, we don't need to add it explicitly to the content string here,
  // but it's good to be aware for when the actual chart is implemented.

  return (
    <InfoPage
      title="/history"
      content={content}
    />
  );
}
