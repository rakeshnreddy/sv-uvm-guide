export interface SimulationStats {
  /** Total runtime in milliseconds */
  runtimeMs: number;
  /** Resident set size in bytes */
  memoryBytes: number;
}

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
}
