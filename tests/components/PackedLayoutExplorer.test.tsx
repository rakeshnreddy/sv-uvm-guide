import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PackedLayoutExplorer from "@/components/visuals/PackedLayoutExplorer";

const lockIn = (label: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

const radio = (group: string, name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }));
/** The clinic's fix picker is a plain button group so every option is tabbable before one is chosen. */
const pickFix = (name: string) => {
  const button = within(screen.getByRole("group", { name: "Fix" })).getByRole("button", { name });
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-pressed", "true");
};

const lockInButtons = () => screen.queryAllByRole("button", { name: /lock in prediction/i });

/** Width fields commit on blur or Enter, not on every keystroke. */
const setWidth = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

const stripLabel = (prefix: string) => screen.getAllByRole("img").map((el) => el.getAttribute("aria-label") ?? "").find((l) => l.startsWith(prefix)) ?? "";

describe("PackedLayoutExplorer: struct mode (default, cmd_t)", () => {
  it("gates the first write behind a prediction, diagnoses the C bit-field answer, then fills the strip and the hex overlay", () => {
    render(<PackedLayoutExplorer />);
    expect(screen.getByRole("region", { name: "Packed struct layout explorer" })).toBeInTheDocument();
    expect(screen.getByTestId("packed-layout-explorer")).toHaveAttribute("data-mode", "struct");
    // Never assigned and 4-state: all x (Table 6-7), not a run of known zeros.
    expect(stripLabel("c, cmd_t")).toMatch(/32-bit value 32'bxxxx_xxxx/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'hxxxx_xxxx; \$bits\(cmd_t\) = 32; 4-state, unsigned\. op = 4'hx, addr = 12'hxxx, data = 16'hxxxx\.$/);
    expect(screen.queryByTestId("hex-overlay")).not.toBeInTheDocument();
    expect(screen.getByText("After c = 32'h5ABC_0042, what is c.op?")).toBeInTheDocument();

    lockIn("4'h2");
    expect(stripLabel("c, cmd_t")).toMatch(/op is bits 31 to 28; addr is bits 27 to 16; data is bits 15 to 0/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/how C bit-fields often behave/)).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/c = 32'h5ABC_0042; \$bits\(cmd_t\) = 32; 4-state, unsigned\. op \[31:28\] = 4'h5, addr \[27:16\] = 12'hABC, data \[15:0\] = 16'h0042/);
    const overlay = screen.getByTestId("hex-overlay");
    expect(within(overlay).getAllByRole("listitem").filter((li) => /reads straight off the hex/.test(li.textContent ?? ""))).toHaveLength(3);
    expect(within(overlay).getByRole("list", { name: "Hex digits, most significant first" }).textContent).toMatch(/5\[31:28\]op/);
  });

  it("while the first gated statement is pending the bit ranges stay hidden, so the question is not answered above it", () => {
    render(<PackedLayoutExplorer />);
    expect(stripLabel("c, cmd_t")).not.toMatch(/op is bits/);
    expect(screen.queryByText(/\/\/ \[31:28\]/)).not.toBeInTheDocument();
    expect(screen.queryByText("c[31:28]")).not.toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).not.toMatch(/\[31:28\]/);
    expect(screen.getByTestId("ranges-hidden")).toBeInTheDocument();

    lockIn("4'h5");
    expect(screen.queryByTestId("ranges-hidden")).not.toBeInTheDocument();
    expect(screen.getByText(/\/\/ \[31:28\]/)).toBeInTheDocument();
    expect(screen.getByText("c[31:28]")).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/op \[31:28\] = 4'h5/);
  });

  it("ctrl_reg_t: the ranges and the hex digits stay hidden until the thresh question is answered, and it runs to the lesson's value", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^ctrl = 32'h0000_0000;/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/thresh = 8'h00/);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByText("After ctrl.thresh = 8'd100, what is the whole register?")).toBeInTheDocument();
    expect(screen.queryByTestId("hex-overlay")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/\/ \[11:4\]/)).not.toBeInTheDocument();
    lockIn("32'h0000_6401");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^ctrl = 32'h0000_0641;/);
    expect(screen.getByTestId("hex-overlay")).toBeInTheDocument();
  });

  it("ctrl = '0 before any write replaces the x default, and after a width edit it is a fill literal, never truncated or extended (§5.7.1)", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^ctrl = 32'hxxxx_xxxx;/);
    setWidth("Width of rsvd in bits", "4");
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/^ctrl = 20'h0_0000;/);
    expect(status).toMatch(/all 20 bits become 0 and nothing is extended or truncated \(§5\.7\.1\)/);
    expect(status).not.toMatch(/truncated to|zero-extended/);
    expect(stripLabel("ctrl, ctrl_reg_t")).not.toMatch(/added by extension/);
  });

  it("the changed ring marks the bits whose value changed, not every written bit, and stays within [27:16]", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    lockIn("32'h50FF_0042");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/c = 32'h50FF_0042/);
    // ABC ^ 0FF = A43, so bit 26 is written but keeps its 0: it gets no ring.
    expect(stripLabel("c, cmd_t")).toMatch(/bits 27, 25, 22 and 17 to 16 just changed/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/addr is bits \[27:16\], so only those bits can change/);
  });

  it("the third write zero-fills the upper half with no warning", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    lockIn("32'h50FF_0042");

    lockIn("op = 4'h0, addr = 12'h000");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/c = 32'h0000_BEEF/);
    expect(stripLabel("c, cmd_t")).toMatch(/bits 31 to 16 added by extension/);
    // Under the statement and in the live status.
    expect(screen.getAllByText(/No warning required \(§10\.7\)/).length).toBeGreaterThanOrEqual(1);
  });

  it("the packed/unpacked toggle turns the part-select and the comparison into compile-error cards with their clause", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    expect(screen.getAllByText("Legal")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    expect(screen.getByTestId("struct-unpacked-view")).toBeInTheDocument();
    expect(screen.getByText("c[31:28]")).toBeInTheDocument();
    expect(screen.getByText("c == 32'h5ABC_0042")).toBeInTheDocument();
    // Comparison is not assignment: the card cites §6.11.1 and §11.2.2, not §6.22.3, and labels the error derived.
    expect(screen.getByText("(§7.2.1, §6.11.1, §11.2.2)")).toBeInTheDocument();
    expect(screen.queryByText("(§7.2.1, §6.22.3)")).not.toBeInTheDocument();
    expect(screen.getByText(/^Derived: no clause states this error outright\..*c == another variable of the same type is legal/)).toBeInTheDocument();
    // Both the unpacked view and the part-select card say it.
    expect(screen.getAllByText(/no bit numbering/).length).toBeGreaterThanOrEqual(2);
    // The implementation-dependent-packing sentence is cited to §7.2.1, where it is.
    expect(screen.getByText(/normally matching the C compiler \(§7\.2\.1\), so it has no bit numbering/)).toBeInTheDocument();
  });

  it("unpacked view: whole-vector statements are compile-error cards, member writes stay runnable, and the status drops every vector claim (§6.22.3, §7.2.1)", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));

    const statements = within(screen.getByTestId("unpacked-statements"));
    expect(statements.getAllByText("Compile error")).toHaveLength(2);
    expect(statements.getByText("c = 32'h5ABC_0042;")).toBeInTheDocument();
    expect(statements.getByText("c = 16'hBEEF;")).toBeInTheDocument();
    expect(statements.getAllByText("(§6.22.3)")).toHaveLength(2);
    expect(statements.getAllByText(/no implicit cast from an integral value/)).toHaveLength(2);
    // Predictions and sequence runs are the packed layout's; only the member write can run.
    expect(lockInButtons()).toHaveLength(0);
    expect(statements.getAllByRole("button", { name: "Run it" })).toHaveLength(1);

    const status = () => screen.getByTestId("struct-status").textContent ?? "";
    expect(status()).toMatch(/^c is an unpacked struct: members are referenced by name and there is no bit numbering \(§7\.2\.1\); \$bits\(cmd_t\) = 32 \(§20\.6\.2\)\. op = 4'h5, addr = 12'hABC, data = 16'h0042\.$/);
    expect(status()).not.toMatch(/\[\d+:\d+\]|unsigned|4-state|32'h/);
    expect(screen.queryByText("unsigned")).not.toBeInTheDocument();
    expect(screen.queryByText("4-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("write-x-op")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("run-unpacked-1"));
    expect(status()).toMatch(/addr = 12'h0FF/);
    expect(status()).toMatch(/addr is written by name; the other members keep their values \(§7\.2\)/);
    expect(status()).toMatch(/op = 4'h5/);
  });

  it("switching to the unpacked view and back keeps an answered prediction and the sequence, so no statement is skipped", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    // Statement 1's prompt is still answered; only statement 2 asks, and answering it runs statement 2.
    expect(screen.getByText(/Correct\./)).toBeVisible();
    expect(lockInButtons()).toHaveLength(1);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h5ABC_0042;/);
    lockIn("32'h50FF_0042");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h50FF_0042;/);
  });

  it("Reset preset re-arms the first prediction", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByRole("button", { name: "Reset preset" }));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'hxxxx_xxxx;/);
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(lockInButtons()).toHaveLength(1);
    lockIn("4'h2");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h5ABC_0042;/);
  });

  it("re-selecting the current preset re-arms the first prediction too", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    lockIn("32'h50FF_0042");
    radio("Struct preset", "cmd_t");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'hxxxx_xxxx;/);
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(lockInButtons()).toHaveLength(1);
    expect(screen.getByText("After c = 32'h5ABC_0042, what is c.op?")).toBeInTheDocument();
    lockIn("4'h5");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h5ABC_0042;/);
  });

  it("'Reveal without predicting' still runs the statement and explains the answer", () => {
    render(<PackedLayoutExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h5ABC_0042;/);
    expect(screen.getByText(/Why the answer holds:/)).toBeInTheDocument();
    expect(screen.getByText("After c.addr = 12'h0FF, what is c?")).toBeInTheDocument();
  });

  it("after a width edit shrinks the struct, a wider assignment reports the truncation and lists no 'dropped' legend, because no cell is struck through (§10.7)", () => {
    render(<PackedLayoutExplorer />);
    setWidth("Width of data in bits", "8");
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/\$bits\(cmd_t\) = 24/);
    expect(status).toMatch(/The 32-bit value is truncated to 24 bits: bits \[31:24\] of the source are discarded\. No warning is required \(§10\.7\)/);
    expect(screen.queryByText(/struck through/)).not.toBeInTheDocument();
  });

  it("after a layout edit the preset's own notes are dropped and only the model's true note shows", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByRole("button", { name: "Move up: data" }));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/Layout edited/);

    // data now sits above addr: the note names the bits addr really has, and no preset text survives.
    fireEvent.click(screen.getByTestId("run-statement"));
    const member = screen.getByTestId("struct-status").textContent ?? "";
    expect(member).toMatch(/addr is bits \[11:0\], so only those bits can change \(§7\.2\.1\)\.$/);
    expect(member).not.toMatch(/▲|\[27:16\]/);

    // A whole write now reports through the model too, extension included.
    fireEvent.click(screen.getByTestId("run-statement"));
    const whole = screen.getByTestId("struct-status").textContent ?? "";
    expect(whole).toMatch(/The 16-bit value is zero-extended to 32 bits: bits \[31:16\] are filled with 0\. No warning is required \(§10\.7\)\.$/);
    expect(whole).not.toMatch(/§6\.22\.3/);
    expect(whole).not.toMatch(/zero-filled \(\+\)/);
  });

  it("with op widened the first statement's note is the model's, not the 5 | ABC | 0042 text", () => {
    render(<PackedLayoutExplorer />);
    setWidth("Width of op in bits", "8");
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/^c = 36'h0_5ABC_0042/);
    expect(status).toMatch(/The 32-bit value is zero-extended to 36 bits/);
    expect(status).not.toMatch(/5 \| ABC \| 0042/);
  });

  it("with thresh narrowed, ctrl's statement note is the model's, not the 32'h0000_0641 text", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    setWidth("Width of thresh in bits", "4");
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/^ctrl = 28'h000_0041;/);
    expect(status).toMatch(/thresh is bits \[7:4\], so only those bits can change \(§7\.2\.1\)\. The 8-bit source is truncated to 4 bits/);
    expect(status).not.toMatch(/0641/);
  });

  it("writing x into a 4-state member: the struct was 4-state already, and the vector now shows the x", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(stripLabel("c, cmd_t")).toMatch(/bits 31 to 28 unknown \(X\)/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/op is a 4-state member, so the struct is a 4-state vector whether or not any bit is x \(§7\.2\.1\); read as one vector it now shows x in bits \[31:28\]/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'hxABC_0042;/);
    fireEvent.click(screen.getByTestId("write-x-data"));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'hxABC_xxxx;/);
  });

  it("pkt_hdr_t: the x in kind is a part-select, the literal is binary, and the digit keeps its %h case (§21.2.1.3)", () => {
    render(<PackedLayoutExplorer preset="pkt_hdr_t" />);
    lockIn("4540cafe");
    const button = screen.getByTestId("write-x-kind");
    expect(button.textContent).toBe("hdr[31:30] = 2'bx;");
    fireEvent.click(button);
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/^hdr = 32'bxx00_0101_0100_0000_1100_1010_1111_1110;/);
    expect(status).not.toMatch(/32'hX/);
    expect(within(screen.getByTestId("hex-overlay")).getByRole("list", { name: "Hex digits, most significant first" }).textContent).toMatch(/^X\[31:28\]/);
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/part-select wrote these bits as a plain vector/);
    expect(screen.getByTestId("enum-readout").textContent).not.toMatch(/whole-vector/);
  });

  it("enum-field preset: a whole-vector write stores a non-member, so op.name() returns \"\" (derived from §7.2.1)", () => {
    render(<PackedLayoutExplorer mode="struct" preset="enum-field" />);
    expect(screen.queryByTestId("hex-overlay")).not.toBeInTheDocument();
    // Nothing has run: the readout would show "" and give the prediction away. The members the learner needs are in the typedef panel.
    expect(screen.queryByTestId("enum-readout")).not.toBeInTheDocument();
    expect(screen.getByText(/typedef enum logic \[3:0\] \{ OP_NOP = 4'h0, OP_READ = 4'h1, OP_WRITE = 4'h2, OP_IRQ = 4'hF \} opcode_e;/)).toBeInTheDocument();
    expect(screen.queryByTestId("write-x-op")).not.toBeInTheDocument();
    lockIn('"OP_IRQ"');
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    const readout = screen.getByTestId("enum-readout");
    expect(readout.textContent).toMatch(/c\.op\.name\(\) returns ""/);
    expect(readout.textContent).toMatch(/derived from §7\.2\.1/);
    expect(readout.textContent).toMatch(/not a member of opcode_e/);
    expect(readout.textContent).toMatch(/whole-vector write was not type-checked/);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/returns "OP_WRITE"/);
  });

  it("pkt_hdr_t preset: kind and seq share hex digit 7, so neither reads straight off the hex", () => {
    render(<PackedLayoutExplorer preset="pkt_hdr_t" />);
    lockIn("4540cafe");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const overlay = screen.getByTestId("hex-overlay");
    expect(within(overlay).getByRole("list", { name: "Hex digits, most significant first" }).textContent).toMatch(/4\[31:28\]kind \+ seq/);
    const verdicts = within(overlay).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(verdicts.some((t) => /✕ kind \[31:30\]: shares a hex digit/.test(t))).toBe(true);
    expect(verdicts.some((t) => /✓ crc \[15:0\]: reads straight off the hex/.test(t))).toBe(true);
  });

  it("pkt_hdr_t preset: the strip and status name the variable each statement writes, hdr and then the kata's rx", () => {
    render(<PackedLayoutExplorer preset="pkt_hdr_t" />);
    expect(stripLabel("hdr, pkt_hdr_t")).not.toBe("");
    lockIn("4540cafe");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^hdr = 32'h4540_CAFE;/);
    expect(stripLabel("hdr, pkt_hdr_t")).not.toBe("");
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^rx = 32'hC1FF_0000;/);
    expect(stripLabel("rx, pkt_hdr_t")).not.toBe("");
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/rx\.kind\.name\(\) returns "PKT_PING"/);

    // Run out of sequence in the unpacked view, the pattern writes hdr, and the label follows it.
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    fireEvent.click(screen.getByTestId("run-unpacked-0"));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^hdr is an unpacked struct:.*len = 8'h40/);
  });

  it("reordering members with the keyboard-operable list re-slices the same vector; widths change $bits", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByRole("button", { name: "Move down: op" }));
    expect(screen.getByTestId("struct-status").textContent).toMatch(/c = 32'h5ABC_0042/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/addr \[31:20\] = 12'h5AB, op \[19:16\] = 4'hC/);
    expect(screen.getByText(/Layout edited: the predictions were written for the preset layout/)).toBeInTheDocument();
    setWidth("Width of data in bits", "8");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 24/);
    setWidth("Width of data in bits", "99");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 32/);
  });

  it("a width field commits on blur or Enter, so typing through a shorter number cuts nothing and an empty field reverts", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    const input = screen.getByLabelText("Width of data in bits");
    fireEvent.change(input, { target: { value: "1" } });
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 32/);
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 28/);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(12);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 28/);
  });

  it("new bits from a width edit hold the 4-state default, not zeros (Table 6-7)", () => {
    render(<PackedLayoutExplorer />);
    setWidth("Width of op in bits", "8");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 36'hx_xxxx_xxxx;/);
  });

  it.each([
    ["cmd_t", "4'h5"],
    ["frame_t", "8'hAB"],
    ["pkt_hdr_t", "4540cafe"],
    ["reversed", "12'h042"],
    ["narrow-assign", "op = 4'h0, addr = 12'h000"],
  ])("%s: the frame's summary does not contain the answer %s", (preset, answer) => {
    render(<PackedLayoutExplorer preset={preset} />);
    const header = screen.getByRole("region", { name: "Packed struct layout explorer" }).querySelector("header");
    expect(header?.textContent).not.toContain(answer);
    expect(header?.textContent).not.toMatch(/most significant|zero-extended|silently/);
  });

  it("the toggle keeps one label and aria-pressed carries the state", () => {
    render(<PackedLayoutExplorer />);
    const toggle = screen.getByRole("button", { name: "Unpacked view" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Unpacked view" })).toHaveAttribute("aria-pressed", "true");
  });

  it("after a prediction focus moves to its feedback, not past it; after a plain run it moves to the next control", () => {
    render(<PackedLayoutExplorer preset="pkt_hdr_t" />);
    lockIn("1540cafe");
    expect(document.activeElement?.getAttribute("aria-live")).toBe("polite");
    expect(document.activeElement?.textContent).toMatch(/^Not quite\. That gives kind a whole hex digit/);
    fireEvent.click(screen.getByTestId("run-statement"));
    // The sequence is over, so focus lands on the statement that just ran.
    expect(document.activeElement?.getAttribute("data-statement")).toBe("1");
    expect(document.activeElement).not.toBe(document.body);
  });

  it("a plain run moves focus to the next Run button, then to the next statement's first radio", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(document.activeElement).toBe(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(document.activeElement).toBe(screen.getByLabelText("32'h0000_0641"));
  });

  it("'Reveal without predicting' also lands on the explanation", () => {
    render(<PackedLayoutExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(document.activeElement?.textContent).toMatch(/^Why the answer holds:/);
  });

  it("a keyboard runs a prediction end to end: pick, lock in, hear the feedback, Tab to the next question", async () => {
    const user = userEvent.setup();
    render(<PackedLayoutExplorer />);
    screen.getByLabelText("4'h5").focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("4'h2")).toBeChecked();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /lock in prediction/i }));
    await user.keyboard("{Enter}");
    expect(document.activeElement?.textContent).toMatch(/^Not quite\. That reads bits \[3:0\]/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h5ABC_0042;/);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("32'h50FF_0042"));
  });

  it("a reset leaves focus where it is", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    const reset = screen.getByRole("button", { name: "Reset preset" });
    reset.focus();
    fireEvent.click(reset);
    expect(document.activeElement).toBe(reset);
  });

  it("the strip panel is a focusable region when it overflows, and names that it scrolls", () => {
    const widths = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    const clients = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(360);
    try {
      render(<PackedLayoutExplorer />);
      const region = screen.getByRole("region", { name: "Bits of c (scrolls sideways)" });
      expect(region).toHaveAttribute("tabindex", "0");
    } finally {
      widths.mockRestore();
      clients.mockRestore();
    }
  });

  it("a free x write voids the open prediction, whose marked answer would no longer be true", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    expect(lockInButtons()).toHaveLength(1);
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(lockInButtons()).toHaveLength(0);
    // The answered prompt goes too: its "keeps its value" text described the value before the x.
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(screen.getByTestId("predictions-voided").textContent).toMatch(/You wrote outside the sequence.*statements now run directly/);
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("struct-status").textContent ?? "";
    expect(status).toMatch(/^c = 32'hx0FF_0042;/);
    expect(status).toMatch(/addr is bits \[27:16\], so only those bits can change/);
    // The preset's own note describes its own run.
    expect(status).not.toMatch(/▲/);
    // A reset restores the gate.
    fireEvent.click(screen.getByRole("button", { name: "Reset preset" }));
    expect(lockInButtons()).toHaveLength(1);
    expect(screen.queryByTestId("predictions-voided")).not.toBeInTheDocument();
  });

  it("a member write run in the unpacked view voids the gate, since its answer is already on the strip", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    fireEvent.click(screen.getByTestId("run-unpacked-1"));
    expect(screen.getByText(/A write outside the sequence turned the predictions off/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    expect(lockInButtons()).toHaveLength(0);
    expect(screen.getByTestId("predictions-voided")).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^c = 32'h50FF_0042;/);
  });

  it("the reveal happens beside the strip: Statements follow it directly, and the cards, overlay and readout come after", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    lockIn('"" (empty string)');
    const order = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    const strip = screen.getByRole("region", { name: "Bits of c" });
    const statements = screen.getByRole("region", { name: "Statements" });
    // The region is the strip's scroller; the panel around it, with its legend, is what Statements follows.
    expect(strip.parentElement?.nextElementSibling).toBe(statements);
    for (const after of [screen.getByTestId("enum-readout"), screen.getByTestId("hex-overlay"), screen.getByTestId("struct-cards")]) expect(order(statements, after)).toBeTruthy();
    // The revealed area carries the value itself too.
    expect(within(statements).getByText("c = 32'h7ABC_0042")).toBeInTheDocument();
  });

  it("the layout editor shows a live map of the members, so an edit is visible away from the strip", () => {
    render(<PackedLayoutExplorer />);
    // No ranges while the first prediction is open.
    expect(screen.getByTestId("layout-live").textContent).toBe("op (4) | addr (12) | data (16); $bits = 32");
    fireEvent.click(screen.getByRole("button", { name: "Move down: op" }));
    expect(screen.getByTestId("layout-live").textContent).toBe("addr [31:20] | op [19:16] | data [15:0]; $bits = 32");
    setWidth("Width of data in bits", "8");
    expect(screen.getByTestId("layout-live").textContent).toBe("addr [23:12] | op [11:8] | data [7:0]; $bits = 24");
  });

  it("the vector cards wait for the first write in the packed view; the unpacked view shows them with a known literal", () => {
    render(<PackedLayoutExplorer />);
    expect(screen.queryByTestId("struct-cards")).not.toBeInTheDocument();
    expect(screen.queryByText(/xxxx_xxxx$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    expect(screen.getByTestId("struct-cards")).toBeInTheDocument();
    expect(screen.getByText("c == 32'h0000_0000")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    lockIn("4'h5");
    expect(screen.getByTestId("struct-cards")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("write-x-op"));
    const cards = screen.getByTestId("struct-cards");
    expect(within(cards).getByText("c == 32'h0ABC_0042")).toBeInTheDocument();
    expect(cards.textContent).toMatch(/== gives 1'bx/);
  });

  it("after a width edit the unpacked compare card names the live width", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    setWidth("Width of op in bits", "8");
    fireEvent.click(screen.getByTestId("struct-unpacked-toggle"));
    const cards = screen.getByTestId("struct-cards");
    expect(cards.textContent).toMatch(/a 36-bit literal/);
    expect(cards.textContent).not.toMatch(/32-bit/);
  });

  it("an x write's note stands beside its control, never under a statement it does not describe", () => {
    render(<PackedLayoutExplorer />);
    fireEvent.click(screen.getByTestId("write-x-data"));
    expect(screen.getByTestId("experiment-note").textContent).toMatch(/data is a 4-state member/);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.queryByTestId("experiment-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("write-x-data"));
    const note = screen.getByTestId("experiment-note");
    expect(note.textContent).toMatch(/data is a 4-state member/);
    const statements = screen.getByRole("region", { name: "Statements" }).querySelector('[data-statement="0"]');
    expect(statements?.textContent).not.toMatch(/4-state member/);
  });

  it("the enum readout cites the back door only for a non-member; a type-checked write cites name() alone (§6.19.5.6)", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    lockIn('"" (empty string)');
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/\(derived from §7\.2\.1, §6\.19\.5\.6\)/);
    fireEvent.click(screen.getByTestId("run-statement"));
    const readout = screen.getByTestId("enum-readout").textContent ?? "";
    expect(readout).toMatch(/returns "OP_WRITE"/);
    expect(readout).toMatch(/\(§6\.19\.5\.6\)/);
    expect(readout).not.toMatch(/derived/);
  });

  it("the live region says what changed plus the note, while the full map stays visible as plain text", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    const live = () => screen.getByTestId("struct-status-live").textContent ?? "";
    expect(screen.getByTestId("struct-status")).not.toHaveAttribute("aria-live");
    expect(screen.getByTestId("struct-status-live")).toHaveAttribute("aria-live", "polite");
    expect(live()).toBe("");
    // Six members changed from x, so it reports the whole value instead of listing them.
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(live()).toBe("ctrl = 32'h0000_0000.");
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(live()).toBe("en = 1'h1. en is written; the other members keep their bits (§7.2.1).");
    expect(screen.getByTestId("struct-status").textContent).toMatch(/rsvd = 16'h0000, prescale = 4'h0, thresh = 8'h00, mode = 2'h0, irq_en = 1'h0, en = 1'h1/);
    // The bit range of en would help answer the open question about thresh, so no text names it yet.
    expect(screen.getByTestId("struct-status").textContent).not.toMatch(/\[0\]/);
  });

  it("a width field applies arrow keys and the spinner at once, and says typed text needs Enter", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    const input = screen.getByLabelText("Width of data in bits");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 31/);
    expect(input).toHaveValue(15);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 32/);
    // At the limit a step does nothing.
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue(16);
    // A press that changes the text without a key is the spinner.
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: "14" } });
    fireEvent.pointerUp(input);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 30/);
    // A press that changes nothing commits nothing, so a half-typed width stays a draft.
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.pointerDown(input);
    fireEvent.pointerUp(input);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/\$bits\(cmd_t\) = 30/);
    expect(screen.getByText(/Type a width, then press Enter or leave the field/)).toBeInTheDocument();
  });

  it("a write brings the first changed bit into view, sideways only, and with no smooth scroll under reduced motion", () => {
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isPanel = this.getAttribute("role") === "region";
      return { left: isPanel ? 0 : 500, right: isPanel ? 360 : 516, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    const media = window.matchMedia;
    try {
      window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
      const { unmount } = render(<PackedLayoutExplorer />);
      lockIn("4'h5");
      expect(scrollTo).not.toHaveBeenCalled();
      lockIn("32'h50FF_0042");
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 484, behavior: "auto" });
      unmount();

      window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
      render(<PackedLayoutExplorer mode="union" preset="word_u" />);
      fireEvent.click(screen.getByTestId("run-statement"));
      lockIn("32'hAAAA_1234");
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 484, behavior: "smooth" });
    } finally {
      HTMLElement.prototype.scrollTo = original;
      rects.mockRestore();
      window.matchMedia = media;
    }
  });

  it("presets are a keyboard radio group; frame_t asks the interview question", () => {
    render(<PackedLayoutExplorer />);
    radio("Struct preset", "frame_t");
    expect(screen.getByText("A candidate says f.hdr is 8'h01. What is it?")).toBeInTheDocument();
    lockIn("8'h01");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("struct-status").textContent).toMatch(/hdr \[31:24\] = 8'hAB/);
  });
});

