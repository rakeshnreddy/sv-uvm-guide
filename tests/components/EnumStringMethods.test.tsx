import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EnumMethodVisualizer from "@/components/visuals/EnumMethodVisualizer";
import StringMethodExplorer from "@/components/visuals/StringMethodExplorer";

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
