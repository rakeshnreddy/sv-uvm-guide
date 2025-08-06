import { spawn } from 'child_process';
import {
  SimulationResult,
  SimulationStats,
  SimulatorBackend,
} from './types';

/**
 * Executes a SystemVerilog simulation inside a containerised open-source
 * simulator. The current implementation uses a very lightweight bash script as
 * a placeholder but is structured so that tools like Icarus Verilog or
 * Verilator (via Docker or WebAssembly) can be dropped in with minimal
 * changes.
 */
export async function runSimulation(
  source: string,
  backend: SimulatorBackend = 'wasm',
): Promise<SimulationResult> {
  const start = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();

  return new Promise((resolve, reject) => {
    // Select a backend-specific command. These are placeholders that mimic the
    // behaviour of real tools such as Icarus Verilog or Verilator.
    let cmd: string;
    switch (backend) {
      case 'icarus':
        cmd =
          'echo "[Icarus] Compiling..." && sleep 1 && echo "[Icarus] Running..." && sleep 1 && echo "Simulation PASSED"';
        break;
      case 'verilator':
        cmd =
          'echo "[Verilator] Compiling..." && sleep 1 && echo "[Verilator] Running..." && sleep 1 && echo "Simulation PASSED"';
        break;
      default:
        cmd =
          'echo "[WASM] Initialising..." && sleep 1 && echo "[WASM] Executing..." && sleep 1 && echo "Simulation PASSED"';
        break;
    }
    const proc = spawn('bash', ['-lc', cmd]);

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
      const cpu = process.cpuUsage(cpuStart);
      const stats: SimulationStats = {
        runtimeMs: Number(end - start) / 1e6,
        memoryBytes: process.memoryUsage().rss,
        cpuUserMs: cpu.user / 1000,
        cpuSystemMs: cpu.system / 1000,
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
        coverage: 80,
        regressions: [],
        backend,
      });
    });
  });
}
