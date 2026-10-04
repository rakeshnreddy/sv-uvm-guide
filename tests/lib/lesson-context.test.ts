import { describe, expect, it } from "vitest";

import manifest from "../../content/curriculum/curriculum.manifest.json";
import { curriculumData, findPrevNextTopics } from "@/lib/curriculum-data";
import {
  cleanTitle,
  getLessonContext,
  lessonBreadcrumbs,
  lessonNeighbours,
  lessonPrerequisites,
} from "@/lib/curriculum/lesson-context";
import { parseLessonFrontmatter } from "@/lib/curriculum/lesson-frontmatter";

const IUVM3B = "I-UVM-3B_Advanced_Sequencing_and_Layering";

/** Titles come from the lessons, which authors edit; read them rather than pinning them. */
function titleOf(moduleId: string, lessonSlug = "index"): string {
  const section = curriculumData.flatMap((tier) => tier.sections).find((entry) => entry.slug === moduleId)!;
  return cleanTitle(section.topics.find((topic) => topic.slug === lessonSlug)!.title);
}

function moduleLabelOf(moduleId: string): string {
  const code = moduleId.split("_")[0];
  const title = titleOf(moduleId);
  return title.startsWith(`${code}:`) ? title : `${code}: ${title}`;
}

describe("getLessonContext (orientation header)", () => {
  it('numbers lessons in manifest order: "Lesson k of N" (G30-PAGE-V01)', () => {
    const manifestModule = manifest.tiers.flatMap((tier) => tier.modules).find((entry) => entry.id === IUVM3B)!;
    manifestModule.lessons.forEach((lessonSlug, index) => {
      const context = getLessonContext(["T2_Intermediate", IUVM3B, lessonSlug])!;
      expect(context.lesson.position, lessonSlug).toBe(index + 1);
      expect(context.lesson.count).toBe(manifestModule.lessons.length);
      expect(context.lessons.map((lesson) => lesson.slug[2])).toEqual(manifestModule.lessons);
      expect(context.lessons.filter((lesson) => lesson.current).map((lesson) => lesson.slug[2])).toEqual([lessonSlug]);
    });
  });

  it("names the tier from the manifest and places the module in it", () => {
    const context = getLessonContext(["T2_Intermediate", "I-SV-8_Power_Intent_and_UPF", "index"])!;
    expect(context.tier).toMatchObject({ code: "T2", title: "Tier 2: Intermediate", href: "/curriculum#t2" });
    expect(context.lesson.track).toBe("elective");
    expect(context.module).toMatchObject({ code: "I-SV-8", label: moduleLabelOf("I-SV-8_Power_Intent_and_UPF") });
    const t2 = curriculumData.find((tier) => tier.slug === "T2_Intermediate")!;
    expect(context.module.count).toBe(t2.sections.length);
    expect(context.module.position).toBe(t2.sections.findIndex((section) => section.slug === "I-SV-8_Power_Intent_and_UPF") + 1);
    const manifestModule = manifest.tiers.flatMap((tier) => tier.modules).find((entry) => entry.id === "I-SV-8_Power_Intent_and_UPF")!;
    expect(context.milestones.map((milestone) => milestone.id)).toEqual([...manifestModule.milestones].sort());
    expect(context.milestones.every((milestone) => milestone.label.length > 2 && milestone.label !== milestone.id)).toBe(true);
  });

  it("works from any URL form and returns nothing for non-lessons", () => {
    expect(getLessonContext(["t2-intermediate", "i-sv-1-oop"])?.lesson.href).toBe("/curriculum/T2_Intermediate/I-SV-1_OOP/index");
    expect(getLessonContext(["nope"])).toBeUndefined();
  });

  it("drops legacy title suffixes in navigation labels", () => {
    expect(cleanTitle("Mailboxes | Advanced SystemVerilog for Verification")).toBe("Mailboxes");
    const context = getLessonContext(["T2_Intermediate", "I-SV-5_Synchronization_and_IPC", "mailboxes"])!;
    expect(context.lesson.label).toBe(titleOf("I-SV-5_Synchronization_and_IPC", "mailboxes"));
    expect(context.lesson.label).not.toContain(" | ");
  });
});

