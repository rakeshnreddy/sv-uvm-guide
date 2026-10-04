/**
 * The expert index: every "Expert: <topic>" heading across the lessons, as a
 * deep link to the heading on its lesson page, grouped by tier and module.
 *
 * Anchors use the shared algorithm in src/lib/heading-slug.ts the same way the
 * lesson page and the search index do: one slugger per page, fed every
 * markdown heading of the MDX body (any depth, including headings inside JSX
 * blocks) in document order, so a repeated heading gets the same "-1", "-2"
 * suffix it gets on the page. Heading text is the concatenated text and
 * inline-code content, which is what the rendered heading reads.
 *
 * Pure: callers pass a reader for lesson bodies (src/lib/curriculum-scan.ts
 * reads them from disk at build time).
 */

import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import type { Module as CurriculumTier } from '@/lib/curriculum-data';
import { cleanLessonTitle, lessonHref, moduleCode, moduleDisplayTitle, tierAnchor } from '@/lib/curriculum-overview';
import { createSlugger, isExpertHeading } from '@/lib/heading-slug';

export interface ScannedHeading {
  depth: number;
  text: string;
  anchor: string;
}

export interface HeadingScan {
  headings: ScannedHeading[];
  /** False when the MDX parser rejected the body and headings were scanned line by line. */
  parsed: boolean;
}

interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
}

const SKIPPED_INLINE = new Set(['image', 'imageReference', 'break', 'mdxTextExpression', 'mdxFlowExpression']);

function nodeText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (SKIPPED_INLINE.has(node.type)) return '';
  return (node.children ?? []).map(nodeText).join('');
}

function collectHeadings(tree: MdNode): { depth: number; text: string }[] {
  const out: { depth: number; text: string }[] = [];
  const walk = (node: MdNode) => {
    if (node.type === 'heading') {
      out.push({ depth: node.depth ?? 0, text: nodeText(node) });
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return out;
}

/** Fallback for a body the MDX parser rejects: ATX headings outside fenced code. */
function scanHeadingLines(body: string): { depth: number; text: string }[] {
  const out: { depth: number; text: string }[] = [];
  let fence: string | null = null;
  for (const line of body.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2]
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*~]/g, '');
    out.push({ depth: match[1].length, text });
  }
  return out;
}

const parser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);

/** Every heading of an MDX body (frontmatter removed) with the anchor the lesson page gives it. */
export function scanLessonHeadings(body: string): HeadingScan {
  let raw: { depth: number; text: string }[];
  let parsed = true;
  try {
    raw = collectHeadings(parser.parse(body) as unknown as MdNode);
  } catch {
    raw = scanHeadingLines(body);
    parsed = false;
  }
  const slug = createSlugger();
  return { headings: raw.map((h) => ({ depth: h.depth, text: h.text, anchor: slug(h.text) })), parsed };
}

export interface ExpertTopic {
  /** The topic without the "Expert:" prefix. */
  topic: string;
  /** The full heading text. */
  text: string;
  anchor: string;
  depth: number;
}

export interface LessonExpertLayer {
  topics: ExpertTopic[];
  /** Anchor of the lesson's "Push Further" section, when it has one. */
  pushFurtherAnchor?: string;
  parsed: boolean;
}

export function stripExpertPrefix(text: string): string {
  return text.trim().replace(/^expert:\s*/i, '');
}

