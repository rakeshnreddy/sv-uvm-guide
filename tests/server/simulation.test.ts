import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';

// mock child_process before importing the module under test
vi.mock('child_process', () => {
  const spawn = vi.fn();
  return { spawn, default: { spawn } };
});

import { runSimulation } from '@/server/simulation';
import { spawn } from 'child_process';

function mockSimulator({ stdoutData = '', stderrData = '', exitCode = 0 }) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const events = new EventEmitter();
  (spawn as unknown as vi.Mock).mockReturnValueOnce(
    Object.assign(events, { stdout, stderr, stdin }) as any,
  );

  setImmediate(() => {
    if (stdoutData) stdout.write(stdoutData);
    stdout.end();
    if (stderrData) stderr.write(stderrData);
    stderr.end();
    events.emit('close', exitCode);
  });
}

describe('runSimulation', () => {
  beforeEach(() => {
    (spawn as unknown as vi.Mock).mockReset();
  });

  it('captures pass, coverage and waveform information', async () => {
    mockSimulator({
      stdoutData:
        'Simulation PASSED\nCOVERAGE: 75\nWAVEFORM: {"signal":[{"name":"clk","wave":"p"}]}\n',
      exitCode: 0,
    });

    const result = await runSimulation('module t; endmodule', 'icarus');
    expect(result.passed).toBe(true);
    expect(result.coverage).toBe(75);
    expect(result.waveform).toEqual({
      signal: [{ name: 'clk', wave: 'p' }],
    });
    expect(result.errors).toEqual([]);
  });

  it('records errors on failure', async () => {
    mockSimulator({
      stdoutData: 'Simulation FAILED\n',
      stderrData: 'ERROR: bad signal\n',
      exitCode: 1,
    });

    const result = await runSimulation('module t; endmodule', 'icarus');
    expect(result.passed).toBe(false);
    expect(result.errors).toContain('ERROR: bad signal');
  });
});

