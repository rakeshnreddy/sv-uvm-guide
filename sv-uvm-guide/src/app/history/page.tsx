// app/history/page.tsx
import InfoPage, { InteractiveChartPlaceholder } from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const HistoryPage = () => {
  const pageTitle = "History of SystemVerilog & UVM";

  const pageContent = (
    <>
      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">The Evolution of Hardware Verification Languages</h2>
        <p>[Placeholder: Introduction to the history, the need for more advanced HVLs leading to SystemVerilog, from blueprint].</p>
        <p>[Placeholder: Early days - Verilog, VHDL, and their limitations for large-scale verification, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">The Rise of SystemVerilog</h2>
        <p>[Placeholder: Key milestones in SystemVerilog&apos;s development - Superlog, Accellera&apos;s role, IEEE standardization (e.g., IEEE 1800), from blueprint].</p>
        <p>[Placeholder: Major feature introductions over time - assertions, coverage, OOP, interfaces, randomization, C interface (DPI), from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">The Genesis of Verification Methodologies</h2>
        <p>[Placeholder: The need for methodologies beyond just language features - VMM, OVM, AVM, from blueprint].</p>
        <p>[Placeholder: Brief overview of these precursor methodologies and their contributions, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">The Universal Verification Methodology (UVM)</h2>
        <p>[Placeholder: Development of UVM by Accellera, combining strengths of OVM and VMM. Key goals of UVM - interoperability, reusability, from blueprint].</p>
        <p>[Placeholder: Standardization of UVM (e.g., IEEE 1800.2) and its widespread adoption in the industry, from blueprint].</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Interactive Timeline</h2>
        <p>[Placeholder: Introduction to the interactive timeline chart that will visually represent these key historical milestones, from blueprint].</p>
        <InteractiveChartPlaceholder title="Key Milestones in SV & UVM History" />
        <p className="text-sm text-foreground/70 mt-2">
          [Placeholder: Brief explanation of how to interact with the timeline or what it depicts, from blueprint].
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">The Future Outlook</h2>
        <p>[Placeholder: Brief thoughts on the continued evolution of SystemVerilog, UVM, and hardware verification practices, if covered in the blueprint].</p>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {pageContent}
    </InfoPage>
  );
};

export default HistoryPage;
