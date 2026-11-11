import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import HistoryPage, { metadata } from "@/app/(learning)/history/page";
import {
  HISTORY_ERAS,
  HISTORY_EVENTS,
  HISTORY_SOURCES,
  KEYWORD_EDITIONS,
  historySourceById,
} from "@/app/(learning)/history/history-timeline";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderPage(): string {
  return renderToStaticMarkup(<HistoryPage />);
}

/** The visible text, without tags. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("/history data", () => {
  it("gives every event a valid date, at least one known source, and a what and a why", () => {
    for (const event of HISTORY_EVENTS) {
      expect(event.date, event.id).toMatch(/^\d{4}(-\d{2}(-\d{2})?)?$/);
      expect(event.sources.length, event.id).toBeGreaterThan(0);
      for (const id of event.sources) {
        expect(historySourceById(id), `${event.id} cites unknown source ${id}`).toBeDefined();
      }
      expect(event.what.length, event.id).toBeGreaterThan(40);
      expect(event.why.length, event.id).toBeGreaterThan(40);
    }
  });

  it("puts every event in exactly one era, in date order", () => {
    const placed = HISTORY_ERAS.flatMap((era) => era.events);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(HISTORY_EVENTS.map((event) => event.id).sort());

    const dates = placed.map((id) => HISTORY_EVENTS.find((event) => event.id === id)!.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("cites every source at least once, with unique ids and https links", () => {
    const cited = new Set(HISTORY_EVENTS.flatMap((event) => event.sources));
    expect(new Set(HISTORY_SOURCES.map((source) => source.id)).size).toBe(HISTORY_SOURCES.length);
    for (const source of HISTORY_SOURCES) {
      expect(cited.has(source.id), `${source.id} is never cited`).toBe(true);
      if (source.url) expect(source.url, source.id).toMatch(/^https:\/\//);
    }
  });

  it("pins the IEEE board approval dates read from the IEEE SA pages", () => {
    const dateOf = (id: string) => HISTORY_EVENTS.find((event) => event.id === id)?.date;
    expect(dateOf("ieee-1364-1995")).toBe("1995-12-12");
    expect(dateOf("ieee-1364-2001")).toBe("2001-03-17");
    expect(dateOf("ieee-2005")).toBe("2005-11-08");
    expect(dateOf("ieee-1800-2009")).toBe("2009-11-09");
    expect(dateOf("ieee-1800-2012")).toBe("2012-12-05");
    expect(dateOf("ieee-1800-2-2017")).toBe("2017-02-14");
    expect(dateOf("ieee-1800-2017")).toBe("2017-12-06");
    expect(dateOf("ieee-1800-2-2020")).toBe("2020-06-04");
    expect(dateOf("ieee-1800-2023")).toBe("2023-12-06");
    expect(dateOf("uvm-10")).toBe("2011-02-21");
  });

  it("lists the reserved words from IEEE 1800-2023 Tables 22-3 and 22-6 completely", () => {
    expect(KEYWORD_EDITIONS.find((edition) => edition.edition === "IEEE 1364-2005")?.examples).toEqual(["uwire"]);
    expect(KEYWORD_EDITIONS.find((edition) => edition.edition === "IEEE 1800-2012")?.examples).toEqual([
      "implements",
      "interconnect",
      "nettype",
      "soft",
    ]);
  });
});

describe("/history page", () => {
  it("is a real page with no placeholder text and no draft gate", () => {
    const html = renderPage();
    expect(html).not.toContain("Placeholder");
    expect(html).not.toContain("from blueprint");
    expect(html).not.toContain("Loading visualization");
    expect(html).toMatch(/<h1[^>]*>History of SystemVerilog and UVM<\/h1>/);
  });

  it("has metadata", () => {
    // The nav label (site-links.ts); the h1 is longer and starts with it.
    expect(metadata.title).toBe("History");
    expect(String(metadata.description)).toMatch(/IEEE 1800\.2/);
  });

  it("renders one timeline entry per event, each with a time element and a point marker", () => {
    const html = renderPage();
    expect(html).toContain('data-testid="history-timeline-chart"');
    expect(html.match(/data-testid="history-event"/g)?.length).toBe(HISTORY_EVENTS.length);
    expect(html.match(/data-role="timeline-point"/g)?.length).toBe(HISTORY_EVENTS.length);
    for (const event of HISTORY_EVENTS) {
      expect(html, event.id).toContain(`<time dateTime="${event.date}"`);
    }
  });

  it("states lane and publisher as text, not only colour", () => {
    const text = textOf(renderPage());
    for (const phrase of ["Language", "Methodology", "IEEE standard", "Accellera", "Vendor release", "Why:"]) {
      expect(text, phrase).toContain(phrase);
    }
  });

  it("links every in-text citation to a reference that exists", () => {
    const html = renderPage();
    const anchors = new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map((match) => match[1]));
    expect(anchors.size).toBe(HISTORY_SOURCES.length);
    for (const [, target] of html.matchAll(/href="#(source-[^"]+)"/g)) {
      expect(anchors.has(target), target).toBe(true);
    }
    for (const source of HISTORY_SOURCES) {
      if (source.url) expect(html).toContain(`href="${source.url}"`);
    }
  });

  it("covers the path to SystemVerilog and to UVM", () => {
    const text = textOf(renderPage());
    for (const phrase of [
      "IEEE 1364-1995",
      "Superlog",
      "OpenVera",
      "SystemVerilog 3.1a",
      "IEEE 1800-2005",
      "IEEE 1800-2009",
      "IEEE 1800-2012",
      "IEEE 1800-2017",
      "IEEE 1800-2023",
      "IEEE 1647",
      "VMM",
      "AVM",
      "OVM",
      "UVM 1.0",
      "UVM 1.1",
      "UVM 1.2",
      "IEEE 1800.2-2017",
      "IEEE 1800.2-2020",
      "uvm-core",
    ]) {
      expect(text, phrase).toContain(phrase);
    }
  });

  it("links the curriculum", () => {
    expect(renderPage()).toContain('href="/curriculum"');
  });
});
