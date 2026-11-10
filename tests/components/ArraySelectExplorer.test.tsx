import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ArraySelectExplorer from "@/components/visuals/ArraySelectExplorer";
import {
  PART_CASES,
  evaluateCase,
  evaluatePartCase,
  findQueryTarget,
  findSelectCase,
  outcomeLabel,
  partOptions,
  queryArray,
  selectOptions,
  TWO_STATE_UNSTATED_TEXT,
} from "@/lib/sv-array-select-model";

const radio = (group: string, name: string | RegExp) => within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
const live = () => screen.getByTestId("array-select-live");
const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const choose = (label: string) => {
  const fieldset = document.querySelector("fieldset") as HTMLElement;
  fireEvent.click(within(fieldset).getByLabelText(label));
};

describe("ArraySelectExplorer: select mode", () => {
  it("names itself, declares a model, and hides the answer until a prediction is locked in", () => {
    render(<ArraySelectExplorer />);
    expect(screen.getByRole("region", { name: /Array select explorer: what a select reads/ })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
    // Default preset starts on w[2].
    expect(radio("Select expression", "w[2]")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("select-value")).not.toBeInTheDocument();
    expect(live()).toHaveTextContent("Predict what w[2] reads.");
    // Lane labels name the element only after the reveal.
    expect(screen.queryByText("w[2]", { selector: "span" })).not.toBeInTheDocument();

    const right = outcomeLabel(evaluateCase(findSelectCase("w2")!, "logic"));
    choose(right);
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("select-value")).toHaveTextContent("8'hBB");
    expect(live()).toHaveTextContent(/w\[2\] reads 8'hBB/);
    // The prompt's own live region carries the explanation; this one only gives a short status, so nothing is read twice.
    expect(live()).toHaveTextContent("Revealed: w[2] reads 8'hBB.");
    expect(live().textContent).not.toMatch(/§7\.4\.5/);
    // The strip now marks the bits w[2] reads.
    expect(screen.getByRole("img", { name: /logic \[3:0\]\[7:0\] w, one 32-bit vector/ }).getAttribute("aria-label")).toMatch(/bits 23 to 16 read by w\[2\]/);
  });

  it("a wrong prediction explains the misreading with a computed value and a clause", () => {
    render(<ArraySelectExplorer />);
    const wrong = selectOptions(findSelectCase("w2")!, "logic").find((o) => o.id === "from-left")!;
    choose(wrong.label);
    lockIn();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(wrong.feedback)).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds/)).toBeInTheDocument();
  });

  it("w[23:16] reads x with the tool-dependent compile-time note; the bit toggle says the 2-state value is not stated", () => {
    render(<ArraySelectExplorer />);
    fireEvent.click(radio("Select expression", "w[23:16]"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("select-value")).toHaveTextContent("64'hxxxx_xxxx_xxxx_xxxx");
    expect(screen.getAllByRole("note").some((n) => /tool-dependent/.test(n.textContent ?? ""))).toBe(true);

    fireEvent.click(radio("Element type", "bit, 2-state"));
    // A new scenario: the answer is hidden again.
    expect(screen.queryByTestId("select-value")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("select-value")).toHaveTextContent(TWO_STATE_UNSTATED_TEXT);
    expect(screen.getByText(/What does IEEE 1800-2023 state that/)).toBeInTheDocument();
  });

  it("b[5] reads 'x for logic and '0 for bit (Table 7-1)", () => {
    render(<ArraySelectExplorer />);
    fireEvent.click(radio("Select expression", "b[5]"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("select-value")).toHaveTextContent("8'hxx");
    expect(within(screen.getByRole("list", { name: "Why" })).getByText(/Table 7-1 value: 'x for a 4-state/)).toBeInTheDocument();
    fireEvent.click(radio("Element type", "bit, 2-state"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("select-value")).toHaveTextContent("8'h00");
  });

  it("the mixed-dimensions preset starts on mem[5] and lights word 5 in the rows-by-lanes grid only after the reveal", () => {
    render(<ArraySelectExplorer mode="select" preset="mixed-dimensions" />);
    expect(radio("Select expression", "mem[5]")).toHaveAttribute("aria-checked", "true");
    const table = screen.getByRole("table", { name: /16 words in rows/ });
    expect(table.querySelector('[aria-current="true"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const current = table.querySelector('[aria-current="true"]');
    expect(current?.textContent).toContain("mem[5]");
    expect(screen.getByTestId("select-value")).toHaveTextContent("32'h5352_5150");
  });

  it("mem[5][2][3] shows the byte and the bit it reads", () => {
    render(<ArraySelectExplorer preset="mixed-dimensions" />);
    fireEvent.click(radio("Select expression", "mem[5][2][3]"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("select-value")).toHaveTextContent("1'b0");
    expect(screen.getByRole("img", { name: /^mem\[5\]\[2\]: 8-bit value 8'b0101_0010.*bit 3 read: bit 19 of mem\[5\]/ })).toBeInTheDocument();
  });

  it("grid hides the logic/bit toggle because int is always 2-state; grid[1] lights a whole row", () => {
    render(<ArraySelectExplorer />);
    expect(screen.getByRole("radiogroup", { name: "Element type" })).toBeInTheDocument();
    fireEvent.click(radio("Select expression", "grid[1]"));
    expect(screen.getByText(/grid is int, which is always 2-state/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Element type" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    const table = screen.getByRole("table", { name: /4 rows of 8 ints/ });
    expect(Array.from(table.querySelectorAll('[aria-current="true"]')).map((c) => c.textContent)).toEqual(["10", "11", "12", "13", "14", "15", "16", "17"]);
  });

  it("w[2][3] asks which bit it reads: the from-left option has the same value but names bit 11, and the feedback says so", () => {
    render(<ArraySelectExplorer />);
    fireEvent.click(radio("Select expression", "w[2][3]"));
    expect(screen.getByText(/Which bit does/)).toBeInTheDocument();
    const fromLeft = selectOptions(findSelectCase("w2_3")!, "logic").find((o) => o.id === "from-left")!;
    choose(fromLeft.label);
    lockIn();
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(fromLeft.feedback)).toHaveTextContent(/Not quite\. Bit 11 of w, not bit 19/);
  });

  it("the select chips are a keyboard radio group: arrow keys move the selection", () => {
    render(<ArraySelectExplorer />);
    const current = radio("Select expression", "w[2]");
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(radio("Select expression", "w[3:2]")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("Select expression", "w[3:2]"));
  });

  it("an unknown preset is reported on the page and the default is shown", () => {
    render(<ArraySelectExplorer preset="nope" />);
    expect(screen.getByRole("note")).toHaveTextContent(/Preset “nope” is not one of/);
    expect(radio("Select expression", "w[2]")).toHaveAttribute("aria-checked", "true");
  });
});

describe("ArraySelectExplorer: part-select mode", () => {
  it("predict which byte v[8*i +: 8] covers; moving the slider resets the prediction", () => {
    render(<ArraySelectExplorer mode="part-select" />);
    expect(screen.getByRole("region", { name: /indexed part-selects/ })).toBeInTheDocument();
    const c = PART_CASES.find((p) => p.id === "v-var")!;
    const right = partOptions(c, 1).find((o) => o.correct)!;
    expect(right.label).toBe("v[15:8] = 8'hCC");
    expect(screen.queryByTestId("part-value")).not.toBeInTheDocument();
    choose(right.label);
    lockIn();
    expect(screen.getByTestId("part-value")).toHaveTextContent("8'hCC");
    // The explanation is shown (and announced) once, inside the prompt; the sr-only region only gives a status.
    expect(screen.getAllByText(evaluatePartCase(c, 1).explanation).length).toBeGreaterThan(0);
    expect(live()).toHaveTextContent("Revealed: v[8*i +: 8] reads 8'hCC.");
    expect(live().textContent).not.toContain(evaluatePartCase(c, 1).explanation);

    fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });
    expect(screen.queryByTestId("part-value")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("part-value")).toHaveTextContent("8'hxx");
    expect(screen.getAllByRole("note").some((n) => /compile-time error/.test(n.textContent ?? ""))).toBe(true);
  });

  it("on logic [0:15] up_vect, up_vect[0 +: 8] is up_vect[0:7], the most significant byte", () => {
    render(<ArraySelectExplorer mode="part-select" />);
    fireEvent.click(radio("Declaration", "logic [0:15] up_vect"));
    expect(radio("Indexed part-select", "up_vect[0 +: 8]")).toHaveAttribute("aria-checked", "true");
    choose("up_vect[0:7] = 8'hC3");
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("the most significant byte")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /logic \[0:15\] up_vect, ascending/ }).getAttribute("aria-label")).toMatch(/bits 0 to 7 read by up_vect\[0 \+: 8\]/);
  });

  it("a partially out-of-range select reads x only for the missing bits", () => {
    render(<ArraySelectExplorer mode="part-select" />);
    fireEvent.click(radio("Indexed part-select", "v[28 +: 8]"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("part-value")).toHaveTextContent("8'hxA");
    expect(screen.getAllByText(/bits 35 to 32 do not exist and read x/).length).toBeGreaterThan(0);
  });
});

describe("ArraySelectExplorer: query mode", () => {
  const typeIn = (call: string, value: string) => fireEvent.change(screen.getByLabelText(`Your prediction for ${call}`), { target: { value } });

  it("grades typed predictions against the model and explains every value", () => {
    render(<ArraySelectExplorer mode="query" />);
    expect(screen.getByRole("region", { name: /array query functions/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check my predictions/ })).toBeDisabled();
    expect(screen.queryByTestId("query-answer-$left")).not.toBeInTheDocument();
    typeIn("$left(f, 1)", "7");
    typeIn("$increment(f, 1)", "-1");
    typeIn("$dimensions(f)", "1");
    fireEvent.click(screen.getByRole("button", { name: /Check my predictions/ }));
    expect(screen.getByTestId("query-answer-$left")).toHaveTextContent("✓ right");
    expect(screen.getByTestId("query-answer-$increment")).toHaveTextContent(/✕ not this = 1/);
    expect(screen.getByTestId("query-answer-$dimensions")).toHaveTextContent(/= 2.*int counts as one packed \[31:0\] dimension/);
    expect(screen.getByText("1 of 3 predictions right.")).toBeInTheDocument();
  });

  it("an int-keyed associative array: $right is 2147483647, and the reveal says it is not the largest key", () => {
    render(<ArraySelectExplorer mode="query" />);
    fireEvent.click(radio("Array", "int aa[int] (keys 5 and 9)"));
    typeIn("$right(aa, 1)", "9");
    fireEvent.click(screen.getByRole("button", { name: /Check my predictions/ }));
    expect(screen.getByTestId("query-answer-$right")).toHaveTextContent(/✕ not this = 2147483647.*not the largest key/);
  });

  it("$size(exp_by_id, 2) is an error (§20.7.1) and the reveal offers $size(exp_by_id[5], 1)", () => {
    render(<ArraySelectExplorer mode="query" />);
    fireEvent.click(radio("Array", "bit [31:0] exp_by_id [int][$]"));
    fireEvent.click(radio("Dimension number", "dimension 2"));
    typeIn("$size(exp_by_id, 2)", "error");
    fireEvent.click(screen.getByRole("button", { name: /Check my predictions/ }));
    expect(screen.getByTestId("query-answer-$size")).toHaveTextContent("✓ right");
    const summary = queryArray(findQueryTarget("exp")!, 2).summary;
    expect(screen.getByTestId("query-summary")).toHaveTextContent(summary);
    expect(summary).toMatch(/\$size\(exp_by_id\[5\], 1\) = 2/);
  });

  it("a dimension beyond the last returns 'x; changing the dimension hides the answers again", () => {
    render(<ArraySelectExplorer mode="query" />);
    fireEvent.click(radio("Dimension number", "3 (beyond the last)"));
    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(screen.getByTestId("query-answer-$size")).toHaveTextContent("= 'x");
    fireEvent.click(radio("Dimension number", "dimension 1"));
    expect(screen.queryByTestId("query-answer-$size")).not.toBeInTheDocument();
  });

  it("keeps keyboard focus: the reveal moves it to the results, and Predict again moves it to the first input", () => {
    render(<ArraySelectExplorer mode="query" />);
    typeIn("$left(f, 1)", "7");
    const check = screen.getByRole("button", { name: /Check my predictions/ });
    check.focus();
    fireEvent.click(check);
    expect(document.activeElement).toBe(screen.getByTestId("query-results"));
    fireEvent.click(screen.getByRole("button", { name: /Predict again/ }));
    expect(document.activeElement).toBe(screen.getByLabelText("Your prediction for $left(f, 1)"));

    fireEvent.click(screen.getByRole("button", { name: /Reveal without predicting/ }));
    expect(document.activeElement).toBe(screen.getByTestId("query-results"));
    // Changing the dimension also hides the answers but leaves focus on the control the learner used.
    const dim2 = radio("Dimension number", "dimension 2");
    dim2.focus();
    fireEvent.click(dim2);
    expect(document.activeElement).not.toBe(screen.getByLabelText("Your prediction for $left(f, 2)"));
  });

  it("accepts an en dash and 2**31-1 as typed predictions", () => {
    render(<ArraySelectExplorer mode="query" />);
    fireEvent.click(radio("Array", "int aa[int] (keys 5 and 9)"));
    typeIn("$right(aa, 1)", "2**31-1");
    typeIn("$increment(aa, 1)", "\u20131");
    fireEvent.click(screen.getByRole("button", { name: /Check my predictions/ }));
    expect(screen.getByTestId("query-answer-$right")).toHaveTextContent("✓ right");
    expect(screen.getByTestId("query-answer-$increment")).toHaveTextContent("✓ right");
  });

  it("an unreadable prediction is marked, not silently graded", () => {
    render(<ArraySelectExplorer mode="query" />);
    typeIn("$size(f, 1)", "eight");
    fireEvent.click(screen.getByRole("button", { name: /Check my predictions/ }));
    expect(screen.getByTestId("query-answer-$size")).toHaveTextContent("not a number, 'x or error");
  });
});
