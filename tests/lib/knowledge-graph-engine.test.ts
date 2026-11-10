import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CONCEPT_TERMS } from '@/lib/concept-terms';
import {
  analyzeDependencies,
  buildConceptGraph,
  conceptGraph,
  getFullKnowledgeGraph,
  getLinkableConcepts,
  moduleConceptId,
  prerequisiteClosure,
  termConceptId,
} from '@/lib/knowledge-graph-engine';

interface ManifestModule {
  id: string;
  track: string;
  lessons: string[];
  prerequisites: string[];
  milestones: string[];
}
interface Manifest {
  tiers: { id: string; modules: ManifestModule[] }[];
}

const ROOT = path.resolve(__dirname, '../..');
const CURRICULUM = path.join(ROOT, 'content/curriculum');
const manifest = JSON.parse(fs.readFileSync(path.join(CURRICULUM, 'curriculum.manifest.json'), 'utf8')) as Manifest;
const manifestModules = manifest.tiers.flatMap((tier) => tier.modules.map((module) => ({ ...module, tierId: tier.id })));

function lessonSource(key: string): string {
  const [moduleId, lesson] = key.split('/');
  const owner = manifestModules.find((m) => m.id === moduleId);
  if (!owner) throw new Error(`no module ${moduleId}`);
  return fs.readFileSync(path.join(CURRICULUM, owner.tierId, moduleId, `${lesson}.mdx`), 'utf8');
}

function mentions(source: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(source);
}

describe('concept graph derived from the curriculum', () => {
  it('builds without problems', () => {
    expect(conceptGraph.problems).toEqual([]);
  });

  it('has one module node per manifest module, in manifest order, with no placeholder text', () => {
    expect(conceptGraph.modules.map((node) => node.moduleId)).toEqual(manifestModules.map((module) => module.id));
    for (const node of conceptGraph.nodes) {
      expect(node.description.trim().length, node.id).toBeGreaterThan(0);
      expect(`${node.name} ${node.description}`).not.toMatch(/placeholder|lorem|coming soon|TODO/i);
    }
  });

  it('turns every manifest prerequisite into a PREREQUISITE edge and nothing else', () => {
    const expected = manifestModules
      .flatMap((entry) => entry.prerequisites.map((prerequisite) => `${prerequisite}->${entry.id}`))
      .sort();
    const actual = conceptGraph.edges
      .filter((edge) => edge.type === 'PREREQUISITE')
      .map((edge) => `${edge.source.replace('module:', '')}->${edge.target.replace('module:', '')}`)
      .sort();
    expect(actual).toEqual(expected);
  });

  it('gives modules the tier, track and milestones of the manifest and links every lesson', () => {
    const tierNames: Record<string, string> = {
      T1_Foundational: 'Foundational',
      T2_Intermediate: 'Intermediate',
      T3_Advanced: 'Advanced',
      T4_Expert: 'Expert',
    };
    for (const entry of manifestModules) {
      const node = conceptGraph.byId.get(moduleConceptId(entry.id))!;
      expect(node.tier).toBe(tierNames[entry.tierId]);
      expect(node.track).toBe(entry.track);
      expect(node.milestones).toEqual(entry.milestones);
      expect(node.href).toBe(`/curriculum/${entry.tierId}/${entry.id}/index`);
      expect(node.lessons?.map((lesson) => lesson.key)).toEqual(entry.lessons.map((lesson) => `${entry.id}/${lesson}`));
      expect(node.name.startsWith(`${node.code}:`)).toBe(true);
    }
  });

  it('gives every sub-lesson (not the overview) a node of its own', () => {
    const subLessons = manifestModules.flatMap((entry) => entry.lessons.filter((l) => l !== 'index').map((l) => `lesson:${entry.id}/${l}`));
    const lessonNodes = conceptGraph.nodes.filter((node) => node.kind === 'lesson').map((node) => node.id);
    expect(lessonNodes.sort()).toEqual(subLessons.sort());
  });
});

