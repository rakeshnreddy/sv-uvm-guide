`ifndef VIRTUAL_SEQUENCER_SV
`define VIRTUAL_SEQUENCER_SV

class virtual_sequencer extends uvm_sequencer;
  `uvm_component_utils(virtual_sequencer)

  sequencer m_sequencer_a;
  sequencer m_sequencer_b;

  function new(string name = "virtual_sequencer", uvm_component parent = null);
    super.new(name, parent);
  endfunction

endclass

`endif // VIRTUAL_SEQUENCER_SV
