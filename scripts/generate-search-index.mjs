#!/usr/bin/env node
/**
 * Builds the client-side search index for the curriculum.
 *
 *   node scripts/generate-search-index.mjs           write src/generated/search-index.json
 *   node scripts/generate-search-index.mjs --check   exit 1 when the committed index is stale
 *
 * The index is deliberately small and holds no lesson body text:
 * - per tier: its folder and title;
 * - per module: its folder, title and track (core or elective);
 * - per lesson: its slug, title, description and every H2/H3 heading.
 * Search results link to `/curriculum/<tier>/<module>/<lesson>` and, for
 * headings, `#<anchor>`.
 *
 * Order and membership come from content/curriculum/curriculum.manifest.json,
 * the same source scripts/generate-curriculum-data.ts reads; titles and
 * descriptions are read the way that generator reads them.
 *
 * Anchors come from src/lib/heading-slug.ts (transpiled on the fly). The
 * slugger is fed every markdown heading of the page (h1 to h6) in document
 * order, so a repeated heading gets the same "-1", "-2" suffix the lesson
 * page gives it. A heading entry is `[text, depth]` when its anchor is
 * `headingSlug(text)`, and `[text, depth, anchor]` otherwise, which keeps the
 * file small: the search code rebuilds the common case with headingSlug.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import ts from "typescript";
import { unified } from "unified";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const curriculumRoot = path.join(root, "content", "curriculum");
const outputPath = path.join(root, "src", "generated", "search-index.json");
const INDEXED_DEPTHS = new Set([2, 3]);
export const SEARCH_INDEX_VERSION = 2;

/** Loads src/lib/heading-slug.ts, the one anchor algorithm the lesson page also uses. */
export async function loadHeadingSlug() {
  const source = fs.readFileSync(path.join(root, "src", "lib", "heading-slug.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

/** Title and description, read exactly as scripts/generate-curriculum-data.ts reads them. */
function readLessonMeta(raw, lessonSlug) {
  const { data, content } = matter(raw);
  let title = data.title;
  let description = data.description;
  if (!title || !description) {
    const metaMatch = raw.match(/export const metadata\s*=\s*{[^}]*}/);
    if (metaMatch) {
      try {
        const meta = new Function(`return (${metaMatch[0].replace(/export const metadata\s*=\s*/, "")});`)();
        title = title || meta.title;
        description = description || meta.description;
      } catch {
        // Same fallback as the curriculum generator.
      }
    }
  }
  const fallbackTitle = lessonSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: String(title || fallbackTitle), description: String(description || ""), body: content, data };
}

/** Plain text of an mdast heading, as the rendered heading's text content reads. */
function nodeText(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "image" || node.type === "imageReference" || node.type === "break") return "";
  if (node.type === "mdxTextExpression" || node.type === "mdxFlowExpression") return "";
  if (Array.isArray(node.children)) return node.children.map(nodeText).join("");
  return "";
}

function collectHeadings(tree) {
  const headings = [];
  const walk = (node) => {
    if (node.type === "heading") {
      headings.push({ depth: node.depth, text: nodeText(node) });
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return headings;
}

/** Fallback for a file the MDX parser rejects: ATX headings outside fenced code. */
function scanHeadings(body) {
  const headings = [];
  let fence = null;
  for (const line of body.split("\n")) {
    const marker = line.match(/^\s*(```+|~~~+)/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) {
      const text = m[2]
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[`*_~]/g, "");
      headings.push({ depth: m[1].length, text });
    }
  }
  return headings;
}

export async function buildSearchIndex() {
  const { createSlugger, headingSlug } = await loadHeadingSlug();
  const manifest = JSON.parse(fs.readFileSync(path.join(curriculumRoot, "curriculum.manifest.json"), "utf8"));
  const parser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
  const warnings = [];
  const tiers = [];

  for (const tier of manifest.tiers) {
    const modules = [];
    for (const mod of tier.modules) {
      const lessons = [];
      let moduleTitle = "";
      let skipModule = false;

      for (const lessonSlug of mod.lessons) {
        const file = path.join(curriculumRoot, tier.id, mod.id, `${lessonSlug}.mdx`);
        const raw = fs.readFileSync(file, "utf8");
        const { title, description, body, data } = readLessonMeta(raw, lessonSlug);
        // The generator leaves a redirect-only module out of navigation; so does search.
        if (lessonSlug === "index" && data.redirect && mod.lessons.every((slug) => slug === "index")) {
          skipModule = true;
          break;
        }
        if (lessonSlug === "index" || !moduleTitle) moduleTitle = title;

        let headings;
        try {
          headings = collectHeadings(parser.parse(body));
        } catch (error) {
          warnings.push(`${path.relative(root, file)}: MDX parse failed (${error.reason || error.message}); scanned headings by line`);
          headings = scanHeadings(body);
        }

        const slugger = createSlugger();
        const entries = [];
        for (const heading of headings) {
          const anchor = slugger(heading.text);
          const text = heading.text.replace(/\s+/g, " ").trim();
          if (!INDEXED_DEPTHS.has(heading.depth) || !text) continue;
          entries.push(anchor === headingSlug(text) ? [text, heading.depth] : [text, heading.depth, anchor]);
        }

        lessons.push({ slug: lessonSlug, title, description, headings: entries });
      }

      if (skipModule || lessons.length === 0) continue;
      modules.push({ id: mod.id, title: moduleTitle, track: mod.track === "elective" ? "elective" : "core", lessons });
    }
    tiers.push({ id: tier.id, title: tier.title, modules });
  }

  return { index: { version: SEARCH_INDEX_VERSION, tiers }, warnings };
}

/** One lesson per line keeps diffs readable without pretty-printing every heading. */
export function serializeSearchIndex(index) {
  const tierBlocks = index.tiers.map((tier) => {
    const moduleBlocks = tier.modules.map((mod) => {
      const head = `{"id":${JSON.stringify(mod.id)},"title":${JSON.stringify(mod.title)},"track":${JSON.stringify(mod.track)},"lessons":[\n`;
      return `${head}${mod.lessons.map((lesson) => JSON.stringify(lesson)).join(",\n")}\n]}`;
    });
    return `{"id":${JSON.stringify(tier.id)},"title":${JSON.stringify(tier.title)},"modules":[\n${moduleBlocks.join(",\n")}\n]}`;
  });
  return `{"version":${index.version},"tiers":[\n${tierBlocks.join(",\n")}\n]}\n`;
}

function summarize(index) {
  let lessons = 0;
  let headings = 0;
  for (const tier of index.tiers) {
    for (const mod of tier.modules) {
      lessons += mod.lessons.length;
      for (const lesson of mod.lessons) headings += lesson.headings.length;
    }
  }
  return { lessons, headings };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const { index, warnings } = await buildSearchIndex();
  for (const warning of warnings) console.warn(`warn  ${warning}`);
  const serialized = serializeSearchIndex(index);
  const { lessons, headings } = summarize(index);

  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
    if (current !== serialized) {
      console.error("src/generated/search-index.json is stale. Run: node scripts/generate-search-index.mjs");
      process.exit(1);
    }
    console.log(`Search index is up to date (${lessons} lessons, ${headings} headings).`);
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    console.log(
      `Wrote ${path.relative(root, outputPath)}: ${lessons} lessons, ${headings} headings, ${(serialized.length / 1024).toFixed(1)} KB.`,
    );
  }
}
