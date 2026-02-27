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

function createTopic(filePath: string, moduleSlug: string, sectionSlug: string, represented: Set<string>): Topic {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data } = matter(raw);
  const topicSlug = path.basename(filePath).replace(/\.mdx$/, '');
  const relSlug = [moduleSlug, sectionSlug, topicSlug].join('/');
  represented.add(relSlug);
  if (topicSlug === 'index') {
    represented.add([moduleSlug, sectionSlug].join('/'));
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
  const linkRegex = /href\s*=\s*["']\/curriculum\/([^"']+)["']/g;
  const files = getAllMdxFiles(baseDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(content))) {
      const target = match[1].split('#')[0];
      if (!validSlugs.has(target)) {
        throw new Error(`Broken link in ${file}: ${target}`);
      }
    }
  }
}

export function generateCurriculumData(baseDir = path.join(process.cwd(), 'content', 'curriculum')): Module[] {
  const modules: Module[] = [];
  const represented = new Set<string>();
  const allFiles = getAllMdxFiles(baseDir).map(p => path.relative(baseDir, p).replace(/\\/g, '/').replace(/\.mdx$/, ''));

  const moduleDirs = fs.readdirSync(baseDir).filter(d => fs.statSync(path.join(baseDir, d)).isDirectory() && d !== 'labs').sort();

  for (const moduleDir of moduleDirs) {
    const modulePath = path.join(baseDir, moduleDir);
    const tier = moduleDir.split('_')[0] || moduleDir;
    const moduleTitle = titleFromSlug(moduleDir.replace(/^T\d+_/, ''));
    const module: Module = { title: moduleTitle, slug: moduleDir, tier, sections: [] };

    const sectionDirs = fs.readdirSync(modulePath).filter(d => fs.statSync(path.join(modulePath, d)).isDirectory()).sort();

    for (const sectionDir of sectionDirs) {
      const sectionPath = path.join(modulePath, sectionDir);
      const indexPath = path.join(sectionPath, 'index.mdx');
      const mdxFiles = fs.readdirSync(sectionPath).filter(f => f.endsWith('.mdx')).sort();
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

      module.sections.push({ title: sectionTitle, slug: sectionDir, topics });
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
  const header = `// This file is auto-generated by scripts/generate-curriculum-data.ts. Do not edit manually.\n\nexport interface Topic {\n  title: string;\n  slug: string;\n  description: string;\n}\n\nexport interface Section {\n  title: string;\n  slug: string;\n  topics: Topic[];\n}\n\nexport interface Module {\n  title: string;\n  slug: string;\n  tier: string;\n  sections: Section[];\n}\n\nexport const curriculumData: Module[] = `;

  const footer = `;\n\n// Helper functions to navigate the new structure\n\nexport function normalizeSlug(slug: string[]): string[] {\n  if (slug.length >= 3) {\n    return slug.slice(0, 3);\n  }\n  if (slug.length === 0) return [];\n\n  const [tierSlug, sectionSlug] = slug;\n  const courseModule = curriculumData.find(m => m.slug === tierSlug);\n  if (!courseModule) return [];\n\n  if (slug.length === 1) {\n    const firstSection = courseModule.sections[0];\n    if (!firstSection) return [];\n    const firstTopic = firstSection.topics.find(t => t.slug === 'index') ?? firstSection.topics[0];\n    if (!firstTopic) return [];\n    return [tierSlug, firstSection.slug, firstTopic.slug];\n  }\n\n  const section = courseModule.sections.find(s => s.slug === sectionSlug);\n  if (!section) return [];\n  const topic = section.topics.find(t => t.slug === 'index') ?? section.topics[0];\n  if (!topic) return [];\n  return [tierSlug, section.slug, topic.slug];\n}\n\nexport function findTopicBySlug(slug: string[]): Topic | undefined {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return undefined;\n  const [tierSlug, sectionSlug, topicSlug] = normalized;\n  const courseModule = curriculumData.find(m => m.slug === tierSlug);\n  if (!courseModule) return undefined;\n  const section = courseModule.sections.find(s => s.slug === sectionSlug);\n  if (!section) return undefined;\n  return section.topics.find(t => t.slug === topicSlug);\n}\n\nexport function getBreadcrumbs(slug: string[]): { title: string, path: string }[] {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return [];\n  const [tierSlug, sectionSlug, topicSlug] = normalized;\n  const breadcrumbs: { title: string, path: string }[] = [];\n  const courseModule = curriculumData.find(m => m.slug === tierSlug);\n  if (!courseModule) return breadcrumbs;\n\n  breadcrumbs.push({ title: "Curriculum", path: \`/curriculum\` });\n  breadcrumbs.push({ title: courseModule.title, path: \`/curriculum/\${courseModule.slug}\` });\n\n  const section = courseModule.sections.find(s => s.slug === sectionSlug);\n  if (!section) return breadcrumbs;\n  breadcrumbs.push({ title: section.title, path: \`/curriculum/\${courseModule.slug}/\${section.slug}\` });\n\n  const topic = section.topics.find(t => t.slug === topicSlug);\n  if (topic) {\n    breadcrumbs.push({ title: topic.title, path: \`/curriculum/\${courseModule.slug}/\${section.slug}/\${topic.slug}\` });\n  }\n\n  return breadcrumbs;\n}\n\nexport function findPrevNextTopics(slug: string[]): { prev: Topic | undefined, next: Topic | undefined } {\n  const normalized = normalizeSlug(slug);\n  if (normalized.length !== 3) return { prev: undefined, next: undefined };\n\n  const allTopics: Topic[] = [];\n  curriculumData.forEach(m => {\n    m.sections.forEach(s => {\n      s.topics.forEach(t => {\n        allTopics.push({ ...t, slug: \`\${m.slug}/\${s.slug}/\${t.slug}\` });\n      });\n    });\n  });\n\n  const currentIndex = allTopics.findIndex(t => t.slug === normalized.join('/'));\n  if (currentIndex === -1) return { prev: undefined, next: undefined };\n\n  const prev = currentIndex > 0 ? allTopics[currentIndex - 1] : undefined;\n  const next = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : undefined;\n\n  return { prev, next };\n}\n\n// ---- Derived convenience types for the application UI ----\n\n// The curriculumData array represents the high level tiers of the course. The\n// UI components expect a \`Tier\` type with a list of \`modules\`.  Each module in\n// turn contains a list of lessons.  The existing data maps cleanly onto this\n// structure where a "Module" is a tier and each "Section" is a module.  The\n// topics within a section represent the lessons.\n\nexport type Tier = Module;\nexport type Lesson = Topic;\nexport interface ModuleEntry {\n  id: string;\n  title: string;\n  slug: string;\n  lessons: Lesson[];\n}\n\nexport const tiers: Tier[] = curriculumData;\n\nexport function getModules(tier: Tier): ModuleEntry[] {\n  return tier.sections.map(section => ({\n    id: section.slug,\n    title: section.title,\n    slug: section.slug,\n    lessons: section.topics,\n  }));\n}\n`;

  return header + JSON.stringify(data, null, 2) + footer + '\n';
}

if (require.main === module) {
  const data = generateCurriculumData();
  const outPath = path.join(process.cwd(), 'src', 'lib', 'curriculum-data.tsx');
  fs.writeFileSync(outPath, buildCurriculumFile(data));
  console.log(`curriculum data written to ${outPath}`);
}
