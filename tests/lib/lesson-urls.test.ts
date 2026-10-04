import { describe, expect, it } from "vitest";

import { curriculumData, toPrettyCurriculumSlug } from "@/lib/curriculum-data";
import {
  canonicalLessonPath,
  lessonSegments,
  resolveCurriculumRequest,
  suggestLessonsForPath,
} from "@/lib/curriculum/lesson-urls";

const F1A = "/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index";
const F1B = "/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index";

describe("resolveCurriculumRequest (canonical lesson URLs)", () => {
  it("renders the canonical three-segment URL as is", () => {
    expect(resolveCurriculumRequest(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"])).toEqual({
      kind: "lesson",
      slug: ["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"],
      path: F1A,
    });
    expect(resolveCurriculumRequest(["T2_Intermediate", "I-SV-1_OOP", "constructors"]).kind).toBe("lesson");
  });

  it("redirects a two-segment module URL to the module's first page (G30-PAGE-03)", () => {
    expect(resolveCurriculumRequest(["T1_Foundational", "F1B_The_Verification_Mindset"])).toEqual({
      kind: "redirect",
      slug: ["T1_Foundational", "F1B_The_Verification_Mindset", "index"],
      location: F1B,
    });
  });

  it("redirects a one-segment tier URL to the tier's first lesson (G30-LINK-V03)", () => {
    expect(resolveCurriculumRequest(["T1_Foundational"])).toMatchObject({ kind: "redirect", location: F1A });
  });

  it("redirects pretty and wrong-case slugs to the exact folder names", () => {
    expect(resolveCurriculumRequest(["t1-foundational", "f1b-the-verification-mindset", "index"])).toMatchObject({
      kind: "redirect",
      location: F1B,
    });
    expect(resolveCurriculumRequest(["t1_foundational", "f1b_the_verification_mindset"])).toMatchObject({
      kind: "redirect",
      location: F1B,
    });
  });

  it("redirects URLs with extra trailing segments instead of rendering duplicates (G30-LINK-V11)", () => {
    expect(resolveCurriculumRequest(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index", "x", "y"])).toMatchObject({
      kind: "redirect",
      location: F1A,
    });
  });

  it("accepts percent-encoded segments", () => {
    expect(resolveCurriculumRequest(["T1_Foundational", "F1A_The_Cost_of_Bugs", "ind%65x"]).kind).toBe("lesson");
  });

  it("reports anything that is not a lesson as not found", () => {
    expect(resolveCurriculumRequest(["does-not-exist"])).toEqual({ kind: "not-found" });
    expect(resolveCurriculumRequest(["T1_Foundational", "F1A_The_Cost_of_Bugs", "no-such-lesson"])).toEqual({ kind: "not-found" });
    expect(resolveCurriculumRequest(["T1_Foundational", "Nope"])).toEqual({ kind: "not-found" });
    expect(resolveCurriculumRequest([])).toEqual({ kind: "not-found" });
    expect(resolveCurriculumRequest(undefined)).toEqual({ kind: "not-found" });
    expect(canonicalLessonPath(["nope"])).toBeNull();
  });

  it("gives every lesson exactly one canonical URL that every other form reaches", () => {
    for (const tier of curriculumData) {
      for (const section of tier.sections) {
        for (const topic of section.topics) {
          const canonical = `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`;
          expect(resolveCurriculumRequest([tier.slug, section.slug, topic.slug])).toMatchObject({ kind: "lesson", path: canonical });
          const pretty = [tier.slug, section.slug, topic.slug].map(toPrettyCurriculumSlug);
          expect(canonicalLessonPath(pretty), pretty.join("/")).toBe(canonical);
          if (topic.slug === "index") {
            expect(resolveCurriculumRequest([tier.slug, section.slug])).toMatchObject({ kind: "redirect", location: canonical });
          }
        }
      }
    }
  });
});

describe("lessonSegments", () => {
  it("accepts segments, relative paths and /curriculum URLs", () => {
    expect(lessonSegments(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"])).toEqual(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    expect(lessonSegments("T1_Foundational/F1A_The_Cost_of_Bugs/index")).toEqual(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    expect(lessonSegments(`${F1A}#quick-take`)).toEqual(["T1_Foundational", "F1A_The_Cost_of_Bugs", "index"]);
    expect(lessonSegments("/curriculum/")).toBeUndefined();
    expect(lessonSegments(undefined)).toBeUndefined();
  });
});

describe("suggestLessonsForPath (not-found suggestions)", () => {
  it("finds the module behind a relative link that escaped /curriculum", () => {
    expect(suggestLessonsForPath("/T2_Intermediate/I-SV-1_OOP")[0]).toMatchObject({
      href: "/curriculum/T2_Intermediate/I-SV-1_OOP/index",
      code: "I-SV-1",
    });
  });

  it("finds the module behind a link that lost its tier", () => {
    expect(suggestLessonsForPath("/curriculum/F1C_Why_SystemVerilog")[0]?.href).toBe(
      "/curriculum/T1_Foundational/F1C_Why_SystemVerilog/index",
    );
  });

  it("ranks a matching lesson of the module first", () => {
    const suggestions = suggestLessonsForPath("/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailbox");
    expect(suggestions.map((suggestion) => suggestion.href)).toEqual([
      "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes",
      "/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index",
    ]);
  });

  it("matches a bare module code", () => {
    expect(suggestLessonsForPath("/curriculum/i-uvm-2c")[0]?.href).toBe(
      "/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index",
    );
  });

  it("suggests nothing for unrelated paths", () => {
    expect(suggestLessonsForPath("/curriculum/does-not-exist")).toEqual([]);
    expect(suggestLessonsForPath("/")).toEqual([]);
  });
});
