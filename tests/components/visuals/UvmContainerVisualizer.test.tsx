import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UvmContainerVisualizer from "@/components/visuals/UvmContainerVisualizer";

const runNext = () => fireEvent.click(screen.getByRole("button", { name: /run next statement/i }));
const lockIn = (label: RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("UvmContainerVisualizer", () => {
  it("uvm_pool: blocks the get() of a missing key behind a prediction, then shows the inserted entry", () => {
    render(<UvmContainerVisualizer />);
    runNext();
    runNext();
    expect(screen.getByRole("button", { name: /predict first/i })).toBeDisabled();
    expect(screen.queryByText("→ n = 0")).not.toBeInTheDocument();
    lockIn(/n = 0, and the pool is unchanged/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Run n = err_pool\.get\("timeout"\);/ }));
    expect(screen.getByText("→ n = 0")).toBeInTheDocument();
    const objects = screen.getByRole("list", { name: "Container objects" });
    expect(within(objects).getByText('"timeout"')).toBeInTheDocument();
    runNext();
    expect(screen.getByText("→ 2")).toBeInTheDocument();
  });

  it("uvm_pool: delete of a missing key warns POOLDEL; the global pool is one singleton", () => {
    render(<UvmContainerVisualizer />);
    runNext();
    runNext();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /Run n = err_pool/ }));
    for (let i = 0; i < 5; i += 1) runNext();
    expect(screen.getByText(/\[POOLDEL\] delete: pool key doesn't exist/)).toBeInTheDocument();
    expect(screen.getByText(/Same specialization, same singleton/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /program finished/i })).toBeDisabled();
    // Try-it console: exists() never inserts.
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), { target: { value: "exists" } });
    fireEvent.click(screen.getByRole("button", { name: /Run \$display\(err_pool\.exists\("parity"\)\);/ }));
    expect(screen.getAllByText(/exists\(\) only looks/).length).toBeGreaterThan(0);
  });

  it("uvm_event_pool: a plain uvm_pool of events returns null and the trigger is a null access", () => {
    render(<UvmContainerVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "uvm_event_pool" }));
    runNext();
    runNext();
    lockIn(/A null object access/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Run raw\.get\("dma_done"\)\.trigger\(\);/ }));
    expect(screen.getByText(/Null object access: raw\.get\("dma_done"\) returned null/)).toBeInTheDocument();
  });

  it("uvm_queue: insert(size(), v) is ignored and compare() of different queues returns 1 (keyboard mode switch)", () => {
    render(<UvmContainerVisualizer />);
    const group = screen.getByRole("radiogroup", { name: "Container" });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "uvm_pool" }), { key: "End" });
    expect(within(group).getByRole("radio", { name: "uvm_queue" })).toHaveAttribute("aria-checked", "true");
    runNext();
    runNext();
    runNext();
    lockIn(/Appends 7/);
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Run q\.insert\(q\.size\(\), 7\);/ }));
    expect(screen.getByText(/\[QUEUEINS\]/)).toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) runNext();
    expect(screen.getByText(/compare\(\) has nothing to compare and returns 1/)).toBeInTheDocument();
    runNext();
    expect(screen.getByText(/print\(\) shows only the object header/)).toBeInTheDocument();
    runNext();
    expect(screen.getByText("→ '{5, 9}")).toBeInTheDocument();
  });
});
