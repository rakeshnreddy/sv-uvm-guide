import React, { ReactNode } from "react";

// Placeholder for an interactive chart component
const InteractiveChartPlaceholder = ({ title = "Interactive Chart" }: { title?: string }) => (
  <div className="my-6 p-4 border border-dashed border-blue-400/50 rounded-lg bg-blue-500/5 min-h-[200px] flex flex-col items-center justify-center">
    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">{title}</h3>
    <p className="text-sm text-foreground/70">
      (An interactive chart or diagram will be displayed here.)
    </p>
  </div>
);

// Placeholder for a diagram component
const DiagramPlaceholder = ({ title = "Diagram" }: { title?: string }) => (
  <div className="my-6 p-4 border border-dashed border-green-400/50 rounded-lg bg-green-500/5 min-h-[200px] flex flex-col items-center justify-center">
    <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">{title}</h3>
    <p className="text-sm text-foreground/70">
      (A diagram or illustration will be displayed here.)
    </p>
  </div>
);

interface InfoPageProps {
  title: string;
  children: ReactNode; // Main content of the page
  // Optional slots for specific types of content
  charts?: ReactNode[];
  diagrams?: ReactNode[];
}

const InfoPage: React.FC<InfoPageProps> = ({
  title,
  children,
  charts,
  diagrams,
}) => {
  return (
    <div className="container mx-auto py-8 px-4">
      <article className="prose dark:prose-invert lg:prose-xl max-w-none">
        {/*
          Using Tailwind Typography (prose classes) for rich text formatting.
          Ensure @tailwindcss/typography plugin is installed if not already.
          The 'max-w-none' removes the default max-width from prose for full container width.
          Adjust 'lg:prose-xl' for desired text size.
        */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground !mb-4 border-b border-border pb-4">
            {/* Added !mb-4 to override prose heading margin if needed */}
            {title}
          </h1>
        </header>

        <section className="mb-8">
          {children}
        </section>

        {charts && charts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">Charts & Visualizations</h2>
            {charts.map((chart, index) => (
              <div key={`chart-${index}`}>{chart}</div>
            ))}
            {/* Example of using the placeholder directly */}
            {/* <InteractiveChartPlaceholder /> */}
          </section>
        )}

        {diagrams && diagrams.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mt-10 mb-4">Diagrams & Illustrations</h2>
            {diagrams.map((diagram, index) => (
              <div key={`diagram-${index}`}>{diagram}</div>
            ))}
            {/* Example of using the placeholder directly */}
            {/* <DiagramPlaceholder /> */}
          </section>
        )}
      </article>
    </div>
  );
};

export default InfoPage;

// Exporting placeholders for potential use in actual page construction
export { InteractiveChartPlaceholder, DiagramPlaceholder };
