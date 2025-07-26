// app/history/page.tsx
import { InfoPage } from "@/components/templates/InfoPage"; // Removed InteractiveChartPlaceholder from here
import HistoryTimelineChart from "@/components/charts/HistoryTimelineChart"; // Import the new chart

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

      {/* Section for the chart */}
      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Interactive Timeline of SV & UVM Evolution</h2>
        <p className="mb-4">
          The following timeline visualizes the key milestones in the development of SystemVerilog and UVM.
          Hover over the data points to see more details about each event. The size of the circle can be indicative of the event&apos;s impact or scope.
        </p>
        <HistoryTimelineChart />
        <p className="text-sm text-muted-foreground mt-2 text-center">
          This chart illustrates the journey from early hardware description languages to the comprehensive verification methodologies used today.
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
