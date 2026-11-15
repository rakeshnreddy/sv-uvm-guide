import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MailboxSemaphoreGame from "@/components/visuals/MailboxSemaphoreGame";
import { HANDOFF_REGROUP_ASSUMPTION, benchStory, presentProcessRun } from "@/lib/sv-ipc-bench-scenarios";
import { mailboxScenario, simulateProcesses } from "@/lib/sv-process-model";

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

  it("default embed: three labs and the FIFO program, with no bench or same-time controls", () => {
    render(<MailboxSemaphoreGame />);
    expect(within(screen.getByRole("radiogroup", { name: "Lab" })).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Semaphore", "Mailbox", "Debug: the lost key"]);
    expect(screen.getByRole("heading", { name: "Semaphores: keys, waiters and FIFO wake-up" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Bench change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Same-time program" })).not.toBeInTheDocument();
  });
});

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const scrubToEnd = () => {
  const scrubber = screen.getByRole("slider", { name: /process step scrubber/i });
  fireEvent.change(scrubber, { target: { value: scrubber.getAttribute("max") } });
};

describe("MailboxSemaphoreGame bench mode", () => {
  it("asks two predictions before the scrubber appears, and explains each from the run", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    expect(screen.getByRole("heading", { name: "One bench: backpressure, a key queue and an event" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/irq: write 99 start/)).not.toBeInTheDocument();

    lockIn("t = 0 ns");
    expect(screen.getByText(/the third put\(\) waits for room \(§15\.4\.3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Why the answer holds:/).parentElement).toHaveTextContent("drv's get takes item 2 at 10 ns");
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();

    lockIn("t = 30 ns");
    expect(screen.getByText(/irq calls bus.get\(1\) at 25 ns while drv holds the only key/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /process step playback controls/i })).toBeInTheDocument();
    expect(screen.getByTestId("bench-ending")).toHaveTextContent("ends at 40 ns");
    // The prompts follow one another; the reveal sits after them, outside every prompt card.
    const fieldsets = document.querySelectorAll("fieldset");
    expect(fieldsets).toHaveLength(2);
    fieldsets.forEach((f) => expect(f.parentElement?.contains(screen.getByTestId("bench-trace"))).toBe(false));
    // The prompt adds "Correct."; the generated feedback does not repeat it.
    expect(screen.getByText(/irq calls bus.get\(1\) at 25 ns/).textContent).toMatch(/^Correct\. irq calls/);
  });

  it("names the layer as written, labels the controls with their accessible names, and explains the log columns", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    expect(screen.getByText("Make It Work")).toBeInTheDocument();
    expect(screen.getByText("Bench change", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Bench change" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByText(/The model adds each line's time stamp and process name/)).toBeInTheDocument();
  });

  it("announces only a short step summary, and marks the current moment visibly", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByTestId("bench-step-note")).not.toHaveAttribute("aria-live");
    const moment = screen.getByRole("button", { name: "irq queues for bus at 25 ns" });
    fireEvent.click(moment);
    const announce = screen.getByTestId("bench-step-announce");
    expect(announce).toHaveAttribute("aria-live", "polite");
    expect(announce).toHaveTextContent("t = 25 ns: irq blocks in bus.get(1)");
    expect(announce).not.toHaveTextContent("§15.3.3");
    expect(moment).toHaveAttribute("aria-pressed", "true");
    expect(moment.className).toContain("aria-pressed:border-l-primary");
  });

  it("scrubs the run: each step names its clause, and the moment buttons jump to the key queue and the trigger", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    expect(screen.getByTestId("bench-step-clause")).toHaveTextContent("IEEE 1800-2023 §9.2");

    fireEvent.click(screen.getByRole("button", { name: "irq queues for bus at 25 ns" }));
    expect(screen.getByTestId("bench-step-note")).toHaveTextContent("irq blocks in bus.get(1)");
    expect(screen.getByTestId("bench-step-clause")).toHaveTextContent("§15.3.3");
    expect(screen.getByText(/Waiting \(FIFO\): 1\. irq needs 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "-> drv_done wakes chk at 30 ns" }));
    expect(screen.getByTestId("bench-step-note")).toHaveTextContent("drv triggers drv_done. It wakes chk.");
    expect(screen.getByTestId("bench-step-clause")).toHaveTextContent("§15.5.2");

    scrubToEnd();
    expect(screen.getByRole("list", { name: "Simulation output" })).toHaveTextContent("chk: PASS, drv sent 3 items");
  });

  it("§15.4.3: drv's get leaves the slot empty with gen ready, and gen's own step stores the next item", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    const trace = benchStory("as-written").result.trace;
    const seekTo = (what: string) => {
      const i = trace.findIndex((s) => s.what === what);
      expect(i).toBeGreaterThan(0);
      fireEvent.change(screen.getByRole("slider", { name: /process step scrubber/i }), { target: { value: String(i) } });
    };
    seekTo("drv: gen2drv.get(item) takes 1 (0/1 left).");
    expect(screen.getByTestId("bench-step-note")).toHaveTextContent("drv: gen2drv.get(item) takes 1 (0/1 left).");
    expect(screen.getByTestId("bench-step-note")).toHaveTextContent("it stores its message when gen runs (§15.4.3)");
    seekTo("gen's gen2drv.put(2) stores 2 (1/1).");
    expect(screen.getByTestId("bench-step-note")).toHaveTextContent("gen resumes inside its suspended put()");
    expect(screen.getByTestId("bench-step-clause")).toHaveTextContent("IEEE 1800-2023 §15.4.3");
  });

  it("leaked key: the log stops after put 3 and the run ends quietly at 25 ns; with the clock it runs to the watchdog", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    const variants = screen.getByRole("radiogroup", { name: "Bench change" });
    fireEvent.click(within(variants).getByRole("radio", { name: "Delete bus.put(1)" }));
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();
    lockIn("After “10 gen: put 3”, ending at 25 ns");
    expect(screen.getAllByText(/ends quietly at 25 ns/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox", { name: /Advanced/ }));
    // A new question: the reveal is closed again.
    expect(screen.queryByRole("group", { name: /process step playback controls/i })).not.toBeInTheDocument();
    lockIn("After “10 gen: put 3”, ending at 100 ns");
    expect(screen.getAllByText(/watchdog's \$finish ends the run at 100 ns/).length).toBeGreaterThan(0);
    scrubToEnd();
    expect(screen.getByRole("list", { name: "Simulation output" })).not.toHaveTextContent("PASS");
  });

  it("new instead of new(1): picking the other bug's stop point explains the empty bucket", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Bench change" })).getByRole("radio", { name: "new instead of new(1)" }));
    expect(screen.getByText(/default keyCount, 0 \(§15\.3\.1\)/)).toBeInTheDocument();
    lockIn("After “10 gen: put 3”, ending at 25 ns");
    expect(screen.getByText(/That is where the other bug stops/)).toBeInTheDocument();
  });

  it("#30 @(drv_done): PASS depends on the order, shown as two outcome groups that load into the scrubber", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    const variants = screen.getByRole("radiogroup", { name: "Bench change" });
    fireEvent.keyDown(within(variants).getByRole("radio", { name: "As written" }), { key: "End" });
    expect(within(variants).getByRole("radio", { name: "chk: #30 @(drv_done)" })).toHaveAttribute("aria-checked", "true");
    lockIn("It depends on the process order");
    expect(screen.getByText(/2 different outcomes from/)).toBeInTheDocument();
    const withPass = screen.getByRole("button", { name: /^PASS printed/ });
    fireEvent.click(withPass);
    expect(withPass).toHaveAttribute("aria-pressed", "true");
    scrubToEnd();
    expect(screen.getByRole("list", { name: "Simulation output" })).toHaveTextContent("chk: PASS");
    fireEvent.click(screen.getByRole("button", { name: /^No PASS line/ }));
    scrubToEnd();
    expect(screen.getByRole("list", { name: "Simulation output" })).not.toHaveTextContent("PASS");
  });

  it("#30 with the clock: the capped exploration says so in the feedback and on the outcome groups", () => {
    render(<MailboxSemaphoreGame mode="bench" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Bench change" })).getByRole("radio", { name: "chk: #30 @(drv_done)" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Advanced/ }));
    lockIn("It depends on the process order");
    expect(screen.getByText(/stopped at its cap/)).toBeInTheDocument();
    expect(screen.getByText(/Capped at 400 orders; more legal orders exist/)).toBeInTheDocument();
  });
});

