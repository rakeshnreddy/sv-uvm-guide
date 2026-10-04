#!/usr/bin/env node
/**
 * Per-file lesson checker for authors working in parallel.
 *
 *   node scripts/check-mdx.mjs <file-or-dir> [...]
 *
 * Unlike validate-content-manifests.mjs (which parses every lesson at once),
 * this checks only the files you name, so one author's half-finished page
 * cannot fail another author's check.
 *
 * Errors (exit 1):
 * - MDX syntax, including JS expressions in props
 * - unregistered JSX components
 * - missing frontmatter title or description
 * - LabLink ids with no lab manifest
 * - flashcard deck ids that do not resolve
 * - internal /curriculum links that do not resolve
 * - explicit H1 headings
 *
 * Warnings:
 * - H2 order differing from the template (Quick Take → Build Your Mental Model →
 *   Make It Work → Push Further → Practice & Reinforce → References & Next Topics)
 * - "Diagram data error" risks: kit components without a title or caption
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const curriculumRoot = path.join(root, "content", "curriculum");

const TEMPLATE = ["Quick Take", "Build Your Mental Model", "Make It Work", "Push Further", "Practice & Reinforce", "References & Next Topics"];
const KIT = new Set(["ArchitectureDiagram", "TimingDiagram", "SequenceDiagram"]);

function registeredComponents() {
  const registry = fs.readFileSync(path.join(root, "src/generated/mdx-component-registry.tsx"), "utf8");
  const lazy = fs.readFileSync(path.join(root, "src/components/mdx/lazy-mdx-interactives.ts"), "utf8");
  const block = registry.match(/export const mdxComponents = \{([\s\S]*?)\n};/);
  const names = new Set();
  if (block) {
    for (const line of block[1].split("\n")) {
      const m = line.match(/^\s*([A-Z][A-Za-z0-9]*)\s*(?::|,)/);
      if (m) names.add(m[1]);
    }
  }
  for (const m of lazy.matchAll(/^\s*"([A-Z][A-Za-z0-9]*)",$/gm)) names.add(m[1]);
  return names;
}

function deckIds() {
  const src = fs.readFileSync(path.join(root, "src/lib/flashcard-decks.ts"), "utf8");
  const ids = new Set();
  const decks = src.match(/export const flashcardDecks[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (decks) {
    for (const line of decks[1].split("\n")) {
      const quoted = line.match(/^\s*'([^']+)'\s*:/) || line.match(/^\s*"([^"]+)"\s*:/);
      const bare = line.match(/^\s*([A-Za-z0-9_]+)\s*(?:,|:)/);
      if (quoted) ids.add(quoted[1]);
      else if (bare) ids.add(bare[1]);
    }
  }
  const aliases = src.match(/const deckAliases[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (aliases) for (const m of aliases[1].matchAll(/'([^']+)'\s*:/g)) ids.add(m[1]);
  return ids;
}

function labIds() {
  const ids = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "lab.json") {
        try {
          const id = JSON.parse(fs.readFileSync(p, "utf8")).id;
          if (id) ids.add(id);
        } catch {
          /* reported by the manifest validator */
        }
      }
    }
  };
  walk(path.join(curriculumRoot, "labs"));
  return ids;
}

/** Same normalization as toPrettyCurriculumSlug in src/lib/curriculum-data.tsx. */
function pretty(segment) {
  let s = segment;
  try {
    s = decodeURIComponent(segment);
  } catch {
    /* keep raw */
  }
  return s.trim().replace(/_/g, "-").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

/** Resolves tier/module/topic segments by exact name or pretty slug, like normalizeSlug does at runtime. */
function routeExists(route) {
  const clean = route.split("#")[0].split("?")[0].replace(/^\/curriculum\/?/, "").replace(/\/$/, "");
  if (!clean) return true;
  const parts = clean.split("/");
  let dir = curriculumRoot;
  for (let i = 0; i < parts.length; i += 1) {
    const seg = parts[i];
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
    const entries = fs.readdirSync(dir);
    const isLast = i === parts.length - 1;
    if (isLast && i === 2) {
      // Topic: a .mdx file in the module folder.
      return entries.some((e) => e.endsWith(".mdx") && (e.slice(0, -4) === seg || pretty(e.slice(0, -4)) === pretty(seg)));
    }
    const match = entries.find((e) => e === seg || pretty(e) === pretty(seg));
    if (!match) return false;
    dir = path.join(dir, match);
  }
  return true;
}

function collectFiles(args) {
  const out = [];
  for (const a of args) {
    const p = path.resolve(root, a);
    if (!fs.existsSync(p)) {
      console.error(`No such file or directory: ${a}`);
      process.exitCode = 1;
      continue;
    }
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p)) if (f.endsWith(".mdx")) out.push(path.join(p, f));
    } else out.push(p);
  }
  return out;
}

