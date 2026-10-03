import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InterviewQuestionPlayground, { normalizePlaygroundOptions } from "@/components/curriculum/interactives/InterviewQuestionPlayground";

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
});
