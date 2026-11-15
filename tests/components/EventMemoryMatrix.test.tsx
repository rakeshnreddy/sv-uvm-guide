import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EventMemoryMatrix from "@/components/visuals/EventMemoryMatrix";
import {
  cellExplanation,
  matrixTakeaway,
  memorySpan,
  nextSuggestedCell,
  predictionFeedback,
  runEventMemoryCell,
  timeStepOrder,
  VERDICT_LABELS,
} from "@/lib/sv-event-memory-scenarios";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const cellButton = (name: RegExp) => screen.getByRole("button", { name });

describe("EventMemoryMatrix", () => {
  it("renders a 4 by 3 matrix of buttons inside the frame, all unrevealed", () => {
    render(<EventMemoryMatrix />);
    expect(screen.getByRole("region", { name: "Event memory matrix" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("button")).toHaveLength(12);
    expect(within(table).getAllByRole("button", { name: /not revealed yet/ })).toHaveLength(12);
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("0 of 12 revealed");
  });

  it("opens the preset's cell and hides the answer until a prediction is locked in", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    expect(cellButton(/^wait \(flag\), Starts at 50 ns/)).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("list", { name: "The code this cell runs" })).toHaveTextContent("#50 wait (flag);");
    expect(screen.queryByRole("group", { name: /Outcomes across/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Log of this run" })).not.toBeInTheDocument();
    expect(screen.queryByText(cellExplanation(runEventMemoryCell("flag", 50)))).not.toBeInTheDocument();
  });

  it("a right prediction fills the cell and shows the model's evidence", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    lockIn(/Passes/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(cellExplanation(runEventMemoryCell("flag", 50))).length).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Log of this run" })).toHaveTextContent("waiter passed");
    expect(screen.getByTestId("memory-span")).toHaveTextContent(memorySpan("flag", runEventMemoryCell("flag", 50).runs[0].result).text);
    expect(cellButton(/^wait \(flag\), Starts at 50 ns.*passes, you predicted it/)).toBeInTheDocument();
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("1 of 12 revealed");
  });

  it("a wrong prediction is diagnosed from the run", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    fireEvent.click(cellButton(/^wait \(ev\.triggered\), Starts at 50 ns/));
    lockIn(/Passes/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(predictionFeedback(runEventMemoryCell("triggered", 50), "passes"))).toBeInTheDocument();
    expect(cellButton(/^wait \(ev\.triggered\), Starts at 50 ns.*blocks forever, you predicted passes/)).toBeInTheDocument();
  });

  it("the order-dependent cell shows both outcomes and lets the learner load either run", () => {
    render(<EventMemoryMatrix preset="named-event-mistakes" />);
    expect(cellButton(/^@\(ev\), Starts at 20 ns/)).toHaveAttribute("aria-current", "true");
    lockIn(/Depends on order/);
    expect(screen.getByText("Scheduler choice")).toBeInTheDocument();
    const cards = screen.getAllByRole("button", { name: /Waiter (passes at 20 ns|stays blocked)/ });
    expect(cards).toHaveLength(2);
    const blocked = screen.getByRole("button", { name: /Waiter stays blocked/ });
    fireEvent.click(blocked);
    expect(blocked).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Log of this run" })).not.toHaveTextContent("waiter passed");
    fireEvent.click(screen.getByRole("button", { name: /Waiter passes at 20 ns/ }));
    expect(screen.getByRole("list", { name: "Log of this run" })).toHaveTextContent("waiter passed");
  });

  it("revealing without a prediction records the cell as skipped", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(cellButton(/^wait \(flag\), Starts at 50 ns.*revealed without a prediction/)).toBeInTheDocument();
  });

  it("coming back to a revealed cell shows the answer and the learner's prediction, not a new prompt", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    lockIn(/Blocks forever/);
    fireEvent.click(cellButton(/^@\(ev\), Waiting since 0 ns/));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    fireEvent.click(cellButton(/^wait \(flag\), Starts at 50 ns/));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Your prediction: Blocks forever\./)).toBeInTheDocument();
    expect(screen.getByTestId("cell-explanation")).toHaveTextContent(cellExplanation(runEventMemoryCell("flag", 50)));
  });

  it("arrow keys move between cells", () => {
    render(<EventMemoryMatrix preset="named-event-mistakes" />);
    const start = cellButton(/^@\(ev\), Starts at 20 ns/);
    act(() => start.focus());
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(cellButton(/^@\(ev\), Starts at 50 ns/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(cellButton(/^wait \(ev\.triggered\), Starts at 50 ns/)).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(cellButton(/^wait \(ev\.triggered\), Waiting since 0 ns/)).toHaveFocus();
  });

  it("shows the takeaway only when the matrix is complete, and can start over", () => {
    render(<EventMemoryMatrix />);
    expect(screen.queryByTestId("matrix-takeaway")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal all 12 cells" }));
    expect(screen.getByTestId("matrix-takeaway")).toHaveTextContent(matrixTakeaway());
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("12 of 12 revealed");
    expect(within(screen.getByRole("table")).getAllByRole("button", { name: /blocks forever/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Clear the matrix and start over" }));
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("0 of 12 revealed");
    expect(screen.queryByTestId("matrix-takeaway")).not.toBeInTheDocument();
  });

  it("speaks the verdict on a reveal from a live region that was mounted before the reveal", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    const status = screen.getByTestId("matrix-status");
    // Mounted empty with the component, so a later change is announced.
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/^$/);
    lockIn(/Passes/);
    const verdict = VERDICT_LABELS[runEventMemoryCell("flag", 50).verdict];
    expect(screen.getByTestId("matrix-status")).toBe(status);
    expect(status).toHaveTextContent(`wait (flag), Starts at 50 ns (late): ${verdict}. 1 of 12 cells revealed.`);
  });

  it("speaks the verdict when a cell is revealed without a prediction", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const verdict = VERDICT_LABELS[runEventMemoryCell("flag", 50).verdict];
    expect(screen.getByTestId("matrix-status")).toHaveTextContent(`wait (flag), Starts at 50 ns (late): ${verdict}.`);
  });

  it("selecting a revealed cell keeps the focus on the matrix and names its answer in the status line", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    lockIn(/Passes/);
    const other = cellButton(/^@\(ev\), Waiting since 0 ns/);
    fireEvent.click(other);
    const back = cellButton(/^wait \(flag\), Starts at 50 ns/);
    act(() => back.focus());
    fireEvent.click(back);
    expect(back).toHaveFocus();
    expect(screen.getByTestId("matrix-status")).toHaveTextContent("wait (flag), Starts at 50 ns (late): Passes.");
  });

  it("moves the focus to the run's heading after a prediction is locked in", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    lockIn(/Passes/);
    expect(screen.getByRole("heading", { name: "What the model ran" })).toHaveFocus();
  });

  it("revealing every cell moves the focus to the takeaway", () => {
    render(<EventMemoryMatrix />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal all 12 cells" }));
    expect(screen.getByRole("heading", { name: "The completed matrix" })).toHaveFocus();
  });

  it("says 'Reveal all' before any reveal and 'the other N' after one", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    expect(screen.getByRole("button", { name: "Reveal all 12 cells" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reveal the other/ })).not.toBeInTheDocument();
    lockIn(/Passes/);
    expect(screen.getByRole("button", { name: "Reveal the other 11 cells" })).toBeInTheDocument();
  });

  it("clearing after predicting the start cell brings its prompt back", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    lockIn(/Passes/);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear the matrix and start over" }));
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("0 of 12 revealed");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Log of this run" })).not.toBeInTheDocument();
    expect(cellButton(/^wait \(flag\), Starts at 50 ns/)).toHaveFocus();
    // The new prediction is counted again.
    lockIn(/Blocks forever/);
    expect(screen.getByTestId("matrix-progress")).toHaveTextContent("1 of 12 revealed");
    expect(cellButton(/^wait \(flag\), Starts at 50 ns.*passes, you predicted blocks forever/)).toBeInTheDocument();
  });

  it("only the current cell is in the tab order", () => {
    render(<EventMemoryMatrix preset="named-event-mistakes" />);
    const buttons = within(screen.getByRole("table")).getAllByRole("button");
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "0")).toEqual([cellButton(/^@\(ev\), Starts at 20 ns/)]);
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "-1")).toHaveLength(11);
    buttons.forEach((b) => expect(b).not.toHaveAttribute("aria-pressed"));
    fireEvent.click(cellButton(/^wait \(flag\), Waiting since 0 ns/));
    expect(cellButton(/^wait \(flag\), Waiting since 0 ns/)).toHaveAttribute("tabindex", "0");
    expect(cellButton(/^@\(ev\), Starts at 20 ns/)).toHaveAttribute("tabindex", "-1");
  });

  it("roving tabindex follows the arrow keys, so Tab back into the grid lands on the last cell focused", () => {
    render(<EventMemoryMatrix preset="named-event-mistakes" />);
    const start = cellButton(/^@\(ev\), Starts at 20 ns/);
    act(() => start.focus());
    fireEvent.keyDown(start, { key: "ArrowRight" });
    const moved = cellButton(/^@\(ev\), Starts at 50 ns/);
    expect(moved).toHaveFocus();
    const buttons = within(screen.getByRole("table")).getAllByRole("button");
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "0")).toEqual([moved]);
    // Moving the focus does not select: the current cell stays the start cell.
    expect(start).toHaveAttribute("aria-current", "true");
    expect(moved).not.toHaveAttribute("aria-current");
  });

  it("after a reveal it offers the next cell on the path, named by its setup only", () => {
    render(<EventMemoryMatrix preset="late-arrival" />);
    expect(screen.queryByTestId("try-next")).not.toBeInTheDocument();
    lockIn(/Passes/);
    const next = nextSuggestedCell(["flag:50"]);
    expect(next).toMatchObject({ form: "at-event", waiterStart: 20 });
    const tryNext = screen.getByTestId("try-next");
    expect(tryNext).toHaveTextContent(`Try next: ${next?.label}: ${next?.hint}.`);
    expect(tryNext).not.toHaveTextContent(/passes|blocks|depends/i);
    fireEvent.click(within(tryNext).getByRole("button"));
    expect(cellButton(/^@\(ev\), Starts at 20 ns/)).toHaveAttribute("aria-current", "true");
    expect(cellButton(/^@\(ev\), Starts at 20 ns/)).toHaveFocus();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeInTheDocument();
  });

  it("the memory lane draws ev.triggered as a time-step bracket, unlike the instant of @(ev)", () => {
    const { unmount } = render(<EventMemoryMatrix preset="named-event-mistakes" />);
    lockIn(/Depends on order/);
    expect(screen.getByTestId("memory-mark-instant")).toBeInTheDocument();
    expect(screen.queryByTestId("memory-mark-time-step")).not.toBeInTheDocument();
    expect(screen.getByTestId("memory-label")).toHaveTextContent(memorySpan("at-event", runEventMemoryCell("at-event", 20).runs[0].result).label);
    unmount();
    render(<EventMemoryMatrix preset="named-event-mistakes" />);
    fireEvent.click(cellButton(/^wait \(ev\.triggered\), Starts at 20 ns/));
    lockIn(/Passes/);
    expect(screen.getByTestId("memory-mark-time-step")).toBeInTheDocument();
    expect(screen.queryByTestId("memory-mark-instant")).not.toBeInTheDocument();
    const run = runEventMemoryCell("triggered", 20).runs[0].result;
    expect(screen.getByTestId("memory-label")).toHaveTextContent(memorySpan("triggered", run).label);
    const order = screen.getByRole("list", { name: "Inside the 20 ns time step" });
    expect(within(order).getAllByRole("listitem").map((li) => li.textContent)).toEqual(timeStepOrder(run));
  });
});
