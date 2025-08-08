import React from 'react';
import ScoreboardConnectorExercise from '@/components/exercises/ScoreboardConnectorExercise';
import { InfoPage } from '@/components/templates/InfoPage';

const ScoreboardConnectorPage: React.FC = () => {
  const pageTitle = "Exercise: Scoreboard Connector";

  const content = (
    <>
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Connect the UVM Scoreboard</h2>
        <p className="text-muted-foreground mb-1">
          Visually connect the UVM Monitor&apos;s analysis port to the analysis imports of the Scoreboard and Coverage Collector.
        </p>
        <p className="text-muted-foreground">
          This exercise simulates a common task in UVM testbench development: establishing TLM connections for transaction analysis.
        </p>
      </section>

      <div className="my-8 flex justify-center">
        <ScoreboardConnectorExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning Objectives:</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Understand the role of analysis ports and imps in UVM.</li>
          <li>Visualize how monitors broadcast transactions to multiple subscribers.</li>
          <li>Practice a key aspect of UVM testbench connectivity.</li>
        </ul>
        <p className="text-muted-foreground mt-4">Use Check to evaluate your connections and Retry to start over.</p>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default ScoreboardConnectorPage;

export async function generateMetadata() {
  return {
    title: "Exercise: Scoreboard Connector | SystemVerilog & UVM Mastery",
    description: "Interactive exercise to connect UVM monitor analysis ports to scoreboard and coverage collector analysis imports.",
  };
}
