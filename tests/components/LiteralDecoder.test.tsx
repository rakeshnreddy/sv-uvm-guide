import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LiteralDecoder, { LITERAL_ASSUMPTIONS } from "@/components/visuals/LiteralDecoder";
import { LITERAL_PRESETS, decodeLiteral, literalPredictionOptions, predictionQuestion, syntaxErrorCards, type LiteralDecode } from "@/lib/sv-literal-model";

const decoded = (text: string, target: Parameters<typeof decodeLiteral>[1]) => decodeLiteral(text, target) as LiteralDecode;
const optionsOf = (text: string, target: Parameters<typeof decodeLiteral>[1]) => literalPredictionOptions(decoded(text, target));

const lockIn = (label: string) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));

describe("LiteralDecoder", () => {
  it("renders inside the visual frame with an accessible name and the model's limits", () => {
    render(<LiteralDecoder />);
    expect(screen.getByRole("region", { name: "Literal decoder: how a literal becomes bits" })).toBeInTheDocument();
    expect(screen.getByText(LITERAL_ASSUMPTIONS[1])).toBeInTheDocument();
  });

  it("hides the steps and the answer until the learner commits a prediction", () => {
    render(<LiteralDecoder preset="hex-ff" />);
    expect(screen.getByText(predictionQuestion("8'hFF", "logic16"))).toBeInTheDocument();
    expect(screen.queryByTestId("literal-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(/zero-extended/)).not.toBeInTheDocument();
    // Every option is a strip the model computed; the code shows only the literal and the target.
    for (const o of optionsOf("8'hFF", "logic16")) expect(screen.getByRole("radio", { name: o.label })).toBeInTheDocument();
    expect(screen.getByTestId("literal-code")).toHaveTextContent("logic [15:0] v; v = 8'hFF;");
  });

  it("explains a wrong strip with its misconception, then reveals the steps", () => {
    render(<LiteralDecoder preset="hex-ff" />);
    const wrong = optionsOf("8'hFF", "logic16").find((o) => o.id === "based-signed");
    expect(wrong).toBeDefined();
    lockIn(wrong!.label);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(wrong!.feedback)).toBeInTheDocument();
    expect(screen.getByTestId("literal-reveal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step through the decoding" })).toHaveFocus();
  });

  it("confirms the right strip with the model's explanation", () => {
    render(<LiteralDecoder preset="decimal-1" />);
    const right = optionsOf("1", "logic16").find((o) => o.correct)!;
    lockIn(right.label);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(right.feedback)).toBeInTheDocument();
  });

  it("offers the lesson's misconceptions as strips: v = 1 sets every bit, 4'bx fills 16 bits, a based literal is signed", () => {
    expect(optionsOf("1", "logic16").map((o) => o.id)).toContain("every-bit");
    expect(optionsOf("4'bx", "logic16").map((o) => o.id)).toContain("every-bit");
    expect(optionsOf("8'hFF", "logic16").map((o) => o.id)).toContain("based-signed");
  });

  it("steps through with the buttons and the scrubber, announcing each step", () => {
    render(<LiteralDecoder preset="truncated-hex" />);
    skip();
    const d = decoded("4'hFF", "logic16");
    expect(screen.getByTestId("step-tokens")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByTestId("step-groups")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Parts of the literal" })).getAllByRole("listitem").map((li) => li.firstChild?.textContent)).toEqual(["4", "'", "none", "h", "FF"]);
    expect(screen.getByTestId("step-announcement")).toHaveTextContent(d.steps[0].text);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByTestId("step-size")).toHaveTextContent(d.steps[2].text);
    expect(screen.getByTestId("step-size")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("step-announcement")).toHaveTextContent(d.steps[2].text);
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.queryByTestId("step-size")).not.toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Step" });
    fireEvent.change(slider, { target: { value: String(d.steps.length - 1) } });
    expect(slider).toHaveAttribute("aria-valuetext", `Step ${d.steps.length} of ${d.steps.length}: ${d.steps[d.steps.length - 1].title}`);
    expect(screen.getByTestId("literal-summary")).toHaveTextContent(d.summary);
  });

  it("'Show every step' opens every step and the summary, and the bit strips describe the truncation", () => {
    render(<LiteralDecoder preset="truncated-hex" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    const d = decoded("4'hFF", "logic16");
    for (const s of d.steps) expect(screen.getByTestId(`step-${s.id}`)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Fit to the size: 8'b1111_1111.*bits 7 to 4 discarded/ })).toBeInTheDocument();
    expect(screen.getByText(/✕ = discarded/)).toBeInTheDocument();
  });

  it("changing the target re-arms the prediction and recomputes the options", () => {
    render(<LiteralDecoder preset="unsized-x" />);
    skip();
    expect(screen.getByTestId("literal-reveal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "logic [39:0] v" }));
    expect(screen.queryByTestId("literal-reveal")).not.toBeInTheDocument();
    expect(screen.getByText(predictionQuestion("'hx", "logic40"))).toBeInTheDocument();
    for (const o of optionsOf("'hx", "logic40")) expect(screen.getByRole("radio", { name: o.label })).toBeInTheDocument();
  });

  it("has one preset button per lesson use and loads each preset's own target", () => {
    render(<LiteralDecoder />);
    const group = screen.getByRole("radiogroup", { name: "Literal" });
    for (const p of LITERAL_PRESETS) expect(within(group).getByRole("radio", { name: p.label })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("radio", { name: "$display('1)" }));
    expect(screen.getByRole("radio", { name: "On its own ($display)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("literal-code")).toHaveTextContent(`$display("%b", '1);`);
  });

  it("keyboard: arrow keys move through the presets", () => {
    render(<LiteralDecoder preset="decimal-12" />);
    const group = screen.getByRole("radiogroup", { name: "Literal" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "12" }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "8'hFF" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "8'hFF" })).toHaveFocus();
  });

  it("decodes a typed literal, and reports an illegal one with its clause and a legal form", () => {
    render(<LiteralDecoder />);
    expect(screen.getByTestId("literal-error-announcement")).toBeEmptyDOMElement();
    const input = screen.getByLabelText("Type a literal");
    fireEvent.change(input, { target: { value: "8'o7z" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this literal" }));
    expect(screen.getByRole("radio", { name: "Yours: 8'o7z" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("literal-code")).toHaveTextContent("v = 8'o7z;");
    fireEvent.change(input, { target: { value: "8'd-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this literal" }));
    const err = screen.getByTestId("literal-error");
    expect(err).toHaveTextContent("Illegal syntax");
    expect(err).toHaveTextContent("§5.7.1");
    expect(err).toHaveTextContent("-8'd6");
    // The polite live region is mounted from the start, so the error is announced.
    expect(screen.getByTestId("literal-error-announcement")).toHaveTextContent("Illegal syntax (§5.7.1)");
    expect(screen.getByTestId("literal-error-announcement")).toHaveTextContent("-8'd6");
    expect(screen.getByTestId("literal-error-announcement")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
  });

  it("marks an input the standard allows with a neutral mark, not the danger cross", () => {
    render(<LiteralDecoder />);
    const input = screen.getByLabelText("Type a literal");
    fireEvent.change(input, { target: { value: "-8'd6" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this literal" }));
    const err = screen.getByTestId("literal-error");
    expect(err).toHaveTextContent("Not decoded here");
    expect(err).not.toHaveTextContent("✕");
    expect(err.querySelector("[data-illegal]")).toHaveAttribute("data-illegal", "false");
    fireEvent.change(input, { target: { value: "12g" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this literal" }));
    expect(screen.getByTestId("literal-error")).toHaveTextContent("✕");
    expect(screen.getByTestId("literal-error")).not.toHaveTextContent("Legal form");
  });

  it("§5.7.2: a real literal such as 23E10 gets the neutral mark and no hex 'Legal form'", () => {
    render(<LiteralDecoder />);
    const input = screen.getByLabelText("Type a literal");
    fireEvent.change(input, { target: { value: "23E10" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode this literal" }));
    const err = screen.getByTestId("literal-error");
    expect(err).toHaveTextContent("Not decoded here");
    expect(err).toHaveTextContent("§5.7.2");
    expect(err).not.toHaveTextContent("✕");
    expect(err).not.toHaveTextContent("Legal form");
    expect(err).not.toHaveTextContent("'h23E10");
  });

  it("with nothing to predict, changing the target shows the steps without moving the focus", () => {
    expect(optionsOf("8'hFF", "self").length).toBeLessThan(2);
    render(<LiteralDecoder preset="hex-ff" />);
    const self = screen.getByRole("radio", { name: "On its own ($display)" });
    self.focus();
    fireEvent.click(self);
    expect(screen.getByTestId("literal-reveal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step through the decoding" })).not.toHaveFocus();
    expect(screen.getByRole("radio", { name: "On its own ($display)" })).toHaveFocus();
  });

  it("shows the two syntax-error cards only when opened, with the model's explanation", () => {
    render(<LiteralDecoder />);
    const cards = syntaxErrorCards();
    for (const c of cards) {
      expect(screen.queryByTestId(`syntax-card-${c.id}`)).not.toBeInTheDocument();
      const button = screen.getByRole("button", { name: `Show why for ${c.code}` });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(screen.getByRole("button", { name: `Hide why for ${c.code}` })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId(`syntax-card-${c.id}`)).toHaveTextContent(c.error.message);
    }
  });

  it("can hide the input and the syntax cards, and limit the presets", () => {
    render(<LiteralDecoder preset="fill-ones" presets={["fill-ones", "decimal-1"]} allowInput={false} showSyntaxErrors={false} />);
    expect(screen.queryByLabelText("Type a literal")).not.toBeInTheDocument();
    expect(screen.queryByText("Two classic syntax errors")).not.toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Literal" })).getAllByRole("radio")).toHaveLength(2);
  });

  it("the target prop overrides the preset's target", () => {
    render(<LiteralDecoder preset="binary-10x1" target="bit16" />);
    expect(screen.getByRole("radio", { name: "bit [15:0] v" })).toHaveAttribute("aria-checked", "true");
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Show every step" }));
    expect(screen.getByTestId("step-two-state")).toHaveTextContent("§6.11.2");
    expect(screen.getByTestId("literal-summary")).toHaveTextContent(decoded("4'b10x1", "bit16").summary);
  });
});
