import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExpressionTreeExplorer from "@/components/visuals/ExpressionTreeExplorer";
import {
  EXCLUDED_NOTE,
  GROUPING_UNAVAILABLE,
  analyzePrecedence,
  analyzeWidth,
  findPrecedencePreset,
  findWidthPreset,
  nodeSummary,
  widthOptions,
} from "@/lib/sv-expression-tree-presets";

const lockIn = (question: RegExp, option: RegExp | string) => {
  const group = screen.getByRole("group", { name: question });
  fireEvent.click(within(group).getByLabelText(option));
  const prompt = group.parentElement as HTMLElement;
  fireEvent.click(within(prompt).getByRole("button", { name: /lock in prediction/i }));
};
const stepToEnd = (noun: string, count: number) => {
  for (let i = 0; i < count; i += 1) fireEvent.click(screen.getByRole("button", { name: `Next ${noun}` }));
};

describe("ExpressionTreeExplorer, precedence mode", () => {
  it("hides the tree and the value until a prediction is committed", () => {
    render(<ExpressionTreeExplorer />);
    expect(screen.getByRole("region", { name: /precedence and associativity/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Parse tree/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Predict: .* is applied last$/ })).toHaveLength(2);
  });

  it("tapping the root operator is graded correct and reveals the tree, which builds bottom-up to the model's result", () => {
    const a = analyzePrecedence(findPrecedencePreset("flags-mask"));
    render(<ExpressionTreeExplorer mode="precedence" />);
    fireEvent.click(screen.getByRole("button", { name: "Predict: & (operator 1) is applied last" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Parse tree of flags & mask == 0, built bottom-up" })).toBeInTheDocument();
    // Only the first leaf is evaluated at first.
    const first = a.actual.layout.nodes[0];
    expect(screen.getAllByRole("button", { name: nodeSummary(first) }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /not evaluated yet/ }).length).toBe(a.actual.layout.nodes.length - 1);
    stepToEnd("node", a.actual.layout.nodes.length - 1);
    expect(screen.getByText(/4'b0000 \(0\): the if branch does not run\./)).toBeInTheDocument();
  });

  it("a wrong tap explains which operator consumes it", () => {
    render(<ExpressionTreeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Predict: == (operator 2) is applied last" }));
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getByText(/`==` is applied before `&`/)).toBeInTheDocument();
  });

  it("Add parentheses rewrites the source and shows the answer flip", () => {
    const a = analyzePrecedence(findPrecedencePreset("flags-mask"));
    render(<ExpressionTreeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "Add parentheses" }));
    expect(screen.getByText(a.flip)).toBeInTheDocument();
    expect(screen.getByText("if ((flags & mask) == 0)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show as written" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the grouping method grades a parenthesization and explains with Table 11-2 rows", () => {
    render(<ExpressionTreeExplorer preset="power-chain" />);
    fireEvent.click(screen.getByRole("radio", { name: "Choose the grouping" }));
    lockIn(/Which grouping does the parser build/, "2 ** (3 ** 2)");
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(screen.getAllByText(/share the row "\*\*", which groups left to right/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Tree the author meant/ })).toBeInTheDocument();
  });

  it("nodes are focusable buttons whose names come from the model, and selecting one shows its detail", () => {
    const a = analyzePrecedence(findPrecedencePreset("unary-power"));
    render(<ExpressionTreeExplorer preset="unary-power" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const root = a.intended.layout.root;
    const btn = screen.getByRole("button", { name: nodeSummary(root) });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("a typed expression with an excluded operator shows the note instead of a tree", () => {
    render(<ExpressionTreeExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Type your own expression" }));
    fireEvent.change(screen.getByLabelText("Your expression"), { target: { value: "a -> b" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this expression" }));
    expect(screen.getAllByText(new RegExp(EXCLUDED_NOTE.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: /^Predict:/ })).not.toBeInTheDocument();
  });

  it("the error message lives in a live region that is mounted before the message appears", () => {
    render(<ExpressionTreeExplorer preset="custom" />);
    const live = screen.getByTestId("expression-error");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    fireEvent.change(screen.getByLabelText("Your expression"), { target: { value: "--a" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this expression" }));
    expect(screen.getByTestId("expression-error")).toBe(live);
    expect(live).toHaveTextContent(EXCLUDED_NOTE);
    expect(live).toHaveTextContent("§11.4.2");
  });

  it("a typed ^~ expression keeps the learner's spelling and still offers groupings", () => {
    render(<ExpressionTreeExplorer preset="custom" />);
    fireEvent.change(screen.getByLabelText("Your expression"), { target: { value: "a ^~ b == c" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this expression" }));
    expect(screen.getByRole("button", { name: "Predict: ^~ (operator 1) is applied last" })).toBeInTheDocument();
    const grouping = screen.getByRole("radio", { name: "Choose the grouping" });
    expect(grouping).not.toBeDisabled();
    fireEvent.click(grouping);
    const group = screen.getByRole("group", { name: /Which grouping does the parser build/ });
    expect(within(group).getAllByRole("radio").length).toBeGreaterThanOrEqual(2);
  });

  it("when the tokens allow only one grouping, Choose the grouping is off and says why", () => {
    render(<ExpressionTreeExplorer preset="custom" />);
    fireEvent.change(screen.getByLabelText("Your expression"), { target: { value: "(a + b) * c" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this expression" }));
    expect(screen.getByRole("radio", { name: "Choose the grouping" })).toBeDisabled();
    expect(screen.getByText(GROUPING_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Predict: * (operator 2) is applied last" })).toBeInTheDocument();
  });

  it("a typed expression gets operator buttons and a tree after the prediction", () => {
    render(<ExpressionTreeExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "Type your own expression" }));
    fireEvent.change(screen.getByLabelText("Your expression"), { target: { value: "a + b * c" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this expression" }));
    fireEvent.click(screen.getByRole("button", { name: "Predict: + (operator 1) is applied last" }));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Parse tree of a + b * c, built bottom-up" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Tree the author meant/ })).not.toBeInTheDocument();
  });
});

describe("ExpressionTreeExplorer, width mode", () => {
  it("asks for the bowl width, then the stored value, before showing any bowl", () => {
    render(<ExpressionTreeExplorer mode="width" preset="s9-concat" />);
    expect(screen.getByRole("region", { name: /expression width/i })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Bowls of the expression" })).not.toBeInTheDocument();
    lockIn(/How wide is the bowl/, "9 bits");
    expect(screen.getByText(/The 9-bit target s9 is outside this bowl/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Bowls of the expression" })).not.toBeInTheDocument();
    lockIn(/What does the target hold/, "s9 = 44");
    expect(screen.getByRole("list", { name: "Bowls of the expression" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /Bowl B2: 8 bits, self-determined, concatenation member/ })).toBeInTheDocument();
  });

  it("steps through context, extend, op and assign, and shows the carry dropped at the addition", () => {
    const w = analyzeWidth(findWidthPreset("s8-shift"));
    render(<ExpressionTreeExplorer mode="width" preset="s8-shift" />);
    lockIn(/How wide is the bowl/, "8 bits");
    lockIn(/What does the target hold/, "s8 = 22");
    expect(screen.getByText(w.steps[0].why)).toBeInTheDocument();
    expect(screen.queryByText(w.carryText)).not.toBeInTheDocument();
    stepToEnd("step", w.steps.length - 1);
    expect(screen.getByText(w.carryText)).toBeInTheDocument();
    expect(screen.getByText(w.steps[w.steps.length - 1].why)).toBeInTheDocument();
  });

  it("the 9-bit {carry, s8} target keeps the carry in carry", () => {
    render(<ExpressionTreeExplorer mode="width" preset="carry-s8" />);
    lockIn(/How wide is the bowl/, "9 bits");
    lockIn(/What does the target hold/, "carry = 1, s8 = 44");
    expect(screen.getAllByText("Correct.")).toHaveLength(2);
    const rootBowl = screen.getByRole("listitem", { name: /Bowl B1: 9 bits, context-determined/ });
    expect(within(rootBowl).getAllByText(/target \{carry, s8\}/).length).toBeGreaterThan(0);
    expect(screen.queryByText("carry = 1, s8 = 44", { selector: "p code" })).not.toBeInTheDocument();
    stepToEnd("step", analyzeWidth(findWidthPreset("carry-s8")).steps.length - 1);
    expect(screen.getByText("carry = 1, s8 = 44", { selector: "p code" })).toBeInTheDocument();
  });

  it("comparison operands get their own bowl, and the contrast switches 255 for 8'd255", () => {
    const w = analyzeWidth(findWidthPreset("flag-255"));
    render(<ExpressionTreeExplorer mode="width" preset="flag-255" />);
    lockIn(/How wide is the bowl/, "32 bits");
    expect(screen.getAllByText(widthOptions(w).find((o) => o.correct)!.feedback).length).toBeGreaterThan(0);
    lockIn(/What does the target hold/, "flag = 1");
    expect(screen.getByRole("listitem", { name: /Bowl B2: 32 bits, comparison operands/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Compare with/ }));
    expect(screen.getByRole("radio", { name: "flag = (a + b > 8'd255);" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("list", { name: "Bowls of the expression" })).not.toBeInTheDocument();
  });
});
