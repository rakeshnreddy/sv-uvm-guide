import { describe, it, expect, vi } from 'vitest';
import { runSimulation as runSimulationOriginal } from '../../src/server/simulation';
import { EventEmitter } from 'events';

describe('runSimulation', () => {
  it('parses simulator output', async () => {
    const result = await runSimulationOriginal('module', 'wasm');
    expect(result.output).toContain('Simulation PASSED');
    expect(result.backend).toBe('wasm');
    expect(result.waveform.signal.length).toBeGreaterThan(0);
  });

  it('handles simulator errors', async () => {
    vi.resetModules();
    vi.doMock('child_process', () => ({
      spawn: () => {
        const proc: any = new EventEmitter();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.stdin = { write: () => {}, end: () => {} };
        setTimeout(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      },
      default: { spawn: () => {
        const proc: any = new EventEmitter();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.stdin = { write: () => {}, end: () => {} };
        setTimeout(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      } },
    }));
    const { runSimulation } = await import('../../src/server/simulation');
    await expect(runSimulation('bad')).rejects.toThrow('spawn failed');
    vi.doUnmock('child_process');
  });
});
