// @vitest-environment node
/**
 * Render smoke test for every lesson MDX file (content/curriculum/T*\/**\/*.mdx).
 *
 * scripts/check-mdx.mjs only parses MDX. A lesson can parse cleanly and still
 * return HTTP 500, because next-mdx-remote evaluates the compiled lesson at
 * request time: an unescaped `{expr}` that names an undefined variable, a
 * reference to an `export const` (next-mdx-remote strips imports and exports),
 * a component that is not in the site's components map, or frontmatter the
 * lesson loader's strict schema rejects all fail only at runtime.
 *
 * This test runs each lesson through the lesson page's own pipeline
 * (src/app/(learning)/curriculum/[...slug]/page.tsx):
 *   gray-matter -> parseLessonFrontmatter -> lessonRemarkPlugins (same options)
 *   -> compileMDX from next-mdx-remote/rsc -> renderToStaticMarkup.
 * Every component the page provides (getMdxComponents + the practice slot) is
 * replaced by a stub that renders its children, so failures point at the
 * lesson's MDX rather than component internals. A component name the page does
 * not provide fails with "Expected component `X` to be defined", reported here
 * as an unknown component with its file line.
 *
 * Why this lives in Vitest: the pipeline is TypeScript under the `@/` alias
 * (remark plugins, frontmatter schema, components map), which plain Node 20
 * cannot import from scripts/check-mdx.mjs without a TS loader. Instead,
 * `node scripts/check-mdx.mjs --render <files>` runs this test with
 * MDX_RENDER_FILES set to the files it was given.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { getMdxComponents } from "@/generated/mdx-component-registry";
import { parseLessonFrontmatter } from "@/lib/curriculum/lesson-frontmatter";
import { LESSON_PRACTICE_SLOT, lessonRemarkPlugins } from "@/lib/curriculum/lesson-mdx";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { getFullKnowledgeGraph } from "@/lib/knowledge-graph-engine";
import { getAllLabs } from "@/lib/lab-registry";
import { getPracticeForModule } from "@/lib/practice-links";

const ROOT = process.cwd();
const CURRICULUM = path.join(ROOT, "content", "curriculum");

/** Every lesson file under the tier folders (labs/ and other top-level folders are not lessons). */
function lessonFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mdx")) out.push(full);
    }
  };
  for (const tier of fs.readdirSync(CURRICULUM, { withFileTypes: true })) {
    if (tier.isDirectory() && /^T\d/.test(tier.name)) walk(path.join(CURRICULUM, tier.name));
  }
  return out.sort();
}

/** MDX_RENDER_FILES (newline- or comma-separated paths) narrows the run; check-mdx --render sets it. */
function selectedFiles(): string[] {
  const requested = process.env.MDX_RENDER_FILES?.split(/[\n,]/).map((f) => f.trim()).filter(Boolean);
  if (!requested?.length) return lessonFiles();
  return requested.map((f) => path.resolve(ROOT, f));
}

function stub(name: string) {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div data-mdx-component={name}>{children}</div>;
  Stub.displayName = `Stub(${name})`;
  return Stub;
}

/** The names the lesson page provides, each mapped to a children-only stub. */
const SITE_COMPONENT_NAMES = [...Object.keys(getMdxComponents([], { lessonSlug: ["T", "M", "l"] })), LESSON_PRACTICE_SLOT];
const STUB_COMPONENTS = Object.fromEntries(SITE_COMPONENT_NAMES.map((name) => [name, stub(name)]));

const mdxParser = unified().use(remarkParse).use(remarkMdx);

type MdxNode = {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdxNode[];
  children?: MdxNode[];
  position?: { start: { line: number } };
};

