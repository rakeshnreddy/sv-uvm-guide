export const componentLinkMap: Record<string, string | null> = {
  test: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#tests-configure-the-run',
  env: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#layered-environment-snapshot',
  agent_active: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#agents-as-the-unit-of-reuse',
  agent_passive: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#agents-as-the-unit-of-reuse',
  sequencer_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index#sequencer-and-driver-handshake',
  driver_active: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index#sequencer-and-driver-handshake',
  monitor_active: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
  monitor_passive: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
  scoreboard: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
  coverage_collector: '/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/index#core-constructs-in-action',
  uvm_component: '/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index#objects-travel-components-stay-anchored',
  uvm_test: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#tests-configure-the-run',
  uvm_env: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#layered-environment-snapshot',
  uvm_agent: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#agents-as-the-unit-of-reuse',
  uvm_sequencer: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index#sequencer-and-driver-handshake',
  uvm_driver: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/index#sequencer-and-driver-handshake',
  uvm_monitor: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
  uvm_scoreboard: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
  uvm_subscriber: '/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index#monitors-scoreboards-and-the-analysis-fabric',
};

export const resolveComponentLink = (id: string): string | null => {
  return componentLinkMap[id] ?? null;
};
