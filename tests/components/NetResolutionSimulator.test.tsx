import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NetResolutionSimulator from "@/components/visuals/NetResolutionSimulator";

const code = () => within(screen.getByRole("list", { name: "The code" }));
const fullForm = () => screen.getByText(/written out in full/).textContent;
const lockIn = () => fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));

describe("NetResolutionSimulator", () => {
  it("is not a placeholder: it renders a model-backed experiment", () => {
    render(<NetResolutionSimulator />);
    expect(screen.getByRole("region", { name: /net resolution simulator/i })).toBeInTheDocument();
    expect(screen.getByText(/Deterministic educational model/)).toBeInTheDocument();
  });

  it("gates the result behind a prediction and diagnoses 'conflict means x' when strengths differ", () => {
    render(<NetResolutionSimulator />);
    // Default: wire, a = 0 strong, b = 1 weak.
    expect(screen.queryByText(/is the strongest driver/)).not.toBeInTheDocument();
    expect(screen.getByText("assign (strong0, strong1) y = a;")).toBeInTheDocument();
    expect(screen.getByText("assign (weak0, weak1) y = b;")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getByText(/not at the same strength/)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value St0")).toBeInTheDocument();
    expect(screen.getAllByText(/is the strongest driver/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("sets the net value").length).toBe(1);
  });

  it("equal-strength opposite drivers on a wire resolve to StX", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Bus fight" }));
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value StX")).toBeInTheDocument();
  });

  it("switching to wand changes the answer for the same drivers (Table 6-3)", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Bus fight" }));
    const nets = screen.getByRole("radiogroup", { name: "Net type" });
    fireEvent.keyDown(within(nets).getByRole("radio", { name: "wire" }), { key: "ArrowRight" });
    expect(within(nets).getByRole("radio", { name: "wand" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getAllByText(/wired AND/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("strength and value St0")).toBeInTheDocument();
  });

  it("a weak driver loses to the tri0 pull-down", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Weak 1 vs tri0" }));
    fireEvent.click(screen.getByLabelText("y reads 0"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value Pu0")).toBeInTheDocument();
  });

  it("lets the learner set a driver strength and add a third driver from the keyboard", () => {
    render(<NetResolutionSimulator />);
    fireEvent.change(screen.getByLabelText("Strength of driver b"), { target: { value: "supply" } });
    expect(screen.getByText("assign (supply0, supply1) y = b;")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add a third driver/i }));
    expect(screen.getByRole("radiogroup", { name: "Value driven by c" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads 1"));
    lockIn();
    expect(screen.getByLabelText("strength and value Su1")).toBeInTheDocument();
  });

  it("variable vs net: two assigns on logic y are a compile error, on wire y they resolve", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Variable vs net" }));
    expect(screen.queryByText(/multiple continuous drivers on a variable/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/y is the resolved value of both drivers/));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/Compile error: multiple continuous drivers on a variable/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /wire y, a net/ }));
    fireEvent.click(screen.getByLabelText(/y is the resolved value of both drivers/));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Legal: the net resolves its drivers/)).toBeInTheDocument();
  });

  it("two always blocks on a variable are legal: last write wins", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Variable vs net" }));
    fireEvent.click(screen.getByRole("radio", { name: "two always" }));
    fireEvent.click(screen.getByLabelText(/It does not compile/));
    lockIn();
    expect(screen.getByText(/Several procedural writers are legal/)).toBeInTheDocument();
    expect(screen.getByText(/Legal: the last procedural write wins/)).toBeInTheDocument();
  });

  it("trireg keeps its charge when every driver lets go, while a wire floats", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "trireg holds charge" }));
    expect(screen.getByText(/trireg \(medium\) y;/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads z: nothing drives it"));
    lockIn();
    expect(screen.getByText(/never floats to z/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /same drivers on a trireg and on a wire/ });
    expect(within(table).getByText("Me1")).toBeInTheDocument();
    expect(within(table).getAllByText("We0")).toHaveLength(2);
    expect(within(table).getAllByText("HiZ").length).toBeGreaterThan(0);
  });

  it("initialMode='trireg' opens the trireg mode", () => {
    render(<NetResolutionSimulator initialMode="trireg" />);
    expect(screen.getByRole("radio", { name: "trireg holds charge" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/trireg \(medium\) y;/)).toBeInTheDocument();
  });

  it("preset accepts an existing corner-case id", () => {
    render(<NetResolutionSimulator preset="fight" />);
    expect(screen.getByText("assign (strong0, strong1) y = b;")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("y reads x"));
    lockIn();
    expect(screen.getByLabelText("strength and value StX")).toBeInTheDocument();
  });
});

