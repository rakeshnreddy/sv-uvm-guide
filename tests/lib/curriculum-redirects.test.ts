import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { checkCustomRoutes } from "next/dist/lib/load-custom-routes";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";

import { curriculumRedirects } from "@/generated/curriculum-redirects.mjs";
import { curriculumData } from "@/lib/curriculum-data";
import { resolveCurriculumRequest } from "@/lib/curriculum/lesson-urls";

/**
 * Matches redirects exactly as `next start` does (Next 14.2,
 * next/dist/server/lib/router-utils/filesystem.js buildCustomRoute and
 * resolve-routes.js): Next's own path-to-regexp matcher, strict, case
 * insensitive, unnamed params removed, the optional trailing slash added by
 * modifyRouteRegex, first match wins; destinations through prepareDestination.
 * A hand-written matcher hid the 13 "(/:slug*)" sources that never fired
 * (G30-LINK-03, G30-LINK-04).
 */
const matchers = curriculumRedirects.map((redirect) => ({
  ...redirect,
  match: getPathMatch(redirect.source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex: string) => modifyRouteRegex(regex, ["/_next"]),
    sensitive: false,
  }),
}));

function resolveRedirect(pathname: string): string | null {
  for (const route of matchers) {
    const params = route.match(pathname);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: false,
      destination: route.destination,
      params,
      query: {},
    });
    return (parsedDestination.pathname ?? "").replace(/\/{2,}/g, "/");
  }
  return null;
}

/** Follows redirects, then the lesson route's own canonical redirect; returns the final path. */
function finalLessonPath(pathname: string): string | null {
  let current = pathname;
  for (let hop = 0; hop < 5; hop += 1) {
    const next = resolveRedirect(current);
    if (!next) break;
    current = next;
  }
  const request = resolveCurriculumRequest(current.replace(/^\/curriculum\/?/, "").split("/"));
  if (request.kind === "lesson") return request.path;
  if (request.kind === "redirect") return request.location;
  return null;
}

