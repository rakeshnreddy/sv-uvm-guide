import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import KeywordSetExplorer from "@/components/visuals/KeywordSetExplorer";
import VerilogVsSystemVerilog from "@/components/visuals/VerilogVsSystemVerilog";
import { LEGACY_CNT_SCENARIO, NESTED_STACK_SCENARIO, regionGate, scenarioSteps } from "@/lib/sv-keyword-model";

const onScreen = { ignore: 'script, style, [role="status"]' };
const shown = (text: RegExp | string) => screen.getByText(text, onScreen);

/** Picks an option and locks in the prediction of the prompt that owns it. */
const lockIn = (optionText: RegExp | string) => {
  const radio = screen.getByLabelText(optionText);
  fireEvent.click(radio);
  const prompt = radio.closest("fieldset")?.parentElement as HTMLElement;
  fireEvent.click(within(prompt).getByRole("button", { name: /lock in prediction/i }));
};
const setRadio = (group: string, name: RegExp | string) =>
  fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }));

describe("KeywordSetExplorer · checker (22.14, 5.6.1)", () => {
  it("hides the verdict and the entry ring until the learner predicts, then explains a wrong prediction", () => {
    render(<KeywordSetExplorer />);
    expect(screen.getByRole("region", { name: "Keyword set checker" })).toBeInTheDocument();
    expect(screen.queryByTestId("checker-reveal")).not.toBeInTheDocument();
    expect(document.querySelector('[data-entry="true"]')).toBeNull();
    expect(screen.getByTestId("set-summary")).toHaveTextContent('"1800-2023" reserves 248 words');

    lockIn("Ordinary identifier");
    expect(shown(/Not quite\./)).toBeInTheDocument();
    expect(shown(/reserved since "1800-2005" \(Table 22-4\)/)).toBeInTheDocument();
    expect(screen.getByTestId("ring-22-4")).toHaveAttribute("data-entry", "true");
    expect(screen.getByTestId("ring-22-6")).toHaveAttribute("data-lit", "true");
    expect(screen.getByTestId("acceptance")).toHaveTextContent('The newest is "1364-2005"');
  });

  it("reverse case preset: interface under 1364-2005 is an ordinary identifier (22.14.1)", () => {
    render(<KeywordSetExplorer mode="checker" preset="reverse" />);
    lockIn("Ordinary identifier");
    expect(shown(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("ring-22-4")).toHaveAttribute("data-lit", "false");
    expect(screen.getByTestId("ring-22-4")).toHaveAttribute("data-entry", "true");
    expect(within(screen.getByTestId("checker-reveal")).getByText(/22\.14\.1 shows this for interface and endinterface/)).toBeInTheDocument();
  });

  it("no directive shows the implementation-dependent card and offers no prediction (22.14)", () => {
    render(<KeywordSetExplorer />);
    setRadio("Keyword set in effect", "no directive");
    const card = screen.getByTestId("default-card");
    expect(within(card).getByText("Tool default: implementation dependent")).toBeInTheDocument();
    expect(within(card).getByText(/reserve it; "1364-1995"/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
  });

  it("an unknown typed specifier is an error, and a valid one is applied", () => {
    render(<KeywordSetExplorer />);
    const input = screen.getByLabelText(/Or type a/);
    fireEvent.change(input, { target: { value: '"1364-2000"' } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/shall be an error if an implementation does not recognize/);
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "1364-2001-noconfig" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Keyword set in effect" })).getByRole("radio", { name: "1364-2001-noconfig" })).toHaveAttribute("aria-checked", "true");
  });

  it("noconfig preset: config is excluded (22.14.4) and the ring says so after the reveal", () => {
    render(<KeywordSetExplorer preset="noconfig" />);
    lockIn("Reserved keyword");
    expect(shown(/drops config and the other configuration words/)).toBeInTheDocument();
    expect(screen.getByTestId("ring-22-2")).toHaveTextContent(/excluded by noconfig/);
  });

  it("the escaped \\logic is an identifier under 1800-2023 (5.6.1)", () => {
    render(<KeywordSetExplorer />);
    setRadio("Identifier to check", "\\logic (escaped)");
    lockIn("Ordinary identifier");
    expect(shown(/^Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("checker-reveal")).getByText(/escaped keyword/)).toBeInTheDocument();
  });

  it("a typed escaped non-keyword gets escaped-identifier feedback, not escaped-keyword feedback (5.6.1)", () => {
    render(<KeywordSetExplorer />);
    fireEvent.change(screen.getByLabelText(/Identifier as written/), { target: { value: "\\cpu3" } });
    lockIn("Reserved keyword");
    expect(shown(/^Not quite\./)).toBeInTheDocument();
    expect(shown(/\\cpu3 is an escaped identifier, the same as cpu3 without the backslash/)).toBeInTheDocument();
    expect(screen.queryByText(/escaped keyword/, onScreen)).not.toBeInTheDocument();
  });

  it("a typed identifier is checked: Logic differs from logic in case (5.6.2); 8bit is not an identifier (5.6)", () => {
    render(<KeywordSetExplorer />);
    const input = screen.getByLabelText(/Identifier as written/);
    fireEvent.change(input, { target: { value: "Logic" } });
    expect(within(screen.getByRole("radiogroup", { name: "Identifier to check" })).getByRole("radio", { name: "Type your own identifier" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(within(screen.getByTestId("checker-reveal")).getAllByText(/lowercase only/).length).toBeGreaterThan(0);

    fireEvent.change(input, { target: { value: "8bit" } });
    expect(screen.getByTestId("not-identifier-card")).toHaveTextContent(/cannot start with a digit/);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByTestId("empty-hint")).toBeInTheDocument();
  });

  it("the set is keyboard operable and a new set resets the prediction", () => {
    render(<KeywordSetExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("checker-reveal")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Keyword set in effect" });
    const checked = within(group).getByRole("radio", { name: "1800-2023" });
    fireEvent.keyDown(checked, { key: "ArrowLeft" });
    expect(within(group).getByRole("radio", { name: "1800-2017" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("checker-reveal")).not.toBeInTheDocument();
  });
});

describe("KeywordSetExplorer · regions (22.14)", () => {
  const next = () => fireEvent.click(screen.getByRole("button", { name: "Next line" }));

  it("legacy_cnt: hides tb_top.sv until the prediction, which matches the model", () => {
    render(<KeywordSetExplorer mode="regions" preset="legacy_cnt" />);
    expect(screen.getByRole("region", { name: "Keyword regions stepper" })).toBeInTheDocument();
    expect(screen.getByTestId("hidden-file")).toHaveTextContent("tb_top.sv appears after you predict");
    expect(screen.queryByText(/\.\\logic \(q\)/, onScreen)).not.toBeInTheDocument();

    for (let i = 0; i < 2; i += 1) next();
    expect(screen.getByTestId("keyword-stack")).toHaveTextContent('"1364-2001"◀ in effect');
    expect(screen.getByTestId("step-note")).toHaveTextContent(/Push "1364-2001"/);

    const gate = regionGate(LEGACY_CNT_SCENARIO, scenarioSteps(LEGACY_CNT_SCENARIO))!;
    expect(screen.queryByText(gate.question)).not.toBeInTheDocument();
    for (let i = 2; i < gate.stepIndex; i += 1) next();
    expect(screen.getByTestId("step-note")).toHaveTextContent(/Pop "1364-2001"/);
    expect(shown(gate.question)).toBeInTheDocument();

    next();
    expect(screen.getByTestId("blocked-note")).toBeInTheDocument();
    expect(screen.getByTestId("hidden-file")).toBeInTheDocument();

    lockIn("Syntax error: logic is a keyword in tb_top.sv");
    expect(shown(/^Correct\./)).toBeInTheDocument();
    expect(screen.queryByTestId("hidden-file")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-note")).toHaveTextContent(/even across file boundaries|No pair is open/);
  });

  it("an unknown tool default makes the answer 'it depends' (22.14)", () => {
    render(<KeywordSetExplorer mode="regions" preset="legacy_cnt" />);
    setRadio("Tool default keyword set", "unknown");
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO, null);
    const gate = regionGate(LEGACY_CNT_SCENARIO, steps)!;
    fireEvent.change(screen.getByRole("slider", { name: "Line scrubber" }), { target: { value: String(gate.stepIndex) } });
    lockIn("It depends on the tool's default keyword set");
    expect(shown(/^Correct\./)).toBeInTheDocument();
  });

  it("nested_stack: `resetall leaves the stack alone, and the unknown specifier is an error", () => {
    render(<KeywordSetExplorer mode="regions" preset="nested_stack" />);
    const steps = scenarioSteps(NESTED_STACK_SCENARIO);
    const gate = regionGate(NESTED_STACK_SCENARIO, steps)!;
    fireEvent.change(screen.getByRole("slider", { name: "Line scrubber" }), { target: { value: String(gate.stepIndex) } });
    expect(screen.getByTestId("keyword-stack")).toHaveTextContent('"1364-2001"');
    expect(screen.getByTestId("keyword-stack")).toHaveTextContent('"1364-1995"◀ in effect');
    lockIn(/: unchanged$/);
    expect(shown(/^Correct\./)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Line scrubber" }), { target: { value: String(steps.length - 1) } });
    expect(screen.getByTestId("step-note")).toHaveTextContent(/"1364-2000" is not one of the nine/);
    expect(screen.getByTestId("end-note")).toHaveTextContent("every pair was matched");
  });
});

describe("KeywordSetExplorer · regions tags", () => {
  it("tags logic by the set in effect on each line", () => {
    render(<KeywordSetExplorer mode="regions" preset="legacy_cnt" />);
    const steps = scenarioSteps(LEGACY_CNT_SCENARIO);
    const gate = regionGate(LEGACY_CNT_SCENARIO, steps)!;
    const slider = () => screen.getByRole("slider", { name: "Line scrubber" });
    fireEvent.change(slider(), { target: { value: String(gate.stepIndex) } });
    expect(screen.getAllByText(": identifier", onScreen).length).toBe(6);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.change(slider(), { target: { value: String(steps.length - 1) } });
    expect(screen.getAllByText(": keyword", onScreen).length).toBe(3);
    expect(screen.getAllByText(": escaped identifier", onScreen).length).toBe(1);
  });
});

describe("KeywordSetExplorer · lineage (1.3 NOTE, 22.14)", () => {
  it("gates the timeline behind two predictions computed from the model", () => {
    render(<KeywordSetExplorer mode="lineage" />);
    expect(screen.getByRole("region", { name: "Standards lineage timeline" })).toBeInTheDocument();
    expect(screen.queryByTestId("lineage-timeline")).not.toBeInTheDocument();
    expect(screen.queryByText(/added the most reserved words/)).not.toBeInTheDocument();

    lockIn("IEEE 1800-2005");
    expect(shown(/^Not quite\./)).toBeInTheDocument();
    expect(shown(/relied on IEEE 1364-2005 for the base language \(1\.3 NOTE\)/)).toBeInTheDocument();
    expect(screen.queryByTestId("lineage-timeline")).not.toBeInTheDocument();

    const q2 = screen.getByRole("group", { name: /added the most reserved words/ });
    fireEvent.click(within(q2).getByLabelText("IEEE 1800-2005"));
    fireEvent.click(within(q2.parentElement as HTMLElement).getByRole("button", { name: /lock in prediction/i }));
    expect(within(q2.parentElement as HTMLElement).getByText(/Table 22-4 adds 97 words/)).toBeInTheDocument();

    const timeline = screen.getByTestId("lineage-timeline");
    expect(within(timeline).getByTestId("table-sentence")).toHaveTextContent("Table 22-1 (22.14.2): 102 reserved words, the base list");
    fireEvent.click(within(timeline).getByRole("button", { name: "IEEE 1800-2005" }));
    const panel = screen.getByTestId("lineage-panel");
    expect(within(panel).getByText("IEEE 1364-2005")).toBeInTheDocument();
    expect(screen.getByTestId("bar-22-4")).toHaveAttribute("data-lit", "true");

    fireEvent.click(within(timeline).getByRole("button", { name: "IEEE 1800.2-2020" }));
    expect(within(panel).getByText(/uvm-core 2020\.3\.1: Accellera's library/)).toBeInTheDocument();
    expect(within(panel).getByText(/normative reference \(1800\.2 Clause 2\)/)).toBeInTheDocument();

    fireEvent.click(within(timeline).getByRole("button", { name: "OVM, pre-IEEE, no date" }));
    expect(within(panel).getByText("no date: placed in order only", { exact: false })).toBeInTheDocument();
  });

  it("places pre-IEEE stops in the row of the next IEEE stop, and shows 3.1a as extensions on IEEE 1364 (1.4, Introduction)", () => {
    render(<KeywordSetExplorer mode="lineage" />);
    lockIn("IEEE 1364-2005");
    const q2 = screen.getByRole("group", { name: /added the most reserved words/ });
    fireEvent.click(within(q2).getByLabelText("IEEE 1800-2005"));
    fireEvent.click(within(q2.parentElement as HTMLElement).getByRole("button", { name: /lock in prediction/i }));
    const timeline = screen.getByTestId("lineage-timeline");
    const btn = (name: string) => within(timeline).getByRole("button", { name });

    const sv31a = btn("SystemVerilog 3.1a, pre-IEEE, no date");
    expect(sv31a.parentElement).toBe(btn("IEEE 1800-2005").parentElement);
    const order = (a: HTMLElement, b: HTMLElement) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(order(sv31a, btn("IEEE 1800-2005"))).toBeTruthy();
    const ovm = btn("OVM, pre-IEEE, no date");
    const acc = btn("Accellera UVM Pre-IEEE Class Reference, pre-IEEE, no date");
    const u2017 = btn("IEEE 1800.2-2017");
    expect(ovm.parentElement).toBe(u2017.parentElement);
    expect(acc.parentElement).toBe(u2017.parentElement);
    expect(order(ovm, acc)).toBeTruthy();
    expect(order(acc, u2017)).toBeTruthy();

    fireEvent.click(sv31a);
    const panel = screen.getByTestId("lineage-panel");
    expect(within(panel).getByText("SystemVerilog 3.1a (the extensions, Accellera)")).toBeInTheDocument();
    expect(within(panel).getByText("IEEE 1364 (the base Verilog)")).toBeInTheDocument();
    expect(within(panel).getByText(/Source: IEEE 1800-2023 Introduction \(informative\), 1\.4\./)).toBeInTheDocument();

    fireEvent.click(u2017);
    expect(within(panel).getByText("IEEE 1800.2-2017 (the UVM API)")).toBeInTheDocument();

    fireEvent.click(btn("IEEE 1364-2005"));
    expect(within(panel).getByTestId("table-sentence")).toHaveTextContent(/1 reserved word added\./);
  });
});

describe("VerilogVsSystemVerilog · the keyword prompt", () => {
  it("names the IEEE 1800 keyword set and notes the implementation-dependent default (22.14)", () => {
    render(<VerilogVsSystemVerilog />);
    expect(screen.getByText(/with an IEEE 1800 \(SystemVerilog\) keyword set and no directives in the file/)).toBeInTheDocument();
    expect(screen.getByText(/the keyword set is the tool's default, which the standard leaves implementation dependent \(§22\.14\)/)).toBeInTheDocument();
    expect(screen.getByText(/IEEE 1800-2009 was a merger of IEEE 1364-2005 and IEEE 1800-2005 \(IEEE 1800-2023 1\.3 NOTE\)/)).toBeInTheDocument();
  });
});
