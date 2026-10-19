import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LabGrader } from "@/lib/lab-graders";
import {
  canRevealSolutions,
  GRADED_SUBMISSION_STATUS,
  SUBMISSION_FILE_MAX_CHARS,
  toLabPolicyInput,
  type GraderLookup,
} from "@/lib/lab-progress-policy";
import {
  createAccountLabProgressStore,
  createBrowserLabProgressStore,
  LAB_ERROR_MESSAGES,
  labErrorMessage,
  labSaveOutcomeMessage,
  normalizeLabProgress,
} from "@/lib/lab-progress-store";
import {
  __resetRecordsForTests,
  __resetStorageForTests,
  ACTIVITY_KEY,
  LAB_FILE_MAX_CHARS,
  LAB_TOTAL_MAX_CHARS,
  getStorageStatus,
  labProgressRecords,
  localDayKey,
  recoveredKeyFor,
  type LabProgressRecord,
} from "@/lib/learner-store";
import { getAllLabs, getLabById } from "@/lib/lab-registry";
import type { LabPolicyInput } from "@/types/lab";

const NOW = Date.UTC(2026, 9, 18, 10, 0, 0);
const originalStorage = window.localStorage;

const basics = getLabById("basics-1")!;
const basicsPolicy = toLabPolicyInput(basics);
const basicsDir = path.join(process.cwd(), basics.assetLocation);
const STARTER_TB = fs.readFileSync(path.join(basicsDir, "work/tb_counter_unrefactored.sv"), "utf8");
const STARTER_DUT = fs.readFileSync(path.join(basicsDir, "work/dut_counter.sv"), "utf8");
const SOLUTION_TB = fs.readFileSync(path.join(basicsDir, "solution/tb_counter_refactored.sv"), "utf8");

const policy: LabPolicyInput = {
  id: "demo-lab",
  version: "2",
  steps: [
    { id: "one", version: "1", completion: "self_attested" },
    { id: "two", version: "1", completion: "self_attested" },
  ],
  editablePaths: ["work/a.sv", "work/b.sv"],
};

const key = (version = "2", labId = "demo-lab") => labProgressRecords.keyFor(`${labId}@${version}`);

function stored(version = "2", labId = "demo-lab"): { v: number; data: LabProgressRecord } | null {
  const raw = window.localStorage.getItem(key(version, labId));
  return raw ? JSON.parse(raw) : null;
}

function record(overrides: Partial<LabProgressRecord> = {}): LabProgressRecord {
  return {
    labId: "demo-lab",
    labVersion: "2",
    currentStepId: "one",
    completedSteps: [],
    stepEvidence: {},
    fileBuffers: {},
    status: "in_progress",
    startedAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...overrides,
  };
}

function seed(value: LabProgressRecord, version = value.labVersion, labId = value.labId): void {
  window.localStorage.setItem(key(version, labId), JSON.stringify({ v: 1, data: value }));
}

function useQuotaStorage(): void {
  const values = new Map<string, string>();
  const storage: Storage = {
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
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });
}

