import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InterfaceSignalFlow from "@/components/animations/InterfaceSignalFlow";
import { interfaceData } from "@/components/animations/interface-data";

/** Names listed after `inout` in any modport of the example code. */
function inoutNames(code: string): string[] {
  const names: string[] = [];
  for (const mp of code.matchAll(/modport\s+\w+\s*\(([^)]*)\)/g)) {
    let dir = "";
    for (const raw of mp[1].split(",")) {
      const parts = raw.trim().split(/\s+/);
      if (["input", "output", "inout", "ref"].includes(parts[0])) dir = parts.shift() as string;
      if (dir === "inout" && parts[0]) names.push(parts[0]);
    }
  }
  return names;
}

describe("InterfaceSignalFlow data", () => {
  it("never puts a variable on an inout modport port: inout needs a net (§6.5, §23.3.3)", () => {
    for (const example of interfaceData) {
      for (const name of inoutNames(example.code)) {
        const decl = new RegExp(`^\\s*(wire|tri|logic|reg|bit)\\b[^;]*\\b${name}\\s*;`, "m").exec(example.code);
        expect(decl?.[1], `${example.name}: ${name}`).toBe("wire");
      }
    }
  });

  it("does not claim simulated glitches or signal-integrity effects", () => {
    expect(interfaceData.some((e) => e.signals.some((s) => s.glitch || s.delay))).toBe(false);
    expect(interfaceData.flatMap((e) => e.steps).join(" ")).not.toMatch(/signal integrity/i);
  });
});

describe("InterfaceSignalFlow", () => {
  it("does not autoplay: the clock waits for the learner", () => {
    render(<InterfaceSignalFlow />);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