describe("PackedLayoutExplorer: union mode", () => {
  it("cmd_u: a write through raw updates every row, after a prediction", () => {
    render(<PackedLayoutExplorer mode="union" />);
    expect(screen.getByRole("region", { name: "Packed union explorer" })).toBeInTheDocument();
    for (const path of ["f", "raw", "bytes"]) expect(screen.getByTestId(`union-row-${path}`)).toBeInTheDocument();
    // Never assigned and 4-state: all x, in the status and in %p (Table 6-7).
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw = 32'hxxxx_xxxx/);
    expect(screen.getByTestId("union-p").textContent).toMatch(/'\{f:'\{op:x, addr:x, data:x\}\}/);
    lockIn("12'h042 and 8'h42");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    const status = screen.getByTestId("union-status").textContent ?? "";
    expect(status).toMatch(/u\.f \[31:0\] = 32'h1ABC_0042/);
    expect(status).toMatch(/u\.raw \[31:0\] = 32'h1ABC_0042/);
    expect(status).toMatch(/u\.bytes \[31:0\] = 32'h1ABC_0042/);
    expect(stripLabel("u.f.addr")).toMatch(/12-bit value 12'b1010_1011_1100/);
    expect(stripLabel("u.bytes[3]")).toMatch(/8-bit value 8'b0001_1010/);
    expect(screen.getByTestId("union-p").textContent).toMatch(/'\{f:'\{op:1, addr:2748, data:66\}\}/);
  });

  it("%p of a packed union is labelled as a reading of §21.2.1.6 that is tool-dependent, with the %h advice", () => {
    render(<PackedLayoutExplorer mode="union" />);
    const note = screen.getByTestId("union-p").textContent ?? "";
    expect(note).toMatch(/under this reading prints/);
    expect(note).toMatch(/first-declared-member reading of §21\.2\.1\.6/);
    expect(note).toMatch(/packed-union %p output is tool-dependent/);
    expect(note).toMatch(/%h/);
  });

  it("the %p caveat quotes the singular rules' catch-all and shows the other possible output, computed from the live value (§21.2.1.6)", () => {
    render(<PackedLayoutExplorer mode="union" />);
    const caveat = () => screen.getByTestId("union-p").querySelector("details")?.textContent ?? "";
    expect(caveat()).toMatch(/all other singular data types print their values as they would unformatted/);
    expect(caveat()).toMatch(/a packed union is a singular value \(§6\.4, §6\.11\.1\)/);
    expect(caveat()).not.toMatch(/name only packed structures/);
    // Never assigned: the unformatted value is x.
    expect(caveat()).toMatch(/this pattern or the union's plain decimal value, here x \(an unformatted value prints in decimal, §21\.2\.1\.1\)/);
    lockIn("12'hABC and 8'h1A");
    expect(screen.getByTestId("union-p").textContent).toMatch(/under this reading prints '\{f:'\{op:1, addr:2748, data:66\}\}/);
    expect(caveat()).toMatch(/this pattern or the union's plain decimal value, here 448528450 \(/);
  });

  it("the typedef prints f with its own type, cmd_t", () => {
    render(<PackedLayoutExplorer mode="union" />);
    expect(screen.getByText(/cmd_t f;/)).toBeInTheDocument();
    expect(screen.queryByText(/f_t/)).not.toBeInTheDocument();
  });

  it("a field or lane write in the hard packed union is not described as right-justified, and marks no row unaffected (§7.2.1, §7.4.5)", () => {
    render(<PackedLayoutExplorer mode="union" />);
    lockIn("12'hABC and 8'h1A");
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("union-status").textContent).toMatch(/f\.op is bits \[31:28\] of f, so only those bits change \(§7\.2\.1\); every view reads the same bits \(§7\.3\.1\)/);
    fireEvent.click(screen.getByTestId("run-statement"));
    const status = screen.getByTestId("union-status").textContent ?? "";
    expect(status).toMatch(/bytes\[0\] is bits \[7:0\] of bytes, so only those bits change \(§7\.4\.5\)/);
    expect(status).not.toMatch(/right-justified|unaffected/);
    expect(screen.queryByText(/unaffected$/)).not.toBeInTheDocument();
  });

  it("a short hex entry is a literal of its own digits, so the note reports the zero-extension; an over-long one reports the truncation (§10.7)", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.change(screen.getByLabelText("Member"), { target: { value: "half" } });
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.half \[15:0\] = 16'h0012/);
    expect(screen.getByTestId("union-status").textContent).toMatch(/The 8-bit source is zero-extended to 16 bits \(§10\.7\)/);
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "F_1234" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.half \[15:0\] = 16'h1234/);
    expect(screen.getByTestId("union-status").textContent).toMatch(/The 20-bit source is truncated to 16 bits \(§10\.7\)/);
    // Separators alone are not a value.
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "__" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(screen.getByRole("alert").textContent).toMatch(/Enter hex digits/);
  });

  it("Reset preset and re-selecting the current preset both re-arm the prediction", () => {
    render(<PackedLayoutExplorer mode="union" />);
    lockIn("12'hABC and 8'h1A");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset preset" }));
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw = 32'hxxxx_xxxx/);
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(lockInButtons()).toHaveLength(1);

    lockIn("12'hABC and 8'h1A");
    radio("Union preset", "cmd_u");
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw = 32'hxxxx_xxxx/);
    expect(lockInButtons()).toHaveLength(1);
    lockIn("12'hABC and 8'h1A");
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw \[31:0\] = 32'h1ABC_0042/);
  });

  it("'Reveal without predicting' runs the gated word_u statement", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word \[31:0\] = 32'hAAAA_1234/);
    expect(screen.getByText(/Why the answer holds:/)).toBeInTheDocument();
  });

  it("a width edit voids the prediction written for the preset's widths, and a declaration that does not compile runs nothing (§7.3.1)", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));

    // Hard packed with 32 and 16 bits: the compile-error card, and no way to run.
    radio("Packing", "union packed (hard)");
    expect(screen.getByTestId("union-problems").textContent).toMatch(/Compile error/);
    expect(lockInButtons()).toHaveLength(0);
    expect(screen.queryByTestId("run-statement")).not.toBeInTheDocument();
    expect(screen.getByTestId("union-write")).toBeDisabled();
    expect(screen.getByText(/does not compile, so nothing can run/)).toBeInTheDocument();

    // Soft again: the gate is back.
    radio("Packing", "union soft");
    expect(lockInButtons()).toHaveLength(1);

    // half narrowed to 8 bits: the prediction's answer (AAAA_1234) no longer holds, so the statement runs directly and the model truncates.
    setWidth("Width of half in bits", "8");
    expect(lockInButtons()).toHaveLength(0);
    expect(screen.getByText(/Width edited: the predictions were written for the preset widths/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word \[31:0\] = 32'hAAAA_BB34/);
    expect(screen.getByTestId("union-status").textContent).toMatch(/The 16-bit source is truncated to 8 bits \(§10\.7\)/);

    // A reset restores the preset's widths and its gate.
    fireEvent.click(screen.getByRole("button", { name: "Reset preset" }));
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(lockInButtons()).toHaveLength(1);
  });

  it("narrowing a hard packed member is a compile error; soft redraws it at bit 0 with the upper bits unaffected", () => {
    render(<PackedLayoutExplorer mode="union" preset="cmd_u" />);
    expect(screen.queryByTestId("union-problems")).not.toBeInTheDocument();
    setWidth("Width of raw in bits", "16");
    expect(screen.getByTestId("union-problems").textContent).toMatch(/Compile error/);
    expect(screen.getByTestId("union-problems").textContent).toMatch(/raw is 16 bits/);
    expect(screen.getByTestId("union-problems").textContent).toMatch(/§7\.3\.1/);
    radio("Packing", "union soft");
    expect(screen.queryByTestId("union-problems")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("union-row-raw")).getByText("[31:16] not in raw")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Member"), { target: { value: "raw" } });
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "1234" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(within(screen.getByTestId("union-row-raw")).getByText("[31:16] unaffected")).toBeInTheDocument();
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw \[15:0\] = 16'h1234/);
    expect(screen.getByTestId("union-status").textContent).toMatch(/bits \[31:16\] are unaffected by the write \(§7\.3\.1\)/);
  });

  it("while a hard packed declaration does not compile no row is drawn with bit positions; soft brings the rows back with the value kept (§7.3.1)", () => {
    render(<PackedLayoutExplorer mode="union" preset="cmd_u" />);
    lockIn("12'hABC and 8'h1A");
    setWidth("Width of raw in bits", "16");
    expect(screen.getByTestId("union-rows-blocked").textContent).toMatch(/does not compile, so its members have no bit positions \(§7\.3\.1\)/);
    for (const row of ["f", "raw", "bytes"]) expect(screen.queryByTestId(`union-row-${row}`)).not.toBeInTheDocument();
    expect(screen.queryByText(/not in raw/)).not.toBeInTheDocument();
    radio("Packing", "union soft");
    expect(screen.queryByTestId("union-rows-blocked")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("union-row-raw")).getByText("[31:16] not in raw")).toBeInTheDocument();
    expect(screen.getByTestId("union-status").textContent).toMatch(/u\.raw \[15:0\] = 16'h0042/);
  });

  it("nest_u: writing inner labels a narrower row's gap 'unaffected' only when every bit of it was left alone (§7.3.1)", () => {
    render(<PackedLayoutExplorer mode="union" preset="nest_u" />);
    fireEvent.change(screen.getByLabelText("Member"), { target: { value: "inner.b8" } });
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "AB" } });
    fireEvent.click(screen.getByTestId("union-write"));
    // The write covers [7:0]; b4's gap [11:4] includes bits that just changed, so it may not claim them.
    expect(within(screen.getByTestId("union-row-inner.b4")).getByText("[11:4] not in inner.b4")).toBeInTheDocument();
    expect(within(screen.getByTestId("union-row-inner.b8")).getByText("[11:8] unaffected")).toBeInTheDocument();
    expect(within(screen.getByTestId("union-row-inner")).getByText("[11:8] unaffected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Member"), { target: { value: "inner.b4" } });
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "F" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(within(screen.getByTestId("union-row-inner.b4")).getByText("[11:4] unaffected")).toBeInTheDocument();
  });

  it("the %p note shows its first sentence and keeps the caveat in a details element", () => {
    render(<PackedLayoutExplorer mode="union" />);
    const note = screen.getByTestId("union-p");
    expect(within(note).getByText(/first-declared-member reading of §21\.2\.1\.6, here f\./)).toBeVisible();
    expect(note.querySelector("details")?.textContent).toMatch(/packed-union %p output is tool-dependent/);
    expect(note.querySelector("details")).not.toHaveAttribute("open");
  });

  it("after a step focus moves to the next Run button or the first radio of the next prompt", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(document.activeElement).toBe(screen.getByLabelText("32'hAAAA_1234"));
  });

  it("word_u: the prediction gate diagnoses the cleared-upper-bits answer and shows AAAA_1234", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word = 32'hAAAA_BBBB/);
    lockIn("32'h0000_1234");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/does not clear the bits above it/)).toBeInTheDocument();
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word \[31:0\] = 32'hAAAA_1234; w\.half \[15:0\] = 16'h1234/);
    expect(within(screen.getByTestId("union-row-half")).getByText("[31:16] unaffected")).toBeInTheDocument();
  });

  it("word_u: until the question is answered the half row has no position, no value and no bit numbers, so the picture does not answer it", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    const half = screen.getByTestId("union-row-half");
    expect(half.textContent).toMatch(/16 bits: where they sit appears once you answer/);
    expect(half.textContent).not.toMatch(/\[15:0\]|\[31:16\]/);
    expect(stripLabel("w.half")).toBe("");
    const status = screen.getByTestId("union-status").textContent ?? "";
    expect(status).not.toMatch(/\[15:0\]|w\.half/);
    expect(screen.getByTestId("union-status-live").textContent).not.toMatch(/half/);
    // Reading half would give BBBB, which is the answer in hex.
    expect(status).not.toMatch(/16'hBBBB/);

    lockIn("32'hAAAA_1234");
    expect(stripLabel("w.half")).not.toBe("");
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.half \[15:0\] = 16'h1234/);
  });

  it("cmd_u: until the question is answered f and bytes are one strip each, with no field or lane ranges", () => {
    render(<PackedLayoutExplorer mode="union" />);
    expect(stripLabel("u.f.addr")).toBe("");
    expect(stripLabel("u.bytes[3]")).toBe("");
    expect(stripLabel("u.f")).toMatch(/^u\.f: 32-bit value/);
    for (const row of ["f", "bytes"]) expect(screen.getByTestId(`union-row-${row}`).textContent).not.toMatch(/\[27:16\]|\[31:24\]|addr|bytes\[3\]/);
    expect(screen.getByTestId("union-status").textContent).not.toMatch(/\[\d+:\d+\]/);
    lockIn("12'hABC and 8'h1A");
    expect(stripLabel("u.f.addr")).not.toBe("");
    expect(stripLabel("u.bytes[3]")).not.toBe("");
  });

  it("nest_u: the narrow rows have no position until the question is answered", () => {
    render(<PackedLayoutExplorer mode="union" preset="nest_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    for (const row of ["inner", "inner.b8", "inner.b4"]) expect(screen.getByTestId(`union-row-${row}`).textContent).toMatch(/where they sit appears once you answer/);
    expect(screen.getByTestId("union-status").textContent).not.toMatch(/inner/);
    lockIn("12'hABF");
    expect(stripLabel("n.inner.b4")).toMatch(/bits? 3 to 0|n\.inner\.b4/);
  });

  it("a free write voids the open prediction: its marked answer would be false after word = DEAD", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(lockInButtons()).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Member"), { target: { value: "word" } });
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "DEAD" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(lockInButtons()).toHaveLength(0);
    expect(screen.getByTestId("predictions-voided").textContent).toMatch(/You wrote outside the sequence/);
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word \[31:0\] = 32'h0000_DEAD/);
    // The note stands beside the control, not under the statement that ran.
    expect(screen.getByTestId("experiment-note").textContent).toMatch(/The 16-bit source is zero-extended to 32 bits/);
    expect(document.querySelector('[data-statement="0"]')?.textContent).not.toMatch(/zero-extended/);

    fireEvent.click(screen.getByTestId("run-statement"));
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    expect(screen.getByTestId("union-status").textContent).toMatch(/w\.word \[31:0\] = 32'h0000_1234/);
    expect(screen.queryByTestId("experiment-note")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset preset" }));
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(lockInButtons()).toHaveLength(1);
  });

  it("a prediction's feedback takes focus in union mode too", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    lockIn("32'h1234_BBBB");
    expect(document.activeElement?.textContent).toMatch(/^Not quite\. That places the narrow member at the MSB end/);
  });

  it("row names sit above their strips and stick to the panel's edge, so they stay readable while the bits scroll", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    const name = within(screen.getByTestId("union-row-word")).getByText("w.word");
    expect(name.className).toMatch(/sticky left-0/);
  });

  it("the live region announces a declaration change, and its compile error", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    const live = () => screen.getByTestId("union-status-live").textContent ?? "";
    radio("Packing", "union packed (hard)");
    expect(live()).toMatch(/^Compile error: members of a hard packed union/);
    radio("Packing", "union soft");
    expect(live()).toBe("word_u is now 32 bits, soft packed.");
  });

  it("a declaration edit drops the last write's note, which described the old declaration", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    lockIn("32'hAAAA_1234");
    expect(screen.getByTestId("union-status").textContent).toMatch(/right-justified in bits \[15:0\]/);
    setWidth("Width of half in bits", "8");
    const status = screen.getByTestId("union-status").textContent ?? "";
    expect(status).toMatch(/w\.half \[7:0\]/);
    expect(status).not.toMatch(/\[15:0\]/);
    expect(screen.getByTestId("union-status-live").textContent).toBe("word_u is now 32 bits, soft packed.");
  });

  it("the summary does not claim a packing the Packing control can change", () => {
    render(<PackedLayoutExplorer mode="union" />);
    radio("Packing", "union soft");
    expect(screen.getByTestId("union-status").textContent).toMatch(/soft packed/);
    const header = screen.getByRole("region", { name: "Packed union explorer" }).querySelector("header");
    expect(header?.textContent).not.toMatch(/[Hh]ard packed/);
  });

  it("rejects a non-hex write and names the nested example as ours", () => {
    render(<PackedLayoutExplorer mode="union" preset="nest_u" />);
    expect(screen.getByText(/not the standard's Figure 7-1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "hello" } });
    fireEvent.click(screen.getByTestId("union-write"));
    expect(screen.getByRole("alert").textContent).toMatch(/Enter hex digits/);
  });
});