describe("NetResolutionSimulator: driver rules per bit (pattern='bitwise')", () => {
  it("hides the bit map until the prediction, then colours each bit with its writers", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    expect(screen.getByRole("radio", { name: "Bits of logic [1:0] v" })).toHaveAttribute("aria-checked", "true");
    expect(code().getByText("assign v[0] = a;")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Writers of each bit of v" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("It compiles"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const map = screen.getByRole("list", { name: "Writers of each bit of v" });
    expect(within(map).getByText("v[1]")).toBeInTheDocument();
    expect(within(map).getByText("assign v[0] = a")).toBeInTheDocument();
    expect(screen.getAllByText(/Each bit of a packed variable is its own element/).length).toBeGreaterThan(0);
  });

  it("flags the overlapping bit with its clause when assign v and assign v[1] both drive it", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    fireEvent.click(screen.getByRole("button", { name: "Whole v plus v[1]" }));
    fireEvent.click(screen.getByLabelText("It compiles"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/One bit breaks the rule/).length).toBeGreaterThan(0);
    expect(screen.getByText("two continuous (§6.5, §10.3.2)")).toBeInTheDocument();
    expect(screen.getByText(/Compile error: multiple continuous drivers on a variable/)).toBeInTheDocument();
  });

  it("an initializer counts as a procedural write: initializer + assign v does not compile", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    fireEvent.click(screen.getByRole("button", { name: "Initializer + assign v" }));
    expect(code().getByText("logic [1:0] v = 2'b00;")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("It does not compile"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // Tagged from the error class: one writer is procedural (the initializer) and one continuous.
    expect(screen.getAllByText("continuous + procedural (§6.5, §10.3.2)")).toHaveLength(2);
    expect(screen.queryByText(/^overlap/)).not.toBeInTheDocument();
  });

  it("ticking writers by checkbox: initializer + always_comb is reported as left to the tool", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /assign v\[0\] = a;/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /assign v\[1\] = b;/ }));
    expect(screen.getByText(/Tick at least one writer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /always_comb v\[1\] = b & c;/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /declaration initializer/ }));
    fireEvent.click(screen.getByLabelText("It does not compile"));
    lockIn();
    expect(screen.getAllByText(/Neither answer is guaranteed/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Not settled by the standard/)).toBeInTheDocument();
  });

  it("mixed case: an error on v[0] does not turn the open v[1] green (initializer + always_comb v[1] + assign v[0])", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    // Default preset ticks assign v[0] and assign v[1]; drop v[1], add always_comb v[1] and the initializer.
    fireEvent.click(screen.getByRole("checkbox", { name: /assign v\[1\] = b;/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /always_comb v\[1\] = b & c;/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /declaration initializer/ }));
    expect(screen.queryByText(/left to the tool/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("The standard leaves it to the tool"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/another bit breaks the rule, so it does not compile either way/).length).toBeGreaterThan(0);
    const map = screen.getByRole("list", { name: "Writers of each bit of v" });
    const cards = Array.from(map.querySelectorAll(":scope > li"));
    const card = (bit: number) => cards.find((li) => li.querySelector("p")?.textContent?.startsWith(`v[${bit}]`)) ?? null;
    expect(card(1)).toHaveAttribute("data-outcome", "tool-dependent");
    expect(card(1)?.className).toMatch(/amber/);
    expect(card(1)?.className).not.toMatch(/emerald/);
    expect(within(card(1) as HTMLElement).getByText("open (§6.5, §9.2.2.2)")).toBeInTheDocument();
    expect(card(0)).toHaveAttribute("data-outcome", "compile-error");
    expect(within(card(0) as HTMLElement).getByText("continuous + procedural (§6.5, §10.3.2)")).toBeInTheDocument();
    expect(screen.getAllByText(/v\[1\] is left to the tool/).length).toBeGreaterThan(0);
  });

  it("an instance output port is a continuous driver: with assign v[0] it overlaps on bit 0", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="bitwise" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /assign v\[1\] = b;/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /output port of an instance/ }));
    fireEvent.click(screen.getByLabelText("It does not compile"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/v\[0\] is written by/).length).toBeGreaterThan(0);
  });
});

