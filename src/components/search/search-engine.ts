/**
 * Client-side curriculum search over the index written by
 * scripts/generate-search-index.mjs. Pure functions, no dependencies:
 * tokenized prefix matching with field weights, ranked, then capped per
 * lesson so one long page cannot fill the list.
 */
import { headingSlug, isExpertHeading } from "@/lib/heading-slug";

/** `[text, depth]`, or `[text, depth, anchor]` when the anchor is not `headingSlug(text)`. */
export type SearchIndexHeading = [text: string, depth: number, anchor?: string];

export interface SearchIndexLesson {
  slug: string;
  title: string;
  description: string;
  headings: SearchIndexHeading[];
}

export interface SearchIndexModule {
  /** Module folder, for example "I-SV-5_Synchronization_and_IPC". */
  id: string;
  title: string;
  track: "core" | "elective";
  lessons: SearchIndexLesson[];
}

export interface SearchIndexTier {
  /** Tier folder, for example "T2_Intermediate". */
  id: string;
  title: string;
  modules: SearchIndexModule[];
}

export interface SearchIndexData {
  version: number;
  tiers: SearchIndexTier[];
}

export type SearchResultKind = "lesson" | "section";

interface SearchField {
  text: string;
  tokens: string[];
  tokenSet: Set<string>;
  weight: number;
}

export interface SearchDocument {
  /** Unique within the index: the href. */
  id: string;
  kind: SearchResultKind;
  /** Canonical lesson URL, plus `#anchor` for a section. */
  href: string;
  lessonHref: string;
  /** What the result is called: the lesson title, or the heading text. */
  title: string;
  lessonTitle: string;
  /** Module code, for example "I-SV-5". */
  code: string;
  moduleTitle: string;
  tierTitle: string;
  track: "core" | "elective";
  description?: string;
  /** Heading level (2 or 3) for sections. */
  depth?: number;
  anchor?: string;
  /** An `### Expert: …` heading. */
  expert: boolean;
  /** Position in the curriculum, for stable tie-breaking. */
  order: number;
  /** fields[0] is the title (lessons) or the heading text (sections). */
  fields: SearchField[];
  plainTitle: string;
  compactCode: string;
  /** A template heading every lesson shares (Quick Take, Quiz, …). */
  generic: boolean;
}

export interface SearchResult {
  doc: SearchDocument;
  score: number;
}

export const MIN_QUERY_LENGTH = 2;
export const DEFAULT_RESULT_LIMIT = 12;
const MAX_RESULTS_PER_LESSON = 3;

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "vs", "is", "are", "how", "what", "why",
]);

/** Template headings every lesson shares; they stay searchable but rank below specific headings. */
const GENERIC_HEADINGS = new Set([
  "quick take",
  "build your mental model",
  "make it work",
  "push further",
  "practice & reinforce",
  "references & next topics",
  "references",
  "quiz",
  "summary",
  "interview questions",
  "knowledge check",
  "retrieval check",
  "flashcards",
]);

/** The canonical lesson URL (spine §5.9): exact folder case, `index` for module pages. */
export function lessonHref(tierId: string, moduleId: string, lessonSlug: string): string {
  return `/curriculum/${tierId}/${moduleId}/${lessonSlug}`;
}

/** The anchor the lesson page gives a heading. */
export function headingAnchor(heading: SearchIndexHeading): string {
  return heading[2] ?? headingSlug(heading[0]);
}

/** "I-SV-5_Synchronization_and_IPC" → "I-SV-5". */
export function moduleCode(moduleId: string): string {
  return moduleId.split("_")[0] ?? moduleId;
}

/** Strips the legacy " | Series name" suffix some lesson titles still carry. */
export function displayLessonTitle(title: string): string {
  return title.replace(/\s+\|\s+[^|]+$/, "").trim();
}

/** "I-SV-5: Synchronization and IPC" → "Synchronization and IPC". */
export function stripModuleCode(title: string, code: string): string {
  const prefix = `${code}:`;
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title;
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Words, keeping SystemVerilog identifiers whole: "uvm_config_db", "$cast". */
export function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value).split(/[^a-z0-9_$]+/).filter(Boolean);
}

