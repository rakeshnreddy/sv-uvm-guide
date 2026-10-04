/**
 * Gives every markdown heading of a lesson an `id` and collects the H2/H3
 * entries for the "On this page" list (G30-PAGE-02).
 *
 * Ids come from the shared algorithm in src/lib/heading-slug.ts, applied the
 * same way the search index and the expert index apply it: one slugger per
 * page, fed every markdown heading (any depth, including headings inside JSX
 * blocks) in document order, with the heading's text and inline-code content.
 * Run it before any plugin that rewrites heading text, so the ids match.
 *
 * A node may carry `data.tocEntries` (the practice slot does): those entries
 * join the list at the node's position, without consuming slugs.
 */
import { createSlugger, isExpertHeading } from "@/lib/heading-slug";

export interface TocEntry {
  id: string;
  /** Heading text with whitespace collapsed. */
  text: string;
  depth: 2 | 3;
  /** Expert layer: the Push Further section, a subsection of it, or an "Expert: …" heading. */
  expert: boolean;
}

/** The minimal mdast shape headingText reads. */
export interface TextNode {
  type: string;
  value?: string;
  children?: TextNode[];
}

interface AstNode {
  type: string;
  depth?: number;
  value?: string;
  children?: AstNode[];
  data?: {
    hProperties?: Record<string, unknown>;
    tocEntries?: TocEntry[];
    [key: string]: unknown;
  };
}

const SKIPPED_INLINE = new Set(["image", "imageReference", "break", "mdxTextExpression", "mdxFlowExpression"]);
const PUSH_FURTHER = /^push further\b/i;

/** The text a rendered heading reads: text and inline code, without images or expressions. */
export function headingText(node: TextNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (SKIPPED_INLINE.has(node.type)) return "";
  return (node.children ?? []).map(headingText).join("");
}

export interface RemarkHeadingIdsOptions {
  /** Receives the H2 and H3 entries in document order. */
  toc?: TocEntry[];
}

export function remarkHeadingIds(options: RemarkHeadingIdsOptions = {}) {
  const { toc } = options;

  return (tree: AstNode) => {
    const slug = createSlugger();
    let inExpertSection = false;

    const walk = (node: AstNode) => {
      if (node.type === "heading") {
        // Slug the raw text, as the search and expert indexes do; collapse it only for display.
        const raw = headingText(node);
        const text = raw.replace(/\s+/g, " ").trim();
        const generated = slug(raw);
        const existing = node.data?.hProperties?.id;
        const id = typeof existing === "string" && existing.length > 0 ? existing : generated;
        node.data = { ...node.data, hProperties: { ...(node.data?.hProperties ?? {}), id } };

        const depth = node.depth ?? 0;
        if (depth <= 2) inExpertSection = depth === 2 && PUSH_FURTHER.test(text);
        if (toc && text && (depth === 2 || depth === 3)) {
          toc.push({ id, text, depth, expert: inExpertSection || isExpertHeading(text) });
        }
        return;
      }

      if (toc && Array.isArray(node.data?.tocEntries)) toc.push(...node.data.tocEntries);
      node.children?.forEach(walk);
    };

    walk(tree);
  };
}
