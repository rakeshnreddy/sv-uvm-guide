/**
 * The concept graph behind /knowledge-hub and behind ConceptLink / ConceptModal
 * in lessons that opt in with `conceptLinking: true`.
 *
 * Everything is derived, nothing is hand-placed:
 * - modules, their lessons, prerequisites, tracks and milestones come from the
 *   generated curriculum data (src/lib/curriculum-data.tsx), which
 *   scripts/generate-curriculum-data.ts builds from
 *   content/curriculum/curriculum.manifest.json;
 * - key terms come from src/lib/concept-terms.ts (spine §5.1 terminology and the
 *   module intent cards), each tied to the lessons that teach it. A term's tier
 *   is the tier of the earliest of those lessons.
 *
 * The graph is built once at module load and is pure data, so the hub stays a
 * static page and the same graph serves the server (remark-concept-links) and
 * the client (ConceptModal).
 */

import { curriculumData, type Module as CurriculumTier } from '@/lib/curriculum-data';
import { CONCEPT_TERMS, type ConceptTerm } from '@/lib/concept-terms';
import {
  cleanLessonTitle,
  labelWithCode,
  lessonHref,
  lessonKey,
  moduleCode,
  moduleLane,
  tierNumber,
} from '@/lib/curriculum-overview';

// --- Types -------------------------------------------------------------------

export type ConceptTier = 'Foundational' | 'Intermediate' | 'Advanced' | 'Expert';
export type ConceptKind = 'module' | 'lesson' | 'term';

export interface ConceptLessonLink {
  /** "<ModuleFolder>/<lesson>". */
  key: string;
  title: string;
  href: string;
  moduleCode: string;
}

export interface ConceptNode {
  id: string;
  name: string;
  description: string;
  tier: ConceptTier;
  kind?: ConceptKind;
  /** Module code ("I-SV-2A") of the module, of the lesson's module, or of the module that introduces the term. */
  code?: string;
  /** The page to open: the module overview, the lesson, or the lesson that introduces the term. */
  href?: string;
  /** Module folder id: the module itself, the lesson's module, or the term's introducing module. */
  moduleId?: string;
  /** Lessons of a module, or the lessons that teach a term (introducing lesson first). */
  lessons?: ConceptLessonLink[];
  /** Modules: the lane on the map ("UVM", "AMBA protocols", "Electives"). */
  lane?: string;
  track?: 'core' | 'elective';
  milestones?: string[];
  aliases?: string[];
  /** Terms: where the term is defined in the curriculum spine. */
  source?: string;
}

/**
 * PREREQUISITE: module `source` must come before module `target` (manifest).
 * CONTAINS: module `source` has lesson `target`.
 * TAUGHT_IN: term `source` is taught in lesson or module `target`.
 * RELATED: terms `source` and `target` are closely related (undirected).
 */
export type RelationshipType = 'PREREQUISITE' | 'CONTAINS' | 'TAUGHT_IN' | 'RELATED';

export interface RelationshipEdge {
  source: string;
  target: string;
  type: RelationshipType;
}

export interface KnowledgeGraphData {
  nodes: ConceptNode[];
  edges: RelationshipEdge[];
}

// --- Ids ---------------------------------------------------------------------

export const moduleConceptId = (moduleId: string): string => `module:${moduleId}`;
export const lessonConceptId = (key: string): string => `lesson:${key}`;
export const termConceptId = (slug: string): string => `term:${slug}`;

const TIER_NAMES: readonly ConceptTier[] = ['Foundational', 'Intermediate', 'Advanced', 'Expert'];

export function conceptTierName(tierId: string): ConceptTier {
  return TIER_NAMES[tierNumber(tierId) - 1] ?? 'Foundational';
}

// --- Build -------------------------------------------------------------------

interface LessonInfo extends ConceptLessonLink {
  moduleId: string;
  tier: ConceptTier;
  /** Position in curriculum order, for "earliest lesson" decisions. */
  order: number;
}

