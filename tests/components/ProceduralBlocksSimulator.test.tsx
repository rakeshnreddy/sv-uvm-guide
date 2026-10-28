import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProceduralBlocksSimulator from "@/components/animations/ProceduralBlocksSimulator";
import { ALL_PROCEDURAL_SCENARIO_IDS, getTimeZeroScenario, proceduralScenarios } from "@/components/animations/procedural-blocks-data";
import { alignedOutcomeRuns, exploreProcessOrders, simulateProcesses } from "@/lib/sv-process-model";

const RUN = "Run every order of the ready processes";

const lockIn = (label: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("ProceduralBlocksSimulator", () => {
  it("is read-only and gates the run behind a prediction", () => {
    render(<ProceduralBlocksSimulator />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /playback controls/i })).not.toBeInTheDocument();
    lockIn(/final: count = 2, at t = 22 ns/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: /process step scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    const output = screen.getByText(/Simulation output/i).closest("div") as HTMLElement;
    expect(within(output).getByText(/final: count = 2/).closest("li")).toHaveTextContent("22 ns");
  });

  it("shows nonblocking updates in the NBA region of the same time step", () => {
    render(<ProceduralBlocksSimulator scenario="nba-swap" />);
    lockIn(/display a=1 b=2 and \$strobe a=1 b=2/);
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/land in the NBA region of the same time step/)).toBeInTheDocument();

    const nbaIndex = simulateProcesses(proceduralScenarios[1].build("nba")).trace.findIndex((s) => s.region === "nba");
    fireEvent.change(screen.getByRole("slider", { name: /process step scrubber/i }), { target: { value: nbaIndex } });
    expect(screen.getByText("NBA region")).toBeInTheDocument();
    expect(screen.getByText(/NBA region, still t = 10: a updates 1 → 2/)).toBeInTheDocument();
    expect(screen.getByText("t = 10 ns")).toBeInTheDocument();
  });

  it("switching to blocking assignments re-runs the model and resets the prediction", () => {
    render(<ProceduralBlocksSimulator scenario="nba-swap" />);
    fireEvent.click(screen.getByRole("radio", { name: "Blocking assignments" }));
    expect(screen.getAllByText("a = b;").length).toBeGreaterThan(0);
    lockIn(/display a=2 b=2, then \$strobe a=2 b=2/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("supports keyboard scenario selection", () => {
    render(<ProceduralBlocksSimulator />);
    const programs = screen.getByRole("radiogroup", { name: "Program" });
    fireEvent.keyDown(within(programs).getByRole("radio", { name: /initial · always · final/ }), { key: "ArrowRight" });
    expect(within(programs).getByRole("radio", { name: /<= versus =/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/what do \$display and \$strobe print/i)).toBeInTheDocument();
  });
});

describe("ProceduralBlocksSimulator: time-zero programs", () => {
  const groupsRegion = () => screen.getByRole("group", { name: "Outcome groups" });

  it("time0-reset: one program hides the picker, the reset form sits in the code line, and nothing runs before a prediction", () => {
    render(<ProceduralBlocksSimulator scenario="time0-reset" scenarios={["time0-reset"]} />);
    expect(screen.getByRole("region", { name: "Procedural blocks simulator" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Program" })).not.toBeInTheDocument();
    const form = screen.getByRole("radiogroup", { name: "How the bench applies reset" });
    expect(form.closest("li")).toHaveTextContent("rst_n = 1'b0;");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RUN })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /playback controls/i })).not.toBeInTheDocument();

    lockIn(/It depends on which procedure the simulator starts first/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Race: 2 different outcomes across 7 orders of the ready processes.")).toBeInTheDocument();
    // No autoplay: the step-through waits at step 1.
    expect(screen.getByRole("slider", { name: /process step scrubber/i })).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("time0-reset: running every order of the ready processes shows both outcomes from the first divergent step, and one can be stepped through", () => {
    render(<ProceduralBlocksSimulator scenario="time0-reset" scenarios={["time0-reset"]} />);
    lockIn(/It depends on which procedure the simulator starts first/);
    const run = screen.getByRole("button", { name: RUN });
    expect(run).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(run);
    expect(run).toHaveAttribute("aria-expanded", "true");
    const groups = groupsRegion();
    expect(within(groups).getByText("state: S_IDLE at 0 ns")).toBeInTheDocument();
    expect(within(groups).getByText("state: x at 0 ns, S_IDLE from 5 ns")).toBeInTheDocument();
    expect(within(groups).getByText("Scheduler choice")).toBeInTheDocument();
    expect(within(groups).getByText("flop runs next (of flop, bench)")).toBeInTheDocument();
    expect(within(groups).getByText("bench runs next (of flop, bench)")).toBeInTheDocument();
    expect(within(groups).getAllByText("≠ first difference")).toHaveLength(2);
    expect(screen.getByRole("img", { name: /Over simulation time: state: unknown \(x\) at 0 ns, S_IDLE from 5 ns/ })).toBeInTheDocument();
    expect(screen.getByText(/split at step 4, still at t = 0 ns/)).toBeInTheDocument();

    const second = within(groups).getByRole("button", { name: /^Outcome 2 · start order clock → bench → flop/ });
    expect(second).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Stepping through outcome 2: clock → bench → flop/)).toBeInTheDocument();

    const scenario = getTimeZeroScenario("time0-reset").build({ variant: "blocking", advanced: false });
    const missed = alignedOutcomeRuns(scenario, exploreProcessOrders(scenario, { watch: ["state"] }))[1].trace.findIndex((s) => /missed/.test(s.why));
    fireEvent.change(screen.getByRole("slider", { name: /process step scrubber/i }), { target: { value: missed } });
    expect(screen.getByText(/this change is missed: rst_n x → 0 is a negedge \(Table 9-2, from x to 0\)/)).toBeInTheDocument();

    const slider = screen.getByRole("slider", { name: /process step scrubber/i });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    expect(screen.getByText("Model horizon")).toBeInTheDocument();
    expect(screen.getByText("Booked delay wake-ups").parentElement).toHaveTextContent("bench at t = 15 ns (past the model horizon)");
  });

  it("time0-reset: changing the reset form inside the code re-runs the model and resets the prediction", () => {
    render(<ProceduralBlocksSimulator scenario="time0-reset" scenarios={["time0-reset"]} />);
    lockIn(/It depends on which procedure the simulator starts first/);
    const form = screen.getByRole("radiogroup", { name: "How the bench applies reset" });
    fireEvent.keyDown(within(form).getByRole("radio", { name: /^Blocking/ }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /^Nonblocking/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("rst_n <= 1'b0;").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    lockIn("Yes: state is S_IDLE at t = 0 in every order of the ready processes");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Same outcome in all 6 orders of the ready processes the model ran.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /^Declaration initializer/ }));
    const initializerLine = screen.getByRole("radiogroup", { name: "How the bench applies reset" }).closest("li");
    expect(initializerLine).toHaveTextContent("logic rst_n = 1'b0;");
    lockIn("No: state stays x until the clock rises at 5 ns");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("comb-vs-star: the picker is restricted, initialVariant applies, and Show advanced splits the outcome", () => {
    render(<ProceduralBlocksSimulator scenarios={["comb-vs-star", "time0-reset"]} initialVariant="inputs-static" />);
    const programs = screen.getByRole("radiogroup", { name: "Program" });
    expect(within(programs).getAllByRole("radio")).toHaveLength(2);
    expect(within(programs).getByRole("radio", { name: "always_comb vs @*" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^a static/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/a never changes after its initializer/)).toBeInTheDocument();
    lockIn("y1 = x, y2 = 1 when the run ends");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();

    const advanced = screen.getByRole("button", { name: /Show advanced/ });
    fireEvent.click(advanced);
    expect(advanced).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Procedure: logic a; with initial a = 1'b1;" }));
    expect(screen.getAllByText("initial a = 1'b1; // init a").length).toBeGreaterThan(0);
    expect(screen.getByText(/Does always @\* see that write\?/)).toBeInTheDocument();
    lockIn(/It depends on the start order for y1; y2 = 1 at t = 0 either way/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    expect(within(groupsRegion()).getByText("y1: 1 at 0 ns · y2: 1 at 0 ns")).toBeInTheDocument();
    expect(within(groupsRegion()).getByText("y1: x at 0 ns · y2: 1 at 0 ns")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Outcome waveforms" })).getAllByRole("img")).toHaveLength(2);
  });

  it("comb-vs-star: with the #10 write, y2 is 1 at 0 and y1 stays x until 10", () => {
    render(<ProceduralBlocksSimulator scenario="comb-vs-star" scenarios={["comb-vs-star"]} />);
    expect(screen.getByText("What are y1 and y2 at t = 0 (once time 0 settles) and at t = 10 ns?")).toBeInTheDocument();
    lockIn("y1 = 1, y2 = 1 at 0 ns; both 0 at 10 ns");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/it waits until something it reads changes \(§9\.2\.2\.2\.2\)/)).toBeInTheDocument();
    expect(screen.getByText(/always_comb is triggered once at time zero, after every procedure has started/)).toBeInTheDocument();
  });

  it("time0-race: 2 or 3 lines depending on order; the fix gives 2 in every order", () => {
    render(<ProceduralBlocksSimulator scenario="time0-race" scenarios={["time0-race"]} />);
    lockIn(/2 or 3: it depends on which block the simulator starts first/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    expect(within(groupsRegion()).getByText("3 lines: t=0 a=0 · t=10 a=1 · t=20 a=0")).toBeInTheDocument();
    expect(within(groupsRegion()).getByText("2 lines: t=10 a=1 · t=20 a=0")).toBeInTheDocument();
    // The cards use the lesson's names for the two orders (F3A's table and the notice say Order A / Order B).
    expect(within(groupsRegion()).getByRole("button", { name: /^Order A · start order always block → initial block/ })).toBeInTheDocument();
    const orderB = within(groupsRegion()).getByRole("button", { name: /^Order B · start order initial block → always block/ });
    fireEvent.click(orderB);
    expect(screen.getByText(/Stepping through Order B: initial block → always block start in that order\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /^The fix/ }));
    expect(screen.getAllByText(/logic a = 0;/).length).toBeGreaterThan(0);
    lockIn("2 lines, on every simulator");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Same outcome in all 2 orders of the ready processes the model ran.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    expect(within(groupsRegion()).getByText(/Same outcome in every order of the ready processes \(2 orders run\)/)).toBeInTheDocument();
    expect(within(groupsRegion()).getByText("2 lines: t=10 a=1 · t=20 a=0")).toBeInTheDocument();
  });

  it("decl-init-ready: silent under IEEE 1800-2023; under the 1364-2005 rule the scheduler choice decides", () => {
    render(<ProceduralBlocksSimulator scenario="decl-init-ready" scenarios={["decl-init-ready"]} />);
    const rule = screen.getByRole("radiogroup", { name: "Initializer rule" });
    expect(rule.closest("li")).toHaveTextContent("reg ready = 1'b1;");
    lockIn("No: nothing prints at t = 0");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    // One procedure, so one order: singular wording, and no promise of "others".
    expect(screen.getByText("Only one order is possible: no two processes are ever ready at the same time, so there is no scheduler choice.")).toBeInTheDocument();
    expect(screen.getByText("Stepping through the only possible order: always block.")).toBeInTheDocument();
    expect(screen.queryByText(/legal orders/)).not.toBeInTheDocument();

    fireEvent.click(within(rule).getByRole("radio", { name: /IEEE 1364-2005 behaviour \(6\.8 NOTE\)/ }));
    expect(screen.getByText(/as if initial ready = 1'b1;/)).toBeInTheDocument();
    lockIn(/It depends on which process runs first/);
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    expect(within(groupsRegion()).getByText("Scheduler choice")).toBeInTheDocument();
    expect(within(groupsRegion()).getByText("prints nothing")).toBeInTheDocument();
    expect(within(groupsRegion()).getByText("1 line: ready changed to 1")).toBeInTheDocument();
    expect(within(groupsRegion()).getByText(/init ready runs next/)).toBeInTheDocument();
  });

  it("without `scenarios` the picker keeps the four single-run programs; time-zero programs appear only when an embed opts in", () => {
    const { unmount } = render(<ProceduralBlocksSimulator scenario="nba-swap" />);
    expect(within(screen.getByRole("radiogroup", { name: "Program" })).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "initial · always · final",
      "<= versus =",
      "fork…join timing",
      "@(posedge) vs wait()",
    ]);
    unmount();

    render(<ProceduralBlocksSimulator scenarios={[...ALL_PROCEDURAL_SCENARIO_IDS]} />);
    const programs = screen.getByRole("radiogroup", { name: "Program" });
    expect(within(programs).getAllByRole("radio")).toHaveLength(8);
    fireEvent.click(within(programs).getByRole("radio", { name: "the time-0 race" }));
    expect(screen.getByRole("radiogroup", { name: "Declaration of a" })).toBeInTheDocument();
    expect(screen.getByText("How many lines does this print?")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Assignment style" })).not.toBeInTheDocument();
  });

  it("time0-reset: keyboard focus follows the reset form when the control moves to the declaration line (WCAG 2.4.3)", () => {
    render(<ProceduralBlocksSimulator scenario="time0-reset" scenarios={["time0-reset"]} />);
    // Same line: = to <= keeps the control on the bench's reset line.
    fireEvent.click(screen.getByRole("radio", { name: /^Nonblocking/ }));
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^Nonblocking/ }));

    // The initializer form moves the control to `logic rst_n = 1'b0;`; focus goes with it.
    fireEvent.keyDown(screen.getByRole("radio", { name: /^Nonblocking/ }), { key: "ArrowRight" });
    const initializer = screen.getByRole("radio", { name: /^Declaration initializer/ });
    expect(initializer).toHaveAttribute("aria-checked", "true");
    expect(initializer.closest("li")).toHaveTextContent("logic rst_n = 1'b0;");
    expect(document.activeElement).toBe(initializer);

    // And back: the next arrow key still works, and focus moves to the bench line.
    fireEvent.keyDown(initializer, { key: "Home" });
    const blocking = screen.getByRole("radio", { name: /^Blocking/ });
    expect(blocking).toHaveAttribute("aria-checked", "true");
    expect(blocking.closest("li")).toHaveTextContent("rst_n = 1'b0;");
    expect(document.activeElement).toBe(blocking);

    // A click that moves the control keeps focus too.
    fireEvent.click(screen.getByRole("radio", { name: /^Declaration initializer/ }));
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^Declaration initializer/ }));
  });

  it("the declaration-initializer step is shown before any procedure starts, not in the Active region (§6.8)", () => {
    render(<ProceduralBlocksSimulator scenario="time0-race" scenarios={["time0-race"]} initialVariant="fix" />);
    lockIn("2 lines, on every simulator");
    const narration = screen.getByText(/Before any procedure starts, the declaration initializers set a = 0/).closest("div[aria-live]") as HTMLElement;
    expect(within(narration).getByText("Before any procedure starts (§6.8)")).toBeInTheDocument();
    expect(within(narration).queryByText("Active region")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: /process step scrubber/i }), { target: { value: 1 } });
    const next = screen.getByText(/t = 0: always block, initial block are ready to run/).closest("div[aria-live]") as HTMLElement;
    expect(within(next).getByText("Active region")).toBeInTheDocument();
  });

  it("comb-vs-star: the variant control sits on the stimulus line, which stays as a comment when a is static", () => {
    render(<ProceduralBlocksSimulator scenario="comb-vs-star" scenarios={["comb-vs-star"]} />);
    const control = screen.getByRole("radiogroup", { name: "What happens to a after time 0" });
    expect(control.closest("li")).toHaveTextContent("initial #10 a = 1'b0;");
    expect(screen.getAllByText("logic a = 1'b1;").length).toBeGreaterThan(0);
    expect(screen.getAllByText("logic y1, y2;").length).toBeGreaterThan(0);

    fireEvent.keyDown(within(control).getByRole("radio", { name: /^a falls/ }), { key: "ArrowRight" });
    const staticPill = screen.getByRole("radio", { name: /^a static/ });
    expect(staticPill).toHaveAttribute("aria-checked", "true");
    expect(staticPill.closest("li")).toHaveTextContent("// (no initial #10 a = 1'b0;)");
    expect(document.activeElement).toBe(staticPill);
  });

  it("comb-vs-star advanced: outcome 2 starts at the choice that decides y1 (init a before star), not the stimulus", () => {
    render(<ProceduralBlocksSimulator scenario="comb-vs-star" scenarios={["comb-vs-star"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Procedure: logic a; with initial a = 1'b1;" }));
    lockIn(/It depends on the start order for y1; y2 = 1 at t = 0 either way/);
    expect(screen.getByText(/even if its time-zero run came before init a's write, that write wakes it again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    const groups = groupsRegion();
    expect(within(groups).getByText("star runs next (of star, init a, stimulus)")).toBeInTheDocument();
    expect(within(groups).getByText("init a runs next (of star, init a, stimulus)")).toBeInTheDocument();
    expect(within(groups).queryByText(/stimulus runs next/)).not.toBeInTheDocument();
  });

  it("comb-vs-star 'a falls': the waveform gives the 10 ns value of y1 and y2 a labelled bar, and names x as unknown (x)", () => {
    render(<ProceduralBlocksSimulator scenario="comb-vs-star" scenarios={["comb-vs-star"]} />);
    lockIn("y1 = x, y2 = 1 at 0 ns; both 0 at 10 ns");
    fireEvent.click(screen.getByRole("button", { name: RUN }));
    const wave = within(screen.getByRole("group", { name: "Outcome waveforms" })).getByRole("img");
    expect(wave).toHaveAccessibleName("Over simulation time: y1: unknown (x) at 0 ns, 0 from 10 ns; y2: 1 at 0 ns, 0 from 10 ns.");
    // Labels drawn inside the bars: x, then 0 for y1; 1, then 0 for y2. Before the fix both 0 bars were unlabelled slivers.
    const labels = [...wave.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels.filter((t) => t === "0")).toHaveLength(2 + 1); // two bar labels and the 0 ns tick
    expect(labels).toContain("x");
    const bars = [...wave.querySelectorAll("rect[rx]")].map((r) => Number(r.getAttribute("width")));
    expect(bars).toHaveLength(4);
    bars.forEach((w) => expect(w).toBeGreaterThan(18));
  });

  it("comb-vs-star 'a falls': a learner who thinks @* never updates y1 has an option, with §9.4.2.2 feedback", () => {
    render(<ProceduralBlocksSimulator scenario="comb-vs-star" scenarios={["comb-vs-star"]} />);
    lockIn("y1 = x, y2 = 1 at 0 ns; y1 still x, y2 = 0 at 10 ns");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/the event expression \(§9\.4\.2\.2\)\. a going 1 → 0 at 10 ns is a change, so it wakes star and y1 = 0/)).toBeInTheDocument();
  });

  it("decl-init-ready: under the 1364-2005 rule the pre-start badge cites the §6.8 NOTE, not §6.8", () => {
    render(<ProceduralBlocksSimulator scenario="decl-init-ready" scenarios={["decl-init-ready"]} initialVariant="ieee1364-2005" />);
    lockIn(/It depends on which process runs first/);
    const narration = screen.getByText(/IEEE 1364-2005 behaviour: ready starts as x/).closest("div[aria-live]") as HTMLElement;
    expect(within(narration).getByText("Before any procedure starts · 1364-2005 rule (§6.8 NOTE)")).toBeInTheDocument();
    expect(within(narration).queryByText("Before any procedure starts (§6.8)")).not.toBeInTheDocument();
  });

  it("the variant control sits in its code line, which stacks it on its own row below sm (no 8.5rem cap)", () => {
    render(<ProceduralBlocksSimulator scenario="time0-reset" scenarios={["time0-reset"]} />);
    const form = screen.getByRole("radiogroup", { name: "How the bench applies reset" });
    expect(form.className).not.toMatch(/max-w-\[8\.5rem\]/);
    expect(form.closest("figure")?.className).toMatch(/max-sm:\[&_li:has\(\[role=radiogroup\]\)\]:flex-wrap/);
    expect(form.closest("figure")?.className).toMatch(/max-sm:\[&_li>span:has\(>\[role=radiogroup\]\)\]:basis-full/);
  });
});