const contentRoot = path.join(process.cwd(), "content", "curriculum");
const lessonExists = (lessonPath: string) =>
  fs.existsSync(path.join(contentRoot, `${lessonPath.replace(/^\/curriculum\//, "")}.mdx`));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("curriculum redirects under Next's own matcher", () => {
  it("passes the checks next build runs on custom routes", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`checkCustomRoutes rejected the redirects (exit ${code})`);
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => checkCustomRoutes(curriculumRedirects, "redirect")).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('uses "/:slug*" and never the literal "(/:slug*)" group that cannot match', () => {
    for (const redirect of curriculumRedirects) {
      expect(redirect.source, redirect.source).not.toContain("(/:slug*)");
    }
  });

  it("fires for the legacy URLs that returned 404 before (G30 acceptance)", () => {
    expect(finalLessonPath("/curriculum/T2_Intermediate/I-UVM-3_Sequences")).toBe(
      "/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index",
    );
    expect(finalLessonPath("/curriculum/T1_Foundational/F3B_Tasks_and_Functions")).toBe(
      "/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/tasks-functions",
    );
    expect(finalLessonPath("/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/uvm-callbacks")).toBe(
      "/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index",
    );
  });

  it("matches a legacy module's base URL, its trailing-slash form, its index and its children", () => {
    const base = "/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization";
    const target = "/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index";
    for (const pathname of [base, `${base}/`, `${base}/index`, `${base}/uvm-event-barrier`]) {
      expect(resolveRedirect(pathname), pathname).toBe(target);
    }
  });

  it("places exact descendants before the broad legacy module redirect", () => {
    const exact = "/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/built-in-ral-sequences";
    const broad = "/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/:slug*";
    expect(curriculumRedirects.findIndex((redirect) => redirect.source === exact)).toBeLessThan(
      curriculumRedirects.findIndex((redirect) => redirect.source === broad),
    );
    expect(resolveRedirect(exact)).toBe("/curriculum/T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/built-in-ral-sequences");
    expect(resolveRedirect("/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL")).toBe(
      "/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals/index",
    );
  });

  it("keeps wildcard descendants when the destination declares a wildcard", () => {
    expect(resolveRedirect("/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-arbitration")).toBe(
      "/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration",
    );
  });

  it("sends every page that ever existed under a legacy folder to an existing lesson (G30-LINK-05/06)", () => {
    // From `git log --all --name-only` over the legacy folders.
    const legacyPages: Record<string, string> = {
      "T1_Foundational/F3_Behavioral_RTL_Modeling/index": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index",
      "T1_Foundational/F3_Procedural_Constructs/index": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index",
      "T1_Foundational/F3_Procedural_Constructs/flow-control": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/flow-control",
      "T1_Foundational/F3_Procedural_Constructs/fork-join": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index",
      "T1_Foundational/F3_Procedural_Constructs/tasks-functions": "T1_Foundational/F2D_Reusable_Code_and_Parallelism/tasks-functions",
      "T1_Foundational/F3A_Procedural_Blocks_and_Flow_Control/index": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index",
      "T1_Foundational/F3A_Procedural_Blocks_and_Flow_Control/flow-control": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/flow-control",
      "T1_Foundational/F3B_Tasks_and_Functions/index": "T1_Foundational/F2D_Reusable_Code_and_Parallelism/tasks-functions",
      "T1_Foundational/F3C_Processes_and_Synchronization/index": "T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index",
      "T1_Foundational/F3C_Processes_and_Synchronization/ipc": "T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc",
      "T1_Foundational/F3D_System_Tasks_and_File_IO/index": "T1_Foundational/F2D_Reusable_Code_and_Parallelism/index",
      "T2_Intermediate/I-UVM-1_UVM_Intro/index": "T2_Intermediate/I-UVM-1A_Components/index",
      "T2_Intermediate/I-UVM-2_Building_TB/index": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T2_Intermediate/I-UVM-2_Building_TB/uvm-report-server": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T2_Intermediate/I-UVM-2_Building_TB/uvm-root": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T2_Intermediate/I-UVM-3_Sequences/index": "T2_Intermediate/I-UVM-3A_Fundamentals/index",
      "T2_Intermediate/I-UVM-3_Sequences/uvm-config-db": "T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index",
      "T2_Intermediate/I-UVM-3_Sequences/uvm-resource-db": "T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index",
      "T2_Intermediate/I-UVM-4_Factory_and_Overrides/index": "T2_Intermediate/I-UVM-1B_The_UVM_Factory/index",
      "T2_Intermediate/I-UVM-4_Factory_and_Overrides/overriding": "T2_Intermediate/I-UVM-1B_The_UVM_Factory/index",
      "T2_Intermediate/I-UVM-4_Factory_and_Overrides/registering": "T2_Intermediate/I-UVM-1B_The_UVM_Factory/index",
      "T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/index": "T2_Intermediate/I-UVM-1C_UVM_Phasing/index",
      "T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/domains-phase-jumping": "T2_Intermediate/I-UVM-1C_UVM_Phasing/index",
      "T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/uvm-event-barrier": "T2_Intermediate/I-UVM-1C_UVM_Phasing/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/index": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/connecting": "T2_Intermediate/I-UVM-2B_TLM_Connections/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/environment-test-classes": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/interrupt-handling": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/interrupt-handling",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/layered-sequences": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/layered-sequences",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-arbitration": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/sequence-libraries": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/sequencer-driver-handshake": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequencer-driver-handshake",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-monitor": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-scoreboard": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-sequence-item": "T2_Intermediate/I-UVM-3A_Fundamentals/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-subscriber": "T2_Intermediate/I-UVM-2A_Component_Roles/index",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/uvm-virtual-sequencer": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/uvm-virtual-sequencer",
      "T3_Advanced/A-UVM-1_Advanced_Sequencing/virtual-sequences": "T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences",
      "T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/index": "T2_Intermediate/I-UVM-1B_The_UVM_Factory/index",
      "T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/heartbeats": "T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/hang-lab",
      "T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/uvm-callbacks": "T3_Advanced/A-UVM-5_UVM_Callbacks/index",
      "T3_Advanced/A-UVM-3_Advanced_UVM_Techniques/index": "T3_Advanced/A-UVM-5_UVM_Callbacks/index",
      "T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/index": "T3_Advanced/A-UVM-4A_RAL_Fundamentals/index",
      "T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/built-in-ral-sequences": "T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/built-in-ral-sequences",
      "T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/explicit-vs-implicit": "T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/explicit-vs-implicit",
      "T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/frontdoor-vs-backdoor": "T3_Advanced/A-UVM-4B_Advanced_RAL_Techniques/frontdoor-vs-backdoor",
    };

    for (const [legacy, expected] of Object.entries(legacyPages)) {
      const landing = finalLessonPath(`/curriculum/${legacy}`);
      expect(landing, legacy).toBe(`/curriculum/${expected}`);
      expect(lessonExists(landing ?? ""), `${legacy} -> ${landing}`).toBe(true);
    }
  });

  it("lands every redirect on a canonical lesson URL in one hop, without the route's own redirect", () => {
    for (const redirect of curriculumRedirects) {
      if (redirect.destination.includes(":")) continue;
      const request = resolveCurriculumRequest(redirect.destination.replace(/^\/curriculum\//, "").split("/"));
      expect(request.kind, `${redirect.source} -> ${redirect.destination}`).toBe("lesson");
    }
  });

  it("never captures a current lesson URL, in any letter case", () => {
    for (const tier of curriculumData) {
      for (const section of tier.sections) {
        for (const topic of section.topics) {
          const canonical = `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`;
          expect(resolveRedirect(canonical), canonical).toBeNull();
          expect(resolveRedirect(canonical.toLowerCase()), canonical.toLowerCase()).toBeNull();
          expect(resolveRedirect(`/curriculum/${tier.slug}/${section.slug}`)).toBeNull();
        }
      }
    }
  });
});
