import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import XCheckLab from "@/components/visuals/XCheckLab";
import { evaluateChecker, findCheckerPreset, gradeSuspects, simulateStatusReg } from "@/lib/x-check-model";

/** What is on screen, not what the live region repeats. */
const onScreen = { ignore: 'script, style, [role="status"]' };

const lockIn = (label: RegExp | string) => {
  const radio = screen.getByLabelText(label);
  fireEvent.click(radio);
  const prompt = radio.closest("fieldset")?.parentElement as HTMLElement;
  fireEvent.click(within(prompt).getByRole("button", { name: /lock in prediction/i }));
};
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
const steps = () => screen.queryAllByTestId("check-step");
const preset = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Presets" })).getByRole("button", { name }));

describe("XCheckLab · checker", () => {
  it("has an accessible name, opens on 9'b0_0000_101x with !=, and hides the answer until a prediction is locked in", () => {
    render(<XCheckLab />);
    expect(screen.getByRole("region", { name: "X check lab: which counter moves" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Presets" })).getByRole("button", { name: "9'b0_0000_101x" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("if (sum != e.sum) fail_cnt++; else pass_cnt++;", { exact: false })).toBeInTheDocument();
    expect(screen.queryByTestId("checker-reveal")).not.toBeInTheDocument();
    expect(steps()).toHaveLength(0);
    expect(screen.queryByLabelText("1'bx")).not.toBeInTheDocument();
    expect(screen.queryByText(/False pass/, onScreen)).not.toBeInTheDocument();
  });

  it("reveals the three chips in order: operator 1'bx (§11.4.5), else (§12.4), pass_cnt++", () => {
    render(<XCheckLab mode="checker" />);
    lockIn("pass_cnt++");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    const r = evaluateChecker(findCheckerPreset("x-low").config);
    // Starts on the first step and adds one chip per Next.
    expect(steps()).toHaveLength(1);
    for (let i = 1; i < r.steps.length; i += 1) next();
    expect(steps()).toHaveLength(r.steps.length);
    const [operator, branch, counter] = steps().slice(-3);
    expect(within(operator).getByText("sum != e.sum")).toBeInTheDocument();
    expect(within(operator).getByLabelText("1'bx")).toBeInTheDocument();
    expect(within(operator).getByText("§11.4.5")).toBeInTheDocument();
    expect(within(branch).getByLabelText("else")).toBeInTheDocument();
    expect(within(branch).getByText("§12.4")).toBeInTheDocument();
    expect(within(counter).getByLabelText("pass_cnt++")).toBeInTheDocument();
    expect(screen.getByTestId("check-verdict")).toHaveTextContent(r.verdictText);
    expect(screen.getByRole("status")).toHaveTextContent(/pass_cnt\+\+/);
  });

  it("diagnoses the 'x counts as a failure' misconception", () => {
    render(<XCheckLab />);
    lockIn("fail_cnt++");
    expect(screen.getByText(/Not quite\./, onScreen)).toBeInTheDocument();
    expect(screen.getByText(/An x condition is not a failure for an if/, onScreen)).toBeInTheDocument();
  });

  it("changing the form inside the code line re-arms the prediction: !== catches the x", () => {
    render(<XCheckLab />);
    lockIn("pass_cnt++");
    fireEvent.change(screen.getByRole("combobox", { name: "Checker form" }), { target: { value: "case-neq" } });
    expect(screen.queryByTestId("checker-reveal")).not.toBeInTheDocument();
    expect(screen.getByText("if (sum !== e.sum) fail_cnt++; else pass_cnt++;", { exact: false })).toBeInTheDocument();
    lockIn("fail_cnt++");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    expect(within(steps().at(-1) as HTMLElement).getByLabelText("fail_cnt++")).toBeInTheDocument();
  });

  it("assert (sum == e.sum) fails on x and runs its fail statement (§16.3)", () => {
    render(<XCheckLab />);
    fireEvent.change(screen.getByRole("combobox", { name: "Checker form" }), { target: { value: "assert-eq" } });
    lockIn("pass_cnt++");
    expect(screen.getByText(/reads x like an if does/, onScreen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    const branch = steps().find((li) => within(li).queryByText("assert"));
    expect(within(branch as HTMLElement).getByText("§16.3")).toBeInTheDocument();
    expect(within(branch as HTMLElement).getByLabelText("fail statement (else)")).toBeInTheDocument();
  });

  it("valid-x preset: without the guard an x out_valid skips the compare; adding the guard fails it", () => {
    render(<XCheckLab preset="valid-x" />);
    expect(screen.queryByText(/\$isunknown\(out_valid\)\) begin/)).not.toBeInTheDocument();
    lockIn("neither counter moves");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    expect(screen.getByTestId("check-verdict")).toHaveTextContent(/Silent skip/);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "$isunknown(out_valid) guard" })).getByRole("radio", { name: "with $isunknown" }));
    lockIn("fail_cnt++");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
  });

  it("int-copy preset: the 2-state copy turns x into 0 so even !== passes (§6.11.2)", () => {
    render(<XCheckLab preset="int-copy" />);
    lockIn("pass_cnt++");
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    expect(screen.getByLabelText("s = 10")).toBeInTheDocument();
    expect(screen.getByText("§6.11.2")).toBeInTheDocument();
  });

  it("bit chips are buttons that cycle 0 → 1 → x → z and change the preset state", () => {
    render(<XCheckLab />);
    preset("9'd10");
    const bit0 = screen.getByRole("button", { name: /^sum\[0\] is 0\./ });
    fireEvent.click(bit0);
    expect(screen.getByRole("button", { name: /^sum\[0\] is 1\./ })).toBeInTheDocument();
    expect(screen.getByText("= 9'b0_0000_1011")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Presets" })).getByRole("button", { name: "9'd11" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the step scrubber is keyboard operable and labelled", () => {
    render(<XCheckLab preset="d10" />);
    lockIn("pass_cnt++");
    const slider = screen.getByRole("slider", { name: "Reveal step" });
    fireEvent.change(slider, { target: { value: "2" } });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/^Step 3 of /));
    expect(screen.getByRole("button", { name: "Previous step" })).not.toBeDisabled();
  });
});

