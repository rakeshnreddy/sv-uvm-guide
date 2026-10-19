import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EDITOR_FALLBACK_NOTE } from "@/components/ui/CodeEditor";
import { InteractiveCode, describeTargetLines } from "@/components/ui/InteractiveCode";

const mocks = vi.hoisted(() => ({ blocked: true }));

// next/dynamic hands back a Monaco stand-in that never finishes loading while the loader is blocked.
vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");
  function MockMonaco({ loading, value, options }: { loading?: React.ReactNode; value?: string; options?: { ariaLabel?: string } }) {
    if (mocks.blocked) return ReactModule.createElement("div", null, loading);
    return ReactModule.createElement("pre", { "data-testid": "monaco", "aria-label": options?.ariaLabel }, value);
  }
  return { default: () => MockMonaco };
});

vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  loader: { init: () => (mocks.blocked ? Promise.reject(new Error("CDN blocked")) : new Promise(() => undefined)) },
}));

const CODE = "module counter;\n  logic [3:0] count;\n  always_ff @(posedge clk) count <= count + 1;\nendmodule";

describe("InteractiveCode without Monaco", () => {
  beforeEach(() => {
    mocks.blocked = true;
  });

  it("shows a read-only lesson example in a labelled plain editor, with a note", async () => {
    render(<InteractiveCode code={CODE} fileName="counter.sv" />);
    const textarea = (await screen.findByRole("textbox", { name: "counter.sv (read-only)" })) as HTMLTextAreaElement;
    expect(textarea.value).toBe(CODE);
    expect(textarea.readOnly).toBe(true);
    expect(screen.getByText(EDITOR_FALLBACK_NOTE)).toBeInTheDocument();
  });

  it("names the walkthrough's lines, which the plain editor cannot highlight", async () => {
    render(
      <InteractiveCode
        code={CODE}
        explanationSteps={[
          { target: "2-3", title: "State", explanation: "The counter register." },
          { target: "all", title: "Whole module", explanation: "Everything together." },
          { target: "4", title: "End", explanation: "The module ends." },
        ]}
      />,
    );
    await screen.findByRole("textbox", { name: "Code example (read-only)" });
    expect(screen.getByTestId("interactive-code-target-lines")).toHaveTextContent("Lines 2–3");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText("Everything together.")).toBeInTheDocument();
    expect(screen.queryByTestId("interactive-code-target-lines")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText("The module ends.")).toBeInTheDocument();
    expect(screen.getByTestId("interactive-code-target-lines")).toHaveTextContent("Line 4");
  });

  it("keeps an editable example editable", async () => {
    render(<InteractiveCode code={CODE} isEditable />);
    const textarea = (await screen.findByRole("textbox", { name: "Code example (editable)" })) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "module changed; endmodule" } });
    expect(textarea.value).toBe("module changed; endmodule");
  });

  it("shows no line names while Monaco is the editor", async () => {
    mocks.blocked = false;
    render(<InteractiveCode code={CODE} explanationSteps={[{ target: "2", explanation: "A line." }]} />);
    expect(await screen.findByTestId("monaco")).toHaveAccessibleName("Code example (read-only)");
    expect(screen.queryByTestId("interactive-code-target-lines")).not.toBeInTheDocument();
  });
});

describe("describeTargetLines", () => {
  it("puts a walkthrough target into words", () => {
    expect(describeTargetLines("4")).toBe("Line 4");
    expect(describeTargetLines("3-5")).toBe("Lines 3–5");
    expect(describeTargetLines("1, 3-5,9")).toBe("Lines 1, 3–5, 9");
    expect(describeTargetLines("all")).toBeNull();
    expect(describeTargetLines("ALL")).toBeNull();
    expect(describeTargetLines("")).toBeNull();
    expect(describeTargetLines(undefined)).toBeNull();
    expect(describeTargetLines("abc")).toBeNull();
  });
});
