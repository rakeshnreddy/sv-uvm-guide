// @vitest-environment node
/**
 * Lesson-wide sweep for the MDX diagram kit.
 *
 * Every <ArchitectureDiagram> and <SequenceDiagram> in content/curriculum/**\/*.mdx
 * is read straight from the MDX (props are literal data, evaluated as JS) and
 * run through the kit's own layout code (layoutGridDiagram, layoutSequence),
 * which reports:
 * - data errors (`problems`), e.g. unknown node ids or overlapping cells;
 * - geometry warnings (`warnings`): an edge label that hides its line and
 *   arrowhead, labels centred on the same point or overlapping, a label on a
 *   node or on a container's name, containers drawn on the same rectangle.
 *
 * Known issues. Diagrams that already had a finding when the checks were added
 * are listed in tests/lib/diagram-kit-known-issues.json, so this test fails only
 * on NEW findings. Each entry is "file | code | subject"; the subject names edges
 * and nodes by id and label, never by pixel values or the diagram title, so an
 * entry survives unrelated edits and retitling. Fix a listed diagram and its
 * entry becomes stale: the test then prints a note (it does not fail) so the
 * entry can be removed.
 *
 *   DIAGRAM_KIT_REPORT=1 npx vitest run tests/lib/diagram-kit-content.test.ts
 *     prints every current finding (file:line, title, message).
 *   UPDATE_DIAGRAM_KIT_KNOWN_ISSUES=1 npx vitest run tests/lib/diagram-kit-content.test.ts
 *     rewrites the known-issues list from the current findings.
 */
import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { layoutGridDiagram, layoutSequence, type GridDiagramSpec, type SequenceSpec } from '@/components/visual-system/diagram-layout';

const ROOT = process.cwd();
const CURRICULUM = path.join(ROOT, 'content', 'curriculum');
const KNOWN_ISSUES_FILE = path.join(ROOT, 'tests', 'lib', 'diagram-kit-known-issues.json');
const KIT = new Set(['ArchitectureDiagram', 'SequenceDiagram']);
/** Props the layout needs; caption (often JSX) and className are not evaluated. */
const LAYOUT_PROPS = new Set(['title', 'nodes', 'ports', 'edges', 'cellWidth', 'cellHeight', 'gapX', 'gapY', 'spreadAnchors', 'participants', 'messages', 'columnWidth', 'numbered']);

type MdxNode = {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdxNode[];
  children?: MdxNode[];
  position?: { start: { line: number } };
};

interface KitDiagram {
  file: string;
  line: number;
  component: string;
  props: Record<string, unknown>;
  error?: string;
}

interface KitFinding {
  file: string;
  line: number;
  title: string;
  code: string;
  key: string;
  message: string;
}

function mdxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdxFiles(full));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out.sort();
}

const parser = unified().use(remarkParse).use(remarkMdx);

/** Evaluates a prop expression; lesson diagram props are literal data (arrays, objects, numbers, strings). */
function evaluate(code: string): unknown {
  return new Function(`"use strict"; return (${code});`)();
}

/** Every kit diagram in one MDX file, with its layout props evaluated. */
function extractKitDiagrams(file: string): KitDiagram[] {
  const raw = fs.readFileSync(file, 'utf8');
  const body = matter(raw).content;
  const offset = body.length ? raw.slice(0, raw.length - body.length).split('\n').length - 1 : 0;
  const rel = path.relative(ROOT, file);
  let tree: MdxNode;
  try {
    tree = parser.parse(body) as unknown as MdxNode;
  } catch {
    return []; // MDX syntax errors are check-mdx's and the render smoke test's job.
  }
  const out: KitDiagram[] = [];
  const visit = (node: MdxNode) => {
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name && KIT.has(node.name)) {
      const diagram: KitDiagram = { file: rel, line: (node.position?.start.line ?? 0) + offset, component: node.name, props: {} };
      for (const attr of node.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute') {
          diagram.error = 'spread attributes ({...x}) cannot be checked';
          continue;
        }
        const name = String(attr.name);
        if (!LAYOUT_PROPS.has(name)) continue;
        const value = attr.value as string | null | { type: string; value: string };
        if (value === null || value === undefined) diagram.props[name] = true;
        else if (typeof value === 'string') diagram.props[name] = value;
        else {
          try {
            diagram.props[name] = evaluate(value.value);
          } catch (error) {
            diagram.error = `prop ${name} is not literal data: ${(error as Error).message}`;
          }
        }
      }
      out.push(diagram);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return out;
}

