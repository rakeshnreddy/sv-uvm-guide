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
