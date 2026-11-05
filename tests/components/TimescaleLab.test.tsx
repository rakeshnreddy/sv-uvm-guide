import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TimescaleLab, { TIMESCALE_ASSUMPTIONS } from "@/components/visuals/TimescaleLab";
import {
  CROSS_SCOPE_DEFAULT,
  READ_TIME_PRESETS,
  ROUNDING_PRESETS,
  TB_TOP_SCOPE,
  U_SLOW_SCOPE,
  formatScale,
  globalPrecisionDesign,
  gradeCrossScopeSuspects,
  readTimeOptions,
  roundDelayText,
  roundingOptions,
  runReadTime,
  timeunitLine,
} from "@/lib/sv-timescale-model";

/** Picks an option and locks in the prediction of the prompt that owns it (a page may hold several prompts). */
const lockIn = (optionText: RegExp | string) => {
  const radio = screen.getByLabelText(optionText);
  fireEvent.click(radio);
  const prompt = radio.closest("fieldset")?.parentElement as HTMLElement;
  fireEvent.click(within(prompt).getByRole("button", { name: /lock in prediction/i }));
};
/** The verdict also goes to the lab's screen-reader live region; these look at what is on screen. */
const onScreen = { ignore: 'script, style, [role="status"]' };
const shown = (text: RegExp) => screen.getByText(text, onScreen);
const allShown = (text: RegExp) => screen.getAllByText(text, onScreen);
const whyHolds = () => shown(/Why the answer holds/).closest("p") as HTMLElement;
const skip = () => fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
const revealEveryMoment = () => fireEvent.click(screen.getByRole("button", { name: "Reveal every moment" }));
const delayInput = () => screen.getByLabelText(/^Delay \(/);
/** Locks in an option of the prompt whose question matches: with bare labels two prompts can offer the same value. */
const lockInWithin = (question: RegExp, optionText: RegExp) => {
  const fieldset = screen.getByRole("group", { name: question });
  fireEvent.click(within(fieldset).getByLabelText(optionText));
  fireEvent.click(within(fieldset.parentElement as HTMLElement).getByRole("button", { name: /lock in prediction/i }));
};
const openAdvanced = () => {
  const button = screen.queryByRole("button", { name: /^Show advanced/ });
  if (button) fireEvent.click(button);
};
const chooseTimeformat = (name: RegExp) => {
  openAdvanced();
  fireEvent.click(within(screen.getByRole("radiogroup", { name: "$timeformat before the code runs" })).getByRole("radio", { name }));
};
/** cross-scope, wait_t(5ns): the trace and the fixes wait for the hunt. */
const skipHunt = () => fireEvent.click(screen.getByRole("button", { name: /Skip the hunt/ }));

describe("TimescaleLab · rounding", () => {
  it("hides the wake time until the learner commits, then shows the ruler and the §3.14.1 steps", () => {
    render(<TimescaleLab />);
    expect(screen.getByRole("region", { name: "Timescale lab: rounding a delay" })).toBeInTheDocument();
    expect(screen.queryByTestId("rounding-reveal")).not.toBeInTheDocument();
    lockIn(/^2\.8 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("rounding-reveal")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /snaps to 2\.8 ns/ })).toBeInTheDocument();
    expect(shown(/exactly half way between 27 and 28/)).toBeInTheDocument();
  });

  it("diagnoses the 'no rounding' misconception", () => {
    render(<TimescaleLab mode="rounding" />);
    lockIn(/^2\.75 ns$/);
    expect(shown(/Not quite/)).toBeInTheDocument();
    expect(shown(/Delays are rounded to the element's precision before they are used/)).toBeInTheDocument();
  });

  it("presets: #1.55 at 1ns/100ps is 1.6 ns; #2.85 is tool-dependent and shows both values", () => {
    render(<TimescaleLab mode="rounding" preset="spine-1.55" />);
    lockIn(/^1\.6 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "tie-2.85" } });
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/2\.8 ns or 2\.9 ns \(tool-dependent\)/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("Tool-dependent")).toBeInTheDocument();
    expect(allShown(/states no tie rule/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /exactly half way between two ticks and snaps to 2\.8 ns or 2\.9 ns \(tool-dependent\)/ })).toBeInTheDocument();
  });

  it("rejects a precision coarser than the unit with the §3.14 rule, and re-arms when the input changes", () => {
    render(<TimescaleLab mode="rounding" />);
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "10ns" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/coarser than the unit.*§3\.14/);
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "100ps" } });
    fireEvent.change(delayInput(), { target: { value: "#(1'bx)" } });
    lockIn(/^0 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(allShown(/interpreted as zero delay \(§9\.4\.1\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /interpreted as zero, so the statement wakes at 0 ns/ })).toBeInTheDocument();
  });

  it("a time literal in a 1 ps module waits 5000 ps (§5.8)", () => {
    render(<TimescaleLab mode="rounding" preset="table-5ns" />);
    lockIn(/^5000 ps$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(shown(/converted to a real number in the current time unit/)).toBeInTheDocument();
  });
});

describe("TimescaleLab · rounding, a real choice", () => {
  it("a whole-number delay with unit = precision still offers at least three options", () => {
    render(<TimescaleLab mode="rounding" />);
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "1ns" } });
    fireEvent.change(delayInput(), { target: { value: "#3" } });
    expect(screen.getAllByRole("radio").length).toBeGreaterThanOrEqual(3);
    lockIn(/^4 ns$/);
    expect(shown(/not a step added to it/)).toBeInTheDocument();
    expect(whyHolds()).toHaveTextContent("§3.14.1");
  });

  it("the correct answer is not always the first option", () => {
    const firstIsCorrect = ["table-2.75", "table-5ns", "spine-1.55", "literal-2.1ns", "xz"].map((preset) => {
      const { unmount } = render(<TimescaleLab mode="rounding" preset={preset} />);
      const first = screen.getAllByRole("radio")[0];
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
      const correct = screen.queryAllByText(/Correct\./, onScreen).length > 0;
      unmount();
      return correct;
    });
    expect(firstIsCorrect).toContain(false);
  });
});

describe("TimescaleLab · two modules", () => {
  it("reveals the axis markers only after both predictions, with 1.3 ns, 13 ns and 26 ns", () => {
    render(<TimescaleLab mode="two-modules" />);
    expect(screen.getByRole("img", { name: /markers appear after both predictions/ })).toBeInTheDocument();
    lockIn(/^1\.3 ns$/);
    expect(screen.getByRole("img", { name: /markers appear after both predictions/ })).toBeInTheDocument();
    lockIn(/^13 ns, then 26 ns$/);
    expect(allShown(/Correct\./)).toHaveLength(2);
    expect(screen.getByRole("img", { name: /tb_top \(1ns\/100ps\) wakes at 1\.3 ns; u_slow \(10ns\/1ns\) wakes at 13 ns, then 26 ns/ })).toBeInTheDocument();
    expect(shown(/global precision is/)).toHaveTextContent("100 ps");
  });

  it("offers tb_top's result as a distractor for u_slow and explains the unit without naming the other module", () => {
    render(<TimescaleLab mode="two-modules" />);
    lockIn(/^1\.3 ns$/);
    lockIn(/^1\.3 ns, then 2\.6 ns$/);
    const feedback = shown(/The other module's settings play no part here/);
    expect(feedback).toHaveTextContent("Only this module's own unit and precision decide its wake time");
    expect(feedback).not.toHaveTextContent(/tb_top|becomes in/);
  });

  it("re-runs the model when the delay changes", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#2.5" } });
    fireEvent.change(screen.getByLabelText("u_slow runs it"), { target: { value: "1" } });
    lockInWithin(/tb_top \(/, /^2\.5 ns$/);
    lockInWithin(/u_slow \(/, /^25 ns$/);
    expect(allShown(/Correct\./)).toHaveLength(2);
  });

  it("rescales the axis so a large delay still shows both modules", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#60" } });
    expect(screen.getByRole("img", { name: /its scale and the wake markers appear after both predictions/ })).toBeInTheDocument();
    lockIn(/^60 ns$/);
    lockIn(/^600 ns, then 1200 ns$/);
    const axis = screen.getByRole("img", { name: /^Time axis 0 to 2 us\. tb_top \(1ns\/100ps\) wakes at 60 ns; u_slow \(10ns\/1ns\) wakes at 600 ns, then 1\.2 us/ });
    expect(axis.querySelectorAll("circle")).toHaveLength(1);
    expect(axis.querySelectorAll("path")).toHaveLength(2);
    expect(axis).toHaveTextContent("simulation time (us)");
  });

  it("keeps the markers on the axis for a negative delay (64-bit unsigned, §9.4.1)", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#(-1)" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const axis = screen.getByRole("img", { name: /tb_top \(1ns\/100ps\) wakes at/ });
    expect(axis.querySelectorAll("circle")).toHaveLength(1);
    // A second copy would pass 64 bits of time, for which the sources give no rule: only the first wake is drawn.
    expect(axis.querySelectorAll("path")).toHaveLength(1);
    expect(shown(/Only the wakes below 2\^64 time units are shown/)).toBeInTheDocument();
    for (const marker of Array.from(axis.querySelectorAll("circle"))) {
      expect(Number(marker.getAttribute("cx"))).toBeLessThanOrEqual(360);
    }
  });
});

describe("TimescaleLab · read-time", () => {
  const log = () => screen.getByLabelText("Printed log");

  it("§20.3.1 preset: each print has its own prediction, of the line as the code prints it", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Moment" });
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 1 of 2: test prints after its 1st delay, not yet predicted");
    expect(log()).toHaveTextContent("predict moment 1 to reveal this line");

    lockIn(/^\$time=2 \$realtime=1\.6 %t=.*then 16$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("read-time-reveal")).getByRole("img", { name: /Absolute time 16 ns; in 10ns units that is 1\.6; \$time rounds it to 2/ })).toBeInTheDocument();
    expect(log()).toHaveTextContent("$time=2 $realtime=1.6");
    expect(log()).toHaveTextContent("predict moment 2 to reveal this line");

    // Scrubbing on re-arms the prediction: the answer stays hidden until this moment is committed too.
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 2 of 2: test prints after its 2nd delay, not yet predicted");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/^\$time=3 \$realtime=3\.2 %t=.*then 32$/);
    expect(within(screen.getByTestId("read-time-reveal")).getByRole("img", { name: /Absolute time 32 ns.*\$time rounds it to 3/ })).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 2 of 2: test prints after its 2nd delay, at 32 ns");

    // Going back keeps the first answer instead of asking again.
    fireEvent.click(screen.getByRole("button", { name: "Previous moment" }));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(shown(/Correct\./)).toBeInTheDocument();
  });

  it("diagnoses counting in precision steps", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=16 \$realtime=16\.0 /);
    expect(shown(/That counts in 1ns precision steps/)).toBeInTheDocument();
  });

  it("make-it-work preset asks about u_slow's own line, where $realtime is 1.3 but %t prints 13.0 ns", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    skip(); // tb_top's moment
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    const prompt = screen.getByRole("group", { name: /u_slow .*after its 1st delay/ });
    expect(within(prompt.querySelector("legend") as HTMLElement).getByText("#1.26")).toBeInTheDocument();
    lockIn(/^slow_gen \$time=1 \$realtime=1\.30 %t=13\.0 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(log()).toHaveTextContent("slow_gen $time=1 $realtime=1.30 %t=13.0 ns");
    expect(log()).toHaveTextContent("predict moment 3 to reveal this line");
    expect(log()).not.toHaveTextContent("slow_gen $time=3");
  });

  it("make-it-work preset prints the lesson's three lines and shows %t of $time losing the fraction", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    revealEveryMoment();
    expect(log()).toHaveTextContent("tb_top $time=1 $realtime=1.30 %t=1.3 ns");
    expect(log()).toHaveTextContent("slow_gen $time=1 $realtime=1.30 %t=13.0 ns");
    expect(log()).toHaveTextContent("slow_gen $time=3 $realtime=2.60 %t=26.0 ns");
    const rows = screen.getAllByRole("row");
    expect(rows[3]).toHaveTextContent("30.0 ns");
    expect(rows[3]).toHaveTextContent("26.0 ns");
    expect(screen.queryByRole("button", { name: "Reveal every moment" })).not.toBeInTheDocument();
  });

  it("toggling the %t argument after the reveal rewrites the code, the moment and the log", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=2 \$realtime=1\.6 %t=.*then 16$/);
    const printed = () => screen.getByTestId("moment-prints");
    const code = () => screen.getByRole("list", { name: "The code this run executes" });
    expect(printed()).toHaveTextContent(/%t=.*padded with 18 spaces, then 16/);
    expect(code()).toHaveTextContent('%%t=%t", $time, $realtime, $realtime);');
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
    expect(printed()).toHaveTextContent(/%t=.*padded with 18 spaces, then 20/);
    expect(log()).toHaveTextContent("%t= 20");
    expect(code()).toHaveTextContent('%%t=%t", $time, $realtime, $time);');
    expect(shown(/Correct\./)).toBeInTheDocument();
  });

  it("UVM stamp: '@ 15000' without $timeformat, '@ 15.000 ns' once it is called", () => {
    render(<TimescaleLab mode="read-time" preset="uvm-stamp" />);
    revealEveryMoment();
    expect(log()).toHaveTextContent("@ 15000:");
    chooseTimeformat(/called with/);
    expect(log()).not.toHaveTextContent("@ 15");
    revealEveryMoment();
    expect(log()).toHaveTextContent("@ 15.000 ns:");
  });

  it("f2d-printing-time reproduces the five F2D lines", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    revealEveryMoment();
    expect(log()).toHaveTextContent("a: 10");
    expect(log()).toHaveTextContent("b: [ 10000]");
    expect(log()).toHaveTextContent("c: [10000]");
    expect(log()).toHaveTextContent("d: [ 10 ns]");
    expect(log()).toHaveTextContent("e: 12 12.4");
  });

  it("a custom caller under timeunit only shows tool-dependent %t until $timeformat is called", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
    openAdvanced();
    expect(screen.queryByText(/Default units here:/, onScreen)).not.toBeInTheDocument();
    revealEveryMoment();
    expect(shown(/Default units here:/)).toHaveTextContent("tool-dependent");
    expect(log()).toHaveTextContent("⟨tool-dependent⟩");
    chooseTimeformat(/called with/);
    revealEveryMoment();
    expect(log()).toHaveTextContent("%t=16.000 ns");
  });

  it("$timeformat is a plain choice: the four arguments appear under 'called with…' and changing one re-arms the prediction", () => {
    render(<TimescaleLab mode="read-time" />);
    openAdvanced();
    const group = screen.getByRole("radiogroup", { name: "$timeformat before the code runs" });
    expect(within(group).getByRole("radio", { name: /not called \(Table 20-3 defaults\)/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByLabelText("units_number")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /not called/ })).not.toBeInTheDocument();
    chooseTimeformat(/called with/);
    for (const field of ["units_number", "precision_number", "suffix_string", "minimum_field_width"]) {
      expect(screen.getByLabelText(field)).toBeInTheDocument();
    }
    revealEveryMoment();
    expect(log()).toHaveTextContent("%t=16.000 ns");
    fireEvent.change(screen.getByLabelText("units_number"), { target: { value: "-12" } });
    fireEvent.change(screen.getByLabelText("suffix_string"), { target: { value: " ps" } });
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    revealEveryMoment();
    expect(log()).toHaveTextContent("%t=16000.000 ps");
  });

  it("a custom caller whose unit, precision and %t units coincide still gets a real prediction", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Caller's time unit"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "#3" } });
    expect(screen.getAllByRole("radio", { name: /\$time=/ }).length).toBeGreaterThanOrEqual(2);
    lockIn(/^\$time=3 \$stime=3 \$realtime=3\.000 %t=⟨tool-dependent⟩$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
  });
});

