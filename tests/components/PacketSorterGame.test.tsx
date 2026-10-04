import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PacketSorterGame, { PACKET_SORTER_CHALLENGES } from "@/components/curriculum/f2/PacketSorterGame";

describe("PacketSorterGame", () => {
  it("an unknown count is a queue (push_back), not a dynamic array (§7.5 has no push_back)", () => {
    const c = PACKET_SORTER_CHALLENGES.find((x) => x.id === "unknown-count");
    expect(c?.options.find((o) => o.correct)?.label).toBe("Queue");
    expect(c?.options.find((o) => o.id === "dynamic-array")?.correct).toBe(false);
  });

  it("every scenario has exactly one best option and per-option feedback", () => {
    for (const c of PACKET_SORTER_CHALLENGES) {
      expect(c.options.filter((o) => o.correct)).toHaveLength(1);
      expect(c.options.every((o) => o.feedback.length > 20)).toBe(true);
    }
  });

  it("shows the best option after a wrong answer and scores honestly", () => {
    render(<PacketSorterGame />);
    expect(screen.queryByTestId("packet-sorter-feedback")).not.toBeInTheDocument();
    expect(screen.getByTestId("packet-next")).toBeDisabled();

    // Scenario 1: wrong answer.
    fireEvent.click(screen.getByTestId("packet-option-dynamic-array"));
    const feedback = screen.getByTestId("packet-sorter-feedback");
    expect(feedback.textContent).toMatch(/Not the best fit/);
    expect(feedback.textContent).toMatch(/Best choice, Queue/);
    expect(screen.getByTestId("packet-option-queue").textContent).toMatch(/✓ best choice/);
    expect(screen.getByTestId("packet-option-queue")).toBeDisabled();

    // Answer the rest correctly.
    for (let i = 1; i < PACKET_SORTER_CHALLENGES.length; i += 1) {
      fireEvent.click(screen.getByTestId("packet-next"));
      const best = PACKET_SORTER_CHALLENGES[i].options.find((o) => o.correct);
      fireEvent.click(screen.getByTestId(`packet-option-${best?.id}`));
      expect(screen.getByTestId("packet-sorter-feedback").textContent).toMatch(/Correct\./);
    }
    fireEvent.click(screen.getByTestId("packet-next"));
    const total = PACKET_SORTER_CHALLENGES.length;
    expect(screen.getByTestId("packet-score").textContent).toBe(`You chose the best structure in ${total - 1} of ${total} scenarios.`);
    expect(screen.getByTestId("packet-sorter-summary").textContent).not.toMatch(/XP|Success/);
    fireEvent.click(screen.getByTestId("packet-restart"));
    expect(screen.getByTestId("packet-sorter-prompt")).toBeInTheDocument();
  });
});
