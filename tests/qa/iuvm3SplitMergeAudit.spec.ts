import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { generateCurriculumData } from '../../scripts/generate-curriculum-data';

const repoRoot = process.cwd();

const iuvm3bIndexPath = path.join(
  repoRoot,
  'content',
  'curriculum',
  'T2_Intermediate',
  'I-UVM-3B_Advanced_Sequencing_and_Layering',
  'index.mdx',
);

const iuvm3bDir = path.join(
  repoRoot,
  'content',
  'curriculum',
  'T2_Intermediate',
  'I-UVM-3B_Advanced_Sequencing_and_Layering',
);

const iuvm3aDir = path.join(
  repoRoot,
  'content',
  'curriculum',
  'T2_Intermediate',
  'I-UVM-3A_Fundamentals',
);

const virtualSequencerLessonPath = path.join(iuvm3bDir, 'uvm-virtual-sequencer.mdx');

const rendererPath = path.join(repoRoot, 'src', 'app', 'curriculum', '[...slug]', 'page.tsx');

function walkMdxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkMdxFiles(nextPath);
    }
    return nextPath.endsWith('.mdx') ? [nextPath] : [];
  });
}

describe('I-UVM-3 split/merge audit', () => {
  it('includes coordinated-attack-lab in generated curriculum data', () => {
    const data = generateCurriculumData();
    const intermediate = data.find((module) => module.slug === 'T2_Intermediate');
    expect(intermediate, 'T2_Intermediate module should exist').toBeTruthy();

    const section = intermediate?.sections.find((entry) => entry.slug === 'I-UVM-3B_Advanced_Sequencing_and_Layering');
    expect(section, 'I-UVM-3B section should exist').toBeTruthy();

    expect(
      section?.topics.some((topic) => topic.slug === 'coordinated-attack-lab'),
      'I-UVM-3B should expose the coordinated attack lab route in curriculum data',
    ).toBe(true);
  });

  it('wires VirtualSequencerExplorer in lesson content and renderer components map', () => {
    const lessonSource = fs.readFileSync(virtualSequencerLessonPath, 'utf8');
    const rendererSource = fs.readFileSync(rendererPath, 'utf8');

    expect(lessonSource).toContain('<VirtualSequencerExplorer />');
    expect(rendererSource).toContain('VirtualSequencerExplorer');
  });

  const strictIuvm3Audit = process.env.QA_STRICT_IUVM3_AUDIT === '1';
  (strictIuvm3Audit ? it : it.skip)(
    'keeps coordinated-attack-lab discoverable from I-UVM-3B index content',
    () => {
      const indexSource = fs.readFileSync(iuvm3bIndexPath, 'utf8');
      expect(
        indexSource,
        'I-UVM-3B index should link coordinated-attack-lab from Track Contents or Practice sections',
      ).toContain('./coordinated-attack-lab');
    },
  );

  (strictIuvm3Audit ? it : it.skip)(
    'relocates config_db teaching content out of I-UVM-3 lessons',
    () => {
      const iuvm3Files = [...walkMdxFiles(iuvm3aDir), ...walkMdxFiles(iuvm3bDir)];
      const sequencingConfigDbMentions: string[] = [];

      iuvm3Files.forEach((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        if (/\b(?:uvm_)?config_db\b/i.test(source)) {
          sequencingConfigDbMentions.push(path.relative(repoRoot, filePath));
        }
      });

      expect(
        sequencingConfigDbMentions,
        `config_db content should be relocated out of I-UVM-3 lessons, but was still found in: ${sequencingConfigDbMentions.join(', ')}`,
      ).toEqual([]);
    },
  );
});
