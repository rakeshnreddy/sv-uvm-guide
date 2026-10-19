import fs from "node:fs";
import path from "node:path";

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LabPage from "@/app/(learning)/practice/lab/[labId]/page";
import LabClientPage from "@/app/(learning)/practice/lab/[labId]/LabClientPage";
import { findRunSectionHeading, labWorkspaceEntries } from "@/app/(learning)/practice/lab/[labId]/LabRunLocally";
import { LAB_AUTOSAVE_DELAY_MS } from "@/app/(learning)/practice/lab/[labId]/useLabWorkspace";
import {
  __resetRecordsForTests,
  __resetStorageForTests,
  LAB_FILE_MAX_CHARS,
  labProgressRecords,
} from "@/lib/learner-store";
import { getLabById } from "@/lib/lab-registry";

const mocks = vi.hoisted(() => ({ simulation: false }));

// next/dynamic resolves its loader through React.lazy, so Monaco and the simulation panel load as they would in the app.
vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");
  return {
    default: (loader: () => Promise<unknown>) => {
      const Lazy = ReactModule.lazy(async () => {
        const loaded = (await loader()) as React.ComponentType<Record<string, unknown>> | { default: React.ComponentType<Record<string, unknown>> };
        return { default: typeof loaded === "function" ? loaded : loaded.default };
      });
      return function DynamicComponent(props: Record<string, unknown>) {
        return ReactModule.createElement(ReactModule.Suspense, { fallback: null }, ReactModule.createElement(Lazy, props));
      };
    },
  };
});

// Monaco as a plain textarea with the editor's accessible name.
vi.mock("@monaco-editor/react", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ value, onChange, options }: {
      value: string;
      onChange?: (value: string | undefined) => void;
      options?: { readOnly?: boolean; ariaLabel?: string };
    }) => ReactModule.createElement("textarea", {
      "aria-label": options?.ariaLabel ?? "Code editor",
      value,
      readOnly: options?.readOnly,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
    }),
  };
});

vi.mock("@/components/ui/CodeExecutionEnvironment", async () => {
  const ReactModule = await import("react");
  return {
    CodeExecutionEnvironment: () => ReactModule.createElement("div", { "data-testid": "simulation-panel" }, "Simulation panel"),
  };
});

vi.mock("@/lib/persistence/target", () => ({
  useAccountSession: () => ({ status: "disabled", userId: null }),
  usePersistenceTarget: () => ({ target: "local", ready: true }),
  useServerFeature: (feature: string) => (feature === "simulation" ? mocks.simulation : false),
}));

type LabProps = React.ComponentProps<typeof LabClientPage>;

const originalStorage = window.localStorage;
const basicsDir = path.join(process.cwd(), getLabById("basics-1")!.assetLocation);
const SOLUTION_TB = fs.readFileSync(path.join(basicsDir, "solution/tb_counter_refactored.sv"), "utf8");
const labKey = (labId: string, version: string) => labProgressRecords.keyFor(`${labId}@${version}`);

async function propsFor(labId: string): Promise<LabProps> {
  const element = (await LabPage({ params: { labId } })) as React.ReactElement<LabProps>;
  return element.props;
}

async function renderLab(labId: string) {
  const props = await propsFor(labId);
  const view = render(<LabClientPage {...props} />);
  // Loaded once the first step's action is enabled.
  await waitFor(() => {
    const action = screen.getAllByRole("button").find((button) =>
      /^(Mark step complete & continue|Mark lab complete|Check solution)$/.test(button.textContent ?? ""),
    );
    expect(action).toBeDefined();
    expect(action).toBeEnabled();
  });
  return { props, ...view };
}

function wait(ms: number) {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
}

async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

async function editor(name: string | RegExp) {
  return (await screen.findByRole("textbox", { name })) as HTMLTextAreaElement;
}

function storedRecord(labId: string, version: string) {
  const raw = window.localStorage.getItem(labKey(labId, version));
  return raw ? JSON.parse(raw).data : null;
}

