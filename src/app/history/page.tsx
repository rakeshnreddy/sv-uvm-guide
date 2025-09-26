import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';
import { isFeatureEnabled } from '@/tools/featureFlags';

const VisualizationFallback = () => (
  <div className="flex h-48 items-center justify-center">Loading visualization...</div>
);

const HistoryTimelineChart = dynamic(
  () => import('@/components/charts/HistoryTimelineChart'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);

export default async function HistoryPage() {
  if (!isFeatureEnabled('tracking')) {
    return (
      <InfoPage title="History of SystemVerilog & UVM">
        <p className="text-sm text-muted-foreground">
          The history module is paused until we have real learner tracking data to justify the heavy visualizations.
        </p>
      </InfoPage>
    );
  }

  const timelineSection = (
    <div key="history-timeline">
      <h2 className="mt-6 mb-3 text-2xl font-semibold">Interactive Timeline of SV &amp; UVM Evolution</h2>
      <p className="mb-4">
        The following timeline visualizes the key milestones in the development of SystemVerilog and UVM. Hover over the data
        points to see more details about each event. The size of the circle can be indicative of the event's impact or scope.
      </p>
      <HistoryTimelineChart />
      <p className="mt-2 text-center text-sm text-muted-foreground">
        This chart illustrates the journey from early hardware description languages to the comprehensive verification methodologies used today.
      </p>
    </div>
  );

  const pageContent = (
    <>
      <section>
        <h2 className="mt-6 mb-3 text-2xl font-semibold">The Evolution of Hardware Verification Languages</h2>
        <p>[Placeholder: Introduction to the history, the need for more advanced HVLs leading to SystemVerilog, from blueprint].</p>
        <p>[Placeholder: Early days - Verilog, VHDL, and their limitations for large-scale verification, from blueprint].</p>
      </section>

      <section>
        <h2 className="mt-6 mb-3 text-2xl font-semibold">The Rise of SystemVerilog</h2>
        <p>[Placeholder: Key milestones in SystemVerilog's development - Superlog, Accellera's role, IEEE standardization (e.g., IEEE 1800), from blueprint].</p>
        <p>[Placeholder: Major feature introductions over time - assertions, coverage, OOP, interfaces, randomization, C interface (DPI), from blueprint].</p>
      </section>

      <section>
        <h2 className="mt-6 mb-3 text-2xl font-semibold">The Genesis of Verification Methodologies</h2>
        <p>[Placeholder: The need for methodologies beyond just language features - VMM, OVM, AVM, from blueprint].</p>
        <p>[Placeholder: Brief overview of these precursor methodologies and their contributions, from blueprint].</p>
      </section>

      <section>
        <h2 className="mt-6 mb-3 text-2xl font-semibold">The Universal Verification Methodology (UVM)</h2>
        <p>[Placeholder: Development of UVM by Accellera, combining strengths of OVM and VMM. Key goals of UVM - interoperability, reusability, from blueprint].</p>
        <p>[Placeholder: Standardization of UVM (e.g., IEEE 1800.2) and its widespread adoption in the industry, from blueprint].</p>
      </section>

      <section>
        <h2 className="mt-6 mb-3 text-2xl font-semibold">The Future Outlook</h2>
        <p>[Placeholder: Brief thoughts on the continued evolution of SystemVerilog, UVM, and hardware verification practices, if covered in the blueprint].</p>
      </section>
    </>
  );

  return (
    <InfoPage title="History of SystemVerilog & UVM" charts={[timelineSection]}>
      {pageContent}
    </InfoPage>
  );
}
