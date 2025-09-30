import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(__dirname, '../../scripts/check-bundle-size.cjs');
const statsPath = path.resolve(__dirname, '../fixtures/bundle/stats.json');
const baselinePath = path.resolve(__dirname, '../fixtures/bundle/baseline.json');
const failingBaselinePath = path.resolve(__dirname, '../fixtures/bundle/failing-baseline.json');

describe('bundle size guard script', () => {
  it('passes when bundle sizes stay within tolerance', async () => {
    const { stdout } = await execFileAsync('node', [scriptPath], {
      env: {
        ...process.env,
        BUNDLE_ANALYZER_REPORT: statsPath,
        BUNDLE_BASELINE_PATH: baselinePath,
      },
    });

    expect(stdout).toContain('Bundle size check passed.');
    expect(stdout).toContain('"app/test/page"');
  });

  it('fails with an actionable message when bundle sizes exceed the baseline', async () => {
    await expect(
      execFileAsync('node', [scriptPath], {
        env: {
          ...process.env,
          BUNDLE_ANALYZER_REPORT: statsPath,
          BUNDLE_BASELINE_PATH: failingBaselinePath,
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Bundle size check failed'),
    });
  });
});
