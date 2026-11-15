import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DataTypeComparisonChart, {
  BAR_CLASS,
  DEFAULTS_DRILL_IDS,
  INNER_OUTLINE_INSET,
  SIGNED_BY_DEFAULT,
  UNSIGNED_BY_DEFAULT,
  WIDTH_CHART_LAYOUT,
  WIDTH_CHART_ROWS,
  drillsForSection,
} from "@/components/charts/DataTypeComparisonChart";
import { DATA_TYPE_ROWS } from "@/lib/sv-data-type-model";
import { INTEGRAL_TYPES } from "@/lib/sv-four-state-model";

const rowFor = (declaration: string) => screen.getByRole("rowheader", { name: declaration }).closest("tr") as HTMLElement;

const commit = (declaration: string, option: string) => {
  fireEvent.click(screen.getByRole("radio", { name: declaration }));
  fireEvent.click(screen.getByLabelText(option));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

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

  it("the default section keeps all seven drills, the writer rules and the §6.11.2 note", () => {
    expect(drillsForSection("all").map((d) => d.id)).toEqual([
      "int-default",
      "logic-default",
      "integer-default",
      "wire-undriven",
      "byte-signed",
      "bit-unsigned",
      "four-to-two",
    ]);
    render(<DataTypeComparisonChart />);
    const group = screen.getByRole("radiogroup", { name: "Declaration to test" });
    expect(within(group).getAllByRole("radio")).toHaveLength(7);
    expect(within(group).getByRole("radio", { name: /wire \[3:0\] w;/ })).toBeInTheDocument();
    expect(screen.getByText(/turns every x and z bit into 0 \(§6\.11\.2\), silently/)).toBeInTheDocument();
  });

  it("reveals the value on a neutral surface, not the emerald match colour, even after a wrong guess", () => {
    render(<DataTypeComparisonChart />);
    commit("int count;", "32'hxxxxxxxx");
    const reveal = screen.getByTestId("drill-reveal");
    expect(reveal.className).not.toMatch(/emerald/);
    expect(reveal.className).toMatch(/bg-card/);
    expect(reveal.querySelector("strong")).toBeNull();
  });

  it("reserves room after the longest bar for its value label", () => {
    const { W, labelW, labelGap, barMax, labelRoom, fontSize } = WIDTH_CHART_LAYOUT;
    expect(labelW + barMax + labelRoom).toBe(W);
    render(<DataTypeComparisonChart />);
    const values = screen.getAllByTestId("width-chart-value");
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      // About 0.6 em per character is a safe upper bound for Plex Sans.
      const estimatedWidth = (value.textContent ?? "").length * fontSize * 0.6;
      expect(Number(value.getAttribute("x")) + estimatedWidth, value.textContent ?? "").toBeLessThanOrEqual(W);
    }
    expect(labelGap).toBeGreaterThan(0);
  });

  it("never renders chart text below 12 px at the narrowest width the SVG allows", () => {
    const { W, fontSize, minRenderWidth } = WIDTH_CHART_LAYOUT;
    expect((fontSize * minRenderWidth) / W).toBeGreaterThanOrEqual(12);
    // A 390 px phone leaves about 334 px inside the frame, so the chart fits without sideways scroll.
    expect(minRenderWidth).toBeLessThanOrEqual(334);
  });

  it("marks 4-state bars with a neutral double outline and a 4-state tag, not the rose X hatching", () => {
    const { container } = render(<DataTypeComparisonChart />);
    const svg = screen.getByRole("img", { name: /^Bits per value:/ });
    expect(container.innerHTML).not.toMatch(/rose-/);
    expect(svg.querySelector("pattern")).toBeNull();
    for (const row of WIDTH_CHART_ROWS) {
      const bar = within(svg).getByTestId(`width-bar-${row.id}`);
      const outlines = bar.querySelectorAll('[data-testid="width-bar-inner-outline"]').length;
      expect(outlines, row.id).toBe(row.states === 4 ? 1 : 0);
      if (row.states === 4) expect(bar.textContent).toContain("4-state");
    }
    expect(screen.getByText(/Double outline = 4-state/)).toBeInTheDocument();
    expect(within(rowFor("integer n;")).getByText("4-state").className).toMatch(/border-double/);
  });

  it("keeps the 2-state and real encodings neutral and distinct, and every 4-state chip double-outlined", () => {
    const { container } = render(<DataTypeComparisonChart />);
    expect(container.innerHTML).not.toMatch(/indigo-/);
    const svg = screen.getByRole("img", { name: /^Bits per value:/ });
    for (const row of WIDTH_CHART_ROWS) {
      const outer = within(svg).getByTestId(`width-bar-${row.id}`).querySelector("rect") as SVGRectElement;
      const expected = row.states === 4 ? BAR_CLASS.four : row.states === 2 ? BAR_CLASS.two : BAR_CLASS.other;
      expect(outer.getAttribute("class"), row.id).toBe(expected);
    }
    expect(new Set(Object.values(BAR_CLASS)).size).toBe(3);
    for (const row of DATA_TYPE_ROWS) {
      const chip = within(rowFor(row.example)).getByText(row.states === null ? "—" : `${row.states}-state`, { selector: "span" });
      if (row.states === 4) expect(chip.className, row.id).toMatch(/border-double/);
      else expect(chip.className, row.id).not.toMatch(/border-double/);
    }
    expect(screen.getByText(/bit, logic and reg take their width from the declared range, so they have no bar/)).toBeInTheDocument();
  });

  describe("section='defaults'", () => {
    it("Table 6-7 and §6.11.3: offers only the int, logic, integer and byte vs bit drills", () => {
      expect(drillsForSection("defaults").map((d) => d.id)).toEqual([...DEFAULTS_DRILL_IDS]);
      render(<DataTypeComparisonChart section="defaults" />);
      const group = screen.getByRole("radiogroup", { name: "Declaration to test" });
      expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual([
        "int count;",
        "logic [3:0] v;",
        "integer n;",
        "byte b = 8'hFF;",
        "bit [7:0] u = 8'hFF;",
      ]);
      expect(within(group).queryByRole("radio", { name: /wire/ })).not.toBeInTheDocument();
      expect(within(group).queryByRole("radio", { name: /4'b1x0z/ })).not.toBeInTheDocument();
    });

    it("shows nothing that answers a drill before the reveal: no table, no width chart", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      expect(screen.getByRole("region", { name: "Starting values and signedness" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /^Bits per value:/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Who may write it/)).not.toBeInTheDocument();
      expect(screen.queryByText("Value:")).not.toBeInTheDocument();
    });

    it("Table 6-7: a 4-state logic [3:0] starts at x, revealed only after the prediction is locked in", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      fireEvent.click(screen.getByRole("radio", { name: "logic [3:0] v;" }));
      expect(screen.queryByText("Value:")).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("4'b0000"));
      fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
      expect(screen.getByText(/Not quite/)).toBeInTheDocument();
      expect(screen.getByText("Value:")).toBeInTheDocument();
      expect(screen.getByText("Value:").closest("p")).toHaveTextContent("Value: 4'bxxxx.");
    });

    it("Table 6-7: int starts at 0, integer starts at x", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      commit("int count;", "32'h00000000");
      expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
      expect(screen.getByTestId("drill-reveal")).toHaveTextContent("Value: 32'h00000000.");
      commit("integer n;", "32'h00000000");
      expect(screen.getByText(/Not quite/)).toBeInTheDocument();
      expect(screen.getByTestId("drill-reveal")).toHaveTextContent("Value: 32'hxxxxxxxx.");
    });

    it("§6.11.3: byte is signed, so 8'hFF prints -1; predicting -1 for bit [7:0] is diagnosed", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      commit("byte b = 8'hFF;", "-1");
      expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
      expect(screen.getByTestId("drill-reveal")).toHaveTextContent("Value: -1.");
      commit("bit [7:0] u = 8'hFF;", "-1");
      expect(screen.getByText(/Not quite/)).toBeInTheDocument();
      expect(screen.getByTestId("drill-reveal")).toHaveTextContent("Value: 255.");
    });

    it("states that the leading minus sign of %d is simulator behaviour, not LRM text", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      expect(screen.getAllByText(/Table 21-1 defines %d only as display in decimal format/).length).toBeGreaterThan(0);
    });

    it("§6.11.3: bit [7:0] is unsigned, so 8'hFF prints 255", () => {
      render(<DataTypeComparisonChart section="defaults" />);
      fireEvent.click(screen.getByRole("radio", { name: "bit [7:0] u = 8'hFF;" }));
      fireEvent.click(screen.getByLabelText("255"));
      fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
      expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    });
  });

  describe("section='widths'", () => {
    it("Table 6-8: renders only the to-scale bars and the table, with no drills", () => {
      render(<DataTypeComparisonChart section="widths" />);
      expect(screen.getByRole("region", { name: "Data type widths and signedness" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /^Bits per value:/ })).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByRole("radiogroup", { name: "Declaration to test" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Predict the value/)).not.toBeInTheDocument();
    });

    it("Table 6-8 and §20.5: draws exactly the fixed-width types, with real at 64 bits", () => {
      expect(WIDTH_CHART_ROWS.map((r) => [r.id, r.width])).toEqual([
        ["byte", 8],
        ["shortint", 16],
        ["int", 32],
        ["longint", 64],
        ["integer", 32],
        ["time", 64],
        ["real", 64],
      ]);
      render(<DataTypeComparisonChart section="widths" />);
      expect(screen.getAllByText(/\$realtobits returns \(§20\.5\)/).length).toBeGreaterThan(0);
    });

    it("starts the integer bar's inner outline after its sign cell, so the cell never hides it", () => {
      render(<DataTypeComparisonChart section="widths" />);
      const { labelW, barMax } = WIDTH_CHART_LAYOUT;
      const bar = screen.getByTestId("width-bar-integer");
      const sign = bar.querySelector('[data-testid="width-bar-sign-bit"]') as SVGRectElement;
      const inner = bar.querySelector('[data-testid="width-bar-inner-outline"]') as SVGRectElement;
      expect(Number(inner.getAttribute("x"))).toBeGreaterThan(Number(sign.getAttribute("x")) + Number(sign.getAttribute("width")));
      expect(Number(inner.getAttribute("x")) + Number(inner.getAttribute("width"))).toBeCloseTo(labelW + (32 / 64) * barMax - INNER_OUTLINE_INSET);
      // About 2 px between the two lines at the 320 px minimum render width.
      expect(((INNER_OUTLINE_INSET - 1) * WIDTH_CHART_LAYOUT.minRenderWidth) / WIDTH_CHART_LAYOUT.W).toBeGreaterThanOrEqual(2);
    });

    it("Table 6-8: bar lengths are proportional to the width in bits", () => {
      render(<DataTypeComparisonChart section="widths" />);
      const { barMax } = WIDTH_CHART_LAYOUT;
      for (const row of WIDTH_CHART_ROWS) {
        const outer = screen.getByTestId(`width-bar-${row.id}`).querySelector("rect") as SVGRectElement;
        expect(Number(outer.getAttribute("width")), row.id).toBeCloseTo(((row.width as number) / 64) * barMax);
      }
    });

    it("§6.11.3: byte, shortint, int, longint and integer get a one-bit sign cell; time does not", () => {
      expect(SIGNED_BY_DEFAULT).toEqual(["byte", "shortint", "int", "longint", "integer"]);
      expect(UNSIGNED_BY_DEFAULT).toEqual(["bit", "logic", "reg", "time"]);
      for (const id of [...SIGNED_BY_DEFAULT, ...UNSIGNED_BY_DEFAULT]) {
        expect(INTEGRAL_TYPES[id as keyof typeof INTEGRAL_TYPES].signed, id).toBe(SIGNED_BY_DEFAULT.includes(id));
      }
      render(<DataTypeComparisonChart section="widths" />);
      const { barMax } = WIDTH_CHART_LAYOUT;
      for (const row of WIDTH_CHART_ROWS) {
        const sign = screen.getByTestId(`width-bar-${row.id}`).querySelector('[data-testid="width-bar-sign-bit"]');
        if (row.signed === true) expect(Number(sign?.getAttribute("width")), row.id).toBeCloseTo(barMax / 64);
        else expect(sign, row.id).toBeNull();
      }
      const svg = screen.getByRole("img", { name: /^Bits per value:/ });
      expect(svg).toHaveAttribute("aria-label", expect.stringContaining("byte 8, 2-state, signed"));
      expect(svg).toHaveAttribute("aria-label", expect.stringContaining("time 64, 4-state, unsigned"));
      expect(screen.getByText(/byte, shortint, int, longint and integer are signed by default; bit, logic, reg and time are unsigned \(§6\.11\.3, Table 6-8\)/)).toBeInTheDocument();
    });

    it("the default section draws no sign cells, so the practice page keeps its look", () => {
      render(<DataTypeComparisonChart />);
      expect(screen.queryAllByTestId("width-bar-sign-bit")).toHaveLength(0);
    });
  });
});
