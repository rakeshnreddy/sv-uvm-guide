"use client";

import React, { useState } from 'react';
import { InteractiveCode } from '@/components/ui/InteractiveCode';
import { CodeExecutionEnvironment } from '@/components/ui/CodeExecutionEnvironment';
import { CodeChallengeSystem } from '@/components/ui/CodeChallengeSystem';
import { DebuggingSimulator } from '@/components/ui/DebuggingSimulator';
import { CodeReviewAssistant } from '@/components/ui/CodeReviewAssistant';
import { InfoPage } from '@/components/templates/InfoPage';

const initialDemoCode = `
module test;
  initial begin
    $display("Hello, World! Welcome to the interactive simulation.");
    #10;
    $display("Simulation finished at time %0t.", $time);
  end
endmodule
`;

const InteractiveDemoPage = () => {
  const [code, setCode] = useState(initialDemoCode);

  return (
    <InfoPage
      title="Interactive Components Demo"
      description="A showcase of the new interactive learning components for SystemVerilog and UVM."
    >
      <div className="p-4 md:p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-4">Interactive Simulation Environment</h2>
        <p className="text-foreground/80 mb-4">
          You can edit the SystemVerilog code below and click "Run Simulation" to see the output from the server.
        </p>

        <div className="editable-code-section">
            <InteractiveCode
                fileName="editable_test.sv"
                isEditable={true}
                onChange={(newCode) => setCode(newCode ?? '')}
            >
                {initialDemoCode}
            </InteractiveCode>
        </div>

        <div className="execution-environment-section mt-4">
            <CodeExecutionEnvironment code={code} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-3xl font-bold my-4 mt-8">Future Components</h2>
        <p className="text-foreground/80 mb-4">
            The following components are placeholders for upcoming features that will be developed in the next phases.
        </p>
        <CodeChallengeSystem />
        <DebuggingSimulator />
        <CodeReviewAssistant />
      </div>

    </InfoPage>
  );
};

export default InteractiveDemoPage;