describe("lessonPrerequisites (Before you start)", () => {
  it("lists a module page's manifest prerequisites as canonical links", () => {
    const items = lessonPrerequisites(["T4_Expert", "E-PWR-1_Power_Aware_Verification", "index"])!;
    const manifestModule = manifest.tiers.flatMap((tier) => tier.modules).find((entry) => entry.id === "E-PWR-1_Power_Aware_Verification")!;
    expect(items.map((item) => item.href)).toEqual(
      manifestModule.prerequisites.map((moduleId) => {
        const tier = curriculumData.find((entry) => entry.sections.some((section) => section.slug === moduleId))!;
        return `/curriculum/${tier.slug}/${moduleId}/index`;
      }),
    );
    expect(items[0]).toMatchObject({ kind: "module", label: moduleLabelOf("I-SV-8_Power_Intent_and_UPF") });
  });

  it("puts the previous page of the module first on a later page", () => {
    const items = lessonPrerequisites(["T2_Intermediate", IUVM3B, "sequence-arbitration"])!;
    expect(items[0]).toEqual({
      kind: "lesson",
      href: `/curriculum/T2_Intermediate/${IUVM3B}/sequencer-driver-handshake`,
      label: titleOf(IUVM3B, "sequencer-driver-handshake"),
      moduleCode: "I-UVM-3B",
    });
    expect(items.slice(1).map((item) => item.label)).toEqual([moduleLabelOf("I-UVM-3A_Fundamentals")]);
  });

  it("is empty for the first lesson and undefined for non-lessons", () => {
    expect(lessonPrerequisites(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"])).toEqual([]);
    expect(lessonPrerequisites(["T1_Foundational", "missing"])).toBeUndefined();
  });

  it("only ever points backward along the learning path", () => {
    const order = curriculumData.flatMap((tier) =>
      tier.sections.flatMap((section) => section.topics.map((topic) => `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`)),
    );
    for (const href of order) {
      for (const item of lessonPrerequisites(href.replace("/curriculum/", "").split("/")) ?? []) {
        expect(order.indexOf(item.href), `${href} <- ${item.href}`).toBeLessThan(order.indexOf(href));
      }
    }
  });
});

describe("lessonNeighbours (Next card)", () => {
  it("matches the generated core-path navigation for every lesson", () => {
    for (const tier of curriculumData) {
      for (const section of tier.sections) {
        for (const topic of section.topics) {
          const slug = [tier.slug, section.slug, topic.slug];
          const generated = findPrevNextTopics(slug);
          const { prev, next } = lessonNeighbours(slug);
          expect(next?.href, slug.join("/")).toBe(generated.next ? `/curriculum/${generated.next.slug}` : undefined);
          expect(prev?.href, slug.join("/")).toBe(generated.prev ? `/curriculum/${generated.prev.slug}` : undefined);
        }
      }
    }
  });

  it("labels module and tier boundaries and the return from an elective", () => {
    expect(lessonNeighbours(["T2_Intermediate", IUVM3B, "sequence-arbitration"]).next).toMatchObject({
      step: "lesson",
      boundary: "Lesson 4 of 9 in I-UVM-3B",
    });
    expect(lessonNeighbours(["T1_Foundational", "F2C_Procedural_Code_and_Flow_Control", "flow-control"]).next).toMatchObject({
      step: "module",
      boundary: "Next module: F2D",
    });
    expect(lessonNeighbours(["T2_Intermediate", "I-UVM-6_UVM_Recording_Classes", "index"]).next).toMatchObject({
      step: "tier",
      href: "/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index",
      boundary: "Starts Tier 3: Advanced",
    });
    expect(lessonNeighbours(["T2_Intermediate", "I-SV-8_Power_Intent_and_UPF", "index"]).next).toMatchObject({
      returnsToCore: true,
      boundary: "Starts Tier 3: Advanced, back on the core path",
    });
    expect(lessonNeighbours(["T4_Expert", "E-PSS-1_Portable_Stimulus_Standard", "index"]).next?.href).toBe(
      "/curriculum/T4_Expert/E-PWR-1_Power_Aware_Verification/index",
    );
  });
});

describe("lessonBreadcrumbs", () => {
  it("links the tier to its overview section and the module to its canonical first page", () => {
    expect(lessonBreadcrumbs(["T2_Intermediate", IUVM3B, "virtual-sequences"])).toEqual([
      { label: "Curriculum", href: "/curriculum", current: false },
      { label: "Tier 2: Intermediate", href: "/curriculum#t2", current: false },
      { label: moduleLabelOf(IUVM3B), href: `/curriculum/T2_Intermediate/${IUVM3B}/index`, current: false },
      { label: titleOf(IUVM3B, "virtual-sequences"), href: `/curriculum/T2_Intermediate/${IUVM3B}/virtual-sequences`, current: true },
    ]);
  });

  it("ends on the module crumb for a module's first page (no repeated crumb)", () => {
    const crumbs = lessonBreadcrumbs(["T1_Foundational", "F2A_Core_Data_Types"]);
    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Curriculum", "Tier 1: Foundations", moduleLabelOf("F2A_Core_Data_Types")]);
    expect(crumbs.at(-1)).toMatchObject({ href: "/curriculum/T1_Foundational/F2A_Core_Data_Types/index", current: true });
  });
});

describe("concept links", () => {
  it("are off unless a lesson opts in (G30 request 10)", () => {
    expect(parseLessonFrontmatter({}).conceptLinking).toBe(false);
    expect(parseLessonFrontmatter({ conceptLinking: true }).conceptLinking).toBe(true);
  });
});
