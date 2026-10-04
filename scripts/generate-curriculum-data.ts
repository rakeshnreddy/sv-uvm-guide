import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

export interface Topic {
  title: string;
  slug: string;
  description: string;
}

export interface Section {
  title: string;
  slug: string;
  topics: Topic[];
  /** From content/curriculum/curriculum.manifest.json. Electives sit beside the core path. */
  track?: 'core' | 'elective';
  /** Module folder names this module builds on (always earlier in the order). */
  prerequisites?: string[];
  milestones?: string[];
}

interface ManifestModule {
  id: string;
  track: 'core' | 'elective';
  lessons: string[];
  prerequisites: string[];
  milestones: string[];
}

interface Manifest {
  version: number;
  tiers: { id: string; title: string; audience: string; modules: ManifestModule[] }[];
}

/**
 * Reads and validates the manifest: every tier, module folder and lesson file
 * on disk must appear exactly once, and prerequisites must point backward.
 */
export function readManifest(baseDir: string): Manifest | null {
  const manifestPath = path.join(baseDir, 'curriculum.manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
  const problems: string[] = [];
  const position = new Map<string, number>();
  let i = 0;
  for (const tier of manifest.tiers) {
    const tierPath = path.join(baseDir, tier.id);
    if (!fs.existsSync(tierPath)) {
      problems.push(`manifest tier ${tier.id} has no folder`);
      continue;
    }
    const onDisk = fs.readdirSync(tierPath).filter(d => fs.statSync(path.join(tierPath, d)).isDirectory());
    const listed = tier.modules.map(m => m.id);
    for (const d of onDisk) if (!listed.includes(d)) problems.push(`module folder ${tier.id}/${d} is missing from the manifest`);
    for (const m of tier.modules) {
      if (position.has(m.id)) problems.push(`module ${m.id} is listed twice`);
      position.set(m.id, i++);
      const modulePath = path.join(tierPath, m.id);
      if (!fs.existsSync(modulePath)) {
        problems.push(`manifest module ${tier.id}/${m.id} has no folder`);
        continue;
      }
      const files = fs.readdirSync(modulePath).filter(f => f.endsWith('.mdx')).map(f => f.replace(/\.mdx$/, ''));
      for (const f of files) if (!m.lessons.includes(f)) problems.push(`lesson ${m.id}/${f}.mdx is missing from the manifest`);
      for (const l of m.lessons) if (!files.includes(l)) problems.push(`manifest lesson ${m.id}/${l} has no .mdx file`);
    }
  }
  for (const tier of manifest.tiers) {
    for (const m of tier.modules) {
      for (const p of m.prerequisites) {
        if (!position.has(p)) problems.push(`${m.id} lists unknown prerequisite ${p}`);
        else if (position.get(p)! >= position.get(m.id)!) problems.push(`${m.id} lists prerequisite ${p}, which comes later in the order`);
      }
    }
  }
  if (problems.length) throw new Error(`curriculum.manifest.json is out of date:\n- ${problems.join('\n- ')}`);
  return manifest;
}

export interface Module {
  title: string;
  slug: string;
  tier: string;
  sections: Section[];
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getAllMdxFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      results = results.concat(getAllMdxFiles(p));
    } else if (p.endsWith('.mdx')) {
      results.push(p);
    }
  }
  return results;
}

function toRouteSlug(segment: string): string {
  return segment
    .replace(/_/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function addRepresentedRoute(represented: Set<string>, segments: string[]) {
  represented.add(segments.join('/'));
  represented.add(segments.map(toRouteSlug).join('/'));
}

function createTopic(filePath: string, moduleSlug: string, sectionSlug: string, represented: Set<string>): Topic {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data } = matter(raw);
  const topicSlug = path.basename(filePath).replace(/\.mdx$/, '');
  addRepresentedRoute(represented, [moduleSlug, sectionSlug, topicSlug]);
  if (topicSlug === 'index') {
    addRepresentedRoute(represented, [moduleSlug, sectionSlug]);
  }

  let title = data.title as string | undefined;
  let description = data.description as string | undefined;

  if (!title || !description) {
    const metaMatch = raw.match(/export const metadata\s*=\s*{[^}]*}/);
    if (metaMatch) {
      try {
        const metaObj = eval('(' + metaMatch[0].replace(/export const metadata\s*=\s*/, '') + ')');
        title = title || metaObj.title;
        description = description || metaObj.description;
      } catch {
        // ignore parse errors and fall back to defaults
      }
    }
  }

  return {
    title: title || titleFromSlug(topicSlug),
    slug: topicSlug,
    description: description || '',
  };
}

