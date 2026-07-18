import { describe, expect, it } from "vitest";

import { simulationRequestSchema } from "@/server/simulation";

describe("simulationRequestSchema", () => {
  it("accepts an allowlisted backend and bounded workspace", () => {
    expect(
      simulationRequestSchema.parse({
        backend: "verilator",
        files: [{ path: "rtl/top.sv", content: "module top; endmodule" }],
      }),
    ).toEqual({
      backend: "verilator",
      files: [{ path: "rtl/top.sv", content: "module top; endmodule" }],
    });
  });

  it.each(["wasm", "bash", "custom"])("rejects backend %s", (backend) => {
    expect(() =>
      simulationRequestSchema.parse({
        backend,
        files: [{ path: "top.sv", content: "module top; endmodule" }],
      }),
    ).toThrow();
  });

  it("rejects traversal and duplicate paths", () => {
    expect(() =>
      simulationRequestSchema.parse({
        backend: "icarus",
        files: [
          { path: "../top.sv", content: "module top; endmodule" },
          { path: "../top.sv", content: "module duplicate; endmodule" },
        ],
      }),
    ).toThrow();
  });
});
