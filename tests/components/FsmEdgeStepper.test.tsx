import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FsmEdgeStepper from "@/components/visuals/FsmEdgeStepper";
import {
  LATCH_NOTE,
  SEEDS_OFF_STEPPING_NOTE,
  cellText,
  describeTrafficEdge,
  detectorMachine,
  explainLightAt,
  gradeDetectorGuess,
  latchSummary,
  runDetector,
  runSummary,
  runTraffic,
  trafficMachine,
  trafficVerdict,
} from "@/lib/fsm-stepper-model";

const live = () => screen.getByTestId("fsm-live");
const feedback = () => screen.getByTestId("fsm-feedback");
const activeLine = () => document.querySelector('[aria-current="step"]')?.textContent ?? "";
const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in and step the edge/i }));
const choose = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const revealSkip = () => fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
const waveTable = () => screen.queryByRole("table", { name: /value sampled at each edge/ });
const waveRow = (signal: string) =>
  Array.from(within(waveTable() as HTMLElement).getByRole("rowheader", { name: signal }).parentElement?.querySelectorAll("td") ?? []).map((td) => td.textContent);

describe("FsmEdgeStepper: 101 detector", () => {
  it("opens on edge 0 of the bench pattern with the answer hidden until a prediction is locked in", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    expect(screen.getByRole("region", { name: "FSM edge stepper: the 101 detector" })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Prediction for edge 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in and step the edge/i })).toBeDisabled();
    expect(waveTable()).toBeNull();
    expect(screen.queryByTestId("fsm-feedback")).toBeNull();
    expect(activeLine()).toBe("");
    expect(live()).toHaveTextContent("Edge 0: state S_IDLE, din 1. Predict the next state and detected.");

    choose("S_GOT_1");
    choose("detected 0");
    lockIn();
    const run = runDetector("mealy", [1, 0, 1, 0, 1, 1, 0, 1]);
    const grade = gradeDetectorGuess(run, 0, { next: "S_GOT_1", detected: 0 });
    expect(feedback()).toHaveTextContent(grade.headline);
    expect(feedback()).toHaveTextContent(grade.sentences[2]);
    expect(activeLine()).toContain("S_IDLE:   if (din)  state_next = S_GOT_1;");
    expect(waveRow("state")).toEqual(["S_IDLE"]);
    expect(screen.getByRole("img", { name: /Taken arc: S_IDLE to S_GOT_1 on din 1/ })).toBeInTheDocument();
  });

  it("explains a wrong prediction and highlights the Mealy item at the detection edge", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    revealSkip();
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    revealSkip();
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    // Edge 2: S_GOT_10 with din 1. The prediction prompt does not show edge 2's column yet.
    expect(waveRow("state")).toEqual(["S_IDLE", "S_GOT_1"]);
    choose("S_IDLE");
    choose("detected 0");
    lockIn();
    expect(feedback()).toHaveTextContent("Not quite: the next state is S_GOT_1 (you said S_IDLE) and detected is 1 (you said 0).");
    expect(feedback()).toHaveTextContent("Bits 1 to 3 are 1 0 1.");
    expect(activeLine()).toContain("if (din) state_next = S_GOT_1;");
    expect(waveRow("detected")).toEqual(["0", "0", "1"]);
  });

  it("stepping the whole bench reproduces the lesson's waveform columns", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    for (let k = 0; k < 8; k += 1) {
      revealSkip();
      if (k < 7) fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    }
    expect(waveRow("state")).toEqual(["S_IDLE", "S_GOT_1", "S_GOT_10", "S_GOT_1", "S_GOT_10", "S_GOT_1", "S_GOT_1", "S_GOT_10"]);
    expect(waveRow("detected")).toEqual(["0", "0", "1", "0", "1", "0", "0", "1"]);
    expect(feedback()).toHaveTextContent(runSummary(runDetector("mealy", [1, 0, 1, 0, 1, 1, 0, 1])));
    expect(screen.queryByRole("button", { name: "Next edge" })).toBeNull();
  });

  it("the 10101 overlap preset counts two detections", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" preset="overlap" />);
    for (let k = 0; k < 5; k += 1) {
      revealSkip();
      if (k < 4) fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    }
    expect(feedback()).toHaveTextContent("5 edges, 2 detections.");
    expect(feedback()).toHaveTextContent(/Overlapping matches count/);
  });

  it("break it: removing the seeds pauses stepping and marks every unassigned cell", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /remove the seed lines/i }));
    expect(screen.queryByRole("group", { name: /Prediction for edge/ })).toBeNull();
    const summary = latchSummary(detectorMachine("mealy"), false);
    expect(screen.getByText(summary, { ignore: '[role="status"]' })).toBeInTheDocument();
    expect(live()).toHaveTextContent(summary);
    expect(screen.getByText(SEEDS_OFF_STEPPING_NOTE)).toBeInTheDocument();
    expect(screen.getByText(`⚠ An unassigned output ${LATCH_NOTE}.`)).toBeInTheDocument();
    expect(document.body.textContent).toContain("// removed: state_next = state;");
    const table = screen.getByRole("table", { name: /Every arc as a table/ });
    const idle = within(table).getByRole("rowheader", { name: "S_IDLE" }).parentElement as HTMLElement;
    expect(idle.querySelectorAll("td")[0].textContent).toMatch(/state_next, detected unassigned/);
    // Seeds off: a missing output is shown as holding its old value, never as a known value.
    expect(idle.querySelectorAll("td")[0].textContent).toBe("state_next holds old value, detected holds old value⚠ state_next, detected unassigned");
    expect(idle.querySelectorAll("td")[1].textContent).toBe("S_GOT_1, detected holds old value⚠ detected unassigned");
    const noMatch = within(table).getByRole("rowheader", { name: "x or 2'b11" }).parentElement as HTMLElement;
    const off = cellText(detectorMachine("mealy"), "x", 0, false);
    expect(noMatch.querySelectorAll("td")[0].textContent).toBe(`${off.main}⚠ ${off.warning}`);
    const got10 = within(table).getByRole("rowheader", { name: "S_GOT_10" }).parentElement as HTMLElement;
    expect(got10.textContent).not.toMatch(/unassigned/);
  });

  it("the Moore toggle adds S_FOUND and delays detected by one edge", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    fireEvent.click(screen.getByRole("radio", { name: "Moore: add S_FOUND" }));
    expect(document.body.textContent).toContain("{S_IDLE, S_GOT_1, S_GOT_10, S_FOUND}");
    for (let k = 0; k < 4; k += 1) {
      revealSkip();
      fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    }
    expect(waveRow("detected")).toEqual(["0", "0", "0", "1"]);
    expect(waveRow("state")[3]).toBe("S_FOUND");
    expect(screen.getByRole("radio", { name: "S_FOUND" })).toBeInTheDocument();
  });

  it("typed streams: x is refused with a visible reason, and 1001 selects its preset", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    const input = screen.getByRole("textbox", { name: /Type a stream/ });
    fireEvent.change(input, { target: { value: "10x1" } });
    fireEvent.click(screen.getByRole("button", { name: "Use stream" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/"x" is not 0 or 1/);
    fireEvent.change(input, { target: { value: "1 0 0 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Use stream" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("radio", { name: "1001" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { name: /^din bit/ })).toHaveLength(4);
  });

  it("toggling a din bit starts the stepping over on the new stream", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    revealSkip();
    expect(waveTable()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "din bit 1 (edge 0): 1. Toggle." }));
    expect(waveTable()).toBeNull();
    expect(live()).toHaveTextContent("Edge 0: state S_IDLE, din 0.");
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("FsmEdgeStepper: 101 detector table, review and input", () => {
  it("the seeded table's no-match row says the seed keeps the select's own value (12.5)", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    const table = screen.getByRole("table", { name: /Every arc as a table/ });
    const noMatch = within(table).getByRole("rowheader", { name: "x or 2'b11" }).parentElement as HTMLElement;
    const cells = Array.from(noMatch.querySelectorAll("td")).map((td) => td.textContent);
    const text = "no item runs (12.5); the seeds give state_next = state (x stays x, 2'b11 stays 2'b11), detected = 0";
    expect(cells).toEqual([text, text]);
    expect(cellText(detectorMachine("mealy"), "x", 0, true).main).toBe(text);
  });

  it("reviewing a revealed edge hides the open prediction, so only one edge is on screen", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    revealSkip();
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    expect(screen.getByRole("group", { name: "Prediction for edge 1" })).toHaveTextContent("Edge 1 (bit 2 of 8): what does the always_comb compute?");
    fireEvent.click(screen.getByRole("button", { name: "Select edge 0" }));
    expect(screen.queryByRole("group", { name: /Prediction for edge/ })).toBeNull();
    expect(live()).toHaveTextContent("Reviewing: Edge 0: state S_IDLE, din 1.");
    fireEvent.click(screen.getByRole("button", { name: "Back to stepping" }));
    expect(screen.getByRole("group", { name: "Prediction for edge 1" })).toBeInTheDocument();
  });

  it("choosing Custom keeps the stream and moves focus to the stream input", () => {
    render(<FsmEdgeStepper machine="seq-detect-101" />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: /Type a stream/ })).toHaveFocus();
    expect(screen.getAllByRole("button", { name: /^din bit/ })).toHaveLength(8);
  });

  it("two detectors on one page keep their own error ids", () => {
    render(
      <>
        <FsmEdgeStepper machine="seq-detect-101" />
        <FsmEdgeStepper machine="seq-detect-101" />
      </>,
    );
    const inputs = screen.getAllByRole("textbox", { name: /Type a stream/ });
    const buttons = screen.getAllByRole("button", { name: "Use stream" });
    inputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: "2" } });
      fireEvent.click(buttons[i]);
    });
    const ids = inputs.map((input) => input.getAttribute("aria-describedby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    ids.forEach((id) => expect(document.getElementById(id as string)).toHaveAttribute("role", "alert"));
  });
});

