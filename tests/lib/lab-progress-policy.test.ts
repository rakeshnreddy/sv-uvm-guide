import { describe, expect, it, vi } from "vitest";

import { graderRegistry, type LabGrader, type LabSubmission } from "@/lib/lab-graders";
import {
  GRADED_SUBMISSION_STATUS,
  SUBMISSION_MAX_BYTES,
  WORKSPACE_FILE_MAX_CHARS,
  WORKSPACE_MAX_CHARS,
  WORKSPACE_MAX_FILES,
  applyStepCompletion,
  canRevealSolutions,
  checkGradedSubmission,
  emptyLabProgress,
  graderNeedsSandbox,
  isStepUnlocked,
  sanitizeWorkspace,
  toLabPolicyInput,
  utf8ByteLength,
  validateStepCompletion,
  type GraderLookup,
} from "@/lib/lab-progress-policy";
import { LAB_FILE_MAX_CHARS, LAB_RECORD_MAX_CHARS } from "@/lib/learner-store";
import { getLabById } from "@/lib/lab-registry";
import type { LabPolicyInput, LabProgressState } from "@/types/lab";

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);

const policy: LabPolicyInput = {
  id: "demo-lab",
  version: "3",
  graderId: "demo-grader",
  steps: [
    { id: "one", version: "1", completion: "self_attested" },
    { id: "two", version: "2", completion: "graded" },
    { id: "three", version: "1", completion: "self_attested" },
  ],
  editablePaths: ["work/a.sv", "work/b.sv"],
};

function progress(overrides: Partial<LabProgressState> = {}): LabProgressState {
  return { ...emptyLabProgress(policy), ...overrides };
}

function grader(overrides: Partial<LabGrader> = {}): LabGrader {
  return {
    id: "demo-grader",
    version: "7",
    requiresSandbox: false,
    grade: vi.fn(async () => ({ success: true, diagnostics: [] })),
    ...overrides,
  };
}

function registryOf(...graders: LabGrader[]): GraderLookup {
  return { get: (id) => graders.find((candidate) => candidate.id === id) };
}

function submission(overrides: Partial<LabSubmission> = {}): LabSubmission {
  return {
    labId: "demo-lab",
    labVersion: "3",
    stepId: "two",
    stepVersion: "2",
    files: [{ path: "work/a.sv", content: "module a; endmodule" }],
    ...overrides,
  };
}

describe("toLabPolicyInput", () => {
  it("keeps only ids, versions, completion kinds, the grader and the editable paths", () => {
    const lab = getLabById("basics-1")!;
    const input = toLabPolicyInput(lab);
    expect(input).toEqual({
      id: "basics-1",
      version: "2",
      graderId: "sv-basics-v2",
      steps: [
        { id: "run-starter", version: "1", completion: "self_attested" },
        { id: "write-task", version: "1", completion: "graded" },
        { id: "call-task", version: "1", completion: "graded" },
        { id: "self-check", version: "1", completion: "graded" },
      ],
      editablePaths: ["work/dut_counter.sv", "work/tb_counter_unrefactored.sv"],
    });
    // Serializable as page props: no instructions, starter code or asset roles.
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
  });

  it("omits graderId for a self-checked lab", () => {
    expect(toLabPolicyInput(getLabById("pss-portable-intent")!)).not.toHaveProperty("graderId");
  });
});

