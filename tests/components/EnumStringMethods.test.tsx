import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EnumMethodVisualizer from "@/components/visuals/EnumMethodVisualizer";
import StringMethodExplorer from "@/components/visuals/StringMethodExplorer";
import { OPCODE_DECL, assignIntToEnum, enumAssignResultText, enumTypeFromDeclaration, resolveEnumDeclaration, type EnumTypeModel } from "@/lib/sv-enum-string-model";

describe("EnumMethodVisualizer", () => {
  it("gates the default-value trap behind a prediction: an int-based enum starts at IDLE", () => {
    render(<EnumMethodVisualizer />);
    expect(screen.queryByText(/an unassigned/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('"" (empty string)'));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/starts at 0/).length).toBeGreaterThan(0);
  });

  it("with a logic [1:0] base, the unassigned value is 'x and name() is empty", () => {
    render(<EnumMethodVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "logic [1:0]" }));
    fireEvent.click(screen.getByLabelText('"" (empty string)'));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("next() on an invalid value returns the default value, and name() returns \"\"", () => {
    render(<EnumMethodVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "state_e'(7)" }));
    fireEvent.click(screen.getByRole("button", { name: "s.next()" }));
    expect(screen.getByText(/s is not a member, so next\(\) returns the enum's default initial value/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "s.name()" }));
    expect(screen.getByText(/name\(\) returns the empty string/)).toBeInTheDocument();
  });

  it("supports next(N), num() and assigning the result back to s", () => {
    render(<EnumMethodVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "s.next(3)" }));
    expect(screen.getByText(/moves 3 members forward/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "s = s.next(3);" }));
    expect(screen.getByRole("radio", { name: "ERROR" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "s.num()" }));
    expect(screen.getByText(/returns how many members the enum has: 4/)).toBeInTheDocument();
  });

  it("shows the cast drill: plain assignment does not compile, $cast returns 0", () => {
    render(<EnumMethodVisualizer />);
    expect(screen.getByText("s = 7;")).toBeInTheDocument();
    expect(screen.getByText(/Compile error: an int is not an enum/)).toBeInTheDocument();
    expect(screen.getByText(/\$cast returns 0/)).toBeInTheDocument();
  });
});