/** Runs one diagram through the kit's layout and returns its data errors and geometry warnings. */
function checkKitDiagram(d: KitDiagram): KitFinding[] {
  const title = typeof d.props.title === 'string' ? d.props.title : '(untitled)';
  const finding = (code: string, subject: string, message: string): KitFinding => ({
    file: d.file,
    line: d.line,
    title,
    code,
    key: `${d.file} | ${code} | ${subject}`,
    message,
  });
  if (d.error) return [finding('unreadable', d.error, d.error)];
  if (d.component === 'ArchitectureDiagram') {
    const layout = layoutGridDiagram(d.props as unknown as GridDiagramSpec);
    return [...layout.problems.map((p) => finding('data-error', p, p)), ...layout.warnings.map((w) => finding(w.code, w.subject, w.message))];
  }
  const layout = layoutSequence(d.props as unknown as SequenceSpec);
  return layout.problems.map((p) => finding('data-error', p, p));
}

function readKnownIssues(): Set<string> {
  if (!fs.existsSync(KNOWN_ISSUES_FILE)) return new Set();
  const data = JSON.parse(fs.readFileSync(KNOWN_ISSUES_FILE, 'utf8')) as { issues?: string[] };
  return new Set(data.issues ?? []);
}

function writeKnownIssues(keys: string[]) {
  const data = {
    about:
      'Diagram-kit findings that already existed when the geometry checks were added. tests/lib/diagram-kit-content.test.ts fails only on findings not listed here. Remove an entry when its diagram is fixed. Format: file | code | subject.',
    issues: [...new Set(keys)].sort(),
  };
  fs.writeFileSync(KNOWN_ISSUES_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

const format = (f: KitFinding) => `${f.file}:${f.line} "${f.title}" [${f.code}] ${f.message}`;

describe('diagram kit across lessons', () => {
  const diagrams = mdxFiles(CURRICULUM).flatMap(extractKitDiagrams);
  const findings = diagrams.flatMap(checkKitDiagram);

  it('reads every ArchitectureDiagram and SequenceDiagram from the lesson MDX', () => {
    expect(diagrams.filter((d) => d.component === 'ArchitectureDiagram').length).toBeGreaterThan(0);
    expect(diagrams.filter((d) => d.component === 'SequenceDiagram').length).toBeGreaterThan(0);
    for (const d of diagrams) expect(typeof d.props.title, `${d.file}:${d.line} has no literal title`).toBe('string');
  });

  it('has no layout problem or geometry warning outside the known-issues list', () => {
    if (process.env.UPDATE_DIAGRAM_KIT_KNOWN_ISSUES) writeKnownIssues(findings.map((f) => f.key));
    if (process.env.DIAGRAM_KIT_REPORT) {
      console.log(`${findings.length} finding(s) in ${diagrams.length} kit diagram(s):\n${findings.map(format).join('\n')}`);
    }
    const known = readKnownIssues();
    const current = new Set(findings.map((f) => f.key));
    const stale = [...known].filter((k) => !current.has(k));
    if (stale.length) {
      console.info(`diagram-kit-known-issues.json: ${stale.length} entr${stale.length === 1 ? 'y is' : 'ies are'} fixed and can be removed:\n${stale.join('\n')}`);
    }
    const fresh = findings.filter((f) => !known.has(f.key));
    expect(
      fresh.map(format),
      `${fresh.length} new diagram finding(s). Fix the diagram (the message says how), or, only for a deliberate exception, add its key to tests/lib/diagram-kit-known-issues.json:\n${fresh.map((f) => `${format(f)}\n  key: ${f.key}`).join('\n')}`,
    ).toEqual([]);
  });
});
