import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PolymorphismDispatchVisualizer from "@/components/visuals/PolymorphismDispatchVisualizer";

const lockIn = (answer: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const pick = (group: string, option: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name: option }));
const activeLine = () => document.querySelector('[aria-current="step"]')?.textContent ?? "";

describe("PolymorphismDispatchVisualizer: dispatch", () => {
  it("hides the binding until a prediction is locked in, then highlights the body that runs", () => {
    render(<PolymorphismDispatchVisualizer section="dispatch" />);
    expect(screen.queryByText(/The call binds to/)).not.toBeInTheDocument();
    expect(activeLine()).toBe("");

    lockIn(/^bad_crc_txn::describe\(\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/dynamic: object's class/)).toBeInTheDocument();
    expect(screen.getByLabelText("Output")).toHaveTextContent("I am a bad_crc_txn");
    expect(activeLine()).toMatch(/function void describe\(\);.*still virtual/);
  });

  it("without virtual, the handle type decides; changing the code re-asks the question", () => {
    render(<PolymorphismDispatchVisualizer section="dispatch" />);
    lockIn(/^bad_crc_txn::describe\(\)/);
    pick("Where describe() is first declared virtual", "never virtual");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.queryByText(/The call binds to/)).not.toBeInTheDocument();

    lockIn(/^bad_crc_txn::describe\(\)/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getAllByText(/That needs virtual dispatch/).length).toBeGreaterThan(0);
    expect(screen.getByText(/static: handle's class/)).toBeInTheDocument();
    expect(screen.getByLabelText("Output")).toHaveTextContent("I am a base_txn");
  });

  it("runs the super.print() chain base-first", () => {
    render(<PolymorphismDispatchVisualizer section="dispatch" />);
    pick("Method call", "h.print()");
    lockIn(/^addr=0x10 → crc=0x5a → \(crc deliberately wrong\)/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Output")).toHaveTextContent("addr=0x10crc=0x5a(crc deliberately wrong)");
  });

  it("rejects a subclass-only method through a base handle at compile time", () => {
    render(<PolymorphismDispatchVisualizer section="dispatch" />);
    pick("Method call", "h.corrupt()");
    lockIn(/^Compile error/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/base_txn has no method corrupt\(\)/).length).toBeGreaterThan(0);
  });

  it("is keyboard operable through the radio groups", () => {
    render(<PolymorphismDispatchVisualizer section="dispatch" />);
    const group = screen.getByRole("radiogroup", { name: "Handle type" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "base_txn" }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: "crc_txn" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Generated code").closest("figure")).toHaveTextContent("crc_txn h;");
  });
});

describe("PolymorphismDispatchVisualizer: $cast", () => {
  it("distinguishes the function form, the task form and plain assignment", () => {
    render(<PolymorphismDispatchVisualizer section="cast" />);
    expect(screen.getByText(/downcast: superclass → subclass/)).toBeInTheDocument();

    lockIn(/^dst now refers to the object/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/The run-time check fails: a crc_txn object is not a bad_crc_txn\./)).toBeInTheDocument();
    expect(screen.getByText(/\$cast returned 0; dst stays null/)).toBeInTheDocument();

    pick("Assignment form", "$cast(dst, src);");
    lockIn(/^No assignment; run-time error/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    pick("Assignment form", "dst = src;");
    lockIn(/^Compile error/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("succeeds when the object is a subclass of the destination, and upcasts need no cast", () => {
    render(<PolymorphismDispatchVisualizer section="cast" />);
    pick("Object type", "bad_crc_txn");
    lockIn(/^dst now refers to the object/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/\$cast returned 1/)).toBeInTheDocument();

    pick("Destination type", "base_txn");
    pick("Assignment form", "dst = src;");
    expect(screen.getByText(/same class/)).toBeInTheDocument();
    pick("Source handle type", "bad_crc_txn");
    expect(screen.getByText(/upcast: subclass → superclass/)).toBeInTheDocument();
    lockIn(/^dst now refers to the object/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("disables object classes the source variable cannot hold", () => {
    render(<PolymorphismDispatchVisualizer section="cast" />);
    pick("Source handle type", "crc_txn");
    expect(within(screen.getByRole("radiogroup", { name: "Object type" })).getByRole("radio", { name: "base_txn" })).toBeDisabled();
  });
});
