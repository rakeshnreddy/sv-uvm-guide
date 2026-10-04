import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ObjectHandleVisualizer from "@/components/visuals/ObjectHandleVisualizer";

const activeLine = () => document.querySelector('[aria-current="step"]')?.textContent ?? "";
const next = () => fireEvent.click(screen.getByRole("button", { name: /next statement/i }));
const stepUntilLine = (text: string) => {
  for (let i = 0; i < 20 && !activeLine().includes(text); i += 1) next();
  expect(activeLine()).toContain(text);
};
const heapList = () => screen.queryByRole("list", { name: "Handles and targets" });
const lockIn = (answer: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: answer }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("ObjectHandleVisualizer (trace mode)", () => {
  it("hides the heap after a key statement until the learner commits a prediction", () => {
    render(<ObjectHandleVisualizer scenario="shallow-copy" scenarios={["shallow-copy"]} />);
    expect(screen.getByRole("list", { name: "Handles and targets" })).toHaveTextContent("p1 = null");

    stepUntilLine("p2 = new p1;");
    // One step before the key statement, the question is already asked.
    expect(screen.getByText(/what is p1\.data\?/)).toBeInTheDocument();
    expect(within(heapList() as HTMLElement).getByText("packet@2: id = 5, data = '{1, 2}, hdr → header@1")).toBeInTheDocument();

    next();
    expect(activeLine()).toContain("p2.data.push_back(3);");
    expect(heapList()).not.toBeInTheDocument();
    expect(screen.getAllByText(/hidden until you/i).length).toBeGreaterThan(0);

    lockIn(/'\{1, 2\}: p1 keeps its own queue/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const list = heapList() as HTMLElement;
    expect(list).toHaveTextContent("packet@1: id = 5, data = '{1, 2}, hdr → header@1");
    expect(list).toHaveTextContent("packet@2: id = 5, data = '{1, 2, 3}, hdr → header@1");
  });

  it("shows the shared nested header after the second prediction, and diagnoses a wrong answer", () => {
    render(<ObjectHandleVisualizer scenario="shallow-copy" scenarios={["shallow-copy"]} />);
    stepUntilLine("p2.data.push_back(3);");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    next();
    expect(activeLine()).toContain("p2.hdr.len = 9;");
    expect(heapList()).not.toBeInTheDocument();
    lockIn(/^4: p2 has its own header/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/A shallow copy never creates nested objects/)).toBeInTheDocument();
    expect(heapList()).toHaveTextContent("header@1: len = 9");
    expect(screen.getByText(/also reached through p1\.hdr, so p1\.hdr\.len now reads 9 too/)).toBeInTheDocument();
  });

  it("greys out objects that lose their last handle and stops at a null-handle call", () => {
    render(<ObjectHandleVisualizer scenario="null-and-garbage" scenarios={["null-and-garbage"]} />);
    stepUntilLine("p1 = p2;");
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(heapList()).toHaveTextContent("packet@1: id = 0, data = '{1, 2}, hdr → header@1 — unreachable, eligible for garbage collection");
    stepUntilLine("p1.print();");
    lockIn(/Run-time error: null-object access/);
    expect(screen.getByText(/Calling a virtual method through a null handle is illegal \(§8\.4\)/)).toBeInTheDocument();
  });

  it("is keyboard operable: playback keys step, arrow keys switch scenario", () => {
    render(<ObjectHandleVisualizer scenario="aliasing" scenarios={["aliasing", "static-count"]} />);
    const group = screen.getByRole("group", { name: /statement playback controls/i });
    const slider = within(group).getByRole("slider");
    const before = slider.getAttribute("aria-valuetext");
    fireEvent.keyDown(within(group).getByRole("button", { name: /next statement/i }), { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuetext")).not.toBe(before);
    expect(slider.getAttribute("aria-valuetext")).toContain("p1 = new;");

    fireEvent.keyDown(screen.getByRole("radio", { name: "p2 = p1" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "static count" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("A static counter is one box for the whole class")).toBeInTheDocument();
    expect(heapList()).toHaveTextContent("packet::count = 0 (static: one per class)");
  });
});

describe("ObjectHandleVisualizer (spot the bug)", () => {
  it("shows the symptom, grades suspects, and reruns fixes on the model", () => {
    render(<ObjectHandleVisualizer mode="bug" />);
    expect(screen.getByText("UVM_ERROR [SCB] item 0: DUT data=3, stored expected data=9")).toBeInTheDocument();
    expect(screen.getByText("UVM_INFO [SCB] item 2: DUT data=9 matches stored data=9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suspect line: exp_q.push_back(t);" }));
    expect(screen.getByText(/Close\./)).toBeInTheDocument();
    expect(screen.queryByText(/Step 2/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suspect line: t = new;" }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /c = t; exp_q\.push_back\(c\);/ }));
    expect(screen.getByText(/Scoreboard reads back 9, 9, 9 from 1 distinct object/)).toHaveTextContent("✕ still wrong");

    fireEvent.click(screen.getByRole("radio", { name: /Move t = new; inside the loop/ }));
    expect(screen.getByText(/Scoreboard reads back 3, 5, 9 from 3 distinct objects/)).toHaveTextContent("✓ matches the samples");

    fireEvent.click(screen.getByRole("radio", { name: /Clear it after storing/ }));
    expect(screen.getByText(/Run-time error before the scoreboard runs/)).toBeInTheDocument();
  });
});
