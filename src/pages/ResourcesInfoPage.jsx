import InfoPage from '../components/InfoPage';

export default function ResourcesInfoPage() {
  const content = `
    <h2>Essential Learning Resources for SystemVerilog & UVM</h2>
    <p>Navigating the vast landscape of available information is the first challenge for any aspiring verification engineer. A successful learning journey requires a balanced approach, synthesizing knowledge from foundational texts, industry portals, and community-driven content. This section curates a prioritized list of essential resources, providing a clear path from foundational theory to practical application, as outlined in the "SystemVerilog and UVM Mastery Blueprint".</p>

    <h3>Section 1: The Canon of SV and UVM - Authoritative Sources</h3>

    <h4>Table 1: Foundational SystemVerilog Resources</h4>
    <p>This table organizes the most critical resources for mastering the SystemVerilog language itself. It is prioritized to guide a learner from the most essential, universally recommended text to more specialized or supplementary materials.</p>
    <table border="1" style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Title & Author/Source</th>
          <th>Type</th>
          <th>Why It's Essential</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>SystemVerilog for Verification (Chris Spear, Greg Tumbush)</td>
          <td>Book</td>
          <td>This is the definitive, universally recommended text for learning SV's verification constructs from first principles with practical, easy-to-understand examples.</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Siemens Verification Academy: SystemVerilog Track</td>
          <td>Video Course</td>
          <td>This free, industry-standard series of courses from a leading EDA vendor covers fundamentals and best practices with unparalleled authority and depth.</td>
        </tr>
        <tr>
          <td>3</td>
          <td>RTL Modeling with SystemVerilog for Simulation and Synthesis (Stuart Sutherland)</td>
          <td>Book</td>
          <td>It is essential for a verification engineer to understand the design side of SV; this book is the premier resource for learning how to write synthesizable code.</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Doulos SystemVerilog Tutorials</td>
          <td>Website/Tutorial</td>
          <td>These tutorials provide concise, high-quality, and professionally vetted explanations of specific SV features like data types, interfaces, and clocking blocks.</td>
        </tr>
        <tr>
          <td>5</td>
          <td>Sunburst Design Papers (Cliff Cummings)</td>
          <td>Papers</td>
          <td>This is a collection of award-winning conference papers offering deep dives into specific, practical SV topics like Clock-Domain Crossing (CDC) and FSM design.</td>
        </tr>
        <tr>
          <td>6</td>
          <td>Verification Guide & VLSIVerify</td>
          <td>Blog/Tutorial</td>
          <td>These are excellent free online resources with clear explanations and abundant code examples for a wide range of SV topics, from data types to advanced class features.</td>
        </tr>
        <tr>
          <td>7</td>
          <td>SystemVerilog Assertions Handbook (Ben Cohen et al.)</td>
          <td>Book</td>
          <td>This is the go-to guide for mastering SystemVerilog Assertions (SVA), a critical, declarative component of modern functional verification.</td>
        </tr>
        <tr>
          <td>8</td>
          <td>Udemy: "SystemVerilog for Verification" (Kumar Khandagle)</td>
          <td>Video Course</td>
          <td>A highly-rated, project-based course that provides a structured, hands-on learning experience from scratch, valued for its step-by-step guidance.</td>
        </tr>
        <tr>
          <td>9</td>
          <td>pulp-platform/common_cells</td>
          <td>GitHub Repo</td>
          <td>This repository offers a collection of practical, real-world, synthesizable SystemVerilog components to study and learn from, providing a view into production-quality code.</td>
        </tr>
        <tr>
          <td>10</td>
          <td>IEEE Std 1800-2023</td>
          <td>Standard</td>
          <td>This is the official Language Reference Manual (LRM). It is not a learning tool, but it is the ultimate authority for resolving language ambiguities and understanding precise semantics.</td>
        </tr>
      </tbody>
    </table>

    <h4>Table 2: Essential Universal Verification Methodology (UVM) Resources</h4>
    <p>Building upon a solid SystemVerilog foundation, this table provides a clear on-ramp to mastering UVM. The resources are ordered to take a learner from gentle introductions to the comprehensive, dense materials required for true expertise.</p>
    <table border="1" style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Title & Author/Source</th>
          <th>Type</th>
          <th>Why It's Essential</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>The UVM Primer (Ray Salemi)</td>
          <td>Book</td>
          <td>This book provides a gentle, step-by-step introduction to UVM, making it the perfect starting point to grasp core concepts without being overwhelmed.</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Siemens UVM Cookbook</td>
          <td>Website/Guide</td>
          <td>This is the single most comprehensive and practical online resource for UVM, covering nearly every topic with executable code examples and detailed explanations.</td>
        </tr>
        <tr>
          <td>3</td>
          <td>ClueLogic: UVM Tutorial for Candy Lovers</td>
          <td>Blog</td>
          <td>A famously accessible and intuitive tutorial that uses a simple, memorable analogy to explain core UVM components and their interactions, ideal for new hires.</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Siemens Verification Academy: UVM Tracks</td>
          <td>Video Course</td>
          <td>These free, in-depth video courses cover UVM basics, advanced topics like the register layer, debugging techniques, and the UVM Framework.</td>
        </tr>
        <tr>
          <td>5</td>
          <td>accellera/uvm</td>
          <td>GitHub Repo</td>
          <td>This is the official Accellera repository containing the UVM base class library source code; studying it is essential for advanced understanding and debugging.</td>
        </tr>
        <tr>
          <td>6</td>
          <td>A Practical Guide to Adopting the UVM (Spring-ML)</td>
          <td>Book</td>
          <td>This text focuses on the practical aspects and methodology of deploying UVM on real projects, bridging the gap between theory and industrial application.</td>
        </tr>
        <tr>
          <td>7</td>
          <td>Doulos: Easier UVM</td>
          <td>Paper/Tutorial</td>
          <td>An influential paper and set of coding guidelines aimed at simplifying UVM code, reducing boilerplate, and making the methodology more accessible.</td>
        </tr>
        <tr>
          <td>8</td>
          <td>AMIQ Consulting & Verification Gentlemen Blogs</td>
          <td>Blog</td>
          <td>These are high-quality blogs that explore advanced UVM patterns, real-world challenges, and sophisticated debug techniques beyond what is covered in introductory texts.</td>
        </tr>
        <tr>
          <td>9</td>
          <td>rggen/rggen-sv-ral</td>
          <td>GitHub Repo</td>
          <td>This is an excellent example of a tool that auto-generates a key UVM component (the RAL model), showcasing best practices for both code generation and UVM integration.</td>
        </tr>
        <tr>
          <td>10</td>
          <td>Accellera UVM 1.2 Class Reference</td>
          <td>Standard</td>
          <td>This is the official documentation for the UVM class library, serving as the ultimate reference for all UVM classes, methods, and their usage.</td>
        </tr>
      </tbody>
    </table>

    <h3>Section 2: The Verification Engineer's Digital Workbench - Toolchain and Playgrounds</h3>
    <p>Practical proficiency requires a robust development environment. This section covers essential commercial and open-source tools.</p>

    <h4>Subsection 2.1: Simulators</h4>
    <h5>Commercial Simulators (The Industry Standards)</h5>
    <ul>
      <li><strong>Siemens Questa One (formerly ModelSim/Questa):</strong> Renowned for its powerful debug environment, particularly the UVM-aware Visualizer tool.</li>
      <li><strong>Synopsys VCS:</strong> High-performance simulation engine known for advanced compilation and optimization.</li>
      <li><strong>Cadence Xcelium:</strong> Offers advanced parallel simulation technology and a comprehensive verification environment.</li>
    </ul>

    <h5>Open-Source Simulators (The Learning Sandbox)</h5>
    <ul>
      <li><strong>Verilator:</strong> Fastest open-source option; compiles SystemVerilog to C++/SystemC models. Excellent for large regressions and architectural exploration.</li>
      <li><strong>Icarus Verilog:</strong> Full-featured, event-driven interpreted simulator. Good starting point with broad SystemVerilog support for testbenches.</li>
      <li><strong>GTKWave:</strong> Robust waveform viewer for analyzing trace files (VCD, FST) from simulators.</li>
    </ul>

    <h4>Subsection 2.2: IDE Integration</h4>
    <ul>
      <li><strong>Visual Studio Code (VS Code):</strong> Recommended modern choice.
        <ul>
          <li>Essential Extension: <code>eirikpre.systemverilog</code> (syntax highlighting, go-to-definition, linting).</li>
          <li>Linter Configuration Example (Verilator):
            <pre><code>{\n  "systemverilog.linter": "verilator",\n  "systemverilog.verilator.arguments": "--sv --lint-only --Wall"\n}</code></pre>
          </li>
        </ul>
      </li>
      <li><strong>Emacs:</strong> Classic, customizable editor.
        <ul>
          <li>Core Extension: <code>verilog-mode</code> (context-aware indentation, AUTO macros).</li>
          <li>Modern Enhancement: <code>verilog-ext</code> (LSP support via tree-sitter).</li>
        </ul>
      </li>
    </ul>

    <h4>Subsection 2.3: Containerized Development with Docker</h4>
    <p>Docker provides portable, reproducible development environments. An example Dockerfile for an SV/UVM sandbox is provided in the blueprint (see Section 2.3 of the blueprint for the Dockerfile text and usage snippets).</p>

    <h4>Subsection 6.2: Recommended Diagramming Tools (from Section 6)</h4>
     <ul>
      <li><strong>Excalidraw:</strong> Recommended for quick, collaborative, informal sketching with a hand-drawn style. Open-source with VS Code/Obsidian integrations.</li>
      <li><strong>draw.io (diagrams.net):</strong> Recommended for more formal, structured diagrams for documentation/presentations. Extensive shape libraries and templates.</li>
    </ul>
  `;

  return (
    <InfoPage
      title="Resources"
      content={content}
    />
  );
}