describe("FsmEdgeStepper: traffic light", () => {
  it("hides the run until the predictions are locked in, then grades both", () => {
    render(<FsmEdgeStepper machine="traffic-light" />);
    expect(screen.getByRole("region", { name: "FSM edge stepper: the traffic-light controller" })).toBeInTheDocument();
    expect(waveTable()).toBeNull();
    expect(screen.queryByTestId("fsm-log")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d edges?\b(?! to)/);
    const lock = screen.getByRole("button", { name: "Lock in prediction" });
    expect(lock).toBeDisabled();

    expect(screen.getByRole("radio", { name: "edge 7" })).toHaveAttribute("aria-checked", "true");
    choose("YELLOW 010");
    for (const k of [3, 6, 7, 11]) fireEvent.click(screen.getByRole("checkbox", { name: `edge ${k} prints a change` }));
    fireEvent.click(lock);
    const run = runTraffic(trafficMachine(false));
    expect(feedback()).toHaveTextContent("Correct: at edge 7 the light is 010 (YELLOW).");
    expect(feedback()).toHaveTextContent(explainLightAt(run, 7));
    expect(feedback()).toHaveTextContent("Correct: edges 3, 6, 7, 11 print a change.");
    expect(screen.getByTestId("fsm-narration")).toHaveTextContent(describeTrafficEdge(run, run.edges[0]));
  });

  it("steps edge by edge with the decoder item, the timer and EXP/ACT in sync, ending on PASS=12", () => {
    render(<FsmEdgeStepper machine="traffic-light" />);
    revealSkip();
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    fireEvent.click(screen.getByRole("button", { name: "Next edge" }));
    const run = runTraffic(trafficMachine(false));
    expect(screen.getByTestId("fsm-narration")).toHaveTextContent(describeTrafficEdge(run, run.edges[3]));
    expect(activeLine()).toContain("RED:    light = 3'b100;");
    expect(screen.getByLabelText("timer = 0, just changed")).toBeInTheDocument();
    expect(screen.getByTestId("fsm-log")).toHaveTextContent("t=55 ns: light=001");

    fireEvent.change(screen.getByRole("slider", { name: "Edge scrubber" }), { target: { value: "11" } });
    expect(screen.getByTestId("fsm-log").textContent).toBe(run.log.join("\n"));
    expect(screen.getAllByText(trafficVerdict(run)).length).toBeGreaterThan(0);
  });

  it("break it: YELLOW loading 4'd1 fails first at edge 8", () => {
    render(<FsmEdgeStepper machine="traffic-light" preset="break-yellow" />);
    expect(document.body.textContent).toContain("YELLOW: timer <= 4'd1;");
    expect(screen.getByRole("radio", { name: "edge 8" })).toHaveAttribute("aria-checked", "true");
    choose("RED 100");
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(feedback()).toHaveTextContent("Not quite: at edge 8 the light is 010 (YELLOW), not 100 (RED).");
    expect(feedback()).toHaveTextContent(/you missed 3, 6, 8/);

    fireEvent.click(screen.getByRole("button", { name: "Select edge 8" }));
    expect(screen.getByTestId("fsm-narration")).toHaveTextContent("EXP 100, ACT 010 ✕");
    expect(screen.getByLabelText("mismatch")).toBeInTheDocument();
    expect(screen.getByTestId("fsm-log")).toHaveTextContent("$error at t=105 ns: edge 8: light=010, expected 100");
    fireEvent.change(screen.getByRole("slider", { name: "Edge scrubber" }), { target: { value: "11" } });
    expect(screen.getAllByText(trafficVerdict(runTraffic(trafficMachine(true)))).length).toBeGreaterThan(0);
  });

  it("switching the controller version resets the prediction", () => {
    render(<FsmEdgeStepper machine="traffic-light" />);
    revealSkip();
    expect(waveTable()).not.toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Break it: YELLOW loads 4'd1" }));
    expect(waveTable()).toBeNull();
    expect(screen.getByRole("button", { name: "Lock in prediction" })).toBeDisabled();
  });
});
