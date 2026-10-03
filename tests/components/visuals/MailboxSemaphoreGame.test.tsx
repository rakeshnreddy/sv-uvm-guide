import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MailboxSemaphoreGame from "@/components/visuals/MailboxSemaphoreGame";

const status = (id: string) => document.getElementById(id) as HTMLElement;

describe("MailboxSemaphoreGame", () => {
  it("wakes a blocked semaphore waiter automatically, in FIFO order", () => {
    render(<MailboxSemaphoreGame />);
    const sandbox = screen.getByRole("region", { name: "Semaphore sandbox" });
    fireEvent.click(within(sandbox).getByRole("button", { name: "A: sem.get(1)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "B: sem.get(1)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "C: sem.get(1)" }));
    expect(status("sem-status-B")).toHaveTextContent("blocked in sem.get(1) — position 1");
    expect(status("sem-status-C")).toHaveTextContent("position 2");
    // A blocked process cannot issue calls.
    expect(within(sandbox).getByRole("button", { name: "B: sem.put(1)" })).toBeDisabled();

    fireEvent.click(within(sandbox).getByRole("button", { name: "A: sem.put(1)" }));
    expect(status("sem-status-B")).toHaveTextContent("running · holds 1 key");
    expect(status("sem-status-C")).toHaveTextContent("blocked");
    expect(within(sandbox).getAllByText(/B wakes by itself/).length).toBeGreaterThan(0);
  });

  it("try_get returns 0 without blocking, and put can exceed the initial key count", () => {
    render(<MailboxSemaphoreGame />);
    const sandbox = screen.getByRole("region", { name: "Semaphore sandbox" });
    fireEvent.click(within(sandbox).getByRole("button", { name: "A: sem.get(1)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "B: sem.try_get(1)" }));
    expect(within(sandbox).getAllByText(/Returns 0 at once/).length).toBeGreaterThan(0);
    expect(status("sem-status-B")).toHaveTextContent("running");
    fireEvent.click(within(sandbox).getByRole("button", { name: "C: sem.put(1)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "C: sem.put(1)" }));
    expect(within(sandbox).getAllByText(/more than new\(1\) created/).length).toBeGreaterThan(0);
  });

  it("mailbox: blocked get and put resume on their own; try_put on a full mailbox changes nothing", () => {
    render(<MailboxSemaphoreGame mode="mailbox" />);
    const sandbox = screen.getByRole("region", { name: "Mailbox sandbox" });
    fireEvent.click(within(sandbox).getByRole("button", { name: "consumer 1: mbx.get(v)" }));
    expect(status("mbx-status-consumer-1")).toHaveTextContent("blocked in mbx.get(v) — empty");
    fireEvent.click(within(sandbox).getByRole("button", { name: "producer: mbx.put(1)" }));
    expect(status("mbx-status-consumer-1")).toHaveTextContent("v = 1");

    fireEvent.click(within(sandbox).getByRole("button", { name: "producer: mbx.put(2)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "producer: mbx.put(3)" }));
    fireEvent.click(within(sandbox).getByRole("button", { name: "producer: ok = mbx.try_put(4)" }));
    expect(within(sandbox).getAllByText(/full and stays unchanged/).length).toBeGreaterThan(0);
    expect(within(sandbox).getByText(/mbx.num\(\) = 2/)).toBeInTheDocument();

    fireEvent.click(within(sandbox).getByRole("button", { name: "producer: mbx.put(4)" }));
    expect(status("mbx-status-producer")).toHaveTextContent("blocked in mbx.put(4) — full");
    fireEvent.click(within(sandbox).getByRole("button", { name: "consumer 2: mbx.get(v)" }));
    expect(status("mbx-status-consumer-2")).toHaveTextContent("v = 2");
    expect(status("mbx-status-producer")).toHaveTextContent("running · next value 5");
  });

  it("gates the scripted FIFO run behind a prediction", () => {
    render(<MailboxSemaphoreGame />);
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("t = 10 ns"));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/C is not first in line/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /process step playback controls/i })).toBeInTheDocument();
  });

  it("switches labs from the keyboard", () => {
    render(<MailboxSemaphoreGame />);
    const labs = screen.getByRole("radiogroup", { name: "Lab" });
    fireEvent.keyDown(within(labs).getByRole("radio", { name: "Semaphore" }), { key: "ArrowRight" });
    expect(within(labs).getByRole("radio", { name: "Mailbox" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("region", { name: "Mailbox sandbox" })).toBeInTheDocument();
  });

  it("starts the mailbox prediction on a mailbox program after switching from semaphores", () => {
    render(<MailboxSemaphoreGame />);
    const labs = screen.getByRole("radiogroup", { name: "Lab" });
    fireEvent.click(within(labs).getByRole("radio", { name: "Mailbox" }));
    const programs = screen.getByRole("radiogroup", { name: "Mailbox program" });
    expect(within(programs).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("debug: the early return leaks the key; only returning it on every path passes all checks", () => {
    render(<MailboxSemaphoreGame mode="debug" />);
    expect(screen.getByText(/driver stuck in bus.get\(1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: bus.get\(1\);/ }));
    expect(screen.getByText(/Not this one\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suspect line: if \(id == 2\) return;/ }));
    expect(screen.getByText(/Found it\./)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Move bus.put\(1\) right after bus.get\(1\)/));
    expect(screen.getByText(/never two senders on the bus/).closest("li")).toHaveTextContent("fails");

    fireEvent.click(screen.getByLabelText(/if \(id == 2\) begin bus.put\(1\); return; end/));
    expect(screen.getByText(/All checks pass\./)).toBeInTheDocument();
  });
});
