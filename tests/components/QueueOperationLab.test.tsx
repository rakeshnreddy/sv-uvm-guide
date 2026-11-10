import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import QueueOperationLab from "@/components/curriculum/f2/QueueOperationLab";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("QueueOperationLab (q[$] vs q[$:N])", () => {
  it("§7.10.5: hides the comparison until the learner predicts push_front on a full bq[$:3]", () => {
    render(<QueueOperationLab />);
    expect(screen.queryByRole("list", { name: /step-by-step comparison/i })).not.toBeInTheDocument();
    // The "blocked push" misconception is one of the options.
    lockIn(/^'\{1, 2, 3, 4\}$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Writes are not blocked or refused/)).toBeInTheDocument();

    const steps = screen.getByRole("list", { name: /step-by-step comparison/i });
    expect(within(steps).getByText(/first divergence/)).toBeInTheDocument();
    const bq = within(steps).getByRole("group", { name: /^bq:/ });
    expect(bq.getAttribute("aria-label")).toMatch(/^bq: \[0\] 9, \[1\] 1, \[2\] 2, \[3\] 3; bound \$:3, room for 0 more; discarded 4$/);
    expect(within(steps).getByText(/Warning \(required\):/)).toBeInTheDocument();
  });

  it("§7.10.5: push_back past the bound drops the new elements and counts each warning", () => {
    render(<QueueOperationLab />);
    fireEvent.click(screen.getByRole("radio", { name: "Burst past the bound" }));
    lockIn(/^'\{1, 2, 3, 4\}$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/2 warnings/)).toBeInTheDocument();
  });

  it("§7.10.2.2: an out-of-range insert index has no effect in either queue", () => {
    render(<QueueOperationLab />);
    fireEvent.click(screen.getByRole("radio", { name: "Insert into a full queue" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    const steps = screen.getByRole("list", { name: /step-by-step comparison/i });
    expect(within(steps).getAllByText(/is out of range, so the call has no effect/).length).toBe(1);
  });

  it("re-asks for a prediction when the program changes, and is keyboard operable", () => {
    render(<QueueOperationLab />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByRole("list", { name: /step-by-step comparison/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
    expect(screen.queryByRole("list", { name: /step-by-step comparison/i })).not.toBeInTheDocument();

    const bound3 = screen.getByRole("radio", { name: /\[\$:3\]/ });
    fireEvent.keyDown(bound3, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /\[\$:4\]/ })).toHaveAttribute("aria-checked", "true");
    // [$:2] cannot hold the 4 initial elements, so it is disabled.
    expect(screen.getByRole("radio", { name: /\[\$:2\]/ })).toBeDisabled();
  });
});

describe("QueueOperationLab scenario 'mixed' (§7.10.2)", () => {
  it("asks for the final queue and popped value before anything runs, and diagnoses insert read as 'after i'", () => {
    render(<QueueOperationLab initialScenario="mixed" />);
    expect(screen.queryByTestId("mixed-steps")).not.toBeInTheDocument();
    lockIn(/^q = '\{0, 1, 2, 9, 7\}; popped v = 3$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/it does not insert after index i/)).toBeInTheDocument();
    expect(screen.getByTestId("mixed-steps")).toBeInTheDocument();
  });

  it("scrubs op by op and marks the index shifts of push_front and insert", () => {
    render(<QueueOperationLab initialScenario="mixed" />);
    lockIn(/^q = '\{0, 1, 9, 2, 7\}; popped v = 3$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const steps = screen.getByTestId("mixed-steps");
    const controls = within(steps).getByRole("group", { name: /Queue step playback controls/ });
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    const shifts = within(steps).getByRole("list", { name: "Index shifts" });
    expect(within(shifts).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1: [0] → [1]", "2: [1] → [2]", "3: [2] → [3]"]);
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    expect(within(within(steps).getByRole("list", { name: "Index shifts" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["2: [2] → [3]", "3: [3] → [4]"]);
    fireEvent.keyDown(controls, { key: "ArrowRight" });
    expect(within(steps).getByText("v = 3")).toBeInTheDocument();
    expect(within(steps).getByText("No surviving item changed index.")).toBeInTheDocument();
  });

  it("offers pop_back-as-front and pop-as-peek misreadings, and switches back to the bounded scenarios", () => {
    render(<QueueOperationLab initialScenario="mixed" />);
    expect(screen.getByLabelText(/^q = '\{1, 9, 2, 3, 7\}; popped v = 0$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^q = '\{0, 1, 9, 2, 3, 7\}; popped v = 3$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Urgent push_front" }));
    expect(screen.getByRole("radio", { name: /\[\$:3\]/ })).toBeInTheDocument();
  });
});