describe("TimescaleLab · which-unit", () => {
  const move = (direction: "up" | "down", file: string) => fireEvent.click(screen.getByRole("button", { name: `Move ${direction}: ${file}` }));

  it("in one compilation unit b takes 1ns from a.sv's `timescale (rule b); moving b above a leaves it on the default and reports the mixed specification", () => {
    render(<TimescaleLab mode="which-unit" />);
    lockIn(/1ns, from a\.sv's `timescale/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(shown(/No mixed specification/)).toBeInTheDocument();
    move("up", "b.sv");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/The tool's default/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    const errors = screen.getByRole("list", { name: "Errors" });
    expect(errors).toHaveTextContent(/Mixed specification/);
    expect(errors).toHaveTextContent(/some tools only warn/);
    expect(screen.getAllByText("implementation-specific").length).toBeGreaterThan(0);
  });

  it("with each file its own compilation unit, the `timescale never reaches b (§3.12.1)", () => {
    render(<TimescaleLab mode="which-unit" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Compilation units" })).getByRole("radio", { name: "each file its own" }));
    lockIn(/1ns, from a\.sv's `timescale/);
    expect(shown(/Not quite/)).toBeInTheDocument();
    expect(shown(/In this order and grouping it does not reach b/)).toBeInTheDocument();
  });

  it("a compilation-unit timeunit is locked first and applies when b comes before a (rule c)", () => {
    render(<TimescaleLab mode="which-unit" />);
    fireEvent.click(screen.getByLabelText(/include a compilation-unit timeunit/));
    expect(screen.getAllByText("Fixed position")).toHaveLength(1);
    move("up", "b.sv");
    lockIn(/1us, from the compilation-unit timeunit/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("which-unit-reveal")).toHaveTextContent(/rule \(c\)/);
  });

  it("`resetall ends the directive (§22.3) and c's own timeunit never leaks", () => {
    render(<TimescaleLab mode="which-unit" />);
    fireEvent.click(screen.getByLabelText(/include a `resetall file/));
    lockIn(/100ps, from c\.sv's timeunit/);
    expect(shown(/never leaks into another design element/)).toBeInTheDocument();
    expect(whyHolds()).toHaveTextContent(/rule \(d\)/);
    expect(screen.getByTestId("which-unit-reveal")).toHaveTextContent(/module b.*implementation-specific/);
  });
});

describe("TimescaleLab · global-precision", () => {
  it("before the vendor model $root is 100ps / 100ps; after it everything becomes 1 fs while the module rounding is unchanged", () => {
    render(<TimescaleLab mode="global-precision" />);
    lockIn(/is 100ps \/ 100ps/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    lockIn(/^Tool-dependent/);
    expect(allShown(/Correct\./)).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/is 1fs \/ 1fs/);
    lockIn(/^1fs$/);
    expect(allShown(/Correct\./)).toHaveLength(2);
    const rows = screen.getAllByRole("row");
    const rowText = rows.map((r) => r.textContent ?? "");
    expect(rowText.find((t) => t.startsWith("$printtimescale"))).toMatch(/100ps \/ 100ps.*1fs \/ 1fs.*changed/);
    expect(rowText.find((t) => t.startsWith("1step"))).toMatch(/100 ps1 fs.*changed/);
    expect(rowText.find((t) => t.startsWith("default %t units"))).toMatch(/Table 20-3 does not define it.*1fs.*changed/);
    expect(rowText.find((t) => t.includes("tb_top runs #1.26"))).toMatch(/1\.3 ns1\.3 nsunchanged/);
    expect(rowText.find((t) => t.includes("slow_gen runs #1.26"))).toMatch(/13 ns13 nsunchanged/);
  });

  it("diagnoses the '$root shows the vendor model's own setting' misconception", () => {
    render(<TimescaleLab mode="global-precision" />);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    lockIn(/is 1ns \/ 1fs/);
    expect(shown(/unit and precision are always identical \(§20\.4\.2\)/)).toBeInTheDocument();
  });
});

describe("TimescaleLab · cross-scope", () => {
  it("predicts 5 ps for wait_t(5ns), then steps the value across the boundary and watches the unit tag drop", () => {
    render(<TimescaleLab mode="cross-scope" />);
    expect(screen.queryByTestId("cross-scope-reveal")).not.toBeInTheDocument();
    lockIn(/^5 ps$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    skipHunt();
    const chip = screen.getByTestId("crossing-chip");
    expect(chip).toHaveAttribute("data-lane", "caller");
    expect(chip).toHaveTextContent("5.01ns");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(chip).toHaveAttribute("data-lane", "boundary");
    expect(chip).toHaveTextContent("1ns not passed on");
    expect(chip.querySelector(".line-through")?.textContent).toBe("1ns");
    expect(shown(/Only the number is passed: 5\.0 meant 5ns because tb_top reads numbers in its 1ns unit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("#t;");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("expected 5 ns, woke at 0.005 ns")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Crossing step" })).toHaveAttribute("aria-valuetext", "Step 4 of 4: Wake");
  });

  it("wait_t(1.5ns) rounds the real to 2 (§6.12.1); wait_ns(5) and the cycle count land on 5 ns", () => {
    render(<TimescaleLab mode="cross-scope" />);
    const forms = screen.getByRole("radiogroup", { name: "Call form" });
    fireEvent.click(within(forms).getByRole("radio", { name: "util_pkg::wait_t(1.5ns);" }));
    lockIn(/^2 ps$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("expected 1.5 ns, woke at 0.002 ns")).toBeInTheDocument();
    fireEvent.click(within(forms).getByRole("radio", { name: "util_pkg::wait_ns(5);" }));
    lockIn(/^5 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText("expected 5 ns, woke at 5.000 ns")).toBeInTheDocument();
    fireEvent.click(within(forms).getByRole("radio", { name: "repeat (5) @(posedge clk);" }));
    lockIn(/^5 ns$/);
    expect(shown(/The repeat line counts edges and has no unit \(§9\.4\.2\)/)).toBeInTheDocument();
  });

  it("grades suspects: #t is the culprit, $timeformat is a decoy; grades fixes by recomputation; three hints", () => {
    render(<TimescaleLab mode="cross-scope" />);
    expect(screen.queryAllByRole("button", { name: /^Suspect line:/ })).toHaveLength(0);
    skip();
    // Three hints fade while the hunt is on.
    fireEvent.click(screen.getByRole("button", { name: /Need a hint\?/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    expect(screen.getAllByRole("listitem").filter((li) => /§5\.8|package boundary|§3\.14/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("button", { name: /Another hint/ })).not.toBeInTheDocument();
    // Code order: #t (util_pkg), then tb_top's timeunit, $timeformat and the call.
    const suspectButtons = screen.getAllByRole("button", { name: /^Suspect line:/ });
    expect(suspectButtons).toHaveLength(4);
    fireEvent.click(suspectButtons[2]); // $timeformat line
    expect(allShown(/A decoy\./).length).toBeGreaterThan(0);
    expect(shown(/still wakes at 5 ps/)).toBeInTheDocument();
    fireEvent.click(suspectButtons[1]); // tb_top's timeunit line
    expect(allShown(/A decoy\./).length).toBeGreaterThan(0);
    expect(shown(/the bench's legitimate choice/)).toBeInTheDocument();
    fireEvent.click(suspectButtons[3]); // the call
    expect(shown(/Close\./)).toBeInTheDocument();
    fireEvent.click(suspectButtons[0]); // #t line
    expect(shown(/Found it\./)).toBeInTheDocument();
    expect(shown(/wakes at 5 ns instead of 5 ps/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Give util_pkg the bench's unit/ }));
    expect(shown(/Fragile:/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Wake time by caller unit" })).toHaveTextContent("5 us");
    fireEvent.click(screen.getByRole("button", { name: /Scale inside the package/ }));
    expect(shown(/Robust:/)).toBeInTheDocument();
  });

  it("names each suspect button after its code line, with a 40 px target and the verdict as its description", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    expect(screen.getByRole("button", { name: "Suspect line: #t;" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspect line: timeunit 1ns; timeprecision 1ps;" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Suspect line: \$timeformat\(-9, 3, " ns", 0\);/ })).toBeInTheDocument();
    const call = screen.getByRole("button", { name: /^Suspect line: util_pkg::wait_t\(5ns\);/ });
    expect(call.className).toContain("min-h-10");
    expect(call).not.toHaveAttribute("aria-describedby");
    fireEvent.click(call);
    expect(call).toHaveAttribute("aria-pressed", "true");
    expect(document.getElementById(call.getAttribute("aria-describedby") as string)).toBe(screen.getByTestId("suspect-verdict"));
  });

  it("writes the verdicts into one live region that exists before the first choice", () => {
    render(<TimescaleLab mode="cross-scope" />);
    const live = screen.getByTestId("lab-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    lockIn(/^5 ps$/);
    expect(screen.getByTestId("lab-live")).toBe(live);
    expect(live).toHaveTextContent(/^Correct\./);
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: \$timeformat/ }));
    expect(screen.getByTestId("lab-live")).toBe(live);
    expect(live).toHaveTextContent(/^A decoy\./);
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    expect(live).toHaveTextContent(/^Found it\./);
    fireEvent.click(screen.getByRole("button", { name: /Scale inside the package/ }));
    expect(live).toHaveTextContent(/^Robust:/);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(live).toHaveTextContent(/^Step 2 of 4/);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name: "util_pkg::wait_ns(5);" }));
    expect(screen.getByTestId("lab-live")).toBe(live);
    expect(live).toBeEmptyDOMElement();
  });
});

describe("TimescaleLab · persistent live region", () => {
  const cases: { mode: "rounding" | "two-modules" | "read-time" | "which-unit" | "global-precision"; pick: RegExp; says: RegExp }[] = [
    { mode: "rounding", pick: /^2\.8 ns$/, says: /^Correct\./ },
    { mode: "two-modules", pick: /^1\.3 ns$/, says: /^Correct\./ },
    { mode: "read-time", pick: /^\$time=2 \$realtime=1\.6 %t=.*then 16$/, says: /^Correct\..*Prints \$time=2/ },
    { mode: "which-unit", pick: /1ns, from a\.sv's `timescale/, says: /^Correct\./ },
    { mode: "global-precision", pick: /is 100ps \/ 100ps/, says: /^Correct\./ },
  ];
  for (const { mode, pick, says } of cases) {
    it(`${mode}: the region is mounted and empty before the prediction, and carries the verdict after it`, () => {
      render(<TimescaleLab mode={mode} />);
      const live = screen.getByTestId("lab-live");
      expect(live).toBeEmptyDOMElement();
      lockIn(pick);
      expect(screen.getByTestId("lab-live")).toBe(live);
      expect(live).toHaveTextContent(says);
    });
  }

  it("announces a skipped prediction and clears the region when the prompt re-arms", () => {
    render(<TimescaleLab mode="rounding" />);
    const live = screen.getByTestId("lab-live");
    skip();
    expect(live).toHaveTextContent(/^Revealed\./);
    fireEvent.change(delayInput(), { target: { value: "#3" } });
    expect(live).toBeEmptyDOMElement();
  });

  it("a wrong answer announces both the diagnosis and why the answer holds", () => {
    render(<TimescaleLab mode="rounding" />);
    lockIn(/^2\.75 ns$/);
    expect(screen.getByTestId("lab-live")).toHaveTextContent(/^Not quite\..*Why the answer holds:/);
  });
});

/** Everything a learner can read or hear, apart from the radio options themselves: dropdown labels stay in, because they leak too. */
const outsideOptions = (container: HTMLElement): string => {
  const copy = container.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('label:has(input[type="radio"])').forEach((label) => label.remove());
  const attributes = Array.from(copy.querySelectorAll("[aria-label], [aria-valuetext]")).flatMap((el) => [el.getAttribute("aria-label") ?? "", el.getAttribute("aria-valuetext") ?? ""]);
  return [copy.textContent ?? "", ...attributes].join("\n");
};
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-value match: "0 ns" is not found inside "10 ns". */
const mentions = (haystack: string, value: string) => new RegExp(`(?<![\\d.])${escapeRe(value)}`).test(haystack);
const expectAbsent = (container: HTMLElement, values: string[]) => {
  const text = outsideOptions(container);
  for (const value of values) expect(mentions(text, value), `"${value}" is on screen before the commit:\n${text}`).toBe(false);
};
const lockFirst = () => {
  // The prompt's own radio inputs: the segmented controls on the page are radios too.
  fireEvent.click(document.querySelector('fieldset input[type="radio"]') as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};

describe("TimescaleLab · nothing outside the options reveals the answer before the commit", () => {
  for (const p of ROUNDING_PRESETS) {
    it(`rounding, ${p.id}`, () => {
      const { container } = render(<TimescaleLab mode="rounding" preset={p.id} />);
      const correct = roundingOptions(roundDelayText(p.delay, p.unit, p.precision)).find((o) => o.correct)?.label as string;
      expectAbsent(container, [correct, p.note]);
      expect(screen.getByText(p.source)).toBeInTheDocument();
      skip();
      expect(screen.getByTestId("rounding-note")).toHaveTextContent(p.note);
    });
  }

  it("rounding: no preset label names its outcome", () => {
    const { container } = render(<TimescaleLab mode="rounding" />);
    const labels = Array.from(container.querySelectorAll("option")).map((o) => o.textContent ?? "");
    expect(labels.join("\n")).not.toMatch(/same slot|tool-dependent/);
  });

  it("two-modules", () => {
    const { container } = render(<TimescaleLab mode="two-modules" />);
    expectAbsent(container, ["1.3 ns", "13 ns", "26 ns"]);
  });

  for (const p of READ_TIME_PRESETS) {
    it(`read-time, ${p.id}`, () => {
      const { container } = render(<TimescaleLab mode="read-time" preset={p.id} />);
      const trace = runReadTime(p.callers, p.build, null);
      const firstMomentAnswer = readTimeOptions(trace.snapshots[0], p.build).find((o) => o.correct)?.label as string;
      expectAbsent(container, [firstMomentAnswer, p.outcome, ...trace.lines.map((l) => l.text)]);
      revealEveryMoment();
      expect(screen.getByTestId("preset-outcome")).toHaveTextContent(p.outcome);
    });
  }

  it("read-time, §20.3.1: the summary gives the setup and neither moment", () => {
    const { container } = render(<TimescaleLab mode="read-time" />);
    expectAbsent(container, ["16 ns", "32 ns", "2 then 3"]);
    expect(shown(/two delays of 1\.55/)).toBeInTheDocument();
  });

  it("read-time, the outcome waits for the last moment, not the first", () => {
    render(<TimescaleLab mode="read-time" />);
    skip();
    expect(screen.queryByTestId("preset-outcome")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    skip();
    expect(screen.getByTestId("preset-outcome")).toHaveTextContent("$time reports 2 then 3");
  });

  it("read-time, UVM: the stamp's value is not in the preset's label or summary", () => {
    const { container } = render(<TimescaleLab mode="read-time" preset="uvm-stamp" />);
    expectAbsent(container, ["15000"]);
    expect(screen.getByRole("option", { name: "UVM: the log time stamp" })).toBeInTheDocument();
  });

  it("which-unit", () => {
    const { container } = render(<TimescaleLab mode="which-unit" />);
    expectAbsent(container, ["1ns, from a.sv", "Global precision (§3.14.3)", "rule (b)"]);
  });

  const crossForms: { name: string; values: string[] }[] = [
    // "1000" too: a title or summary that speaks of a factor of 1000 rules out 5 ns and the compile error before the commit.
    { name: "util_pkg::wait_t(5ns);", values: ["5 ps", "woke at 0.005 ns", "1000"] },
    { name: "util_pkg::wait_t(1.5ns);", values: ["2 ps", "woke at 0.002 ns", "1000"] },
    // Here the answer equals the intent, which the lesson's $display states; the result itself stays hidden.
    { name: "util_pkg::wait_ns(5);", values: ["5000 ps", "woke at 5.000 ns", "1000"] },
    { name: "repeat (5) @(posedge clk);", values: ["woke at 5.000 ns", "1000"] },
  ];
  for (const { name, values } of crossForms) {
    it(`cross-scope, ${name}`, () => {
      const { container } = render(<TimescaleLab mode="cross-scope" />);
      fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name }));
      expectAbsent(container, values);
    });
  }
});

describe("TimescaleLab · global-precision keeps the vendor column for its own prediction", () => {
  it("the first prompt reveals only the column without the vendor model", () => {
    const { container } = render(<TimescaleLab mode="global-precision" />);
    expectAbsent(container, ["1fs / 1fs"]);
    lockIn(/is 100ps \/ 100ps/);
    expectAbsent(container, ["1fs / 1fs"]);
    expect(screen.queryByTestId("global-precision-reveal")).not.toBeInTheDocument();
    lockIn(/^Tool-dependent/);
    expectAbsent(container, ["1fs / 1fs"]);
    const table = within(screen.getByTestId("global-precision-reveal"));
    expect(table.getByRole("columnheader", { name: "Without vendor model" })).toBeInTheDocument();
    expect(table.queryByRole("columnheader", { name: /With `timescale/ })).not.toBeInTheDocument();
    expect(table.queryByRole("columnheader", { name: "Changed?" })).not.toBeInTheDocument();
    expect(table.queryByText(/changed/)).not.toBeInTheDocument();
    expect(table.queryByText(/counts toward the global precision/)).not.toBeInTheDocument();
    expect(table.getAllByRole("row").find((r) => r.textContent?.startsWith("1step"))).toHaveTextContent("100 ps");
    expect(container.textContent).not.toContain("1 fs");
  });

  it("ticking the box hides the first table and asks the headline prediction with the answer still unseen", () => {
    const { container } = render(<TimescaleLab mode="global-precision" />);
    lockIn(/is 100ps \/ 100ps/);
    lockIn(/^Tool-dependent/);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    expect(screen.queryByTestId("global-precision-reveal")).not.toBeInTheDocument();
    expectAbsent(container, ["1fs / 1fs"]);
  });

  it("the comparison opens once both predictions are made, and toggling back does not hide it again", () => {
    render(<TimescaleLab mode="global-precision" />);
    const box = screen.getByLabelText(/Add vendor_model\.sv/);
    fireEvent.click(box);
    lockIn(/is 1fs \/ 1fs/);
    expect(screen.queryByRole("columnheader", { name: "Changed?" })).not.toBeInTheDocument();
    lockIn(/^1fs$/);
    expect(screen.getByRole("columnheader", { name: "Changed?" })).toBeInTheDocument();
    fireEvent.click(box);
    expect(screen.queryByTestId("global-precision-reveal")).not.toBeInTheDocument();
    lockIn(/is 100ps \/ 100ps/);
    lockIn(/^Tool-dependent/);
    expect(screen.getByRole("columnheader", { name: /With `timescale/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Changed?" })).toBeInTheDocument();
  });

  it("revealing without predicting opens the comparison too", () => {
    render(<TimescaleLab mode="global-precision" />);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    skip();
    skip();
    expect(screen.getByRole("columnheader", { name: "Changed?" })).toBeInTheDocument();
  });
});

describe("TimescaleLab · cross-scope code follows the call form", () => {
  const chooseForm = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name }));
  const currentLine = () => document.querySelector('[aria-current="step"]')?.textContent ?? "";
  const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  const code = () => screen.getByRole("list", { name: "util_pkg and tb_top" });

  it("wait_ns(5) shows the lesson's task before the prediction and executes its lines", () => {
    render(<TimescaleLab mode="cross-scope" />);
    chooseForm("util_pkg::wait_ns(5);");
    expect(code()).toHaveTextContent("task automatic wait_ns(realtime delay_ns);");
    expect(code()).toHaveTextContent("#(delay_ns * 1ns);");
    expect(code()).not.toHaveTextContent("wait_t");
    expect(code()).not.toHaveTextContent("#t;");
    skip();
    expect(currentLine()).toContain("util_pkg::wait_ns(5);");
    next();
    expect(currentLine()).toContain("task automatic wait_ns(realtime delay_ns);");
    next();
    expect(currentLine()).toContain("#(delay_ns * 1ns);");
    next();
    expect(currentLine()).toContain("expected 5 ns");
  });

  it("repeat (5) @(posedge clk) declares a 1 ns clock before the prediction and executes the tb_top lines", () => {
    render(<TimescaleLab mode="cross-scope" />);
    chooseForm("repeat (5) @(posedge clk);");
    expect(code()).toHaveTextContent("logic clk = 1;");
    expect(code()).toHaveTextContent("always #0.5ns clk = ~clk;");
    expect(code()).toHaveTextContent("period 1 ns");
    skip();
    expect(currentLine()).toContain("repeat (5) @(posedge clk);");
    next();
    expect(currentLine()).toContain("$display");
  });

  it("wait_t(5ns) and wait_t(1.5ns) execute the task's own lines, each with its own intent", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    expect(currentLine()).toContain("util_pkg::wait_t(5ns);");
    next();
    expect(currentLine()).toContain("task automatic wait_t(time t);");
    chooseForm("util_pkg::wait_t(1.5ns);");
    expect(code()).toHaveTextContent('$display("expected 1.5 ns, woke at %t", $realtime);');
    expect(code()).toHaveTextContent("// intent: wait 1.5 ns");
    skip();
    expect(currentLine()).toContain("util_pkg::wait_t(1.5ns);");
    next();
    next();
    expect(currentLine()).toContain("#t;");
    next();
    expect(currentLine()).toContain("expected 1.5 ns");
  });

  it("wait_t(1.5ns) tempts with 1.5 ns, its own intent, not with 5 ns", () => {
    render(<TimescaleLab mode="cross-scope" />);
    chooseForm("util_pkg::wait_t(1.5ns);");
    expect(screen.queryByLabelText(/^5 ns$/)).not.toBeInTheDocument();
    lockIn(/^1\.5 ns$/);
    expect(shown(/That is the intent, not the result/)).toBeInTheDocument();
  });

  for (const form of ["util_pkg::wait_t(1.5ns);", "util_pkg::wait_ns(5);", "repeat (5) @(posedge clk);"]) {
    it(`offers no suspect buttons in ${form}, where no verdict could answer them`, () => {
      render(<TimescaleLab mode="cross-scope" />);
      chooseForm(form);
      skip();
      expect(screen.queryAllByRole("button", { name: /^Suspect line:/ })).toHaveLength(0);
    });
  }

  it("a suspect chosen in wait_t(5ns) comes back with its verdict after a visit to another form", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    chooseForm("util_pkg::wait_ns(5);");
    chooseForm("util_pkg::wait_t(5ns);");
    skip();
    const button = screen.getByRole("button", { name: "Suspect line: #t;" });
    expect(document.getElementById(button.getAttribute("aria-describedby") as string)).toBe(screen.getByTestId("suspect-verdict"));
  });
});

describe("TimescaleLab · bare option labels", () => {
  it("rounding and two-modules labels are values: the diagnosis waits in the feedback", () => {
    render(<TimescaleLab mode="rounding" />);
    expect(screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(expect.arrayContaining(["2.8 ns", "2.75 ns", "2.7 ns"]));
    for (const radio of screen.getAllByRole("radio")) expect(radio.closest("label")?.textContent).not.toContain(":");
  });
});

describe("TimescaleLab · focus moves to the reveal", () => {
  const heading = () => screen.getByTestId("reveal-heading");
  const modes = ["rounding", "read-time", "which-unit", "global-precision", "cross-scope"] as const;
  for (const mode of modes) {
    it(`${mode}: locking in moves the focus to the reveal heading`, () => {
      render(<TimescaleLab mode={mode} />);
      lockFirst();
      expect(document.activeElement).toBe(heading());
      expect(heading()).toHaveAttribute("tabindex", "-1");
    });
    it(`${mode}: revealing without predicting moves it too`, () => {
      render(<TimescaleLab mode={mode} />);
      skip();
      expect(document.activeElement).toBe(heading());
    });
  }

  it("two-modules: each prompt's reveal takes the focus in turn", () => {
    render(<TimescaleLab mode="two-modules" />);
    lockInWithin(/tb_top \(/, /^1\.3 ns$/);
    expect(document.activeElement).toHaveTextContent("tb_top's wake time");
    lockInWithin(/u_slow \(/, /^13 ns, then 26 ns$/);
    expect(document.activeElement).toHaveTextContent("u_slow's wake time");
  });

  it("read-time: 'Reveal every moment' moves the focus; scrubbing back to an answered moment does not", () => {
    render(<TimescaleLab mode="read-time" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(screen.getByRole("button", { name: "Previous moment" }));
    expect(document.activeElement).not.toBe(heading());
    revealEveryMoment();
    expect(document.activeElement).toBe(heading());
  });

  it("changing an input does not pull the focus away from it", () => {
    render(<TimescaleLab mode="rounding" />);
    const input = delayInput();
    input.focus();
    fireEvent.change(input, { target: { value: "#3" } });
    expect(document.activeElement).toBe(input);
  });
});

describe("TimescaleLab · prefers-reduced-motion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
  });
  const mock = (reduce: boolean) =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: reduce && query.includes("prefers-reduced-motion: reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });

  it("the crossing chip animates by default and moves without a transition under reduce", () => {
    mock(false);
    const first = render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    expect(screen.getByTestId("crossing-chip").className).toContain("transition-[left]");
    first.unmount();
    mock(true);
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const chip = screen.getByTestId("crossing-chip");
    expect(chip.className).not.toContain("transition");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(chip).toHaveAttribute("data-lane", "boundary");
    expect(chip.style.left).toBe("25%");
  });
});

describe("TimescaleLab · sideways scrolling and touch targets", () => {
  const openEverything: Record<string, () => void> = {
    rounding: skip,
    "two-modules": () => {
      skip2();
    },
    "read-time": revealEveryMoment,
    "which-unit": skip,
    "global-precision": () => {
      fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
      skip();
      skip();
    },
    "cross-scope": () => {
      skip();
      skipHunt();
      fireEvent.click(screen.getByRole("button", { name: /Scale inside the package/ }));
    },
  };
  function skip2() {
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
  }
  for (const mode of Object.keys(openEverything)) {
    it(`${mode}: every panel that scrolls is a focusable, named region`, () => {
      const { container } = render(<TimescaleLab mode={mode as "rounding"} />);
      openEverything[mode]();
      // CodeTrace's list wraps its lines, so it has nothing to scroll.
      const scrollers = Array.from(container.querySelectorAll('[class*="overflow-x-auto"]')).filter((el) => el.tagName !== "OL");
      expect(scrollers.length).toBeGreaterThan(0);
      for (const el of scrollers) {
        expect(el).toHaveAttribute("role", "region");
        expect(el).toHaveAttribute("tabindex", "0");
        expect(el.getAttribute("aria-label")).toBeTruthy();
      }
    });
  }

  it("the two text-style reveal buttons get a 40 px target on touch screens", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.getByRole("button", { name: "Reveal every moment" }).className).toContain("[@media(pointer:coarse)]:min-h-10");
    expect(screen.getByRole("button", { name: "Reveal without predicting" }).closest('[class*="pointer:coarse"]')?.className).toContain("[&_button]:min-h-10");
  });
});

describe("TimescaleLab · ruler labels stay inside the viewBox", () => {
  const WIDTH_PER_CHAR = 4.7;
  it("the 'now' label anchors away from the nearer edge at every moment of every preset", () => {
    // The $stime preset runs too long to draw as a ruler and says so instead.
    for (const p of READ_TIME_PRESETS.filter((x) => x.id !== "stime-wrap")) {
      const { unmount } = render(<TimescaleLab mode="read-time" preset={p.id} />);
      revealEveryMoment();
      const slider = screen.getByRole("slider", { name: "Moment" });
      for (let i = 0; i <= Number(slider.getAttribute("max")); i++) {
        fireEvent.change(slider, { target: { value: String(i) } });
        const label = screen.getByTestId("now-label");
        const x = Number(label.getAttribute("x"));
        const width = (label.textContent ?? "").length * WIDTH_PER_CHAR;
        if (label.getAttribute("text-anchor") === "end") expect(x - width, `${p.id} moment ${i}`).toBeGreaterThanOrEqual(0);
        else expect(x + width, `${p.id} moment ${i}`).toBeLessThanOrEqual(420);
      }
      unmount();
    }
  });

  it("F2D's last line, near the right edge, ends at the marker; a small value starts at it", () => {
    const { unmount } = render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    revealEveryMoment();
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "4" } });
    expect(screen.getByTestId("now-label")).toHaveAttribute("text-anchor", "end");
    unmount();
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    revealEveryMoment();
    expect(screen.getByTestId("now-label")).toHaveAttribute("text-anchor", "start");
  });

  it("two-modules: tb_top's labels never touch when it runs three times; the Wake times list keeps every value", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(screen.getByLabelText("tb_top runs it"), { target: { value: "3" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    const labels = screen.getAllByTestId("tb-top-label");
    expect(labels.map((l) => l.textContent)).toEqual(["1.3 ns"]);
    const axis = screen.getByRole("img", { name: /tb_top \(1ns\/100ps\) wakes at 1\.3 ns, then 2\.6 ns, then 3\.9 ns/ });
    expect(axis.querySelectorAll("circle")).toHaveLength(3);
    expect(screen.getByRole("list", { name: "Wake times" })).toHaveTextContent("1.3 ns, then 2.6 ns, then 3.9 ns");
  });

  it("two-modules: labels far enough apart are all kept", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
    expect(screen.getAllByTestId("u-slow-label").map((l) => l.textContent)).toEqual(["13 ns", "26 ns"]);
  });
});