describe("EnumMethodVisualizer: how values are assigned", () => {
  const pick = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

  it("hides the values until the learner commits, then explains the wrong one and draws the gaps", () => {
    render(<EnumMethodVisualizer initialTab="declaration" />);
    expect(screen.getByText("typedef enum {A = 3, B, C = 7, D} demo_e;")).toBeInTheDocument();
    expect(screen.queryByLabelText("Number line of the enum values")).not.toBeInTheDocument();
    const lock = screen.getByRole("button", { name: "Lock in prediction" });
    expect(lock).toBeDisabled();
    fireEvent.click(screen.getByLabelText("It compiles"));
    pick("A", "3");
    pick("B", "4");
    pick("C", "7");
    expect(lock).toBeDisabled();
    pick("D", "5");
    fireEvent.click(lock);
    expect(screen.getAllByText(/D is 8, not 5/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/C \+ 1 = 8/).length).toBeGreaterThan(0);
    // The reveal buttons unmount, so focus moves to the verdict.
    expect(document.activeElement).toHaveTextContent(/Not quite: D is 8, not 5/);
    const line = screen.getByLabelText("Number line of the enum values");
    expect(within(line).getByLabelText("value 5: no member")).toBeInTheDocument();
    expect(within(line).getByLabelText("value 6: no member")).toBeInTheDocument();
    expect(within(line).getByLabelText("value 7: C")).toBeInTheDocument();
  });

  it("next() from B is a prediction too: C (7), not the value plus one; then s steps along the declaration order", () => {
    render(<EnumMethodVisualizer initialTab="declaration" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByText("s holds B (4). What does s.next() return?")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("5, the value plus one"));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/next\(\) follows declaration order, not the value plus one/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "s = s.next();" }));
    expect(screen.getByText("s = C (7)")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/value 7: C, s is here/).length).toBe(1);
    // The stepping line has its own name, so the two figures are told apart.
    expect(screen.getAllByLabelText("Number line of the enum values")).toHaveLength(1);
    expect(screen.getByLabelText("Number line of the enum values, with s")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "s = s.next();" }));
    fireEvent.click(screen.getByRole("button", { name: "s = s.next();" }));
    expect(screen.getByText("s = A (3)")).toBeInTheDocument();
    expect(screen.getByTestId("enum-live")).toHaveTextContent(/wrapping around the end of the list/);
  });

  it("a duplicate value is a compile error, and the error rule names both members", () => {
    render(<EnumMethodVisualizer initialTab="declaration" declarationPreset="duplicate" />);
    fireEvent.click(screen.getByLabelText("Compile error"));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getAllByText(/Correct: it does not compile/).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("list", { name: "Declaration errors" })).getByText(/C and D are both 8/)).toBeInTheDocument();
    // The verdict stays short; on screen the error list is the only place the message appears (the live region still announces it).
    expect(screen.getAllByText(/C and D are both 8/).filter((el) => el.getAttribute("data-testid") !== "enum-live")).toHaveLength(1);
    expect(screen.getByText(/Correct: it does not compile\. The errors are listed below\./)).toBeInTheDocument();
    expect(screen.getByLabelText("value 8: C and D, the same value twice, an error")).toBeInTheDocument();
    expect(screen.queryByText(/What does s.next\(\) return/)).not.toBeInTheDocument();
  });

  it("switching the declaration starts a fresh prediction; the presets cover the lesson's table", () => {
    render(<EnumMethodVisualizer initialTab="declaration" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    fireEvent.click(screen.getByRole("radio", { name: "bit [1:0], five names" }));
    expect(screen.queryByLabelText("Number line of the enum values")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("It compiles"));
    ["S0", "S1", "S2", "S3", "S4"].forEach((n, i) => pick(n, String(i)));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getAllByText(/S4 is an error: it would be S3 \+ 1 = 4/).length).toBeGreaterThan(0);
    expect(screen.getByText(/holds 0 to 3/)).toBeInTheDocument();
    // The error is on S4 only: S3 = 3 is legal and carries no error cross (§6.19).
    expect(screen.getByLabelText("value 3: S3")).not.toHaveTextContent("✕");
    for (const label of ["{IDLE, RUN, DONE}", "{add = 10, sub[3], jmp[6:8]}", "bit [3:0] {LOW = 3'h1}"]) expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
  });

  it("a long number line stays one row and says it scrolls sideways on a small screen", () => {
    render(<EnumMethodVisualizer initialTab="declaration" declarationPreset="ranges" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const line = screen.getAllByLabelText("Number line of the enum values")[0];
    expect(line).toHaveClass("grid-flow-col", "overflow-x-auto");
    expect(line).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Scroll the line sideways to see every value.")).toBeInTheDocument();
  });

  it("an x value sits off the number line with the X cue, and the next() demo says it is off", () => {
    render(<EnumMethodVisualizer initialTab="declaration" declarationPreset="xz" />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getAllByText(/It compiles: OK = 0, BAD = 'x/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("BAD = 'x, unknown (X)")).toBeInTheDocument();
    expect(screen.getByText(/does not step next\(\) through an x or z value/)).toBeInTheDocument();
  });
});

describe("EnumMethodVisualizer: casts", () => {
  const op = enumTypeFromDeclaration(resolveEnumDeclaration(OPCODE_DECL), "opcode_e") as EnumTypeModel;
  const resultFor = (raw: number, form: "plain" | "static-cast" | "dynamic-cast" | "dynamic-cast-task") =>
    enumAssignResultText(op, assignIntToEnum(op, 0, raw, form, { varName: "op" }), 0, "op");
  const row = (code: string) => screen.getByText(code).closest("li") as HTMLElement;

  it("keeps every outcome hidden until its row is checked, then explains it", () => {
    render(<EnumMethodVisualizer initialTab="casts" />);
    expect(screen.getByText("op = raw;")).toBeInTheDocument();
    expect(screen.queryByText(/Compile error: an int is not an enum/)).not.toBeInTheDocument();
    const plain = row("op = raw;");
    const check = within(plain).getByRole("button", { name: "Check this row" });
    expect(check).toBeDisabled();
    fireEvent.change(within(plain).getByLabelText("Your prediction"), { target: { value: "compile-error" } });
    fireEvent.click(check);
    expect(within(plain).getByText(/✓ Correct/)).toBeInTheDocument();
    expect(within(plain).getByText(/Compile error: an int is not an enum/)).toBeInTheDocument();
    expect(within(plain).getByText(resultFor(7, "plain"), { exact: false })).toBeInTheDocument();
    expect(resultFor(7, "plain")).toBe("Does not compile, so nothing runs.");
    // The check button unmounts, so focus moves to the row's result.
    expect(document.activeElement).toBe(screen.getByTestId("cast-result-plain"));
    // The other rows are still unanswered.
    expect(screen.queryByTestId("cast-result-static-cast")).not.toBeInTheDocument();
  });

  it("raw = 7: the static cast stores 7 unchecked, $cast returns 0, the task form is a run-time error", () => {
    render(<EnumMethodVisualizer initialTab="casts" />);
    const stat = row("op = opcode_e'(raw);");
    fireEvent.change(within(stat).getByLabelText("Your prediction"), { target: { value: "runtime-error" } });
    fireEvent.click(within(stat).getByRole("button", { name: "Check this row" }));
    expect(within(stat).getByText(/Not quite: the outcome is "op takes the value of raw"/)).toBeInTheDocument();
    expect(within(stat).getByText(resultFor(7, "static-cast"), { exact: false })).toBeInTheDocument();
    expect(resultFor(7, "static-cast")).toBe('op = 7 (not a member); op.name() is "".');
    const fn = row("ok = $cast(op, raw);");
    fireEvent.click(within(fn).getByRole("button", { name: "Reveal" }));
    expect(within(fn).getByText(resultFor(7, "dynamic-cast"), { exact: false })).toBeInTheDocument();
    expect(resultFor(7, "dynamic-cast")).toBe("ok = 0 and op stays OP_NOP (0).");
    const task = row("$cast(op, raw);");
    fireEvent.click(within(task).getByRole("button", { name: "Reveal" }));
    expect(within(task).getByText(/a run-time error occurs and op is left unchanged/)).toBeInTheDocument();
    expect(within(task).getByText("Run-time error; op stays OP_NOP (0).", { exact: false })).toBeInTheDocument();
  });

  it("raw = 2 resets the rows; then all three casts give OP_WRITE and the function returns 1", () => {
    render(<EnumMethodVisualizer initialTab="casts" />);
    fireEvent.click(within(row("op = raw;")).getByRole("button", { name: "Reveal" }));
    fireEvent.click(screen.getByRole("radio", { name: "raw = 2 (a member)" }));
    expect(screen.queryByTestId("cast-result-plain")).not.toBeInTheDocument();
    const fn = row("ok = $cast(op, raw);");
    fireEvent.change(within(fn).getByLabelText("Your prediction"), { target: { value: "assigned-ok-1" } });
    fireEvent.click(within(fn).getByRole("button", { name: "Check this row" }));
    expect(within(fn).getByText(/✓ Correct/)).toBeInTheDocument();
    expect(resultFor(2, "dynamic-cast")).toBe("ok = 1 and op = OP_WRITE (2).");
    expect(within(fn).getByText(resultFor(2, "dynamic-cast"), { exact: false })).toBeInTheDocument();
    const task = row("$cast(op, raw);");
    fireEvent.click(within(task).getByRole("button", { name: "Reveal" }));
    expect(resultFor(2, "dynamic-cast-task")).toBe("op = OP_WRITE (2).");
    expect(within(task).getByText(resultFor(2, "dynamic-cast-task"), { exact: false })).toBeInTheDocument();
  });

  it("the packed-struct row is labelled derived and points to the packed layout explorer's enum field preset", () => {
    const { unmount } = render(<EnumMethodVisualizer initialTab="casts" />);
    const packed = row("c = vif.bus;");
    expect(within(packed).getByText("Derived")).toBeInTheDocument();
    fireEvent.click(within(packed).getByRole("button", { name: "Reveal" }));
    expect(within(packed).getByText(/derived from §7.2.1 and §6.19.3/)).toBeInTheDocument();
    expect(within(packed).getByText(/the "enum field" preset/)).toBeInTheDocument();
    expect(within(packed).getByText(/the explorer's preset writes 7 there/)).toBeInTheDocument();
    unmount();
    render(<EnumMethodVisualizer initialTab="casts" packedExplorerHref="#packed" />);
    fireEvent.click(within(row("c = vif.bus;")).getByRole("button", { name: "Reveal" }));
    expect(screen.getByRole("link", { name: /packed layout explorer on its enum field preset/ })).toHaveAttribute("href", "#packed");
  });

  it("the packed-struct row grades 'c.op takes the value of raw' as correct and states the result", () => {
    render(<EnumMethodVisualizer initialTab="casts" />);
    const packed = row("c = vif.bus;");
    fireEvent.change(within(packed).getByLabelText("Your prediction"), { target: { value: "assigned" } });
    expect(within(packed).getByRole("option", { name: "c.op takes the value of raw" })).toBeInTheDocument();
    fireEvent.click(within(packed).getByRole("button", { name: "Check this row" }));
    expect(within(packed).getByText(/✓ Correct/)).toBeInTheDocument();
    expect(within(packed).getByText('c.op = 7 (not a member); c.op.name() is "".', { exact: false })).toBeInTheDocument();
  });

  it("the code names the packed struct's layout and the 32-bit bus", () => {
    render(<EnumMethodVisualizer initialTab="casts" />);
    expect(screen.getByText(/cmd_t c;\s+\/\/ packed, 32 bits: op \[31:28\], addr \[27:16\], data \[15:0\]; vif.bus is 32 bits/)).toBeInTheDocument();
  });

  it("the view switcher is keyboard operable and announces the view", () => {
    render(<EnumMethodVisualizer />);
    const methods = screen.getByRole("radio", { name: "Methods" });
    expect(methods).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(methods, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "How values are assigned" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("enum-live")).toHaveTextContent("Showing how values are assigned.");
    expect(screen.getByRole("region", { name: "Enum method explorer" })).toBeInTheDocument();
  });
});

describe("StringMethodExplorer", () => {
  it("getc past the end returns 0 instead of an error", () => {
    render(<StringMethodExplorer />);
    fireEvent.change(screen.getByLabelText("i (index)"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "s.getc(20)" }));
    expect(screen.getByText(/getc returns 0\. No error is raised/)).toBeInTheDocument();
    expect(screen.queryByText(/Error: String is empty/)).not.toBeInTheDocument();
  });

  it("putc on an empty string leaves it unchanged; in range it replaces one character", () => {
    render(<StringMethodExplorer />);
    const s = screen.getByLabelText("s (string)");
    fireEvent.change(s, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: 's.putc(0, "s")' }));
    expect(screen.getByText(/putc leaves s unchanged/)).toBeInTheDocument();
    fireEvent.change(s, { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("i (index)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("c (putc character)"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: 's.putc(1, "X")' }));
    expect(screen.getByLabelText("s (string)")).toHaveValue("aXc");
  });

  it("substr is inclusive of both indices", () => {
    render(<StringMethodExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "s.substr(0, 5)" }));
    expect(screen.getAllByText('"System"').length).toBeGreaterThan(0);
  });
});