describe("PackedLayoutExplorer: tagged mode", () => {
  it("predicts each read: legal when the tag matches, a run-time error otherwise (§11.9)", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    expect(screen.getByRole("region", { name: "Tagged union explorer" })).toBeInTheDocument();
    expect(screen.getByTestId("tagged-value").textContent).toMatch(/undefined/);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    expect(screen.getByTestId("tagged-value").textContent).toMatch(/32'h0000_0017/);
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    expect(screen.queryByTestId("tagged-read-result")).not.toBeInTheDocument();
    lockIn("Legal: prints the value");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // The statement is %0d, so the printed text is decimal (§21.2.1.3); the chip keeps the sized hex.
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/\$display prints 23\. The tag is Valid/);
    expect(screen.getByTestId("tagged-read-result").textContent).not.toMatch(/32'h/);

    fireEvent.click(screen.getByRole("button", { name: "v = tagged Invalid;" }));
    expect(screen.getByTestId("tagged-value").textContent).toMatch(/void/);
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    lockIn("Legal: prints the value");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/Run-time error: the tag is Invalid/);
    fireEvent.click(screen.getByRole("button", { name: '$display("%p", v);' }));
    expect(screen.getByTestId("tagged-p").textContent).toMatch(/prints Invalid/);
  });

  it("reading before any assignment: 'undefined' is the correct prediction and the result agrees (§11.9)", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    lockIn("Undefined: never assigned, so no defined result (derived from §11.9)");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/Undefined: the variable was never assigned/);
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/Derived from that/);
  });

  it("the unpacked status does not state a tag width as fact: that rule is for the packed representation (§7.3, §7.3.2)", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    const status = () => screen.getByTestId("tagged-status").textContent ?? "";
    expect(status()).toMatch(/If declared packed, the tag would be 1 bit \(§7\.3\.2\); an unpacked tagged union has no required representation \(§7\.3\)\./);
    expect(status()).not.toMatch(/Tag width/);
    fireEvent.click(screen.getByTestId("tagged-third"));
    expect(status()).toMatch(/the tag would be 2 bits/);
    fireEvent.click(screen.getByTestId("tagged-packed"));
    expect(status()).not.toMatch(/If declared packed/);
  });

  it("a read button moves focus to the question's first answer, and the result tells a screen reader how the prediction went", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    expect(document.activeElement).toBe(screen.getByLabelText("Legal: prints the value"));
    lockIn("Run-time error: the tag is another member");
    expect(document.activeElement).toBe(screen.getByTestId("tagged-read-result"));
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/^Your prediction was wrong\. /);
    // A second read asks again, with focus back on the question.
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    expect(document.activeElement).toBe(screen.getByLabelText("Legal: prints the value"));
    lockIn("Legal: prints the value");
    expect(screen.getByTestId("tagged-read-result").textContent).toMatch(/^Your prediction was right\. /);
  });

  it("%p reaches the live status, not only the screen", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    expect(screen.getByTestId("tagged-status").textContent).not.toMatch(/%p prints/);
    fireEvent.click(screen.getByRole("button", { name: '$display("%p", v);' }));
    expect(screen.getByTestId("tagged-status").textContent).toMatch(/%p prints Valid:23 \(tag:value, §21\.2\.1\.6, which does not say whether '\{ \} surrounds it\)\./);
    expect(screen.getByTestId("tagged-status")).toHaveAttribute("aria-live", "polite");
  });

  it("the third member's tag code is labelled as our own extension of Figures 7-2 and 7-3", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByTestId("tagged-third"));
    fireEvent.click(screen.getByTestId("tagged-packed"));
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Small (8'h5A);" }));
    expect(screen.getByTestId("tagged-layout-note").textContent).toMatch(/code 2 for a third member is our own extension/);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    expect(screen.getByTestId("tagged-layout-note").textContent).toMatch(/follows the numbering of Figures 7-2 and 7-3\. Valid/);
  });

  it("the typedef label credits the standard for its two-member VInt and calls the three-member one ours", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    expect(screen.getByText(/typedef \(IEEE 1800-2023 §7\.3\.2 example\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tagged-third"));
    expect(screen.getByText(/typedef \(our example, after §7\.3\.2\)/)).toBeInTheDocument();
    expect(screen.queryByText(/IEEE 1800-2023 §7\.3\.2 example/)).not.toBeInTheDocument();
  });

  it("the packed toggle draws 1 tag bit plus 32 value bits, Invalid leaves the rest undefined, and a third member grows the tag to 2 bits", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByTestId("tagged-packed"));
    expect(stripLabel("v, VInt packed")).toMatch(/33-bit value/);
    expect(screen.getByTestId("tagged-layout-note").textContent).toMatch(/33 bits: tag \[32\] \(1 bit for 2 members\)/);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Invalid;" }));
    expect(stripLabel("v, VInt packed")).toMatch(/bits 31 to 0 undefined \(no defined value\)/);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    expect(stripLabel("v, VInt packed")).toMatch(/tag is bit 32; Valid is bits 31 to 0/);
    expect(stripLabel("v, VInt packed")).not.toMatch(/undefined/);

    fireEvent.click(screen.getByTestId("tagged-third"));
    expect(screen.getByTestId("tagged-layout-note").textContent).toMatch(/34 bits: tag \[33:32\] \(2 bits for 3 members\)/);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Small (8'h5A);" }));
    expect(stripLabel("v, VInt packed")).toMatch(/bits 31 to 8 undefined/);
    expect(screen.getByTestId("tagged-layout-note").textContent).toMatch(/the 24 bits between are undefined/);
    fireEvent.click(screen.getByRole("button", { name: '$display("%p", v);' }));
    expect(screen.getByTestId("tagged-p").textContent).toMatch(/prints Small:90/);
    // Packed, VInt is a singular integral value, so tag:value is a reading tools can differ on: the same caveat as a packed untagged union.
    expect(screen.getByTestId("tagged-p").textContent).toMatch(/a reading of §21\.2\.1\.6 that tools can implement differently/);
    const why = screen.getByTestId("tagged-p").querySelector("details")?.textContent ?? "";
    expect(why).toMatch(/Why tools can differ.*packed tagged union is singular \(§6\.4, §6\.11\.1\)/);
    expect(why).toMatch(/sends every type it does not name, packed unions included, to their unformatted value\. The two readings differ, so its %p output is tool-dependent/);
    expect(why).not.toMatch(/name only packed structures/);
    expect(screen.getByTestId("tagged-status").textContent).toMatch(/%p prints Small:90 \(a reading of §21\.2\.1\.6 that tools can implement differently\)\./);
  });

  it("the log prints the statement exactly as its button shows it", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: "Third member (bit [7:0] Small)" }));
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Small (8'h5A);" }));
    expect(screen.getByRole("list", { name: "Statements run" }).textContent).toMatch(/v = tagged Small \(8'h5A\);/);
    expect(screen.getByRole("list", { name: "Statements run" }).textContent).not.toMatch(/90/);
  });

  it("toggles keep one label with aria-pressed, 'Reset v' clears the value and the log, and focus moves to the read result", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    const third = screen.getByRole("button", { name: "Third member (bit [7:0] Small)" });
    expect(third).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(third);
    expect(screen.getByRole("button", { name: "Third member (bit [7:0] Small)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Packed layout" }));
    expect(screen.getByRole("button", { name: "Packed layout" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "v = tagged Valid (23);" }));
    fireEvent.click(screen.getByRole("button", { name: '$display("%0d", v.Valid);' }));
    lockIn("Legal: prints the value");
    expect(document.activeElement).toBe(screen.getByTestId("tagged-read-result"));

    fireEvent.click(screen.getByRole("button", { name: "Reset v" }));
    expect(screen.getByTestId("tagged-value").textContent).toMatch(/undefined/);
    expect(screen.queryByTestId("tagged-read-result")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Statements run" })).not.toBeInTheDocument();
    expect(lockInButtons()).toHaveLength(0);
  });
});

