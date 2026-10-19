import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CodeEditor,
  EDITOR_FALLBACK_NOTE,
  EDITOR_LOADING_TEXT,
  EDITOR_RECOVERED_NOTE,
  EDITOR_SWITCH_LABEL,
  MONACO_LOAD_TIMEOUT_MS,
  PLAIN_EDITOR_TAB_HINT,
  editorLoadReducer,
  initialEditorLoadState,
} from "@/components/ui/CodeEditor";

type Deferred = { promise: Promise<unknown>; resolve: () => void; reject: (error: unknown) => void };

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = () => res({});
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  /** How the mocked Monaco behaves: mounts, never finishes loading, or throws while rendering. */
  behaviour: "mount" as "mount" | "never" | "throw",
  /** What loader.init() returns. */
  init: (() => new Promise<unknown>(() => undefined)) as () => Promise<unknown>,
  focus: vi.fn(),
  mounts: 0,
}));

// next/dynamic hands back the mocked Monaco directly, so it renders synchronously.
vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");
  type MonacoProps = {
    value?: string;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: unknown, monaco: unknown) => void;
    loading?: React.ReactNode;
    options?: { ariaLabel?: string; readOnly?: boolean };
  };
  function MockMonaco({ value, onChange, onMount, loading, options }: MonacoProps) {
    ReactModule.useEffect(() => {
      if (mocks.behaviour !== "mount") return;
      mocks.mounts += 1;
      onMount?.({ focus: mocks.focus }, {});
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once, as Monaco does
    }, []);
    if (mocks.behaviour === "throw") throw new Error("Loading chunk failed");
    if (mocks.behaviour === "never") return ReactModule.createElement("div", null, loading);
    return ReactModule.createElement("textarea", {
      "data-testid": "monaco",
      "aria-label": options?.ariaLabel,
      value,
      readOnly: options?.readOnly,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
    });
  }
  return { default: () => MockMonaco };
});

vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  loader: { init: () => mocks.init() },
}));

interface HarnessProps {
  initial?: string;
  readOnly?: boolean;
  loadTimeoutMs?: number;
  onFallbackChange?: (plain: boolean) => void;
  onValue?: (value: string) => void;
}

/** A controlled parent, as the lab page and InteractiveCode are. */
function Harness({ initial = "module a;\nendmodule\n", readOnly, loadTimeoutMs, onFallbackChange, onValue }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CodeEditor
        height="400px"
        ariaLabel="work/a.sv (editable)"
        language="systemverilog"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        readOnly={readOnly}
        loadTimeoutMs={loadTimeoutMs}
        onFallbackChange={onFallbackChange}
      />
      <button type="button">After the editor</button>
    </>
  );
}

function wait(ms: number) {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
}

const plainEditor = () => screen.findByRole("textbox", { name: "work/a.sv (editable)" }) as Promise<HTMLTextAreaElement>;

