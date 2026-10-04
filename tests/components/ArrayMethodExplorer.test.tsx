import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ArrayMethodExplorer from "@/components/visuals/ArrayMethodExplorer";

const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("ArrayMethodExplorer", () => {
  it("§7.12.3: hides the sum until predicted, then shows that bit [7:0] sum() wraps 372 → 116", () => {
    render(<ArrayMethodExplorer />);
    expect(screen.queryByTestId("array-method-result")).not.toBeInTheDocument();
    lockIn(/^372$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByTestId("array-method-result").textContent).toBe("116");
    expect(screen.getByText(/Overflow, silently/)).toBeInTheDocument();
  });

  it("§7.12.3: with (int'(item)) gives the with-expression type and the exact sum", () => {
    render(<ArrayMethodExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "with (int'(item))" }));
    lockIn(/^372$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("int (type of the with expression)")).toBeInTheDocument();
  });

  it("§7.12.1: max() returns a queue, and the scalar answer is diagnosed", () => {
    render(<ArrayMethodExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: /Locate/ }));
    fireEvent.click(screen.getByRole("radio", { name: "max()" }));
    lockIn(/^The scalar 200$/);
    expect(screen.getByText(/Every locator method returns a queue/)).toBeInTheDocument();
    expect(screen.getByTestId("array-method-result").textContent).toBe("'{200}");
    expect(screen.getByText("queue of bit [7:0]")).toBeInTheDocument();
  });

  it("§7.12.2: sort() on an associative array is a compile error", () => {
    render(<ArrayMethodExplorer />);
    fireEvent.click(screen.getByRole("radio", { name: "data[string]" }));
    fireEvent.click(screen.getByRole("radio", { name: /Reorder/ }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    // Shown as the correct prediction option and as the ✕ error chip with its clause.
    expect(screen.getAllByText(/sort\(\) is not allowed on an associative array/)).toHaveLength(2);
    expect(screen.getByText("§7.12.2")).toBeInTheDocument();
  });

  it("keyboard: arrow keys move through methods and reset the prediction", () => {
    render(<ArrayMethodExplorer />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByTestId("array-method-result")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("radio", { name: "sum()" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "product()" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("array-method-result")).not.toBeInTheDocument();
  });
});