describe("MailboxSemaphoreGame same-time program", () => {
  it("B and C arrive at 2 ns: 'depends', two outcome groups, and the owner variant makes one", () => {
    render(<MailboxSemaphoreGame mode="semaphore" initialProgram="same-time" />);
    expect(screen.getByRole("heading", { name: "Same-time arrivals: what FIFO does and does not promise" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Semaphore sandbox" })).toBeInTheDocument();
    lockIn("B");
    expect(screen.getByText(/Not always B\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^B first at 10 ns/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^C first at 10 ns/ })).toBeInTheDocument();

    expect(screen.getByText("Same-time program", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Same-time program" })).getByRole("radio", { name: "Requests through one owner" }));
    expect(screen.getByText(/Who prints “got the bus” first\?/)).toBeInTheDocument();
    lockIn("B");
    expect(screen.getByText(/1 outcome from/)).toBeInTheDocument();
  });
});

describe("MailboxSemaphoreGame mailbox back-pressure trace (§15.4.3)", () => {
  it("new(1): no step shows the consumer's get leaving the mailbox full, and the producer's own step stores each resumed put", () => {
    render(<MailboxSemaphoreGame mode="mailbox" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Mailbox program" })).getByRole("radio", { name: "new(1)" }));
    lockIn("t = 20 ns");
    const scrubber = screen.getByRole("slider", { name: /process step scrubber/i });
    const max = Number(scrubber.getAttribute("max"));
    expect(max + 1).toBe(presentProcessRun(simulateProcesses(mailboxScenario(1))).trace.length);
    let stores = 0;
    for (let i = 0; i <= max; i++) {
      fireEvent.change(scrubber, { target: { value: String(i) } });
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("(1/1 left)");
      expect(text).not.toContain("completes now that a slot is free");
      if (text.includes("producer's mbx.put(1) stores 1 (1/1).")) stores++;
    }
    expect(stores).toBeGreaterThan(0);
  });

  it("states the hand-off regrouping under the limits in mailbox mode only", () => {
    render(<MailboxSemaphoreGame />);
    expect(screen.queryByText(HANDOFF_REGROUP_ASSUMPTION)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Lab" })).getByRole("radio", { name: "Mailbox" }));
    expect(screen.getByText(HANDOFF_REGROUP_ASSUMPTION)).toBeInTheDocument();
  });
});
