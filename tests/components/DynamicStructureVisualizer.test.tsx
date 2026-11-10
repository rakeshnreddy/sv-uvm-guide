import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DynamicStructureVisualizer from "@/components/curriculum/f2/DynamicStructureVisualizer";

const stateBox = () => screen.getByTestId("container-state");
const codeBox = () => screen.getByTestId("container-code");
const op = (code: RegExp) => within(screen.getByRole("group", { name: "Operations" })).getByRole("button", { name: code });
const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("DynamicStructureVisualizer (container lab)", () => {
  it("§7.5.1: gates `buffer = new[6]` behind a prediction, then shows x-filled elements", () => {
    render(<DynamicStructureVisualizer />);
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();

    fireEvent.click(op(/^buffer = new\[6\]$/));
    // Prediction gate: the result is hidden until the learner commits.
    expect(screen.queryByText(/Apply and continue/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    // Operations are locked while a prediction is pending.
    expect(op(/^buffer\.delete\(\)$/)).toBeDisabled();

    lockIn(/^'\{0, 10, 20, 30\}$/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/new\[N\] without \(buffer\) is destructive/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    const strip = within(stateBox()).getByRole("group", { name: /^buffer:/ });
    expect(strip.getAttribute("aria-label")).toBe("buffer: [0] x, [1] x, [2] x, [3] x, [4] x, [5] x");
    expect(within(codeBox()).getByText(/buffer = new\[6\];/)).toBeInTheDocument();
  });

  it("§7.5: push_back on a dynamic array is a compile error chip, not an append", () => {
    render(<DynamicStructureVisualizer />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^buffer\.push_back\(5\)/));
    const result = screen.getByTestId("container-result");
    expect(within(result).getByText(/Compile error: push_back\(\) is not a dynamic-array method/)).toBeInTheDocument();
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();
  });

  it("§7.10.5: push_front on a full q[$:3] discards the old tail with a required warning", () => {
    render(<DynamicStructureVisualizer initialKind="queue" />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^q\.push_back\(5\)$/)); // fills the queue: '{10, 20, 30, 5}
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^q\.push_front\(5\)$/));
    lockIn(/^'\{5, 10, 20, 30\}$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(screen.getByTestId("container-result")).getByText(/Warning \(required\):/)).toBeInTheDocument();
    expect(within(stateBox()).getByRole("group", { name: /^q:/ }).getAttribute("aria-label")).toMatch(/discarded 5$/);
  });

  it("§7.8.2: string keys iterate in character-code order, and a missing-key read warns without allocating", () => {
    render(<DynamicStructureVisualizer initialKind="assoc" />);
    fireEvent.click(op(/^found = scores\.first\(key\)$/));
    lockIn(/^"Gamma"$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(stateBox()).getByText(/key = "Gamma"/)).toBeInTheDocument();

    fireEvent.click(op(/^v = scores\["eve"\]$/));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /Apply and continue/ }));
    expect(within(screen.getByTestId("container-result")).getByText(/Read of nonexistent key "eve"/)).toBeInTheDocument();
    expect(within(stateBox()).getByText(/num\(\) = 3/)).toBeInTheDocument();
  });

  it("is keyboard operable: arrow keys switch the structure", () => {
    render(<DynamicStructureVisualizer />);
    const dyn = screen.getByRole("radio", { name: "Dynamic array" });
    fireEvent.keyDown(dyn, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true");
    expect(op(/^q\.push_back\(5\)$/)).toBeInTheDocument();
  });

  it("undo restores the previous state", () => {
    render(<DynamicStructureVisualizer />);
    fireEvent.click(screen.getByLabelText(/Predict before tricky operations/));
    fireEvent.click(op(/^buffer\.delete\(\)$/));
    expect(within(stateBox()).getByText(/Elements · size\(\) = 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Undo last operation/ }));
    expect(within(stateBox()).getByText(/size\(\) = 4/)).toBeInTheDocument();
  });
});

const pick = (group: RegExp, option: RegExp) => {
  const fs = screen.getAllByRole("group").find((g) => g.tagName === "FIELDSET" && group.test(g.textContent ?? ""))!;
  fireEvent.click(within(fs).getByLabelText(option));
};