describe("applyStepCompletion", () => {
  it("rejects an unknown step, a completion kind that does not match, and a step whose predecessor is open", () => {
    expect(applyStepCompletion(policy, progress(), "nope", { kind: "self_attested" }, NOW)).toEqual({
      ok: false,
      code: "LAB_STEP_NOT_FOUND",
    });
    expect(applyStepCompletion(policy, progress(), "one", {
      kind: "graded",
      graderId: "demo-grader",
      graderVersion: "7",
      origin: "browser",
    }, NOW)).toEqual({ ok: false, code: "LAB_COMPLETION_POLICY_MISMATCH" });
    expect(applyStepCompletion(policy, progress(), "two", {
      kind: "graded",
      graderId: "demo-grader",
      graderVersion: "7",
      origin: "browser",
    }, NOW)).toEqual({ ok: false, code: "LAB_PREVIOUS_STEP_INCOMPLETE" });
    expect(validateStepCompletion(policy, "three", "self_attested")).toBeNull();
  });

  it("records evidence with the step version, advances to the next step and never mutates its input", () => {
    const before = progress({ fileBuffers: { "work/a.sv": "kept" } });
    const frozen = JSON.stringify(before);
    const result = applyStepCompletion(policy, before, "one", { kind: "self_attested" }, NOW);
    expect(result).toEqual({
      ok: true,
      progress: {
        currentStepId: "two",
        completedSteps: ["one"],
        stepEvidence: { one: { kind: "self_attested", stepVersion: "1", recordedAt: NOW } },
        fileBuffers: { "work/a.sv": "kept" },
        status: "in_progress",
      },
    });
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it("keeps completed steps in canonical order and drops unknown ids", () => {
    const result = applyStepCompletion(policy, progress({ completedSteps: ["two", "ghost", "one"] }), "three", {
      kind: "self_attested",
    }, NOW);
    expect(result.ok && result.progress.completedSteps).toEqual(["one", "two", "three"]);
  });

  it("completes the lab only once every step is done, and stays on the last step", () => {
    const partial = applyStepCompletion(policy, progress({ completedSteps: ["one"] }), "two", {
      kind: "graded",
      graderId: "demo-grader",
      graderVersion: "7",
      origin: "browser",
    }, NOW);
    expect(partial.ok && partial.progress.status).toBe("in_progress");
    expect(partial.ok && partial.progress.stepEvidence.two).toEqual({
      kind: "graded",
      graderId: "demo-grader",
      graderVersion: "7",
      stepVersion: "2",
      recordedAt: NOW,
      origin: "browser",
    });

    const done = applyStepCompletion(policy, progress({ completedSteps: ["one", "two"] }), "three", {
      kind: "self_attested",
    }, NOW + 5);
    expect(done).toMatchObject({
      ok: true,
      progress: { status: "completed", completedAt: NOW + 5, currentStepId: "three", completedSteps: ["one", "two", "three"] },
    });
  });

  it("keeps the first completion time when a step of a completed lab is recorded again", () => {
    const completed = progress({ completedSteps: ["one", "two", "three"], status: "completed", completedAt: 42 });
    const again = applyStepCompletion(policy, completed, "three", { kind: "self_attested" }, NOW);
    expect(again.ok && again.progress.completedAt).toBe(42);
  });

  it("reports which steps are unlocked", () => {
    expect(isStepUnlocked(policy, [], "one")).toBe(true);
    expect(isStepUnlocked(policy, [], "two")).toBe(false);
    expect(isStepUnlocked(policy, ["one"], "two")).toBe(true);
    expect(isStepUnlocked(policy, ["one"], "ghost")).toBe(false);
  });
});

describe("checkGradedSubmission", () => {
  const registry = registryOf(grader());

  it("accepts a well-formed submission and returns the grader and step", () => {
    const result = checkGradedSubmission(policy, submission(), registry);
    expect(result).toMatchObject({ ok: true, step: { id: "two" } });
    expect(result.ok && result.grader.id).toBe("demo-grader");
  });

  it("returns every run-route code with the route's status", () => {
    const cases: Array<[string, ReturnType<typeof checkGradedSubmission>]> = [
      ["LAB_VERSION_MISMATCH", checkGradedSubmission(policy, submission({ labVersion: "2" }), registry)],
      ["LAB_STEP_VERSION_MISMATCH", checkGradedSubmission(policy, submission({ stepVersion: "1" }), registry)],
      ["LAB_STEP_VERSION_MISMATCH", checkGradedSubmission(policy, submission({ stepId: "ghost" }), registry)],
      ["LAB_STEP_IS_SELF_ATTESTED", checkGradedSubmission(policy, submission({ stepId: "one", stepVersion: "1" }), registry)],
      ["INVALID_SUBMISSION_FILE", checkGradedSubmission(policy, submission({ files: [{ path: "README.md", content: "x" }] }), registry)],
      ["GRADER_NOT_CONFIGURED", checkGradedSubmission({ ...policy, graderId: undefined }, submission(), registry)],
      ["GRADER_NOT_FOUND", checkGradedSubmission(policy, submission(), registryOf())],
      ["GRADING_QUEUE_UNAVAILABLE", checkGradedSubmission(policy, submission(), registryOf(grader({ requiresSandbox: true })))],
    ];
    for (const [code, result] of cases) {
      expect(result).toEqual({ ok: false, code, status: GRADED_SUBMISSION_STATUS[code as keyof typeof GRADED_SUBMISSION_STATUS] });
    }
    expect(GRADED_SUBMISSION_STATUS).toEqual({
      LAB_VERSION_MISMATCH: 409,
      LAB_STEP_VERSION_MISMATCH: 409,
      LAB_STEP_IS_SELF_ATTESTED: 409,
      INVALID_SUBMISSION_FILE: 400,
      GRADER_NOT_CONFIGURED: 404,
      GRADER_NOT_FOUND: 503,
      GRADING_QUEUE_UNAVAILABLE: 503,
    });
  });

  it("rejects file sets the run route's schema would refuse: none, duplicates, too many, too long or too many bytes", () => {
    const reject = (files: LabSubmission["files"]) => checkGradedSubmission(policy, submission({ files }), registry);
    expect(reject([])).toMatchObject({ ok: false, code: "INVALID_SUBMISSION_FILE" });
    expect(reject([
      { path: "work/a.sv", content: "a" },
      { path: "work/a.sv", content: "b" },
    ])).toMatchObject({ ok: false, code: "INVALID_SUBMISSION_FILE" });
    const many: LabPolicyInput = { ...policy, editablePaths: Array.from({ length: 30 }, (_, index) => `f${index}.sv`) };
    expect(checkGradedSubmission(many, submission({
      files: many.editablePaths.slice(0, WORKSPACE_MAX_FILES + 1).map((path) => ({ path, content: "x" })),
    }), registry)).toMatchObject({ ok: false, code: "INVALID_SUBMISSION_FILE" });
    expect(reject([{ path: "work/a.sv", content: "x".repeat(256 * 1024 + 1) }])).toMatchObject({ ok: false });
    // 200 K three-byte characters fit the per-file character cap but not the 1 MB byte cap.
    const wide = "€".repeat(200_000);
    expect(reject([
      { path: "work/a.sv", content: wide },
      { path: "work/b.sv", content: wide },
    ])).toMatchObject({ ok: false, code: "INVALID_SUBMISSION_FILE" });
  });

  it("matches the shared graderRegistry for basics-1", () => {
    const lab = toLabPolicyInput(getLabById("basics-1")!);
    const result = checkGradedSubmission(lab, {
      labId: "basics-1",
      labVersion: "2",
      stepId: "write-task",
      stepVersion: "1",
      files: [{ path: "work/tb_counter_unrefactored.sv", content: "module tb; endmodule" }],
    }, graderRegistry);
    expect(result.ok && result.grader.id).toBe("sv-basics-v2");
    expect(graderNeedsSandbox(lab, graderRegistry)).toBe(false);
    expect(graderNeedsSandbox(policy, registryOf(grader({ requiresSandbox: true })))).toBe(true);
    expect(graderNeedsSandbox({}, graderRegistry)).toBe(false);
  });
});

describe("utf8ByteLength", () => {
  it("counts UTF-8 bytes with TextEncoder, not UTF-16 units", () => {
    const encode = vi.spyOn(TextEncoder.prototype, "encode");
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("€")).toBe(3);
    expect(utf8ByteLength("\u{1F600}")).toBe(4);
    expect(encode).toHaveBeenCalled();
    encode.mockRestore();
    expect(SUBMISSION_MAX_BYTES).toBe(1024 * 1024);
  });

  it("the policy module never touches Buffer", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(`${process.cwd()}/src/lib/lab-progress-policy.ts`, "utf8");
    expect(source).not.toMatch(/\bBuffer\s*[.(]/);
    expect(source).toMatch(/new TextEncoder\(\)/);
  });
});

describe("sanitizeWorkspace", () => {
  it("uses the learner store's lab caps", () => {
    expect(WORKSPACE_FILE_MAX_CHARS).toBe(LAB_FILE_MAX_CHARS);
    expect(WORKSPACE_MAX_CHARS).toBe(LAB_RECORD_MAX_CHARS);
  });

  it("keeps editable paths only, in the manifest's order", () => {
    expect(sanitizeWorkspace(policy, {
      "work/b.sv": "b",
      "README.md": "not editable",
      "work/a.sv": "a",
      "../escape.sv": "x",
    })).toEqual({
      fileBuffers: { "work/a.sv": "a", "work/b.sv": "b" },
      dropped: [
        { path: "README.md", reason: "not-editable" },
        { path: "../escape.sv", reason: "not-editable" },
      ],
    });
    expect(Object.keys(sanitizeWorkspace(policy, { "work/b.sv": "b", "work/a.sv": "a" }).fileBuffers)).toEqual([
      "work/a.sv",
      "work/b.sv",
    ]);
  });

  it("drops a non-string, an oversized file and files beyond the total", () => {
    expect(sanitizeWorkspace(policy, { "work/a.sv": 42 }).dropped).toEqual([{ path: "work/a.sv", reason: "not-editable" }]);
    expect(sanitizeWorkspace(policy, { "work/a.sv": "x".repeat(WORKSPACE_FILE_MAX_CHARS + 1), "work/b.sv": "ok" })).toEqual({
      fileBuffers: { "work/b.sv": "ok" },
      dropped: [{ path: "work/a.sv", reason: "file-too-large" }],
    });
    const big = "x".repeat(WORKSPACE_FILE_MAX_CHARS);
    const three: LabPolicyInput = { ...policy, editablePaths: ["a", "b", "c"] };
    expect(sanitizeWorkspace(three, { a: big, b: big, c: "y" })).toEqual({
      fileBuffers: { a: big, b: big },
      dropped: [{ path: "c", reason: "workspace-too-large" }],
    });
  });

  it("keeps at most 24 files", () => {
    const many: LabPolicyInput = { ...policy, editablePaths: Array.from({ length: 26 }, (_, index) => `f${index}`) };
    const result = sanitizeWorkspace(many, Object.fromEntries(many.editablePaths.map((path) => [path, "x"])));
    expect(Object.keys(result.fileBuffers)).toHaveLength(WORKSPACE_MAX_FILES);
    expect(result.dropped).toEqual([
      { path: "f24", reason: "too-many-files" },
      { path: "f25", reason: "too-many-files" },
    ]);
  });
});

describe("canRevealSolutions", () => {
  it("is true only for a completed lab", () => {
    expect(canRevealSolutions(null)).toBe(false);
    expect(canRevealSolutions(progress())).toBe(false);
    expect(canRevealSolutions(progress({ status: "completed" }))).toBe(true);
  });
});
