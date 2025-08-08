import React, { ReactNode } from "react";

interface InfoPageProps {
  title?: string;
  description?: string;
  children?: ReactNode; // Main content of the page
  // Optional slots for specific types of content
  charts?: ReactNode[];
  diagrams?: ReactNode[];
}

export const InfoPage: React.FC<InfoPageProps> = ({
  title,
  description,
  children,
  charts,
  diagrams,
}) => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="p-4 md:p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <article className="prose dark:prose-invert lg:prose-xl max-w-none">
          {title && (
            <header className="mb-8">
              <h1 className="text-4xl font-bold mb-2">{title}</h1>
              {description && (
                <p className="text-foreground/80 text-lg">{description}</p>
              )}
            </header>
          )}

          {children && (
            <section className="mb-8">
              {children}
            </section>
          )}

          {charts && charts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mt-10 mb-4">Charts & Visualizations</h2>
              {charts.map((chart, index) => (
                <div key={`chart-${index}`}>{chart}</div>
              ))}
            </section>
          )}

          {diagrams && diagrams.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mt-10 mb-4">Diagrams & Illustrations</h2>
              {diagrams.map((diagram, index) => (
                <div key={`diagram-${index}`}>{diagram}</div>
              ))}
            </section>
          )}
        </article>
      </div>
    </div>
  );
};

export default InfoPage;
