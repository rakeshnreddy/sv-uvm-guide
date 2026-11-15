import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrintingLab, { markerLevels } from "@/components/visuals/PrintingLab";
import { findFormatPreset, formatWith, gradeGuess, parseBits } from "@/lib/sv-format-model";
import { DEBUG_FIXES, DEFAULT_MONITOR_CONFIG, gradeFix, gradeSlot, runMonitor, slotOptions } from "@/lib/sv-monitor-model";

const onScreen = { ignore: 'script, style, [role="status"]' };
const predictionInput = () => screen.getByLabelText("Predict: type exactly what prints");
const typeGuess = (text: string) => fireEvent.change(predictionInput(), { target: { value: text } });
const check = () => fireEvent.click(screen.getByRole("button", { name: "Check my prediction" }));
const radio = (group: string, name: string | RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

describe("PrintingLab · format", () => {
  it("renders in a named frame and hides the answer until the learner checks", () => {
    render(<PrintingLab />);
    expect(screen.getByRole("region", { name: "Printing lab: how a number is sized and how x and z print" })).toBeInTheDocument();
    expect(screen.queryByTestId("format-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("group-brackets")).not.toBeInTheDocument();
    expect(screen.queryByText(/4095/, onScreen)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check my prediction" })).toBeDisabled();
  });

  it("r1 preset: a guess without padding is diagnosed with the §21.2.1.2 width calculation", () => {
    render(<PrintingLab mode="format" preset="r1" />);
    typeGuess("10");
    check();
    const reveal = screen.getByTestId("format-reveal");
    const expected = gradeGuess(formatWith(findFormatPreset("r1").bits, "%d"), "10");
    expect(within(reveal).getByText(/Not quite\./)).toBeInTheDocument();
    expect(within(reveal).getAllByText(expected.sentence, { exact: false }).length).toBeGreaterThan(0);
    expect(within(reveal).getByTestId("width-sentence")).toHaveTextContent("4095, which needs 4 columns");
    expect(screen.getByTestId("lab-live")).toHaveTextContent("Not quite.");
    expect(screen.getByTestId("reveal-heading")).toHaveFocus();
  });

  it("accepts · as a space and marks an exact answer correct", () => {
    render(<PrintingLab preset="r1" />);
    typeGuess("··10");
    check();
    expect(within(screen.getByTestId("format-reveal")).getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("answer-cells")).toHaveTextContent("Printed text: 4 characters: 2 spaces, then 10.");
  });

  it("10x1 preset: %h prints X and the reveal shows the group and the rule that fired", () => {
    render(<PrintingLab preset="10x1" />);
    typeGuess("x");
    check();
    const reveal = screen.getByTestId("format-reveal");
    expect(within(reveal).getByText(/lowercase means every bit/)).toBeInTheDocument();
    expect(within(screen.getByTestId("group-brackets")).getByText("bits 3 to 0 (10x1) print X, some x.")).toBeInTheDocument();
  });

  it("xz-digit preset: a digit with x and z prints X, and the 12-bit hex groups are drawn", () => {
    render(<PrintingLab preset="xz-digit" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const result = formatWith(parseBits("0011_xz10_0101"), "%h");
    expect(screen.getByTestId("answer-cells")).toHaveTextContent(`Printed text: 3 characters: ${result.text}.`);
    expect(screen.getByTestId("rule-sentences")).toHaveTextContent("x wins over z");
    expect(screen.getByTestId("group-brackets")).toHaveTextContent("Groups of 4 bits, counted from bit 0");
  });

  it("all-z preset: decimal prints one z, right-justified", () => {
    render(<PrintingLab preset="all-z" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("answer-cells")).toHaveTextContent("Printed text: 3 characters: 2 spaces, then z.");
  });

  it("toggling a bit, the width or the specifier resets the prediction and recomputes", () => {
    render(<PrintingLab preset="10x1" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("format-reveal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Bit 1: x/ }));
    expect(screen.queryByTestId("format-reveal")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bit 1: z/ })).toBeInTheDocument();
    expect(radio("Example", "Your own value")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(radio("Format specifier", "%b"));
    fireEvent.click(radio("Width", "9 bits"));
    expect(screen.getAllByRole("button", { name: /^Bit \d+:/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("answer-cells")).toHaveTextContent("Printed text: 9 characters: 0000010z1.");
  });

  it("Try another prediction returns focus to the prediction input", () => {
    render(<PrintingLab preset="r1" />);
    typeGuess("10");
    check();
    fireEvent.click(screen.getByRole("button", { name: "Try another prediction" }));
    expect(predictionInput()).toHaveFocus();
    expect(predictionInput()).toHaveValue("");
  });

  it("an uppercase hex letter is accepted with the standard's lowercase note", () => {
    render(<PrintingLab preset="r1" />);
    fireEvent.click(radio("Format specifier", "%h"));
    typeGuess("00A");
    check();
    const reveal = screen.getByTestId("format-reveal");
    expect(within(reveal).getByText(/Correct\./)).toBeInTheDocument();
    expect(reveal).toHaveTextContent("does not state the case of the hex letters a to f");
  });

  it("%b on 12 bits has no per-bit rule labels under the strip", () => {
    render(<PrintingLab preset="xz-digit" />);
    fireEvent.click(radio("Format specifier", "%b"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const strip = screen.getByTestId("group-brackets");
    expect(within(strip).queryByText("all x", onScreen)).not.toBeInTheDocument();
    expect(within(strip).queryByText("all z", onScreen)).not.toBeInTheDocument();
    expect(screen.getByTestId("rule-sentences")).toHaveTextContent("%b prints each bit separately");
  });

  it("the specifier control is keyboard operable", () => {
    render(<PrintingLab preset="r1" />);
    const d = radio("Format specifier", "%d");
    d.focus();
    fireEvent.keyDown(d, { key: "ArrowRight" });
    expect(radio("Format specifier", "%0d")).toHaveAttribute("aria-checked", "true");
    expect(radio("Format specifier", "%0d")).toHaveFocus();
  });

  it("Enter in the field checks the prediction", () => {
    render(<PrintingLab preset="r1" />);
    typeGuess("  10");
    fireEvent.keyDown(predictionInput(), { key: "Enter" });
    expect(screen.getByTestId("format-reveal")).toBeInTheDocument();
    expect(predictionInput()).toBeDisabled();
  });
});

describe("PrintingLab · monitor", () => {
  const run = runMonitor(DEFAULT_MONITOR_CONFIG);
  const chooseAll = (pick: (time: number) => string) =>
    run.slots.forEach((s) => fireEvent.change(screen.getByLabelText(`Prediction for ${s.time} ns`), { target: { value: pick(s.time) } }));
  const answer = (time: number) => slotOptions(run, time).find((o) => o.correct)?.id as string;

  it("hides the watch lists and print markers before the check", () => {
    render(<PrintingLab mode="monitor" />);
    expect(screen.getByRole("region", { name: "Printing lab: when $monitor prints" })).toBeInTheDocument();
    expect(screen.queryByTestId("band-list1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("print-markers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("monitor-reveal")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check my predictions" })).toBeDisabled();
  });

  it("grades every slot and explains 20 ns (one line) and 30 ns (silence)", () => {
    render(<PrintingLab mode="monitor" />);
    chooseAll((t) => (t === 30 ? "t=30 b=5" : answer(t)));
    fireEvent.click(screen.getByRole("button", { name: "Check my predictions" }));
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent(`You predicted ${run.slots.length - 1} of ${run.slots.length} slots`);
    expect(screen.getByTestId("slot-30-reveal")).toHaveTextContent(gradeSlot(run, 30, null).sentence);
    expect(screen.getByTestId("slot-30-reveal")).toHaveTextContent("Answer: Silent");
    expect(screen.getByTestId("slot-20-reveal")).toHaveTextContent("one line prints");
    expect(screen.getByTestId("band-list1")).toBeInTheDocument();
    expect(screen.getByTestId("band-list2")).toBeInTheDocument();
    expect(screen.getByTestId("log-stdout")).toHaveTextContent("t=0 a=0 t=10 a=1 t=20 a=3 t=40 b=5 t=50 b=6");
    expect(screen.getByTestId("timeline-summary")).toHaveTextContent("printed in the Postponed region");
  });

  it("$fmonitor keeps two lists: the reveal shows a second log", () => {
    render(<PrintingLab mode="monitor" />);
    fireEvent.click(radio("Second call uses", "$fmonitor"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("log-file")).toHaveTextContent("t=40 b=5 t=50 b=6");
    expect(screen.getByTestId("log-stdout")).toHaveTextContent("t=50 a=4");
    // The file markers sit in their own row labelled b.log, so each marker is only its glyph.
    expect(screen.getByTestId("print-markers-file")).toHaveTextContent(/^b\.logPP$/);
    expect(screen.getByTestId("print-markers-stdout")).not.toHaveTextContent("b.log");
    expect(screen.getByTestId("monitor-timeline")).toHaveTextContent("markers on the row labelled b.log");
  });

  it("the monitor flag row names its scope", () => {
    render(<PrintingLab mode="monitor" />);
    fireEvent.change(screen.getByLabelText("$monitoroff"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("monitor-timeline")).toHaveTextContent("$monitor flag");
  });

  it("print markers less than 10 ns apart alternate levels so they do not overlap at 390 px", () => {
    expect(markerLevels([{ time: 0 }, { time: 10 }, { time: 20 }])).toEqual([0, 0, 0]);
    expect(markerLevels([{ time: 40 }, { time: 45 }, { time: 50 }, { time: 60 }])).toEqual([0, 1, 0, 0]);
    const at45 = runMonitor({ ...DEFAULT_MONITOR_CONFIG, monitorOnTime: 45 }).log.filter((l) => l.channel === "stdout");
    expect(markerLevels(at45)[at45.findIndex((l) => l.time === 45)]).toBe(1);
  });

  it("Predict again returns focus to the first slot's prediction", () => {
    render(<PrintingLab mode="monitor" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "Predict again" }));
    expect(screen.getByLabelText(`Prediction for ${run.slots[0].time} ns`)).toHaveFocus();
  });

  it("$monitoroff and $monitoron insert statements, and a changed bench resets the predictions", () => {
    render(<PrintingLab mode="monitor" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.change(screen.getByLabelText("$monitoroff"), { target: { value: "5" } });
    expect(screen.queryByTestId("monitor-reveal")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("$monitoron"), { target: { value: "25" } });
    expect(screen.getByLabelText("Prediction for 25 ns")).toBeInTheDocument();
    expect(within(screen.getByLabelText("$monitoron")).getByRole("option", { name: "at 5 ns" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("slot-25-reveal")).toHaveTextContent("t=25 a=3");
    expect(screen.getByTestId("slot-25-reveal")).toHaveTextContent("immediately");
  });

  it("deleting the second call and adding b changes the code and the run", () => {
    render(<PrintingLab mode="monitor" />);
    fireEvent.change(screen.getByLabelText("Second call"), { target: { value: "none" } });
    fireEvent.click(screen.getByLabelText("Add b to the first list"));
    expect(screen.queryByLabelText("Prediction for 40 ns")).not.toBeInTheDocument();
    expect(radio("Second call uses", "$fmonitor")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("slot-30-reveal")).toHaveTextContent("t=30 a=3 b=5");
  });
});

describe("PrintingLab · monitor, replaced-list", () => {
  it("shows the symptom log, grades suspects, then reruns each fix", () => {
    render(<PrintingLab mode="monitor" preset="replaced-list" />);
    expect(screen.getByRole("region", { name: "Printing lab: the signal that went quiet" })).toBeInTheDocument();
    expect(screen.getByTestId("log-symptom")).toHaveTextContent("t=0 a=0 t=10 a=1 t=20 a=3 t=40 b=5 t=50 b=6");
    expect(screen.queryByTestId("debug-fixes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: \$monitor\("t=%0d a=%0d"/ }));
    expect(screen.getByTestId("suspect-verdict")).toHaveTextContent("Not quite.");
    expect(screen.queryByTestId("debug-fixes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: #10 \$monitor/ }));
    expect(screen.getByTestId("suspect-verdict")).toHaveTextContent("Correct.");
    expect(screen.getByTestId("debug-fixes")).toBeInTheDocument();

    const fmonitor = DEBUG_FIXES.find((f) => f.id === "fmonitor") as (typeof DEBUG_FIXES)[number];
    fireEvent.click(screen.getByRole("button", { name: fmonitor.label }));
    expect(screen.getByTestId("fix-verdict")).toHaveTextContent(gradeFix(fmonitor).sentence);
    expect(screen.getByTestId("fix-verdict")).toHaveTextContent("Fixes it.");
    expect(screen.getByTestId("fix-verdict")).not.toHaveTextContent("Not quite.");
    expect(screen.getByTestId("fix-gap-note")).toHaveTextContent(gradeFix(fmonitor).gapNote as string);
    expect(screen.getByTestId("fix-log-file")).toHaveTextContent("t=40 b=5");

    const later = DEBUG_FIXES.find((f) => f.id === "move-later") as (typeof DEBUG_FIXES)[number];
    fireEvent.click(screen.getByRole("button", { name: later.label }));
    const partial = within(screen.getByTestId("fix-verdict")).getByText("Partly fixes it.").closest("[data-tone]");
    expect(partial).toHaveAttribute("data-tone", "partial");
    expect(screen.getByTestId("fix-verdict")).not.toHaveTextContent("Not quite.");
    expect(screen.getByTestId("fix-verdict")).toHaveTextContent(gradeFix(later).sentence);

    const oneList = DEBUG_FIXES.find((f) => f.id === "one-list") as (typeof DEBUG_FIXES)[number];
    fireEvent.click(screen.getByRole("button", { name: oneList.label }));
    expect(screen.getByTestId("fix-verdict")).toHaveTextContent("Fixes it.");
    expect(screen.getByTestId("fix-log")).toHaveTextContent("t=50 a=4 b=6");
    expect(screen.getByRole("button", { name: oneList.label })).toHaveAttribute("aria-pressed", "true");
  });

  it("the summary says the lesson's bench uses another process, with the same behaviour", () => {
    render(<PrintingLab mode="monitor" preset="replaced-list" />);
    expect(screen.getByText(/In the lesson, the second call comes from another process; here every statement sits in one initial block/)).toBeInTheDocument();
  });

  it("can skip the hunt, and start over", () => {
    render(<PrintingLab mode="monitor" preset="replaced-list" />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to the fixes" }));
    expect(screen.getByTestId("debug-fixes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("debug-fixes")).not.toBeInTheDocument();
  });
});