function validateLinks(baseDir: string, validSlugs: Set<string>) {
  const linkRegexes = [
    /href\s*=\s*["']\/curriculum\/([^"']+)["']/g,
    /\[[^\]]+\]\(\/curriculum\/([^)#?\s]+)(?:[#?][^)\s]*)?\)/g,
  ];
  const files = getAllMdxFiles(baseDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const linkRegex of linkRegexes) {
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(content))) {
        const target = match[1].split('#')[0].split('?')[0].replace(/\/$/, '');
        if (!validSlugs.has(target)) {
          throw new Error(`Broken link in ${file}: ${target}`);
        }
      }
    }
  }
}

export function generateCurriculumData(baseDir = path.join(process.cwd(), 'content', 'curriculum')): Module[] {
  const modules: Module[] = [];
  const represented = new Set<string>();
  const allFiles = getAllMdxFiles(baseDir).map(p => path.relative(baseDir, p).replace(/\\/g, '/').replace(/\.mdx$/, ''));

  const manifest = readManifest(baseDir);
  const moduleDirs = manifest
    ? manifest.tiers.map(t => t.id)
    : fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory() && d !== 'labs').sort();

  for (const moduleDir of moduleDirs) {
    const modulePath = path.join(baseDir, moduleDir);
    const tier = moduleDir.split('_')[0] || moduleDir;
    const moduleTitle = titleFromSlug(moduleDir.replace(/^T\d+_/, ''));
    const module: Module = { title: moduleTitle, slug: moduleDir, tier, sections: [] };

    const manifestTier = manifest?.tiers.find(t => t.id === moduleDir);
    const sectionDirs = manifestTier
      ? manifestTier.modules.map(m => m.id)
      : fs.readdirSync(modulePath).filter(d => fs.statSync(path.join(modulePath, d)).isDirectory()).sort();

    for (const sectionDir of sectionDirs) {
      const sectionPath = path.join(modulePath, sectionDir);
      const indexPath = path.join(sectionPath, 'index.mdx');
      const manifestModule = manifestTier?.modules.find(m => m.id === sectionDir);
      const mdxFiles = manifestModule
        ? manifestModule.lessons.map(l => `${l}.mdx`)
        : fs.readdirSync(sectionPath).filter(f => f.endsWith('.mdx')).sort();
      const hasNonIndexTopics = mdxFiles.some(file => file !== 'index.mdx');

      let sectionTitle = titleFromSlug(sectionDir);
      const topics: Topic[] = [];

      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf8');
        const { data } = matter(raw);
        if (data.redirect && !hasNonIndexTopics) {
          // Track the file so link validation still passes, but skip adding it to navigation data.
          represented.add([moduleDir, sectionDir, 'index'].join('/'));
          represented.add([moduleDir, sectionDir].join('/'));
          continue;
        }

        const topic = createTopic(indexPath, moduleDir, sectionDir, represented);
        sectionTitle = topic.title;
        topics.push(topic);
      }

      for (const file of mdxFiles) {
        if (file === 'index.mdx') continue;
        const topic = createTopic(path.join(sectionPath, file), moduleDir, sectionDir, represented);
        topics.push(topic);
      }

      if (!topics.length) {
        continue;
      }

      const section: Section = { title: sectionTitle, slug: sectionDir, topics };
      if (manifestModule) {
        section.track = manifestModule.track;
        section.prerequisites = manifestModule.prerequisites;
        section.milestones = manifestModule.milestones;
      }
      module.sections.push(section);
    }

    modules.push(module);
  }

  const missing = allFiles.filter(f => !represented.has(f));
  if (missing.length) {
    throw new Error(`Unrepresented MDX files: ${missing.join(', ')}`);
  }

  validateLinks(baseDir, represented);

  return modules;
}

