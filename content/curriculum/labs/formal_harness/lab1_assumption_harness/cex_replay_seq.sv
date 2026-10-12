// compile
// cex_replay_seq.sv: replay a formal counterexample in UVM (lab formal-harness, step 4)
//
// Fill in push_v and pop_v from the counterexample trace of step 3, then
// predict what the simulation reports and at which edge.
//
// The replay only works with a driver that applies one item per clock edge
// and drives push = 0, pop = 0 when it has no item (see the lesson's fifo_drv).

package fifo_replay_pkg;
  import uvm_pkg::*;
  `include "uvm_macros.svh"

  class fifo_item extends uvm_sequence_item;
    rand bit push, pop;
    bit      full_seen, empty_seen;  // copied in by a sequence before randomize()
    constraint c_legal { full_seen -> !push; empty_seen -> !pop; }
    `uvm_object_utils(fifo_item)
    function new(string name = "fifo_item");
      super.new(name);
    endfunction
  endclass

  class cex_replay_seq extends uvm_sequence #(fifo_item);
    `uvm_object_utils(cex_replay_seq)

    // TODO: copy the trace's push and pop values for the edges you must drive.
    //       Size the arrays to match.
    bit push_v[1] = '{0};
    bit pop_v[1]  = '{0};

    function new(string name = "cex_replay_seq");
      super.new(name);
    endfunction

    task body();
      foreach (push_v[i]) begin
        req = fifo_item::type_id::create($sformatf("cex_%0d", i));
        start_item(req);
        // TODO: set req.push and req.pop from the arrays.
        //       Decide: assign them, or call req.randomize()? Why?
        finish_item(req);
      end
    endtask
  endclass
endpackage
