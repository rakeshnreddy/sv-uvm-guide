import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonNextBlock from "@/components/curriculum/LessonNextBlock";
import RouteNextLink from "@/components/curriculum/RouteNextLink";
import { curriculumData } from "@/lib/curriculum-data";
import { getLessonContext } from "@/lib/curriculum/lesson-context";
import { routeNextOptions } from "@/lib/curriculum/lesson-route-next";
import { LEARNING_ROUTES, resolveRoutes } from "@/lib/learning-paths";
import { writeSelectedRoute, type RouteNextOption } from "@/lib/learning-route-state";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ISV2A = "I-SV-2A_Constrained_Randomization_Fundamentals";
const BAMBAF3 = "B-AMBA-F3_Interview_Debug_Clinic";
const ISV3A_HREF = "/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index";
const ISV9_HREF = "/curriculum/T2_Intermediate/I-SV-9_Why_UVM/index";
const AUVM6_HREF = "/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index";

function tierOf(moduleId: string): string {
  return curriculumData.find((tier) => tier.sections.some((section) => section.slug === moduleId))!.slug;
}

function contextOf(moduleId: string, lessonSlug: string) {
  return getLessonContext([tierOf(moduleId), moduleId, lessonSlug])!;
}

afterEach(() => {
  act(() => writeSelectedRoute(null));
});

describe("routeNextOptions", () => {
  it("gives the route's next lesson where the core path leaves the Junior route (closure finding C10)", () => {
    const [junior] = routeNextOptions(ISV2A, "constraint-blocks");
    expect(junior).toMatchObject({ routeId: "junior", next: { href: ISV3A_HREF, label: "I-SV-3A: Functional Coverage Fundamentals" } });
    expect(junior.next?.step).toMatch(/^Step \d+ of \d+: /);
    // The core path goes to I-SV-2B instead.
    expect(contextOf(ISV2A, "constraint-blocks").next?.href).toContain("I-SV-2B_Advanced_Constrained_Randomization");

    expect(routeNextOptions("I-SV-6_Compiler_Directives_and_Generates", "index").find((o) => o.routeId === "junior")?.next?.href).toBe(ISV9_HREF);
    expect(routeNextOptions("I-UVM-4_UVM_Policy_Classes", "index").find((o) => o.routeId === "junior")?.next?.href).toBe(AUVM6_HREF);
    expect(
      routeNextOptions("I-SV-2B_Advanced_Constrained_Randomization", "solver-debug").find((o) => o.routeId === "practitioner")?.next?.href,
    ).toBe("/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/index");
  });

  it("leaves out routes that do not take the lesson, and marks a route's last lesson", () => {
    // I-SV-2B is not on the Junior route.
    expect(routeNextOptions("I-SV-2B_Advanced_Constrained_Randomization", "solver-debug").map((o) => o.routeId)).not.toContain("junior");

    const routes = resolveRoutes(curriculumData);
    for (const route of routes) {
      const last = route.sequence[route.sequence.length - 1];
      const option = routeNextOptions(last.moduleId, last.lessonSlug, routes).find((o) => o.routeId === route.id);
      expect(option, route.id).toMatchObject({ routeId: route.id, routeName: route.name, next: null });
    }
  });

  it("agrees with every route's sequence", () => {
    const routes = resolveRoutes(curriculumData);
    expect(routes.map((r) => r.id)).toEqual(LEARNING_ROUTES.map((r) => r.id));
    for (const route of routes) {
      route.sequence.slice(0, -1).forEach((lesson, i) => {
        const option = routeNextOptions(lesson.moduleId, lesson.lessonSlug, routes).find((o) => o.routeId === route.id);
        expect(option?.next?.href, `${route.id} after ${lesson.key}`).toBe(route.sequence[i + 1].href);
        expect(option?.prev?.href, `${route.id} before ${lesson.key}`).toBe(route.sequence[i - 1]?.href);
      });
    }
  });

  it("gives the route's previous lesson where the core path's Previous leaves the Junior route", () => {
    const junior = routeNextOptions("I-SV-3A_Functional_Coverage_Fundamentals", "index").find((o) => o.routeId === "junior");
    expect(junior?.prev?.href).toContain(ISV2A);
    // The core path's Previous goes to I-SV-2B instead.
    expect(contextOf("I-SV-3A_Functional_Coverage_Fundamentals", "index").prev?.href).toContain("I-SV-2B_Advanced_Constrained_Randomization");
  });

  it("places the B-AMBA-F3 clinic on the Expert route's interview step and goes on to the electives", () => {
    const expertRoute = resolveRoutes(curriculumData).find((r) => r.id === "expert")!;
    const interview = expertRoute.steps.findIndex((s) => s.id === "interview");
    const electives = expertRoute.steps.findIndex((s) => s.id === "electives");
    const expert = routeNextOptions(BAMBAF3, "index").find((o) => o.routeId === "expert");
    expect(expert?.next?.href).toBe(expertRoute.sequence.find((l) => l.stepIndex === electives)!.href);
    expect(expert?.next?.href).toContain("E-EMU-1_Emulation_Aware_Verification");
    expect(expert?.next?.step).toBe(`Step ${electives + 1} of ${expertRoute.steps.length}: Electives: the wider ecosystem`);
    // Not the core path's Next, which goes back to E-DBG-1 (Expert step 1).
    expect(expert?.next?.href).not.toContain("E-DBG-1");
    expect(contextOf(BAMBAF3, "index").next?.href).toContain("E-DBG-1");
    // Previous on the route: the last lesson before the interview step.
    expect(expert?.prev?.href).toBe(expertRoute.sequence.filter((l) => l.stepIndex < interview).at(-1)!.href);
    expect(expert?.between).toBeUndefined();
  });

  it("names the Expert interview step, which has no lessons, before the electives after the last SoC lesson", () => {
    const expertRoute = resolveRoutes(curriculumData).find((r) => r.id === "expert")!;
    const interview = expertRoute.steps.findIndex((s) => s.id === "interview");
    const lastSoc = expertRoute.sequence.filter((l) => l.moduleId === "E-SOC-1_SoC-Level_Verification_Strategies").at(-1)!;
    const expert = routeNextOptions(lastSoc.moduleId, lastSoc.lessonSlug).find((o) => o.routeId === "expert");
    expect(expert?.between).toEqual([`Step ${interview + 1} of ${expertRoute.steps.length}: Interview preparation`]);
    expect(expert?.next?.href).toContain("E-EMU-1_Emulation_Aware_Verification");
  });
});

