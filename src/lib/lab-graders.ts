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

// ---------------------------------------------------------------------------
// simple-dut-1 (v2, milestone M0): the self-checking directed bench of F2E
// ---------------------------------------------------------------------------

/** Comments removed and string-literal contents blanked, so code checks never match message text. */
function codeOnly(source: string): string {
  return stripComments(source).replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The argument list and body of the task or function `name`, if declared. */
function findSubroutine(code: string, kind: "task" | "function", name: string): { header: string; body: string } | null {
  const pattern = new RegExp(
    `\\b${kind}\\b[^;]*?\\b${escapeRegExp(name)}\\s*(?:\\(([\\s\\S]*?)\\))?\\s*;([\\s\\S]*?)\\bend${kind}\\b`,
  );
  const match = pattern.exec(code);
  return match ? { header: match[1] ?? "", body: match[2] } : null;
}

/** The statement at the start of `text`: a begin-end block (nesting counted) or everything up to the first `;`. */
function takeStatement(text: string): string {
  if (!/^\s*begin\b/.test(text)) {
    const semicolon = text.indexOf(";");
    return semicolon < 0 ? text : text.slice(0, semicolon + 1);
  }
  const words = /\b(begin|end)\b/g;
  let depth = 0;
  for (let word = words.exec(text); word; word = words.exec(text)) {
    depth += word[1] === "begin" ? 1 : -1;
    if (depth === 0) return text.slice(0, word.index + word[0].length);
  }
  return text;
}

interface AlwaysProcedure {
  keyword: string;
  /** The event expression after `@`, normalised (`posedge clk`, `sum`, `*`), or null when there is none. */
  event: string | null;
  body: string;
}

function findAlwaysProcedures(code: string): AlwaysProcedure[] {
  const procedures: AlwaysProcedure[] = [];
  const keywords = /\b(always(?:_ff|_comb|_latch)?)\b/g;
  for (let match = keywords.exec(code); match; match = keywords.exec(code)) {
    let rest = code.slice(match.index + match[0].length);
    let event: string | null = null;
    const control = /^\s*@\s*(?:\(([^()]*)\)|(\*)|([\w$.]+))/.exec(rest);
    if (control) {
      event = (control[1] ?? control[2] ?? control[3]).trim().replace(/\s+/g, " ");
      rest = rest.slice(control[0].length);
    }
    procedures.push({ keyword: match[1], event, body: takeStatement(rest) });
  }
  return procedures;
}

/** Top-level statements of a subroutine body, trimmed, empty ones dropped. */
function statementsOf(body: string): string[] {
  return body.split(";").map((statement) => statement.trim()).filter(Boolean);
}

/** The value of an integer literal such as 200, 8'd200, 8'hC8 or 'b1100_1000; null for anything else. */
function parseIntegerLiteral(text: string): number | null {
  const literal = text.replace(/_/g, "").trim();
  if (/^\d+$/.test(literal)) return Number.parseInt(literal, 10);
  const based = /^(?:\d+)?'[sS]?([dDhHbBoO])([0-9a-fA-F]+)$/.exec(literal);
  if (!based) return null;
  const bases = { d: [10, /^[0-9]+$/], h: [16, /^[0-9a-fA-F]+$/], b: [2, /^[01]+$/], o: [8, /^[0-7]+$/] } as const;
  const [radix, digits] = bases[based[1].toLowerCase() as keyof typeof bases];
  return digits.test(based[2]) ? Number.parseInt(based[2], radix) : null;
}

/** Operand pairs of the `send(x, y)` statements whose arguments are both integer literals. */
function literalSendPairs(statements: readonly string[]): Array<[number, number]> {
  return statements.flatMap((statement) => {
    const call = /^send\s*\(([^,()]+),([^,()]+)\)$/.exec(statement);
    if (!call) return [];
    const first = parseIntegerLiteral(call[1]);
    const second = parseIntegerLiteral(call[2]);
    return first === null || second === null ? [] : [[first, second] as [number, number]];
  });
}

const DUT_INPUTS = ["in_valid", "a", "b", "rst_n"] as const;

/**
 * F2E's drive rule for one task body: after `@(posedge clk)`, DUT inputs are
 * driven with `<=` only. Returns the input driven with `=`, if any. A body that
 * waits only on the falling edge may use `=` (F2E's opposite-edge style).
 */
function blockingDriveAfterPosedge(body: string): string | null {
  const edge = /@\s*\(\s*posedge\s+clk\s*\)/.exec(body);
  if (!edge) return null;
  const afterEdge = body.slice(edge.index);
  return DUT_INPUTS.find((name) => new RegExp(`\\b${name}\\s*=(?!=)`).test(afterEdge)) ?? null;
}

function blockingDriveHint(task: string, signal: string): string {
  return `${task} drives ${signal} with a blocking assignment (=) after @(posedge clk). The DUT's always_ff reads it on the same edge, so the value it sees depends on which process the simulator runs first (a race). Drive DUT inputs with nonblocking assignments (<=).`;
}

const passed = (hint: string): GraderResult => ({ success: true, hint, diagnostics: [] });

function gradeClockReset(code: string): GraderResult {
  const toggles = /\b(?:always|forever)\s*#\s*\(?\s*[\w.]+\s*\)?\s*(?:begin\s*)?clk\s*<?=\s*(?:~|!)\s*clk\b/.test(code);
  if (!toggles) return fail("NO_CLOCK", "Generate the clock with a toggle on a delay, for example always #5 clk = ~clk; (a 10 ns period).");
  const startsKnown =
    /\b(?:logic|bit|reg)\s+clk\s*=\s*[^;]+;/.test(code) ||
    /\bbit\s+clk\s*;/.test(code) ||
    /\binitial\b[\s\S]*?\bclk\s*=\s*(?:1'b[01]|'[01]|[01])\s*;/.test(code);
  if (!startsKnown) {
    return fail("CLOCK_STARTS_X", "clk starts at x: a logic variable without an initializer is x, and ~x is x, so the clock never toggles and nothing clocked ever runs. Declare it as logic clk = 1'b0;");
  }
  const reset = findSubroutine(code, "task", "reset_dut");
  if (!reset) return fail("RESET_TASK_NOT_FOUND", "Keep the task reset_dut and give it a body.");
  if (!/@\s*\(\s*posedge\s+clk\s*\)/.test(reset.body)) return fail("RESET_NO_EDGES", "reset_dut must hold rst_n low for `cycles` rising edges: repeat (cycles) @(posedge clk);");
  if (!/\brst_n\s*<=\s*(?:1'b0|'0|0)\s*;/.test(reset.body)) return fail("RESET_NOT_ASSERTED", "reset_dut must first drive rst_n low: rst_n <= 1'b0;");
  if (!/\bin_valid\s*<=/.test(reset.body)) return fail("RESET_INPUTS_UNKNOWN", "reset_dut must also give in_valid (and a and b) known values, or the DUT samples x on its first edges.");
  const blocking = blockingDriveAfterPosedge(reset.body);
  if (blocking) return fail("BLOCKING_DRIVE", blockingDriveHint("reset_dut", blocking));
  const released = /@\s*\(\s*posedge\s+clk\s*\)[\s\S]*\brst_n\s*<=\s*(?:1'b1|'1|1)\s*;/.test(reset.body);
  if (!released) return fail("RESET_NOT_RELEASED", "After the reset edges, release reset with rst_n <= 1'b1; just after an edge, so the DUT sees it on the next one.");
  return passed("Clock and reset shape passed.");
}

function gradeDrivePredict(code: string): GraderResult {
  const model = findSubroutine(code, "function", "model_sat_add");
  if (!model) return fail("MODEL_NOT_FOUND", "Keep the function model_sat_add(op_a, op_b) and write its body.");
  if (/\breturn\s*'[xX]\s*;/.test(model.body)) return fail("MODEL_IS_STUB", "model_sat_add still returns 'x. Compute the saturated sum from the specification.");
  const parameters = model.header.split(",").map((part) => /([A-Za-z_]\w*)\s*(?:=[^,]*)?$/.exec(part.trim())?.[1]).filter(Boolean) as string[];
  if (parameters.length < 2 || parameters.some((name) => !new RegExp(`\\b${name}\\b`).test(model.body))) {
    return fail("MODEL_IGNORES_INPUT", "model_sat_add must compute its answer from both operands.");
  }
  if (!/\breturn\b/.test(model.body) && !/\bmodel_sat_add\s*=/.test(model.body)) return fail("MODEL_NO_RESULT", "model_sat_add must return its answer.");

  const send = findSubroutine(code, "task", "send");
  if (!send) return fail("SEND_NOT_FOUND", "Keep the task send(a_val, b_val) and write its body.");
  if (!/@\s*\(\s*(?:posedge|negedge)\s+clk\s*\)/.test(send.body)) return fail("SEND_NO_EDGE", "send must wait for a clock edge before it drives: @(posedge clk);");
  const blocking = blockingDriveAfterPosedge(send.body);
  if (blocking) return fail("BLOCKING_DRIVE", blockingDriveHint("send", blocking));
  for (const signal of ["in_valid", "a", "b"]) {
    if (!new RegExp(`\\b${signal}\\s*<?=(?!=)`).test(send.body)) return fail("SEND_MISSING_DRIVE", `send must drive ${signal} (with <=, right after the edge).`);
  }
  if (!/\bexp_q\s*\.\s*push_back\s*\(/.test(send.body)) {
    return fail("NO_EXPECTATION", "send must record what the DUT has to answer: exp_q.push_back(...) with an exp_t that holds the inputs and model_sat_add(a_val, b_val).");
  }
  if (!/\bmodel_sat_add\s*\(/.test(send.body)) return fail("MODEL_NOT_USED", "The expectation send pushes must come from model_sat_add(a_val, b_val), not from the DUT's outputs.");

  const idle = findSubroutine(code, "task", "idle");
  if (!idle) return fail("IDLE_NOT_FOUND", "Keep the task idle(n) and write its body.");
  if (!/@\s*\(\s*(?:posedge|negedge)\s+clk\s*\)/.test(idle.body) || !/\b(?:repeat|for|while)\b/.test(idle.body)) {
    return fail("IDLE_NO_CYCLES", "idle(n) must wait n clock edges: repeat (n) begin @(posedge clk); ... end");
  }
  const idleBlocking = blockingDriveAfterPosedge(idle.body);
  if (idleBlocking) return fail("BLOCKING_DRIVE", blockingDriveHint("idle", idleBlocking));
  if (!/\bin_valid\s*<?=\s*(?:1'b0|'0|0)\s*;/.test(idle.body)) return fail("IDLE_NO_DRIVE", "idle must drive in_valid low on each cycle: in_valid <= 1'b0;");
  return passed("Model and drive shape passed.");
}

const onRisingClock = (procedure: AlwaysProcedure): boolean => procedure.event !== null && /^posedge clk\b/.test(procedure.event);

const USES_CHECK = /\bcheck_result\s*\(|!==|\b(?:pass_cnt|fail_cnt)\b/;

function gradeChecker(code: string): GraderResult {
  const check = findSubroutine(code, "function", "check_result");
  if (!check) return fail("CHECK_NOT_FOUND", "Keep the function check_result(actual) and write its body.");
  if (!/!==/.test(check.body)) {
    return /!=/.test(check.body)
      ? fail("NOT_CASE_INEQUALITY", "Compare with !==, not !=. With != an x or z bit can make the condition x, and if (x) takes the else branch, so an unknown result is counted as a pass.")
      : fail("NO_COMPARE", "check_result must compare the actual result with the expectation using !==.");
  }
  const pop = check.body.search(/\.\s*pop_front\s*\(/);
  if (pop < 0) return fail("NO_POP", "check_result must take the oldest expectation with exp_q.pop_front().");
  const guard = check.body.search(/\bexp_q\s*\.\s*size\s*\(\s*\)/);
  if (guard < 0 || guard > pop) {
    return fail("NO_EMPTY_GUARD", "Test exp_q.size() before pop_front: popping an empty queue returns an all-x default and may only warn. A result nobody expected is a failure.");
  }
  if (!/\bfail_cnt\s*(?:\+\+|\+=|=\s*fail_cnt\s*\+)/.test(check.body) || !/\bpass_cnt\s*(?:\+\+|\+=|=\s*pass_cnt\s*\+)/.test(check.body)) {
    return fail("NO_COUNT", "check_result must count every compare: pass_cnt++ on a match, fail_cnt++ (and $error) on a mismatch.");
  }
  if (!/\$error\b/.test(check.body)) return fail("NO_ERROR_MESSAGE", "Report each mismatch with $error, naming the inputs, the actual and the expected sum.");

  const procedures = findAlwaysProcedures(code);
  if (procedures.some((procedure) => procedure.keyword === "always_ff" && USES_CHECK.test(procedure.body))) {
    return fail("ALWAYS_FF_CHECKER", "The checker writes fail_cnt, which report() also writes, and always_ff forbids any other process from writing its variables. Use always @(posedge clk) for testbench processes.");
  }
  const offClock = procedures.find((procedure) => procedure.keyword !== "always_ff" && USES_CHECK.test(procedure.body) && !onRisingClock(procedure));
  if (offClock) {
    return fail(
      "CHECK_NOT_ON_CLOCK",
      `A checker on ${offClock.event ? `@(${offClock.event})` : offClock.keyword} wakes only when a value changes: two equal results in a row, or a wrong result that never changes, are never compared, and the run still passes. Sample with always @(posedge clk) and let out_valid say when a result is there.`,
    );
  }
  const checker = procedures.find((procedure) => procedure.keyword === "always" && onRisingClock(procedure) && /\bcheck_result\s*\(/.test(procedure.body));
  if (!checker) return fail("CHECKER_NOT_FOUND", "Add the checker process: always @(posedge clk) that calls check_result(sum) when out_valid is 1.");
  if (!/\brst_n\b/.test(checker.body)) return fail("CHECKS_DURING_RESET", "Compare nothing while the DUT is in reset: guard the checker with if (rst_n).");
  if (!/\$isunknown\s*\(\s*out_valid\s*\)/.test(checker.body)) {
    return fail("NO_X_CHECK", "Test $isunknown(out_valid) before if (out_valid): an x on out_valid makes the if skip the compare silently.");
  }
  if (!/\bout_valid\b[\s\S]*\bcheck_result\s*\(/.test(checker.body)) return fail("NO_VALID_QUALIFIER", "Call check_result only when out_valid is 1.");
  return passed("Checker shape passed.");
}

function gradeDirectedTests(code: string): GraderResult {
  for (const name of ["test_smoke", "test_corners", "test_gaps"]) {
    const test = findSubroutine(code, "task", name);
    if (!test) return fail("TEST_NOT_FOUND", `Keep the task ${name}.`);
    const statements = statementsOf(test.body);
    if (!statements.some((statement) => /^send\s*\(/.test(statement))) return fail("EMPTY_TEST", `${name} sends nothing: a test that sends nothing checks nothing.`);
    if (!/^idle\s*\(/.test(statements[statements.length - 1])) {
      return fail("TEST_LEAVES_VALID_HIGH", `End ${name} with idle(1), or in_valid stays 1 and the DUT keeps producing results nobody sent.`);
    }
  }
  const corners = literalSendPairs(statementsOf(findSubroutine(code, "task", "test_corners")!.body));
  const sums = new Set(corners.map(([x, y]) => x + y));
  if (!sums.has(255) || !sums.has(256)) {
    return fail(
      "NO_SATURATION_BOUNDARY",
      "test_corners must straddle the saturation boundary with literal operands: one pair whose true sum is exactly 255 (the largest that fits, such as send(8'd200, 8'd55)) and one whose true sum is exactly 256 (the smallest that saturates).",
    );
  }
  if (![...sums].some((total) => total > 256)) return fail("NO_LARGE_SUM", "Add a pair that saturates by far, such as send(8'd255, 8'd255).");

  const gaps = statementsOf(findSubroutine(code, "task", "test_gaps")!.body);
  const isSend = (statement: string | undefined) => statement !== undefined && /^send\s*\(/.test(statement);
  const lastSend = gaps.map(isSend).lastIndexOf(true);
  if (!gaps.slice(0, lastSend).some((statement) => /^idle\s*\(/.test(statement))) {
    return fail("NO_GAP", "test_gaps needs idle cycles between valid inputs, so that a result appearing on an idle cycle is caught.");
  }
  if (!gaps.some((statement, index) => isSend(statement) && isSend(gaps[index + 1]))) {
    return fail("NO_BACK_TO_BACK", "test_gaps needs two send calls in a row, so that two results are in flight at once.");
  }
  const runOne = findSubroutine(code, "task", "run_one");
  if (!runOne || !/\btest_corners\s*\(/.test(runOne.body) || !/\btest_gaps\s*\(/.test(runOne.body) || !/\bdefault\b[\s\S]*\$fatal\b/.test(runOne.body)) {
    return fail("RUN_ONE_CHANGED", "Keep run_one: it must call every test and end an unknown test name with $fatal.");
  }
  return passed("Directed-test shape passed.");
}

function gradeVerdict(code: string, withStrings: string): GraderResult {
  const report = findSubroutine(code, "function", "report");
  const reportText = findSubroutine(withStrings, "function", "report");
  if (!report || !reportText) return fail("REPORT_NOT_FOUND", "Keep the function report().");
  if (!/PASS=%0d FAIL=%0d/.test(reportText.body)) return fail("NO_SUMMARY", "report() must print exactly one line in the format PASS=%0d FAIL=%0d.");
  if (!/\bfail_cnt\s*\+=\s*exp_q\s*\.\s*size\s*\(\s*\)/.test(report.body) && !/\bfail_cnt\s*=\s*fail_cnt\s*\+\s*exp_q\s*\.\s*size/.test(report.body)) {
    return fail("LEFTOVERS_NOT_COUNTED", "Expectations still in exp_q are results that never arrived: add exp_q.size() to fail_cnt before printing.");
  }
  if (!/\bpass_cnt\s*==\s*0\b/.test(report.body) || !/\bfail_cnt\s*==\s*0\b/.test(report.body)) {
    return fail("VACUOUS_PASS", "A run that checked nothing must fail: if pass_cnt == 0 && fail_cnt == 0, count a failure. Otherwise PASS=0 FAIL=0 looks like a pass.");
  }

  const drain = findSubroutine(code, "task", "drain");
  if (!drain) return fail("DRAIN_NOT_FOUND", "Keep the task drain().");
  if (/\bwhile\s*\([^;]*\)\s*;/.test(drain.body)) {
    return fail("ZERO_DELAY_LOOP", "A loop with an empty body never lets time advance, so not even the watchdog can stop it. Wait for a clock edge inside the loop.");
  }
  if (!/\bexp_q\s*\.\s*size\s*\(\s*\)/.test(drain.body) || !/@\s*\(\s*(?:posedge|negedge)\s+clk\s*\)/.test(drain.body)) {
    return fail("DRAIN_DOES_NOT_WAIT", "drain must wait, edge by edge and for a bounded number of cycles, until exp_q is empty, then watch two more edges.");
  }

  const fork = /\bfork\b([\s\S]*?)\b(join_any|join_none|join)\b([\s\S]*)/.exec(code);
  if (!fork) return fail("NO_WATCHDOG", "Run the test in one branch of a fork and a watchdog in another: begin #(TIMEOUT); ... $fatal(...); end.");
  if (fork[2] === "join") return fail("JOIN_WAITS_FOR_WATCHDOG", "With join, main waits for both branches, so every run waits for the watchdog and ends in its $fatal. Use join_any.");
  if (fork[2] === "join_none") return fail("JOIN_NONE", "With join_none, main does not wait for the test at all. Use join_any, which resumes when either branch ends.");
  if (!/#\s*\(?\s*[\w.]+/.test(fork[1]) || !/\$fatal\b/.test(fork[1])) {
    return fail("NO_WATCHDOG", "The watchdog branch must wait #(TIMEOUT), count the hang as a failure, call report() and end the run with $fatal.");
  }
  if (!/\bdisable\s+fork\s*;/.test(fork[3])) return fail("NO_DISABLE_FORK", "After join_any, stop the branch that is still running (the watchdog) with disable fork.");
  const afterJoin = fork[3];
  const reportCall = afterJoin.search(/\breport\s*\(/);
  const finish = afterJoin.search(/\$finish\b/);
  if (reportCall < 0 || finish < 0 || finish < reportCall) {
    return fail("NO_FINISH", "After disable fork, call report() and then $finish: the free-running clock keeps the simulation alive forever otherwise.");
  }
  return passed("Verdict and watchdog shape passed.");
}

/**
 * simple-dut-1 (v2, "Your First Self-Checking Testbench", milestone M0):
 * static structural checks of the learner's tb_top against F2E's loop, with
 * comments ignored. They do not compile or simulate anything; the README's
 * simulator run is the real check.
 */
const selfCheckGrader: LabGrader = {
  id: "sv-selfcheck-v1",
  version: "1",
  requiresSandbox: false,
  async grade(submission) {
    const withStrings = stripComments(submission.files.map((file) => file.content).join("\n"));
    const code = codeOnly(withStrings);
    switch (submission.stepId) {
      case "clock-reset":
        return gradeClockReset(code);
      case "drive-predict":
        return gradeDrivePredict(code);
      case "checker":
        return gradeChecker(code);
      case "directed-tests":
        return gradeDirectedTests(code);
      case "verdict":
        return gradeVerdict(code, withStrings);
      default:
        return fail("UNKNOWN_STEP", `Step ${submission.stepId} is not graded automatically.`);
    }
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
graderRegistry.register(selfCheckGrader);
