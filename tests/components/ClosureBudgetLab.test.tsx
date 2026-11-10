import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ClosureBudgetLab, { CLOSURE_ASSUMPTIONS } from "@/components/curriculum/f1/ClosureBudgetLab";
import {
  binProbabilities,
  closureExpectations,
  closureReducer,
  expectedCoverage,
  formatPercent,
  formatSamples,
  getPreset,
  goFurtherText,
  initialClosureState,
  lastOutcome,
  settingsText,
  workbenchConfig,
  workbenchIntro,
  predictionOptions,
  predictionQuestion,
} from "@/lib/closure-budget-model";

const f1b = getPreset("f1b-closure-trap").config;
const standalone = getPreset("standalone").config;

const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
const status = () => screen.getByRole("status");

describe("ClosureBudgetLab: prediction gate", () => {
  it("has an accessible name and asks the preset's question with model-generated options", () => {
    render(<ClosureBudgetLab />);
    expect(screen.getByRole("region", { name: "Closure budget lab" })).toBeInTheDocument();
    expect(screen.getByText(predictionQuestion(16, 0.01))).toBeInTheDocument();
    for (const o of predictionOptions(16, 0.01)) expect(screen.getByLabelText(o.label)).toBeInTheDocument();
  });

  it("shows no answer before the reveal: no expected-sample figure, chart, table or actions", () => {
    const { container } = render(<ClosureBudgetLab />);
    const all = formatSamples(closureExpectations(f1b).all);
    expect(container.textContent).not.toContain(all);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /More seeds/ })).toBeNull();
    for (const a of CLOSURE_ASSUMPTIONS) expect(a).not.toContain(all);
  });

  it("a wrong prediction explains why with the model's numbers, then reveals the lab", () => {
    render(<ClosureBudgetLab />);
    lockIn("About 1,000");
    const wrong = predictionOptions(16, 0.01).find((o) => o.value === 1000)!;
    expect(screen.getByText(wrong.feedback)).toBeInTheDocument();
    expect(screen.getByText(predictionOptions(16, 0.01).find((o) => o.correct)!.feedback)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Expected coverage and the seeded run/ })).toBeInTheDocument();
  });

  it("the correct prediction is confirmed; the standalone preset asks at 0.1% with about 1,000 correct", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    expect(screen.getByText(predictionQuestion(16, 0.001))).toBeInTheDocument();
    lockIn("About 1,000");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByText("1,002")).toBeInTheDocument();
    expect(screen.getByText("54")).toBeInTheDocument();
  });
});

describe("ClosureBudgetLab: reveal", () => {
  it("the chart has a text alternative and a table equivalent with the figure's checkpoints", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const chart = screen.getByRole("img");
    const desc = document.getElementById(chart.getAttribute("aria-describedby") as string);
    expect(desc?.textContent).toContain("all 17 bins are expected to close after about 1,002 samples");
    const table = screen.getByRole("table", { name: "The chart as a table" });
    const p = binProbabilities(16, 0.001);
    const row = within(table).getByRole("row", { name: /^5,000/ });
    expect(row.textContent).toContain(formatPercent(expectedCoverage(p, 5000)));
    expect(row.textContent).toContain("not run yet");
    expect(within(table).getByRole("row", { name: /^200 / }).textContent).toContain(formatPercent(16 / 17));
  });

  it("controls are keyboard operable radio groups and reconfigure the run", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const group = screen.getByRole("radiogroup", { name: "Rare-bin probability" });
    const current = within(group).getByRole("radio", { checked: true });
    expect(current).toHaveTextContent("0.1%");
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("1%");
    expect(screen.getByText(formatSamples(closureExpectations({ ...standalone, rareP: 0.01 }).all))).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Common bins" })).getByRole("radio", { name: "4" }));
    expect(screen.getByText("Expected samples to close all 5 bins")).toBeInTheDocument();
  });
});

describe("ClosureBudgetLab: closure moves", () => {
  it("More seeds: the plateau barely moves, and the consequence line matches the model", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "More seeds (+200 random samples)" }));
    const s0 = initialClosureState(standalone);
    const expected = closureReducer(s0, { type: "more-seeds" }).log[0].text;
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    expect(status()).toHaveTextContent(expected);
    expect(screen.getByText(/16 of 17 covered/)).toBeInTheDocument();
  });

  it("Directed test: closes the rare bin in one run; a second press is refused", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const button = screen.getByRole("button", { name: "Directed test for the rare bin" });
    fireEvent.click(button);
    expect(screen.getByText(/17 of 17 covered \(100%\)/)).toBeInTheDocument();
    expect(screen.getByText("rare bin: covered by the directed run")).toBeInTheDocument();
    fireEvent.click(button);
    expect(status()).toHaveTextContent(/already covered/);
  });

  it("Waive: refuses an empty reason, then marks the bin waived (striped), not covered", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const waive = screen.getByRole("button", { name: "Waive the hole" });
    fireEvent.click(waive);
    expect(status()).toHaveTextContent(/at least 10 characters/);
    expect(screen.getByText("rare bin: hole")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Waiver reason"), { target: { value: "unreachable in this product mode" } });
    fireEvent.submit(waive.closest("form") as HTMLFormElement);
    expect(screen.getByText("rare bin: waived, not covered")).toBeInTheDocument();
    expect(screen.getByText(/16 of 17 covered \(94\.1%\), 1 waived/)).toBeInTheDocument();
    expect(status()).toHaveTextContent(/marked waived, not covered/);
  });

  it("Checks off: coverage stays while the evidence bar drops to 0; it toggles with aria-pressed", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const toggle = screen.getByRole("button", { name: "Checks were off in these runs" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/16 of 17 covered/)).toBeInTheDocument();
    expect(screen.getByText("0 of 17 (0%)")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText(`16 of 17 (${formatPercent(16 / 17)})`)).toBeInTheDocument();
  });

  it("Plan gap: the denominator grows and 100% drops; the plan items show as not in the model", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Directed test for the rare bin" }));
    fireEvent.click(screen.getByRole("button", { name: "The plan has 2 items the model lacks" }));
    expect(screen.getByText(/17 of 19 covered \(89\.5%\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/not in the coverage model/)).toHaveLength(2);
    expect(status()).toHaveTextContent(/100% of the model is 89\.5% of the plan/);
  });

  it("Start over restores the first run", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Directed test for the rare bin" }));
    fireEvent.click(screen.getByRole("button", { name: "Start over with these settings" }));
    expect(screen.getByText("rare bin: hole")).toBeInTheDocument();
  });
});

