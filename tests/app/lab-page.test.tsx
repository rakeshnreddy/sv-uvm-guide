import fs from "node:fs";
import path from "node:path";

import React, { type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import LabPage, {
  dynamic,
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/(learning)/practice/lab/[labId]/page";
import LabClientPage from "@/app/(learning)/practice/lab/[labId]/LabClientPage";
import { getAllLabs } from "@/lib/lab-registry";
import type { LabFileDto } from "@/types/lab";

const PAGE_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "(learning)", "practice", "lab", "[labId]", "page.tsx"),
  "utf8",
);

type ClientProps = React.ComponentProps<typeof LabClientPage>;

describe("static lab page", () => {
  it("prerenders exactly the available labs", () => {
    const available = getAllLabs().filter((lab) => lab.status === "available").map((lab) => lab.id);
    const params = generateStaticParams();
    expect(params.map((param) => param.labId).sort()).toEqual([...available].sort());
    expect(params.length).toBeGreaterThanOrEqual(23);
    for (const lab of getAllLabs().filter((entry) => entry.status !== "available")) {
      expect(params.map((param) => param.labId)).not.toContain(lab.id);
    }
  });

  it("is static: unknown ids 404 through dynamicParams, and nothing may make it dynamic", () => {
    expect(dynamicParams).toBe(false);
    expect(dynamic).toBe("error");
  });

  it("imports no auth, database or server-lab code and never sends the learner elsewhere", () => {
    expect(PAGE_SOURCE).not.toMatch(/requireSession/);
    expect(PAGE_SOURCE).not.toMatch(/@\/lib\/auth/);
    expect(PAGE_SOURCE).not.toMatch(/@\/server\/labs/);
    expect(PAGE_SOURCE).not.toMatch(/redirect/);
    expect(PAGE_SOURCE).not.toMatch(/force-dynamic/);
    expect(PAGE_SOURCE).not.toMatch(/prisma/i);
  });

  it("passes the basics-1 files and solutions with their contents, the policy and the orientation", async () => {
    const page = (await LabPage({ params: { labId: "basics-1" } })) as ReactElement<{ children: ReactElement[] }>;
    // Breadcrumbs, the client page, then the practice pager.
    const [trail, element, pager] = React.Children.toArray(page.props.children) as [
      ReactElement<{ items: { label: string; href?: string }[] }>,
      ReactElement<ClientProps>,
      ReactElement<{ pager: { section: { href: string } } }>,
    ];
    expect(trail.props.items.map((item) => item.label)).toEqual(["Practice", "Labs", "Refactor Repeated Stimulus into a Task"]);
    expect(trail.props.items[1].href).toBe("/practice#labs");
    expect(pager.props.pager.section.href).toBe("/practice#labs");
    expect(element.type).toBe(LabClientPage);
    const { lab, policy, files, solutions, backLink, lessons, prerequisites } = element.props;

    expect(lab).toMatchObject({ id: "basics-1", version: "2", title: "Refactor Repeated Stimulus into a Task" });
    expect(lab).not.toHaveProperty("assets");
    expect(policy).toEqual(expect.objectContaining({
      id: "basics-1",
      version: "2",
      graderId: "sv-basics-v2",
      editablePaths: ["work/dut_counter.sv", "work/tb_counter_unrefactored.sv"],
    }));
    expect(files.map((file: LabFileDto) => file.path)).toEqual([
      "README.md",
      "work/dut_counter.sv",
      "work/tb_counter_unrefactored.sv",
    ]);
    expect(solutions.map((file: LabFileDto) => file.path)).toEqual(["solution/tb_counter_refactored.sv"]);
    for (const file of [...files, ...solutions]) expect(file.content.length).toBeGreaterThan(0);
    expect(files.find((file) => file.path === "work/tb_counter_unrefactored.sv")?.content).toContain("module tb_counter_unrefactored");
    expect(solutions[0].content).toContain("task automatic drive_sequence");
    expect(backLink.href).toMatch(/^\/curriculum\//);
    expect(Array.isArray(lessons)).toBe(true);
    expect(prerequisites).toHaveProperty("items");

    // Everything travels as props, so it must survive serialization unchanged.
    expect(JSON.parse(JSON.stringify(element.props))).toEqual(element.props);
  });

  it("404s an unknown or coming-soon lab through the notFound guard", async () => {
    await expect(LabPage({ params: { labId: "this-is-not-a-lab" } })).rejects.toThrow(/NEXT_NOT_FOUND/);
    for (const lab of getAllLabs().filter((entry) => entry.status !== "available")) {
      await expect(LabPage({ params: { labId: lab.id } }), lab.id).rejects.toThrow(/NEXT_NOT_FOUND/);
    }
  });

  it("keeps the lab's metadata and canonical URL", () => {
    expect(generateMetadata({ params: { labId: "basics-1" } })).toMatchObject({
      title: "Refactor Repeated Stimulus into a Task",
      alternates: { canonical: "/practice/lab/basics-1" },
    });
    expect(generateMetadata({ params: { labId: "nope" } })).toEqual({});
  });
});