describe("browser lab progress store", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { value: originalStorage, configurable: true, writable: true });
    __resetStorageForTests();
    __resetRecordsForTests();
    originalStorage.clear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    Object.defineProperty(window, "localStorage", { value: originalStorage, configurable: true, writable: true });
    __resetStorageForTests();
  });

  it("loads an empty state that never writes, then round-trips the workspace and the current step", async () => {
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    const first = await store.load();
    expect(first).toEqual({
      progress: { currentStepId: "one", completedSteps: [], stepEvidence: {}, fileBuffers: {}, status: "in_progress" },
      olderVersions: [],
    });
    expect(window.localStorage.getItem(key())).toBeNull();

    // Step two is still locked, so the new record keeps the first step.
    await expect(store.saveWorkspace({ "work/a.sv": "module a; endmodule" }, "two")).resolves.toBe("saved");
    expect(stored()).toEqual({
      v: 1,
      data: expect.objectContaining({
        labId: "demo-lab",
        labVersion: "2",
        currentStepId: "one",
        fileBuffers: { "work/a.sv": "module a; endmodule" },
        startedAt: NOW,
        updatedAt: NOW,
      }),
    });

    // Once step one is done, both steps are open and the chosen one round-trips.
    await store.completeSelfAttestedStep("one");
    expect(stored()?.data.currentStepId).toBe("two");
    await expect(store.saveWorkspace({ "work/a.sv": "module a; endmodule" }, "one")).resolves.toBe("saved");
    expect(stored()?.data.currentStepId).toBe("one");

    const reloaded = await createBrowserLabProgressStore(policy).load();
    expect(reloaded.progress).toMatchObject({ currentStepId: "one", fileBuffers: { "work/a.sv": "module a; endmodule" } });
  });

  it("writes nothing when the workspace and step are unchanged", async () => {
    seed(record({ fileBuffers: { "work/a.sv": "same" } }));
    const before = window.localStorage.getItem(key());
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    await expect(store.saveWorkspace({ "work/a.sv": "same" }, "one")).resolves.toBe("saved");
    expect(window.localStorage.getItem(key())).toBe(before);
  });

  it("copies a corrupt record to recovered:* on the first save, and reads it as empty until then", async () => {
    window.localStorage.setItem(key(), "{not json");
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    expect((await store.load()).progress.completedSteps).toEqual([]);
    expect(window.localStorage.getItem(key())).toBe("{not json");

    await expect(store.saveWorkspace({ "work/a.sv": "fresh" }, "one")).resolves.toBe("saved");
    expect(window.localStorage.getItem(recoveredKeyFor(key()))).toBe("{not json");
    expect(stored()?.data.fileBuffers).toEqual({ "work/a.sv": "fresh" });
  });

  it("keeps the workspace in memory for the visit when setItem hits the quota", async () => {
    useQuotaStorage();
    __resetStorageForTests();
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    await expect(store.saveWorkspace({ "work/a.sv": "kept in memory" }, "one")).resolves.toBe("memory-only");
    expect(getStorageStatus()).toBe("full");
    expect((await store.load()).progress.fileBuffers).toEqual({ "work/a.sv": "kept in memory" });
    expect(labSaveOutcomeMessage("memory-only")).toMatch(/Download files/);
  });

  it("refuses an oversized file or a lab budget overrun with 'too-large' and writes nothing", async () => {
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    await expect(store.saveWorkspace({ "work/a.sv": "x".repeat(LAB_FILE_MAX_CHARS + 1) }, "one")).resolves.toBe("too-large");
    expect(window.localStorage.getItem(key())).toBeNull();

    // Other labs already hold nearly the whole 1 000 000-character budget.
    const filler = "y".repeat(120_000);
    for (let index = 0; index < 8; index += 1) {
      seed(record({ labId: `other-${index}`, labVersion: "1", fileBuffers: { "f.sv": filler } }));
    }
    await expect(store.saveWorkspace({ "work/a.sv": "z".repeat(60_000) }, "one")).resolves.toBe("too-large");
    expect(window.localStorage.getItem(key())).toBeNull();
    expect(LAB_TOTAL_MAX_CHARS).toBe(1_000_000);
    expect(labSaveOutcomeMessage("too-large")).toMatch(/128,000 characters per file/);
  });

  it("lists a record for another version of the lab and can delete it", async () => {
    seed(record({ labVersion: "1", fileBuffers: { "old.sv": "old work" }, updatedAt: 500 }), "1");
    seed(record({ labId: "unrelated" }), "2", "unrelated");
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    expect((await store.load()).olderVersions).toEqual([{ version: "1", updatedAt: 500, fileBuffers: { "old.sv": "old work" } }]);
    expect(store.olderVersions()).toHaveLength(1);

    store.removeOlderVersion("2");
    store.removeOlderVersion("1");
    expect(window.localStorage.getItem(key("1"))).toBeNull();
    expect(store.olderVersions()).toEqual([]);
    expect(window.localStorage.getItem(key("2", "unrelated"))).not.toBeNull();
  });

  it("drops unknown paths, unknown steps and oversized buffers on load, without writing", async () => {
    seed(record({
      currentStepId: "ghost",
      completedSteps: ["ghost", "one"],
      stepEvidence: {
        one: { kind: "self_attested", stepVersion: "1", recordedAt: 1 },
        ghost: { kind: "self_attested", stepVersion: "1", recordedAt: 1 },
      },
      fileBuffers: { "work/a.sv": "kept", "../escape.sv": "dropped", "README.md": "dropped" },
    }));
    const raw = window.localStorage.getItem(key())!;
    const big = JSON.parse(raw);
    big.data.fileBuffers["work/b.sv"] = "x".repeat(LAB_FILE_MAX_CHARS + 1);
    window.localStorage.setItem(key(), JSON.stringify(big));

    const { progress } = await createBrowserLabProgressStore(policy).load();
    expect(progress).toEqual({
      currentStepId: "two",
      completedSteps: ["one"],
      stepEvidence: { one: { kind: "self_attested", stepVersion: "1", recordedAt: 1 } },
      fileBuffers: { "work/a.sv": "kept" },
      status: "in_progress",
    });
    expect(normalizeLabProgress(policy, null).currentStepId).toBe("one");
  });

  it("keeps the stored current step only while the policy unlocks it", () => {
    const three: LabPolicyInput = {
      ...policy,
      steps: [...policy.steps, { id: "three", version: "1", completion: "self_attested" }],
    };
    const source = (currentStepId: string | null, completedSteps: string[]) => ({
      currentStepId,
      completedSteps,
      stepEvidence: {},
      fileBuffers: {},
    });

    // An imported backup that points past the steps it has completed.
    expect(normalizeLabProgress(three, source("three", [])).currentStepId).toBe("one");
    expect(normalizeLabProgress(three, source("two", [])).currentStepId).toBe("one");
    expect(normalizeLabProgress(three, source("three", ["one"])).currentStepId).toBe("two");
    // Unlocked steps stay, completed ones included, so a learner can revisit them.
    expect(normalizeLabProgress(three, source("two", ["one"])).currentStepId).toBe("two");
    expect(normalizeLabProgress(three, source("one", ["one", "two"])).currentStepId).toBe("one");
    expect(normalizeLabProgress(three, source("three", ["one", "two"])).currentStepId).toBe("three");
    // A missing or unknown step falls back to the first incomplete step, or the last once all are done.
    expect(normalizeLabProgress(three, source(null, ["one"])).currentStepId).toBe("two");
    expect(normalizeLabProgress(three, source("ghost", ["one", "two", "three"])).currentStepId).toBe("three");
  });

  it("opens the first incomplete step when a stored record points at a locked one, without writing", async () => {
    seed(record({ currentStepId: "two", completedSteps: [] }));
    const before = window.localStorage.getItem(key());
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    expect((await store.load()).progress).toMatchObject({ currentStepId: "one", completedSteps: [], status: "in_progress" });
    expect(window.localStorage.getItem(key())).toBe(before);
  });

  it("keeps a completion another tab wrote when a stale tab autosaves", async () => {
    const staleTab = createBrowserLabProgressStore(policy, { now: () => NOW });
    const otherTab = createBrowserLabProgressStore(policy, { now: () => NOW + 1 });
    await staleTab.load();
    await staleTab.saveWorkspace({ "work/a.sv": "draft 1" }, "one");

    await expect(otherTab.completeSelfAttestedStep("one")).resolves.toMatchObject({ ok: true });
    // A third tab writes storage directly, as another browser tab would.
    const direct = stored()!;
    direct.data.completedSteps = ["one", "two"];
    direct.data.status = "completed";
    direct.data.completedAt = NOW + 2;
    window.localStorage.setItem(key(), JSON.stringify(direct));

    await expect(staleTab.saveWorkspace({ "work/a.sv": "draft 2" }, "one")).resolves.toBe("saved");
    expect(stored()?.data).toMatchObject({
      completedSteps: ["one", "two"],
      status: "completed",
      completedAt: NOW + 2,
      fileBuffers: { "work/a.sv": "draft 2" },
      currentStepId: "one",
    });
    expect(stored()?.data.stepEvidence.one).toEqual({ kind: "self_attested", stepVersion: "1", recordedAt: NOW + 1 });
  });

  it("completes self-attested steps in order, keeps the stored workspace, and records activity", async () => {
    seed(record({ fileBuffers: { "work/a.sv": "mine" } }));
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });

    await expect(store.completeSelfAttestedStep("two")).resolves.toEqual({ ok: false, code: "LAB_PREVIOUS_STEP_INCOMPLETE" });
    const first = await store.completeSelfAttestedStep("one");
    expect(first).toMatchObject({ ok: true, outcome: "saved", progress: { currentStepId: "two", status: "in_progress" } });
    const last = await store.completeSelfAttestedStep("two");
    expect(last).toMatchObject({ ok: true, progress: { status: "completed", completedAt: NOW, completedSteps: ["one", "two"] } });
    expect(stored()?.data).toMatchObject({ status: "completed", fileBuffers: { "work/a.sv": "mine" } });

    const activity = JSON.parse(window.localStorage.getItem(ACTIVITY_KEY)!);
    expect(activity.data.days[localDayKey(NOW)]).toEqual({ "lab-step": 1, "lab-complete": 1 });

    // Recording a finished step again adds no activity.
    await store.completeSelfAttestedStep("two");
    expect(JSON.parse(window.localStorage.getItem(ACTIVITY_KEY)!).data.days[localDayKey(NOW)]).toEqual({
      "lab-step": 1,
      "lab-complete": 1,
    });
  });

  it("reports a completion that could not be stored as not recorded, and adds no activity", async () => {
    // A stored record within a few characters of the per-lab cap (both files under the per-file cap):
    // adding the step's evidence overflows it.
    const base = record({ fileBuffers: { "work/a.sv": "a".repeat(127_950), "work/b.sv": "" } });
    const overhead = JSON.stringify({ v: 1, data: base }).length;
    base.fileBuffers["work/b.sv"] = "b".repeat(256_000 - 10 - overhead);
    expect(base.fileBuffers["work/b.sv"].length).toBeLessThanOrEqual(LAB_FILE_MAX_CHARS);
    seed(base);
    const before = window.localStorage.getItem(key());
    expect(before!.length).toBe(256_000 - 10);

    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    await expect(store.completeSelfAttestedStep("one")).resolves.toEqual({ ok: false, code: "too-large", outcome: "too-large" });
    expect(window.localStorage.getItem(key())).toBe(before);
    expect(window.localStorage.getItem(ACTIVITY_KEY)).toBeNull();
    expect((await store.load()).progress.completedSteps).toEqual([]);
  });

  it("resets this version's record only", async () => {
    seed(record({ completedSteps: ["one"] }));
    seed(record({ labVersion: "1" }), "1");
    const store = createBrowserLabProgressStore(policy);
    await expect(store.reset()).resolves.toBe("saved");
    expect(window.localStorage.getItem(key())).toBeNull();
    expect(window.localStorage.getItem(key("1"))).not.toBeNull();
    expect((await store.load()).progress.completedSteps).toEqual([]);
  });

  it("grades basics-1 in the browser: the starter fails, the reference passes with origin 'browser' evidence", async () => {
    const store = createBrowserLabProgressStore(basicsPolicy, { now: () => NOW });
    await store.completeSelfAttestedStep("run-starter");

    const starter = await store.checkGradedStep("write-task", [
      { path: "work/dut_counter.sv", content: STARTER_DUT },
      { path: "work/tb_counter_unrefactored.sv", content: STARTER_TB },
    ]);
    expect(starter).toMatchObject({ ok: true, result: { success: false }, progress: null });
    expect(starter.ok && starter.result.hint).toContain("task automatic drive_sequence");

    const solved = await store.checkGradedStep("write-task", [
      { path: "work/dut_counter.sv", content: STARTER_DUT },
      { path: "work/tb_counter_unrefactored.sv", content: SOLUTION_TB },
    ]);
    expect(solved).toMatchObject({ ok: true, result: { success: true }, progress: { currentStepId: "call-task" } });
    expect(stored("2", "basics-1")?.data.stepEvidence["write-task"]).toEqual({
      kind: "graded",
      graderId: "sv-basics-v2",
      graderVersion: "1",
      stepVersion: "1",
      recordedAt: NOW,
      origin: "browser",
    });
  });

  it("returns the run route's precheck codes without grading", async () => {
    const grade = vi.fn();
    const sandboxed: GraderLookup = {
      get: () => ({ id: "sv-basics-v2", version: "1", requiresSandbox: true, grade } as unknown as LabGrader),
    };
    const store = createBrowserLabProgressStore(basicsPolicy, { registry: sandboxed });
    await expect(store.checkGradedStep("run-starter", [{ path: "work/dut_counter.sv", content: "" }])).resolves.toEqual({
      ok: false,
      code: "LAB_STEP_IS_SELF_ATTESTED",
    });
    await expect(store.checkGradedStep("write-task", [{ path: "README.md", content: "" }])).resolves.toEqual({
      ok: false,
      code: "INVALID_SUBMISSION_FILE",
    });
    await expect(store.checkGradedStep("write-task", [{ path: "work/dut_counter.sv", content: "" }])).resolves.toEqual({
      ok: false,
      code: "GRADING_QUEUE_UNAVAILABLE",
    });
    expect(grade).not.toHaveBeenCalled();
  });

  it("completes each of the 21 self-attested-only labs from local state alone", async () => {
    const selfChecked = getAllLabs().filter(
      (lab) => lab.status === "available" && lab.steps.every((step) => step.completion === "self_attested"),
    );
    expect(selfChecked).toHaveLength(21);
    for (const lab of selfChecked) {
      const store = createBrowserLabProgressStore(toLabPolicyInput(lab), { now: () => NOW });
      for (const step of lab.steps) {
        await expect(store.completeSelfAttestedStep(step.id), `${lab.id} ${step.id}`).resolves.toMatchObject({ ok: true, outcome: "saved" });
      }
      const { progress } = await createBrowserLabProgressStore(toLabPolicyInput(lab)).load();
      expect(progress.status, lab.id).toBe("completed");
      expect(progress.completedSteps).toEqual(lab.steps.map((step) => step.id));
      expect(canRevealSolutions(progress)).toBe(true);
    }
  });

  it("notifies subscribers when the record changes", async () => {
    const store = createBrowserLabProgressStore(policy, { now: () => NOW });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.saveWorkspace({ "work/a.sv": "a" }, "one");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("account lab progress store", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  const dto = { currentStepId: "two", completedSteps: ["one"], fileBuffers: { "work/a.sv": "server copy" } };

  it("loads progress with GET /api/me/labs/:id/progress", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(dto));
    const store = createAccountLabProgressStore(policy, fetchImpl);
    await expect(store.load()).resolves.toEqual({
      progress: {
        currentStepId: "two",
        completedSteps: ["one"],
        stepEvidence: {},
        fileBuffers: { "work/a.sv": "server copy" },
        status: "in_progress",
      },
      olderVersions: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/me/labs/demo-lab/progress", expect.objectContaining({ cache: "no-store" }));
  });

  it("rejects a failed load with the API's error code", async () => {
    const store = createAccountLabProgressStore(policy, vi.fn(async () => jsonResponse({ error: "UNAUTHORIZED" }, 401)));
    await expect(store.load()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("saves the workspace with PATCH and reports 'server-error' on failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(dto));
    const store = createAccountLabProgressStore(policy, fetchImpl);
    await expect(store.saveWorkspace({ "work/a.sv": "edit", "README.md": "dropped" }, "two")).resolves.toBe("saved");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/me/labs/demo-lab/progress");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ labVersion: "2", currentStepId: "two", fileBuffers: { "work/a.sv": "edit" } });

    const failing = createAccountLabProgressStore(policy, vi.fn(async () => jsonResponse({ error: "UNAUTHORIZED" }, 401)));
    await expect(failing.saveWorkspace({ "work/a.sv": "edit" }, "one")).resolves.toBe("server-error");
    await expect(failing.saveWorkspace({ "work/a.sv": "x".repeat(LAB_FILE_MAX_CHARS + 1) }, "one")).resolves.toBe("too-large");
  });

  it("records a self-attested step with POST /api/me/labs/:id/progress", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ...dto, completedSteps: ["one", "two"] }));
    const store = createAccountLabProgressStore(policy, fetchImpl);
    await expect(store.completeSelfAttestedStep("two")).resolves.toMatchObject({
      ok: true,
      outcome: "saved",
      progress: { completedSteps: ["one", "two"], status: "completed" },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/me/labs/demo-lab/progress");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ labVersion: "2", stepId: "two", stepVersion: "1", completion: "self_attested" });

    const refused = createAccountLabProgressStore(policy, vi.fn(async () => jsonResponse({ error: "LAB_PREVIOUS_STEP_INCOMPLETE" }, 409)));
    await expect(refused.completeSelfAttestedStep("two")).resolves.toEqual({ ok: false, code: "LAB_PREVIOUS_STEP_INCOMPLETE" });
  });

  it("checks a graded step with POST /api/labs/run and uses the server's progress", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      success: true,
      hint: "Task shape check passed.",
      diagnostics: [],
      progress: { currentStepId: "call-task", completedSteps: ["run-starter", "write-task"], fileBuffers: {} },
    }));
    const store = createAccountLabProgressStore(basicsPolicy, fetchImpl);
    const files = [{ path: "work/tb_counter_unrefactored.sv", content: SOLUTION_TB }];
    await expect(store.checkGradedStep("write-task", files)).resolves.toMatchObject({
      ok: true,
      result: { success: true, hint: "Task shape check passed." },
      progress: { currentStepId: "call-task", completedSteps: ["run-starter", "write-task"] },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/labs/run");
    expect(JSON.parse(String(init.body))).toEqual({
      labId: "basics-1",
      labVersion: "2",
      stepId: "write-task",
      stepVersion: "1",
      files,
    });

    const unauthorized = createAccountLabProgressStore(basicsPolicy, vi.fn(async () => jsonResponse({ error: "UNAUTHORIZED" }, 401)));
    await expect(unauthorized.checkGradedStep("write-task", files)).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
  });

  it("resets the server workspace with PATCH and has no older versions or cross-tab events", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(dto));
    const store = createAccountLabProgressStore(policy, fetchImpl);
    await expect(store.reset()).resolves.toBe("saved");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ labVersion: "2", currentStepId: "one", fileBuffers: {} });
    expect(store.olderVersions()).toEqual([]);
    const unsubscribe = store.subscribe(() => undefined);
    expect(typeof unsubscribe).toBe("function");
    expect(store.kind).toBe("account");
  });

  it("maps a network failure to an error code instead of throwing", async () => {
    const store = createAccountLabProgressStore(policy, vi.fn(async () => {
      throw new TypeError("offline");
    }));
    await expect(store.saveWorkspace({ "work/a.sv": "a" }, "one")).resolves.toBe("server-error");
    await expect(store.completeSelfAttestedStep("one")).resolves.toMatchObject({ ok: false, outcome: "server-error" });
    await expect(store.load()).rejects.toMatchObject({ code: "LAB_PROGRESS_UNAVAILABLE" });
  });
});

