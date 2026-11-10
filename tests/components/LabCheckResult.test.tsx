import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  LabCheckResult,
  defaultResultLabel,
  splitInlineCode,
} from "@/app/(learning)/practice/lab/[labId]/LabCheckResult";

describe("splitInlineCode", () => {
  it("turns backticked spans into code parts", () => {
    expect(splitInlineCode("Declare `task automatic drive_sequence` in `tb_top`.")).toEqual([
      { text: "Declare ", code: false },
      { text: "task automatic drive_sequence", code: true },
      { text: " in ", code: false },
      { text: "tb_top", code: true },
      { text: ".", code: false },
    ]);
  });

  it("leaves plain text and an unpaired backtick alone", () => {
    expect(splitInlineCode("No code here.")).toEqual([{ text: "No code here.", code: false }]);
    expect(splitInlineCode("A lone ` tick")).toEqual([{ text: "A lone ` tick", code: false }]);
    expect(splitInlineCode("")).toEqual([]);
  });
});

describe("LabCheckResult", () => {
  it("keeps an empty polite live region mounted before any result", () => {
    render(<LabCheckResult tone={null} message="" />);
    const region = screen.getByTestId("lab-check-result");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows a failure as a labelled box with inline code, not colour alone", () => {
    render(<LabCheckResult tone="danger" message="Write `task automatic drive_sequence` first." />);
    const box = screen.getByTestId("lab-check-box");
    expect(box).toHaveClass("bg-danger-subtle");
    expect(box).toHaveAttribute("data-tone", "danger");
    expect(within(box).getByTestId("lab-check-label")).toHaveTextContent(defaultResultLabel("danger"));
    expect(within(box).getByTestId("lab-check-label")).toHaveTextContent("Check failed");
    const message = within(box).getByTestId("lab-check-message");
    expect(message).toHaveClass("text-ui");
    expect(message.textContent).toBe("Write task automatic drive_sequence first.");
    expect(within(message).getByText("task automatic drive_sequence").tagName).toBe("CODE");
  });

  it("shows a pass in the success box and accepts a custom label and details", () => {
    render(
      <LabCheckResult tone="success" label="Step complete" message="Step completed. Continue when ready.">
        <ul aria-label="Check details">
          <li>detail</li>
        </ul>
      </LabCheckResult>,
    );
    const box = screen.getByTestId("lab-check-box");
    expect(box).toHaveClass("bg-success-subtle");
    expect(screen.getByTestId("lab-check-label")).toHaveTextContent("Step complete");
    expect(within(box).getByRole("list", { name: "Check details" })).toBeInTheDocument();
    expect(defaultResultLabel("success")).toBe("Check passed");
  });

  it("shows a neutral progress message as plain text without a box", () => {
    render(<LabCheckResult tone={null} message="Checking workspace…" />);
    expect(screen.queryByTestId("lab-check-box")).not.toBeInTheDocument();
    expect(screen.getByTestId("lab-check-message")).toHaveTextContent("Checking workspace…");
  });
});
