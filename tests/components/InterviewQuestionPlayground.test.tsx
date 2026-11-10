import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InterviewQuestionPlayground, { normalizePlaygroundOptions, optionClassName } from "@/components/curriculum/interactives/InterviewQuestionPlayground";

describe("InterviewQuestionPlayground", () => {
  it("normalizes the MDX authoring shape { text, isCorrect, feedback }", () => {
    const options = normalizePlaygroundOptions([
      { text: "A", isCorrect: false, feedback: "no" },
      { text: "B", isCorrect: true, feedback: "yes" },
    ]);
    expect(options.map((o) => [o.id, o.label, o.isCorrect, o.explanation])).toEqual([
      ["option-0", "A", false, "no"],
      ["option-1", "B", true, "yes"],
    ]);
  });

  it("renders authored options as selectable answers with their feedback", () => {
    render(
      <InterviewQuestionPlayground
        question="Which wins?"
        options={[
          { text: "Wrong answer", isCorrect: false, feedback: "Diagnosis for wrong" },
          { text: "Right answer", isCorrect: true, feedback: "Diagnosis for right" },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Wrong answer"));
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    expect(screen.getAllByText("Diagnosis for wrong").length).toBeGreaterThan(0);
  });

  it("sits on tokens: card surface, foreground heading, muted icon chip and a sentence-case secondary submit", () => {
    render(<InterviewQuestionPlayground title="Interview angle" question="Q?" options={[{ text: "A", isCorrect: true, feedback: "ok" }]} />);
    const card = screen.getByTestId("interview-playground");
    expect(card).toHaveClass("bg-card", "border-border");
    expect(card.className).not.toMatch(/slate-|blue-/);
    expect(screen.getByRole("heading", { level: 3, name: "Interview angle" })).toHaveClass("text-foreground");
    expect(screen.getByTestId("interview-playground-icon")).toHaveClass("bg-muted");
    const submit = screen.getByRole("button", { name: "Submit answer" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveClass("bg-secondary");
    expect(submit).not.toHaveClass("bg-primary");
  });

  it("marks the selected option with the raised surface and a 2 px accent leading edge", () => {
    const selected = optionClassName({ isSelected: true, hasSubmitted: false, showSuccess: false, showFailure: false, isCorrect: false });
    expect(selected).toContain("bg-muted");
    expect(selected).toContain("border-l-2");
    expect(selected).toContain("border-l-primary");
    const idle = optionClassName({ isSelected: false, hasSubmitted: false, showSuccess: false, showFailure: false, isCorrect: false });
    expect(idle).toContain("bg-card");
    expect(idle).not.toContain("border-l-primary");
    expect(optionClassName({ isSelected: true, hasSubmitted: true, showSuccess: false, showFailure: true, isCorrect: false })).toContain("bg-danger-subtle");
    expect(optionClassName({ isSelected: false, hasSubmitted: true, showSuccess: true, showFailure: false, isCorrect: true })).toContain("bg-success-subtle");
  });
});
