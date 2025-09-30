const componentLinkMap: Record<string, string | null> = {
  test: '/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index',
  env: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index',
  agent_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  agent_passive: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  sequencer_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  driver_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  monitor_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  monitor_passive: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  scoreboard: '/curriculum/T2_Intermediate/I-UVM-4_Factory_and_Overrides/index',
  coverage_collector: '/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/index',
  uvm_component: '/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index',
  uvm_test: '/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index',
  uvm_env: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index',
  uvm_agent: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  uvm_sequencer: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  uvm_driver: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  uvm_monitor: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index',
  uvm_scoreboard: '/curriculum/T2_Intermediate/I-UVM-4_Factory_and_Overrides/index',
  uvm_subscriber: '/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/index',
};

export const resolveComponentLink = (id: string): string | null => {
  return componentLinkMap[id] ?? null;
};

export { componentLinkMap };
