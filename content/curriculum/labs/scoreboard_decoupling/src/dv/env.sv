// The environment. It connects to the scoreboard's req_in and rsp_in, so it
// does not change when the scoreboard switches from imps to exports and FIFOs.

class my_env extends uvm_env;
  `uvm_component_utils(my_env)

  traffic_gen   gen;
  my_scoreboard scb;

  function new(string name, uvm_component parent);
    super.new(name, parent);
  endfunction

  virtual function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    gen = traffic_gen::type_id::create("gen", this);
    scb = my_scoreboard::type_id::create("scb", this);
  endfunction

  virtual function void connect_phase(uvm_phase phase);
    super.connect_phase(phase);
    gen.req_ap.connect(scb.req_in);
    gen.rsp_ap.connect(scb.rsp_in);
  endfunction
endclass