describe("DynamicStructureVisualizer preset 'access-semantics' (§7.8.6, §7.8.7, §7.9.11)", () => {
  it("hides the outcome until all three predictions are locked in, then shows that no entry appeared (§7.8.6)", () => {
    render(<DynamicStructureVisualizer initialKind="assoc" initialPreset="access-semantics" />);
    expect(screen.queryByTestId("access-result")).not.toBeInTheDocument();
    const lock = screen.getByRole("button", { name: /lock in predictions/i });
    pick(/1\. Value/, /^v = 0$/);
    pick(/2\. Warning/, /^A warning is required$/);
    expect(lock).toBeDisabled();
    pick(/3\. num/, /^num\(\) = 1$/);
    fireEvent.click(lock);
    expect(screen.getByText("3 of 3 right.")).toBeInTheDocument();
    const result = screen.getByTestId("access-result");
    expect(within(result).getByText(/No entry appeared/)).toBeInTheDocument();
    expect(within(result).getByText(/Warning \(required\):/)).toBeInTheDocument();
  });

  it("loads the standard's example: '{default:1} and a[1]++ allocate a[1] at 1, which becomes 2 (§7.8.7)", () => {
    render(<DynamicStructureVisualizer initialPreset="access-semantics" />);
    fireEvent.click(screen.getByRole("button", { name: /standard's example/i }));
    expect(screen.getByText("int a[int] = '{default:1};")).toBeInTheDocument();
    pick(/1\. Value/, /^a\[1\] = 1 afterwards$/);
    pick(/2\. Warning/, /^No warning$/);
    pick(/3\. num/, /^num\(\) = 1$/);
    fireEvent.click(screen.getByRole("button", { name: /lock in predictions/i }));
    expect(screen.getByText(/starts from the Table 7-1 value/)).toBeInTheDocument();
    const result = screen.getByTestId("access-result");
    expect(within(result).getByText(/An entry appeared/)).toBeInTheDocument();
    expect(within(result).getByRole("group", { name: /^a in index order:/ }).getAttribute("aria-label")).toBe("a in index order: 1 = 2");
  });

  it("announces the score through a live region that is mounted before the reveal", () => {
    render(<DynamicStructureVisualizer initialPreset="access-semantics" />);
    const live = screen.getByTestId("access-score");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    pick(/1\. Value/, /^v = 0$/);
    pick(/2\. Warning/, /^A warning is required$/);
    pick(/3\. num/, /^num\(\) = 1$/);
    fireEvent.click(screen.getByRole("button", { name: /lock in predictions/i }));
    expect(screen.getByTestId("access-score")).toBe(live);
    expect(live).toHaveTextContent("3 of 3 right.");
  });

  it("turns off the written-key option when a[3] = 7 is unchecked, so it never duplicates the missing key", () => {
    render(<DynamicStructureVisualizer initialPreset="access-semantics" />);
    fireEvent.click(screen.getByRole("radio", { name: "3 (written: 7)" }));
    expect(screen.getAllByText("v = a[3];").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText(/Starts with/));
    const written = screen.getByRole("radio", { name: "3 (needs a[3] = 7)" });
    expect(written).toBeDisabled();
    expect(screen.getAllByRole("radio", { name: /never written/ })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "1 (never written)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("v = a[1];").length).toBeGreaterThan(0);
  });

  it("re-asks when the statement changes, and turns off the x index where §7.8.6 does not state the rule", () => {
    render(<DynamicStructureVisualizer initialPreset="access-semantics" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByTestId("access-result")).toBeInTheDocument();
    const read = screen.getByRole("radio", { name: "v = a[k]" });
    fireEvent.keyDown(read, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "a[k] = 5" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "a[k]++" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("access-result")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "kx = 'x" })).toBeDisabled();
    expect(screen.getByText(/does not spell it out for this statement/)).toBeInTheDocument();
  });
});

describe("DynamicStructureVisualizer preset 'slices' (§7.10.1)", () => {
  it("moves a slice handle with the arrow keys past index 0 and predicts the clamped slice", () => {
    render(<DynamicStructureVisualizer initialKind="queue" initialPreset="slices" />);
    const a = screen.getByRole("slider", { name: "Index a" });
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    expect(a).toHaveAttribute("aria-valuenow", "-1");
    expect(screen.getAllByText("s = q[-1:2];").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("slice-result")).not.toBeInTheDocument();
    lockIn(/^'\{10, 20, 30\}$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("slice-result")).getByText(/a = -1 < 0 is treated as 0/)).toBeInTheDocument();
  });

  it("diagnoses an exclusive-end reading and accepts a typed x bound", () => {
    render(<DynamicStructureVisualizer initialPreset="slices" />);
    lockIn(/^'\{20\}$/);
    expect(screen.getByText(/includes both ends/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^a$/), { target: { value: "x" } });
    expect(screen.getAllByText("s = q[kx:2];").length).toBeGreaterThan(0);
    expect(screen.getByText("logic [31:0] kx = 'x;")).toBeInTheDocument();
    lockIn(/^'\{\} \(empty\)$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("a typed bound beyond the track pins the handle to that edge, keeping aria-valuenow on the track", () => {
    render(<DynamicStructureVisualizer initialPreset="slices" />);
    fireEvent.change(screen.getByLabelText(/^a$/), { target: { value: "-10" } });
    const a = screen.getByRole("slider", { name: "Index a" });
    expect(a).toHaveAttribute("data-track-column", "1");
    expect(a).toHaveAttribute("data-off-track", "below");
    expect(a).toHaveAttribute("aria-valuenow", "-3");
    expect(a).toHaveAttribute("aria-valuetext", "a = -10, off the track before -3");
    expect(a).toHaveTextContent("◀ a = -10");
    expect(screen.getAllByText("s = q[-10:2];").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/^b$/), { target: { value: "20" } });
    const b = screen.getByRole("slider", { name: "Index b" });
    expect(b).toHaveAttribute("data-track-column", "10");
    expect(b).toHaveAttribute("data-off-track", "above");
    expect(b).toHaveAttribute("aria-valuenow", "9");
    expect(b).toHaveAttribute("aria-valuetext", "b = 20, off the track past 9");
    expect(b).toHaveTextContent("b = 20 ▶");

    // Back on the track: an ordinary handle in its own column.
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(a).toHaveAttribute("aria-valuenow", "-3");
    expect(a).toHaveAttribute("data-track-column", "1");
    expect(a).not.toHaveAttribute("data-off-track");
    expect(a).toHaveTextContent(/^a$/);
  });

  it("on a phone-width screen the track narrows to -2..6, and off-track handles pin to its edges", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(<DynamicStructureVisualizer initialPreset="slices" />);
      const a = screen.getByRole("slider", { name: "Index a" });
      expect(a).toHaveAttribute("aria-valuemin", "-2");
      expect(a).toHaveAttribute("aria-valuemax", "6");
      expect(a).toHaveAttribute("data-track-column", "4");
      fireEvent.click(screen.getByRole("button", { name: "q[2:9]" }));
      const b = screen.getByRole("slider", { name: "Index b" });
      expect(b).toHaveAttribute("data-track-column", "6");
      expect(b).toHaveAttribute("aria-valuenow", "6");
      expect(b).toHaveTextContent("b = 9 ▶");
    } finally {
      window.matchMedia = original;
    }
  });

  it("write mode: q[$+1] appends, q[7] is ignored with a required warning", () => {
    render(<DynamicStructureVisualizer initialPreset="slices" />);
    fireEvent.click(screen.getByRole("radio", { name: "Write q[i] = v" }));
    lockIn(/^Appends; size\(\) becomes 5$/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("slice-result")).getByRole("group", { name: /^q:/ }).getAttribute("aria-label")).toMatch(/\[4\] 50$/);
    fireEvent.click(screen.getByRole("button", { name: "q[7] = 50" }));
    lockIn(/^Grows q, padding up to index 7$/);
    expect(screen.getByText(/never pad/)).toBeInTheDocument();
    expect(within(screen.getByTestId("slice-result")).getByText(/Warning \(required\):/)).toBeInTheDocument();
  });
});

describe("DynamicStructureVisualizer preset 'delete-walk' (§7.9.6, §12.7.3)", () => {
  it("stops at the next() prediction after delete(4) and reveals id = 9 only after the learner commits (§7.9.6)", () => {
    render(<DynamicStructureVisualizer initialKind="assoc" initialPreset="delete-walk" />);
    const next = screen.getByRole("button", { name: "Next cleanup step" });
    for (let i = 0; i < 8; i += 1) fireEvent.click(next);
    expect(screen.getByText(/id = 4 was just deleted/)).toBeInTheDocument();
    expect(screen.queryByText(/smallest index greater than 4/)).not.toBeInTheDocument();
    lockIn(/^returns 0; id = 4$/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/deleting the current entry does not stop the walk/)).toBeInTheDocument();
    expect(screen.getByText(/next\(\) moves id to the smallest index greater than 4: 9/)).toBeInTheDocument();
  });

  it("foreach + delete ends in an 'undefined (12.7.3)' panel and never shows a made-up next step", () => {
    render(<DynamicStructureVisualizer initialPreset="delete-walk" />);
    fireEvent.click(screen.getByRole("radio", { name: "foreach + delete" }));
    const next = screen.getByRole("button", { name: "Next cleanup step" });
    for (let i = 0; i < 5; i += 1) fireEvent.click(next);
    expect(screen.queryByTestId("undefined-panel")).not.toBeInTheDocument();
    lockIn(/^It visits the next remaining key/);
    const panel = screen.getByTestId("undefined-panel");
    expect(within(panel).getByText("Undefined (§12.7.3)")).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: /exp_by_id keys/ }).getAttribute("aria-label")).toBe("exp_by_id keys: 1 (size 2), 9 (size 0)");
  });

  it("declares int id, found only for the first()/next() walk; foreach declares its own id (§12.7.3)", () => {
    render(<DynamicStructureVisualizer initialPreset="delete-walk" />);
    fireEvent.click(screen.getByRole("radio", { name: "foreach + delete" }));
    expect(screen.queryByText(/int id, found;/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "find_index, then delete" }));
    expect(screen.queryByText(/int id, found;/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "first()/next() walk" }));
    expect(screen.getByText(/int id, found;/)).toBeInTheDocument();
  });

  it("find_index then delete notes the unspecified locator order (§7.12.1)", () => {
    render(<DynamicStructureVisualizer initialPreset="delete-walk" />);
    fireEvent.click(screen.getByRole("radio", { name: "find_index, then delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Next cleanup step" }));
    expect(screen.getByText(/empty_ids = '\{4, 9\}/)).toBeInTheDocument();
    expect(screen.getByText(/Locators traverse in an unspecified order/)).toBeInTheDocument();
  });

  it("an unknown preset opens the free lab", () => {
    render(<DynamicStructureVisualizer initialPreset="nope" />);
    expect(screen.getByTestId("container-lab")).toBeInTheDocument();
  });
});

