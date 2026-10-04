import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const curriculumRoot = path.join(root, 'content', 'curriculum');
const manifest = JSON.parse(fs.readFileSync(path.join(curriculumRoot, 'curriculum.manifest.json'), 'utf8')) as {
  tiers: { id: string; title: string; audience: string; modules: { id: string; track: 'core' | 'elective'; lessons: string[]; prerequisites: string[]; milestones: string[] }[] }[];
};

const modules = manifest.tiers.flatMap((t) => t.modules.map((m) => ({ ...m, tier: t.id })));

describe('curriculum manifest (single source of navigation order)', () => {
  it('lists every tier folder in order', () => {
    const tierDirs = fs.readdirSync(curriculumRoot).filter((d) => /^T\d_/.test(d)).sort();
    expect(manifest.tiers.map((t) => t.id)).toEqual(tierDirs);
    for (const t of manifest.tiers) {
      expect(t.title).toBeTruthy();
      expect(t.audience).toBeTruthy();
    }
  });

  it('lists every module folder exactly once, under the tier that contains it', () => {
    const onDisk = manifest.tiers.flatMap((t) =>
      fs
        .readdirSync(path.join(curriculumRoot, t.id))
        .filter((d) => fs.statSync(path.join(curriculumRoot, t.id, d)).isDirectory())
        .map((d) => `${t.id}/${d}`),
    );
    const listed = modules.map((m) => `${m.tier}/${m.id}`);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...onDisk].sort());
  });

  it('lists every lesson file exactly once, starting with the module index', () => {
    for (const m of modules) {
      const files = fs
        .readdirSync(path.join(curriculumRoot, m.tier, m.id))
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => f.slice(0, -4))
        .sort();
      expect([...m.lessons].sort(), m.id).toEqual(files);
      expect(new Set(m.lessons).size, m.id).toBe(m.lessons.length);
      if (files.includes('index')) expect(m.lessons[0], m.id).toBe('index');
    }
  });

  it('has prerequisites that exist and always point backward in the order', () => {
    const position = new Map(modules.map((m, i) => [m.id, i]));
    for (const m of modules) {
      for (const p of m.prerequisites) {
        expect(position.has(p), `${m.id} -> ${p}`).toBe(true);
        expect(position.get(p)!, `${m.id} lists ${p}, which comes later`).toBeLessThan(position.get(m.id)!);
      }
    }
  });

  it('keeps core modules ahead of each tier\'s electives, and uses known tracks and milestones', () => {
    for (const t of manifest.tiers) {
      const tracks = t.modules.map((m) => m.track);
      const firstElective = tracks.indexOf('elective');
      if (firstElective >= 0) expect(tracks.slice(firstElective).every((x) => x === 'elective'), t.id).toBe(true);
      for (const m of t.modules) {
        expect(['core', 'elective']).toContain(m.track);
        for (const ms of m.milestones) expect(ms).toMatch(/^M[0-8]$/);
      }
    }
  });
});
