export const componentLinkMap: Record<string, string | null> = {
  test: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-bench-is-a-tree-of-roles',
  env: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-env-build-and-connect',
  agent_active: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#active-and-passive-agents',
  agent_passive: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#active-and-passive-agents',
  sequencer_active: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-sequence--sequencer--driver',
  driver_active: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-sequence--sequencer--driver',
  monitor_active: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-monitor-sample-build-a-new-item-publish',
  monitor_passive: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-monitor-sample-build-a-new-item-publish',
  scoreboard: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-bench-is-a-tree-of-roles',
  coverage_collector: '/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index#core-constructs-in-action',
  uvm_component: '/curriculum/T2_Intermediate/I-UVM-1A_Components/index#objects-travel-components-stay-anchored',
  uvm_test: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-bench-is-a-tree-of-roles',
  uvm_env: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-env-build-and-connect',
  uvm_agent: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#active-and-passive-agents',
  uvm_sequencer: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-sequence--sequencer--driver',
  uvm_driver: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-sequence--sequencer--driver',
  uvm_monitor: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-monitor-sample-build-a-new-item-publish',
  uvm_scoreboard: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-bench-is-a-tree-of-roles',
  uvm_subscriber: '/curriculum/T2_Intermediate/I-UVM-2A_Component_Roles/index#the-bench-is-a-tree-of-roles',
};

export const resolveComponentLink = (id: string): string | null => {
  return componentLinkMap[id] ?? null;
};