/** Body line of the first JSX element named `component`, or of the first expression whose code matches `code`. */
function locate(body: string, { component, code }: { component?: string; code?: RegExp }): number | undefined {
  let tree: MdxNode;
  try {
    tree = mdxParser.parse(body) as unknown as MdxNode;
  } catch {
    return undefined;
  }
  const mentions = (value: unknown) => typeof value === "string" && code !== undefined && code.test(value);
  let found: number | undefined;
  const visit = (node: MdxNode, line?: number) => {
    if (found !== undefined) return;
    const here = node.position?.start.line ?? line;
    if (component && (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === component) found = here;
    if (code) {
      if ((node.type === "mdxFlowExpression" || node.type === "mdxTextExpression" || node.type === "mdxJsxExpressionAttribute") && mentions(node.value)) found = here;
      if (node.type === "mdxJsxAttribute" && typeof node.value === "object" && node.value && mentions((node.value as MdxNode).value)) found = here;
    }
    for (const attr of node.attributes ?? []) visit(attr, here);
    for (const child of node.children ?? []) visit(child, here);
  };
  visit(tree);
  return found;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern for the code an evaluation error points at: the undefined name, or the property read off undefined/null. */
function culprit(message: string): RegExp | undefined {
  const undefinedName = message.match(/^(\S+) is not defined/);
  if (undefinedName) return new RegExp(`(^|[^\\w$.])${escapeRegExp(undefinedName[1])}(?![\\w$])`);
  const property = message.match(/\(reading '([^']+)'\)/);
  if (property) return new RegExp(`(\\.|\\[["'\`])${escapeRegExp(property[1])}(?![\\w$])`);
  return undefined;
}

/**
 * The lesson page's frontmatter check, compile and render, with stubbed components.
 * Returns one line per problem (empty when the lesson renders). A frontmatter
 * schema failure is reported and the body is still rendered, so one run shows both.
 */
async function renderLesson(file: string): Promise<string[]> {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, "utf8");
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (error) {
    return [`${rel}: frontmatter does not parse: ${(error as Error).message}`];
  }
  const body = parsed.content;
  // File line = body line + lines taken by the frontmatter block.
  const offset = body.length ? raw.slice(0, raw.length - body.length).split("\n").length - 1 : 0;
  const at = (bodyLine?: number) => (bodyLine ? `:${bodyLine + offset}` : "");

  const problems: string[] = [];
  let frontmatter: Pick<ReturnType<typeof parseLessonFrontmatter>, "flashcards" | "flashcardId" | "conceptLinking">;
  try {
    frontmatter = parseLessonFrontmatter(parsed.data);
  } catch (error) {
    const issues = (error as { issues?: Array<{ path: Array<string | number>; message: string }> }).issues;
    const detail = issues?.length
      ? issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")
      : (error as Error).message.replace(/\s+/g, " ");
    problems.push(`${rel}: frontmatter rejected by the lesson loader schema (parseLessonFrontmatter): ${detail}`);
    const data = parsed.data as Record<string, unknown>;
    frontmatter = {
      flashcards: typeof data.flashcards === "string" ? data.flashcards : undefined,
      flashcardId: typeof data.flashcardId === "string" ? data.flashcardId : undefined,
      conceptLinking: data.conceptLinking === true,
    };
  }

  const relToCurriculum = path.relative(CURRICULUM, file).split(path.sep);
  const [, sectionSlug = "", lessonFile = ""] = relToCurriculum;
  const topicSlug = lessonFile.replace(/\.mdx$/, "");
  const practice = getPracticeForModule(sectionSlug, `${sectionSlug}/${topicSlug}`, getAllLabs());
  const concepts = frontmatter.conceptLinking ? (await getFullKnowledgeGraph()).nodes : [];
  const toc: TocEntry[] = [];
  const remarkPlugins = lessonRemarkPlugins({
    toc,
    hasFlashcards: Boolean(frontmatter.flashcards ?? frontmatter.flashcardId),
    hasHandsOn: practice.length > 0,
    concepts,
  });

  let content: React.ReactElement;
  try {
    ({ content } = await compileMDX({ source: body, components: STUB_COMPONENTS, options: { mdxOptions: { remarkPlugins } } }));
  } catch (error) {
    // next-mdx-remote wraps compile errors; line 2 holds "<line>:<col>[-...]: reason" in body coordinates.
    const inner = (error as Error).message.split("\n")[1] ?? (error as Error).message;
    const pos = inner.match(/^(\d+):\d+/);
    return [...problems, `${rel}${at(pos ? Number(pos[1]) : undefined)}: MDX compile error: ${inner}`];
  }

  try {
    const html = renderToStaticMarkup(content);
    if (!html.trim()) problems.push(`${rel}: rendered to empty markup`);
  } catch (error) {
    const message = (error as Error).message;
    const missing = message.match(/Expected component `([^`]+)` to be defined/);
    if (missing) {
      problems.push(`${rel}${at(locate(body, { component: missing[1] }))}: unknown component <${missing[1]}> (not in the lesson page's components map)`);
    } else {
      const line = locate(body, { code: culprit(message) });
      problems.push(`${rel}${at(line)}: render error: ${(error as Error).name}: ${message}`);
    }
  }
  return problems;
}

describe("lesson MDX render smoke test", () => {
  it(
    "compiles, evaluates and renders every lesson with the lesson page's pipeline",
    async () => {
      const files = selectedFiles();
      expect(files.length).toBeGreaterThan(0);
      const failures: string[] = [];
      for (const file of files) {
        failures.push(...(await renderLesson(file)));
      }
      expect(failures, `${failures.length} problem(s) in ${files.length} lesson(s):\n${failures.join("\n")}`).toEqual([]);
    },
    120_000,
  );

  it("reports undefined expressions and unknown components with file lines", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdx-render-smoke-"));
    const file = path.join(dir, "fixture.mdx");
    try {
      fs.writeFileSync(file, "---\ntitle: Fixture\n---\n\n## Quick Take\n\nCost is {latency} cycles.\n");
      expect((await renderLesson(file)).join("\n")).toMatch(/fixture\.mdx:7: render error: ReferenceError: latency is not defined/);
      fs.writeFileSync(file, "---\ntitle: Fixture\n---\n\n## Quick Take\n\n<NotARealWidget />\n");
      expect((await renderLesson(file)).join("\n")).toMatch(/fixture\.mdx:7: unknown component <NotARealWidget>/);
      fs.writeFileSync(file, "---\ntitle: Fixture\n---\n\n## Quick Take\n\nSee {props.missing.deep}.\n");
      expect((await renderLesson(file)).join("\n")).toMatch(/fixture\.mdx:7: render error: TypeError/);
      fs.writeFileSync(file, "---\ntitle: Fixture\n---\n\n## Quick Take\n\n<Panel>\n\nnever closed\n");
      expect((await renderLesson(file)).join("\n")).toMatch(/fixture\.mdx:\d+: MDX compile error/);
      fs.writeFileSync(file, "---\ntitle: Fixture\nbogus: 1\n---\n\n<Panel>ok</Panel>\n");
      expect((await renderLesson(file)).join("\n")).toMatch(/frontmatter rejected/);
      fs.writeFileSync(file, "---\ntitle: Fixture\n---\n\n<Panel>ok {1 + 1}</Panel>\n");
      expect(await renderLesson(file)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
