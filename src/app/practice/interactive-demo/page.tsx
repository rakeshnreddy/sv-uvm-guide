import { InteractiveCode, ExplanationStep } from '@/components/ui/InteractiveCode';
import { CodeExecutionEnvironment } from '@/components/ui/CodeExecutionEnvironment';
import { CodeChallengeSystem } from '@/components/ui/CodeChallengeSystem';
import { DebuggingSimulator } from '@/components/ui/DebuggingSimulator';
import { CodeReviewAssistant } from '@/components/ui/CodeReviewAssistant';
import { InfoPage } from '@/components/templates/InfoPage';

const demoCode = `
module simple_driver;
  logic clk;
  logic reset;
  logic [7:0] data_out;
  logic valid_out;

  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end

  // Reset generation
  initial begin
    reset = 1;
    #10;
    reset = 0;
    #100;
    $finish;
  end

  // Driving signals
  initial begin
    data_out = 8'h00;
    valid_out = 0;
    @(posedge clk);

    // Send first transaction
    data_out = 8'hA5;
    valid_out = 1;
    @(posedge clk);
    valid_out = 0;

    // Send second transaction
    #20;
    data_out = 8'hB3;
    valid_out = 1;
    @(posedge clk);
    valid_out = 0;
  end
endmodule
`;

const explanationSteps: ExplanationStep[] = [
    {
      target: '1-6',
      title: 'Module Declaration',
      explanation: 'This section declares the SystemVerilog module and its signals. We have a clock, a reset, and some data/valid signals.',
    },
    {
      target: '8-11',
      title: 'Clock Generator',
      explanation: 'This `initial` block creates a free-running clock with a 10ns period. The `forever` loop ensures it runs for the entire simulation.',
    },
    {
      target: '13-19',
      title: 'Reset Generation',
      explanation: 'This block handles the reset sequence. It asserts reset for 10ns at the beginning of the simulation.',
    },
    {
      target: '21-39',
      title: 'Signal Driver',
      explanation: 'This is the main logic for driving the output signals. It waits for the first clock edge after reset goes low, then sends two data transactions.',
    },
    {
        target: '28-32',
        title: 'First Transaction',
        explanation: 'Here, we drive the first data value (0xA5) onto the bus. `valid_out` is asserted for one clock cycle.',
    },
];


const InteractiveDemoPage = () => {
  return (
    <InfoPage
      title="Interactive Components Demo"
      description="A showcase of the new interactive learning components for SystemVerilog and UVM."
    >
        <h2 className="text-3xl font-bold my-4">Enhanced Interactive Code</h2>
        <InteractiveCode fileName="simple_driver.sv" explanationSteps={explanationSteps}>
            {demoCode}
        </InteractiveCode>

        <h2 className="text-3xl font-bold my-4 mt-8">Code Execution Environment</h2>
        <CodeExecutionEnvironment />

        <h2 className="text-3xl font-bold my-4 mt-8">Future Components</h2>
        <p className="text-foreground/80 mb-4">
            The following components are placeholders for upcoming features that will be developed in the next phases.
        </p>
        <CodeChallengeSystem />
        <DebuggingSimulator />
        <CodeReviewAssistant />

    </InfoPage>
  );
};

export default InteractiveDemoPage;