describe("TimescaleLab · the question after a %t toggle, and the delay inputs", () => {
  it("an answered moment keeps asking about the statement the verdict refers to", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=2 \$realtime=1\.6 %t=.*then 16$/);
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent('$time, $realtime, $realtime);');
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent('$time, $realtime, $realtime);');
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.getByRole("group", { name: /\$time, \$realtime, \$time\);/ })).toBeInTheDocument();
  });

  it("the visible label names the delay input, including its hint", () => {
    render(<TimescaleLab mode="rounding" />);
    const input = screen.getByRole("textbox", { name: /Delay \(#d or a time literal\)/ });
    expect(input).not.toHaveAttribute("aria-label");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  const inputCases: { mode: "rounding" | "two-modules" | "read-time"; prepare?: () => void; field: () => HTMLElement }[] = [
    { mode: "rounding", field: delayInput },
    { mode: "two-modules", field: delayInput },
    {
      mode: "read-time",
      prepare: () => fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } }),
      field: () => screen.getByLabelText("Delay sequence"),
    },
  ];
  for (const { mode, prepare, field } of inputCases) {
    it(`${mode}: an unfinished delay is marked invalid, and only becomes an alert when the learner leaves the field`, () => {
      render(<TimescaleLab mode={mode} />);
      prepare?.();
      fireEvent.change(field(), { target: { value: "#2." } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const message = screen.getByTestId("input-error");
      expect(field()).toHaveAttribute("aria-invalid", "true");
      expect(field()).toHaveAttribute("aria-describedby", message.id);
      fireEvent.blur(field());
      expect(screen.getByRole("alert")).toHaveAttribute("id", field().getAttribute("aria-describedby"));
      fireEvent.change(field(), { target: { value: "#2.5" } });
      expect(field()).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
    });
  }

  it("the printed log is a named region, since a bare <pre> takes no name", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.getByRole("region", { name: "Printed log" }).tagName).toBe("PRE");
  });
});

