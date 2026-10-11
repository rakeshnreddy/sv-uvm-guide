export interface LabSubmissionFile {
  path: string;
  content: string;
}

export interface LabSubmission {
  labId: string;
  labVersion: string;
  stepId: string;
  stepVersion: string;
  files: LabSubmissionFile[];
}

export interface GraderDiagnostic {
  code: string;
  file?: string;
  line?: number;
  message: string;
}

export interface GraderResult {
  success: boolean;
  hint?: string;
  diagnostics: GraderDiagnostic[];
}

export interface LabGrader {
  id: string;
  version: string;
  requiresSandbox: boolean;
  grade(submission: LabSubmission): Promise<GraderResult>;
}

function tokenizeSystemVerilog(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, " ");
  return withoutComments.match(/[A-Za-z_$][\w$]*|\d+|==|<=|>=|[;=]/g) ?? [];
}

function containsSequence(tokens: readonly string[], expected: readonly string[]): boolean {
  return tokens.some((_, start) => expected.every((token, offset) => tokens[start + offset] === token));
}

const basicsGrader: LabGrader = {
  id: "sv-basics-v1",
  version: "1",
  requiresSandbox: false,
  async grade(submission) {
    const source = submission.files.map((file) => file.content).join("\n");
    const tokens = tokenizeSystemVerilog(source);
    const expected = submission.stepId === "1" ? ["int", "myVar", ";"] : ["myVar", "=", "10", ";"];
    const success = containsSequence(tokens, expected);
    return {
      success,
      hint: success
        ? "Static syntax check passed."
        : submission.stepId === "1"
          ? "Declare myVar as an int in executable SystemVerilog source."
          : "Assign the decimal value 10 to myVar in executable SystemVerilog source.",
      diagnostics: success ? [] : [{ code: "EXPECTED_SYNTAX_NOT_FOUND", message: `Expected: ${expected.join(" ")}` }],
    };
  },
};

/** Comments removed, string literals kept (the self-check step looks for a PASS= summary string). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

/** The header (argument list) and body of `task automatic drive_sequence`, if declared. */
function findDriveSequenceTask(source: string): { header: string; body: string } | null {
  const match = /\btask\s+automatic\s+drive_sequence\s*\(([\s\S]*?)\)\s*;([\s\S]*?)\bendtask\b/.exec(source);
  return match ? { header: match[1], body: match[2] } : null;
}

function fail(code: string, hint: string): GraderResult {
  return { success: false, hint, diagnostics: [{ code, message: hint }] };
}

/**
 * basics-1 (v2, "Refactor Repeated Stimulus into a Task"): static structural
 * checks on the learner's testbench, with comments ignored. They confirm the
 * shape the README asks for; the simulation itself proves the counts.
 */
const basicsTaskGrader: LabGrader = {
  id: "sv-basics-v2",
  version: "1",
  requiresSandbox: false,
  async grade(submission) {
    const source = stripComments(submission.files.map((file) => file.content).join("\n"));
    const task = findDriveSequenceTask(source);
    if (submission.stepId === "write-task") {
      if (!task) return fail("TASK_NOT_FOUND", "Declare `task automatic drive_sequence(...)` and close it with `endtask`.");
      for (const arg of ["start_value", "repeat_count", "step"]) {
        if (!new RegExp(`\\b${arg}\\b`).test(task.header)) return fail("TASK_ARGUMENT_MISSING", `drive_sequence needs an argument named ${arg}.`);
      }
      if (!/\bstep\b\s*=/.test(task.header)) return fail("TASK_DEFAULT_MISSING", "Give the step argument a default value (step = 8'h01).");
      if (/\b(enable|data)\s*=(?!=)/.test(task.body)) return fail("BLOCKING_DRIVE", "Drive enable and data with nonblocking assignments (<=) inside the task, or the drive races with the DUT's always_ff.");
      if (!/\b(enable|data)\s*<=/.test(task.body)) return fail("NO_DRIVE", "The task must drive enable and data with <= on the clock edge.");
      return { success: true, hint: "Task shape check passed.", diagnostics: [] };
    }
    if (submission.stepId === "call-task") {
      if (!task) return fail("TASK_NOT_FOUND", "Keep the drive_sequence task from step 2 in the file you submit.");
      const outside = source.replace(/\btask\s+automatic\s+drive_sequence[\s\S]*?\bendtask\b/, " ");
      const calls = outside.match(/\bdrive_sequence\s*\(/g) ?? [];
      if (calls.length < 3) return fail("TOO_FEW_CALLS", `Replace the three copied blocks with three drive_sequence calls (found ${calls.length}).`);
      if (!/\bdrive_sequence\s*\(\s*\.\w+\s*\(/.test(outside)) return fail("NO_NAMED_BINDING", "Bind the arguments of one call by name, for example .start_value(8'h20).");
      return { success: true, hint: "Call check passed.", diagnostics: [] };
    }
    if (submission.stepId === "self-check") {
      if (!/!==/.test(source)) return fail("NO_CASE_INEQUALITY", "Compare the DUT count with the expected count using !== so x or z counts as a mismatch.");
      if (!/PASS=/.test(source)) return fail("NO_SUMMARY", "Print a summary line such as PASS=<n> FAIL=<m> at the end of the test.");
      return { success: true, hint: "Self-check shape passed.", diagnostics: [] };
    }
    return fail("UNKNOWN_STEP", `Step ${submission.stepId} is not graded automatically.`);
  },
};

class LabGraderRegistry {
  private readonly graders = new Map<string, LabGrader>();

  register(grader: LabGrader): void {
    if (this.graders.has(grader.id)) throw new Error(`Duplicate lab grader: ${grader.id}`);
    this.graders.set(grader.id, grader);
  }

  get(id: string): LabGrader | undefined {
    return this.graders.get(id);
  }

  has(id: string): boolean {
    return this.graders.has(id);
  }
}

export const graderRegistry = new LabGraderRegistry();
graderRegistry.register(basicsGrader);
graderRegistry.register(basicsTaskGrader);
