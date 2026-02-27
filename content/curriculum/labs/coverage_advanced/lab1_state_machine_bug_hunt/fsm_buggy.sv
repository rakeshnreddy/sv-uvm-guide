typedef enum logic [1:0] { IDLE=0, ACTIVE=1, ERROR=2 } state_e;

class fsm_coverage;
  state_e state;

  covergroup cg_fsm;
    // VERY BASIC: Only checks if states were visited
    cp_state: coverpoint state {
      bins idle   = {IDLE};
      bins active = {ACTIVE};
      bins error  = {ERROR};
    }
  endgroup

  function new();
    cg_fsm = new();
  endfunction

  function void sample(state_e s);
    state = s;
    cg_fsm.sample();
  endfunction
endclass

program test;
  initial begin
    fsm_coverage cov = new();
    // Simulate some transitions
    cov.sample(IDLE);
    cov.sample(ACTIVE);
    cov.sample(ERROR);
    
    $display("Coverage: %0d%%", cov.cg_fsm.get_coverage());
  end
endprogram
