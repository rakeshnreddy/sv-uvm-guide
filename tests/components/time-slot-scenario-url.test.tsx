import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HERO_SCENARIO_ID, LIVE_MODEL_HREF, liveModelLink } from "@/components/home/scheduler-frame";
import TimeSlotTraceVisualizer, { SCENARIO_QUERY_PARAM, scenarioFromSearch } from "@/components/visuals/TimeSlotTraceVisualizer";

const offered = ["shift-blocking", "shift-nba", "display-vs-strobe"];

describe("scenarioFromSearch", () => {
  it("returns the scenario the query names when the instance offers it", () => {
    expect(scenarioFromSearch("?scenario=shift-nba", offered)).toBe("shift-nba");
    expect(scenarioFromSearch("scenario=display-vs-strobe&x=1", offered)).toBe("display-vs-strobe");
  });

  it("falls back (null) when the query names nothing, an unknown id or one this instance does not offer", () => {
    expect(scenarioFromSearch("", offered)).toBeNull();
    expect(scenarioFromSearch("?other=shift-nba", offered)).toBeNull();
    expect(scenarioFromSearch("?scenario=", offered)).toBeNull();
    expect(scenarioFromSearch("?scenario=nope", offered)).toBeNull();
    expect(scenarioFromSearch("?scenario=comb-after-nba", offered)).toBeNull();
    expect(scenarioFromSearch("?scenario=SHIFT-NBA", offered)).toBeNull();
  });
});

describe("liveModelLink", () => {
  it("puts the hero scenario in the query, before the heading anchor, with the parameter the visualizer reads", () => {
    expect(SCENARIO_QUERY_PARAM).toBe("scenario");
    const [path, anchor] = LIVE_MODEL_HREF.split("#");
    expect(liveModelLink()).toBe(`${path}?scenario=${HERO_SCENARIO_ID}#${anchor}`);
    expect(liveModelLink("/a?b=1#c", "shift-blocking")).toBe("/a?b=1&scenario=shift-blocking#c");
    expect(liveModelLink("/a", "shift-nba")).toBe("/a?scenario=shift-nba");
  });
});

describe("TimeSlotTraceVisualizer starting scenario from the URL", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  const selected = () => screen.getByRole("tab", { selected: true }).textContent;

  it("opens on the scenario the URL names when the instance offers it", () => {
    window.history.replaceState(null, "", "/lesson?scenario=shift-nba");
    render(<TimeSlotTraceVisualizer scenario="shift-blocking" scenarios={["shift-blocking", "shift-nba"]} />);
    expect(selected()).toBe("Shift register · <=");
  });

  it("keeps its own starting scenario when the URL names none or one it does not offer", () => {
    window.history.replaceState(null, "", "/lesson?scenario=comb-after-nba");
    const { unmount } = render(<TimeSlotTraceVisualizer scenario="shift-blocking" scenarios={["shift-blocking", "shift-nba"]} />);
    expect(selected()).toBe("Shift register · =");
    unmount();
    window.history.replaceState(null, "", "/lesson");
    render(<TimeSlotTraceVisualizer scenario="shift-blocking" scenarios={["shift-blocking", "shift-nba"]} />);
    expect(selected()).toBe("Shift register · =");
  });
});