const files = collectFiles(process.argv.slice(2));
if (!files.length) {
  console.error("Usage: node scripts/check-mdx.mjs <file-or-dir> [...]");
  process.exit(2);
}

const parser = unified().use(remarkParse).use(remarkMdx);
const components = registeredComponents();
const decks = deckIds();
const labs = labIds();
let errorCount = 0;
let warnCount = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const errors = [];
  const warnings = [];
  const raw = fs.readFileSync(file, "utf8");
  let fm;
  try {
    fm = matter(raw);
  } catch (e) {
    errors.push(`frontmatter: ${e.message}`);
  }
  if (fm) {
    // Legacy sub-lessons declare `export const metadata = { title, description }`;
    // the generator accepts it, but the target standard is frontmatter.
    const meta = fm.content.match(/export const metadata\s*=\s*\{([\s\S]*?)\};/);
    const metaTitle = meta && /title:\s*["'`]/.test(meta[1]);
    const metaDescription = meta && /description:\s*["'`]/.test(meta[1]);
    if (!fm.data.title && !metaTitle) errors.push("frontmatter: missing title");
    if (!fm.data.description && !metaDescription) errors.push("frontmatter: missing description");
    if (meta && (!fm.data.title || !fm.data.description)) warnings.push("legacy `export const metadata` block: move title and description into frontmatter");
    if (/<InfoPage[\s>]/.test(fm.content)) warnings.push("legacy <InfoPage> wrapper: lesson pages get their title and layout from the lesson route");
    const deck = fm.data.flashcards ?? fm.data.flashcardId;
    if (deck && !decks.has(String(deck))) errors.push(`frontmatter: flashcards "${deck}" is not a registered deck id or alias (src/lib/flashcard-decks.ts)`);
    let tree;
    try {
      tree = parser.parse(fm.content);
    } catch (e) {
      const where = e.line ? ` (body line ${e.line}${e.column ? `:${e.column}` : ""})` : "";
      errors.push(`MDX syntax${where}: ${e.reason || e.message}`);
    }
    if (tree) {
      const h2 = [];
      const visit = (node) => {
        if (node.type === "heading" && node.depth === 1) errors.push(`explicit H1 at body line ${node.position?.start.line} (the layout provides the H1)`);
        if (node.type === "heading" && node.depth === 2) h2.push((node.children || []).map((c) => c.value || "").join("").trim());
        if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name && /^[A-Z]/.test(node.name)) {
          const line = node.position?.start.line;
          if (!components.has(node.name)) errors.push(`unregistered component <${node.name}> at body line ${line}`);
          const attr = (n) => node.attributes?.find((a) => a.type === "mdxJsxAttribute" && a.name === n);
          if (node.name === "LabLink") {
            const id = attr("labId");
            const value = typeof id?.value === "string" ? id.value : null;
            if (!value) errors.push(`<LabLink> without a literal labId at body line ${line}`);
            else if (!labs.has(value)) errors.push(`<LabLink labId="${value}"> has no lab manifest (body line ${line})`);
          }
          if (KIT.has(node.name)) {
            if (!attr("title")) errors.push(`<${node.name}> needs a title (its accessible name) at body line ${line}`);
            if (!attr("caption")) errors.push(`<${node.name}> needs a caption at body line ${line}`);
          }
        }
        if (node.type === "link" && typeof node.url === "string" && node.url.startsWith("/curriculum")) {
          if (!routeExists(node.url)) errors.push(`broken link ${node.url} at body line ${node.position?.start.line}`);
        }
        for (const child of node.children || []) visit(child);
      };
      visit(tree);
      // Also catch href="/curriculum/..." inside JSX attributes.
      for (const m of fm.content.matchAll(/href=["'](\/curriculum[^"']*)["']/g)) {
        if (!routeExists(m[1])) errors.push(`broken link ${m[1]} in a JSX href`);
      }
      const templateSeen = h2.filter((h) => TEMPLATE.includes(h));
      const expected = TEMPLATE.filter((h) => templateSeen.includes(h));
      if (templateSeen.join("|") !== expected.join("|")) warnings.push(`H2 order differs from the template: ${h2.join(" → ")}`);
      const missing = TEMPLATE.filter((h) => !h2.includes(h));
      if (missing.length) warnings.push(`template H2 sections missing: ${missing.join(", ")}`);
    }
  }
  errorCount += errors.length;
  warnCount += warnings.length;
  if (errors.length || warnings.length) {
    console.log(`\n${rel}`);
    for (const e of errors) console.log(`  ERROR  ${e}`);
    for (const w of warnings) console.log(`  warn   ${w}`);
  }
}

console.log(`\nChecked ${files.length} file(s): ${errorCount} error(s), ${warnCount} warning(s).`);
process.exit(errorCount ? 1 : 0);
