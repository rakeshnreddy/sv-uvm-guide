import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SystemVerilogDataTypesAnimation from "@/components/animations/SystemVerilogDataTypesAnimation";

describe("SystemVerilogDataTypesAnimation: dynamic array section (§7.5)", () => {
  it("offers new[], new[](arr) and delete(), never push/pop", () => {
    render(<SystemVerilogDataTypesAnimation />);
    expect(screen.queryByRole("button", { name: /^Push$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pop$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "arr = new[3]" })).toBeInTheDocument();
  });

  it("§7.5.1: new[3] fills int elements with 0 and new[N](arr) keeps them", () => {
    render(<SystemVerilogDataTypesAnimation />);
    fireEvent.click(screen.getByRole("button", { name: "arr = new[3]" }));
    expect(screen.getAllByLabelText(/^arr\[\d\] = 0$/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "arr[0] = v" }));
    const first = screen.getByLabelText(/^arr\[0\] = /).getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: "arr = new[5](arr)" }));
    expect(screen.getAllByLabelText(/^arr\[\d\] = /)).toHaveLength(5);
    expect(screen.getByLabelText(/^arr\[0\] = /).getAttribute("aria-label")).toBe(first);
    expect(screen.getByText(/pads the other 2 with the default 0/)).toBeInTheDocument();
  });
});
