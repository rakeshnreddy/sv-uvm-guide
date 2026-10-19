import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { hasDeckLoader, listLoadableDeckIds, loadDeck } from "@/lib/flashcard-deck-loaders";
import flashcardDecks, {
  canonicalDeckId,
  deckAliases,
  getDeckCards,
  listCanonicalDeckIds,
  type RawFlashcard,
} from "@/lib/flashcard-decks";

function lessonFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? lessonFiles(full) : e.name.endsWith(".mdx") ? [full] : [];
  });
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(full) : /\.(ts|tsx|js|jsx|mjs)$/.test(e.name) ? [full] : [];
  });
}

/** True when the module starts with the 'use client' directive (after any leading comments). */
function isClientModule(source: string): boolean {
  let rest = source.trimStart();
  for (;;) {
    if (rest.startsWith("//")) rest = rest.slice(rest.indexOf("\n") + 1 || rest.length).trimStart();
    else if (rest.startsWith("/*")) rest = rest.slice(rest.indexOf("*/") + 2 || rest.length).trimStart();
    else break;
  }
  return /^['"]use client['"]/.test(rest);
}

function frontmatterDeck(file: string): string | undefined {
  const front = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return front.match(/^(?:flashcards|flashcardId):\s*"?([^"\n]+)"?/m)?.[1]?.trim();
}

const canonicalIds = listCanonicalDeckIds();
const aliasIds = Object.keys(deckAliases);