export interface ConceptGraph extends KnowledgeGraphData {
  byId: ReadonlyMap<string, ConceptNode>;
  /** Module nodes in curriculum (manifest) order. */
  modules: ConceptNode[];
  terms: ConceptNode[];
  /** Problems found while building: unknown lessons or related terms. Empty for a healthy graph. */
  problems: string[];
}

export function buildConceptGraph(
  tiers: readonly CurriculumTier[] = curriculumData,
  terms: readonly ConceptTerm[] = CONCEPT_TERMS,
): ConceptGraph {
  const nodes: ConceptNode[] = [];
  const edges: RelationshipEdge[] = [];
  const modules: ConceptNode[] = [];
  const problems: string[] = [];
  const lessonsByKey = new Map<string, LessonInfo>();
  const moduleIds = new Set<string>();
  let order = 0;

  for (const tier of tiers) {
    const tierName = conceptTierName(tier.slug);
    for (const section of tier.sections) {
      moduleIds.add(section.slug);
      const code = moduleCode(section.slug);
      const lessons: ConceptLessonLink[] = section.topics.map((topic) => {
        const key = lessonKey(section.slug, topic.slug);
        const link: ConceptLessonLink = {
          key,
          title: labelWithCode(code, cleanLessonTitle(topic.title)),
          href: lessonHref(tier.slug, section.slug, topic.slug),
          moduleCode: code,
        };
        lessonsByKey.set(key, { ...link, moduleId: section.slug, tier: tierName, order: order++ });
        return link;
      });
      const overview = section.topics.find((topic) => topic.slug === 'index') ?? section.topics[0];
      const track = section.track ?? 'core';
      const moduleNode: ConceptNode = {
        id: moduleConceptId(section.slug),
        name: labelWithCode(code, cleanLessonTitle(section.title)),
        description: overview?.description ?? '',
        tier: tierName,
        kind: 'module',
        code,
        href: overview ? lessonHref(tier.slug, section.slug, overview.slug) : undefined,
        moduleId: section.slug,
        lessons,
        lane: moduleLane(section.slug, track),
        track,
        milestones: [...(section.milestones ?? [])],
      };
      nodes.push(moduleNode);
      modules.push(moduleNode);

      // The overview lesson is the module page itself; the other lessons get nodes of their own.
      for (const [index, topic] of section.topics.entries()) {
        const link = lessons[index];
        edges.push({ source: moduleNode.id, target: lessonConceptId(link.key), type: 'CONTAINS' });
        if (topic.slug === 'index') continue;
        nodes.push({
          id: lessonConceptId(link.key),
          name: link.title,
          description: topic.description,
          tier: tierName,
          kind: 'lesson',
          code,
          href: link.href,
          moduleId: section.slug,
          lessons: [link],
        });
      }

      for (const prerequisite of section.prerequisites ?? []) {
        edges.push({ source: moduleConceptId(prerequisite), target: moduleNode.id, type: 'PREREQUISITE' });
      }
    }
  }

  for (const edge of edges) {
    if (edge.type === 'PREREQUISITE' && !moduleIds.has(edge.source.slice('module:'.length))) {
      problems.push(`${edge.target}: prerequisite ${edge.source} is not a module`);
    }
  }

  const termSlugs = new Set(terms.map((term) => term.slug));
  const termNodes: ConceptNode[] = [];
  for (const term of terms) {
    const taught = term.taughtIn
      .map((key) => {
        const lesson = lessonsByKey.get(key);
        if (!lesson) problems.push(`term ${term.slug}: lesson ${key} is not in the curriculum`);
        return lesson;
      })
      .filter((lesson): lesson is LessonInfo => lesson !== undefined);
    if (taught.length === 0) {
      problems.push(`term ${term.slug}: no lesson teaches it`);
      continue;
    }
    // Tier, module code, link and "first taught in" all come from the earliest
    // lesson in curriculum order, so the label never names a later module
    // (and the dialog's "Study first" list follows the same module).
    const inOrder = [...taught].sort((left, right) => left.order - right.order);
    const earliest = inOrder[0];
    const node: ConceptNode = {
      id: termConceptId(term.slug),
      name: term.name,
      description: term.description,
      tier: earliest.tier,
      kind: 'term',
      code: earliest.moduleCode,
      href: earliest.href,
      moduleId: earliest.moduleId,
      lessons: inOrder.map(({ key, title, href, moduleCode: lessonModuleCode }) => ({
        key,
        title,
        href,
        moduleCode: lessonModuleCode,
      })),
      aliases: [...(term.aliases ?? [])],
      source: term.source,
    };
    nodes.push(node);
    termNodes.push(node);
    for (const lesson of taught) {
      const target = lesson.key.endsWith('/index') ? moduleConceptId(lesson.moduleId) : lessonConceptId(lesson.key);
      edges.push({ source: node.id, target, type: 'TAUGHT_IN' });
    }
    for (const related of term.related ?? []) {
      if (!termSlugs.has(related)) {
        problems.push(`term ${term.slug}: related term ${related} does not exist`);
        continue;
      }
      // Undirected: keep one edge per pair.
      if (term.slug < related) {
        edges.push({ source: node.id, target: termConceptId(related), type: 'RELATED' });
      } else if (!terms.find((other) => other.slug === related)?.related?.includes(term.slug)) {
        edges.push({ source: termConceptId(related), target: node.id, type: 'RELATED' });
      }
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { nodes, edges, byId, modules, terms: termNodes, problems };
}

/** The graph for the curriculum as generated. */
export const conceptGraph: ConceptGraph = buildConceptGraph();

/** The whole graph: modules, lessons and key terms with their edges. */
export const getFullKnowledgeGraph = async (): Promise<KnowledgeGraphData> =>
  Promise.resolve({ nodes: conceptGraph.nodes, edges: conceptGraph.edges });

/**
 * The concepts remark-concept-links should wrap in lesson prose: key terms
 * only. Module and lesson names carry a module code ("I-SV-5: Mailboxes") and
 * so never match prose anyway, but passing terms alone keeps the matcher small.
 */
export const getLinkableConcepts = (): ConceptNode[] => conceptGraph.terms;

// --- Queries -----------------------------------------------------------------

export interface DependencyAnalysis {
  /** Modules to study first: a module's direct prerequisites, or those of the module that first teaches a term. */
  prerequisites: ConceptNode[];
  /** Modules that list this module as a prerequisite. */
  dependents: ConceptNode[];
  /** Terms: closely related terms. Modules: the key terms taught in the module. */
  related: ConceptNode[];
}

/** Prerequisites, dependents and related concepts of one concept. */
export const analyzeDependencies = (graphData: KnowledgeGraphData, conceptId: string): DependencyAnalysis => {
  const nodeMap = new Map(graphData.nodes.map((node) => [node.id, node]));
  const concept = nodeMap.get(conceptId);
  if (!concept) return { prerequisites: [], dependents: [], related: [] };

  // A lesson or a term inherits the prerequisites of its module (for a term, the module that first teaches it).
  const moduleNode =
    (concept.kind !== 'module' && concept.moduleId ? nodeMap.get(moduleConceptId(concept.moduleId)) : undefined) ?? concept;
  const pick = (ids: string[]) => ids.map((id) => nodeMap.get(id)).filter((node): node is ConceptNode => node !== undefined);

  const prerequisites = pick(
    graphData.edges.filter((edge) => edge.type === 'PREREQUISITE' && edge.target === moduleNode.id).map((edge) => edge.source),
  );
  const dependents =
    concept.kind === 'term'
      ? []
      : pick(graphData.edges.filter((edge) => edge.type === 'PREREQUISITE' && edge.source === moduleNode.id).map((edge) => edge.target));

  let related: ConceptNode[];
  if (concept.kind === 'term') {
    related = pick(
      graphData.edges
        .filter((edge) => edge.type === 'RELATED' && (edge.source === conceptId || edge.target === conceptId))
        .map((edge) => (edge.source === conceptId ? edge.target : edge.source)),
    );
  } else {
    // Terms taught in this module or lesson, introduced here first.
    const targets = new Set(
      concept.kind === 'module'
        ? [concept.id, ...graphData.edges.filter((e) => e.type === 'CONTAINS' && e.source === concept.id).map((e) => e.target)]
        : [concept.id],
    );
    related = pick([
      ...new Set(graphData.edges.filter((edge) => edge.type === 'TAUGHT_IN' && targets.has(edge.target)).map((edge) => edge.source)),
    ]);
  }

  return { prerequisites, dependents, related };
};

/**
 * Every module that must come before `moduleId`, directly or through other
 * prerequisites, in curriculum order.
 */
export function prerequisiteClosure(graph: ConceptGraph, moduleId: string): ConceptNode[] {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== 'PREREQUISITE') continue;
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }
  const seen = new Set<string>();
  const stack = [...(incoming.get(moduleConceptId(moduleId)) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(incoming.get(id) ?? []));
  }
  return graph.modules.filter((node) => seen.has(node.id));
}

