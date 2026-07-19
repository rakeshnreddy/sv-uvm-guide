import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeExecutionEnvironment } from "@/components/ui/CodeExecutionEnvironment";

describe("CodeExecutionEnvironment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits the learner workspace and does not advertise unsupported controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "SIMULATION_EXECUTION_NOT_CONFIGURED" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const prepareFiles = vi.fn().mockResolvedValue([
      { path: "work/top.sv", content: "module learner_top; endmodule\n" },
    ]);

    render(<CodeExecutionEnvironment prepareFiles={prepareFiles} />);
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^step$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run workspace" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      backend: "icarus",
      files: [{ path: "work/top.sv", content: "module learner_top; endmodule\n" }],
    });
    expect(await screen.findByText("SIMULATION_EXECUTION_NOT_CONFIGURED")).toBeInTheDocument();
  });
});
