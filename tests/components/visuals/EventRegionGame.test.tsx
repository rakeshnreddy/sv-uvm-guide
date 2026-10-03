import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EventRegionGame, { QUESTIONS } from "@/components/visuals/EventRegionGame";

// Mirrors the F2C Playwright flow (tests/e2e/phase9-visuals.spec.ts): start,
// pick Active for the first event, see "Correct!", move on.
describe("EventRegionGame (lesson flow)", () => {
  it("starts from the intro, accepts Active for the first event, and advances", () => {
    render(<EventRegionGame />);
    expect(screen.getByText("Event Region Scheduler")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Scheduling regions/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start challenge/i }));

    expect(screen.getByText(`Question 1/${QUESTIONS.length}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Active/i }));
    expect(screen.getByText("Correct!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText(`Question 2/${QUESTIONS.length}`)).toBeInTheDocument();
    expect(screen.queryByText("Correct!")).not.toBeInTheDocument();
  });
});