describe("TimescaleLab · the value's unit at every step of every call form", () => {
  const forms: { name: string; steps: { state: string; chip: string; sentence: string }[] }[] = [
    {
      name: "util_pkg::wait_t(5ns);",
      steps: [
        { state: "tagged", chip: "1ns", sentence: "value 5.0 understood in 1ns" },
        { state: "dropped", chip: "not passed on", sentence: "value 5; tb_top's 1ns reading is not passed on" },
        { state: "tagged", chip: "1ps", sentence: "value 5 understood in 1ps" },
        { state: "resolved-time", chip: "wake time", sentence: "wake time 5 ps" },
      ],
    },
    {
      name: "util_pkg::wait_t(1.5ns);",
      steps: [
        { state: "tagged", chip: "1ns", sentence: "value 1.5 understood in 1ns" },
        { state: "dropped", chip: "not passed on", sentence: "value 2; tb_top's 1ns reading is not passed on" },
        { state: "tagged", chip: "1ps", sentence: "value 2 understood in 1ps" },
        { state: "resolved-time", chip: "wake time", sentence: "wake time 2 ps" },
      ],
    },
    {
      name: "util_pkg::wait_ns(5);",
      steps: [
        { state: "never-had", chip: "plain number", sentence: "plain number 5" },
        { state: "never-had", chip: "plain number", sentence: "plain number 5.0" },
        { state: "tagged", chip: "1ps", sentence: "value 5000 understood in 1ps" },
        { state: "resolved-time", chip: "wake time", sentence: "wake time 5 ns" },
      ],
    },
    {
      name: "repeat (5) @(posedge clk);",
      steps: [
        { state: "count", chip: "clock edges", sentence: "5 clock edges" },
        { state: "resolved-time", chip: "wake time", sentence: "wake time 5 ns" },
      ],
    },
  ];
  for (const { name, steps } of forms) {
    it(name, () => {
      render(<TimescaleLab mode="cross-scope" />);
      fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name }));
      skip();
      if (name === "util_pkg::wait_t(5ns);") skipHunt();
      steps.forEach((expected, i) => {
        if (i > 0) fireEvent.click(screen.getByRole("button", { name: "Next step" }));
        const chip = screen.getByTestId("crossing-chip");
        expect(chip, `step ${i + 1}`).toHaveAttribute("data-unit-state", expected.state);
        expect(chip, `step ${i + 1}`).toHaveTextContent(expected.chip);
        // Only the lost unit is struck through; the words that state the loss stay plain.
        expect(chip.querySelector(".line-through")?.textContent ?? null, `step ${i + 1} strike`).toBe(expected.state === "dropped" ? "1ns" : null);
        const heading = within(screen.getByTestId("crossing-step")).getByText(new RegExp(`^Step ${i + 1}:`));
        expect(heading.textContent, `step ${i + 1}`).toContain(`— ${expected.sentence}`);
        expect(heading.textContent, `step ${i + 1}`).not.toContain("with no unit");
        expect(screen.getByTestId("lane-state")).toHaveTextContent(expected.sentence);
        if (i > 0) expect(screen.getByTestId("lab-live")).toHaveTextContent(expected.sentence);
      });
    });
  }

  it("only the wait_t boundary says the unit was not passed on", () => {
    for (const { steps } of forms) {
      for (const step of steps) expect(step.chip === "not passed on").toBe(step.state === "dropped");
    }
    expect(forms.flatMap((f) => f.steps).filter((x) => x.state === "dropped")).toHaveLength(2);
  });

  it("the lane panel is not an empty tab stop: its region holds the state as text", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const region = screen.getByRole("region", { name: "The value moving through the scopes" });
    expect(within(region).getByTestId("lane-state")).toHaveTextContent("Now in tb_top (1ns): value 5.0 understood in 1ns.");
    expect(within(region).getByTestId("lane-state").closest("[aria-hidden]")).toBeNull();
  });
});