describe("flashcard registry", () => {
  it("resolves every lesson's flashcards / flashcardId frontmatter to a non-empty deck", () => {
    const unresolved: string[] = [];
    for (const file of lessonFiles("content/curriculum")) {
      const id = frontmatterDeck(file);
      if (id && !(flashcardDecks[id]?.length > 0)) unresolved.push(`${file}: ${id}`);
      if (id && !((getDeckCards(id)?.cards.length ?? 0) > 0)) unresolved.push(`${file}: ${id} (getDeckCards)`);
    }
    expect(unresolved).toEqual([]);
  });

  it("registers every deck file under content/flashcards", () => {
    const registered = new Set(Object.values(flashcardDecks));
    const orphans = fs
      .readdirSync("content/flashcards")
      .filter((f) => f.endsWith(".json"))
      .filter((f) => {
        const cards = JSON.parse(fs.readFileSync(path.join("content/flashcards", f), "utf8"));
        return ![...registered].some((deck) => JSON.stringify(deck) === JSON.stringify(cards));
      });
    expect(orphans).toEqual([]);
  });

  it("gives every card in every deck an explicit id that is unique across decks", () => {
    const owners = new Map<string, string>();
    const problems: string[] = [];
    for (const deckId of canonicalIds) {
      flashcardDecks[deckId].forEach((card: RawFlashcard, index: number) => {
        if (typeof card.id !== "string" || card.id.trim().length === 0) {
          problems.push(`${deckId} card ${index} has no explicit id`);
          return;
        }
        const owner = owners.get(card.id);
        if (owner) problems.push(`${card.id} is in both ${owner} and ${deckId}`);
        owners.set(card.id, deckId);
      });
    }
    expect(problems).toEqual([]);
    expect(owners.size).toBe(canonicalIds.reduce((total, id) => total + flashcardDecks[id].length, 0));
  });

  it("gives the A-UVM-1/2/3 cards their stable ids in file order", () => {
    const decks = ["A-UVM-1_Advanced_Sequencing", "A-UVM-2_The_UVM_Factory", "A-UVM-3_Advanced_UVM_Techniques"];
    decks.forEach((deckId, deckIndex) => {
      const ids = getDeckCards(deckId)?.cards.map((card) => card.id);
      expect(ids).toEqual(Array.from({ length: 10 }, (_, index) => `auvm${deckIndex + 1}-${index + 1}`));
    });
  });

  it("lists canonical deck ids without the aliases, and resolves aliases to them", () => {
    expect(canonicalIds).toHaveLength(new Set(canonicalIds).size);
    expect(aliasIds.length).toBeGreaterThan(0);
    for (const alias of aliasIds) {
      expect(canonicalIds).not.toContain(alias);
      const target = deckAliases[alias];
      expect(canonicalDeckId(alias)).toBe(target);
      const resolved = getDeckCards(alias);
      expect(resolved?.deckId).toBe(target);
      // Aliases share the canonical deck's cards, so they share card ids.
      expect(resolved?.cards.map((card) => card.id)).toEqual(getDeckCards(target)?.cards.map((card) => card.id));
      expect(flashcardDecks[alias]).toBe(flashcardDecks[target]);
    }
    expect(canonicalDeckId("No_Such_Deck")).toBeNull();
    expect(getDeckCards("No_Such_Deck")).toBeNull();
  });

  it("serves each deck as {id, front, back} cards matching the registry", () => {
    for (const deckId of canonicalIds) {
      const deck = getDeckCards(deckId);
      expect(deck?.deckId).toBe(deckId);
      expect(deck?.cards).toEqual(
        flashcardDecks[deckId].map((card: RawFlashcard) => ({
          id: card.id,
          front: card.question ?? card.front,
          back: card.answer ?? card.back,
        })),
      );
      for (const card of deck?.cards ?? []) {
        expect(card.front.length, `${deckId} ${card.id} front`).toBeGreaterThan(0);
        expect(card.back.length, `${deckId} ${card.id} back`).toBeGreaterThan(0);
      }
    }
  });

  it("has one client loader per canonical deck that loads the same cards", async () => {
    expect([...listLoadableDeckIds()].sort()).toEqual([...canonicalIds].sort());
    for (const alias of aliasIds) expect(hasDeckLoader(alias)).toBe(false);
    expect(await loadDeck("No_Such_Deck")).toBeNull();
    const loaded = await Promise.all(canonicalIds.map((deckId) => loadDeck(deckId)));
    loaded.forEach((deck, index) => {
      expect(deck).toEqual(getDeckCards(canonicalIds[index]));
    });
  });

  it("keeps the deck registry out of client modules", () => {
    const offenders = sourceFiles("src").filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      if (!isClientModule(source)) return false;
      return /(?:from\s+|import\s*\(\s*)['"](?:@\/lib\/flashcard-decks|[./]+(?:lib\/)?flashcard-decks)['"]/.test(source);
    });
    expect(offenders).toEqual([]);
    // The build itself rejects a client import: the registry carries the 'server-only' marker.
    expect(fs.readFileSync("src/lib/flashcard-decks.ts", "utf8")).toMatch(/^import ['"]server-only['"];$/m);
    // The lesson widget and the review page get plain cards instead.
    const widget = fs.readFileSync("src/components/widgets/FlashcardWidget.tsx", "utf8");
    const review = fs.readFileSync("src/app/(learning)/dashboard/review/ReviewPageClient.tsx", "utf8");
    expect(widget).not.toMatch(/flashcard-decks['"]/);
    expect(review).not.toMatch(/flashcard-decks['"]/);
  });

  it("keeps the declarations scripts/check-mdx.mjs parses", () => {
    const source = fs.readFileSync("src/lib/flashcard-decks.ts", "utf8");
    const decks = source.match(/export const flashcardDecks[^=]*=\s*\{([\s\S]*?)\n\};/);
    const aliases = source.match(/const deckAliases[^=]*=\s*\{([\s\S]*?)\n\};/);
    expect(decks?.index).toBe(source.indexOf("export const flashcardDecks"));
    const parsed = new Set<string>();
    for (const line of decks?.[1].split("\n") ?? []) {
      const quoted = line.match(/^\s*'([^']+)'\s*:/) || line.match(/^\s*"([^"]+)"\s*:/);
      const bare = line.match(/^\s*([A-Za-z0-9_]+)\s*(?:,|:)/);
      if (quoted) parsed.add(quoted[1]);
      else if (bare) parsed.add(bare[1]);
    }
    expect([...parsed].sort()).toEqual([...canonicalIds].sort());
    expect([...(aliases?.[1].matchAll(/'([^']+)'\s*:/g) ?? [])].map((match) => match[1])).toEqual(aliasIds);
  });
});