describe("ClosureBudgetLab: r2 fixes", () => {
  it("F1B preset: after the reveal the workbench opens at the lesson's 0.1% bin, and the first More seeds press leaves the rare bin a hole", () => {
    render(<ClosureBudgetLab />);
    skip();
    const preset = getPreset("f1b-closure-trap");
    expect(screen.getByText(workbenchIntro(preset) as string)).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Rare-bin probability" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent("0.1%");
    expect(screen.getByText("1,002")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More seeds (+100 random samples)" }));
    expect(screen.getByText("rare bin: hole")).toBeInTheDocument();
    expect(screen.getByText(/16 of 17 covered/)).toBeInTheDocument();
    const expected = closureReducer(initialClosureState(workbenchConfig(preset)), { type: "more-seeds" }).log[0].text;
    expect(status()).toHaveTextContent(expected);
  });

  it("the latest outcome is read once: its visible line is aria-hidden while the live region carries it", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Directed test for the rare bin" }));
    const text = lastOutcome(closureReducer(initialClosureState(standalone), { type: "directed" }), "directed")!.text;
    const copies = screen.getAllByText(text);
    expect(copies).toHaveLength(2);
    const visible = copies.find((el) => !status().contains(el))!;
    expect(visible).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "Checks were off in these runs" }));
    expect(visible).not.toHaveAttribute("aria-hidden");
  });

  it("repeating the same outcome replaces the live-region node so it is re-announced", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const toggle = screen.getByRole("button", { name: "Checks were off in these runs" });
    fireEvent.click(toggle);
    const first = status().firstElementChild;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(status().firstElementChild?.textContent).toBe(first?.textContent);
    expect(status().firstElementChild).not.toBe(first);
  });

  it("changing a setting announces the new expected samples to close", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Common bins" })).getByRole("radio", { name: "32" }));
    const next = initialClosureState({ ...standalone, commonBins: 32 });
    expect(status()).toHaveTextContent(settingsText(next, "configure"));
    expect(status()).toHaveTextContent(`Expect about ${formatSamples(closureExpectations(next.config).all)} samples to close all 33 bins`);
  });

  it("a waiver refused for its reason marks the input invalid, describes it with the message and focuses it", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    const input = screen.getByLabelText("Waiver reason");
    expect(input).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Waive the hole" }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/at least 10 characters/);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "unreachable in this product mode" } });
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("the x axis stays readable at 1,000,000 samples: right-aligned last label, every other decade labelled", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Samples per run" })).getByRole("radio", { name: "5,000" }));
    const more = screen.getByRole("button", { name: "More seeds (+5,000 random samples)" });
    for (let i = 0; i < 199; i += 1) fireEvent.click(more);
    const chart = screen.getByRole("img");
    const last = chart.querySelector('[data-tick="1000000"] text');
    expect(last).toHaveAttribute("text-anchor", "end");
    expect(last).toHaveTextContent("1,000,000");
    expect(chart.querySelector('[data-tick="100000"] text')).toBeNull();
  });

  it("checks off says it covers later directed runs too", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Checks were off in these runs" }));
    expect(status()).toHaveTextContent("The setting applies to every run, a directed run made later included.");
    fireEvent.click(screen.getByRole("button", { name: "Directed test for the rare bin" }));
    expect(screen.getByText("0 of 17 (0%)")).toBeInTheDocument();
    expect(status()).toHaveTextContent("it adds coverage but no evidence");
  });

  it("go further points to I-SV-3A and the 32-bin, 0.1% setting, from the model", () => {
    render(<ClosureBudgetLab preset="standalone" />);
    skip();
    expect(screen.getByText(goFurtherText(), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open I-SV-3A: Functional Coverage Fundamentals" })).toHaveAttribute(
      "href",
      "/curriculum/T2_Intermediate/I-SV-3A_Functional_Coverage_Fundamentals/index",
    );
  });

  it("the assumptions no longer call the quadrature exact", () => {
    expect(CLOSURE_ASSUMPTIONS.join(" ")).not.toMatch(/are exact/);
    expect(CLOSURE_ASSUMPTIONS[1]).toContain("within 0.01 samples");
  });
});
