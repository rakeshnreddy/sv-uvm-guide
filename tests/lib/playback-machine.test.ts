import { describe, expect, it } from "vitest";

import { createPlaybackState, playbackReducer } from "@/lib/playback-machine";

describe("shared playback reducer", () => {
  it("never advances past the last valid index", () => {
    let state = createPlaybackState(3);
    state = playbackReducer(state, { type: "PLAY" });
    state = playbackReducer(state, { type: "TICK" });
    state = playbackReducer(state, { type: "TICK" });
    state = playbackReducer(state, { type: "TICK" });
    expect(state).toEqual({ index: 2, lastIndex: 2, status: "complete" });
  });

  it("resets and bounds manual stepping", () => {
    let state = createPlaybackState(2);
    state = playbackReducer(state, { type: "STEP_BACK" });
    expect(state.index).toBe(0);
    state = playbackReducer(state, { type: "STEP_FORWARD" });
    state = playbackReducer(state, { type: "STEP_FORWARD" });
    expect(state.index).toBe(1);
    expect(playbackReducer(state, { type: "RESET" })).toEqual(createPlaybackState(2));
  });
});