describe("PackedLayoutExplorer: mutation mode", () => {
  it("hides results until the reveal, grades predictions, shows the changed $display lines and agrees with the lesson", () => {
    render(<PackedLayoutExplorer mode="mutation" />);
    expect(screen.getByRole("region", { name: "Mutation board for the lesson's tb_top" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /no prediction yet/ })).toHaveLength(33);
    expect(screen.queryByText(/caught/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "layout against Reverse addr and data: no prediction yet" }));
    fireEvent.click(screen.getByRole("button", { name: "$bits against Reverse addr and data: no prediction yet" }));
    expect(screen.getByRole("button", { name: "$bits against Reverse addr and data: predicted will catch" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mutation-reveal"));
    expect(screen.getByRole("button", { name: /^layout against Reverse addr and data: caught, c = 32'h2BEE_F123, you said will catch, prediction right/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^\$bits against Reverse addr and data: survived, \$bits\(cmd_t\) = 32, you said will catch, prediction wrong/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^no name against opcode_e base to bit \[3:0\]: caught, never_set\.name\(\) = "OP_NOP"/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^wrap against Append OP_SYNC = 4'h3: caught, op\.next\(\) = OP_SYNC/ })).toBeInTheDocument();
    // Unmarked cells count as "will miss": $bits is wrong, and so are the four catches left unmarked.
    expect(screen.getByText(/You predicted 28 of 33 cells right/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^addr write against Reverse addr and data: caught, .*you said will miss, prediction wrong/ })).toBeInTheDocument();
    const missed = screen.getByTestId("mutation-missed").textContent ?? "";
    expect(missed).toMatch(/You did not mark 4 checks that caught a mutation/);
    expect(missed).toMatch(/addr write against Reverse addr and data/);
    expect(missed).toMatch(/wrap against Append OP_SYNC = 4'h3/);

    const results = screen.getByTestId("mutation-results");
    expect(results.textContent).toMatch(/- c = 2123beef, \$bits\(cmd_t\) = 32\+ c = 2beef123, \$bits\(cmd_t\) = 32/);
    expect(results.textContent).toMatch(/FAIL: layout/);
    // The lesson's own table is pinned in tests/lib/sv-aggregate-layout-model.test.ts; a maintainer's check is not for the learner.
    expect(screen.queryByTestId("lesson-agreement")).not.toBeInTheDocument();
    expect(results.textContent).not.toMatch(/the model agrees|maintainer/);

    radio("Show the log of", "opcode_e base to bit [3:0]");
    expect(screen.getByTestId("mutation-results").textContent).toMatch(/never_set = 0000, name\(\) = "OP_NOP"/);
    expect(screen.getByTestId("mutation-results").textContent).toMatch(/PASS=10 FAIL=1/);
  });

  it("the run needs at least one mark or an explicit skip; a skip grades nothing", () => {
    render(<PackedLayoutExplorer mode="mutation" />);
    expect(screen.getByTestId("mutation-reveal")).toBeDisabled();
    fireEvent.click(screen.getByTestId("mutation-skip"));
    expect(screen.getByText(/Revealed without predictions: 5 caught, 28 survived/)).toBeInTheDocument();
    expect(screen.queryByTestId("mutation-missed")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Results" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset predictions" }));
    expect(document.activeElement).toBe(screen.getByTestId("mutation-skip"));
  });

  it("pressing a result cell marks that cell, row included, and highlights its FAIL line", () => {
    render(<PackedLayoutExplorer mode="mutation" />);
    fireEvent.click(screen.getByRole("button", { name: "layout against Reverse addr and data: no prediction yet" }));
    fireEvent.click(screen.getByTestId("mutation-reveal"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Results" }));

    const wrap = () => screen.getByRole("button", { name: /^wrap against Append OP_SYNC = 4'h3:/ });
    fireEvent.click(wrap());
    expect(wrap()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^layout against Append OP_SYNC = 4'h3:/ })).toHaveAttribute("aria-pressed", "false");
    const active = screen.getByTestId("mutation-results").querySelector('[aria-current="step"]');
    expect(active?.textContent).toMatch(/FAIL: wrap/);

    // A check that passed has no FAIL line to point at, and the page says so.
    fireEvent.click(screen.getByRole("button", { name: /^\$bits against Append OP_SYNC = 4'h3:/ }));
    expect(screen.getByTestId("mutation-results").querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.getByTestId("mutation-selected").textContent).toMatch(/no FAIL line/);
  });
});

describe("PackedLayoutExplorer: debug clinic", () => {
  it("swapped fields: predict the cause, click the suspect line, pick a fix, rerun; a wrong fix keeps the symptom", () => {
    render(<PackedLayoutExplorer mode="debug" />);
    expect(screen.getByRole("region", { name: "Struct and enum debugging clinic" })).toBeInTheDocument();
    expect(screen.getByText(/op = f, addr = bee, data = 2123/)).toBeInTheDocument();
    expect(screen.queryByTestId("clinic-lines")).not.toBeInTheDocument();
    lockIn("The simulator uses little-endian byte order for packed structs");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/independent of the host machine/)).toBeInTheDocument();

    const lines = screen.getByTestId("clinic-lines");
    fireEvent.click(within(lines).getByRole("button", { name: /^Line 3:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✕ addr is 12 bits/);
    expect(screen.queryByTestId("clinic-fix")).not.toBeInTheDocument();
    fireEvent.click(within(lines).getByRole("button", { name: /^Line 2:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ This is it: the first member of a packed struct is the most significant/);
    expect(within(lines).getByRole("button", { name: /^Line 2:.*, the suspect$/ })).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByTestId("clinic-rerun")).toBeDisabled();
    pickFix("4-state enum base");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/The symptom is still there/);
    expect(screen.getAllByText(/op = f, addr = bee, data = 2123/).length).toBe(2);

    pickFix("Reorder the members");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/Fixed\. Declaring op, addr, data in that order/);
    expect(screen.getByText(/\[mon\] op = 2, addr = 123, data = beef/)).toBeInTheDocument();
    expect(screen.getByText(/\[scb\] expected op = 2, addr = 123, data = beef: match/)).toBeInTheDocument();
  });

  it("hints fade in one at a time and the IDLE scenario shows the int-base default", () => {
    render(<PackedLayoutExplorer mode="debug" preset="idle-without-reset" />);
    expect(screen.getByText(/@0 state\.name\(\) = "IDLE" \(value 0\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Need a hint? (0/3)" }));
    expect(screen.getByText(/Table 6-7 gives it per base type/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Another hint (1/3)" }));
    expect(screen.getByText(/What is int's default/)).toBeInTheDocument();
    lockIn("The enum has the default int base, which starts at 0, and 0 is IDLE");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show the suspect" }));
    pickFix("4-state enum base");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/Fixed\./);
    expect(screen.getByText(/@0 state\.name\(\) = "" \(value x\)/)).toBeInTheDocument();
  });

  it("the struct back-door scenario: the whole-vector write is the suspect, and $cast on the decoded field removes the empty name (derived from §7.2.1, §6.24.2)", () => {
    render(<PackedLayoutExplorer mode="debug" preset="empty-name-struct" />);
    expect(screen.getByText(/\[mon\] op = , addr = abc, data = 0042/)).toBeInTheDocument();
    lockIn('A static cast opcode_e\'(7) stored the value');
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/There is no cast in this monitor/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 6:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ This is it: assigning the word to the packed struct/);
    pickFix("4-state enum base");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/The symptom is still there/);
    pickFix("$cast with a check");
    expect(screen.getByText(/\$cast\(cmd\.op, bus_word\[31:28\]\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/Fixed\./);
    expect(screen.getByText(/^\/\/ \$cast returned 0 and left cmd\.op unchanged; \$error reports "bad opcode 7" in a tool-specific message \(§20\.10\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^\[mon\] op = OP_NOP, addr = abc, data = 0042$/)).toBeInTheDocument();
  });

  it("the two-typedefs scenario compiles only with one package typedef", () => {
    render(<PackedLayoutExplorer mode="debug" preset="two-typedefs" />);
    expect(screen.getByText(/cannot assign mon\.cmd_rec_t to scb\.cmd_rec_t/)).toBeInTheDocument();
    expect(screen.getByText(/not assignment compatible: §6\.22\.3/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Log, as found" }).textContent).not.toMatch(/incompatible/);
    lockIn("Two separate typedef statements are two different types, however alike their text");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 5:/ }));
    pickFix("One typedef in a package");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByText("compile: ok")).toBeInTheDocument();
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/regardless of the scope it is imported into \(§6\.22\.1 h\)/);
  });

  it("two typedefs + $cast: the log shows it compiles and fails at run time, and the verdict says the symptom moved (§6.24.2)", () => {
    render(<PackedLayoutExplorer mode="debug" preset="two-typedefs" />);
    lockIn("Two separate typedef statements are two different types, however alike their text");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 5:/ }));
    pickFix("$cast with a check");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    const log = screen.getByRole("list", { name: 'Log after rerun with "$cast with a check"' }).textContent ?? "";
    expect(log).toMatch(/compile: ok \(\$cast as a function never issues a compile error, §6\.24\.2\)/);
    expect(log).toMatch(/run: \$cast returned 0/);
    expect(log).toMatch(/\/\/ \$error reports "cast failed" in a tool-specific message \(§20\.10\); scb\.expected is unchanged/);
    expect(log).not.toMatch(/ERROR:/);
    expect(log).not.toMatch(/compile error \(assign_rec\)/);
    const verdict = screen.getByTestId("clinic-verdict").textContent ?? "";
    expect(verdict).toMatch(/The symptom moved\./);
    expect(verdict).not.toMatch(/still there/);
    expect(verdict).not.toMatch(/^✓|Fixed\./);
  });

  it("the picked line's explanation is in a live region that is mounted before the pick; line buttons have room to tap", () => {
    render(<PackedLayoutExplorer mode="debug" />);
    lockIn("The members are declared in the wrong order: the first member is the MSB end");
    const feedback = screen.getByTestId("clinic-line-feedback");
    expect(feedback).toHaveAttribute("aria-live", "polite");
    expect(feedback.textContent).toBe("");
    const line = within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 3:/ });
    expect(line.className).toMatch(/py-1\.5/);
    fireEvent.click(line);
    expect(screen.getByTestId("clinic-line-feedback")).toBe(feedback);
    expect(feedback.textContent).toMatch(/addr is 12 bits/);
  });

  it("two-typedefs: either typedef line unlocks the fix, and its feedback names the other line", () => {
    render(<PackedLayoutExplorer mode="debug" preset="two-typedefs" />);
    lockIn("Two separate typedef statements are two different types, however alike their text");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 2:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ This is one of the two, with line 5/);
    expect(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 2:.*, the suspect$/ })).toBeInTheDocument();
    expect(screen.getByTestId("clinic-fix")).toBeInTheDocument();
  });

  it("the empty-name fix gives op a known default, so the rerun's OP_NOP comes from code on screen", () => {
    render(<PackedLayoutExplorer mode="debug" preset="empty-name" />);
    lockIn("A static cast stored a value that is not a member, so name() returns \"\"");
    // Line 2 declares op, so the static cast is line 5.
    expect(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 2: opcode_e op;$/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 5:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ This is it: a static cast/);
    pickFix("$cast with a check");
    expect(screen.getByRole("list", { name: "Change" }).textContent).toMatch(/op = OP_NOP;[\s\S]*\$cast\(op, raw\[31:28\]\)/);
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByText(/^op = OP_NOP$/)).toBeInTheDocument();
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/leaves op unchanged and returns 0 \(§6\.24\.2\)/);
  });

  it("the rand scenario keeps the root cause out of the log and in the verdict, and a distractor fix shows this scenario's types", () => {
    render(<PackedLayoutExplorer mode="debug" preset="rand-packed-member" />);
    const log = screen.getByRole("list", { name: "Log, as found" }).textContent ?? "";
    expect(log).toMatch(/rand not allowed on this member/);
    expect(log).not.toMatch(/unpacked|class/);
    lockIn("Among struct members, rand is legal only in unpacked structs");
    fireEvent.click(screen.getByRole("button", { name: "Show the suspect" }));
    pickFix("One typedef in a package");
    expect(screen.getByRole("list", { name: "Change" }).textContent).toMatch(/rand logic \[3:0\] op/);
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByTestId("clinic-verdict").textContent).toMatch(/legal only within an unpacked structure/);
    pickFix("rand on the whole struct");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    const verdict = screen.getByTestId("clinic-verdict").textContent ?? "";
    expect(verdict).toMatch(/Fixed\./);
    expect(verdict).toMatch(/rand as a whole/);
    expect(verdict).not.toMatch(/unpacked/);
  });

  it("clause line appears after the cause is revealed, causes use the prose font, and 'Reset scenario' re-arms the prompt", () => {
    render(<PackedLayoutExplorer mode="debug" preset="idle-without-reset" />);
    expect(screen.queryByText(/Source: IEEE 1800-2023/)).not.toBeInTheDocument();
    expect(screen.getByText("The reset branch ran before time 0").closest(".font-mono")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Need a hint? (0/3)" }));
    lockIn("The reset branch ran before time 0");
    expect(screen.getByText(/Source: IEEE 1800-2023 Table 6-7/)).toBeInTheDocument();
    expect(screen.getByTestId("clinic-lines")).toBeInTheDocument();
    // Focus stops at the diagnosis, and Tab goes on to the first declaration line.
    expect(document.activeElement?.textContent).toMatch(/^Not quite\. Nothing executes before time 0/);
    expect(screen.getByRole("heading", { name: "Click the suspect declaration line" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show the suspect" }));
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Line 1:.*, the suspect$/);

    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    expect(screen.queryByTestId("clinic-lines")).not.toBeInTheDocument();
    expect(screen.queryByText(/Not quite\./)).not.toBeInTheDocument();
    expect(lockInButtons()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Need a hint? (0/3)" })).toBeInTheDocument();
  });

  it("the IDLE log never shows a move to RUN: x stays x after the edge once the base is 4-state", () => {
    render(<PackedLayoutExplorer mode="debug" preset="idle-without-reset" />);
    expect(screen.getByRole("list", { name: "Log, as found" }).textContent).not.toMatch(/RUN/);
    lockIn("The enum has the default int base, which starts at 0, and 0 is IDLE");
    fireEvent.click(screen.getByRole("button", { name: "Show the suspect" }));
    pickFix("4-state enum base");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    expect(screen.getByText(/^@10 state\.name\(\) = "" \(value x\)$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^\/\/ @10 posedge clk: rst_n is 1, so the always_ff assigns nothing to state$/)).toHaveLength(2);
  });

  it("the frame says that // lines in a log are the model's notes and that $error's prefix is tool-specific (§20.10)", () => {
    render(<PackedLayoutExplorer mode="debug" preset="idle-without-reset" />);
    expect(screen.getByText(/a line that starts with \/\/ is the model's note, not simulator output/)).toBeInTheDocument();
    expect(screen.getByText(/\$error prints a tool-specific message \(§20\.10\)/)).toBeInTheDocument();
  });
});

/** The statement's own list item, where its note is printed. */
const statementItem = (index: number) => document.querySelector<HTMLElement>(`[data-statement="${index}"]`)!;

describe("PackedLayoutExplorer: an x write takes the statement's note with it", () => {
  it("reversed: 'data now reads 16'hABC0' is gone once addr holds x", () => {
    render(<PackedLayoutExplorer preset="reversed" />);
    lockIn("12'h042");
    expect(statementItem(0).textContent).toMatch(/data now reads 16'hABC0 and addr 12'h042/);
    fireEvent.click(screen.getByTestId("write-x-addr"));
    expect(statementItem(0).textContent).not.toMatch(/data now reads|shifted, not garbage/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/addr \[11:0\] = 12'hxxx/);
    expect(screen.getByTestId("struct-status").textContent).not.toMatch(/data now reads/);
    expect(screen.getByTestId("experiment-note").textContent).toMatch(/addr is a 4-state member/);
  });

  it("ctrl_reg_t: 'ctrl reads 32'h0000_0641' is gone once thresh holds x", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    lockIn("32'h0000_0641");
    expect(statementItem(2).textContent).toMatch(/ctrl reads 32'h0000_0641/);
    fireEvent.click(screen.getByTestId("write-x-thresh"));
    expect(statementItem(2).textContent).not.toMatch(/ctrl reads 32'h0000_0641/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^ctrl = 32'h0000_0xx1;/);
  });

  it("pkt_hdr_t: 'len = 8'hFF = 255' is gone once len holds x", () => {
    render(<PackedLayoutExplorer preset="pkt_hdr_t" />);
    lockIn("4540cafe");
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(statementItem(1).textContent).toMatch(/len = 8'hFF = 255/);
    fireEvent.click(screen.getByTestId("write-x-len"));
    expect(statementItem(1).textContent).not.toMatch(/len = 8'hFF = 255/);
    expect(screen.getByTestId("struct-status").textContent).toMatch(/^rx = 32'hC1xx_0000;/);
  });

  it("cmd_t: '5 | ABC | 0042' is gone once op holds x", () => {
    render(<PackedLayoutExplorer />);
    lockIn("4'h5");
    expect(statementItem(0).textContent).toMatch(/5 \| ABC \| 0042/);
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(statementItem(0).textContent).not.toMatch(/5 \| ABC \| 0042/);
  });
});

describe("PackedLayoutExplorer: experiments", () => {
  it("the x writes sit in a closed disclosure, so a stray press cannot end the first question", () => {
    render(<PackedLayoutExplorer />);
    const box = screen.getByTestId("x-experiments");
    expect(box.tagName).toBe("DETAILS");
    expect(box).not.toHaveAttribute("open");
    expect(within(box).getByTestId("write-x-data")).toBeInTheDocument();
    expect(within(box).getByText(/turns the predictions off until you reset/)).toBeInTheDocument();
  });

  it("the enum readout follows any write, whatever order it and a layout edit come in", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    expect(screen.queryByTestId("enum-readout")).not.toBeInTheDocument();
    // A layout edit alone writes nothing, and the readout would give the prediction away.
    fireEvent.click(screen.getByRole("button", { name: "Move down: op" }));
    expect(screen.queryByTestId("enum-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("struct-cards")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/part-select wrote these bits/);
    expect(screen.getByTestId("struct-cards")).toBeInTheDocument();
  });

  it("a reorder that leaves op where it was written keeps the readout's arrival: swapping addr and data after the whole-vector write (§7.2.1)", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    lockIn('"" (empty string)');
    const readout = () => screen.getByTestId("enum-readout").textContent ?? "";
    expect(readout()).toMatch(/whole-vector write was not type-checked/);
    fireEvent.click(screen.getByRole("button", { name: "Move up: data" }));
    expect(screen.getByTestId("layout-live").textContent).toMatch(/^op \[31:28\] \| data \[27:12\] \| addr \[11:0\]/);
    expect(readout()).toMatch(/op holds 4'h7/);
    expect(readout()).toMatch(/whole-vector write was not type-checked/);
    expect(readout()).not.toMatch(/typedef edit moved op/);
  });

  it("the part-select's explanation also survives a swap that leaves op in place", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    lockIn('"" (empty string)');
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/part-select wrote these bits/);
    fireEvent.click(screen.getByRole("button", { name: "Move up: data" }));
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/part-select wrote these bits/);
    expect(screen.getByTestId("enum-readout").textContent).not.toMatch(/typedef edit moved op/);
  });

  it("moving op away credits the edit, and moving it back restores the whole-vector explanation; a shrink that drops its bits does not", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    lockIn('"" (empty string)');
    const readout = () => screen.getByTestId("enum-readout").textContent ?? "";
    fireEvent.click(screen.getByRole("button", { name: "Move down: op" }));
    expect(readout()).toMatch(/typedef edit moved op over other bits/);
    fireEvent.click(screen.getByRole("button", { name: "Move up: op" }));
    expect(screen.getByTestId("layout-live").textContent).toMatch(/^op \[31:28\]/);
    expect(readout()).toMatch(/whole-vector write was not type-checked/);
    // data to 8 bits drops [31:24]; back to 16 the top bits are new, so the write no longer explains them.
    setWidth("Width of data in bits", "8");
    setWidth("Width of data in bits", "16");
    expect(screen.getByTestId("layout-live").textContent).toMatch(/^op \[31:28\]/);
    expect(readout()).toMatch(/typedef edit moved op over other bits/);
  });

  it("a layout edit after an x write keeps the readout", () => {
    render(<PackedLayoutExplorer preset="enum-field" />);
    fireEvent.click(screen.getByTestId("write-x-addr"));
    expect(screen.getByTestId("enum-readout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move down: op" }));
    expect(screen.getByTestId("enum-readout").textContent).toMatch(/never assigned/);
  });

  it("the widths heading states the editor's real limits: frame_t's 24-bit body may stay 24, and keeps that limit after a shrink", () => {
    render(<PackedLayoutExplorer preset="frame_t" />);
    expect(screen.getByTestId("width-limits").textContent).toBe("Widths (1 to 16 bits; body up to 24)");
    setWidth("Width of body in bits", "10");
    expect(screen.getByTestId("width-limits").textContent).toBe("Widths (1 to 16 bits; body up to 24)");
    setWidth("Width of body in bits", "24");
    expect(screen.getByTestId("layout-live").textContent).toMatch(/\$bits = 32$/);
    radio("Struct preset", "cmd_t");
    expect(screen.getByTestId("width-limits").textContent).toBe("Widths (1 to 16 bits)");
  });

  it("the 'Run it' focus hook is its own attribute, not a test id", () => {
    render(<PackedLayoutExplorer preset="ctrl_reg_t" />);
    const button = screen.getByTestId("run-statement");
    expect(button).toHaveAttribute("data-run-statement");
    fireEvent.click(button);
    expect(document.activeElement).toBe(screen.getByTestId("run-statement"));
  });
});

describe("PackedLayoutExplorer: only the strips scroll", () => {
  const scroller = () => screen.getByTestId("strip-scroll");
  const legend = () => screen.getByText(/^Legend:/).closest("p")!;

  it("struct: the legend and the ranges hint wrap to the panel instead of scrolling with the bits", () => {
    render(<PackedLayoutExplorer />);
    // The box that must not hold a sentence is the one sized to its widest line, and the strip is in it.
    expect(scroller()).toHaveClass("w-max");
    expect(scroller().querySelector('[role="img"]')).not.toBeNull();
    expect(screen.getByTestId("ranges-hidden").closest(".w-max")).toBeNull();
    expect(screen.getByTestId("ranges-hidden").closest("[role='region'][aria-label^='Bits of']")).toBeNull();
    lockIn("4'h5");
    fireEvent.click(screen.getByTestId("write-x-op"));
    expect(legend().textContent).toMatch(/just changed/);
    expect(legend().closest(".w-max")).toBeNull();
    expect(legend().closest("[role='region'][aria-label^='Bits of']")).toBeNull();
  });

  it("tagged: the long layout note and the legend are outside the scrolling box", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByTestId("tagged-packed"));
    const note = screen.getByTestId("tagged-layout-note");
    expect(note.closest(".w-max")).toBeNull();
    expect(note.closest('[role="region"][aria-label^="Packed bits"]')).toBeNull();
    expect(legend().closest(".w-max")).toBeNull();
  });

  it("union: the legend is outside the scrolling box", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(legend().textContent).toMatch(/just changed/);
    expect(legend().closest(".w-max")).toBeNull();
    expect(legend().closest("[role='region'][aria-label^='Rows of']")).toBeNull();
  });
});

describe("PackedLayoutExplorer: union notes follow what the rows can read (§7.3.1)", () => {
  it("word_u: while the question is open the note says nothing about the half; once answered it stays true", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(statementItem(0).textContent).toMatch(/word names bits \[31:0\]\./);
    expect(statementItem(0).textContent).not.toMatch(/every other|narrower|low bits|half/);
    expect(screen.getByTestId("union-status").textContent).not.toMatch(/every other|narrower|low bits/);
    expect(screen.getByTestId("union-status-live").textContent).not.toMatch(/narrower|low bits/);
  });

  it("word_u: with the prediction out of the way, the same write names the narrower row", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    setWidth("Width of half in bits", "8");
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(statementItem(0).textContent).toMatch(/word names bits \[31:0\]; half is narrower and reads only its own low bits \(§7\.3\.1\)\./);
  });

  it("cmd_u soft with raw 16: a field write says raw cannot read it, and the preset's 'every view' note is dropped", () => {
    render(<PackedLayoutExplorer mode="union" />);
    radio("Packing", "union soft");
    setWidth("Width of raw in bits", "16");
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    const note = statementItem(1).textContent ?? "";
    expect(note).toMatch(/f\.op is bits \[31:28\] of f, so only those bits change \(§7\.2\.1\); raw \[15:0\] is narrower and does not read all of those bits \(§7\.3\.1\)\./);
    expect(note).not.toMatch(/every view/);
    expect(screen.getByTestId("union-status").textContent).not.toMatch(/every view/);
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(statementItem(2).textContent).toMatch(/every view reads the same bits/);
    expect(statementItem(2).textContent).not.toMatch(/A byte write writes/);
  });

  it("a free write ends the preset's own notes for the statements still to run", () => {
    render(<PackedLayoutExplorer mode="union" />);
    fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "DEAD" } });
    fireEvent.click(screen.getByTestId("union-write"));
    fireEvent.click(screen.getByTestId("run-statement"));
    fireEvent.click(screen.getByTestId("run-statement"));
    expect(statementItem(1).textContent).not.toMatch(/A field write through f/);
  });

  it("a shrink is for good: nest_u with n.a = ABF, a at 8, then a at 12 has lost the A, and the new bits are x (Table 6-7)", () => {
    render(<PackedLayoutExplorer mode="union" preset="nest_u" />);
    fireEvent.click(screen.getByTestId("run-statement"));
    lockIn("12'hABF");
    expect(screen.getByTestId("union-status").textContent).toMatch(/n\.a \[11:0\] = 12'hABF/);
    setWidth("Width of a in bits", "8");
    expect(screen.getByTestId("union-status").textContent).toMatch(/n\.a \[7:0\] = 8'hBF/);
    setWidth("Width of a in bits", "12");
    expect(screen.getByTestId("union-status").textContent).toMatch(/n\.a \[11:0\] = 12'hxBF/);
  });

  it("a declaration that does not compile reports no width, state-ness, values or %p", () => {
    render(<PackedLayoutExplorer mode="union" preset="word_u" />);
    expect(screen.getByTestId("union-status").textContent).toMatch(/^word_u is 32 bits/);
    expect(screen.getByTestId("union-p")).toBeInTheDocument();
    radio("Packing", "union packed (hard)");
    const status = screen.getByTestId("union-status").textContent ?? "";
    expect(status).toMatch(/^word_u does not compile\. Compile error: members of a hard packed union/);
    expect(status).not.toMatch(/32 bits, 4-state|w\.word/);
    expect(screen.queryByTestId("union-p")).not.toBeInTheDocument();
    expect(screen.queryByText(/^states$/)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /^typedef/ }).textContent).toMatch(/does not compile/);
    expect(screen.getByRole("list", { name: /^typedef/ }).textContent).not.toMatch(/4-state/);
    radio("Packing", "union soft");
    expect(screen.getByTestId("union-status").textContent).toMatch(/^word_u is 32 bits/);
    expect(screen.getByTestId("union-p")).toBeInTheDocument();
  });

  it("the typedef's label is in the learner's words, with no file name", () => {
    render(<PackedLayoutExplorer />);
    expect(screen.getByRole("list", { name: "typedef (Structs, Unions and Enums: Packed structs)" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\.mdx/);
  });
});

describe("PackedLayoutExplorer: %p of a tagged union says only what the standard supports", () => {
  it("before any assignment no printed string is stated: the output is not defined, derived from §11.9", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: '$display("%p", v);' }));
    const chip = screen.getByTestId("tagged-p").textContent ?? "";
    expect(chip).toMatch(/output is not defined/);
    expect(chip).toMatch(/derived from §11\.9/);
    expect(chip).not.toMatch(/prints|\(undefined\)|§21\.2\.1\.6/);
    const status = screen.getByTestId("tagged-status").textContent ?? "";
    expect(status).toMatch(/%p output is not defined: the variable was never assigned, so its value, tag bits included, is undefined \(derived from §11\.9\)\./);
    expect(status).not.toMatch(/%p prints/);
  });

  it("a void member's bare tag is labelled derived, and only a packed union carries the tools caveat", () => {
    render(<PackedLayoutExplorer mode="tagged" />);
    fireEvent.click(screen.getByRole("button", { name: "v = tagged Invalid;" }));
    fireEvent.click(screen.getByRole("button", { name: '$display("%p", v);' }));
    expect(screen.getByTestId("tagged-p").textContent).toMatch(/prints Invalid \(derived: §21\.2\.1\.6 gives tag:value, and a void member has no value, §7\.3\.2\)/);
    expect(screen.getByTestId("tagged-p").querySelector("details")).toBeNull();
    fireEvent.click(screen.getByTestId("tagged-packed"));
    expect(screen.getByTestId("tagged-p").querySelector("details")).not.toBeNull();
  });
});

