export const componentLinkMap: Record<string, string | null> = {
  test: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  env: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#layered-environment-snapshot',
  agent_active: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  agent_passive: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  sequencer_active: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-uvm_sequence-and-the-driver',
  driver_active: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-uvm_sequence-and-the-driver',
  monitor_active: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  monitor_passive: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  scoreboard: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  coverage_collector: '/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index#core-constructs-in-action',
  uvm_component: '/curriculum/T2_Intermediate/I-UVM-1A_Components/index#uvm_component-vs-uvm_object',
  uvm_test: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  uvm_env: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#layered-environment-snapshot',
  uvm_agent: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  uvm_sequencer: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-uvm_sequence-and-the-driver',
  uvm_driver: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-uvm_sequence-and-the-driver',
  uvm_monitor: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  uvm_scoreboard: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
  uvm_subscriber: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#component-roles-breakdown',
};

export const resolveComponentLink = (id: string): string | null => {
  return componentLinkMap[id] ?? null;
};
