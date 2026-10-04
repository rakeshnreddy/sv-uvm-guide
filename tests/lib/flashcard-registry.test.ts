import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import flashcardDecks from "@/lib/flashcard-decks";

function lessonFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? lessonFiles(full) : e.name.endsWith(".mdx") ? [full] : [];
  });
}

describe("flashcard registry", () => {
  it("resolves every lesson's flashcards / flashcardId frontmatter to a non-empty deck", () => {
    const unresolved: string[] = [];
    for (const file of lessonFiles("content/curriculum")) {
      const front = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const id = front.match(/^(?:flashcards|flashcardId):\s*"?([^"\n]+)"?/m)?.[1]?.trim();
      if (id && !(flashcardDecks[id]?.length > 0)) unresolved.push(`${file}: ${id}`);
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
});