/** Text searched by the hub's concept list. */
export function conceptSearchText(node: ConceptNode): string {
  return [node.name, node.code, node.description, ...(node.aliases ?? []), ...(node.lessons ?? []).map((lesson) => lesson.title)]
    .filter(Boolean)
    .join(' ');
}

// --- Module map layout ---------------------------------------------------------

export interface MapLane {
  lane: string;
  modules: ConceptNode[];
}

/**
 * The columns of one tier on the module map: one lane per curriculum lane
 * (src/lib/curriculum-overview.ts moduleLane), in order of first appearance,
 * with electives last; modules keep manifest order inside a lane.
 */
export function mapLanes(graph: ConceptGraph, tier: ConceptTier): MapLane[] {
  const lanes: MapLane[] = [];
  for (const node of graph.modules) {
    if (node.tier !== tier) continue;
    const name = node.lane ?? 'Modules';
    let lane = lanes.find((entry) => entry.lane === name);
    if (!lane) {
      lane = { lane: name, modules: [] };
      lanes.push(lane);
    }
    lane.modules.push(node);
  }
  return [...lanes.filter((l) => l.lane !== 'Electives'), ...lanes.filter((l) => l.lane === 'Electives')];
}

export type MapKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Keyboard movement on the module map: up and down within a lane, left and
 * right to the neighbouring lane at the same row (or its last module), Home and
 * End to the first and last module of the tier. Returns the id to focus.
 */
