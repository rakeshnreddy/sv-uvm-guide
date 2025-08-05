import { spawn } from 'child_process';
import { SimulationResult, SimulationStats } from './types';

/**
 * Executes a SystemVerilog simulation inside a containerised open-source
 * simulator. The current implementation uses a very lightweight bash script as
 * a placeholder but is structured so that tools like Icarus Verilog or
 * Verilator (via Docker or WebAssembly) can be dropped in with minimal
 * changes.
 */
export async function runSimulation(source: string): Promise<SimulationResult> {
  const start = process.hrtime.bigint();

  return new Promise((resolve, reject) => {
    // Placeholder command: echo compilation and simulation messages.
    const proc = spawn('bash', ['-lc', 'echo "Compiling..." && sleep 1 && echo "Running..." && sleep 1 && echo "Done"']);

    let output = '';
    proc.stdout.on('data', (d) => {
      output += d.toString();
    });
    proc.stderr.on('data', (d) => {
      output += d.toString();
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', () => {
      const end = process.hrtime.bigint();
      const stats: SimulationStats = {
        runtimeMs: Number(end - start) / 1e6,
        memoryBytes: process.memoryUsage().rss,
      };

      // Simple demo waveform
      const waveform = {
        signal: [
          { name: 'clk', wave: 'p.....|...' },
          { name: 'data', wave: 'x3.4..|x.' },
        ],
      };

      resolve({
        output,
        waveform,
        stats,
        coverage: 0,
        regressions: [],
      });
    });
  });
}
