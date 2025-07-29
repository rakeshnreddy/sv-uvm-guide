`ifndef VIRTUAL_SEQUENCE_SV
`define VIRTUAL_SEQUENCE_SV

class alu_virtual_sequence extends uvm_sequence;
  `uvm_object_utils(alu_virtual_sequence)

  function new(string name = "alu_virtual_sequence");
    super.new(name);
  endfunction

  virtual task body();
    virtual_sequencer v_sqr;
    if (!$cast(v_sqr, p_sequencer)) begin
      `uvm_fatal("VSEQ", "Failed to cast p_sequencer to virtual_sequencer type")
    end

    a_sequence a_seq = a_sequence::type_id::create("a_seq");
    b_sequence b_seq = b_sequence::type_id::create("b_seq");

    `uvm_info("VSEQ", "Starting parallel sequences on Agent A and Agent B", UVM_MEDIUM)

    fork
      a_seq.start(v_sqr.m_sequencer_a);
      b_seq.start(v_sqr.m_sequencer_b);
    join

    `uvm_info("VSEQ", "Finished parallel sequences", UVM_MEDIUM)
  endtask
endclass

`endif // VIRTUAL_SEQUENCE_SV
