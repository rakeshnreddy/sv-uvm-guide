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
  title?: string;
  children: ReactNode; // Main content of the page
  // Optional slots for specific types of content
  charts?: ReactNode[];
  diagrams?: ReactNode[];
}

export const InfoPage: React.FC<InfoPageProps> = ({
  title,
  children,
  charts,
  diagrams,
}) => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="p-4 md:p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <article className="prose dark:prose-invert lg:prose-xl max-w-none">
          {/*
          Using Tailwind Typography (prose classes) for rich text formatting.
          Ensure @tailwindcss/typography plugin is installed if not already.
          The 'max-w-none' removes the default max-width from prose for full container width.
          Adjust 'lg:prose-xl' for desired text size.
        */}
          <section className="mb-8">
            {children}
          </section>

          {charts && charts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mt-10 mb-4">Charts & Visualizations</h2>
              {charts.map((chart, index) => (
                <div key={`chart-${index}`}>{chart}</div>
              ))}
              {/* Example of using the placeholder directly */}
              {/* <InteractiveChartPlaceholder /> */}
            </section>
          )}

          {diagrams && diagrams.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mt-10 mb-4">Diagrams & Illustrations</h2>
              {diagrams.map((diagram, index) => (
                <div key={`diagram-${index}`}>{diagram}</div>
              ))}
              {/* Example of using the placeholder directly */}
              {/* <DiagramPlaceholder /> */}
            </section>
          )}
        </article>
      </div>
    </div>
  );
};

// Exporting placeholders for potential use in actual page construction
export { InteractiveChartPlaceholder, DiagramPlaceholder };
export default InfoPage;