describe("<RouteNextLink />", () => {
  const options = routeNextOptions(ISV2A, "constraint-blocks");
  const coreNextHref = contextOf(ISV2A, "constraint-blocks").next?.href;

  it("shows nothing when no route is chosen, and nothing in the server render", () => {
    act(() => writeSelectedRoute("junior"));
    // The server has no chosen route, so the HTML is empty whatever this browser stores.
    expect(renderToString(<RouteNextLink options={options} coreNextHref={coreNextHref} />)).toBe("");
    act(() => writeSelectedRoute(null));
    const { container } = render(<RouteNextLink options={options} coreNextHref={coreNextHref} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Next on your Junior route" for a Junior learner where the route leaves the core path', () => {
    act(() => writeSelectedRoute("junior"));
    render(<RouteNextLink options={options} coreNextHref={coreNextHref} />);
    const link = screen.getByRole("link", { name: /^Next on your Junior route I-SV-3A: Functional Coverage Fundamentals/ });
    expect(link).toHaveAttribute("href", ISV3A_HREF);
    expect(link).not.toHaveAttribute("rel");
    expect(screen.getByTestId("route-next")).toHaveTextContent("follows the core path");
  });

  it("appears and disappears when the route is chosen or cleared on this page", () => {
    render(<RouteNextLink options={options} coreNextHref={coreNextHref} />);
    expect(screen.queryByTestId("route-next")).toBeNull();
    act(() => writeSelectedRoute("junior"));
    expect(screen.getByTestId("route-next")).toBeInTheDocument();
    act(() => writeSelectedRoute(null));
    expect(screen.queryByTestId("route-next")).toBeNull();
  });

  it("shows nothing when the lesson is not on the chosen route or the route agrees with the core path", () => {
    act(() => writeSelectedRoute("practitioner"));
    const { container, rerender } = render(<RouteNextLink options={options} coreNextHref={coreNextHref} />);
    expect(container).toBeEmptyDOMElement();
    const same: RouteNextOption[] = [{ routeId: "practitioner", routeName: "Practitioner", next: { href: "/x", label: "X", step: "Step 1 of 6: Y" } }];
    rerender(<RouteNextLink options={same} coreNextHref="/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says when the lesson is the last on the chosen route and links to the route", () => {
    act(() => writeSelectedRoute("expert"));
    render(<RouteNextLink options={[{ routeId: "expert", routeName: "Expert", next: null }]} coreNextHref="/y" />);
    const note = screen.getByTestId("route-next");
    expect(note).toHaveTextContent("This is the last lesson on your Expert route.");
    expect(within(note).getByRole("link", { name: "curriculum overview" })).toHaveAttribute("href", "/curriculum#route-expert");
  });
});

describe("<RouteNextLink /> previous and practice-only steps", () => {
  const prev = { href: "/p", label: "P lesson", step: "Step 1 of 5: S" };
  const next = { href: "/n", label: "N lesson", step: "Step 5 of 5: Electives" };

  it('shows "Previous on your route" only when it differs from the core Previous', () => {
    act(() => writeSelectedRoute("junior"));
    const options: RouteNextOption[] = [{ routeId: "junior", routeName: "Junior", next, prev }];
    const { rerender, container } = render(<RouteNextLink options={options} coreNextHref="/n" corePrevHref="/core-prev" />);
    expect(screen.getByRole("link", { name: "Previous on your Junior route: P lesson" })).toHaveAttribute("href", "/p");
    expect(screen.queryByRole("link", { name: /^Next on your/ })).toBeNull();
    rerender(<RouteNextLink options={options} coreNextHref="/n" corePrevHref="/p" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names a practice-only step before the route's next lesson", () => {
    act(() => writeSelectedRoute("expert"));
    const options: RouteNextOption[] = [
      { routeId: "expert", routeName: "Expert", next, between: ["Step 4 of 5: Interview preparation"] },
    ];
    render(<RouteNextLink options={options} coreNextHref="/n" />);
    const note = screen.getByTestId("route-next-between");
    expect(note).toHaveTextContent("Your Expert route continues with Step 4 of 5: Interview preparation.");
    expect(within(note).getByRole("link", { name: "curriculum overview" })).toHaveAttribute("href", "/curriculum#route-expert");
  });

  it("on the B-AMBA-F3 clinic, an Expert learner is sent on to the electives, not back to E-DBG-1", () => {
    act(() => writeSelectedRoute("expert"));
    const context = contextOf(BAMBAF3, "index");
    render(<RouteNextLink options={routeNextOptions(BAMBAF3, "index")} coreNextHref={context.next?.href} corePrevHref={context.prev?.href} />);
    const link = screen.getByRole("link", { name: /^Next on your Expert route/ });
    expect(link.getAttribute("href")).toContain("E-EMU-1_Emulation_Aware_Verification");
    expect(link.getAttribute("href")).not.toContain("E-DBG-1");
  });
});

describe("<LessonNextBlock /> with routes", () => {
  it("keeps the one core-path Next lesson action and adds the route link beside it", () => {
    act(() => writeSelectedRoute("junior"));
    const context = contextOf(ISV2A, "constraint-blocks");
    render(
      <LessonNextBlock context={context} moduleId={ISV2A} lessonSlug="constraint-blocks" routeNext={routeNextOptions(ISV2A, "constraint-blocks")} />,
    );
    const block = screen.getByRole("region", { name: "Next" });
    const pager = within(block).getByRole("navigation", { name: "Previous and next lesson" });
    expect(within(pager).getByRole("link", { name: /^Next lesson/ })).toHaveAttribute("href", context.next!.href);
    expect(within(block).getAllByRole("link", { name: /^Next lesson/ })).toHaveLength(1);
    expect(within(block).getByRole("link", { name: /^Next on your Junior route/ })).toHaveAttribute("href", ISV3A_HREF);
  });
});
