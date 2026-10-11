import { describe, expect, it } from "vitest";

import { graderRegistry, type LabSubmission } from "@/lib/lab-graders";

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
