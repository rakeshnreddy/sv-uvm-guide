import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SystemVerilogDataTypesAnimation from "@/components/animations/SystemVerilogDataTypesAnimation";

describe("SystemVerilogDataTypesAnimation: dynamic array section (§7.5)", () => {
  it("offers new[], new[](arr) and delete(), never push/pop", () => {
    render(<SystemVerilogDataTypesAnimation />);
    const dyn = within(screen.getByRole("region", { name: "Dynamic array" }));
    expect(dyn.queryByRole("button", { name: /push/ })).not.toBeInTheDocument();
    expect(dyn.queryByRole("button", { name: /pop/ })).not.toBeInTheDocument();
    expect(dyn.getByRole("button", { name: "arr = new[3]" })).toBeInTheDocument();
  });

  it("§7.5.1: new[3] fills int elements with 0 and new[N](arr) keeps them", () => {
    render(<SystemVerilogDataTypesAnimation />);
    fireEvent.click(screen.getByRole("button", { name: "arr = new[3]" }));
    expect(screen.getAllByLabelText(/^arr\[\d\] = 0$/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "arr[0] = v" }));
    const first = screen.getByLabelText(/^arr\[0\] = /).getAttribute("aria-label");
    expect(first).not.toBe("arr[0] = 0");
    fireEvent.click(screen.getByRole("button", { name: "arr = new[5](arr)" }));
    expect(screen.getAllByLabelText(/^arr\[\d\] = /)).toHaveLength(5);
    expect(screen.getByLabelText(/^arr\[0\] = /).getAttribute("aria-label")).toBe(first);
    expect(screen.getByText(/pads the other 2 with the default 0/)).toBeInTheDocument();
  });
});

describe("SystemVerilogDataTypesAnimation: rules from the models", () => {
  it("has no autoplay demo and no fabricated performance chart", () => {
    render(<SystemVerilogDataTypesAnimation />);
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(screen.queryByText("Performance")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Memory comparison|Speed comparison/)).not.toBeInTheDocument();
  });

  it("an unpacked logic array starts at x, not 0 (Table 6-7)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    expect(screen.getAllByLabelText(/^mem\[\d\] = x$/)).toHaveLength(3);
  });

  it("& follows the 4-state table: 0 controls, otherwise x/z give x (§11.4.8)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    expect(screen.getByLabelText("a & b = x")).toBeInTheDocument(); // 1 & x
    fireEvent.click(screen.getByRole("button", { name: "Cycle input a" })); // a: 1 → x
    fireEvent.click(screen.getByRole("button", { name: "Cycle input a" })); // a: x → z
    fireEvent.click(screen.getByRole("button", { name: "Cycle input a" })); // a: z → 0
    expect(screen.getByLabelText("a = 0")).toBeInTheDocument();
    expect(screen.getByLabelText("a & b = 0")).toBeInTheDocument();
  });

  it("4-state → 2-state conversion turns x into 0 (§6.11.2)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    expect(screen.getByLabelText("logic source = x")).toBeInTheDocument();
    expect(screen.getByLabelText("bit result = 0")).toBeInTheDocument();
  });

  it("a hard packed union shows equal-size members sharing the same bits (§7.3.1)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    fireEvent.click(screen.getByRole("radio", { name: "packed union" }));
    expect(screen.getByText(/every member to be the same size/)).toBeInTheDocument();
    expect(screen.getByText("typedef union packed { logic [7:0] a; logic [7:0] b; } u_t;")).toBeInTheDocument();
  });

  it("associative array: entries in lexicographic key order, and a key holding 0 can be deleted (§7.8.2, §7.9.2)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    const key = screen.getByLabelText("Key");
    const value = screen.getByLabelText("Value");
    for (const [k, v] of [["b", "5"], ["a", "0"]]) {
      fireEvent.change(key, { target: { value: k } });
      fireEvent.change(value, { target: { value: v } });
      fireEvent.click(screen.getByRole("button", { name: "Set" }));
    }
    const entries = within(screen.getByRole("list", { name: "Entries in index order" })).getAllByRole("listitem");
    expect(entries.map((e) => e.textContent)).toEqual(['"a":0', '"b":5']);
    fireEvent.change(key, { target: { value: "a" } });
    const del = screen.getByRole("button", { name: "Delete" });
    expect(del).toBeEnabled();
    fireEvent.click(del);
    expect(within(screen.getByRole("list", { name: "Entries in index order" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("queue pops on an empty queue return the default instead of blocking (§7.10.2.4)", () => {
    render(<SystemVerilogDataTypesAnimation />);
    fireEvent.click(screen.getByRole("button", { name: "pop_front" }));
    expect(screen.getByText(/The queue is empty: pop_front\(\) returns/)).toBeInTheDocument();
  });
});
