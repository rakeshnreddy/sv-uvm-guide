import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section } from "@/components/layout/Section";
import { PAGE_SHELL_CLASS } from "@/components/layout/PageShell";
import { InfoPage, infoPageProseClass, infoSectionId } from "@/components/templates/InfoPage";
import { PROSE_CLASS } from "@/components/ui/Prose";

describe("InfoPage", () => {
  it("renders on PageShell and PageHeader: unboxed, one h1, the lead, a hairline, no card", () => {
    const { container } = render(
      <InfoPage title="Projects" description="One project per milestone.">
        <p>Body text.</p>
      </InfoPage>,
    );
    const root = screen.getByTestId("info-page");
    expect(root).toHaveAttribute("data-page-shell");
    // The standalone frame (public layout) that a page frame undoes (learning layout).
    for (const token of PAGE_SHELL_CLASS.split(" ")) expect(root).toHaveClass(token);
    expect(root).toHaveAttribute("data-width", "content");
    expect(root.querySelector("[data-page-shell-inner]")).toHaveClass("max-w-6xl");
    expect(container.querySelector(".bg-card")).toBeNull();
    expect(container.querySelector(".shadow-card")).toBeNull();

    const heading = screen.getByRole("heading", { level: 1, name: "Projects" });
    expect(heading).toHaveClass("text-h1", "text-foreground");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const lead = screen.getByText("One project per milestone.");
    expect(lead).toHaveAttribute("data-page-header-lead");
    expect(lead).toHaveClass("text-lead", "text-muted-foreground", "max-w-[27.5em]");
    expect(heading.closest("header")).toHaveClass("border-b", "border-border");
  });

  it("takes the reading and wide widths, and never centres its content inside the page frame", () => {
    const { rerender } = render(<InfoPage width="reading" title="Privacy policy" />);
    const inner = () => screen.getByTestId("info-page").querySelector("[data-page-shell-inner]") as HTMLElement;
    expect(inner()).toHaveClass("max-w-3xl");
    expect(inner()).not.toHaveClass("mx-auto");
    rerender(<InfoPage width="wide" title="Waveform studio" />);
    expect(inner()).toHaveClass("max-w-7xl");
  });

  it("holds running text to the Prose measure and puts charts and diagrams in full-width sections", () => {
    render(
      <InfoPage
        title="Phases"
        charts={[<div key="c" data-testid="chart" />]}
        diagrams={[<div key="d" data-testid="diagram" />]}
      >
        <p>Intro.</p>
      </InfoPage>,
    );
    expect(infoPageProseClass).toBe(PROSE_CLASS);
    const prose = screen.getByText("Intro.").parentElement as HTMLElement;
    expect(prose).toHaveAttribute("data-prose");
    expect(prose.className).toBe(infoPageProseClass);
    expect(infoPageProseClass).toContain("[&>p]:max-w-[30em]");

    const charts = screen.getByRole("region", { name: "Charts and visualizations" });
    const diagrams = screen.getByRole("region", { name: "Diagrams and illustrations" });
    expect(charts).toHaveClass("not-prose");
    expect(charts).toContainElement(screen.getByTestId("chart"));
    expect(diagrams).toContainElement(screen.getByTestId("diagram"));
    for (const name of ["Charts and visualizations", "Diagrams and illustrations"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toHaveClass("text-h2");
    }
    // The body and the slots are stacked 48 px apart.
    expect(charts.parentElement).toHaveClass("space-y-12");
  });

  it("takes a body of Sections without the prose wrapper, with the meta row in the header", () => {
    render(
      <InfoPage title="Terms of service" prose={false} meta={<span>Last updated: October 2026</span>}>
        <Section id="use" title="Use of the site">
          <p>Text.</p>
        </Section>
        <Section id="data" title="Your data">
          <p>More.</p>
        </Section>
      </InfoPage>,
    );
    expect(document.querySelector("[data-prose]")).toBeNull();
    const first = screen.getByRole("region", { name: "Use of the site" });
    expect(first.parentElement).toHaveClass("space-y-12");
    expect(screen.getByText("Last updated: October 2026").closest("[data-page-header-meta]")).not.toBeNull();
  });

  it("renders the breadcrumb trail above the title and the pager after every slot", () => {
    render(
      <InfoPage
        title="UVM phase sorter"
        breadcrumbs={[
          { label: "Practice", href: "/practice" },
          { label: "Exercises", href: "/practice#exercises" },
          { label: "UVM phase sorter" },
        ]}
        diagrams={[<div key="d" data-testid="diagram" />]}
        pager={<nav aria-label="Pager" data-testid="pager" />}
      >
        <p>Body.</p>
      </InfoPage>,
    );
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    const heading = screen.getByRole("heading", { level: 1, name: "UVM phase sorter" });
    expect(trail.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trail.querySelector('[aria-current="page"]')).toHaveTextContent("UVM phase sorter");
    const pager = screen.getByTestId("pager");
    expect(screen.getByTestId("diagram").compareDocumentPosition(pager) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no trail and no pager slot when none is given", () => {
    render(<InfoPage title="Projects" />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("slugs a heading into a section anchor", () => {
    expect(infoSectionId("Cookies and third parties")).toBe("cookies-and-third-parties");
    expect(infoSectionId("Questions or requests?")).toBe("questions-or-requests");
  });
});