/** "uvm_config_db" → ["uvm", "config", "db"]; "$cast" → ["cast"]. */
function identifierParts(token: string): string[] {
  return token.split(/[_$]+/).filter(Boolean);
}

/** Index tokens: every word, plus the parts of each identifier, so "config db" finds "uvm_config_db". */
function indexTokens(value: string): string[] {
  const tokens: string[] = [];
  for (const token of tokenizeSearchText(value)) {
    tokens.push(token);
    const parts = identifierParts(token);
    if (parts.length > 1 || (parts.length === 1 && parts[0] !== token)) tokens.push(...parts);
  }
  return tokens;
}

function compact(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
}

function field(value: string, weight: number): SearchField {
  const tokens = indexTokens(value);
  return { text: normalizeSearchText(value), tokens, tokenSet: new Set(tokens), weight };
}

function codeField(code: string, weight: number): SearchField {
  const base = field(code.replace(/-/g, " "), weight);
  const compactCode = compact(code);
  if (compactCode && !base.tokenSet.has(compactCode)) {
    base.tokens.push(compactCode);
    base.tokenSet.add(compactCode);
  }
  return base;
}

/** Title without a module code or a "3." section number, for "starts with" boosts. */
function plain(title: string): string {
  return normalizeSearchText(title)
    .replace(/^[a-z]+(?:-[a-z0-9]+)*-?[0-9][a-z0-9-]*:\s*/, "")
    .replace(/^\d+(?:\.\d+)*\.?\s+/, "")
    .trim();
}

/** Flattens the index into one document per lesson and one per H2/H3 heading, in curriculum order. */
export function prepareSearchDocuments(index: SearchIndexData): SearchDocument[] {
  const docs: SearchDocument[] = [];
  let order = 0;

  for (const tier of index.tiers) {
    for (const mod of tier.modules) {
      const code = moduleCode(mod.id);
      const compactCode = compact(code);
      const moduleTitle = displayLessonTitle(mod.title);

      for (const lesson of mod.lessons) {
        const href = lessonHref(tier.id, mod.id, lesson.slug);
        const lessonTitle = displayLessonTitle(lesson.title);

        docs.push({
          id: href,
          kind: "lesson",
          href,
          lessonHref: href,
          title: lessonTitle,
          lessonTitle,
          code,
          moduleTitle,
          tierTitle: tier.title,
          track: mod.track,
          description: lesson.description,
          expert: false,
          order: order++,
          fields: [field(lessonTitle, 12), field(lesson.description, 5), field(moduleTitle, 4), codeField(code, 3)],
          plainTitle: plain(lessonTitle),
          compactCode,
          generic: false,
        });

        for (const heading of lesson.headings) {
          const [text, depth] = heading;
          const anchor = headingAnchor(heading);
          docs.push({
            id: `${href}#${anchor}`,
            kind: "section",
            href: `${href}#${anchor}`,
            lessonHref: href,
            title: text,
            lessonTitle,
            code,
            moduleTitle,
            tierTitle: tier.title,
            track: mod.track,
            depth,
            anchor,
            expert: isExpertHeading(text),
            order: order++,
            fields: [field(text, 8), field(lessonTitle, 3), field(moduleTitle, 2), codeField(code, 3)],
            plainTitle: plain(text),
            compactCode,
            generic: GENERIC_HEADINGS.has(normalizeSearchText(text).trim()),
          });
        }
      }
    }
  }

  return docs;
}

/** The token and its singular forms: "mailboxes" → mailboxes, mailboxe, mailbox. */
function stems(token: string): string[] {
  const forms = [token];
  if (token.length >= 4 && token.endsWith("s")) forms.push(token.slice(0, -1));
  if (token.length >= 5 && token.endsWith("es")) forms.push(token.slice(0, -2));
  if (token.length >= 5 && token.endsWith("ies")) forms.push(`${token.slice(0, -3)}y`);
  return forms;
}