describe("TimescaleLab · the answer's slot moves with the state", () => {
  /** The slot of the option whose label matches, among the prompt's own radios. */
  const slotOf = (label: RegExp) => {
    const radios = Array.from(document.querySelectorAll<HTMLElement>('fieldset input[type="radio"]'));
    return radios.findIndex((r) => label.test(r.closest("label")?.textContent ?? ""));
  };
  const move = (file: string) => fireEvent.click(screen.getByRole("button", { name: `Move up: ${file}` }));

  it("which-unit: across compile orders and groupings the correct option does not sit in one slot", () => {
    const answer1ns = /1ns, from a\.sv/;
    const answerDefault = /tool's default/;
    const answer1us = /1us, from the compilation-unit/;
    const slots: number[] = [];
    const record = (setup: () => void, answer: RegExp) => {
      const { unmount } = render(<TimescaleLab mode="which-unit" />);
      setup();
      slots.push(slotOf(answer));
      lockIn(answer);
      expect(shown(/Correct\./)).toBeInTheDocument();
      unmount();
    };
    const group = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Compilation units" })).getByRole("radio", { name }));
    record(() => undefined, answer1ns);
    record(() => group("each file its own"), answerDefault);
    record(() => move("b.sv"), answerDefault);
    record(() => fireEvent.click(screen.getByLabelText(/include a `resetall file/)), answerDefault);
    record(() => {
      fireEvent.click(screen.getByLabelText(/include a compilation-unit timeunit/));
      move("b.sv");
    }, answer1us);
    record(() => move("pkg.sv"), answer1ns);
    expect(new Set(slots).size, `slots ${slots.join(",")}`).toBeGreaterThanOrEqual(3);
  });

  it("global-precision: the correct option moves when the vendor model is added", () => {
    render(<TimescaleLab mode="global-precision" />);
    const without = slotOf(/is 100ps \/ 100ps/);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    expect(slotOf(/is 1fs \/ 1fs/)).not.toBe(without);
  });

  it("cross-scope and read-time: the correct option is not always first", () => {
    const firsts: boolean[] = [];
    for (const name of ["util_pkg::wait_t(5ns);", "util_pkg::wait_t(1.5ns);", "util_pkg::wait_ns(5);", "repeat (5) @(posedge clk);"]) {
      const { unmount } = render(<TimescaleLab mode="cross-scope" />);
      fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name }));
      lockFirst();
      firsts.push(screen.queryAllByText(/Correct\./, onScreen).length > 0);
      unmount();
    }
    expect(firsts).toContain(false);
  });
});

describe("TimescaleLab · cross-scope: the hunt comes before the trace", () => {
  const code = () => screen.getByRole("list", { name: "util_pkg and tb_top" });

  it("the verdict sits with the suspect buttons, and the code panel holds no controls", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    expect(within(code()).queryAllByRole("button")).toHaveLength(0);
    const button = screen.getByRole("button", { name: "Suspect line: #t;" });
    fireEvent.click(button);
    const block = button.closest("ul")?.parentElement as HTMLElement;
    expect(within(block).getByTestId("suspect-verdict")).toBeInTheDocument();
    expect(button.closest("ul")?.nextElementSibling).toBe(screen.getByTestId("suspect-verdict"));
  });

  it("holds the trace, the line highlight and the fixes until the culprit is found, even after a wrong suspect", () => {
    render(<TimescaleLab mode="cross-scope" />);
    lockIn(/^5 ps$/);
    const held = () => {
      expect(screen.queryByTestId("crossing-chip")).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Fixes" })).not.toBeInTheDocument();
      expect(document.querySelector('[aria-current="step"]')).toBeNull();
    };
    held();
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: \$timeformat/ }));
    held();
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: util_pkg::wait_t/ }));
    held();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    expect(screen.getByTestId("crossing-chip")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fixes" })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).not.toBeNull();
  });

  it("nothing on screen names the mechanism before the hunt: the verdict stops at the symptom and the comment on #t waits", () => {
    for (const option of [/^5 ps$/, /^5 ns$/, /^5000 ns$/, /A compile error/]) {
      const { unmount } = render(<TimescaleLab mode="cross-scope" />);
      lockIn(option);
      const prompt = (document.querySelector("fieldset") as HTMLElement).parentElement as HTMLElement;
      const text = [prompt.textContent, screen.getByTestId("cross-scope-reveal").textContent, screen.getByTestId("lab-live").textContent, screen.getByRole("list", { name: "util_pkg and tb_top" }).textContent].join("\n");
      expect(text, String(option)).not.toMatch(/§3\.14|§5\.8|in util_pkg's|THIS package's|bare number/);
      unmount();
    }
  });

  it("the skip button opens the trace, restores the lesson's exact code, and moves the focus", () => {
    render(<TimescaleLab mode="cross-scope" />);
    expect(code()).not.toHaveTextContent("THIS package's time unit");
    skip();
    expect(code()).not.toHaveTextContent("THIS package's time unit");
    skipHunt();
    expect(code()).toHaveTextContent("waits t units of THIS package's time unit");
    expect(document.activeElement).toBe(screen.getByTestId("trace-heading"));
    expect(screen.queryByRole("button", { name: /Skip the hunt/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Need a hint/ })).not.toBeInTheDocument();
  });

  it("titles the blocks in words, not in a second numbering beside 'Step 4: Wake'", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent("The 1000× delay: find the line");
    skipHunt();
    expect(shown(/^Choose a fix\./)).toBeInTheDocument();
    expect(screen.getByTestId("cross-scope-reveal").textContent).not.toMatch(/Step 1 —|Step 2 —/);
  });
});

describe("TimescaleLab · read-time shows the code it runs and asks about each line", () => {
  const log = () => screen.getByLabelText("Printed log");
  const code = () => screen.getByRole("list", { name: "The code this run executes" });
  const currentLine = () => document.querySelector('[aria-current="step"]')?.textContent ?? "";
  const next = () => fireEvent.click(screen.getByRole("button", { name: "Next moment" }));

  it("every preset's code panel holds the $display of the current moment, highlighted, with the delay as context", () => {
    for (const p of READ_TIME_PRESETS) {
      const { unmount } = render(<TimescaleLab mode="read-time" preset={p.id} />);
      expect(code(), p.id).toHaveTextContent("initial begin");
      expect(currentLine(), p.id).toContain("$display(");
      unmount();
    }
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    expect(code()).toHaveTextContent("`timescale 1ns/1ps");
    expect(code()).toHaveTextContent('$timeformat(-9, 0, " ns", 8);');
    expect(code()).toHaveTextContent('$display("e: %0d %.1f", $time, $realtime);');
  });

  it("each preset's moments ask about the specifier its code uses, and 'Prints' is the log's own line", () => {
    const expected: Record<string, RegExp> = { "20.3.1": /%%t=%t/, "make-it-work": /%%t=%t/, "uvm-stamp": /@ %0t:/, "f2d-printing-time": /a: %0d/, "stime-wrap": /\$stime=%0d/ };
    for (const p of READ_TIME_PRESETS) {
      const { unmount } = render(<TimescaleLab mode="read-time" preset={p.id} />);
      expect(screen.getByRole("group", { name: expected[p.id] }), p.id).toBeInTheDocument();
      skip();
      const prints = screen.getByTestId("moment-prints").getAttribute("data-line") ?? "";
      expect(prints, p.id).not.toBe("");
      expect(log().textContent, p.id).toContain(prints);
      unmount();
    }
  });

  it("the $timeformat control is behind 'Show advanced' and pushes nothing above the question", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.queryByRole("radiogroup", { name: "$timeformat before the code runs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "%t argument" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /^Show advanced/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /^Hide advanced/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("radiogroup", { name: "$timeformat before the code runs" })).toBeInTheDocument();
    // The toggle sits below the moment table, after the prediction.
    const fieldset = document.querySelector("fieldset") as HTMLElement;
    expect(fieldset.compareDocumentPosition(screen.getByRole("radiogroup", { name: "%t argument" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("make-it-work offers no $timeformat control, because the code's own call at time 0 replaces it", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    expect(screen.queryByRole("button", { name: /Show advanced/ })).not.toBeInTheDocument();
    skip();
    expect(screen.getByTestId("read-time-reveal")).toBeInTheDocument();
  });

  it("F2D's control stays, because lines a to c print before the code's own call", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    expect(screen.getByRole("button", { name: /^Show advanced/ })).toBeInTheDocument();
  });

  it("a $timeformat set beforehand appears in the code", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(code()).not.toHaveTextContent("$timeformat");
    chooseTimeformat(/called with/);
    expect(code()).toHaveTextContent('$timeformat(-9, 3, " ns", 0);');
  });

  it("the %t toggle is not offered where no line uses %t", () => {
    render(<TimescaleLab mode="read-time" preset="stime-wrap" />);
    expect(screen.queryByRole("radiogroup", { name: "%t argument" })).not.toBeInTheDocument();
  });

  it("F2D: each of the five lines is its own moment, with a What and a Why, and only its own line appears", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    expect(screen.getByRole("slider", { name: "Moment" })).toHaveAttribute("max", "4");
    const explained = () => screen.getByTestId("moment-explanation");

    lockIn(/^a: 10$/);
    expect(log()).toHaveTextContent("a: 10");
    expect(log()).not.toHaveTextContent("b: [");
    expect(explained()).toHaveTextContent(/\$time is 10 in the caller's unit/);

    next();
    expect(currentLine()).toContain('"b: [%t]"');
    lockIn(/^b: \[.*padded with 15 spaces, then 10000\]$/);
    expect(log()).toHaveTextContent("b: [ 10000]");
    expect(log()).not.toHaveTextContent("c: [");
    expect(explained()).toHaveTextContent(/%t of \$time writes 10 ns in 1ps units with 0 decimals, no suffix, padded to at least 20 characters/);
    expect(explained()).toHaveTextContent(/No \$timeformat has run yet, so Table 20-3 applies/);

    next();
    lockIn(/^c: \[10000\]$/);
    expect(explained()).toHaveTextContent(/the 0 drops the padding/);

    next();
    expect(currentLine()).toContain('"d: [%t]"');
    lockIn(/^d: \[.*padded with 3 spaces, then 10 ns\]$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(log()).toHaveTextContent("d: [ 10 ns]");
    expect(explained()).toHaveTextContent(/%t of \$time writes 10 ns in 1ns units with 0 decimals, the suffix " ns", padded to at least 8 characters/);
    expect(explained()).toHaveTextContent(/The last \$timeformat call governs every %t/);

    next();
    lockIn(/^e: 12 12\.4$/);
    expect(explained()).toHaveTextContent(/\$time rounds 12\.4 to 12/);
    expect(explained()).toHaveTextContent(/\$realtime keeps the fraction: 12\.4/);
    expect(screen.getByTestId("preset-outcome")).toBeInTheDocument();
  });

  it("F2D's line d tempts with the unpadded text, the default width and the ignored call", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "3" } });
    lockIn(/^d: \[10 ns\]$/);
    expect(shown(/A plain %t pads to the minimum field width in force, 8/)).toBeInTheDocument();
  });

  it("stime-wrap: the lesson's Expert value, predicted with $stime in the options", () => {
    render(<TimescaleLab mode="read-time" preset="stime-wrap" />);
    expect(screen.getAllByRole("radio", { name: /\$stime=/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("radio", { name: /\$stime=5000000000$/ })).toBeInTheDocument();
    lockIn(/^\$time=5000000000 \$stime=705032704$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(log()).toHaveTextContent("$time=5000000000 $stime=705032704");
    expect(screen.getByTestId("moment-explanation")).toHaveTextContent(/the low 32 bits of 5000000000/);
    expect(screen.getByRole("region", { name: "Time readings of every moment" })).toHaveTextContent("705032704 (wrapped)");
  });

  it("the $stime misconception gets its own diagnosis", () => {
    render(<TimescaleLab mode="read-time" preset="stime-wrap" />);
    lockIn(/\$stime=5000000000$/);
    expect(shown(/A time that does not fit gives its low 32 bits/)).toBeInTheDocument();
  });

  it("an empty delay sequence says what to do; a coarse pair reports its error once; a half tick is a note, not an error", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "" } });
    expect(screen.getByTestId("empty-delays")).toHaveTextContent(/at least one delay/);
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "#1, #2, #3" } });
    expect(screen.queryByTestId("empty-delays")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "100ns" } });
    expect(within(screen.getByTestId("input-error")).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Caller's time unit"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "#2.5, #2.5" } });
    expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("run-notes")).not.toBeInTheDocument();
    skip();
    expect(within(screen.getByTestId("run-notes")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("run-notes").className).not.toContain("rose");
  });

  it("the log's time prefixes and its gate text use a colour that meets AA on the dark panel", () => {
    render(<TimescaleLab mode="read-time" />);
    skip();
    expect(log().innerHTML).not.toContain("text-slate-500");
    expect(log().innerHTML).toContain("text-slate-400");
  });
});

