export interface SimulationStats {
  /** Total runtime in milliseconds */
  runtimeMs: number;
  /** Resident set size in bytes */
  memoryBytes: number;
  /** User CPU time in milliseconds */
  cpuUserMs: number;
  /** System CPU time in milliseconds */
  cpuSystemMs: number;
}

export type SimulatorBackend = 'wasm' | 'icarus' | 'verilator';

export interface SimulationResult {
  /** Combined stdout/stderr output from the simulator */
  output: string;
  /** Waveform JSON suitable for WaveDrom rendering */
  waveform: unknown;
  /** Aggregate performance and resource metrics */
  stats: SimulationStats;
  /** Code coverage percentage reported by the simulator */
  coverage: number;
  /** Any regression failures collected during execution */
  regressions: string[];
  /** Backend used for the simulation */
  backend: SimulatorBackend;
  /** Whether the simulation completed successfully */
  passed: boolean;
  /** Detailed error messages reported by the simulator */
  errors: string[];
}
