typedef enum logic [1:0] { IDLE=0, ACTIVE=1, ERROR=2 } state_e;

class fsm_coverage;
  state_e state;

  covergroup cg_fsm;
    cp_state: coverpoint state {
      // Transition coverage uses =>
      bins idle_to_active = (IDLE => ACTIVE);
      bins active_to_error = (ACTIVE => ERROR);
      bins error_to_idle = (ERROR => IDLE);
      
      // We know ACTIVE cannot simply return to IDLE without reset!
      illegal_bins active_to_idle = (ACTIVE => IDLE);
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
    
    // Simulate valid transitions
    cov.sample(IDLE);
    cov.sample(ACTIVE);
    cov.sample(ERROR);
    cov.sample(IDLE);
    
    $display("Coverage: %0f%%", cov.cg_fsm.get_coverage());
  end
endprogram
