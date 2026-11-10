import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StreamPackLab from "@/components/visuals/StreamPackLab";
import { CAST_PRESETS, REC24_X_NOTE, STREAM_PRESETS, runCast, runStream } from "@/lib/sv-stream-model";

const streamRun = (id: string) => runStream(STREAM_PRESETS.find((p) => p.id === id)!.config);
const castRun = (id: string) => runCast(CAST_PRESETS.find((p) => p.id === id)!.config);

/** The verdict also goes to the live region; these look at what is on screen. */
const onScreen = { ignore: 'script, style, [role="status"]' };

/** Picks an option inside the prompt whose question matches, and locks it in. */
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The legend starts with a "Predict" badge, so a question is matched at the end of the group's name. */
const question = (q: RegExp | string) => (typeof q === "string" ? new RegExp(`${escape(q)}$`) : q);
const lockIn = (q: RegExp | string, option: string) => {
  const fieldset = screen.getByRole("group", { name: question(q) });
  fireEvent.click(within(fieldset).getByLabelText(option));
  fireEvent.click(within(fieldset.parentElement as HTMLElement).getByRole("button", { name: /lock in prediction/i }));
};
const stepText = () => screen.getByTestId("step-text").textContent ?? "";
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StreamPackLab · stream", () => {
  it("is a named region that hides every result until the learner commits", () => {
    render(<StreamPackLab mode="stream" />);
    expect(screen.getByRole("region", { name: "Stream pack lab: streaming operators" })).toBeInTheDocument();
    expect(screen.queryByTestId("stream-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("step-text")).not.toBeInTheDocument();
    // The code is visible and holds no result.
    const code = screen.getByTestId("lab-code").textContent ?? "";
    expect(code).toContain("q = {>> {hdr}};");
    streamRun("big-endian").compare.forEach((row) => expect(code).not.toContain(row.result));
  });

  it("confirms a correct prediction with the model's reasons, then steps pack, slice, reverse and fit", () => {
    const run = streamRun("big-endian");
    render(<StreamPackLab mode="stream" preset="big-endian" />);
    lockIn("What is q[0] after this assignment?", run.answer);
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    expect(screen.getByTestId("reveal-heading")).toHaveFocus();
    const steps = run.pack!.steps;
    expect(stepText()).toContain(steps[0].text);
    next();
    expect(stepText()).toContain(steps[1].text);
    next();
    next();
    expect(stepText()).toContain(steps[3].text);
    expect(screen.getByText("q[0]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByRole("slider", { name: "Step scrubber" }), { target: { value: "0" } });
    expect(stepText()).toContain("Step 1 of 4: Pack.");
  });

  it("explains a wrong prediction and why the answer holds, and announces it in the live region", () => {
    const run = streamRun("little-endian");
    const wrong = run.options.find((o) => !o.correct && o.id.startsWith("op-"))!;
    render(<StreamPackLab preset="little-endian" />);
    lockIn("What is q[0] after this assignment?", wrong.label);
    expect(screen.getByText(/Not quite\./, onScreen)).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/, onScreen)).toBeInTheDocument();
    expect(screen.getByTestId("lab-live").textContent).toContain(`Not quite. ${wrong.feedback}`);
  });

  it("a 24-bit target is an error, shown at the fit step", () => {
    render(<StreamPackLab preset="narrow-target" />);
    lockIn("What does w24 hold after this assignment?", "an error");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4. Fit" }));
    expect(stepText()).toContain("This step fails");
    expect(within(screen.getByTestId("step-fit")).getByRole("note").textContent ?? "").toMatch(/narrower than the 32-bit stream/);
  });

  it("re-arms the prediction when the operator changes, and the arrow keys move between operators", () => {
    render(<StreamPackLab preset="big-endian" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("stream-reveal")).toBeInTheDocument();
    const ops = screen.getByRole("radiogroup", { name: "Operator" });
    const checked = within(ops).getByRole("radio", { checked: true });
    fireEvent.keyDown(checked, { key: "ArrowRight" });
    expect(within(ops).getByRole("radio", { name: "{<< 8 {…}}" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("stream-reveal")).not.toBeInTheDocument();
    expect(screen.getByTestId("lab-code").textContent).toContain("q = {<< 8 {hdr}};");
    expect((screen.getByRole("combobox", { name: "Preset" }) as HTMLSelectElement).value).toBe("custom");
  });

  it("a 40-bit target shows the zero fill and every operator side by side after the reveal", () => {
    const run = streamRun("wide-target");
    render(<StreamPackLab preset="wide-target" />);
    lockIn("What does w40 hold after this assignment?", run.answer);
    const rows = screen.getByTestId("compare-rows");
    run.compare.forEach((r) => expect(within(rows).getByText(r.result)).toBeInTheDocument());
  });

  it("unpack fills hdr from the MSB end and asks about hdr.addr", () => {
    const run = streamRun("unpack");
    render(<StreamPackLab preset="unpack" />);
    expect(screen.getByRole("radiogroup", { name: "Source" })).toBeInTheDocument();
    lockIn("What is hdr.addr after this unpack?", run.answer);
    expect(stepText()).toContain(run.unpack!.steps[0].text);
    fireEvent.click(screen.getByRole("button", { name: "4. Fill the targets" }));
    expect(screen.getByText("hdr.addr")).toBeInTheDocument();
  });

  it("with-payload: the with range sizes payload, and removing it makes payload greedy", () => {
    render(<StreamPackLab preset="with-payload" />);
    expect(screen.getByRole("note").textContent).toMatch(/only with >>/);
    lockIn("What is payload.size() after this unpack?", "4");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /with \[0 \+: hdr\.len\]/ }));
    expect(screen.queryByTestId("stream-reveal")).not.toBeInTheDocument();
    lockIn("What is payload.size() after this unpack?", "6");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
  });

  it("the remainder preset reproduces the standard's {<< 4 {6'b11_0101}} and moves the slices", () => {
    const run = streamRun("remainder");
    expect(run.answer).toBe("6'b01_0111");
    render(<StreamPackLab preset="remainder" />);
    lockIn("What does r6 hold after this assignment?", "6'b01_0111");
    next();
    const sliceCards = within(screen.getByTestId("step-slice")).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(sliceCards).toEqual(["slice 1", "slice 0"]);
    next();
    const reversed = within(screen.getByTestId("step-reverse")).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(reversed).toEqual(["slice 0", "slice 1"]);
  });

  it("whole-vs-field compares the per-field swap with the whole-struct reversal", () => {
    const run = streamRun("whole-vs-field");
    render(<StreamPackLab preset="whole-vs-field" />);
    lockIn("What does w hold after this assignment?", run.answer);
    const rows = screen.getByTestId("compare-rows");
    expect(within(rows).getByText("32'h01EF_BE04")).toBeInTheDocument();
    expect(within(rows).getByText("w = {<< 8 {hdr}};")).toBeInTheDocument();
  });

  it("Start over returns to the preset with the prediction armed", () => {
    render(<StreamPackLab preset="wide-target" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Target" })).getByRole("radio", { name: "logic [23:0] w24" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("stream-reveal")).not.toBeInTheDocument();
    expect((screen.getByRole("combobox", { name: "Preset" }) as HTMLSelectElement).value).toBe("wide-target");
  });

  it("with prefers-reduced-motion set, the slice cards move with no animation", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<StreamPackLab preset="little-endian" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "3. Reverse" }));
    const view = screen.getByTestId("step-reverse");
    expect(view).toHaveAttribute("data-reduced-motion", "true");
    expect(within(view).getAllByRole("listitem")).toHaveLength(4);
  });

  it("without prefers-reduced-motion, the slice cards are animated", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<StreamPackLab preset="little-endian" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("button", { name: "3. Reverse" }));
    expect(screen.getByTestId("step-reverse")).toHaveAttribute("data-reduced-motion", "false");
  });

  it("the section line names the lesson heading, and the strip labels carry a key", () => {
    render(<StreamPackLab preset="little-endian" />);
    expect(screen.getByText("For the lesson section: Expert: Streaming aggregates and byte order at scale.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("bracket-key")).toBeInTheDocument();
    expect(screen.getByText("len bits 7..0")).toBeInTheDocument();
  });
});

