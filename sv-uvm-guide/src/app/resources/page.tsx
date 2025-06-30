// app/resources/page.tsx
import InfoPage from "@/components/templates/InfoPage";

// PLACEHOLDER CONTENT - All content below must be populated from the "SystemVerilog and UVM Mastery Blueprint"

const ResourcesPage = () => {
  const pageTitle = "Helpful Resources";

  const pageContent = (
    <>
      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Books</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: Book Title 1 - Author(s) - Brief description/recommendation from blueprint]</li>
          <li>[Placeholder: Book Title 2 - Author(s) - Brief description/recommendation from blueprint]</li>
          <li>[Placeholder: Book Title 3 - Author(s) - Brief description/recommendation from blueprint]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Websites & Communities</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: Website Name 1 - URL - Brief description from blueprint (e.g., Accellera UVM page, Verification Academy)]</li>
          <li>[Placeholder: Website Name 2 - URL - Brief description from blueprint (e.g., EDA tool vendor blogs, specific forums)]</li>
          <li>[Placeholder: Community/Forum Name 1 - URL - Brief description from blueprint]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Tools & Simulators</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: Tool/Simulator Name 1 - Vendor/Link - Brief description of its relevance from blueprint (e.g., Open source options like Verilator, Icarus Verilog; Commercial tools)]</li>
          <li>[Placeholder: Tool/Simulator Name 2 - Vendor/Link - Brief description from blueprint]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Verification IP (VIP)</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: General information about where to find or how to select VIP, from blueprint]</li>
          <li>[Placeholder: Mention of common VIP protocols if specified in blueprint (e.g., AXI, PCIe)]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Training & Courses</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: Training Provider/Platform 1 - Link - Brief description from blueprint]</li>
          <li>[Placeholder: Training Provider/Platform 2 - Link - Brief description from blueprint]</li>
        </ul>
      </section>
       <section>
        <h2 className="text-2xl font-semibold mt-6 mb-3">Contribution & Standards</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>[Placeholder: Information on Accellera Systems Initiative or other relevant standards bodies, from blueprint]</li>
        </ul>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {pageContent}
    </InfoPage>
  );
};

export default ResourcesPage;
