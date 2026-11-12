#!/usr/bin/env node
/**
 * Builds the client-side search index: the curriculum plus practice and reference pages.
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
 * Beside the curriculum, `items` lists the other places a learner can open,
 * each with a kind, a title, a one-line description, keywords, an href and an
 * optional module code (no body text):
 * - labs (available ones) from the lab registry (src/generated/lab-registry.ts);
 * - exercises, interactive models (interactives, diagrams and charts) and tools
 *   from PRACTICE_PAGES in src/lib/practice-links.ts;
 * - the interview question banks in content/interview-questions/*.json,
 *   linking to their section of /interview-prep;
 * - the reference pages from REFERENCE_LINKS in src/lib/site-links.ts, with the
 *   description from each page's metadata.
 * The TypeScript sources are transpiled on the fly with their runtime imports
 * replaced by small stubs, so the script needs no TypeScript loader.
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
export const SEARCH_INDEX_VERSION = 3;
/** Descriptions of the non-lesson items keep their first sentence, cut to at most this many characters. */
export const ITEM_DESCRIPTION_MAX = 120;
/** The order kinds are listed in the index. */
export const ITEM_KINDS = ["lab", "exercise", "model", "tool", "interview", "reference"];

/** Loads src/lib/heading-slug.ts, the one anchor algorithm the lesson page also uses. */
export async function loadHeadingSlug() {
  const source = fs.readFileSync(path.join(root, "src", "lib", "heading-slug.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

/**
 * Runtime imports of the TypeScript sources this script reads, and what each
 * resolves to here: module source text, a JSON file, or another TypeScript
 * module transpiled the same way. Type-only imports vanish in the transpile.
 * An import that is not listed fails loudly instead of loading half the app.
 */
const MANIFEST_JSON = { json: "content/curriculum/curriculum.manifest.json" };
export const TS_IMPORT_STUBS = {
  "@/lib/curriculum-data": { source: "export const curriculumData = [];" },
  "@/lib/lab-registry": { source: "export const getLabById = () => undefined; export const getAllLabs = () => [];" },
  "@/lib/site-links": { ts: "src/lib/site-links.ts" },
  "../../content/curriculum/curriculum.manifest.json": MANIFEST_JSON,
  "@/content/curriculum/curriculum.manifest.json": MANIFEST_JSON,
};

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

/** A TypeScript module from the repo as a data: URL, its imports resolved through TS_IMPORT_STUBS. */
function tsModuleUrl(relativePath, seen = new Set()) {
  if (seen.has(relativePath)) throw new Error(`Import cycle through ${relativePath}`);
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return dataUrl(
    outputText.replace(/(\bfrom\s*|\bimport\s*)(["'])([^"']+)\2/g, (match, keyword, quote, specifier) => {
      const stub = TS_IMPORT_STUBS[specifier];
      if (!stub) throw new Error(`${relativePath} imports ${specifier}; add it to TS_IMPORT_STUBS in scripts/generate-search-index.mjs`);
      let url;
      if (stub.source) url = dataUrl(stub.source);
      else if (stub.json) url = dataUrl(`export default ${fs.readFileSync(path.join(root, stub.json), "utf8")};`);
      else url = tsModuleUrl(stub.ts, new Set([...seen, relativePath]));
      return `${keyword}${quote}${url}${quote}`;
    }),
  );
}

/** Imports a TypeScript module from the repo (see TS_IMPORT_STUBS). */
export function importTsModule(relativePath) {
  return import(tsModuleUrl(relativePath));
}

/**
 * The first sentence: up to the first ".", "!" or "?" that is followed by a
 * capital letter or the end of the text, so "e.g. a" or "v1.2" do not end it.
 */
export function firstSentence(text) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  const end = /[.!?](?=\s+["“(]?[A-Z0-9]|$)/.exec(flat);
  return end ? flat.slice(0, end.index + 1) : flat;
}

/**
 * One line for a search result: the first sentence when it fits in `max`
 * characters, otherwise cut at the last word boundary that leaves room for an
 * ellipsis, so the line, ellipsis included, is at most `max` characters.
 */
export function oneLine(text, max = ITEM_DESCRIPTION_MAX) {
  const sentence = firstSentence(text);
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const words = space > max / 2 ? cut.slice(0, space) : cut.slice(0, max - 1);
  return `${words.replace(/[\s,;:.\-–—(]+$/, "")}…`;
}

/** "I-SV-2B_Advanced_Constrained_Randomization/solver-debug" → "I-SV-2B". */
function codeOfLessonRef(ref) {
  return ref ? ref.split("/")[0].split("_")[0] : undefined;
}

/** Unique, lowercase keywords in first-seen order. */
function keywords(...values) {
  const seen = new Set();
  for (const value of values.flat()) {
    const word = String(value ?? "").trim().toLowerCase();
    if (word) seen.add(word);
  }
  return [...seen];
}

/** Words search ignores in a query (STOP_WORDS in src/components/search/search-engine.ts); never worth a keyword. */
export const KEYWORD_STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "vs", "is", "are", "how", "what", "why",
]);

/** Function words that name no topic, left out of derived keywords along with the stop words. */
const GENERIC_KEYWORD_WORDS = new Set([
  "as", "at", "be", "by", "can", "each", "from", "into", "it", "its", "no", "not", "or", "so", "that", "their",
  "them", "then", "they", "this", "through", "up", "use", "when", "which", "without", "you", "your",
]);

/** Words as search tokenizes them (tokenizeSearchText): lowercase, SystemVerilog identifiers kept whole. */
function searchWords(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9_$]+/)
    .filter(Boolean);
}

/**
 * Topic keywords for a practice item, from data already true of it: the words
 * of its authored outcome line and the titles of the lessons that teach it
 * (for a lab, its launching lesson and every lesson that places its LabLink).
 * Single letters, stop words, function words and words already in its title,
 * one-line description or other keywords are left out: they add size and no match.
 *
 * @param {{ title: string, description: string, outcome?: string, lessonTitles?: string[] }} entry
 * @param {string[]} [existing]
 * @returns {string[]}
 */
export function topicKeywords({ title, description, outcome, lessonTitles = [] }, existing = []) {
  const known = new Set([...searchWords(title), ...searchWords(oneLine(description)), ...existing.flatMap(searchWords)]);
  const words = [];
  for (const word of [...searchWords(outcome), ...lessonTitles.flatMap((lessonTitle) => searchWords(stripCodePrefix(lessonTitle)))]) {
    if (word.length < 2 || KEYWORD_STOP_WORDS.has(word) || GENERIC_KEYWORD_WORDS.has(word) || known.has(word)) continue;
    known.add(word);
    words.push(word);
  }
  return words;
}

/** "F2D: Reusable Code and Parallelism" → "Reusable Code and Parallelism". */
function stripCodePrefix(title) {
  // A module code holds a digit, so "Semaphores: Keys…" keeps its first word.
  return String(title ?? "").replace(/^(?=[A-Za-z-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*:\s*/, "");
}

/**
 * The title of the lesson a ref names: "<ModuleFolder>/<lesson>", a bare
 * module folder or a module code (its index lesson), as resolveLessonRef in
 * src/lib/practice-links.ts reads refs. Undefined when it names nothing.
 */
function lessonTitleOf(lessonTitles, ref) {
  if (!ref) return undefined;
  const [moduleRef, lessonSlug = "index"] = ref.split("/");
  const moduleId = lessonTitles.moduleIds.get(moduleRef) ?? lessonTitles.moduleIds.get(moduleRef.split("_")[0]);
  return moduleId ? lessonTitles.titles.get(`${moduleId}/${lessonSlug}`) : undefined;
}

/** One index item; `code` only when there is one. */
function item(kind, title, description, href, words, code) {
  const entry = { kind, title: title.replace(/\s+/g, " ").trim(), description: oneLine(description), href, keywords: words };
  if (code) entry.code = code;
  return entry;
}

/** Practice pages (from src/lib/practice-links.ts), whose kinds map to search kinds. */
const PRACTICE_KIND_TO_SEARCH_KIND = { exercise: "exercise", interactive: "model", diagram: "model", chart: "model", tool: "tool" };
const PRACTICE_KIND_WORDS = {
  exercise: ["exercise"],
  interactive: ["interactive model", "visualization"],
  diagram: ["interactive model", "diagram", "visualization"],
  chart: ["interactive model", "chart", "visualization"],
  tool: ["tool"],
};

/** The `description` in a page's `export const metadata`, read from its source. */
function pageMetadataDescription(route) {
  const candidates = [
    path.join(root, "src", "app", "(learning)", ...route.split("/").filter(Boolean), "page.tsx"),
    path.join(root, "src", "app", "(public)", ...route.split("/").filter(Boolean), "page.tsx"),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error(`No page.tsx for reference page ${route}`);
  const source = fs.readFileSync(file, "utf8");
  const metadata = source.slice(source.indexOf("export const metadata"));
  const match = /description:\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/.exec(metadata);
  if (!match) throw new Error(`${path.relative(root, file)} has no metadata description`);
  return match[2].replace(/\\(.)/g, "$1");
}

/** Labs, exercises, models, tools, interview banks and reference pages. */
export async function buildSearchItems(lessonTitles = { titles: new Map(), moduleIds: new Map(), labLinks: new Map() }) {
  const practice = await importTsModule("src/lib/practice-links.ts");
  const { GENERATED_LAB_MANIFESTS } = await importTsModule("src/generated/lab-registry.ts");
  const siteLinks = await importTsModule("src/lib/site-links.ts");

  const items = [];

  for (const lab of GENERATED_LAB_MANIFESTS) {
    if (lab.status !== "available") continue;
    const override = practice.LAB_LESSON_OVERRIDES[lab.id]?.[0];
    const [, hrefRoot, , hrefModule, hrefLesson] = lab.moduleHref ? lab.moduleHref.split("/") : [];
    const fromHref = hrefRoot === "curriculum" && hrefModule ? `${hrefModule}/${hrefLesson || "index"}` : undefined;
    const code = codeOfLessonRef(override) ?? codeOfLessonRef(fromHref) ?? lab.owningModule;
    const base = keywords("lab", lab.owningModule, code);
    const teaching = override ?? fromHref ?? lab.owningModule;
    const launching = lessonTitleOf(lessonTitles, teaching);
    const linking = lessonTitles.labLinks.get(lab.id) ?? [];
    const topics = topicKeywords({ ...lab, lessonTitles: [launching, ...linking].filter(Boolean) }, base);
    items.push(item("lab", lab.title, lab.description, `/practice/lab/${lab.id}`, [...base, ...topics], code));
  }

  for (const page of practice.PRACTICE_PAGES) {
    const kind = PRACTICE_KIND_TO_SEARCH_KIND[page.kind];
    if (!kind) throw new Error(`Practice page ${page.href} has kind ${page.kind}, which search does not map`);
    const codes = page.lessons.map(codeOfLessonRef);
    const base = keywords(PRACTICE_KIND_WORDS[page.kind], codes);
    const topics = topicKeywords({ ...page, lessonTitles: [lessonTitleOf(lessonTitles, page.lessons[0])].filter(Boolean) }, base);
    items.push(item(kind, page.title, page.description, page.href, [...base, ...topics], codes[0]));
  }

  const bankDir = path.join(root, "content", "interview-questions");
  for (const file of fs.readdirSync(bankDir).filter((name) => name.endsWith(".json")).sort()) {
    const bank = JSON.parse(fs.readFileSync(path.join(bankDir, file), "utf8"));
    const home = practice.INTERVIEW_BANK_LESSONS[bank.topic]?.[0];
    const code = codeOfLessonRef(home);
    const base = keywords("interview", "interview questions", bank.topic);
    const outcome = practice.INTERVIEW_BANK_OUTCOMES[bank.topic];
    const topics = topicKeywords({ ...bank, outcome, lessonTitles: [lessonTitleOf(lessonTitles, home)].filter(Boolean) }, base);
    items.push(item("interview", bank.title, bank.description, `/interview-prep/${file.replace(/\.json$/, "")}`, [...base, ...topics], code));
  }

  for (const link of siteLinks.REFERENCE_LINKS) {
    items.push(item("reference", link.label, pageMetadataDescription(link.href), link.href, keywords("reference")));
  }

  return items.sort((a, b) => ITEM_KINDS.indexOf(a.kind) - ITEM_KINDS.indexOf(b.kind));
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
  /** Lab id → titles of the lessons that place its <LabLink>, in manifest order. */
  const labLinks = new Map();

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

        for (const [, labId] of body.matchAll(/<LabLink\s[^>]*?labId=["']([^"']+)["']/g)) {
          const titles = labLinks.get(labId) ?? [];
          if (!titles.includes(title)) titles.push(title);
          labLinks.set(labId, titles);
        }

        lessons.push({ slug: lessonSlug, title, description, headings: entries });
      }

      if (skipModule || lessons.length === 0) continue;
      modules.push({ id: mod.id, title: moduleTitle, track: mod.track === "elective" ? "elective" : "core", lessons });
    }
    tiers.push({ id: tier.id, title: tier.title, modules });
  }

  const lessonTitles = { titles: new Map(), moduleIds: new Map(), labLinks };
  for (const tier of tiers) {
    for (const mod of tier.modules) {
      lessonTitles.moduleIds.set(mod.id, mod.id);
      lessonTitles.moduleIds.set(mod.id.split("_")[0], mod.id);
      for (const lesson of mod.lessons) lessonTitles.titles.set(`${mod.id}/${lesson.slug}`, lesson.title);
    }
  }
  const items = await buildSearchItems(lessonTitles);
  return { index: { version: SEARCH_INDEX_VERSION, tiers, items }, warnings };
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
  const itemLines = (index.items ?? []).map((entry) => JSON.stringify(entry));
  return `{"version":${index.version},"tiers":[\n${tierBlocks.join(",\n")}\n],"items":[\n${itemLines.join(",\n")}\n]}\n`;
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
  const items = {};
  for (const entry of index.items ?? []) items[entry.kind] = (items[entry.kind] ?? 0) + 1;
  return { lessons, headings, items };
}

function describeItems(items) {
  return Object.entries(items).map(([kind, count]) => `${count} ${kind}`).join(", ");
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const { index, warnings } = await buildSearchIndex();
  for (const warning of warnings) console.warn(`warn  ${warning}`);
  const serialized = serializeSearchIndex(index);
  const { lessons, headings, items } = summarize(index);

  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
    if (current !== serialized) {
      console.error("src/generated/search-index.json is stale. Run: node scripts/generate-search-index.mjs");
      process.exit(1);
    }
    console.log(`Search index is up to date (${lessons} lessons, ${headings} headings; ${describeItems(items)}).`);
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    console.log(
      `Wrote ${path.relative(root, outputPath)}: ${lessons} lessons, ${headings} headings; ${describeItems(items)}; ${(serialized.length / 1024).toFixed(1)} KB.`,
    );
  }
}
