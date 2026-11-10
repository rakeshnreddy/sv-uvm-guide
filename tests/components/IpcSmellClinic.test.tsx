import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IpcSmellClinic from "@/components/visuals/IpcSmellClinic";
import { buildTriageRound, deadlockStory, nextOrderSeed, repairSummary, shuffledSmells, SMELLS } from "@/lib/sv-ipc-smell-scenarios";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const scrubToEnd = () => {
  const slider = screen.getByRole("slider", { name: /process step scrubber/i });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
};

describe("IpcSmellClinic · triage", () => {
  const first = shuffledSmells(0)[0];
  const round = buildTriageRound(first);

  it("shows the run's evidence but hides the code until a shape is named", () => {
    render(<IpcSmellClinic />);
    expect(screen.getByRole("region", { name: /name the failure shape/i })).toBeInTheDocument();
    expect(screen.getByText("Round 1 of 5")).toBeInTheDocument();
    expect(screen.getByText(`t = ${round.result.endTime} ns`)).toBeInTheDocument();
    expect(screen.getByText(round.evidence.endingText)).toBeInTheDocument();
    expect(screen.queryByText(/The code \(where each blocked process is stuck\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(SMELLS[first].rule)).not.toBeInTheDocument();
  });

  it("reveals the code, the clause and the fix after the learner names the shape, then reruns with the fix", () => {
    render(<IpcSmellClinic mode="triage" />);
    lockIn(SMELLS[first].name);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Score: 1 of 1 named")).toBeInTheDocument();
    expect(screen.getByText(SMELLS[first].rule)).toBeInTheDocument();
    expect(screen.getAllByText(/The code \(where each blocked process is stuck\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(SMELLS[first].fix)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply fix and rerun/i }));
    expect(screen.getByText(repairSummary(round))).toBeInTheDocument();
    expect(repairSummary(round)).toMatch(/^Repaired: /);
    expect(screen.getByRole("list", { name: "Log after the fix" })).toBeInTheDocument();
  });

  it("explains a wrong name with the run's evidence", () => {
    render(<IpcSmellClinic />);
    const wrong = first === "starved-consumer" ? "missed-trigger" : "starved-consumer";
    lockIn(SMELLS[wrong].name);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^${SMELLS[wrong].name} would show`))).toBeInTheDocument();
  });

  it("offers three hints one at a time and moves to the next round", () => {
    render(<IpcSmellClinic />);
    fireEvent.click(screen.getByRole("button", { name: /need a hint/i }));
    expect(screen.getByText(SMELLS[first].hints[0])).toBeInTheDocument();
    expect(screen.queryByText(SMELLS[first].hints[1])).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(screen.getByText("Round 2 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("'Play again in a new order' really starts a different order", () => {
    render(<IpcSmellClinic />);
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(screen.getByText("Round 5 of 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /play again in a new order/i }));
    expect(screen.getByText("Round 1 of 5")).toBeInTheDocument();
    const replay = shuffledSmells(nextOrderSeed(0));
    expect(replay).not.toEqual(shuffledSmells(0));
    expect(screen.getByText(buildTriageRound(replay[0]).evidence.endingText)).toBeInTheDocument();
  });
});

describe("IpcSmellClinic · deadlock", () => {
  it("hides the wait-for graph until the prediction, then closes the cycle in the stepper", () => {
    render(<IpcSmellClinic mode="deadlock" />);
    expect(screen.queryByRole("img", { name: /wait-for graph/i })).not.toBeInTheDocument();
    lockIn(/Hangs: both processes stay blocked forever/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /wait-for graph at t = 0 ns/i })).toBeInTheDocument();
    scrubToEnd();
    expect(screen.getByText(/^Cycle closed at t = 5 ns: proc_b waits for s1, held by proc_a/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /wait-for graph at t = 5 ns/i })).toHaveAccessibleName(/The graph has a closed cycle/);
    expect(screen.getAllByText(/model bookkeeping: a semaphore does not track owners/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "Outcomes across every order of the ready processes" })).toHaveTextContent("Both stay blocked");
  });

  it("re-asks when proc_b starts at 10 ns from the keyboard, and both finish without a cycle", () => {
    render(<IpcSmellClinic mode="deadlock" />);
    lockIn(/Hangs/);
    const delays = screen.getByRole("radiogroup", { name: "proc_b start delay" });
    fireEvent.keyDown(within(delays).getByRole("radio", { name: "0 ns" }), { key: "ArrowRight" });
    expect(within(delays).getByRole("radio", { name: "10 ns" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn("Both finish");
    expect(screen.getByText(deadlockStory({ order: "opposite", startDelay: 10 }).explanation)).toBeInTheDocument();
    scrubToEnd();
    expect(screen.getByText("No cycle in the wait-for graph at t = 15 ns.")).toBeInTheDocument();
  });

  it("the same order queues proc_b FIFO behind proc_a", () => {
    render(<IpcSmellClinic mode="deadlock" />);
    fireEvent.click(screen.getByRole("radio", { name: "s1, then s2" }));
    lockIn("Both finish");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: /process step scrubber/i });
    const story = deadlockStory({ order: "same", startDelay: 0 });
    const queued = story.result.trace.findIndex((s) => s.semaphores.s1.waiters.some((w) => w.label === "proc_b"));
    fireEvent.change(slider, { target: { value: String(queued) } });
    expect(screen.getByText(/Waiting \(FIFO\): 1\. proc_b needs 1/)).toBeInTheDocument();
  });
});

describe("IpcSmellClinic · kata", () => {
  it("gates the starter's outcomes behind the prediction, then toggles each fix on its own", () => {
    render(<IpcSmellClinic mode="kata" />);
    expect(screen.queryByRole("group", { name: /starter outcomes/i })).not.toBeInTheDocument();
    lockIn(/It depends on which process the scheduler runs first/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const starter = screen.getByRole("group", { name: /starter outcomes/i });
    expect(within(starter).getByText(/2 different outcomes from 24 legal orders/)).toBeInTheDocument();
    expect(within(starter).getAllByText(/chk blocked in get\(\) #4/).length).toBe(2);

    const status = screen.getByRole("list", { name: "Smells in this version" });
    expect(status).toHaveTextContent("Starved consumer: present in 24 of 24 orders");
    expect(status).toHaveTextContent("Missed trigger: present in 12 of 24 orders");

    fireEvent.click(screen.getByRole("checkbox", { name: /N shared/ }));
    expect(status).toHaveTextContent("Starved consumer: gone in all 24 orders");
    expect(status).toHaveTextContent("Missed trigger: present in 12 of 24 orders");

    fireEvent.click(screen.getByRole("checkbox", { name: /waited from 0 ns/ }));
    expect(status).toHaveTextContent("Missed trigger: gone in all 12 orders");
    expect(screen.getByText(/Both smells are gone: every one of the 12 orders prints all 5 lines/)).toBeInTheDocument();
  });
});