describe("StreamPackLab · cast", () => {
  it("asks whether the cast compiles first, and keeps the value prompt hidden until then", () => {
    render(<StreamPackLab mode="cast" />);
    expect(screen.getByRole("region", { name: "Stream pack lab: bit-stream casting" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /What does v hold/ })).not.toBeInTheDocument();
    lockIn("Does word_t'(rec) compile?", "Yes, it compiles");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    // The compile reveal does not show the value; it appears only as one option among several.
    expect(screen.getByTestId("compile-reveal").textContent).not.toContain("04BE_EF01");
    expect(screen.getByRole("group", { name: /What does v hold after v = word_t'\(rec\)\?/ })).toBeInTheDocument();
  });

  it("reveals the value, the bit strips and the lesson's three-row table", () => {
    const run = castRun("round-trip");
    render(<StreamPackLab mode="cast" preset="round-trip" />);
    lockIn("Does word_t'(rec) compile?", "Yes, it compiles");
    lockIn(/What does v hold/, "32'h04BE_EF01");
    expect(screen.getByTestId("value-heading")).toHaveFocus();
    const rows = screen.getByTestId("compare-rows");
    run.compare.forEach((r) => expect(within(rows).getByText(r.code)).toBeInTheDocument());
    expect(within(rows).getByText("32'h01EF_BE04")).toBeInTheDocument();
  });

  it("an x in addr arrives in the int as 0", () => {
    const run = castRun("x-to-int");
    render(<StreamPackLab mode="cast" preset="x-to-int" />);
    expect(screen.getByTestId("lab-code").textContent).toContain("addr: 16'hBEEx");
    lockIn("Does int'(rec) compile?", "Yes, it compiles");
    lockIn(/What does v hold/, "32'h04BE_Ex01");
    expect(screen.getByText(/Not quite\./, onScreen)).toBeInTheDocument();
    expect(screen.getByText(run.valueText)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "How the cast works" })).getByText(/x and z bits become 0 \(§6\.24\.3 b, §6\.11\.2\)/)).toBeInTheDocument();
  });

  it("logic [31:0]'(rec) is the type-name error, with no value prompt", () => {
    render(<StreamPackLab mode="cast" preset="type-name" />);
    lockIn("Does logic [31:0]'(rec) compile?", "No: the cast type is not a type name");
    expect(screen.getByTestId("compile-heading")).toHaveTextContent("It does not compile");
    expect(screen.queryByRole("group", { name: /What does v hold/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("compare-rows")).toBeInTheDocument();
    // Its only step is the message shown above, so no empty list is rendered.
    expect(screen.queryByRole("list", { name: "How the cast works" })).not.toBeInTheDocument();
  });

  it("the section line above the compile question does not name the rule being predicted", () => {
    for (const id of ["size-mismatch", "type-name"]) {
      const { unmount } = render(<StreamPackLab mode="cast" preset={id} />);
      const line = screen.getByText(/^For the lesson section:/).textContent ?? "";
      expect(line, id).toBe("For the lesson section: Bit-stream casting.");
      unmount();
    }
  });

  it("the 24-bit record: a size error, streaming as the alternative, and no x to inject", () => {
    render(<StreamPackLab mode="cast" preset="size-mismatch" />);
    expect(screen.getByRole("checkbox", { name: /Inject x/ })).toBeDisabled();
    expect(screen.getByText(REC24_X_NOTE)).toBeInTheDocument();
    lockIn("Does int'(r24) compile?", "Yes, it compiles");
    expect(screen.getByText(/Not quite\./, onScreen)).toBeInTheDocument();
    const rows = screen.getByTestId("compare-rows");
    expect(within(rows).getByText("32'h04BE_EF00")).toBeInTheDocument();
  });

  it("changing the destination re-arms both predictions", () => {
    render(<StreamPackLab mode="cast" preset="round-trip" />);
    lockIn("Does word_t'(rec) compile?", "Yes, it compiles");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Destination" })).getByRole("radio", { name: "wide_t (logic [39:0])" }));
    expect(screen.queryByTestId("compile-reveal")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /What does v hold/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: question("Does wide_t'(rec) compile?") })).toBeInTheDocument();
  });
});
