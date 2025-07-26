// app/projects/page.tsx
import { InfoPage } from "@/components/templates/InfoPage";
import { CodeBlock } from "@/components/ui/CodeBlock"; // For potential small config snippets

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const ProjectsPage = () => {
  const pageTitle = "Practical Projects & Case Studies";

  const pageContent = (
    <>
      <p className="lead mb-6">[Placeholder: Introduction to the importance of hands-on projects for applying learned concepts and building a portfolio, from blueprint].</p>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Project Ideas</h2>
        <p>[Placeholder: General guidance on selecting or defining projects suitable for different skill levels, from blueprint].</p>

        <div className="mt-4 space-y-5">
          <div>
            <h3 className="text-xl font-semibold">1. Simple DUT Verification (e.g., FIFO, ALU, Arbiter)</h3>
            <p className="mt-1">[Placeholder: Description of a project involving verifying a relatively simple DUT. Key learning objectives: basic testbench structure, driving stimulus, checking outputs, simple coverage/assertions, from blueprint].</p>
            <p className="text-sm text-foreground/70">[Placeholder: Suggested features to implement, complexity scaling, from blueprint].</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold">2. Bus Protocol Agent (e.g., APB, simple custom bus)</h3>
            <p className="mt-1">[Placeholder: Description of a project focused on developing a UVM agent for a bus protocol. Key learning objectives: UVM components (driver, monitor, sequencer, agent), transaction definition, TLM communication, sequence development, from blueprint].</p>
            <p className="text-sm text-foreground/70">[Placeholder: Suggested protocol features, agent capabilities, from blueprint].</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold">3. Integrating a Register Model (RAL)</h3>
            <p className="mt-1">[Placeholder: Description of a project that involves creating or integrating a RAL model for a DUT with several registers. Key learning objectives: RAL concepts, adapter development, frontdoor/backdoor access, register test sequences, from blueprint].</p>
            <p className="text-sm text-foreground/70">[Placeholder: Example DUT register map complexity, types of register tests to implement, from blueprint].</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold">4. Advanced Coverage-Driven Verification</h3>
            <p className="mt-1">[Placeholder: Description of a project focusing on developing a comprehensive functional coverage model and using it to guide constrained random verification. Key learning objectives: advanced coverage techniques, cross coverage, coverage closure, from blueprint].</p>
            <p className="text-sm text-foreground/70">[Placeholder: Example DUT complexity, types of coverage points to define, from blueprint].</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold">5. [Placeholder: Another Project Idea Title from Blueprint]</h3>
            <p className="mt-1">[Placeholder: Description, learning objectives, and suggested features for another project, from blueprint].</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-3">Case Studies (If Applicable)</h2>
        <p>[Placeholder: Introduction to any case studies of real-world or illustrative verification projects, if provided in the blueprint].</p>
        {/* Example of how a case study might be structured */}
        {/*
        <div className="mt-4 p-4 border border-border/50 rounded-md">
          <h3 className="text-xl font-semibold">[Placeholder: Case Study Title from Blueprint]</h3>
          <p className="mt-1 text-sm text-foreground/80"><strong>DUT:</strong> [Placeholder: DUT description]</p>
          <p className="mt-1 text-sm text-foreground/80"><strong>Challenge:</strong> [Placeholder: Verification challenge]</p>
          <p className="mt-1 text-sm text-foreground/80"><strong>Solution/Approach:</strong> [Placeholder: How SV/UVM was used]</p>
          <p className="mt-1 text-sm text-foreground/80"><strong>Key Learnings:</strong> [Placeholder: Outcomes and lessons]</p>
        </div>
        */}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-3">Setting up Your Project Environment</h2>
        <p>[Placeholder: General advice on setting up a local environment for these projects – choice of simulator (open source options like Icarus Verilog + GTKWave, or commercial tools if the user has access), directory structure, version control (Git), from blueprint].</p>
        <CodeBlock
          code={`# Placeholder: Example of basic directory structure
# my_sv_project/
# |-- dut/
# |   -- my_dut.sv
# |-- tb/
# |   -- test_top.sv
# |   -- my_interface.sv
# |   -- my_pkg.sv (if using classes)
# |-- sim/
# |   -- Makefile (or run script)
# |-- README.md`}
          language="bash"
          fileName="project_setup_example.txt"
        />
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {pageContent}
    </InfoPage>
  );
};

export default ProjectsPage;
