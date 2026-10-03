import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FactoryOverrideVisualizer from "@/components/curriculum/interactives/FactoryOverrideVisualizer";

const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
const choose = (label: string) => fireEvent.click(screen.getByLabelText(label));

describe("FactoryOverrideVisualizer (prediction-first puzzles)", () => {
  it("gates the answer behind a prediction, then asks again after one change", () => {
    render(<FactoryOverrideVisualizer />);
    expect(screen.queryByLabelText(/create\(\) log for/)).not.toBeInTheDocument();

    // General override registered first wins over the specific one.
    choose("err_driver");
    lockIn();
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/Builds mock_driver\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Change one thing: Register the specific override first/ }));
    expect(screen.queryByLabelText(/create\(\) log for/)).not.toBeInTheDocument();
    choose("err_driver");
    lockIn();
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });

  it("instance overrides beat a type override registered earlier", () => {
    render(<FactoryOverrideVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Instance vs type" }));
    choose("err_driver");
    lockIn();
    expect(screen.getAllByText(/checked before type overrides/).length).toBeGreaterThan(0);
  });

  it("missing registration macro: TYPDUP warning and no change", () => {
    render(<FactoryOverrideVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Missing macro" }));
    choose("quiet_driver");
    lockIn();
    expect(screen.getAllByText(/TYPDUP/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Builds base_driver\./)).toBeInTheDocument();
  });

  it("an object created without a context is not reached by a path-based instance override", () => {
    render(<FactoryOverrideVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Object without context" }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/Builds my_txn\./)).toBeInTheDocument();
    expect(screen.getByLabelText("create() log for uvm_test_top.env.agt0.mon.tr")).toHaveTextContent('full path "tr"');
  });

  it("scenario picker works from the keyboard", () => {
    render(<FactoryOverrideVisualizer />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "General vs specific" }), { key: "End" });
    expect(screen.getByRole("radio", { name: "Object without context" })).toHaveAttribute("aria-checked", "true");
  });
});