describe("CodeEditor", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.behaviour = "mount";
    mocks.init = () => Promise.resolve({});
    mocks.focus.mockReset();
    mocks.mounts = 0;
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
  });

  it("uses Monaco when it loads, with the same accessible name and no note", async () => {
    render(<Harness loadTimeoutMs={50} />);
    const monaco = await screen.findByTestId("monaco");
    expect(monaco).toHaveAccessibleName("work/a.sv (editable)");
    await wait(80);
    expect(screen.getByTestId("monaco")).toBeInTheDocument();
    expect(screen.queryByText(EDITOR_FALLBACK_NOTE)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(document.querySelector("[data-editor]")).toHaveAttribute("data-editor", "monaco");
  });

  it("switches to the plain editor after 8 seconds when Monaco never loads", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.behaviour = "never";
    mocks.init = () => new Promise(() => undefined);
    const onFallbackChange = vi.fn();
    render(<Harness onFallbackChange={onFallbackChange} />);
    expect(screen.getByText(EDITOR_LOADING_TEXT)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MONACO_LOAD_TIMEOUT_MS - 1);
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(MONACO_LOAD_TIMEOUT_MS).toBe(8000);
    const textarea = screen.getByRole("textbox", { name: "work/a.sv (editable)" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveValue("module a;\nendmodule\n");
    expect(textarea).toHaveClass("font-mono");
    expect(screen.getByRole("status")).toHaveTextContent(EDITOR_FALLBACK_NOTE);
    expect(textarea).toHaveAccessibleDescription(PLAIN_EDITOR_TAB_HINT);
    expect(screen.queryByText(EDITOR_LOADING_TEXT)).not.toBeInTheDocument();
    expect(onFallbackChange).toHaveBeenLastCalledWith(true);
  });

  it("falls back at once when the Monaco loader fails (CDN blocked or offline)", async () => {
    mocks.behaviour = "never";
    mocks.init = () => Promise.reject(new Error("script error"));
    render(<Harness loadTimeoutMs={60_000} />);
    expect(await plainEditor()).toBeInTheDocument();
    expect(screen.getByText(EDITOR_FALLBACK_NOTE)).toBeInTheDocument();
    // Monaco cannot come back, so no switch is offered.
    expect(screen.queryByRole("button", { name: EDITOR_SWITCH_LABEL })).not.toBeInTheDocument();
  });

  it("falls back when Monaco throws while rendering", async () => {
    mocks.behaviour = "throw";
    mocks.init = () => new Promise(() => undefined);
    render(<Harness loadTimeoutMs={60_000} />);
    expect(await plainEditor()).toBeInTheDocument();
    expect(screen.getByText(EDITOR_FALLBACK_NOTE)).toBeInTheDocument();
  });

  it("keeps the value and onChange contract in the plain editor", async () => {
    mocks.behaviour = "never";
    mocks.init = () => Promise.reject(new Error("offline"));
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const textarea = await plainEditor();

    fireEvent.change(textarea, { target: { value: "module b;" } });
    expect(onValue).toHaveBeenLastCalledWith("module b;");
    expect(textarea).toHaveValue("module b;");
  });

  it("inserts two spaces for Tab at the caret, and lets Esc then Tab or Shift+Tab move focus", async () => {
    mocks.behaviour = "never";
    mocks.init = () => Promise.reject(new Error("offline"));
    const onValue = vi.fn();
    render(<Harness initial="ab" onValue={onValue} />);
    const textarea = await plainEditor();
    textarea.focus();
    textarea.setSelectionRange(1, 1);

    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(false);
    expect(onValue).toHaveBeenLastCalledWith("a  b");
    expect(textarea).toHaveValue("a  b");
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(3);

    // A selection is replaced by the indent.
    textarea.setSelectionRange(0, 1);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea).toHaveValue("    b");

    onValue.mockClear();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true })).toBe(true);
    expect(onValue).not.toHaveBeenCalled();

    // Esc releases only the next key: Tab indents again afterwards.
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(false);
    expect(onValue).toHaveBeenCalledTimes(1);
  });

  it("is read-only when asked: no Tab capture and no Tab hint", async () => {
    mocks.behaviour = "never";
    mocks.init = () => Promise.reject(new Error("offline"));
    const onValue = vi.fn();
    render(<Harness readOnly onValue={onValue} />);
    const textarea = await plainEditor();
    expect(textarea).toHaveAttribute("readonly");
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(true);
    expect(onValue).not.toHaveBeenCalled();
    expect(screen.queryByText(PLAIN_EDITOR_TAB_HINT)).not.toBeInTheDocument();
  });

  it("brings Monaco back by itself after a slow load when the plain editor was not used", async () => {
    const load = deferred();
    mocks.behaviour = "never";
    mocks.init = () => load.promise;
    const onFallbackChange = vi.fn();
    render(<Harness loadTimeoutMs={30} onFallbackChange={onFallbackChange} />);
    expect(await plainEditor()).toBeInTheDocument();

    mocks.behaviour = "mount";
    await act(async () => {
      load.resolve();
      await load.promise;
    });
    expect(await screen.findByTestId("monaco")).toHaveValue("module a;\nendmodule\n");
    expect(screen.getByRole("status")).toHaveTextContent(EDITOR_RECOVERED_NOTE);
    expect(onFallbackChange).toHaveBeenLastCalledWith(false);
    expect(mocks.focus).not.toHaveBeenCalled();
  });

  it("offers a switch instead once the learner has used the plain editor, and focuses Monaco after it", async () => {
    const load = deferred();
    mocks.behaviour = "never";
    mocks.init = () => load.promise;
    render(<Harness loadTimeoutMs={30} />);
    const textarea = await plainEditor();
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "typed while waiting" } });

    mocks.behaviour = "mount";
    await act(async () => {
      load.resolve();
      await load.promise;
    });
    expect(screen.queryByTestId("monaco")).not.toBeInTheDocument();
    const switchButton = screen.getByRole("button", { name: EDITOR_SWITCH_LABEL });

    fireEvent.click(switchButton);
    expect(await screen.findByTestId("monaco")).toHaveValue("typed while waiting");
    expect(mocks.focus).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: EDITOR_SWITCH_LABEL })).not.toBeInTheDocument();
  });

  it("keeps one status region mounted across the switch so the change is announced", async () => {
    mocks.behaviour = "never";
    mocks.init = () => new Promise(() => undefined);
    render(<Harness loadTimeoutMs={30} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    await plainEditor();
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(EDITOR_FALLBACK_NOTE);
  });
});

describe("editorLoadReducer", () => {
  it("ignores a loader failure once Monaco has mounted, but not a render error", () => {
    const mounted = editorLoadReducer(initialEditorLoadState, { type: "mounted" });
    expect(editorLoadReducer(mounted, { type: "failed", source: "loader" })).toBe(mounted);
    expect(editorLoadReducer(mounted, { type: "failed", source: "render" })).toMatchObject({ mode: "plain", reason: "error" });
    expect(editorLoadReducer(mounted, { type: "timeout" })).toBe(mounted);
  });

  it("never brings Monaco back after an error, and only switches after a timeout once Monaco is available", () => {
    const failed = editorLoadReducer(initialEditorLoadState, { type: "failed", source: "loader" });
    expect(editorLoadReducer(failed, { type: "available" })).toBe(failed);
    expect(editorLoadReducer(failed, { type: "switch" })).toBe(failed);

    const timedOut = editorLoadReducer(editorLoadReducer(initialEditorLoadState, { type: "timeout" }), { type: "touched" });
    expect(editorLoadReducer(timedOut, { type: "switch" })).toBe(timedOut);
    const available = editorLoadReducer(timedOut, { type: "available" });
    expect(available).toMatchObject({ mode: "plain", available: true });
    expect(editorLoadReducer(available, { type: "switch" })).toMatchObject({ mode: "monaco", focusOnMount: true, recovered: true });
  });
});