function buildCurriculumFile(data: Module[]): string {
  const header = `// This file is auto-generated by scripts/generate-curriculum-data.ts. Do not edit manually.\n\nexport interface Topic {\n  title: string;\n  slug: string;\n  description: string;\n}\n\nexport interface Section {\n  title: string;\n  slug: string;\n  topics: Topic[];\n  track?: 'core' | 'elective';\n  prerequisites?: string[];\n  milestones?: string[];\n}\n\nexport interface Module {\n  title: string;\n  slug: string;\n  tier: string;\n  sections: Section[];\n}\n\nexport const curriculumData: Module[] = `;

  const footer = `;\n\n// Helper functions to navigate the new structure\n\nfunction safeDecodeURIComponent(value: string): string {\n  try {\n    return decodeURIComponent(value);\n  } catch {\n    return value;\n  }\n}\n\nexport function toPrettyCurriculumSlug(segment: string): string {\n  return safeDecodeURIComponent(segment)\n    .trim()\n    .replace(/_/g, '-')\n    .replace(/[^a-zA-Z0-9-]+/g, '-')\n    .replace(/-+/g, '-')\n    .replace(/^-|-$/g, '')\n    .toLowerCase();\n}\n\nfunction findBySlug<T extends { slug: string }>(items: T[], rawSlug: string | undefined): T | undefined {\n  if (!rawSlug) return undefined;\n  const prettySlug = toPrettyCurriculumSlug(rawSlug);\n  return items.find(item => item.slug === rawSlug || toPrettyCurriculumSlug(item.slug) === prettySlug);\n}\n\nexport function normalizeSlug(slug: string[]): string[] {\n  if (slug.length === 0) return [];\n\n  const [rawTierSlug, rawSectionSlug, rawTopicSlug] = slug;\n  const courseModule = findBySlug(curriculumData, rawTierSlug);\n  if (!courseModule) return [];\n\n  if (slug.length === 1) {\n    const firstSection = courseModule.sections[0];\n    if (!firstSection) return [];\n    const firstTopic = firstSection.topics.find(t => t.slug === 'index') ?? firstSection.topics[0];\n    if (!firstTopic) return [];\n    return [courseModule.slug, firstSection.slug, firstTopic.slug];\n  }\n\n  const section = findBySlug(courseModule.sections, rawSectionSlug);\n  if (!section) return [];\n\n  if (slug.length >= 3) {\n    const topic = findBySlug(section.topics, rawTopicSlug);\n    if (!topic) return [];\n    return [courseModule.slug, section.slug, topic.slug];\n  }\n\n  const topic = section.topics.find(t => t.slug === 'index') ?? section.topics[0];\n  if (!topic) return [];\n  return [courseModule.slug, section.slug, topic.slug];\n}\n\nexport function findTopicBySlug(slug: string[]): Topic | undefined {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return undefined;\n  const [tierSlug, sectionSlug, topicSlug] = normalized;\n  const courseModule = curriculumData.find(m => m.slug === tierSlug);\n  if (!courseModule) return undefined;\n  const section = courseModule.sections.find(s => s.slug === sectionSlug);\n  if (!section) return undefined;\n  return section.topics.find(t => t.slug === topicSlug);\n}\n\nexport function getBreadcrumbs(slug: string[]): { title: string, path: string }[] {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return [];\n  const [tierSlug, sectionSlug, topicSlug] = normalized;\n  const breadcrumbs: { title: string, path: string }[] = [];\n  const courseModule = curriculumData.find(m => m.slug === tierSlug);\n  if (!courseModule) return breadcrumbs;\n\n  breadcrumbs.push({ title: "Curriculum", path: \`/curriculum\` });\n  breadcrumbs.push({ title: courseModule.title, path: \`/curriculum/\${courseModule.slug}\` });\n\n  const section = courseModule.sections.find(s => s.slug === sectionSlug);\n  if (!section) return breadcrumbs;\n  breadcrumbs.push({ title: section.title, path: \`/curriculum/\${courseModule.slug}/\${section.slug}\` });\n\n  const topic = section.topics.find(t => t.slug === topicSlug);\n  if (topic) {\n    breadcrumbs.push({ title: topic.title, path: \`/curriculum/\${courseModule.slug}/\${section.slug}/\${topic.slug}\` });\n  }\n\n  return breadcrumbs;\n}\n\nexport interface NavTopic extends Topic {\n  /** Folder name of the module (section) this topic belongs to. */\n  moduleSlug: string;\n  track: 'core' | 'elective';\n}\n\nfunction allNavTopics(): NavTopic[] {\n  const all: NavTopic[] = [];\n  curriculumData.forEach(m => {\n    m.sections.forEach(s => {\n      s.topics.forEach(t => {\n        all.push({ ...t, slug: \`\${m.slug}/\${s.slug}/\${t.slug}\`, moduleSlug: s.slug, track: s.track ?? 'core' });\n      });\n    });\n  });\n  return all;\n}\n\n/**\n * Previous and next lessons along the learning path. From a core lesson the\n * path skips elective modules (they stay reachable from the outline); inside a\n * module, and from an elective, every lesson is visited in order.\n */\nexport function findPrevNextTopics(slug: string[]): { prev: Topic | undefined, next: Topic | undefined } {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return { prev: undefined, next: undefined };\n\n  const allTopics = allNavTopics();\n  const currentIndex = allTopics.findIndex(t => t.slug === normalized.join('/'));\n  if (currentIndex === -1) return { prev: undefined, next: undefined };\n  const current = allTopics[currentIndex];\n  const onPath = (t: NavTopic) => current.track === 'elective' || t.track === 'core' || t.moduleSlug === current.moduleSlug;\n\n  let prev: NavTopic | undefined;\n  for (let i = currentIndex - 1; i >= 0; i -= 1) {\n    if (onPath(allTopics[i])) { prev = allTopics[i]; break; }\n  }\n  let next: NavTopic | undefined;\n  for (let i = currentIndex + 1; i < allTopics.length; i += 1) {\n    if (onPath(allTopics[i])) { next = allTopics[i]; break; }\n  }\n  const strip = (t?: NavTopic): Topic | undefined => (t ? { title: t.title, slug: t.slug, description: t.description } : undefined);\n  return { prev: strip(prev), next: strip(next) };\n}\n\n/** The section (module) for a lesson slug, with its manifest metadata. */\nexport function findSectionBySlug(slug: string[]): Section | undefined {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return undefined;\n  const [tierSlug, sectionSlug] = normalized;\n  return curriculumData.find(m => m.slug === tierSlug)?.sections.find(s => s.slug === sectionSlug);\n}\n\n/** Canonical URL of a module's first lesson, given its folder name. */\nexport function moduleHref(moduleSlug: string): string | undefined {\n  for (const m of curriculumData) {\n    const s = m.sections.find(x => x.slug === moduleSlug);\n    if (s) return \`/curriculum/\${m.slug}/\${s.slug}/\${(s.topics.find(t => t.slug === 'index') ?? s.topics[0])?.slug ?? 'index'}\`;\n  }\n  return undefined;\n}\n\n// ---- Derived convenience types for the application UI ----\n\n// The curriculumData array represents the high level tiers of the course. The\n// UI components expect a \`Tier\` type with a list of \`modules\`.  Each module in\n// turn contains a list of lessons.  The existing data maps cleanly onto this\n// structure where a "Module" is a tier and each "Section" is a module.  The\n// topics within a section represent the lessons.\n\nexport type Tier = Module;\nexport type Lesson = Topic;\nexport interface ModuleEntry {\n  id: string;\n  title: string;\n  slug: string;\n  lessons: Lesson[];\n}\n\nexport const tiers: Tier[] = curriculumData;\n\nexport function getModules(tier: Tier): ModuleEntry[] {\n  return tier.sections.map(section => ({\n    id: section.slug,\n    title: section.title,\n    slug: section.slug,\n    lessons: section.topics,\n  }));\n}\n`;

  return header + JSON.stringify(data, null, 2) + footer + '\n';
}

if (require.main === module) {
  const data = generateCurriculumData();
  const outPath = path.join(process.cwd(), 'src', 'lib', 'curriculum-data.tsx');
  fs.writeFileSync(outPath, buildCurriculumFile(data));
  console.log(`curriculum data written to ${outPath}`);
}
