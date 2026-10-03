import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EventRegionGame, { QUESTIONS } from "@/components/visuals/EventRegionGame";
import { REGION_ORDER, simulateTimeSlot } from "@/lib/sv-scheduler-model";
import { regionLandings, type RegionQuestion } from "@/lib/sv-region-map-model";
import { shiftRegisterScenario } from "@/lib/sv-scheduler-scenarios";

const regionQuestions = QUESTIONS.filter((q): q is RegionQuestion => q.type === "region");

// The key is generated from the scheduler model, so these tests pin the
// model-derived answers to IEEE 1800-2023 §4.4.2 rather than to a hand list.
describe("EventRegionGame answer key (generated from the scheduler model)", () => {
  const answerFor = (id: string) => regionQuestions.find((q) => q.id === id)?.answer;

  it("places nonblocking updates in NBA, their right-hand side in Active (§4.4.2.2, §4.4.2.4)", () => {
    expect(answerFor("nba-update")).toBe("nba");
    expect(answerFor("nba-rhs")).toBe("active");
  });

  it("places clocking-block sampling, events and drives in Preponed, Observed and Re-NBA (§14.13, §14.10, §14.16)", () => {
    expect(answerFor("cb-sample")).toBe("preponed");
    expect(answerFor("cb-event")).toBe("observed");
    expect(answerFor("cb-drive")).toBe("reNba");
  });

  it("places #0 resumes in Inactive / Re-Inactive and program code in Reactive (§4.4.2.3, §4.4.2.7, §24.3.1)", () => {
    expect(answerFor("zero-delay-resume")).toBe("inactive");
    expect(answerFor("program-zero-delay")).toBe("reInactive");
    expect(answerFor("program-code")).toBe("reactive");
    expect(answerFor("strobe")).toBe("postponed");
  });

  it("agrees with a fresh run of the model for the same event", () => {
    const run = simulateTimeSlot(shiftRegisterScenario("nba"));
    const landing = regionLandings(shiftRegisterScenario("nba"), run).find((l) => l.stmtId === "a1" && l.kind === "update");
    expect(answerFor("nba-update")).toBe(landing?.region);
  });

  it("offers every region as an answer somewhere, and never asks about final", () => {
    expect(new Set(regionQuestions.map((q) => q.answer)).size).toBe(REGION_ORDER.length);
    expect(QUESTIONS.some((q) => /\bfinal\b/.test(q.prompt) || q.code.some((l) => /\bfinal\b/.test(l.text)))).toBe(false);
  });
});

describe("EventRegionGame UI", () => {
  const start = () => {
    render(<EventRegionGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start Challenge" }));
  };

  it("offers all nine regions, highlights the line asked about, and gives a model 'why' for a correct pick", () => {
    start();
    const group = screen.getByRole("group", { name: /Scheduling regions/ });
    expect(within(group).getAllByRole("button")).toHaveLength(9);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("q1 = d;");
    fireEvent.click(within(group).getByRole("button", { name: /^Active/ }));
    expect(screen.getByText("Correct!")).toBeInTheDocument();
    expect(screen.getByText(/A blocking assignment updates its target before the next statement runs/)).toBeInTheDocument();
    within(group).getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  });

  it("diagnoses a wrong pick with what that region really holds", () => {
    start();
    fireEvent.click(within(screen.getByRole("group", { name: /Scheduling regions/ })).getByRole("button", { name: /^NBA/ }));
    expect(screen.getByText("Not quite. It lands in Active.")).toBeInTheDocument();
    expect(screen.getByText(/You picked NBA, which holds: The left-hand side updates of nonblocking assignments/)).toBeInTheDocument();
    expect(screen.getByLabelText("your answer, incorrect")).toBeInTheDocument();
  });

  it("can be played to the end with the keyboard-reachable buttons, including the output-order round", () => {
    start();
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const q = QUESTIONS[i];
      if (q.type === "region") {
        const group = screen.getByRole("group", { name: /Scheduling regions/ });
        const label = { preponed: "Preponed", active: "Active", inactive: "Inactive", nba: "NBA", observed: "Observed", reactive: "Reactive", reInactive: "Re-Inactive", reNba: "Re-NBA", postponed: "Postponed" }[q.answer];
        fireEvent.click(within(group).getByRole("button", { name: new RegExp(`^${label}`) }));
      } else {
        const correct = q.options.find((o) => o.correct);
        fireEvent.click(screen.getByRole("button", { name: correct?.label.replace(/\s+/g, " ") }));
      }
      expect(screen.getByText("Correct!")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: i + 1 < QUESTIONS.length ? "Next question" : "See results" }));
    }
    expect(screen.getByText(`${QUESTIONS.length} / ${QUESTIONS.length}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    expect(screen.getByRole("button", { name: "Start Challenge" })).toBeInTheDocument();
  });
});
