import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FixPathDecisionLab, { FIX_PATH_ASSUMPTIONS } from "@/components/curriculum/f1/FixPathDecisionLab";
import { DELAY_EXCEPTION, FIX_LABELS, KATA_SCENARIOS, MISCONCEPTIONS, costExplanation, decide, escapeLine, findScenario } from "@/lib/fix-path-model";

const lockIn = (scope: HTMLElement, label: string) => {
  fireEvent.click(within(scope).getByLabelText(label));
  fireEvent.click(within(scope).getByRole("button", { name: /lock in prediction/i }));
};

const radio = (group: string, name: string) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });

const result = () => screen.queryByTestId("fix-path-result");

describe("FixPathDecisionLab (decide mode)", () => {
  it("names itself, declares a conceptual illustration, and hides every answer until a prediction is locked in", () => {
    render(<FixPathDecisionLab />);
    expect(screen.getByRole("region", { name: /Fix path decision lab/ })).toBeInTheDocument();
    expect(screen.getByText("Conceptual illustration")).toBeInTheDocument();
    expect(radio("Bug", "1 · Wrong reset value")).toHaveAttribute("aria-checked", "true");
    expect(result()).not.toBeInTheDocument();
    expect(screen.queryByText(/×100/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Days to weeks/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Triage steps/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("bug 1: a correct ECO prediction reveals the dashed cross-section, the tree path, ×100 and the delay class", () => {
    const facts = findScenario("reset-value")!.facts;
    render(<FixPathDecisionLab preset="reset-value" />);
    lockIn(document.body, FIX_LABELS.eco);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const res = result()!;
    expect(within(res).getByRole("img").getAttribute("aria-label")).toBe(
      "Pre-tape-out ECO: no mask exists yet. upper metal + vias: no mask yet; metal + vias: no mask yet; lowest metal: no mask yet; base (transistors): no mask yet.",
    );
    expect(within(res).getAllByText(/×100/).length).toBeGreaterThan(0);
    expect(within(res).getAllByText("Days to weeks; no masks yet").length).toBeGreaterThan(0);
    const tree = within(res).getByRole("list", { name: /Triage steps 2 to 5/ });
    const steps = within(tree).getAllByRole("listitem");
    expect(steps.map((s) => s.getAttribute("data-taken"))).toEqual(["true", "true", "false", null]);
    expect(steps[1]).toHaveTextContent(`no→ ${FIX_LABELS.eco}`);
    expect(steps[2]).toHaveTextContent("Not reached on this path.");
    expect(within(res).getByText(escapeLine("system", findScenario("reset-value")!.escape))).toBeInTheDocument();
    // The summary is visible text in the result; PredictionPrompt's own live region announces the feedback, so there is no extra status region.
    expect(within(res).getByText(decide(facts).summary)).toBeInTheDocument();
    expect(within(res).queryByRole("status")).not.toBeInTheDocument();
    // The path is marked with text, not with several aria-current items.
    expect(tree.querySelectorAll("[aria-current]")).toHaveLength(0);
    expect(within(tree).getAllByText("(on this path)")).toHaveLength(3);
  });

  it("bug 3: predicting metal-only diagnoses 'lines of RTL = layers' and the reveal shows a full respin", () => {
    render(<FixPathDecisionLab preset="pipeline-stage" />);
    lockIn(document.body, FIX_LABELS.metal);
    expect(screen.getByText(/^Not quite\./).parentElement).toHaveTextContent(MISCONCEPTIONS.linesOfRtl);
    const res = result()!;
    expect(within(res).getAllByText("×1,000 or more").length).toBeGreaterThan(0);
    const svg = within(res).getByRole("img");
    expect(Array.from(svg.querySelectorAll("g[data-state]")).map((g) => g.getAttribute("data-state"))).toEqual(["new", "new", "new", "new"]);
  });

  it("bug 2: the FIB option is diagnosed as a sample-only edit, and metal-only hatches only the upper metal", () => {
    render(<FixPathDecisionLab preset="comparator" />);
    lockIn(document.body, FIX_LABELS.fib);
    expect(screen.getByText(/^Not quite\./).parentElement).toHaveTextContent(MISCONCEPTIONS.fibFixesProduction);
    const svg = within(result()!).getByRole("img");
    expect(Array.from(svg.querySelectorAll("g[data-state]")).map((g) => g.getAttribute("data-state"))).toEqual(["new", "new", "reused", "reused"]);
  });

  it("bug 4: the workaround shows unchanged silicon now and the real fix waiting for new silicon", () => {
    render(<FixPathDecisionLab preset="field-corruption" />);
    lockIn(document.body, FIX_LABELS.workaround);
    const res = result()!;
    expect(within(res).getAllByText("Workaround as fast as a firmware release; the real fix waits for new silicon").length).toBeGreaterThan(0);
    expect(within(res).getAllByText("×10,000", { exact: false }).length).toBeGreaterThan(0);
    expect(within(res).getByText("Now: the shipped silicon is unchanged")).toBeInTheDocument();
  });

  it("switching bug resets the prompt, so the next answer is hidden again", () => {
    render(<FixPathDecisionLab />);
    lockIn(document.body, FIX_LABELS.eco);
    expect(result()).toBeInTheDocument();
    fireEvent.click(radio("Bug", "2 · > vs >="));
    expect(result()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("custom: unknown timing gives 'depends', with both cross-sections; changing a fact hides the answer again", () => {
    render(<FixPathDecisionLab preset="custom" />);
    fireEvent.click(radio("Timing of a metal-only fix", "Unknown"));
    expect(screen.getByRole("list", { name: "Your bug's facts" })).toHaveTextContent("Timing of a metal-only fix: unknown");
    lockIn(document.body, FIX_LABELS.depends);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    const res = result()!;
    expect(within(res).getAllByRole("img")).toHaveLength(2);
    expect(within(res).getByText("If timing closes: metal-only respin")).toBeInTheDocument();
    expect(within(res).getByText("If not: full respin")).toBeInTheDocument();
    fireEvent.click(radio("Timing of a metal-only fix", "Closes"));
    expect(result()).not.toBeInTheDocument();
  });

  it("custom: gate counts drive the answer; too few spare cells and none elsewhere make metal-only 'any bug can be fixed in metal'", () => {
    render(<FixPathDecisionLab preset="custom" />);
    fireEvent.change(screen.getByLabelText("Gates needed"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Gates needed"), { target: { value: "-3" } });
    expect(screen.getByLabelText("Gates needed")).toHaveValue(40);
    lockIn(document.body, FIX_LABELS.metal);
    expect(screen.getByText(/^Not quite\./).parentElement).toHaveTextContent(MISCONCEPTIONS.anyBugInMetal);
    expect(screen.getByText(/Why the answer holds:/).parentElement).toHaveTextContent("(40 gates needed, 12 spare cells nearby)");
    expect(result()).toHaveTextContent("Fix: Full (base-layer) respin.");
  });

  it("custom: a count field can be cleared and retyped; an empty field keeps the last count and restores it on blur", () => {
    render(<FixPathDecisionLab preset="custom" />);
    const gates = screen.getByLabelText("Gates needed");
    const facts = () => screen.getByRole("list", { name: "Your bug's facts" });
    fireEvent.change(gates, { target: { value: "" } });
    expect(gates).toHaveValue(null);
    expect(facts()).toHaveTextContent("Gates needed: 4; spare cells nearby: 12");
    expect(screen.getByText(/until then the count stays 4\./)).toBeInTheDocument();
    fireEvent.change(gates, { target: { value: "4" } });
    fireEvent.change(gates, { target: { value: "40" } });
    expect(gates).toHaveValue(40);
    expect(facts()).toHaveTextContent("Gates needed: 40; spare cells nearby: 12");
    fireEvent.change(gates, { target: { value: "" } });
    fireEvent.blur(gates);
    expect(gates).toHaveValue(40);
    fireEvent.change(gates, { target: { value: "1000" } });
    fireEvent.change(gates, { target: { value: "2.5" } });
    expect(gates).toHaveValue(40);
    expect(facts()).toHaveTextContent("Gates needed: 40;");
  });

  it("custom: before tape-out the workaround, new-transistor, spare-cell and timing controls are replaced by a visible note", () => {
    render(<FixPathDecisionLab preset="custom" />);
    fireEvent.click(radio("Needs new transistors?", "Yes"));
    fireEvent.click(radio("Taped out?", "No"));
    expect(screen.queryByRole("radiogroup", { name: "Firmware or defeature path" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Needs new transistors?" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gates needed")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your bug's facts" })).toHaveTextContent("Needs new transistors (a new structure): no");
    expect(screen.getByText(/a larger change goes back through synthesis and place-and-route/)).toBeInTheDocument();
    expect(screen.getByText(/before tape-out. Workaround paths, new transistors, spare cells and timing are modelled only after tape-out/)).toBeInTheDocument();
    lockIn(document.body, FIX_LABELS.eco);
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });

  it("is keyboard operable: arrow keys move through the bug presets", () => {
    render(<FixPathDecisionLab />);
    const first = radio("Bug", "1 · Wrong reset value");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(radio("Bug", "2 · > vs >=")).toHaveAttribute("aria-checked", "true");
    expect(radio("Bug", "2 · > vs >=")).toHaveFocus();
  });

  it("lists the lab's extensions of the lesson as assumptions", () => {
    expect(FIX_PATH_ASSUMPTIONS.some((a) => /Every metal-only fix must still close timing/.test(a))).toBe(true);
    expect(FIX_PATH_ASSUMPTIONS.some((a) => /held wafers belong to first silicon/.test(a))).toBe(true);
    expect(FIX_PATH_ASSUMPTIONS.some((a) => /for example/.test(a))).toBe(true);
    expect(FIX_PATH_ASSUMPTIONS.some((a) => /Before tape-out only a small fix is modelled/.test(a))).toBe(true);
  });

  it("an unknown preset falls back to the first worked example", () => {
    render(<FixPathDecisionLab preset="nope" />);
    expect(radio("Bug", "1 · Wrong reset value")).toHaveAttribute("aria-checked", "true");
  });
});

describe("FixPathDecisionLab (kata mode)", () => {
  const scenarioItem = (n: number) => screen.getByRole("listitem", { name: `Scenario ${n}` });

  const commitAll = () => {
    const answers = [FIX_LABELS.spec, FIX_LABELS.eco, FIX_LABELS.depends, FIX_LABELS.workaround];
    answers.forEach((a, i) => lockIn(scenarioItem(i + 1), a));
  };

  it("hides each answer until its fix is committed, and the rankings until all four are", () => {
    render(<FixPathDecisionLab mode="kata" />);
    expect(screen.getByRole("region", { name: /Fix path kata/ })).toBeInTheDocument();
    expect(result()).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Stages by cost/ })).not.toBeInTheDocument();
    expect(screen.getByText(/0 of 4 done/)).toBeInTheDocument();

    lockIn(scenarioItem(3), FIX_LABELS.metal);
    expect(within(scenarioItem(3)).getByText(/^Not quite\./).parentElement).toHaveTextContent(/Timing is not known yet/);
    expect(within(scenarioItem(3)).getByTestId("fix-path-result")).toHaveTextContent("Weeks if metal-only closes; months if not");
    expect(within(scenarioItem(1)).queryByTestId("fix-path-result")).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 4 done/)).toBeInTheDocument();
  });

  it("each kata reveal states the lesson's answer, cost and delay from the model", () => {
    render(<FixPathDecisionLab mode="kata" />);
    commitAll();
    KATA_SCENARIOS.forEach((s, i) => {
      const res = within(scenarioItem(i + 1)).getByTestId("fix-path-result");
      expect(res).toHaveTextContent(decide(s.facts).summary);
      if (s.detail) expect(res).toHaveTextContent(s.detail);
    });
    expect(screen.getByText(/All 4 fixes committed/)).toBeInTheDocument();
    // Several legends render at once; their hatch pattern ids are unique.
    const ids = Array.from(document.querySelectorAll("pattern")).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("revealing without predicting unlocks the ranking but is not counted as a committed fix", () => {
    render(<FixPathDecisionLab mode="kata" />);
    lockIn(scenarioItem(1), FIX_LABELS.spec);
    [2, 3, 4].forEach((n) => fireEvent.click(within(scenarioItem(n)).getByRole("button", { name: "Reveal without predicting" })));
    expect(screen.queryByText(/All 4 fixes committed/)).not.toBeInTheDocument();
    expect(screen.getByText("All 4 scenarios answered (1 committed, 3 revealed without a prediction). Now rank the five stages.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rank by cost, cheapest first" })).toBeInTheDocument();
  });

  it("cost ranking: checks against the cost order and explains it from the cost model", () => {
    render(<FixPathDecisionLab mode="kata" />);
    commitAll();
    const task = screen.getByRole("region", { name: "Rank by cost, cheapest first" });
    expect(within(task).queryByText(costExplanation())).not.toBeInTheDocument();
    // Start order: field, rtl, post-silicon, spec, system. Move spec to the top, then rtl to second.
    const up = (label: string, times: number) => {
      for (let i = 0; i < times; i += 1) fireEvent.click(within(task).getByRole("button", { name: `Move up: ${label}` }));
    };
    up("Spec review", 3);
    up("RTL simulation", 1);
    up("Full-chip / emulation", 2);
    up("Post-silicon (lab)", 1);
    const order = within(within(task).getByRole("list", { name: /Stages by cost/ })).getAllByRole("listitem").map((li) => li.textContent);
    expect(order[0]).toMatch(/^1Spec review/);
    fireEvent.click(within(task).getByRole("button", { name: "Check this order" }));
    expect(within(task).getByText("All 5 graded positions are right.")).toBeInTheDocument();
    expect(within(task).getByText(costExplanation())).toBeInTheDocument();
    fireEvent.click(within(task).getByRole("button", { name: "Reorder again" }));
    expect(within(task).getByRole("button", { name: "Check this order" })).toBeInTheDocument();
  });

  it("delay ranking: the field stage is not graded, and the check explains the delay exception", () => {
    render(<FixPathDecisionLab mode="kata" />);
    commitAll();
    const task = screen.getByRole("region", { name: "Rank by delay, shortest first" });
    fireEvent.click(within(task).getByRole("button", { name: "Check this order" }));
    expect(within(task).getByText(/of 4 graded positions are right\./)).toBeInTheDocument();
    expect(within(task).getByText(DELAY_EXCEPTION)).toBeInTheDocument();
    const field = within(task).getAllByRole("listitem").find((li) => li.textContent?.includes("In the field"))!;
    expect(field).toHaveTextContent("Not graded");
    expect(field).not.toHaveTextContent(/correct position|wrong position/);
  });
});