describe("NetResolutionSimulator: port kinds (pattern='ports')", () => {
  it("input logic a is a net; the reveal writes it out in full", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="ports" />);
    expect(code().getByText(/input logic a/)).toBeInTheDocument();
    expect(screen.queryByText(/written out in full/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("It is a variable"));
    lockIn();
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/logic names a data type, not a kind/).length).toBeGreaterThan(0);
    expect(fullForm()).toMatch(/input wire logic a$/);
  });

  it("output logic y is a variable", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="ports" />);
    fireEvent.click(screen.getByRole("button", { name: "output logic y" }));
    fireEvent.click(screen.getByLabelText("It is a variable"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(fullForm()).toMatch(/output var logic y$/);
  });

  it("from the keyboard: inout var does not compile, and the reveal explains why an inout cannot be a variable", () => {
    render(<NetResolutionSimulator initialMode="legality" pattern="ports" />);
    const dir = screen.getByRole("radiogroup", { name: "Port direction" });
    fireEvent.keyDown(within(dir).getByRole("radio", { name: "input" }), { key: "ArrowRight" });
    fireEvent.keyDown(within(dir).getByRole("radio", { name: "output" }), { key: "ArrowRight" });
    expect(within(dir).getByRole("radio", { name: "inout" })).toHaveAttribute("aria-checked", "true");
    const kind = screen.getByRole("radiogroup", { name: "Port kind keyword" });
    fireEvent.keyDown(within(kind).getByRole("radio", { name: "no port kind keyword" }), { key: "End" });
    expect(code().getByText(/inout var logic z/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("It does not compile"));
    lockIn();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getAllByText(/cannot be connected to either side of an inout port/).length).toBeGreaterThan(0);
  });
});

describe("NetResolutionSimulator: open-drain on tri1 (preset='open-drain')", () => {
  it("emits (strong0, highz1) assigns and resolves all four combinations, revealing the pattern only at the end", () => {
    render(<NetResolutionSimulator initialMode="drivers" preset="open-drain" />);
    expect(screen.getByText("assign (strong0, highz1) sda = dev_a_drive_low ? 1'b0 : 1'b1;")).toBeInTheDocument();
    expect(screen.getAllByText("predict first")).toHaveLength(4);

    // Both let go: the pull-up decides.
    fireEvent.click(screen.getByLabelText("sda reads z (floating)"));
    lockIn();
    expect(screen.getByText(/never left floating/)).toBeInTheDocument();
    expect(screen.getByLabelText("strength and value Pu1")).toBeInTheDocument();
    expect(screen.getAllByText(/dev_a lets go of the line/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/The pattern:/)).not.toBeInTheDocument();
    expect(screen.getByText("1 of 4 combinations predicted.")).toBeInTheDocument();

    const combos: [string, string][] = [
      ["dev_a pulls low", "dev_b lets go"],
      ["dev_a lets go", "dev_b pulls low"],
      ["dev_a pulls low", "dev_b pulls low"],
    ];
    for (const [a, b] of combos) {
      fireEvent.click(screen.getByRole("radio", { name: a }));
      fireEvent.click(screen.getByRole("radio", { name: b }));
      fireEvent.click(screen.getByLabelText("sda reads 0"));
      lockIn();
      expect(screen.getByText(/Correct\./)).toBeInTheDocument();
      expect(screen.getByLabelText("strength and value St0")).toBeInTheDocument();
    }
    expect(screen.queryByText("predict first")).not.toBeInTheDocument();
    expect(screen.getByText(/The pattern:/)).toBeInTheDocument();
    expect(screen.getByText(/only when every device lets go/)).toBeInTheDocument();
  });

  it("a wrong guess of 1 while a device pulls low is diagnosed as strength before value", () => {
    render(<NetResolutionSimulator initialMode="drivers" preset="open-drain" />);
    fireEvent.click(screen.getByRole("radio", { name: "dev_b pulls low" }));
    fireEvent.click(screen.getByLabelText("sda reads 1"));
    lockIn();
    expect(screen.getByText(/Strength decides before value/)).toBeInTheDocument();
    expect(screen.getAllByText(/The built-in pull-up \(1 at pull\) is weaker/).length).toBeGreaterThan(0);
  });

  it("the open-drain preset is reachable from the default embed", () => {
    render(<NetResolutionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Open-drain on tri1" }));
    expect(screen.getByRole("radiogroup", { name: "dev_a action" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bus fight" }));
    expect(screen.getByRole("radiogroup", { name: "Net type" })).toBeInTheDocument();
  });
});