describe("XCheckLab · debug", () => {
  const pick = (code: RegExp) => fireEvent.click(screen.getByRole("button", { name: code }));
  const toggle = (name: RegExp) => fireEvent.click(within(screen.getByRole("group", { name: "Fixes" })).getByRole("button", { name }));
  const skipHunt = () => fireEvent.click(screen.getByRole("button", { name: "Skip the hunt and go to the fixes" }));
  const log = () => screen.getByLabelText("Simulation log").textContent;

  it("shows the lesson's code with its labels and grades suspect picks with model evidence", () => {
    render(<XCheckLab mode="debug" preset="status-reg" />);
    expect(screen.getByRole("region", { name: "X check lab: the reset bug nobody saw" })).toBeInTheDocument();
    expect(screen.getByText(/bit +err_bit; +\/\/ \(B\) the monitor's copy of the flag/)).toBeInTheDocument();
    expect(screen.queryByTestId("fix-panel")).not.toBeInTheDocument();
    pick(/Suspect line \d+: rst_n <= 1'b1;/);
    expect(screen.getByTestId("suspect-verdict")).toHaveTextContent("A decoy.");
    const suspects = gradeSuspects();
    pick(/Suspect line \d+: if \(!rst_n\) busy <= 1'b0;/);
    expect(screen.getByTestId("suspect-verdict")).toHaveTextContent(suspects.find((s) => s.id === "A")?.evidence as string);
    expect(screen.getByTestId("hunt-progress")).toHaveTextContent("Culprits found: 1 of 3");
    // The visible "found" badge is part of the button's accessible name; a decoy never gets it.
    expect(screen.getByRole("button", { name: /Suspect line \d+: if \(!rst_n\) busy <= 1'b0;.*, found$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suspect line \d+: rst_n <= 1'b1;.*, found$/ })).not.toBeInTheDocument();
  });

  it("offers a three-step hint ladder", () => {
    render(<XCheckLab mode="debug" />);
    fireEvent.click(screen.getByRole("button", { name: /Need a hint/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    expect(screen.getAllByRole("listitem").filter((li) => li.closest("ol.list-decimal"))).toHaveLength(3);
  });

  it("finding A, B and C opens the fixes; the unfixed log is the lesson's PASS=3 FAIL=0", () => {
    render(<XCheckLab mode="debug" />);
    pick(/Suspect line \d+: if \(!rst_n\) busy <= 1'b0;/);
    pick(/Suspect line \d+: bit +err_bit;/);
    pick(/Suspect line \d+: if \(err_bit != 1'b0\) begin/);
    expect(screen.getByTestId("fix-panel")).toBeInTheDocument();
    expect(log()).toBe("PASS=3 FAIL=0");
  });

  it("predicts each log before it runs, and pins all four logs", () => {
    render(<XCheckLab mode="debug" />);
    skipHunt();
    // Fix B only: still PASS=3, because != gives x.
    toggle(/\(B\)/);
    expect(screen.queryByLabelText("Simulation log")).not.toBeInTheDocument();
    expect(screen.queryByText(/✓ marks a pass/)).not.toBeInTheDocument();
    lockIn("PASS=0 FAIL=3");
    expect(screen.getByText(/Not quite\./, onScreen)).toBeInTheDocument();
    expect(screen.getByText(/err_q keeps the x, but err_q != 1'b0 is x/, onScreen)).toBeInTheDocument();
    expect(log()).toBe(simulateStatusReg({ A: false, B: true, C: false }).summary);
    expect(log()).toBe("PASS=3 FAIL=0");
    // Fix C only.
    toggle(/\(B\)/);
    toggle(/\(C\)/);
    expect(within(screen.getByRole("list", { name: "status_reg and tb_top" })).getByText(/if \(err_bit !== 1'b0\) begin/)).toBeInTheDocument();
    lockIn("PASS=3 FAIL=0");
    expect(screen.getByText(/Correct\./, onScreen)).toBeInTheDocument();
    expect(log()).toBe("PASS=3 FAIL=0");
    // B and C.
    toggle(/\(B\)/);
    lockIn("PASS=0 FAIL=3");
    expect(log()).toBe("Error @ edge 2: err is set\nError @ edge 3: err is set\nError @ edge 4: err is set\nPASS=0 FAIL=3");
    // The DUT fixed as well.
    toggle(/\(A\)/);
    lockIn("PASS=3 FAIL=0");
    expect(screen.getByText(/honest/, onScreen)).toBeInTheDocument();
    expect(log()).toBe("PASS=3 FAIL=0");
    expect(screen.getByRole("list", { name: "Fix states predicted" })).not.toHaveTextContent("not yet");
  });

  it("a state predicted once shows its log at once when revisited", () => {
    render(<XCheckLab mode="debug" />);
    skipHunt();
    toggle(/\(B\)/);
    lockIn("PASS=3 FAIL=0");
    toggle(/\(B\)/);
    toggle(/\(B\)/);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(log()).toBe("PASS=3 FAIL=0");
  });

  it("explains why stopping at the first $error is wrong (§20.10)", () => {
    render(<XCheckLab mode="debug" />);
    skipHunt();
    toggle(/\(B\)/);
    toggle(/\(C\)/);
    lockIn("PASS=0 FAIL=1, then the run stops");
    expect(screen.getByText(/only \$fatal implies \$finish \(§20\.10\)/, onScreen)).toBeInTheDocument();
  });

  it("start over returns to the hunt", () => {
    render(<XCheckLab mode="debug" />);
    skipHunt();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("fix-panel")).not.toBeInTheDocument();
  });
});
