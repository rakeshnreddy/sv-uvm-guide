import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DataTypeComparisonChart from "@/components/charts/DataTypeComparisonChart";

const rowFor = (declaration: string) => screen.getByRole("rowheader", { name: declaration }).closest("tr") as HTMLElement;

describe("DataTypeComparisonChart", () => {
  it("states the IEEE 1800-2023 facts per type: states, width, sign, default", () => {
    render(<DataTypeComparisonChart />);
    const int = within(rowFor("int i;"));
    expect(int.getByText("2-state")).toBeInTheDocument();
    expect(int.getByText("32")).toBeInTheDocument();
    expect(int.getByText("signed")).toBeInTheDocument();
    expect(int.getByText(/'0/)).toBeInTheDocument();

    const integer = within(rowFor("integer n;"));
    expect(integer.getByText("4-state")).toBeInTheDocument();
    expect(integer.getByText(/'x/)).toBeInTheDocument();

    const time = within(rowFor("time t;"));
    expect(time.getByText("64")).toBeInTheDocument();
    expect(time.getByText("unsigned")).toBeInTheDocument();

    const wire = within(rowFor("wire [7:0] w;"));
    expect(wire.getByText("net")).toBeInTheDocument();
    expect(wire.getByText(/'z/)).toBeInTheDocument();

    expect(within(rowFor("byte c;")).getByText("signed")).toBeInTheDocument();
    expect(within(rowFor("bit [7:0] b;")).getByText("unsigned")).toBeInTheDocument();
  });

  it("no longer claims a logic variable is limited to a single driver", () => {
    render(<DataTypeComparisonChart />);
    expect(screen.queryByText(/Single driver enforced/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Several procedural writers \(last write wins\), or exactly one continuous assignment/)).toBeInTheDocument();
  });

  it("draws an accessible width chart (bars to scale) inside the chart test id", () => {
    render(<DataTypeComparisonChart />);
    const chart = screen.getByTestId("data-type-chart");
    const svg = within(chart).getByRole("img", { name: /^Bits per value:/ });
    expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
    expect(svg).toHaveAttribute("aria-label", expect.stringContaining("byte 8, 2-state"));
    expect(svg).toHaveAttribute("aria-label", expect.stringContaining("integer 32, 4-state"));
  });

  it("hides the value until a prediction is committed and diagnoses 'int starts at x'", () => {
    render(<DataTypeComparisonChart />);
    expect(screen.queryByText(/^Value:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("32'hxxxxxxxx"));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/Only 4-state types \(logic, reg, integer, time\) start at x/).length).toBeGreaterThan(0);
    expect(screen.getByText("Value:")).toBeInTheDocument();
  });

  it("switches drills with the keyboard and resets the prediction; signed byte prints -1", () => {
    render(<DataTypeComparisonChart />);
    const group = screen.getByRole("radiogroup", { name: "Declaration to test" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "int count;" }), { key: "End" });
    expect(within(group).getByRole("radio", { name: "bit [3:0] n = 4'b1x0z;" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(group).getByRole("radio", { name: "byte b = 8'hFF;" }));
    expect(screen.queryByText("Value:")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("-1"));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
  });
});