function throwingStorage(error: () => Error): Storage {
  return {
    get length(): number {
      throw error();
    },
    clear: () => {
      throw error();
    },
    key: () => {
      throw error();
    },
    getItem: () => {
      throw error();
    },
    setItem: () => {
      throw error();
    },
    removeItem: () => {
      throw error();
    },
  };
}

function useStorage(storage: Storage) {
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });
  __resetStorageForTests();
}

describe("LabClientPage (local mode)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.simulation = false;
    useStorage(originalStorage);
    __resetRecordsForTests();
    originalStorage.clear();
    fetchSpy = vi.fn(() => Promise.reject(new Error("no network in local mode")));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useStorage(originalStorage);
  });

  it("renders the steps and lab files from props without any request", async () => {
    await renderLab("basics-1");

    expect(screen.getByRole("heading", { level: 1, name: "Refactor Repeated Stimulus into a Task" })).toBeInTheDocument();
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("button");
    expect(steps.map((step) => step.textContent)).toEqual([
      "Step 1: Run the starter and record the counts",
      "Step 2: Write task automatic drive_sequence",
      "Step 3: Replace the three blocks with calls",
      "Step 4: Make the bench check itself",
    ]);
    expect(steps[1]).toBeDisabled();
    for (const file of ["README.md", "work/dut_counter.sv", "work/tb_counter_unrefactored.sv"]) {
      expect(screen.getByRole("button", { name: new RegExp(file.replace(/[.]/g, "\\.")) })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /solution\/tb_counter_refactored\.sv/ })).not.toBeInTheDocument();
    expect((await editor("work/dut_counter.sv (editable)")).value).toContain("module dut_counter");
    expect(screen.getByText("Your progress is saved in this browser.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("saves nothing before a learner edit, then autosaves the edit", async () => {
    await renderLab("basics-1");
    await wait(LAB_AUTOSAVE_DELAY_MS + 150);
    expect(window.localStorage.getItem(labKey("basics-1", "2"))).toBeNull();

    const tb = screen.getByRole("button", { name: /work\/tb_counter_unrefactored\.sv/ });
    fireEvent.click(tb);
    const textarea = await editor("work/tb_counter_unrefactored.sv (editable)");
    fireEvent.change(textarea, { target: { value: "// my edit\n" } });
    expect(window.localStorage.getItem(labKey("basics-1", "2"))).toBeNull();
    await wait(LAB_AUTOSAVE_DELAY_MS + 150);

    expect(storedRecord("basics-1", "2")).toMatchObject({
      currentStepId: "run-starter",
      completedSteps: [],
      fileBuffers: { "work/tb_counter_unrefactored.sv": "// my edit\n" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("advances on self-attested completion and restores the step and edits after a remount", async () => {
    const first = await renderLab("basics-1");
    fireEvent.click(screen.getByRole("button", { name: /work\/tb_counter_unrefactored\.sv/ }));
    fireEvent.change(await editor(/tb_counter_unrefactored/), { target: { value: "// kept across remounts\n" } });

    await click(screen.getByRole("button", { name: "Mark step complete & continue" }));
    expect(await screen.findByRole("heading", { name: "Step 2: Write task automatic drive_sequence" })).toBeInTheDocument();
    expect(screen.getByText("Step completed. Continue when ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check solution" })).toBeInTheDocument();
    first.unmount();

    await renderLab("basics-1");
    expect(await screen.findByRole("heading", { name: "Step 2: Write task automatic drive_sequence" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Steps" })).getAllByRole("button")[0]).toHaveTextContent("(completed)");
    fireEvent.click(screen.getByRole("button", { name: /work\/tb_counter_unrefactored\.sv/ }));
    expect((await editor(/tb_counter_unrefactored/)).value).toBe("// kept across remounts\n");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows another tab: its steps always, its files only while this tab has no unsaved edits", async () => {
    await renderLab("basics-1");
    const key = labKey("basics-1", "2");
    const otherTab = {
      v: 1,
      data: {
        labId: "basics-1",
        labVersion: "2",
        currentStepId: "write-task",
        completedSteps: ["run-starter"],
        stepEvidence: { "run-starter": { kind: "self_attested", stepVersion: "1", recordedAt: 1 } },
        fileBuffers: { "work/dut_counter.sv": "// other tab" },
        status: "in_progress",
        startedAt: 1,
        updatedAt: 2,
      },
    };
    const writeFromOtherTab = () => act(async () => {
      window.localStorage.setItem(key, JSON.stringify(otherTab));
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(otherTab) }));
    });

    await writeFromOtherTab();
    expect(await screen.findByRole("heading", { name: /^Step 2:/ })).toBeInTheDocument();
    expect((await editor("work/dut_counter.sv (editable)")).value).toBe("// other tab");

    fireEvent.change(await editor("work/dut_counter.sv (editable)"), { target: { value: "// this tab" } });
    otherTab.data = {
      ...otherTab.data,
      currentStepId: "call-task",
      completedSteps: ["run-starter", "write-task"],
      fileBuffers: { "work/dut_counter.sv": "// other tab again" },
      updatedAt: 3,
    };
    await writeFromOtherTab();
    expect(await screen.findByRole("heading", { name: /^Step 3:/ })).toBeInTheDocument();
    expect((await editor("work/dut_counter.sv (editable)")).value).toBe("// this tab");

    await wait(LAB_AUTOSAVE_DELAY_MS + 150);
    expect(storedRecord("basics-1", "2")).toMatchObject({
      currentStepId: "call-task",
      completedSteps: ["run-starter", "write-task"],
      fileBuffers: { "work/dut_counter.sv": "// this tab" },
    });
  });

  it("checks the basics-1 graded step in the browser: the starter fails, the reference passes", async () => {
    await renderLab("basics-1");
    await click(screen.getByRole("button", { name: "Mark step complete & continue" }));
    const check = await screen.findByRole("button", { name: "Check solution" });
    expect(screen.getByText("Structural check in your browser: it does not compile or simulate.")).toBeInTheDocument();

    await click(check);
    await waitFor(() => expect(screen.getByRole("button", { name: "Check solution" })).toBeEnabled());
    expect(document.querySelector("pre[aria-live]")?.textContent).toContain("task automatic drive_sequence");
    expect(screen.getByRole("heading", { name: "Step 2: Write task automatic drive_sequence" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /work\/tb_counter_unrefactored\.sv/ }));
    fireEvent.change(await editor(/tb_counter_unrefactored/), { target: { value: SOLUTION_TB } });
    await click(screen.getByRole("button", { name: "Check solution" }));

    expect(await screen.findByRole("heading", { name: "Step 3: Replace the three blocks with calls" })).toBeInTheDocument();
    expect(document.querySelector("pre[aria-live]")?.textContent).toBe("Task shape check passed.");
    expect(storedRecord("basics-1", "2")?.stepEvidence["write-task"]).toMatchObject({ kind: "graded", origin: "browser" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps solutions hidden until the lab is complete, then lists them and says so", async () => {
    const first = await renderLab("pss-portable-intent");
    expect(screen.getByRole("button", { name: /starter\/mem_test\.pss/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /solution\/generated_uvm_sequence\.sv/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Solutions unlocked/)).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "Mark step complete & continue" }));
    await click(await screen.findByRole("button", { name: "Mark step complete & continue" }));
    expect(screen.queryByRole("button", { name: /solution\// })).not.toBeInTheDocument();
    await click(await screen.findByRole("button", { name: "Mark lab complete" }));

    expect(await screen.findByText("Lab completed.")).toBeInTheDocument();
    expect(screen.getByText(/Solutions unlocked/)).toBeInTheDocument();
    for (const file of ["generated_baremetal_test.c", "generated_uvm_sequence.sv", "mem_test.pss"]) {
      expect(screen.getByRole("button", { name: new RegExp(`solution/${file.replace(/[.]/g, "\\.")}`) })).toBeInTheDocument();
    }
    expect(screen.getByText("This step is complete. Your progress and workspace edits are saved in this browser.")).toBeInTheDocument();
    first.unmount();

    await act(async () => {
      render(<LabClientPage {...(await propsFor("pss-portable-intent"))} />);
    });
    const solution = await screen.findByRole("button", { name: /solution\/generated_uvm_sequence\.sv/ });
    fireEvent.click(solution);
    expect(solution).toHaveAttribute("aria-pressed", "true");
    expect((await editor("solution/generated_uvm_sequence.sv (read-only)")).readOnly).toBe(true);
  });

  it("shows 'Run it on your simulator' instead of the simulation panel without the simulation feature", async () => {
    await renderLab("basics-1");
    expect(screen.getByRole("heading", { name: "Run it on your simulator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download workspace (.zip)" })).toBeInTheDocument();
    expect(screen.getByText(/“Running the lab”/)).toBeInTheDocument();
    expect(screen.queryByTestId("simulation-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open the guide" }));
    expect(await editor("README.md (read-only)")).toBeInTheDocument();
  });

  it("shows the simulation panel only when useServerFeature('simulation') is true", async () => {
    mocks.simulation = true;
    await renderLab("basics-1");
    expect(await screen.findByTestId("simulation-panel")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Run it on your simulator" })).not.toBeInTheDocument();
  });

  it("shows neither panel for a lab without editable SystemVerilog files", async () => {
    await renderLab("pss-portable-intent");
    expect(screen.queryByRole("heading", { name: "Run it on your simulator" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("simulation-panel")).not.toBeInTheDocument();
  });

  it("warns when this browser blocks storage", async () => {
    useStorage(throwingStorage(() => new DOMException("blocked", "SecurityError")));
    await renderLab("basics-1");
    expect(await screen.findByText(/This browser isn't saving your progress/)).toBeInTheDocument();
  });

  it("says when edits are kept only for this visit (storage full)", async () => {
    const values = new Map<string, string>();
    useStorage({
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (name) => values.get(name) ?? null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: (name) => void values.delete(name),
    });
    await renderLab("basics-1");
    fireEvent.change(await editor("work/dut_counter.sv (editable)"), { target: { value: "// edit" } });
    await wait(LAB_AUTOSAVE_DELAY_MS + 150);
    expect(await screen.findByText(/Kept for this visit only/)).toBeInTheDocument();
  });

  it("says when a file is too large to save, and writes nothing", async () => {
    await renderLab("basics-1");
    fireEvent.change(await editor("work/dut_counter.sv (editable)"), { target: { value: "x".repeat(LAB_FILE_MAX_CHARS + 1) } });
    await wait(LAB_AUTOSAVE_DELAY_MS + 150);
    expect(await screen.findByText(/Not saved: these files are too large/)).toBeInTheDocument();
    expect(window.localStorage.getItem(labKey("basics-1", "2"))).toBeNull();
  });

  it("keeps the step open and says so when a completion cannot be stored", async () => {
    // Saved work within a few characters of the per-lab cap: the step's evidence would overflow it.
    const data = {
      labId: "basics-1",
      labVersion: "2",
      currentStepId: "run-starter",
      completedSteps: [],
      stepEvidence: {},
      fileBuffers: { "work/dut_counter.sv": "a".repeat(127_950), "work/tb_counter_unrefactored.sv": "" },
      status: "in_progress",
      startedAt: 1,
      updatedAt: 1,
    };
    const overhead = JSON.stringify({ v: 1, data }).length;
    data.fileBuffers["work/tb_counter_unrefactored.sv"] = "b".repeat(256_000 - 10 - overhead);
    const raw = JSON.stringify({ v: 1, data });
    window.localStorage.setItem(labKey("basics-1", "2"), raw);

    await renderLab("basics-1");
    await click(screen.getByRole("button", { name: "Mark step complete & continue" }));
    expect(await screen.findByText("Your completion was not saved.")).toBeInTheDocument();
    expect(screen.getByText(/Not saved: these files are too large/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step 1: Run the starter and record the counts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark step complete & continue" })).toBeEnabled();
    expect(window.localStorage.getItem(labKey("basics-1", "2"))).toBe(raw);
  });

  it("resets the lab after a two-step inline confirm", async () => {
    await renderLab("basics-1");
    await click(screen.getByRole("button", { name: "Mark step complete & continue" }));
    await screen.findByRole("heading", { name: /^Step 2:/ });
    expect(storedRecord("basics-1", "2")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset lab" }));
    const group = screen.getByRole("group", { name: /Reset this lab\?/ });
    expect(within(group).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(within(group).getByRole("button", { name: "Cancel" }));
    expect(storedRecord("basics-1", "2")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset lab" }));
    await click(screen.getByRole("button", { name: "Yes, reset lab" }));
    expect(await screen.findByRole("heading", { name: /^Step 1:/ })).toBeInTheDocument();
    expect(screen.getByText("Lab reset. The starter files are back.")).toBeInTheDocument();
    expect(storedRecord("basics-1", "2")).toBeNull();
  });

  it("offers saved work from an older lab version as a download, and deletes it after confirming", async () => {
    window.localStorage.setItem(labKey("basics-1", "1"), JSON.stringify({
      v: 1,
      data: {
        labId: "basics-1",
        labVersion: "1",
        currentStepId: "1",
        completedSteps: ["1"],
        stepEvidence: {},
        fileBuffers: { "basics.sv": "int myVar;" },
        status: "in_progress",
        startedAt: 1,
        updatedAt: Date.UTC(2026, 0, 2),
      },
    }));
    const createObjectURL = vi.fn(() => "blob:lab");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await renderLab("basics-1");
    const notice = await screen.findByRole("group", { name: "Saved work from version 1" });
    expect(within(notice).getByText(/You have saved work from version 1 of this lab/)).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole("button", { name: "Download old files" }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(within(notice).getByText("Downloaded basics-1-v1-workspace.zip.")).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole("button", { name: "Delete old version" }));
    fireEvent.click(within(notice).getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Saved work from version 1" })).not.toBeInTheDocument());
    expect(screen.getByText("Deleted the saved work from version 1.")).toBeInTheDocument();
    expect(window.localStorage.getItem(labKey("basics-1", "1"))).toBeNull();
  });

  it("downloads the workspace with the current edits", async () => {
    const createObjectURL = vi.fn(() => "blob:lab");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await renderLab("basics-1");
    fireEvent.click(screen.getByRole("button", { name: "Download files" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Downloaded basics-1-v2-workspace.zip.")).toBeInTheDocument();
  });
});

describe("LabRunLocally helpers", () => {
  it("puts editable buffers over read-only files, adds solutions only when given, in one folder", () => {
    const entries = labWorkspaceEntries({
      labId: "basics-1",
      version: "2",
      editableBuffers: { "work/tb.sv": "edited" },
      readOnlyFiles: [{ path: "README.md", content: "# Guide" }],
    });
    expect(entries).toEqual([
      { path: "basics-1-v2/README.md", content: "# Guide" },
      { path: "basics-1-v2/work/tb.sv", content: "edited" },
    ]);
    expect(labWorkspaceEntries({
      labId: "basics-1",
      version: "2",
      editableBuffers: {},
      readOnlyFiles: [],
      solutions: [{ path: "solution/tb.sv", content: "answer" }],
    })).toEqual([{ path: "basics-1-v2/solution/tb.sv", content: "answer" }]);
  });

  it("finds the guide's run section and skips step headings", () => {
    expect(findRunSectionHeading("# Lab\n## Step 1: Run the starter\n## Running the lab\n")).toBe("Running the lab");
    expect(findRunSectionHeading("## Files and how to run\n")).toBe("Files and how to run");
    expect(findRunSectionHeading("## Overview\n")).toBeNull();
  });
});
