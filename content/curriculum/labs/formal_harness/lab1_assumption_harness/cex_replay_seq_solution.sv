// compile
// cex_replay_seq_solution.sv: the replay of the step-3 counterexample
//
// Trace (p_full_is_correct, starter RTL, contract only), edges from reset:
//   edge   0 1 2 3 4
//   push   1 1 1 1 0
//   pop    0 0 0 0 0
//   count  0 1 2 3 4
//   full   0 0 0 0 0   <- fails at edge 4: count == DEPTH but full == 0
//
// Drive edges 0..3; edge 4 is where the failure is sampled, and the driver
// idles there. Expected in simulation: p_full_is_correct fails 4 edges after
// the first replayed push, with count == 4 and full == 0.

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

    bit push_v[4] = '{1, 1, 1, 1};
    bit pop_v[4]  = '{0, 0, 0, 0};

    function new(string name = "cex_replay_seq");
      super.new(name);
    endfunction

    task body();
      foreach (push_v[i]) begin
        req = fifo_item::type_id::create($sformatf("cex_%0d", i));
        start_item(req);
        // Assigned, not randomized: randomize() would apply c_legal and could
        // change the values, so the trace would no longer be replayed exactly.
        req.push = push_v[i];
        req.pop  = pop_v[i];
        finish_item(req);
      end
    endtask
  endclass
endpackage
