import { describe, expect, it } from 'vitest';

import { getLabAssets } from '@/lib/lab-assets';
import { getLabById } from '@/lib/lab-registry';

describe('lab asset loader', () => {
  it('loads multi-file PSS labs with language and role metadata', () => {
    const lab = getLabById('pss-portable-intent');
    expect(lab).toBeDefined();

    const assets = getLabAssets(lab!);
    expect(assets.map((asset) => asset.path)).toEqual([
      'README.md',
      'starter/mem_test.pss',
      'solution/generated_baremetal_test.c',
      'solution/generated_uvm_sequence.sv',
      'solution/mem_test.pss',
      'lab.json',
    ]);

    expect(assets.find((asset) => asset.path === 'starter/mem_test.pss')).toMatchObject({
      role: 'starter',
      language: 'pss',
      editable: true,
    });
    expect(assets.find((asset) => asset.path === 'solution/generated_baremetal_test.c')).toMatchObject({
      role: 'solution',
      language: 'c',
      editable: false,
    });
  });

  it('keeps markdown guides readable for legacy labs', () => {
    const lab = getLabById('scoreboard-reference-model');
    expect(lab).toBeDefined();

    const assets = getLabAssets(lab!);
    expect(assets.some((asset) => asset.path === 'README.md' && asset.language === 'markdown')).toBe(true);
    expect(assets.some((asset) => asset.path === 'testbench.sv' && asset.language === 'systemverilog')).toBe(true);
  });
});