describe("lab error messages", () => {
  // Every code the lab flow can return: the policy prechecks and completion (browser store),
  // the browser grader and store, and the account API routes.
  const codes = [
    ...Object.keys(GRADED_SUBMISSION_STATUS),
    "LAB_STEP_NOT_FOUND",
    "LAB_COMPLETION_POLICY_MISMATCH",
    "LAB_PREVIOUS_STEP_INCOMPLETE",
    "LAB_GRADING_UNAVAILABLE",
    "LAB_GRADING_MALFORMED",
    "LAB_PROGRESS_MALFORMED",
    "LAB_PROGRESS_UNAVAILABLE",
    "LAB_NOT_FOUND",
    "LAB_STEP_REQUIRES_GRADER",
    "INVALID_LAB_SUBMISSION",
    "INVALID_LAB_COMPLETION",
    "INVALID_LAB_PROGRESS",
    "UNAUTHORIZED",
  ];

  it("gives every lab code a plain sentence that never shows the code", () => {
    for (const code of codes) {
      expect(Object.keys(LAB_ERROR_MESSAGES), code).toContain(code);
      const message = labErrorMessage(code);
      expect(message, code).toBe(LAB_ERROR_MESSAGES[code]);
      expect(message, code).not.toMatch(/[A-Z]{2,}_[A-Z]/);
      expect(message, code).toMatch(/^[A-Z].*\.$/);
      expect(message.toLowerCase(), code).not.toContain("sign in");
    }
  });

  it("says what to do for the common cases", () => {
    expect(labErrorMessage("LAB_PREVIOUS_STEP_INCOMPLETE")).toBe("Finish the earlier steps first.");
    expect(labErrorMessage("INVALID_SUBMISSION_FILE")).toContain(
      `at most ${SUBMISSION_FILE_MAX_CHARS.toLocaleString("en-US")} characters per file`,
    );
    expect(labErrorMessage("INVALID_SUBMISSION_FILE")).toBe(labErrorMessage("INVALID_LAB_SUBMISSION"));
    expect(labErrorMessage("GRADER_NOT_FOUND")).toMatch(/Reload the page/);
    expect(labErrorMessage("LAB_GRADING_UNAVAILABLE")).toMatch(/could not run/);
    expect(labErrorMessage("GRADING_QUEUE_UNAVAILABLE")).toBe("This check needs the simulator service, which is not available here.");
  });

  it("reads a save outcome returned as a code as its save message", () => {
    expect(labErrorMessage("too-large")).toBe(labSaveOutcomeMessage("too-large"));
    expect(labErrorMessage("blocked-corrupt")).toBe(labSaveOutcomeMessage("blocked-corrupt"));
    expect(labErrorMessage("server-error")).toBe(labSaveOutcomeMessage("server-error"));
    expect(labErrorMessage("not-in-browser")).toBe("Your work could not be saved.");
  });

  it("falls back to a generic sentence for an unknown code, citing it only when it looks like a code", () => {
    expect(labErrorMessage("HTTP_502")).toBe("Something went wrong (reference: HTTP_502). Reload the page and try again.");
    expect(labErrorMessage("Unexpected token < in JSON")).toBe("Something went wrong. Reload the page and try again.");
    expect(labErrorMessage("")).toBe("Something went wrong. Reload the page and try again.");
    expect(labErrorMessage("constructor")).toBe("Something went wrong (reference: constructor). Reload the page and try again.");
  });
});