describe("PackedLayoutExplorer: mutation checks say what they test", () => {
  it("a disclosure above the matrix lists every check's expression, and the selected cell repeats it", () => {
    render(<PackedLayoutExplorer mode="mutation" />);
    const box = screen.getByTestId("mutation-checks");
    expect(box).not.toHaveAttribute("open");
    expect(within(box).getAllByRole("listitem")).toHaveLength(11);
    expect(box.textContent).toMatch(/no name: never_set\.name\(\) == ""/);
    expect(box.textContent).toMatch(/byte 3: u\.bytes\[3\] === 8'h1A/);
    expect(box.compareDocumentPosition(screen.getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutation-skip"));
    expect(screen.getByTestId("mutation-selected").textContent).toMatch(/^layout \(c === 32'h2123_BEEF\) against Reverse addr and data:/);
  });
});

describe("PackedLayoutExplorer: finding the suspect stays found", () => {
  it("reading another line keeps the fix section, the rerun log and the verdict", () => {
    render(<PackedLayoutExplorer mode="debug" />);
    lockIn("The members are declared in the wrong order: the first member is the MSB end");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 2:/ }));
    pickFix("Reorder the members");
    fireEvent.click(screen.getByTestId("clinic-rerun"));
    const verdict = screen.getByTestId("clinic-verdict").textContent;
    expect(verdict).toMatch(/Fixed\./);
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 3:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✕ addr is 12 bits/);
    expect(screen.getByTestId("clinic-fix")).toBeInTheDocument();
    expect(screen.getByTestId("clinic-verdict").textContent).toBe(verdict);
    expect(screen.queryByRole("button", { name: "Show the suspect" })).not.toBeInTheDocument();
    // A reset really does start over.
    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    expect(screen.queryByTestId("clinic-fix")).not.toBeInTheDocument();
  });

  it("'Show the suspect' gives the reason and replaces the learner's wrong pick", () => {
    render(<PackedLayoutExplorer mode="debug" />);
    lockIn("The members are declared in the wrong order: the first member is the MSB end");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 3:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✕ addr is 12 bits/);
    fireEvent.click(screen.getByRole("button", { name: "Show the suspect" }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ This is it: the first member of a packed struct is the most significant/);
    expect(within(screen.getByTestId("clinic-lines")).queryByRole("button", { name: /^Line 3:.*not the suspect$/ })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 2:.*, the suspect$/ })).toBeInTheDocument();
  });

  it("swapped fields: op's line counts, as the other half of the order", () => {
    render(<PackedLayoutExplorer mode="debug" />);
    lockIn("The members are declared in the wrong order: the first member is the MSB end");
    fireEvent.click(within(screen.getByTestId("clinic-lines")).getByRole("button", { name: /^Line 4:/ }));
    expect(screen.getByTestId("clinic-line-feedback").textContent).toMatch(/^✓ Yes, this is the other half of the same ordering bug/);
    expect(screen.getByTestId("clinic-fix")).toBeInTheDocument();
  });
});
