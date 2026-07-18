import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { z } from "zod";

const root = process.cwd();
const curriculumRoot = path.join(root, "content", "curriculum");
const frontmatterSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  flashcardId: z.string().min(1).optional(),
  flashcards: z.string().min(1).optional(),
  conceptLinking: z.boolean().optional(),
  components: z.array(z.string().min(1)).optional(),
  order: z.number().int().positive().optional(),
  tier: z.string().min(1).optional(),
  sources: z.array(z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    identifier: z.string().min(1).optional(),
    version: z.union([z.string().min(1), z.number()]).optional(),
  }).strict()).optional(),
}).strict();

function walk(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(candidate, predicate);
    return entry.isFile() && predicate(candidate) ? [candidate] : [];
  });
}

function runCheck(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
}

runCheck("scripts/generate-lab-registry.mjs", ["--check"]);
runCheck("scripts/generate-curriculum-redirects.mjs", ["--check"]);

const labIds = new Set(
  walk(path.join(curriculumRoot, "labs"), (file) => path.basename(file) === "lab.json")
    .map((file) => JSON.parse(fs.readFileSync(file, "utf8")).id),
);
const parser = unified().use(remarkParse).use(remarkMdx);
const mdxFiles = walk(curriculumRoot, (file) => file.endsWith(".mdx"));
const errors = [];

function inspectNode(node, file) {
  if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "LabLink") {
    const labIdAttribute = node.attributes?.find((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "labId");
    const labId = typeof labIdAttribute?.value === "string" ? labIdAttribute.value : null;
    if (!labId || !labIds.has(labId)) errors.push(`${file}: LabLink references unknown lab ${labId ?? "<missing>"}`);
  }
  for (const child of node.children ?? []) inspectNode(child, file);
}

for (const absolutePath of mdxFiles) {
  const relativePath = path.relative(root, absolutePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  try {
    const parsed = matter(source);
    frontmatterSchema.parse(parsed.data);
    inspectNode(parser.parse(parsed.content), relativePath);
  } catch (error) {
    errors.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${mdxFiles.length} MDX files and ${labIds.size} lab manifests.`);