describe("TimescaleLab · touch targets and rendered text size", () => {
  const COARSE = "[@media(pointer:coarse)]:[&_button]:min-h-10";

  it("the segmented controls get the 40 px wrapper class", () => {
    render(<TimescaleLab mode="which-unit" />);
    expect(screen.getByRole("radiogroup", { name: "Compilation units" }).className).toContain(COARSE);
    expect(screen.getByLabelText(/include a `resetall file/).closest("label")?.className).toContain("[@media(pointer:coarse)]:min-h-10");
    expect(screen.getByLabelText(/include a compilation-unit timeunit/).closest("label")?.className).toContain("[@media(pointer:coarse)]:min-h-10");
  });

  it("cross-scope: the call form and the hint ladder too, and the scrubber grows on touch", () => {
    render(<TimescaleLab mode="cross-scope" />);
    expect(screen.getByRole("radiogroup", { name: "Call form" }).className).toContain(COARSE);
    skip();
    expect(screen.getByRole("button", { name: /Need a hint/ }).parentElement?.className).toContain(COARSE);
    skipHunt();
    expect(screen.getByRole("slider", { name: "Crossing step" }).className).toContain("[@media(pointer:coarse)]:h-10");
  });

  const svgOf = (name: RegExp) => screen.getByRole("img", { name });
  const expectReadable = (svg: HTMLElement) => {
    const width = Number(svg.getAttribute("viewBox")?.split(" ")[2]);
    const minW = Number(/min-w-\[(\d+)px\]/.exec(svg.getAttribute("class") ?? "")?.[1]);
    expect(minW).toBeGreaterThanOrEqual(width);
    for (const text of Array.from(svg.querySelectorAll("text"))) expect(Number(text.getAttribute("font-size"))).toBeGreaterThanOrEqual(9);
  };

  it("the three rulers never shrink below their viewBox, so every label renders at 9 px or more", () => {
    const rounding = render(<TimescaleLab mode="rounding" />);
    skip();
    expectReadable(svgOf(/Ruler of/));
    rounding.unmount();
    const modules = render(<TimescaleLab mode="two-modules" />);
    expectReadable(svgOf(/Time axis/));
    modules.unmount();
    render(<TimescaleLab mode="read-time" />);
    skip();
    expectReadable(svgOf(/Three rulers/));
  });

  it("the axis caption's descenders fit inside its viewBox", () => {
    render(<TimescaleLab mode="two-modules" />);
    const svg = svgOf(/Time axis/);
    const height = Number(svg.getAttribute("viewBox")?.split(" ")[3]);
    const lastY = Math.max(...Array.from(svg.querySelectorAll("text")).map((t) => Number(t.getAttribute("y"))));
    expect(height - lastY).toBeGreaterThanOrEqual(9 * 0.25);
  });
});

describe("TimescaleLab · two-modules wording", () => {
  const revealBoth = () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
  };

  it("x/z and negative delays have no 'then every' clause, and cite §9.4.1", () => {
    for (const delay of ["#(1'bx)", "#(-1)"]) {
      const { unmount, container } = render(<TimescaleLab mode="two-modules" />);
      fireEvent.change(delayInput(), { target: { value: delay } });
      revealBoth();
      expect(container.textContent, delay).not.toMatch(/then every/);
      expect(container.textContent, delay).toContain("§9.4.1");
      unmount();
    }
  });

  it("an ordinary delay keeps the clause", () => {
    render(<TimescaleLab mode="two-modules" />);
    revealBoth();
    expect(shown(/then every 13 ns more/)).toBeInTheDocument();
  });
});

describe("TimescaleLab · start over", () => {
  it("read-time: forgets the answers and returns to the first moment", () => {
    render(<TimescaleLab mode="read-time" />);
    revealEveryMoment();
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    const button = screen.getByRole("button", { name: "Start over" });
    fireEvent.click(button);
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Moment" })).toHaveValue("0");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start over" })).toBe(button);
  });

  it("which-unit: restores the default order and grouping and arms the prediction again", () => {
    render(<TimescaleLab mode="which-unit" />);
    fireEvent.click(screen.getByRole("button", { name: "Move up: b.sv" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Compilation units" })).getByRole("radio", { name: "each file its own" }));
    fireEvent.click(screen.getByLabelText(/include a `resetall file/));
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("which-unit-reveal")).not.toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Compilation units" })).getByRole("radio", { name: "one compilation unit" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText(/include a `resetall file/)).not.toBeChecked();
    lockIn(/1ns, from a\.sv's `timescale/);
    expect(shown(/Correct\./)).toBeInTheDocument();
  });

  it("which-unit: starting over from the default order still arms the prediction", () => {
    render(<TimescaleLab mode="which-unit" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("which-unit-reveal")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });

  it("cross-scope: clears the suspect, the fix and the trace", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    fireEvent.click(screen.getByRole("button", { name: /Scale inside the package/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("cross-scope-reveal")).not.toBeInTheDocument();
    skip();
    expect(screen.queryByTestId("suspect-verdict")).not.toBeInTheDocument();
    expect(screen.queryByTestId("crossing-chip")).not.toBeInTheDocument();
  });

  it("rounding, two-modules and global-precision offer it too", () => {
    for (const mode of ["rounding", "two-modules", "global-precision"] as const) {
      const { unmount } = render(<TimescaleLab mode={mode} />);
      fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(screen.getAllByRole("button", { name: /lock in prediction/i })[0], mode).toBeDisabled();
      unmount();
    }
  });

  it("the suspects come from the model, in code order", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    const names = screen.getAllByRole("button", { name: /^Suspect line:/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toHaveLength(gradeCrossScopeSuspects().length);
    expect(names[0]).toBe("Suspect line: #t;");
  });
});

describe("TimescaleLab · the delay field takes only what compiles", () => {
  const noPrompt = () => {
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("input-error")).toBeInTheDocument();
  };
  for (const [text, reason] of [
    ["#(x)", /#\(1'bx\)/],
    ["#x", /#\(1'bx\)/],
    ["#5 ns", /no space before its unit/],
    ["-1", /no unary minus/],
    ["#1'bz", /needs parentheses/],
    ["_1", /Write a delay/],
    ["#(-99999999999999999999)", /does not fit a 64-bit/],
  ] as const) {
    it(`rounding: ${text} is rejected with its reason and never rendered as code`, () => {
      render(<TimescaleLab mode="rounding" />);
      fireEvent.change(delayInput(), { target: { value: text } });
      noPrompt();
      expect(screen.getByTestId("input-error")).toHaveTextContent(reason);
      expect(delayInput()).toHaveAttribute("aria-invalid", "true");
    });
  }

  it("the x/z preset shows a based literal in its question and its label", () => {
    render(<TimescaleLab mode="rounding" preset="xz" />);
    expect(screen.getByRole("option", { name: "#(1'bx) at 1ns/100ps" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /runs #\(1'bx\) at t = 0/ })).toBeInTheDocument();
    lockIn(/^0 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
  });
});

describe("TimescaleLab · the tick ruler says what happened", () => {
  const ruler = () => screen.getByRole("img", { name: /^Ruler of/ });

  it("a delay on a tick stays there: no 'between ticks', no snapping, no rounding caption", () => {
    render(<TimescaleLab mode="rounding" preset="table-2.5" />);
    skip();
    expect(ruler()).toHaveAccessibleName("Ruler of 1ns ticks. The scaled delay 25 ns is already on a tick, so it stays at 25 ns.");
    expect(ruler()).toHaveTextContent("scaled: 25 ns");
    expect(ruler()).toHaveTextContent("already on a tick: nothing to round (§3.14.1)");
    expect(ruler()).not.toHaveTextContent("rounds to the nearest tick");
    expect(ruler()).not.toHaveTextContent("written:");
    const rows = within(screen.getByTestId("rounding-reveal"));
    expect(rows.getByText("Wake time")).toBeInTheDocument();
    expect(rows.queryByText("On the precision grid")).not.toBeInTheDocument();
  });

  it("an x/z delay is interpreted as zero, not scaled and not written as 0 ns", () => {
    render(<TimescaleLab mode="rounding" preset="xz" />);
    skip();
    expect(ruler()).toHaveAccessibleName("Ruler of 100ps ticks. An x or z delay is interpreted as zero, so the statement wakes at 0 ns.");
    expect(ruler()).toHaveTextContent("x/z is treated as 0");
    expect(ruler()).not.toHaveTextContent("scaled:");
    const rows = within(screen.getByTestId("rounding-reveal"));
    expect(rows.getByText("Interpreted as zero")).toBeInTheDocument();
    expect(rows.queryByText("Exact size: number × unit")).not.toBeInTheDocument();
  });

  it("a rounding delay still snaps, its marker names the scaled value, and a literal is converted rather than scaled", () => {
    render(<TimescaleLab mode="rounding" preset="table-1.26-10ns" />);
    skip();
    expect(ruler()).toHaveAccessibleName("Ruler of 1ns ticks. The scaled delay 12.6 ns sits between ticks and snaps to 13 ns.");
    expect(ruler()).toHaveTextContent("scaled: 12.6 ns");
    expect(within(screen.getByTestId("rounding-reveal")).getByText("On the precision grid")).toBeInTheDocument();
    expect(within(screen.getByTestId("rounding-reveal")).getByText("Exact size: number × unit")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "literal-2.1ns" } });
    skip();
    expect(within(screen.getByTestId("rounding-reveal")).getByText("Converted to the current unit")).toBeInTheDocument();
  });

  it("the caption sits below the axis, clear of the dashed snap lines", () => {
    render(<TimescaleLab mode="rounding" />);
    skip();
    const texts = Array.from(ruler().querySelectorAll("text"));
    const caption = texts.find((t) => /half tick/.test(t.textContent ?? "")) as SVGTextElement;
    const lowestTickLabel = Math.max(...texts.filter((t) => t !== caption).map((t) => Number(t.getAttribute("y"))));
    expect(Number(caption.getAttribute("y"))).toBeGreaterThan(lowestTickLabel);
    expect(Number(caption.getAttribute("y"))).toBeLessThan(Number(ruler().getAttribute("viewBox")?.split(" ")[3]));
  });
});

describe("TimescaleLab · two-modules gives nothing away before both predictions", () => {
  const axis = () => screen.getByTestId("two-modules-axis");
  const revealBoth = () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
  };

  for (const delay of ["#5", "#60", "#(-1)"]) {
    it(`${delay}: the axis has no scale until both predictions are made`, () => {
      render(<TimescaleLab mode="two-modules" />);
      fireEvent.change(delayInput(), { target: { value: delay } });
      const svg = within(axis()).getByRole("img");
      expect(svg).toHaveAccessibleName("Time axis; its scale and the wake markers appear after both predictions.");
      const labels = () => Array.from(svg.querySelectorAll("text")).map((t) => t.textContent ?? "");
      expect(labels()).toEqual(["● tb_top: timeunit 1ns; timeprecision 100ps;", "◆ u_slow: timeunit 10ns; timeprecision 1ns;", "simulation time"]);
      fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
      expect(labels()).toHaveLength(3);
    });
  }

  it("#5: the scale appears with the markers, ending at u_slow's wake", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#5" } });
    fireEvent.change(screen.getByLabelText("u_slow runs it"), { target: { value: "1" } });
    revealBoth();
    expect(within(axis()).getByRole("img", { name: /^Time axis 0 to 50 ns\./ })).toBeInTheDocument();
  });

  it("the global-precision footer waits too, since it rules out a distractor", () => {
    render(<TimescaleLab mode="two-modules" />);
    expect(screen.queryByText(/global precision is/, onScreen)).not.toBeInTheDocument();
    revealBoth();
    expect(shown(/global precision is/)).toHaveTextContent("100 ps");
  });

  it("the summary does not say the unit scales a time literal", () => {
    const summary = () => screen.getByRole("region", { name: "Timescale lab: one delay, two modules" }).textContent ?? "";
    render(<TimescaleLab mode="two-modules" />);
    expect(summary()).toContain("Each module's unit sets the size of the delay, and its own precision sets the grid it lands on (§3.14, §3.14.1).");
    expect(summary()).not.toMatch(/scales it differently|then the element's own precision/);
    fireEvent.change(delayInput(), { target: { value: "#2.1ns" } });
    expect(summary()).not.toContain("Each module's unit sets the size");
    expect(summary()).toContain("A time literal is the same value before rounding in both (§5.8)");
    lockInWithin(/tb_top \(/, /^2 ns$/);
    expect(shown(/A time literal is the same value before rounding in every module \(§5\.8\); the other module's settings play no part here/)).toBeInTheDocument();
  });

  it("a negative delay run twice stops at its first wake and says why", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#(-1)" } });
    revealBoth();
    expect(within(screen.getByRole("list", { name: "Wake times" })).getAllByRole("listitem")[1].textContent).not.toContain("then");
    expect(shown(/would pass the 64 bits of a time variable/)).toBeInTheDocument();
  });
});

describe("TimescaleLab · read-time keeps its prose true to the code on screen", () => {
  const summary = () => screen.getByTestId("preset-summary");
  const toggleToTime = () => fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
  const log = () => screen.getByLabelText("Printed log");

  it("make-it-work with %t of $time: the log prints the rounded times, and the outcome that says otherwise is gone", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    revealEveryMoment();
    expect(screen.getByTestId("preset-outcome")).toHaveTextContent("1.3 ns and 13.0 ns");
    toggleToTime();
    expect(log()).toHaveTextContent("%t=1.0 ns");
    expect(log()).toHaveTextContent("%t=10.0 ns");
    expect(log()).toHaveTextContent("%t=30.0 ns");
    expect(screen.queryByTestId("preset-outcome")).not.toBeInTheDocument();
    expect(screen.getByTestId("preset-changed")).toHaveTextContent("3 of 3 log lines print differently");
    expect(summary()).toHaveTextContent("every %t now reads $time instead of $realtime");
    // Undoing the change brings the preset's own prose back.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $realtime" }));
    expect(screen.getByTestId("preset-outcome")).toBeInTheDocument();
    expect(summary()).toHaveTextContent("No `timescale anywhere");
  });

  it("uvm-stamp with $timeformat called: neither 'reads 15000' nor 'Nobody called $timeformat' stays on screen", () => {
    render(<TimescaleLab mode="read-time" preset="uvm-stamp" />);
    expect(summary()).toHaveTextContent("Nobody called $timeformat");
    chooseTimeformat(/called with/);
    revealEveryMoment();
    expect(log()).toHaveTextContent("@ 15.000 ns:");
    expect(summary()).not.toHaveTextContent("Nobody called");
    expect(summary()).toHaveTextContent('$timeformat(-9, 3, " ns", 0); now runs first');
    expect(screen.queryByTestId("preset-outcome")).not.toBeInTheDocument();
    expect(screen.getByTestId("preset-changed")).toHaveTextContent("1 of 1 log lines");
  });

  it("f2d with $timeformat called: lines b and c print the called format, and the Table 20-3 outcome is gone", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    chooseTimeformat(/called with/);
    revealEveryMoment();
    expect(log()).toHaveTextContent("b: [10.000 ns]");
    expect(log()).toHaveTextContent("c: [10.000 ns]");
    expect(screen.queryByTestId("preset-outcome")).not.toBeInTheDocument();
    expect(screen.getByTestId("preset-changed")).toHaveTextContent("2 of 5 log lines");
  });

  it("the toggle's explanation waits for the reveal: it would rule out the 'unrounded' distractor", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.getByRole("radiogroup", { name: "%t argument" })).toBeInTheDocument();
    expect(screen.queryByTestId("percent-t-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/has already lost the fraction/, onScreen)).not.toBeInTheDocument();
    skip();
    expect(screen.getByTestId("percent-t-note")).toHaveTextContent("has already lost the fraction");
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.queryByTestId("percent-t-note")).not.toBeInTheDocument();
  });

  for (const id of ["f2d-printing-time", "uvm-stamp"]) {
    it(`${id}: no toggle, because both arguments print the same; once revealed the lab says so`, () => {
      render(<TimescaleLab mode="read-time" preset={id} />);
      expect(screen.queryByRole("radiogroup", { name: "%t argument" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("percent-t-note")).not.toBeInTheDocument();
      skip();
      expect(screen.getByTestId("percent-t-note")).toHaveTextContent("print the same text here, so there is nothing to toggle");
    });
  }

  it("a toggle in force stays available even where it has stopped mattering, so it can be undone", () => {
    render(<TimescaleLab mode="read-time" />);
    toggleToTime();
    chooseTimeformat(/called with/);
    fireEvent.change(screen.getByLabelText("units_number"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("precision_number"), { target: { value: "0" } });
    expect(screen.getByRole("radiogroup", { name: "%t argument" })).toBeInTheDocument();
  });

  it("after the toggle, the answered moment says the printed line changed", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=2 \$realtime=1\.6 %t=.*then 16$/);
    expect(screen.queryByTestId("asked-changed")).not.toBeInTheDocument();
    toggleToTime();
    expect(screen.getByTestId("asked-changed")).toHaveTextContent("The %t toggle has changed the code since");
    expect(screen.getByTestId("moment-prints")).toHaveAttribute("data-line", expect.stringContaining("20"));
  });

  it("says on screen that the table leaves out the padding the log shows", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(shown(/The %t columns leave out any padding/)).toBeInTheDocument();
  });
});

describe("TimescaleLab · read-time source that cannot run", () => {
  const custom = () => fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
  const cannotRun = () => {
    expect(document.querySelector('fieldset input[type="radio"]')).toBeNull();
    expect(screen.queryByRole("slider", { name: "Moment" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Printed log")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "%t argument" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Time readings of every moment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show advanced/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("input-error")).toBeInTheDocument();
  };

  it("a precision coarser than the unit asks no question and prints nothing (§3.14)", () => {
    render(<TimescaleLab mode="read-time" />);
    custom();
    fireEvent.change(screen.getByLabelText("Caller's time unit"), { target: { value: "1ps" } });
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "1ns" } });
    cannotRun();
    expect(screen.getByTestId("input-error")).toHaveTextContent("§3.14");
    expect(screen.getByRole("list", { name: "The code, which cannot run" })).toHaveTextContent("timeunit 1ps; timeprecision 1ns;");
  });

  it("an unparseable delay beside a good one asks no question either", () => {
    render(<TimescaleLab mode="read-time" />);
    custom();
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "abc, #2" } });
    cannotRun();
    expect(screen.getByLabelText("Delay sequence")).toHaveAttribute("aria-invalid", "true");
  });

  for (const delay of ["#-5", "#x"]) {
    it(`${delay} is not accepted as source`, () => {
      render(<TimescaleLab mode="read-time" />);
      custom();
      fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: delay } });
      cannotRun();
    });
  }

  it("a tool-dependent half tick is said only in the reveal of the moments it affects", () => {
    render(<TimescaleLab mode="read-time" />);
    custom();
    fireEvent.change(screen.getByLabelText("Caller's time unit"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "100ps" } });
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "#1, #2.85" } });
    expect(screen.queryByTestId("run-notes")).not.toBeInTheDocument();
    skip();
    expect(screen.queryByTestId("run-notes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.queryByTestId("run-notes")).not.toBeInTheDocument();
    skip();
    expect(screen.getByTestId("run-notes")).toHaveTextContent("#2.85 sits on a tool-dependent half tick");
  });
});

