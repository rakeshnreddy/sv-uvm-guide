import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { graderRegistry, type GraderResult, type LabSubmission } from "@/lib/lab-graders";

const grader = graderRegistry.get("sv-basics-v2")!;

const TASK = `task automatic drive_sequence(input byte start_value, input int unsigned repeat_count, input byte step = 8'h01);
  byte payload = start_value;
  @(posedge clk);
  enable <= 1;
  data <= payload;
  repeat (repeat_count) begin
    @(posedge clk);
    payload += step;
    data <= payload;
  end
  enable <= 0;
endtask`;

function submit(stepId: string, content: string): Promise<{ success: boolean; hint?: string }> {
  const submission: LabSubmission = { labId: "basics-1", labVersion: "2", stepId, stepVersion: "1", files: [{ path: "tb.sv", content }] };
  return grader.grade(submission);
}

describe("sv-basics-v2 grader (basics-1)", () => {
  it("accepts an automatic task with the three arguments, a default step and nonblocking drives", async () => {
    await expect(submit("write-task", TASK)).resolves.toMatchObject({ success: true });
  });

  it("rejects a task hidden in a comment, a missing default and a blocking drive", async () => {
    expect((await submit("write-task", `/* ${TASK} */`)).success).toBe(false);
    expect((await submit("write-task", TASK.replace(" = 8'h01", ""))).hint).toContain("default");
    expect((await submit("write-task", TASK.replace("enable <= 1;", "enable = 1;"))).hint).toContain("nonblocking");
  });

  it("needs three calls outside the task, one of them by name", async () => {
    const calls = "drive_sequence(8'h01, 3);\ndrive_sequence(8'h10, 5, 8'h02);\ndrive_sequence(.start_value(8'h20), .repeat_count(8), .step(8'h03));";
    await expect(submit("call-task", `${TASK}\n${calls}`)).resolves.toMatchObject({ success: true });
    expect((await submit("call-task", `${TASK}\ndrive_sequence(8'h01, 3);`)).success).toBe(false);
    expect((await submit("call-task", `${TASK}\n${calls.replace(/\.\w+\(([^)]*)\)/g, "$1")}`)).hint).toContain("by name");
  });

  it("checks the self-check shape: !== and a PASS= summary", async () => {
    await expect(submit("self-check", 'if (count !== exp_count) n_fail++;\n$display("PASS=%0d FAIL=%0d", n_pass, n_fail);')).resolves.toMatchObject({ success: true });
    expect((await submit("self-check", 'if (count != exp_count) n_fail++;\n$display("PASS=%0d", n_pass);')).success).toBe(false);
  });
});

