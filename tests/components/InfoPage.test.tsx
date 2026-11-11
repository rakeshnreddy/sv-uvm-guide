import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InfoPage, infoPageProseClass } from "@/components/templates/InfoPage";

describe("InfoPage", () => {
  it("renders unboxed: one container, a plain header with a hairline, no card", () => {
    const { container } = render(
      <InfoPage title="Projects" description="One project per milestone.">
        <p>Body text.</p>
      </InfoPage>,
    );
    const root = screen.getByTestId("info-page");
    expect(root).toHaveClass("mx-auto", "w-full", "max-w-6xl");
    // The phone gutter is 16 px when the template supplies its own gutter.
    expect(root).toHaveClass("px-4", "sm:px-6", "lg:px-8");
    expect(container.querySelector(".bg-card")).toBeNull();
    expect(container.querySelector(".shadow-card")).toBeNull();

    const heading = screen.getByRole("heading", { level: 1, name: "Projects" });
    expect(heading).toHaveClass("text-h1", "text-foreground");
    expect(screen.getByText("One project per milestone.")).toHaveClass("text-lead", "text-muted-foreground");
    expect(heading.closest("header")).toHaveClass("border-b", "border-border");
  });

  it("drops its own gutter inside the app shell, which already provides one", () => {
    render(<InfoPage gutter={false} title="Exercises" />);
    const root = screen.getByTestId("info-page");
    expect(root).not.toHaveClass("px-4");
    expect(root).toHaveClass("max-w-6xl");
  });

  it("caps running text at 68ch and puts charts and diagrams outside the prose styles", () => {
    render(
      <InfoPage
        title="Phases"
        charts={[<div key="c" data-testid="chart" />]}
        diagrams={[<div key="d" data-testid="diagram" />]}
      >
        <p>Intro.</p>
      </InfoPage>,
    );
    const prose = screen.getByText("Intro.").closest("section");
    expect(prose?.className).toBe(`mb-8 ${infoPageProseClass}`);
    for (const cap of ["prose-p:max-w-[68ch]", "prose-ul:max-w-[68ch]", "prose-ol:max-w-[68ch]", "prose-headings:max-w-[68ch]"]) {
      expect(infoPageProseClass).toContain(cap);
    }
    expect(screen.getByTestId("chart").closest("section")).toHaveClass("not-prose");
    expect(screen.getByTestId("diagram").closest("section")).toHaveClass("not-prose");
    expect(screen.getByRole("heading", { level: 2, name: "Diagrams and illustrations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Charts and visualizations" })).toBeInTheDocument();
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
});