function wordMatch(token: string, target: SearchField): number {
  if (target.tokenSet.has(token)) return 1;
  if (token.length >= 2 && target.tokens.some((candidate) => candidate.startsWith(token))) return 0.75;
  for (const stem of stems(token).slice(1)) {
    if (target.tokenSet.has(stem)) return 0.9;
    if (stem.length >= 3 && target.tokens.some((candidate) => candidate.startsWith(stem))) return 0.7;
  }
  // Inside-word matches only for longer words, so "ral" does not match "procedural".
  if (token.length >= 4 && target.text.includes(token)) return 0.4;
  return 0;
}

/** How well one query word matches one field, 0 to 1. Identifiers fall back to their parts. */
function matchQuality(token: string, target: SearchField): number {
  const whole = wordMatch(token, target);
  if (whole > 0) return whole;
  const parts = identifierParts(token);
  if (parts.length < 2) return 0;
  let worst = 1;
  for (const part of parts) {
    const quality = wordMatch(part, target);
    if (quality === 0) return 0;
    worst = Math.min(worst, quality);
  }
  return worst * 0.9;
}

/**
 * Ranks documents for a query. Every meaningful query word must match some
 * field (title or heading, description, module title or code); stop words are
 * ignored unless the query has nothing else. A section must match at least one
 * word in its own heading, so a matching lesson does not drag in all of its
 * headings.
 */
export function searchCurriculum(
  docs: readonly SearchDocument[],
  rawQuery: string,
  limit = DEFAULT_RESULT_LIMIT,
): SearchResult[] {
  const query = normalizeSearchText(rawQuery).replace(/\s+/g, " ").trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const allTokens = tokenizeSearchText(query);
  const meaningful = allTokens.filter((token) => !STOP_WORDS.has(token));
  const tokens = meaningful.length > 0 ? meaningful : allTokens;
  if (tokens.length === 0) return [];

  const compactQuery = compact(query);
  const phrase = tokens.join(" ");
  const scored: SearchResult[] = [];

  for (const doc of docs) {
    let score = 0;
    let matchedEveryToken = true;
    let matchedOwnText = false;
    for (const token of tokens) {
      let best = 0;
      for (const target of doc.fields) {
        const value = matchQuality(token, target) * target.weight;
        if (value > best) best = value;
      }
      if (best === 0) {
        matchedEveryToken = false;
        break;
      }
      if (matchQuality(token, doc.fields[0]) > 0) matchedOwnText = true;
      score += best;
    }
    if (!matchedEveryToken) continue;
    if (doc.kind === "section" && !matchedOwnText) continue;

    if (compactQuery.length >= 2 && compactQuery === doc.compactCode) score += 30;
    if (tokens.length > 1 && doc.fields[0].text.includes(phrase)) score += 6;
    if (doc.plainTitle.startsWith(phrase)) score += 3;
    if (doc.plainTitle === phrase) score += 4;
    if (doc.kind === "lesson") score += 1.5;
    else if (doc.depth === 2) score += 0.5;
    if (doc.generic) score -= 2;

    scored.push({ doc, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.doc.kind === b.doc.kind ? 0 : a.doc.kind === "lesson" ? -1 : 1) ||
      a.doc.order - b.doc.order,
  );

  const perLesson = new Map<string, number>();
  const results: SearchResult[] = [];
  for (const result of scored) {
    const seen = perLesson.get(result.doc.lessonHref) ?? 0;
    if (seen >= MAX_RESULTS_PER_LESSON) continue;
    perLesson.set(result.doc.lessonHref, seen + 1);
    results.push(result);
    if (results.length >= limit) break;
  }
  return results;
}

/** A short line that says where a result lives in the curriculum. */
export function describeResult(doc: SearchDocument): string {
  const elective = doc.track === "elective" ? " · Elective" : "";
  if (doc.kind === "section") {
    return `${doc.lessonTitle} · ${doc.code}${elective}`;
  }
  const moduleName = stripModuleCode(doc.moduleTitle, doc.code);
  const lessonName = stripModuleCode(doc.title, doc.code);
  const where = lessonName === moduleName ? doc.code : `${doc.code}: ${moduleName}`;
  return `${where} · ${doc.tierTitle}${elective}`;
}

/** The visible badge for a result; text, so it never relies on colour. */
export function resultKindLabel(doc: SearchDocument): string {
  if (doc.kind === "lesson") return "Lesson";
  return doc.expert ? "Expert" : "Section";
}