describe('key terms', () => {
  it('have unique slugs and names', () => {
    const slugs = CONCEPT_TERMS.map((term) => term.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const names = CONCEPT_TERMS.map((term) => term.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(CONCEPT_TERMS.map((term) => [term.slug, term] as const))('%s is used in every lesson said to teach it', (_slug, term) => {
    for (const key of term.taughtIn) {
      const source = lessonSource(key);
      const spellings = [term.name, ...(term.aliases ?? [])];
      expect(spellings.some((spelling) => mentions(source, spelling)), `${term.slug} in ${key}`).toBe(true);
    }
  });

  it('take the tier of the earliest lesson that teaches them', () => {
    // Formal verification is introduced in F1B and returns in E-INT-1.
    expect(conceptGraph.byId.get(termConceptId('formal-verification'))?.tier).toBe('Foundational');
    // UVM phasing is taught in T2 (the old placeholder graph called it Advanced).
    expect(conceptGraph.byId.get(termConceptId('uvm-phase'))?.tier).toBe('Intermediate');
    expect(conceptGraph.byId.get(termConceptId('register-model'))?.tier).toBe('Advanced');
    expect(conceptGraph.byId.get(termConceptId('pss'))?.tier).toBe('Expert');
  });

  it('link to the lesson that introduces them', () => {
    const clocking = conceptGraph.byId.get(termConceptId('clocking-block'))!;
    expect(clocking.href).toBe('/curriculum/T1_Foundational/F4C_Clocking_Blocks/index');
    expect(clocking.code).toBe('F4C');
  });

  it('name the module of the earliest lesson that teaches them, matching their tier', () => {
    const modulesById = new Map(conceptGraph.modules.map((node) => [node.moduleId, node]));
    for (const term of conceptGraph.terms) {
      const lessons = term.lessons ?? [];
      // The first listed lesson is the earliest, and the shown code is its module's.
      expect(lessons[0]?.moduleCode, term.id).toBe(term.code);
      expect(lessons[0]?.href, term.id).toBe(term.href);
      const owner = modulesById.get(term.moduleId!);
      expect(owner?.code, term.id).toBe(term.code);
      expect(owner?.tier, term.id).toBe(term.tier);
    }
  });

  it('never say "first taught in" a module when an earlier lesson teaches the term', () => {
    const byId = (slug: string) => conceptGraph.byId.get(termConceptId(slug))!;
    expect(byId('scoreboard').code).toBe('F2E');
    expect(byId('scoreboard').tier).toBe('Foundational');
    for (const slug of ['mailbox', 'semaphore', 'named-event']) {
      expect(byId(slug).code, slug).toBe('F2D');
    }
    // The dialog's "Study first" list follows the earliest module, not a later UVM one.
    const studyFirst = analyzeDependencies(conceptGraph, termConceptId('scoreboard')).prerequisites.map((node) => node.code);
    expect(studyFirst.every((code) => code?.startsWith('F'))).toBe(true);
  });

  it('are the only concepts offered to lesson concept links', () => {
    const linkable = getLinkableConcepts();
    expect(linkable.length).toBe(CONCEPT_TERMS.length);
    expect(linkable.every((node) => node.kind === 'term')).toBe(true);
  });
});

describe('queries', () => {
  it('serves the whole graph asynchronously for existing callers', async () => {
    const data = await getFullKnowledgeGraph();
    expect(data.nodes).toBe(conceptGraph.nodes);
  });

  it('lists a module’s prerequisites, dependents and the terms it teaches', () => {
    const analysis = analyzeDependencies(conceptGraph, moduleConceptId('F4C_Clocking_Blocks'));
    expect(analysis.prerequisites.map((node) => node.moduleId).sort()).toEqual(
      ['F3C_Delta_Cycles_and_Race_Conditions', 'F4B_Interfaces_and_Modports'].sort(),
    );
    expect(analysis.dependents.map((node) => node.moduleId)).toContain('I-SV-4A_SVA_Fundamentals');
    expect(analysis.related.map((node) => node.id)).toContain(termConceptId('clocking-block'));
  });

  it('gives a term the prerequisites of its introducing module and its related terms', () => {
    const analysis = analyzeDependencies(conceptGraph, termConceptId('virtual-sequence'));
    expect(analysis.prerequisites.map((node) => node.moduleId)).toEqual(
      manifestModules.find((m) => m.id === 'I-UVM-3B_Advanced_Sequencing_and_Layering')!.prerequisites,
    );
    expect(analysis.dependents).toEqual([]);
    expect(analysis.related.map((node) => node.id)).toEqual(
      expect.arrayContaining([termConceptId('virtual-sequencer'), termConceptId('uvm-sequence')]),
    );
  });

  it('returns empty results for an unknown concept', () => {
    expect(analyzeDependencies(conceptGraph, 'term:nope')).toEqual({ prerequisites: [], dependents: [], related: [] });
  });

  it('collects every earlier module a module builds on, in curriculum order', () => {
    const closure = prerequisiteClosure(conceptGraph, 'F2E_First_Self_Checking_Testbench').map((node) => node.code);
    expect(closure).toEqual(['F1A', 'F1B', 'F1C', 'F2A', 'F2B', 'F2C', 'F2D']);
    expect(prerequisiteClosure(conceptGraph, 'F1A_The_Cost_of_Bugs')).toEqual([]);
  });

  it('reports unknown lessons and related terms instead of dropping them silently', () => {
    const graph = buildConceptGraph(undefined, [
      { slug: 'ghost', name: 'ghost', description: 'x', taughtIn: ['Nope/index'], source: 'test' },
      { slug: 'lonely', name: 'lonely', description: 'y', taughtIn: ['F1A_The_Cost_of_Bugs/index'], related: ['missing'], source: 'test' },
    ]);
    expect(graph.problems).toEqual([
      'term ghost: lesson Nope/index is not in the curriculum',
      'term ghost: no lesson teaches it',
      'term lonely: related term missing does not exist',
    ]);
  });
});
