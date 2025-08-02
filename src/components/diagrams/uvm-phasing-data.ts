export interface UvmPhase {
  name: string;
  type: 'build' | 'connect' | 'run' | 'cleanup';
  description: string;
  isTask: boolean;
}

export const uvmPhases: UvmPhase[] = [
  // Build Phases (run in order, top-down)
  { name: 'build', type: 'build', description: 'Constructs component hierarchy. New components are created here.', isTask: false },
  { name: 'connect', type: 'connect', description: 'Connects TLM ports and exports. Establishes communication paths.', isTask: false },
  { name: 'end_of_elaboration', type: 'connect', description: 'Final checks before simulation starts. Final adjustments to component settings.', isTask: false },

  // Run-Time Phases (run in parallel)
  { name: 'start_of_simulation', type: 'run', description: 'Prepare for the main simulation. Display banners, set up initial state.', isTask: false },
  { name: 'pre_reset', type: 'run', description: 'Tasks before reset is asserted. E.g., wait for power-on.', isTask: true },
  { name: 'reset', type: 'run', description: 'Assert and de-assert reset signals.', isTask: true },
  { name: 'post_reset', type: 'run', description: 'Tasks after reset is de-asserted. E.g., configure DUT.', isTask: true },
  { name: 'pre_configure', type: 'run', description: 'Prepare for main stimulus. E.g., load memories.', isTask: true },
  { name: 'configure', type: 'run', description: 'Apply configuration to the DUT.', isTask: true },
  { name: 'post_configure', type: 'run', description: 'Wait for configuration to take effect.', isTask: true },
  { name: 'pre_main', type: 'run', description: 'Final preparations before the main stimulus.', isTask: true },
  { name: 'main', type: 'run', description: 'The main stimulus generation and checking phase.', isTask: true },
  { name: 'post_main', type: 'run', description: 'Stimulus is complete, wait for DUT to settle.', isTask: true },
  { name: 'pre_shutdown', type: 'run', description: 'Prepare for the end of the test.', isTask: true },
  { name: 'shutdown', type: 'run', description: 'Final stimulus, e.g., read out status registers.', isTask: true },
  { name: 'post_shutdown', type: 'run', description: 'Wait for all shutdown activity to complete.', isTask: true },

  // Cleanup Phases (run in order, bottom-up)
  { name: 'extract', type: 'cleanup', description: 'Extract data from scoreboard and coverage collectors.', isTask: false },
  { name: 'check', type: 'cleanup', description: 'Check for simulation errors and report results.', isTask: false },
  { name: 'report', type: 'cleanup', description: 'Generate final simulation report.', isTask: false },
  { name: 'final', type: 'cleanup', description: 'Final cleanup before simulation terminates.', isTask: false },
];