describe("TimescaleLab · moving between moments", () => {
  const live = () => screen.getByTestId("lab-live");
  const nextButton = () => screen.getByRole("button", { name: "Next moment" });

  it("the arrow at the end stays focused and does nothing, so the focus does not fall out of the lab", () => {
    render(<TimescaleLab mode="read-time" />);
    const next = nextButton();
    const previous = screen.getByRole("button", { name: "Previous moment" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).not.toBeDisabled();
    next.focus();
    fireEvent.click(next);
    expect(document.activeElement).toBe(next);
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toBeDisabled();
    expect(previous).not.toHaveAttribute("aria-disabled");
    fireEvent.click(next);
    expect(screen.getByRole("slider", { name: "Moment" })).toHaveValue("1");
  });

  it("the cross-scope arrows behave the same way", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const previous = screen.getByRole("button", { name: "Previous step" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(previous);
    expect(screen.getByRole("slider", { name: "Crossing step" })).toHaveValue("0");
  });

  it("landing on an unanswered moment is announced, and the region stays empty until the learner moves", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    expect(live()).toBeEmptyDOMElement();
    fireEvent.click(nextButton());
    expect(live()).toHaveTextContent("Moment 2 of 3: predict what u_slow prints.");
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "2" } });
    expect(live()).toHaveTextContent("Moment 3 of 3: predict what u_slow prints.");
  });

  it("the reveal ends with a way on, which moves the focus to the next question", () => {
    render(<TimescaleLab mode="read-time" />);
    skip();
    const onward = within(screen.getByTestId("read-time-reveal")).getByRole("button", { name: "Predict moment 2" });
    fireEvent.click(onward);
    expect(screen.getByRole("slider", { name: "Moment" })).toHaveValue("1");
    expect(document.activeElement).toBe(screen.getByTestId("moment-prompt"));
    expect(live()).toHaveTextContent("Moment 2 of 2");
    skip();
    expect(within(screen.getByTestId("read-time-reveal")).queryByRole("button", { name: /^Predict moment/ })).not.toBeInTheDocument();
  });

  it("the way on goes back to a skipped moment when none is left after this one", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.click(nextButton());
    skip();
    expect(within(screen.getByTestId("read-time-reveal")).getByRole("button", { name: "Predict moment 1" })).toBeInTheDocument();
  });

  it("the current row of the moment table has a marker and aria-current, not only a colour", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    const table = screen.getByRole("region", { name: "Time readings of every moment" });
    const current = () => table.querySelector('tr[aria-current="true"]') as HTMLElement;
    expect(current()).toHaveTextContent("▶ 1");
    fireEvent.click(nextButton());
    expect(current()).toHaveTextContent("▶ 2");
    expect(table.querySelectorAll('tr[aria-current="true"]')).toHaveLength(1);
  });
});

describe("TimescaleLab · padded options sound and look different", () => {
  const momentOptions = () => Array.from(document.querySelectorAll<HTMLInputElement>('fieldset input[type="radio"]'));

  it("F2D line b: options that differ only in padding have different accessible names", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "1" } });
    expect(screen.getByRole("radio", { name: "b: [ padded with 15 spaces, then 10000]" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "b: [10000]" })).toBeInTheDocument();
  });

  for (const moment of [1, 2, 3]) {
    it(`F2D moment ${moment + 1}: every option's name is distinct once whitespace collapses, as a screen reader hears it`, () => {
      render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
      fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: String(moment) } });
      const names = momentOptions().map((radio) => (radio.closest("label")?.textContent ?? "").replace(/·/g, "").replace(/\s+/g, " "));
      expect(new Set(names).size).toBe(names.length);
    });
  }

  it("the padding is drawn as hidden glyphs with a key, and the line in the reveal does the same", () => {
    render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "1" } });
    const glyphs = Array.from(document.querySelectorAll('fieldset [aria-hidden="true"]')).filter((el) => /^·+$/.test(el.textContent ?? ""));
    expect(glyphs.map((g) => g.textContent?.length)).toContain(15);
    expect(screen.getByText(/· is one padding space/)).toBeInTheDocument();
    lockIn(/^b: \[.*padded with 15 spaces, then 10000\]$/);
    expect(screen.getByTestId("moment-prints")).toHaveAttribute("data-line", `b: [${"10000".padStart(20)}]`);
    expect(screen.getByTestId("moment-prints")).toHaveTextContent(/·{15}padded with 15 spaces, then 10000/);
  });

  it("the template's own alignment is not called padding", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    lockIn(/^tb_top \$time=1 \$realtime=1\.30 %t=1\.3 ns$/);
    expect(screen.getByTestId("moment-prints").textContent).not.toContain("padded");
  });
});

describe("TimescaleLab · global precision says what this design does", () => {
  const box = () => screen.getByLabelText(/Add vendor_model\.sv/);

  it("the labels name the constructs: tb.sv has timeunit and timeprecision, and vendor_model has neither", () => {
    render(<TimescaleLab mode="global-precision" />);
    expect(screen.getByRole("list", { name: "tb.sv (timeunit and timeprecision, no `timescale)" })).toBeInTheDocument();
    expect(box().closest("label")).toHaveTextContent("slow_gen and tb_top keep their own timeunit and timeprecision; vendor_model takes both from the directive.");
    expect(box().closest("label")).not.toHaveTextContent("Every module keeps");
  });

  it("the code panels come from the model's design, and the vendor model is instantiated", () => {
    render(<TimescaleLab mode="global-precision" />);
    const tb = () => screen.getByRole("list", { name: /^tb\.sv/ });
    const vendor = () => screen.getByRole("list", { name: "vendor_model.sv" });
    for (const [on, files] of [[false, globalPrecisionDesign(false)], [true, globalPrecisionDesign(true)]] as const) {
      if (on) fireEvent.click(box());
      expect(within(tb()).getAllByRole("listitem").map((li) => li.querySelector("code")?.textContent)).toEqual([...files[0].code]);
    }
    expect(tb()).toHaveTextContent("vendor_model u_vendor ();");
    expect(within(vendor()).getAllByRole("listitem").map((li) => li.querySelector("code")?.textContent)).toEqual(["`timescale 1ns/1fs", "module vendor_model; endmodule"]);
  });

  it("the reveal does not call the 1 fs directive unused: vendor_model runs on it", () => {
    render(<TimescaleLab mode="global-precision" />);
    fireEvent.click(box());
    lockIn(/is 1fs \/ 1fs/);
    expect(allShown(/slow_gen and tb_top declare their own, and only vendor_model takes it/).length).toBeGreaterThan(0);
    lockIn(/^1fs$/);
    const reveal = screen.getByTestId("global-precision-reveal");
    expect(reveal).toHaveTextContent("The directive counts toward the global precision even though tb.sv's modules do not use it (they declare their own timeunit and timeprecision). Only vendor_model does (§3.14.3).");
    expect(reveal).not.toHaveTextContent("no module uses it");
    expect(reveal).toHaveTextContent("vendor_model takes its unit and precision from the directive (rule b)");
  });

  it("predicts the default %t units too, and each prediction takes the focus in turn", () => {
    render(<TimescaleLab mode="global-precision" />);
    lockIn(/is 100ps \/ 100ps/);
    expect(document.activeElement).toBe(screen.getByTestId("reveal-heading"));
    expect(screen.getByRole("group", { name: /which units does %t default to/ })).toBeInTheDocument();
    lockIn(/^100ps$/);
    expect(shown(/Table 20-3 looks only at the precision arguments/)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId("comparison-heading"));
    expect(screen.getByTestId("lab-live")).toHaveTextContent(/^Not quite\..*does not define this case/);
    expect(screen.getAllByRole("row").find((r) => r.textContent?.startsWith("default %t units"))).toHaveTextContent("Table 20-3 does not define it");
  });
});

describe("TimescaleLab · cross-scope", () => {
  const chooseForm = (name: string) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name }));
  const code = () => screen.getByRole("list", { name: "util_pkg and tb_top" });

  for (const form of ["util_pkg::wait_t(1.5ns);", "util_pkg::wait_ns(5);", "repeat (5) @(posedge clk);"]) {
    it(`${form}: the comment that explains the result waits for the prediction`, () => {
      render(<TimescaleLab mode="cross-scope" />);
      chooseForm(form);
      expect(code()).not.toHaveTextContent("THIS package's time unit");
      skip();
      expect(code()).toHaveTextContent("THIS package's time unit");
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(code()).not.toHaveTextContent("THIS package's time unit");
    });
  }

  it("a culprit found before visiting another form does not bring the comment back while that form is armed", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    expect(code()).toHaveTextContent("THIS package's time unit");
    chooseForm("util_pkg::wait_t(1.5ns);");
    expect(code()).not.toHaveTextContent("THIS package's time unit");
  });

  it("start over returns to the first call form", () => {
    render(<TimescaleLab mode="cross-scope" />);
    chooseForm("util_pkg::wait_ns(5);");
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(within(screen.getByRole("radiogroup", { name: "Call form" })).getByRole("radio", { name: "util_pkg::wait_t(5ns);" })).toHaveAttribute("aria-checked", "true");
    expect(code()).toHaveTextContent("util_pkg::wait_t(5ns);");
  });

  it("each step names the line it runs, generated from the code panel's own lines", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const line = () => screen.getByTestId("crossing-line").textContent;
    expect(line()).toBe("Line 12: util_pkg::wait_t(5ns);");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(line()).toBe("Line 3: task automatic wait_t(time t);");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(line()).toBe("Line 4: #t;");
    const listed = within(code()).getAllByRole("listitem");
    expect(listed[3]).toHaveAttribute("aria-current", "step");
  });

  it("the chip clears the lane titles at the phone width's wrap", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const chip = screen.getByTestId("crossing-chip");
    expect(chip.className).toContain("top-11");
    expect(chip.parentElement?.innerHTML).toContain("min-h-[110px]");
  });

  it("the chosen fix is marked in words and named in its verdict; the cycle count is graded from its clock line", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const fix = screen.getByRole("button", { name: /Pass a cycle count/ });
    expect(fix).not.toHaveTextContent("Chosen");
    fireEvent.click(fix);
    expect(fix).toHaveTextContent("Chosen");
    const verdict = screen.getByTestId("fix-verdict");
    expect(verdict).toHaveTextContent("Chosen fix: Pass a cycle count");
    expect(verdict).toHaveTextContent("always #0.5ns clk = ~clk;");
    expect(verdict).toHaveTextContent("With a bare #0.5, a caller in 10ns would wake at 50 ns.");
    expect(within(verdict).getByRole("table").querySelectorAll("td")).toHaveLength(9);
    expect(within(verdict).getByRole("table")).not.toHaveTextContent("✕");
  });
});

describe("TimescaleLab · start over restores the first state", () => {
  it("read-time: the advanced panel closes, and Custom comes back with its first values", () => {
    render(<TimescaleLab mode="read-time" />);
    chooseTimeformat(/called with/);
    fireEvent.change(screen.getByLabelText("suffix_string"), { target: { value: " zz" } });
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Caller's time unit"), { target: { value: "1ns" } });
    fireEvent.change(screen.getByLabelText("Caller's time precision"), { target: { value: "1ps" } });
    fireEvent.change(screen.getByLabelText("Delay sequence"), { target: { value: "#3" } });
    fireEvent.click(screen.getByLabelText(/the build has a `timescale/));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText("Preset")).toHaveValue("20.3.1");
    expect(screen.getByRole("button", { name: /^Show advanced/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radiogroup", { name: "$timeformat before the code runs" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "custom" } });
    expect(screen.getByLabelText("Caller's time unit")).toHaveValue("10ns");
    expect(screen.getByLabelText("Caller's time precision")).toHaveValue("1ns");
    expect(screen.getByLabelText("Delay sequence")).toHaveValue("#1.55, #1.55");
    expect(screen.getByLabelText(/the build has a `timescale/)).not.toBeChecked();
    chooseTimeformat(/called with/);
    expect(screen.getByLabelText("suffix_string")).toHaveValue(" ns");
  });

  it("read-time: the live region is empty again after moving and starting over", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.getByTestId("lab-live")).not.toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByTestId("lab-live")).toBeEmptyDOMElement();
  });
});

