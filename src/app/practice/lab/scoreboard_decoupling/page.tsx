import React from 'react';
import LabEnvironmentRunner from '@/components/curriculum/labs/LabEnvironmentRunner';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { readFileSync } from 'fs';
import path from 'path';

export const metadata = {
  title: 'Lab: Scoreboard Decoupling | SV-UVM Guide',
  description: 'Practice removing monitor backpressure by routing transactions through an analysis FIFO.',
};

export default function ScoreboardDecouplingLabPage() {
  // Read the lab README.md at build time
  const readmePath = path.join(process.cwd(), 'labs', 'scoreboard_decoupling', 'README.md');
  let readmeContent = 'Lab instructions not found.';
  try {
    readmeContent = readFileSync(readmePath, 'utf8');
  } catch (e) {
    console.error('Failed to load scoreboard_decoupling README:', e);
  }

  // Define the initial lab files
  const initialFiles = {
    'Makefile': 'all:\n\tvcs -sverilog -ntb_opts uvm-1.2 src/dv/testbench.sv src/dv/*.sv\n\t./simv\n',
    'src/dv/txn.sv': 'class my_txn extends uvm_sequence_item;\n  rand bit [7:0] data;\n  `uvm_object_utils_begin(my_txn)\n    `uvm_field_int(data, UVM_ALL_ON)\n  `uvm_object_utils_end\n  function new(string name="my_txn"); super.new(name); endfunction\nendclass\n',
    'src/dv/monitor.sv': 'class my_monitor extends uvm_monitor;\n  `uvm_component_utils(my_monitor)\n  uvm_analysis_port #(my_txn) ap;\n  \n  function new(string name="my_monitor", uvm_component parent=null);\n    super.new(name, parent);\n    ap = new("ap", this);\n  endfunction\n\n  task run_phase(uvm_phase phase);\n    my_txn txn;\n    forever begin\n      #10; // Clock tick\n      txn = my_txn::type_id::create("txn");\n      txn.randomize();\n      $display("@%0t [MON] Broadcasting txn data: %h", $time, txn.data);\n      ap.write(txn);\n      $display("@%0t [MON] Broadcast complete.", $time);\n    end\n  endtask\nendclass\n',
    'src/dv/scoreboard.sv': 'class my_scoreboard extends uvm_scoreboard;\n  `uvm_component_utils(my_scoreboard)\n  \n  // TODO: Change this imp to a get_port\n  uvm_analysis_imp #(my_txn, my_scoreboard) analysis_export;\n\n  function new(string name="my_scoreboard", uvm_component parent=null);\n    super.new(name, parent);\n    analysis_export = new("analysis_export", this);\n  endfunction\n\n  // TODO: Remove this write method and replace with a run_phase looping over get()\n  virtual function void write(my_txn t);\n    $display("@%0t [SCB] Received txn data: %h. Processing...", $time, t.data);\n    // Simulate slow processing (this blocks the monitor!)\n    #30;\n    $display("@%0t [SCB] Finished processing.", $time);\n  endfunction\nendclass\n',
    'src/dv/env.sv': 'class my_env extends uvm_env;\n  `uvm_component_utils(my_env)\n  my_monitor    mon;\n  my_scoreboard scb;\n  \n  // TODO: Declare a uvm_tlm_analysis_fifo #(my_txn) here\n\n  function new(string name="my_env", uvm_component parent=null);\n    super.new(name, parent);\n  endfunction\n\n  function void build_phase(uvm_phase phase);\n    super.build_phase(phase);\n    mon = my_monitor::type_id::create("mon", this);\n    scb = my_scoreboard::type_id::create("scb", this);\n    // TODO: Create the FIFO in the factory\n  endfunction\n\n  function void connect_phase(uvm_phase phase);\n    // TODO: Disconnect the direct connection and route through the FIFO instead.\n    mon.ap.connect(scb.analysis_export);\n  endfunction\nendclass\n',
    'src/dv/testbench.sv': '`include "uvm_macros.svh"\nimport uvm_pkg::*;\n\n`include "src/dv/txn.sv"\n`include "src/dv/monitor.sv"\n`include "src/dv/scoreboard.sv"\n`include "src/dv/env.sv"\n\nmodule testbench;\n  my_env env;\n  initial begin\n    env = my_env::type_id::create("env", null);\n    run_test();\n  end\n  \n  initial begin\n    #100;\n    $display("Test finished.");\n    $finish;\n  end\nendmodule\n'
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections"
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to TLM Connections
          </Link>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Intermediate Lab
          </Badge>
        </div>
      </div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Decoupling the Scoreboard</h1>
        <p className="text-muted-foreground">
          Use an Analysis FIFO to break artificial backpressure on the broadcast fabric.
        </p>
      </div>

      <LabEnvironmentRunner
        labId="scoreboard-decoupling"
        labTitle="Scoreboard Decoupling"
        readmeContent={readmeContent}
        initialFiles={initialFiles}
      />
    </div>
  );
}
