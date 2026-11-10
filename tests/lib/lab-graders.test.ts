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

describe("sv-clocking-v1 grader (constructs-1)", () => {
  const clocking = graderRegistry.get("sv-clocking-v1")!;
  const labDir = path.join(process.cwd(), "content", "curriculum", "labs", "constructs");
  const read = (relative: string) => fs.readFileSync(path.join(labDir, relative), "utf8");
  const DUT = read("work/rot_pipe.sv");
  const STARTER_IF = read("work/pipe_if.sv");
  const STARTER_TB = read("work/tb_top.sv");
  const SOLUTION_IF = read("solution/pipe_if.sv");
  const SOLUTION_TB = read("solution/tb_top.sv");
  const GRADED_STEPS = ["clocking-blocks", "driver", "monitor", "verdict"];

  function grade(stepId: string, iface: string, tb: string): Promise<GraderResult> {
    const submission: LabSubmission = {
      labId: "constructs-1",
      labVersion: "2",
      stepId,
      stepVersion: "1",
      files: [
        { path: "work/rot_pipe.sv", content: DUT },
        { path: "work/pipe_if.sv", content: iface },
        { path: "work/tb_top.sv", content: tb },
      ],
    };
    return clocking.grade(submission);
  }

  /** One exact piece of text replaced; fails loudly if the text is not there. */
  function swap(source: string, from: string, to: string): string {
    expect(source).toContain(from);
    return source.replace(from, to);
  }
  const ifWith = (from: string, to: string) => grade("clocking-blocks", swap(SOLUTION_IF, from, to), SOLUTION_TB);
  const tbWith = (step: string, from: string, to: string) => grade(step, SOLUTION_IF, swap(SOLUTION_TB, from, to));
  const codeOf = (result: GraderResult) => result.diagnostics[0]?.code;

  it("rejects the untouched starter on every graded step", async () => {
    for (const step of GRADED_STEPS) {
      expect((await grade(step, STARTER_IF, STARTER_TB)).success, step).toBe(false);
    }
  });

  it("accepts the reference solution on every graded step, and grades structure only", async () => {
    expect(clocking.requiresSandbox).toBe(false);
    for (const step of GRADED_STEPS) {
      await expect(grade(step, SOLUTION_IF, SOLUTION_TB), step).resolves.toMatchObject({ success: true });
    }
    expect((await grade("prove-it-fails", SOLUTION_IF, SOLUTION_TB)).hint).toContain("not graded");
  });

  it("ignores clocking blocks hidden in comments", async () => {
    const commented = STARTER_IF.replace("endinterface", "// default clocking cb @(posedge clk); output in_vld; endclocking\nendinterface");
    expect(codeOf(await grade("clocking-blocks", commented, STARTER_TB))).toBe("CB_NOT_FOUND");
  });

  it("clocking-blocks: cb must be the default, sample #1step, drive #0, and leave the asynchronous reset out", async () => {
    expect(codeOf(await ifWith("default clocking cb @(posedge clk);", "clocking cb @(posedge clk);"))).toBe("CB_NOT_DEFAULT");
    expect(codeOf(await ifWith("default input #1step output #0;", "default input #1step output #2;"))).toBe("CB_SKEWS");
    expect(codeOf(await ifWith("default clocking cb @(posedge clk);", "default clocking cb @(negedge clk);"))).toBe("CB_WRONG_EVENT");
    const resetInCb = await ifWith("output in_vld, in_data;", "output rst_n, in_vld, in_data;");
    expect(codeOf(resetInCb)).toBe("CB_DRIVES_RESET");
    expect(resetInCb.hint).toContain("asynchronous");
    expect(codeOf(await ifWith("output in_vld, in_data;", "output in_vld;"))).toBe("CB_OUTPUT_MISSING");
  });

  it("clocking-blocks: mon_cb has inputs only and includes reset; wait_cycles uses ##", async () => {
    expect(codeOf(await ifWith("input rst_n, in_vld, in_data, out_vld, out_data;", "input rst_n, out_vld, out_data;\n    output in_vld, in_data;"))).toBe("MON_CB_CAN_DRIVE");
    expect(codeOf(await ifWith("input rst_n, in_vld, in_data, out_vld, out_data;", "input in_vld, in_data, out_vld, out_data;"))).toBe("MON_CB_INPUT_MISSING");
    expect(codeOf(await ifWith("repeat (n) ##1;", "repeat (n) @(posedge clk);"))).toBe("WAIT_CYCLES_NO_CYCLE_DELAY");
  });

  it("driver: raw writes, blocking writes to a clockvar and waiting on the clock fail", async () => {
    const raw = await tbWith("driver", "bus.cb.in_vld  <= 1'b1;", "bus.in_vld = 1'b1;");
    expect(codeOf(raw)).toBe("RAW_DRIVE");
    expect(codeOf(await tbWith("driver", "bus.cb.in_data <= data;", "bus.cb.in_data = data;"))).toBe("BLOCKING_CLOCKVAR");
    const racy = await tbWith("driver", "    bus.cb.in_vld  <= 1'b1;\n", "    @(posedge clk);\n    bus.cb.in_vld  <= 1'b1;\n");
    expect(codeOf(racy)).toBe("SEND_WAITS_ON_CLOCK");
    expect(racy.hint).toContain("@(bus.cb)");
    expect(codeOf(await tbWith("driver", "    @(bus.cb);\n  endtask\n\n  // No item", "  endtask\n\n  // No item"))).toBe("SEND_NO_WAIT");
    expect(codeOf(await tbWith("driver", "    repeat (n) @(bus.cb);", "    ##(n);"))).toBe("CYCLE_DELAY_OUTSIDE");
  });

  it("driver: the expectation needs the model and a due time", async () => {
    const noDue = await tbWith("driver", "dout: model_rotl(data),\n                           due: $time + SAMPLE_EDGES * CLK_PERIOD", "dout: model_rotl(data), due: 0");
    expect(codeOf(noDue)).toBe("NO_DUE_TIME");
    expect(codeOf(await tbWith("driver", "dout: model_rotl(data),", "dout: bus.out_data,"))).toBe("MODEL_NOT_USED");
  });

  it("monitor: waiting on the clock, raw reads, reads of cb and a value-only check fail", async () => {
    const onClock = await tbWith("monitor", "@(bus.mon_cb);", "@(posedge clk);");
    expect(codeOf(onClock)).toBe("MONITOR_WAITS_ON_CLOCK");
    expect(onClock.hint).toContain("races");
    expect(codeOf(await tbWith("monitor", "end else if (bus.mon_cb.out_vld) begin", "end else if (bus.out_vld) begin"))).toBe("RAW_READ");
    expect(codeOf(await tbWith("monitor", "end else if (bus.mon_cb.out_vld) begin", "end else if (bus.cb.out_vld) begin"))).toBe("MONITOR_USES_CB");
    const valueOnly = await tbWith("monitor", "if ($time != e.due) begin", "if (1'b0) begin");
    expect(codeOf(valueOnly)).toBe("NO_TIME_CHECK");
    expect(valueOnly.hint).toContain("BUG=2");
    expect(codeOf(await tbWith("monitor", "bus.mon_cb.out_data !== e.dout", "bus.mon_cb.out_data != e.dout"))).toBe("NOT_CASE_INEQUALITY");
    expect(codeOf(await tbWith("monitor", "if (exp_q.size() == 0) begin", "if (1'b0) begin"))).toBe("NO_EMPTY_GUARD");
    expect(codeOf(await tbWith("monitor", "if ($isunknown(bus.mon_cb.out_vld)) begin", "if (1'b0) begin"))).toBe("NO_X_CHECK");
  });

  it("verdict: reset through cb, ## in tb_top, no drain, join and a vacuous pass fail", async () => {
    const viaCb = await tbWith("verdict", "#12 bus.rst_n = 1'b1;", "#12 bus.cb.rst_n <= 1'b1;");
    expect(codeOf(viaCb)).toBe("RESET_THROUGH_CB");
    expect(codeOf(await tbWith("verdict", "bus.wait_cycles(SAMPLE_EDGES + 2);", "##6;"))).toBe("CYCLE_DELAY_OUTSIDE");
    expect(codeOf(await tbWith("verdict", "bus.wait_cycles(SAMPLE_EDGES + 2);", "repeat (6) @(bus.cb);"))).toBe("NO_DRAIN");
    expect(codeOf(await tbWith("verdict", "@(bus.cb);                           // the 15 ns edge", "@(posedge clk);"))).toBe("MAIN_WAITS_ON_CLOCK");
    expect(codeOf(await tbWith("verdict", "join_any", "join"))).toBe("JOIN_WAITS_FOR_WATCHDOG");
    expect(codeOf(await tbWith("verdict", "if (pass_cnt == 0 && fail_cnt == 0) begin", "if (1'b0) begin"))).toBe("VACUOUS_PASS");
    await expect(tbWith("verdict", "if (pass_cnt == 0 && fail_cnt == 0) begin", "if (pass_cnt + fail_cnt == 0) begin")).resolves.toMatchObject({ success: true });
  });
});