export function moveInMap(lanes: readonly MapLane[], currentId: string, key: MapKey): string {
  const flat = lanes.flatMap((lane) => lane.modules);
  if (flat.length === 0) return currentId;
  if (key === 'Home') return flat[0].id;
  if (key === 'End') return flat[flat.length - 1].id;

  const laneIndex = lanes.findIndex((lane) => lane.modules.some((node) => node.id === currentId));
  if (laneIndex < 0) return flat[0].id;
  const row = lanes[laneIndex].modules.findIndex((node) => node.id === currentId);

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const modules = lanes[laneIndex].modules;
    const next = Math.min(Math.max(row + (key === 'ArrowDown' ? 1 : -1), 0), modules.length - 1);
    return modules[next].id;
  }
  const nextLane = lanes[laneIndex + (key === 'ArrowRight' ? 1 : -1)];
  if (!nextLane) return currentId;
  return nextLane.modules[Math.min(row, nextLane.modules.length - 1)].id;
}

/** Concepts in curriculum order: each module, then its lessons, then the terms it introduces. */
export function curriculumOrder(graph: ConceptGraph): ConceptNode[] {
  const position = new Map(graph.modules.map((node, index) => [node.moduleId, index]));
  const kindRank: Record<ConceptKind, number> = { module: 0, lesson: 1, term: 2 };
  return graph.nodes
    .map((node, index) => ({ node, index }))
    .sort(
      (a, b) =>
        (position.get(a.node.moduleId) ?? 0) - (position.get(b.node.moduleId) ?? 0) ||
        kindRank[a.node.kind ?? 'term'] - kindRank[b.node.kind ?? 'term'] ||
        a.index - b.index,
    )
    .map(({ node }) => node);
}
