import React from 'react';
import ScoreboardConnectorExercise from '@/components/exercises/ScoreboardConnectorExercise';
import { InfoPage } from '@/components/templates/InfoPage';

const ScoreboardConnectorPage: React.FC = () => {
  const pageTitle = "Exercise: Scoreboard Connector";

  const content = (
    <>
      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-primary mb-2">Wire the checking side of an agent environment</h2>
        <p className="text-muted-foreground mb-1">
          The env holds an agent, a predictor, a scoreboard with an expected and an actual analysis FIFO, and a coverage subscriber.
          Write the env&apos;s connect_phase so the monitor&apos;s stream and the predictor&apos;s output each reach the right place.
        </p>
        <p className="text-muted-foreground">
          Every connect() you make is checked with the same rules uvm-core applies, and the generated code updates as you go.
          Some mistakes are UVM errors; others are legal UVM that silently breaks the checker.
        </p>
      </section>

      <div className="my-8">
        <ScoreboardConnectorExercise />
      </div>

      <section className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Learning objectives</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Choose the caller and the argument of connect() for analysis connections, including imps named &quot;analysis_export&quot;.</li>
          <li>Explain why a missing analysis connection passes elaboration silently, and what it does to the scoreboard.</li>
          <li>Predict the order of analysis write() calls and explain why the scoreboard reads its inputs through analysis FIFOs.</li>
        </ul>
        <p className="text-muted-foreground mt-4">Use Check wiring to grade your connect_phase and Reset board to start over.</p>
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
    description: "Wire a monitor, predictor, scoreboard FIFOs and coverage in a UVM env's connect_phase, graded by a model of uvm-core's connection rules.",
  };
}