describe("sv-selfcheck-v1 grader (simple-dut-1)", () => {
  const selfCheck = graderRegistry.get("sv-selfcheck-v1")!;
  const labDir = path.join(process.cwd(), "content", "curriculum", "labs", "simple_dut");
  const read = (relative: string) => fs.readFileSync(path.join(labDir, relative), "utf8");
  const DUT = read("work/sat_adder_reg.sv");
  const STARTER = read("work/tb_top.sv");
  const SOLUTION = read("solution/tb_top.sv");
  const GRADED_STEPS = ["clock-reset", "drive-predict", "checker", "directed-tests", "verdict"];

  function grade(stepId: string, tb: string): Promise<GraderResult> {
    const submission: LabSubmission = {
      labId: "simple-dut-1",
      labVersion: "2",
      stepId,
      stepVersion: "1",
      files: [
        { path: "work/sat_adder_reg.sv", content: DUT },
        { path: "work/tb_top.sv", content: tb },
      ],
    };
    return selfCheck.grade(submission);
  }

  /** The solution with one exact piece of text replaced; fails loudly if the text is not there. */
  function mutate(from: string, to: string): string {
    expect(SOLUTION).toContain(from);
    return SOLUTION.replace(from, to);
  }

  it("rejects the untouched starter on every graded step", async () => {
    for (const step of GRADED_STEPS) {
      expect((await grade(step, STARTER)).success, step).toBe(false);
    }
  });

  it("accepts the reference solution on every graded step", async () => {
    for (const step of GRADED_STEPS) {
      await expect(grade(step, SOLUTION), step).resolves.toMatchObject({ success: true });
    }
  });

  it("says the graded steps are structural, and ignores code hidden in comments", async () => {
    expect(selfCheck.requiresSandbox).toBe(false);
    const commentedClock = STARTER.replace("// TODO step 2: generate", "// always #5 clk = ~clk; logic clk = 1'b0;\n  // TODO step 2: generate");
    expect((await grade("clock-reset", commentedClock)).success).toBe(false);
    expect((await grade("nope", SOLUTION)).hint).toContain("not graded");
  });

  it("clock-reset: a clock without an initializer stays x, and a blocking reset release races", async () => {
    expect((await grade("clock-reset", mutate("logic         clk = 1'b0;", "logic         clk;"))).hint).toContain("x");
    const blocking = await grade("clock-reset", mutate("rst_n    <= 1'b1;", "rst_n    = 1'b1;"));
    expect(blocking).toMatchObject({ success: false, diagnostics: [{ code: "BLOCKING_DRIVE" }] });
    expect(blocking.hint).toContain("nonblocking");
  });

  it("drive-predict: a blocking drive after the edge fails with a race explanation", async () => {
    const result = await grade("drive-predict", mutate("    a        <= a_val;", "    a        = a_val;"));
    expect(result).toMatchObject({ success: false, diagnostics: [{ code: "BLOCKING_DRIVE" }] });
    expect(result.hint).toContain("race");
  });

  it("drive-predict: the model stub and a send that records nothing fail", async () => {
    const stub = SOLUTION.replace(/(model_sat_add\(input[\s\S]*?\);)[\s\S]*?endfunction/, "$1\n    return 'x;\n  endfunction");
    expect((await grade("drive-predict", stub)).hint).toContain("'x");
    const noPush = mutate("exp_q.push_back(exp_t'{a: a_val, b: b_val, sum: model_sat_add(a_val, b_val)});", "");
    expect((await grade("drive-predict", noPush)).diagnostics[0].code).toBe("NO_EXPECTATION");
  });

  it("checker: an event control on the output (the old always @(tb_y) checker) fails with a helpful message", async () => {
    const onSum = mutate("always @(posedge clk) begin\n    if (rst_n)", "always @(sum) begin\n    if (rst_n)");
    const result = await grade("checker", onSum);
    expect(result).toMatchObject({ success: false, diagnostics: [{ code: "CHECK_NOT_ON_CLOCK" }] });
    expect(result.hint).toContain("@(sum)");
    expect(result.hint).toContain("never compared");
    const oldStyle = `${SOLUTION}\n  always @(tb_y) begin\n    if (tb_y !== expected_y) fail_cnt++;\n  end`;
    expect((await grade("checker", oldStyle)).hint).toContain("@(tb_y)");
  });

  it("checker: != instead of !==, always_ff, no empty-queue guard and no X check fail", async () => {
    expect((await grade("checker", mutate("if (actual !== e.sum)", "if (actual != e.sum)"))).hint).toContain("!==");
    expect((await grade("checker", mutate("always @(posedge clk) begin\n    if (rst_n)", "always_ff @(posedge clk) begin\n    if (rst_n)"))).diagnostics[0].code).toBe("ALWAYS_FF_CHECKER");
    expect((await grade("checker", mutate("if (exp_q.size() == 0) begin", "if (0) begin"))).diagnostics[0].code).toBe("NO_EMPTY_GUARD");
    expect((await grade("checker", mutate("if ($isunknown(out_valid)) begin", "if (1'b0) begin"))).diagnostics[0].code).toBe("NO_X_CHECK");
  });

  it("directed-tests: corners must straddle 255/256, gaps needs a gap and a back-to-back pair, every test ends idle", async () => {
    const no256 = mutate("send(8'd200, 8'd56);", "send(8'd200, 8'd50);").replace("send(8'd128, 8'd128);", "send(8'd128, 8'd120);");
    expect((await grade("directed-tests", no256)).diagnostics[0].code).toBe("NO_SATURATION_BOUNDARY");
    expect((await grade("directed-tests", mutate("send(8'd200, 8'd56);", "send(8'd200, 8'd50);"))).success).toBe(true); // 128 + 128 still makes 256
    expect((await grade("directed-tests", mutate("    send(8'd9, 8'd10);                 // back to back", "    idle(1);"))).diagnostics[0].code).toBe("NO_BACK_TO_BACK");
    expect((await grade("directed-tests", mutate("    send(8'd11, 8'd12);\n    idle(1);\n", "    send(8'd11, 8'd12);\n"))).diagnostics[0].code).toBe("TEST_LEAVES_VALID_HIGH");
    await expect(grade("directed-tests", mutate("send(8'd200, 8'd55);", "send(8'hC8, 8'h37);"))).resolves.toMatchObject({ success: true });
  });

  it("verdict: join instead of join_any, no leftover count, a vacuous pass and a missing $finish fail", async () => {
    expect((await grade("verdict", mutate("join_any", "join"))).diagnostics[0].code).toBe("JOIN_WAITS_FOR_WATCHDOG");
    expect((await grade("verdict", mutate("fail_cnt += exp_q.size();", ""))).diagnostics[0].code).toBe("LEFTOVERS_NOT_COUNTED");
    expect((await grade("verdict", mutate("if (pass_cnt == 0 && fail_cnt == 0) begin", "if (1'b0) begin"))).diagnostics[0].code).toBe("VACUOUS_PASS");
    expect((await grade("verdict", mutate("    report();\n    $finish;", "    report();"))).diagnostics[0].code).toBe("NO_FINISH");
  });
});
