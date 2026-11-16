import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import InteractiveCostOfBugGraph from "@/components/curriculum/f1/InteractiveCostOfBugGraph";
import {
  COST_STAGES,
  costBarFraction,
  DELAY_EXCEPTION_QUALIFIER,
  DELAY_RANKING_NOTE,
  formatMultiplier,
} from "@/lib/bug-cost-model";

afterEach(() => cleanup());

function reveal() {
  fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
}

describe("InteractiveCostOfBugGraph: cost / delay toggle", () => {
  it("keeps the toggle and the delay classes hidden until the prediction is answered", () => {
    render(<InteractiveCostOfBugGraph />);
    expect(screen.queryByRole("radiogroup", { name: "Compare the stages by" })).not.toBeInTheDocument();
    for (const s of COST_STAGES) expect(screen.queryByText(s.delay as string)).not.toBeInTheDocument();
  });

  it("starts on the cost view, unchanged, with the toggle beside it", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    const group = screen.getByRole("radiogroup", { name: "Compare the stages by" });
    expect(within(group).getByRole("radio", { name: "Cost" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("img", { name: /Relative cost to fix a bug, log scale/ })).toBeInTheDocument();
    expect(screen.queryByTestId("delay-ranking-note")).not.toBeInTheDocument();
  });

  it("the delay view shows every stage's delay class from the model next to its bar, and the field exception", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    const list = screen.getByRole("list", { name: "Typical delay by discovery stage" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(COST_STAGES.length);
    COST_STAGES.forEach((s, i) => {
      expect(within(items[i]).getByText(s.label)).toBeInTheDocument();
      expect(within(items[i]).getByText(formatMultiplier(s.multiplier))).toBeInTheDocument();
      expect(screen.getByTestId(`delay-${s.id}`)).toHaveTextContent(s.delay as string);
    });
    expect(within(items[4]).getByText(/exception to the order/)).toBeInTheDocument();
    expect(screen.getByTestId("delay-field")).toHaveTextContent(DELAY_EXCEPTION_QUALIFIER);
    COST_STAGES.filter((s) => s.id !== "field").forEach((s) =>
      expect(screen.getByTestId(`delay-${s.id}`)).not.toHaveTextContent(DELAY_EXCEPTION_QUALIFIER),
    );
    expect(screen.getByTestId("delay-ranking-note")).toHaveTextContent(DELAY_RANKING_NOTE);
    expect(screen.queryByRole("img", { name: /Relative cost to fix a bug/ })).not.toBeInTheDocument();
  });

  it("is keyboard operable: arrow keys switch views, and the selected stage's delay is announced in the live panel", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    const cost = screen.getByRole("radio", { name: "Cost" });
    cost.focus();
    fireEvent.keyDown(cost, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Delay" })).toHaveAttribute("aria-checked", "true");

    fireEvent.change(screen.getByRole("slider", { name: "Where is the bug found?" }), { target: { value: "3" } });
    expect(screen.getByTestId("selected-delay")).toHaveTextContent("Weeks to months");
    const items = within(screen.getByRole("list", { name: "Typical delay by discovery stage" })).getAllByRole("listitem");
    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(items[1]).not.toHaveAttribute("aria-current");
    // The cost line still uses the model's ratio in the delay view.
    expect(screen.getByText(/×100 an RTL-simulation fix/)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Delay" }), { key: "ArrowLeft" });
    expect(screen.queryByTestId("selected-delay")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Selected: Post-silicon \(lab\)/ })).toBeInTheDocument();
  });

  it("leaves the anchor-cost control working in the delay view", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    fireEvent.click(screen.getByRole("radio", { name: "$10K" }));
    fireEvent.click(screen.getByRole("button", { name: /In the field/ }));
    expect(screen.getByText("$100M")).toBeInTheDocument();
    expect(screen.getByTestId("selected-delay")).toHaveTextContent(COST_STAGES[4].delay as string);
  });

  it("says before the list that bar length is cost, not delay", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    const caption = screen.getByTestId("delay-bar-caption");
    expect(caption).toHaveTextContent(/Bar length is the rule-of-thumb cost \(log scale\), not the delay/);
    const list = screen.getByRole("list", { name: "Typical delay by discovery stage" });
    expect(caption.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("both views draw the same log-scale bar lengths from costBarFraction", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    // Cost view: the SVG plot area is 200 - 26 - 26 = 148 units tall (the chart was made taller to fill its card; the lengths stay in proportion).
    for (const s of COST_STAGES) {
      expect(Number(screen.getByTestId(`cost-bar-${s.id}`).getAttribute("height"))).toBeCloseTo(costBarFraction(s) * 148, 6);
    }
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    for (const s of COST_STAGES) {
      expect(screen.getByTestId(`delay-bar-${s.id}`).style.width).toBe(`${costBarFraction(s) * 100}%`);
    }
  });

  it("keeps the active row's bar track visible against the row's raised surface", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    // Default stage is RTL simulation (index 1).
    expect(screen.getByTestId("delay-bar-track-rtl")).toHaveClass("bg-background");
    expect(screen.getByTestId("delay-bar-track-rtl")).not.toHaveClass("bg-muted");
    expect(screen.getByTestId("delay-bar-track-spec")).toHaveClass("bg-muted");
  });

  it("shows the field qualifier in the live panel when the field stage is selected", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
    fireEvent.click(screen.getByRole("button", { name: /In the field/ }));
    expect(screen.getByTestId("selected-delay")).toHaveTextContent(DELAY_EXCEPTION_QUALIFIER);
    fireEvent.click(screen.getByRole("button", { name: /RTL simulation/ }));
    expect(screen.getByTestId("selected-delay")).not.toHaveTextContent(DELAY_EXCEPTION_QUALIFIER);
  });

  it("shows a spec-review find as a tenth of an RTL-simulation fix", () => {
    render(<InteractiveCostOfBugGraph />);
    reveal();
    fireEvent.click(screen.getByRole("button", { name: /Spec review/ }));
    expect(screen.getByText(/about 1\/10 of an RTL-simulation fix/)).toBeInTheDocument();
  });

  it("shows the visible placeholder in a delay row when a stage has no delay class", () => {
    const original = COST_STAGES[0].delay;
    COST_STAGES[0].delay = undefined;
    try {
      render(<InteractiveCostOfBugGraph />);
      reveal();
      fireEvent.click(screen.getByRole("radio", { name: "Delay" }));
      expect(screen.getByTestId("delay-spec")).toHaveTextContent("Delay not stated");
    } finally {
      COST_STAGES[0].delay = original;
    }
  });
});