/** The expert topics and the Push Further section of one lesson body. */
export function scanExpertLayer(body: string): LessonExpertLayer {
  const { headings, parsed } = scanLessonHeadings(body);
  const topics = headings
    .filter((h) => h.depth >= 2 && isExpertHeading(h.text))
    .map((h) => ({ topic: stripExpertPrefix(h.text), text: h.text.trim(), anchor: h.anchor, depth: h.depth }));
  const pushFurther = headings.find((h) => h.depth === 2 && /^push further\b/i.test(h.text.trim()));
  return { topics, ...(pushFurther ? { pushFurtherAnchor: pushFurther.anchor } : {}), parsed };
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

export interface ExpertIndexTopic {
  topic: string;
  href: string;
}

export interface ExpertIndexLesson {
  slug: string;
  title: string;
  href: string;
  topics: ExpertIndexTopic[];
  pushFurtherHref?: string;
}

export interface ExpertIndexModule {
  id: string;
  code: string;
  title: string;
  displayTitle: string;
  href: string;
  track: 'core' | 'elective';
  lessons: ExpertIndexLesson[];
  topicCount: number;
  /** The first Push Further section in the module, for modules without tagged topics yet. */
  pushFurtherHref?: string;
}

export interface ExpertIndexTier {
  id: string;
  anchor: string;
  title: string;
  audience: string;
  modules: ExpertIndexModule[];
  topicCount: number;
}

export interface ExpertIndex {
  tiers: ExpertIndexTier[];
  topicCount: number;
  /** Modules with at least one expert topic. */
  taggedModuleCount: number;
  moduleCount: number;
  /** Lessons whose MDX the parser rejected (scanned line by line instead). */
  unparsedLessons: string[];
}

export interface ExpertIndexInput {
  data: readonly CurriculumTier[];
  /** Tier titles and audiences from the manifest. */
  tiers: readonly { id: string; title: string; audience: string }[];
  /** The MDX body of a lesson without frontmatter, or null when the file is missing. */
  readLesson: (tierId: string, moduleId: string, lessonSlug: string) => string | null;
}

export function buildExpertIndex(input: ExpertIndexInput): ExpertIndex {
  const unparsedLessons: string[] = [];

  const tiers = input.data.map((tier): ExpertIndexTier => {
    const meta = input.tiers.find((t) => t.id === tier.slug);
    const modules = tier.sections.map((section): ExpertIndexModule => {
      const code = moduleCode(section.slug);
      const lessons = section.topics.map((topic): ExpertIndexLesson => {
        const href = lessonHref(tier.slug, section.slug, topic.slug);
        const body = input.readLesson(tier.slug, section.slug, topic.slug);
        const layer: LessonExpertLayer = body === null ? { topics: [], parsed: true } : scanExpertLayer(body);
        if (!layer.parsed) unparsedLessons.push(`${section.slug}/${topic.slug}`);
        return {
          slug: topic.slug,
          title: cleanLessonTitle(topic.title),
          href,
          topics: layer.topics.map((t) => ({ topic: t.topic, href: `${href}#${t.anchor}` })),
          ...(layer.pushFurtherAnchor ? { pushFurtherHref: `${href}#${layer.pushFurtherAnchor}` } : {}),
        };
      });
      const indexLesson = lessons.find((l) => l.slug === 'index') ?? lessons[0];
      const pushFurtherHref = lessons.find((l) => l.pushFurtherHref)?.pushFurtherHref;
      return {
        id: section.slug,
        code,
        title: cleanLessonTitle(section.title),
        displayTitle: moduleDisplayTitle(section.title, code),
        href: indexLesson?.href ?? lessonHref(tier.slug, section.slug, 'index'),
        track: section.track ?? 'core',
        lessons,
        topicCount: lessons.reduce((sum, l) => sum + l.topics.length, 0),
        ...(pushFurtherHref ? { pushFurtherHref } : {}),
      };
    });
    return {
      id: tier.slug,
      anchor: tierAnchor(tier.slug),
      title: meta?.title ?? tier.title,
      audience: meta?.audience ?? '',
      modules,
      topicCount: modules.reduce((sum, m) => sum + m.topicCount, 0),
    };
  });

  const modules = tiers.flatMap((t) => t.modules);
  return {
    tiers,
    topicCount: modules.reduce((sum, m) => sum + m.topicCount, 0),
    taggedModuleCount: modules.filter((m) => m.topicCount > 0).length,
    moduleCount: modules.length,
    unparsedLessons,
  };
}
