import { describe, expect, it } from "vitest";

import {
  READING_LINE_PX,
  activeHeadingIndex,
  groupHolding,
  groupTocEntries,
  isGroupOpen,
  readingProgress,
  scrollTopToReveal,
} from "@/components/curriculum/lesson-reading";
import type { TocEntry } from "@/lib/curriculum/remark-heading-ids";

const entry = (id: string, depth: 2 | 3): TocEntry => ({ id, text: id, depth, expert: false });

describe("activeHeadingIndex", () => {
  it("is -1 until the first heading passes the reading line", () => {
    expect(activeHeadingIndex([400, 900], { viewportHeight: 800 })).toBe(-1);
  });

  it("is the last heading whose top has passed the line, scrolling down or up", () => {
    expect(activeHeadingIndex([-500, 40, READING_LINE_PX, 600], { viewportHeight: 800 })).toBe(2);
    expect(activeHeadingIndex([-500, 300, 900], { viewportHeight: 800 })).toBe(0);
  });

  it("lets a short final section become current at the bottom of the page", () => {
    expect(activeHeadingIndex([-500, 300, 650], { viewportHeight: 800, atBottom: true })).toBe(2);
    expect(activeHeadingIndex([-500, 300, 900], { viewportHeight: 800, atBottom: true })).toBe(1);
  });
});

describe("readingProgress", () => {
  it("is 0 before the article reaches the header and 1 once its end is on screen", () => {
    expect(readingProgress({ top: 200, height: 3000 }, 900, 64)).toBe(0);
    expect(readingProgress({ top: 64, height: 3000 }, 900, 64)).toBe(0);
    expect(readingProgress({ top: 64 - (3000 - 836), height: 3000 }, 900, 64)).toBe(1);
    expect(readingProgress({ top: -10000, height: 3000 }, 900, 64)).toBe(1);
  });

  it("grows in proportion in between", () => {
    expect(readingProgress({ top: 64 - 1082, height: 3000 }, 900, 64)).toBeCloseTo(0.5, 5);
  });

  it("treats an article shorter than the viewport as read once it passes the header", () => {
    expect(readingProgress({ top: 100, height: 300 }, 900, 64)).toBe(0);
    expect(readingProgress({ top: 50, height: 300 }, 900, 64)).toBe(1);
  });
});

describe("table of contents groups", () => {
  const entries = [entry("h3-first", 3), entry("a", 2), entry("a1", 3), entry("a2", 3), entry("b", 2), entry("c", 2), entry("c1", 3)];
  const groups = groupTocEntries(entries);

  it("nests each H3 under the H2 before it; an H3 before any H2 stands alone", () => {
    expect(groups.map((group) => [group.entry.id, group.children.map((child) => child.id)])).toEqual([
      ["h3-first", []],
      ["a", ["a1", "a2"]],
      ["b", []],
      ["c", ["c1"]],
    ]);
  });

  it("finds the group holding the current entry", () => {
    expect(groupHolding(groups, "a2")).toBe("a");
    expect(groupHolding(groups, "c")).toBe("c");
    expect(groupHolding(groups, null)).toBeNull();
    expect(groupHolding(groups, "missing")).toBeNull();
  });

  it("opens only the holding group unless the reader chose otherwise", () => {
    expect(isGroupOpen("a", "a", {})).toBe(true);
    expect(isGroupOpen("c", "a", {})).toBe(false);
    expect(isGroupOpen("c", "a", { c: true })).toBe(true);
    expect(isGroupOpen("a", "a", { a: false })).toBe(false);
  });
});

describe("scrollTopToReveal", () => {
  it("leaves a visible row alone", () => {
    expect(scrollTopToReveal({ top: 120, height: 32 }, { scrollTop: 100, clientHeight: 300 })).toBeNull();
  });

  it("brings a row below or above the box a third of the way down", () => {
    expect(scrollTopToReveal({ top: 600, height: 32 }, { scrollTop: 0, clientHeight: 300 })).toBe(500);
    expect(scrollTopToReveal({ top: 40, height: 32 }, { scrollTop: 200, clientHeight: 300 })).toBe(0);
  });
});
