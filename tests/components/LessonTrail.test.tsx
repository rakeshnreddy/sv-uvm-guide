import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodedLabel, withoutCode } from "@/components/curriculum/CodedLabel";
import LessonTrail, { lessonTrailItems } from "@/components/curriculum/LessonTrail";
import { getLessonContext } from "@/lib/curriculum/lesson-context";

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<"a">, "href"> & { href: string }>;

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MAILBOXES = ["T2_Intermediate", "I-SV-5_Synchronization_and_IPC", "mailboxes"];
const IPC_INDEX = "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index";

describe("lessonTrailItems", () => {
  it("is Curriculum, the tier section, the module with its code, then the lesson", () => {
    expect(lessonTrailItems(MAILBOXES)).toEqual([
      { label: "Curriculum", href: "/curriculum" },
      { label: "Tier 2: Intermediate", href: "/curriculum#t2" },
      { label: "Synchronization and IPC", code: "I-SV-5", href: IPC_INDEX },
      { label: getLessonContext(MAILBOXES)!.lesson.title, href: `/curriculum/${MAILBOXES.join("/")}` },
    ]);
  });

  it("ends at the module on a module's first page", () => {
    const items = lessonTrailItems(["T2_Intermediate", "I-SV-5_Synchronization_and_IPC", "index"]);
    expect(items).toHaveLength(3);
    expect(items.at(-1)).toEqual({ label: "Synchronization and IPC", code: "I-SV-5", href: IPC_INDEX });
  });

  it("uses canonical links for any accepted URL form, and is empty for a non-lesson", () => {
    expect(lessonTrailItems(["t2-intermediate", "i-sv-5-synchronization-and-ipc", "mailboxes"])).toEqual(
      lessonTrailItems(MAILBOXES),
    );
    expect(lessonTrailItems(["does-not-exist"])).toEqual([]);
  });

  it("never links to a tier page", () => {
    for (const item of lessonTrailItems(MAILBOXES)) expect(item.href).not.toMatch(/^\/curriculum\/T\d_[^/]+$/);
  });
});

describe("<LessonTrail />", () => {
  it("renders the shared breadcrumb with the module code as a signal tag and no card", () => {
    render(<LessonTrail slug={MAILBOXES} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const tier = within(nav).getByRole("link", { name: "Tier 2: Intermediate" });
    expect(tier).toHaveAttribute("href", "/curriculum#t2");
    const moduleLink = nav.querySelector(`ol a[href="${IPC_INDEX}"]`)!;
    expect(moduleLink.querySelector("[data-signal-tag]")).toHaveTextContent("I-SV-5");
    expect(nav.querySelectorAll('ol a[aria-current="page"]')).toHaveLength(1);
    expect(nav.querySelector('ol a[aria-current="page"]')).toHaveAttribute("href", `/curriculum/${MAILBOXES.join("/")}`);
    // No card: neither the trail nor its row draws a surface.
    for (const element of [nav, nav.parentElement!]) expect(element.className).not.toMatch(/rounded-2xl|bg-card|bg-muted|shadow|border/);
  });

  it("offers a back link to the module for phones", () => {
    render(<LessonTrail slug={MAILBOXES} />);
    const back = screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector("[data-breadcrumb-back]");
    expect(back).toHaveAttribute("href", IPC_INDEX);
  });

  it('puts "Jump to" beside the trail in multi-lesson modules', () => {
    render(<LessonTrail slug={MAILBOXES} />);
    expect(getLessonContext(MAILBOXES)!.lessons.length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /Jump to/ })).toBeInTheDocument();
  });

  it("renders nothing for a slug that is not a lesson", () => {
    const { container } = render(<LessonTrail slug={["nope"]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("<CodedLabel />", () => {
  it("reads as 'CODE: title' while showing the code as a signal tag", () => {
    render(
      <a href="/x">
        <CodedLabel code="I-SV-1" title="Object-Oriented Programming" />
      </a>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("I-SV-1: Object-Oriented Programming");
    expect(link.querySelector("[data-signal-tag]")).toHaveTextContent("I-SV-1");
  });

  it("strips a leading code from a label, and leaves other labels alone", () => {
    expect(withoutCode("I-SV-1: Object-Oriented Programming", "I-SV-1")).toBe("Object-Oriented Programming");
    expect(withoutCode("Mailboxes", "I-SV-5")).toBe("Mailboxes");
  });
});
