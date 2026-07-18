export type PlaybackStatus = "idle" | "playing" | "paused" | "complete";

export interface PlaybackState {
  index: number;
  lastIndex: number;
  status: PlaybackStatus;
}

export type PlaybackAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP_BACK" }
  | { type: "STEP_FORWARD" }
  | { type: "TICK" }
  | { type: "SET_LENGTH"; itemCount: number };

export function createPlaybackState(itemCount: number): PlaybackState {
  return { index: 0, lastIndex: Math.max(0, itemCount - 1), status: "idle" };
}

function advance(state: PlaybackState): PlaybackState {
  if (state.index >= state.lastIndex) return { ...state, index: state.lastIndex, status: "complete" };
  const index = Math.min(state.index + 1, state.lastIndex);
  return { ...state, index, status: index === state.lastIndex ? "complete" : state.status };
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "PLAY":
      return state.index >= state.lastIndex
        ? { ...state, status: "complete" }
        : { ...state, status: "playing" };
    case "PAUSE":
      return { ...state, status: state.index === 0 ? "idle" : "paused" };
    case "RESET":
      return { ...state, index: 0, status: "idle" };
    case "STEP_BACK": {
      const index = Math.max(0, state.index - 1);
      return { ...state, index, status: index === 0 ? "idle" : "paused" };
    }
    case "STEP_FORWARD":
      return advance({ ...state, status: "paused" });
    case "TICK":
      return state.status === "playing" ? advance(state) : state;
    case "SET_LENGTH":
      return createPlaybackState(action.itemCount);
    default:
      return state;
  }
}