describe("TimescaleLab · which-unit marks the element the question asked about", () => {
  it("module b's row has a marker and aria-current, not only a colour", () => {
    render(<TimescaleLab mode="which-unit" />);
    skip();
    const rows = screen.getByTestId("which-unit-reveal").querySelectorAll('tr[aria-current="true"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("▶ module b");
  });
});

describe("TimescaleLab · the stated assumptions", () => {
  it("list every clause the labs rely on and the readings the sources leave open", () => {
    const text = TIMESCALE_ASSUMPTIONS.join("\n");
    for (const clause of ["§3.12.1", "§20.4.1", "§20.4.2", "§20.4.3", "§22.3", "§22.7", "§5.6", "§5.7.2", "§6.8", "§6.11", "§6.12 ", "§9.4.2", "§10.8", "§12.7.2", "A.2.2.3", "A.6.5", "A.8.7"]) expect(text, clause).toContain(clause);
    expect(text).toContain("Neither §3.14.1 nor §22.7 makes an order a rule");
    expect(text).toMatch(/The lab's reasoning, not a rule of the standard: a real literal is held as an IEEE 754 double \(§5\.7\.2\)/);
    expect(text).toMatch(/only while its wake times stay below 2\^64 of the element's units/);
    expect(text).toMatch(/\$stime keeps the low 32 bits of the value already scaled/);
    expect(text).toMatch(/an exact decimal tie rounds up/);
    expect(text).toMatch(/Table 20-3 names only the smallest `timescale precision and does not define this case/);
    expect(text).toMatch(/after a `resetall, a compilation-unit timeunit still decides by rule \(c\)/);
  });
});

describe("TimescaleLab · fix round 1: rounding states no order as the rule", () => {
  const region = () => screen.getByRole("region", { name: "Timescale lab: rounding a delay" });

  it("the summary names §22.7's order and the equal result, and cites §3.14.1 for no order", () => {
    render(<TimescaleLab mode="rounding" />);
    const text = region().textContent ?? "";
    expect(text).toContain("The time unit sets the size of a delay and the element's own precision sets the grid it lands on (IEEE 1800-2023 §3.14, §3.14.1). §22.7 lists the steps as round, then scale, and either order gives the same wake time.");
    expect(text).not.toMatch(/scales the number, then|then the element's own precision rounds/);
  });

  it("the reveal shows §22.7's order beside the ruler, computed for the delay", () => {
    render(<TimescaleLab mode="rounding" preset="spine-1.55" />);
    skip();
    expect(shown(/^§22\.7 lists the steps as round, then scale: 1\.55 rounded to one decimal place is 1\.6, and 1\.6 × 1ns is 1\.6 ns\./)).toBeInTheDocument();
  });
});

describe("TimescaleLab · fix round 1: the tool-dependent box", () => {
  it("#2.85: the binary remark is labelled as the lab's reasoning", () => {
    render(<TimescaleLab mode="rounding" preset="tie-2.85" />);
    skip();
    expect(screen.getByTestId("binary-remark")).toHaveTextContent(/^The lab's reasoning, not a rule of the standard: .*\(§5\.7\.2\), and 2\.85 has no exact binary form/);
  });

  it("#0.5 at 1ns/1ns: an exact tie in binary gets no binary remark, and one tick is '1 tick'", () => {
    render(<TimescaleLab mode="rounding" />);
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "1ns" } });
    fireEvent.change(delayInput(), { target: { value: "#0.5" } });
    skip();
    expect(screen.getByText("Tool-dependent")).toBeInTheDocument();
    expect(screen.queryByTestId("binary-remark")).not.toBeInTheDocument();
    expect(shown(/Half away from zero gives 1 tick and half to even gives 0 ticks\./)).toBeInTheDocument();
    expect(screen.getByTestId("rounding-reveal").textContent).not.toMatch(/\b1 ticks/);
  });
});

describe("TimescaleLab · fix round 1: the tick ruler marker past 2^53", () => {
  it("#12345678901234567.5 at 1ns/1ns: the marker sits half way between its two ticks, 2.5 ticks after the first drawn", () => {
    render(<TimescaleLab mode="rounding" />);
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "1ns" } });
    fireEvent.change(delayInput(), { target: { value: "#12345678901234567.5" } });
    skip();
    const ruler = screen.getByRole("img", { name: /^Ruler of/ });
    const marker = Array.from(ruler.querySelectorAll("circle")).find((c) => c.getAttribute("fill") === "rgb(245,158,11)") as SVGCircleElement;
    // pad 30 + 2.5 ticks × 60 per tick.
    expect(Number(marker.getAttribute("cx"))).toBeCloseTo(180, 5);
  });
});

describe("TimescaleLab · fix round 1: two modules", () => {
  const revealBoth = () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal without predicting" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reveal without predicting" }));
  };

  it("a positive delay near 2^64 units lists one wake in u_slow and says why, like a negative one", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#18446744073709551615" } });
    const slowGroup = screen.getByRole("group", { name: /u_slow \(/ });
    for (const radio of within(slowGroup).getAllByRole("radio")) expect(radio.closest("label")?.textContent).not.toContain("then");
    revealBoth();
    expect(within(screen.getByRole("list", { name: "Wake times" })).getAllByRole("listitem")[1].textContent).not.toContain("then");
    expect(shown(/Only the wakes below 2\^64 time units are shown: a later copy of this delay would pass the 64 bits of a time variable/)).toBeInTheDocument();
    expect(screen.getByTestId("two-modules-axis").textContent).not.toMatch(/then every/);
  });

  it("a negative delay's summary gives no rule away, like the x/z one", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#(-1)" } });
    const text = screen.getByRole("region", { name: "Timescale lab: one delay, two modules" }).textContent ?? "";
    expect(text).toContain("tb_top and u_slow run the same #d from t = 0. Predict when each one wakes.");
    expect(text).not.toMatch(/precision rounds|sets the grid/);
  });

  it("the questions show the model's own timeunit lines", () => {
    render(<TimescaleLab mode="two-modules" />);
    expect(screen.getByRole("group", { name: /tb_top \(/ }).textContent).toContain(`tb_top (${timeunitLine(TB_TOP_SCOPE)}) runs`);
    expect(screen.getByRole("group", { name: /u_slow \(/ }).textContent).toContain(`u_slow (${timeunitLine(U_SLOW_SCOPE)}) runs`);
  });

  it("u_slow run twice offers the running-total misconception", () => {
    render(<TimescaleLab mode="two-modules" />);
    lockInWithin(/u_slow \(/, /^13 ns, then 25 ns$/);
    expect(shown(/That rounds the running total\./)).toBeInTheDocument();
  });
});

describe("TimescaleLab · fix round 1: cross-scope", () => {
  it("the title and summary before the commit are neutral; the 1000× name comes with the reveal", () => {
    render(<TimescaleLab mode="cross-scope" />);
    const frame = screen.getByRole("region", { name: "Timescale lab: a time value crosses a scope" });
    expect(within(frame).getByRole("heading", { level: 3 })).toHaveTextContent("A time value crosses a scope");
    expect(frame.textContent).not.toMatch(/1000|factor/);
    lockIn(/^5 ps$/);
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent("The 1000× delay");
  });

  it("finding #t, then reading a decoy's verdict, keeps the trace, the fixes and the chosen fix", () => {
    render(<TimescaleLab mode="cross-scope" />);
    lockIn(/^5 ps$/);
    fireEvent.click(screen.getByRole("button", { name: "Suspect line: #t;" }));
    fireEvent.click(screen.getByRole("button", { name: /Scale inside the package/ }));
    expect(screen.getByTestId("fix-verdict")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Suspect line: \$timeformat/ }));
    expect(screen.getByTestId("suspect-verdict")).toHaveTextContent(/A decoy\./);
    expect(screen.getByTestId("crossing-chip")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Fixes" })).toBeInTheDocument();
    expect(screen.getByTestId("fix-verdict")).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).not.toBeNull();
    expect(screen.getByRole("list", { name: "util_pkg and tb_top" })).toHaveTextContent("THIS package's time unit");
    expect(screen.queryByRole("button", { name: /Skip the hunt/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Need a hint/ })).not.toBeInTheDocument();
    // Start over arms the hunt again.
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    lockIn(/^5 ps$/);
    expect(screen.queryByTestId("crossing-chip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip the hunt/ })).toBeInTheDocument();
  });

  it("the lane titles come from the model's configuration", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    const lanes = screen.getByRole("region", { name: "The value moving through the scopes" });
    expect(lanes).toHaveTextContent(`tb_top (${formatScale(CROSS_SCOPE_DEFAULT.callerUnit)})`);
    expect(lanes).toHaveTextContent(`util_pkg (${formatScale(CROSS_SCOPE_DEFAULT.calleeUnit)})`);
  });

  it("the cycle-count fix shows both clock lines its results assume", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    skipHunt();
    fireEvent.click(screen.getByRole("button", { name: /Pass a cycle count/ }));
    const verdict = screen.getByTestId("fix-verdict");
    expect(verdict).toHaveTextContent("logic clk = 1; // set before any procedure starts (§6.8)");
    expect(verdict).toHaveTextContent("These results assume the two clock lines above");
  });

  it("the focus stays in the hunt when the last hint removes the hint button", async () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    for (const name of [/Need a hint\?/, /Another hint/, /Another hint/]) {
      const button = screen.getByRole("button", { name });
      button.focus();
      fireEvent.click(button);
    }
    expect(screen.queryByRole("button", { name: /Another hint/ })).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("hint-focus")));
    expect(screen.getByRole("group", { name: "Hints" })).toHaveAttribute("tabindex", "-1");
  });

  it("a hint that leaves its button in place does not move the focus", async () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    const button = screen.getByRole("button", { name: /Need a hint\?/ });
    button.focus();
    fireEvent.click(button);
    const next = screen.getByRole("button", { name: /Another hint/ });
    next.focus();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(document.activeElement).toBe(next);
  });
});

describe("TimescaleLab · fix round 1: the %t toggle keeps the focus", () => {
  it("undoing a toggle where the two arguments print alike keeps the control mounted", () => {
    render(<TimescaleLab mode="read-time" />);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
    chooseTimeformat(/called with/);
    fireEvent.change(screen.getByLabelText("units_number"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("precision_number"), { target: { value: "0" } });
    const back = within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $realtime" });
    back.focus();
    fireEvent.click(back);
    expect(screen.getByRole("radiogroup", { name: "%t argument" })).toBeInTheDocument();
    expect(back).toBeInTheDocument();
    expect(back).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(back);
    skip();
    expect(screen.getByTestId("percent-t-note")).toHaveTextContent("print the same text at this format");
  });

  it("a fresh experiment without a toggle in force still shows no toggle where it would change nothing", () => {
    render(<TimescaleLab mode="read-time" preset="uvm-stamp" />);
    expect(screen.queryByRole("radiogroup", { name: "%t argument" })).not.toBeInTheDocument();
  });
});

describe("TimescaleLab · fix round 1: start over restores each lab's first state", () => {
  it("rounding: the preset, delay, unit and precision come back", () => {
    render(<TimescaleLab mode="rounding" preset="tie-2.85" />);
    fireEvent.change(screen.getByLabelText("Time unit"), { target: { value: "10ns" } });
    fireEvent.change(screen.getByLabelText("Time precision"), { target: { value: "1ns" } });
    fireEvent.change(delayInput(), { target: { value: "#7" } });
    skip();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText("Preset")).toHaveValue("tie-2.85");
    expect(screen.getByLabelText("Time unit")).toHaveValue("1ns");
    expect(screen.getByLabelText("Time precision")).toHaveValue("100ps");
    expect(delayInput()).toHaveValue("#2.85");
    expect(screen.queryByTestId("rounding-reveal")).not.toBeInTheDocument();
  });

  it("two-modules: the delay and both repeat counts come back", () => {
    render(<TimescaleLab mode="two-modules" />);
    fireEvent.change(delayInput(), { target: { value: "#5" } });
    fireEvent.change(screen.getByLabelText("tb_top runs it"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("u_slow runs it"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(delayInput()).toHaveValue("#1.26");
    expect(screen.getByLabelText("tb_top runs it")).toHaveValue("1");
    expect(screen.getByLabelText("u_slow runs it")).toHaveValue("2");
  });

  it("global-precision: the vendor model leaves the build and its column is hidden again", () => {
    render(<TimescaleLab mode="global-precision" />);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    skip();
    skip();
    expect(screen.getByRole("columnheader", { name: /With `timescale/ })).toBeInTheDocument();
    expect(screen.getByTestId("global-precision-reveal")).toHaveTextContent("1step equals the global precision (§3.14.3), so it moves with it.");
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText(/Add vendor_model\.sv/)).not.toBeChecked();
    skip();
    skip();
    expect(screen.getByTestId("global-precision-reveal")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /With `timescale/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Changed?" })).not.toBeInTheDocument();
  });
});

describe("TimescaleLab · fix round 1: the assumptions disclosure is a touch target", () => {
  const COARSE_SUMMARY = "[@media(pointer:coarse)]:[&_summary]:min-h-10";
  for (const mode of ["rounding", "two-modules", "read-time", "which-unit", "global-precision", "cross-scope"] as const) {
    it(`${mode}: the 'Assumptions and limits' summary gets a 40 px target on touch screens`, () => {
      const { container } = render(<TimescaleLab mode={mode} />);
      const summary = container.querySelector("summary") as HTMLElement;
      expect(summary).toHaveTextContent("Assumptions and limits");
      const frame = summary.closest("section") as HTMLElement;
      expect(frame.className).toContain(COARSE_SUMMARY);
      expect(frame.className).toContain("[@media(pointer:coarse)]:[&_summary]:py-3");
    });
  }
});
