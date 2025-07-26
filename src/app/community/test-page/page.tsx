import React from 'react';
import { InteractiveCode, ExplanationStep } from '@/components/ui/InteractiveCode';

const testCode = 
'// test_sequence.sv\n' +
'class test_sequence extends uvm_sequence;\n' +
'  `uvm_object_utils(test_sequence)\n' +
'\n' +
'  function new(string name="test_sequence", uvm_object parent=null);\n' +
'    super.new(name, parent);\n' +
'  endfunction\n' +
'\n' +
'  virtual task body();\n' +
'    `uvm_info("SEQ", "Starting test sequence", UVM_MEDIUM)\n' +
'  endtask\n' +
'endclass'.trim();

const testExplanationSteps: ExplanationStep[] = [
  { target: "2-11", title: "Test Sequence", explanation: "A simple test sequence." },
];

export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Component Test Page</h1>
      <InteractiveCode
        language="systemverilog"
        explanationSteps={testExplanationSteps}
        fileName="test.sv"
      >
        {testCode}
      </InteractiveCode>
    </div>
  );
}
