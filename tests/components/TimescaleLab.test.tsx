import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TimescaleLab from "@/components/visuals/TimescaleLab";
import { READ_TIME_PRESETS, ROUNDING_PRESETS, readTimeOptions, roundDelayText, roundingOptions, runReadTime } from "@/lib/sv-timescale-model";

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
const chooseTimeformat = (name: RegExp) => fireEvent.click(within(screen.getByRole("radiogroup", { name: "$timeformat before the code runs" })).getByRole("radio", { name }));

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
    fireEvent.change(delayInput(), { target: { value: "#(x)" } });
    lockIn(/^0 ns$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(allShown(/interpreted as zero delay \(§9\.4\.1\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /snaps to 0 ns/ })).toBeInTheDocument();
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

  it("offers tb_top's result as a distractor for u_slow and explains the unit", () => {
    render(<TimescaleLab mode="two-modules" />);
    lockIn(/^1\.3 ns$/);
    lockIn(/^1\.3 ns, then 2\.6 ns$/);
    expect(shown(/That is what the same delay becomes in tb_top/)).toBeInTheDocument();
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
    expect(screen.getByRole("img", { name: /Time axis 0 to 2 us; the wake markers appear/ })).toBeInTheDocument();
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
    expect(axis.querySelectorAll("path")).toHaveLength(2);
    for (const marker of Array.from(axis.querySelectorAll("circle"))) {
      expect(Number(marker.getAttribute("cx"))).toBeLessThanOrEqual(360);
    }
  });
});

describe("TimescaleLab · read-time", () => {
  const log = () => screen.getByLabelText("Printed log");

  it("§20.3.1 preset: each moment has its own prediction: $time 2 / $realtime 1.6, then $time 3 / 3.2", () => {
    render(<TimescaleLab mode="read-time" />);
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Moment" });
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 1 of 2: test wakes from its 1st delay, not yet predicted");
    expect(log()).toHaveTextContent("predict moment 1 to reveal this line");

    lockIn(/^\$time=2 \$realtime=1\.6 %0t=16$/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("read-time-reveal")).getByRole("img", { name: /Absolute time 16 ns; in 10ns units that is 1\.6; \$time rounds it to 2/ })).toBeInTheDocument();
    expect(log()).toHaveTextContent("$time=2 $realtime=1.6");
    expect(log()).toHaveTextContent("predict moment 2 to reveal this line");

    // Scrubbing on re-arms the prediction: the answer stays hidden until this moment is committed too.
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.queryByTestId("read-time-reveal")).not.toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 2 of 2: test wakes from its 2nd delay, not yet predicted");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/^\$time=3 \$realtime=3\.2 %0t=32$/);
    expect(within(screen.getByTestId("read-time-reveal")).getByRole("img", { name: /Absolute time 32 ns.*\$time rounds it to 3/ })).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "Moment 2 of 2: test wakes from its 2nd delay, at 32 ns");

    // Going back keeps the first answer instead of asking again.
    fireEvent.click(screen.getByRole("button", { name: "Previous moment" }));
    expect(screen.queryByRole("button", { name: /lock in prediction/i })).not.toBeInTheDocument();
    expect(shown(/Correct\./)).toBeInTheDocument();
  });

  it("diagnoses counting in precision steps", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=16 \$realtime=16 /);
    expect(shown(/That counts in 1ns precision steps/)).toBeInTheDocument();
  });

  it("make-it-work preset asks about u_slow's own moment, where $realtime is 1.3 but %t prints 13.0 ns", () => {
    render(<TimescaleLab mode="read-time" preset="make-it-work" />);
    skip(); // tb_top's moment
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    const prompt = screen.getByRole("group", { name: /u_slow .*wakes from its 1st delay/ });
    expect(within(prompt).getByText(/1\.26/)).toBeInTheDocument();
    lockIn(/^\$time=1 \$realtime=1\.3 %0t=13\.0 ns$/);
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

  it("toggling the %t argument after the reveal changes what the moment prints", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=2 \$realtime=1\.6 %0t=16$/);
    const printed = () => within(screen.getByTestId("read-time-reveal")).getByText(/^Prints/).closest("p") as HTMLElement;
    expect(printed()).toHaveTextContent("%0t=16");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
    expect(printed()).toHaveTextContent("%0t=20");
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
    expect(shown(/Default units here:/)).toHaveTextContent("tool-dependent");
    revealEveryMoment();
    expect(log()).toHaveTextContent("⟨tool-dependent⟩");
    chooseTimeformat(/called with/);
    revealEveryMoment();
    expect(log()).toHaveTextContent("%t=16.000 ns");
  });

  it("$timeformat is a plain choice: the four arguments appear under 'called with…' and changing one re-arms the prediction", () => {
    render(<TimescaleLab mode="read-time" />);
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
    lockIn(/^\$time=3 \$realtime=3 %0t=⟨tool-dependent⟩$/);
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
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
    lockIn(/is 1fs \/ 1fs/);
    expect(shown(/Correct\./)).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    const rowText = rows.map((r) => r.textContent ?? "");
    expect(rowText.find((t) => t.startsWith("$printtimescale"))).toMatch(/100ps \/ 100ps.*1fs \/ 1fs.*changed/);
    expect(rowText.find((t) => t.startsWith("1step"))).toMatch(/100 ps1 fs.*changed/);
    expect(rowText.find((t) => t.startsWith("default %t units"))).toMatch(/tool-dependent.*1fs.*changed/);
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
    const chip = screen.getByTestId("crossing-chip");
    expect(chip).toHaveAttribute("data-lane", "caller");
    expect(chip).toHaveTextContent("5.01ns");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(chip).toHaveAttribute("data-lane", "boundary");
    expect(chip).toHaveTextContent("unit tag dropped");
    expect(shown(/The unit tag is gone: t is a number/)).toBeInTheDocument();
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
    expect(shown(/no time unit takes part/)).toBeInTheDocument();
  });

  it("grades suspects: #t is the culprit, $timeformat is a decoy; grades fixes by recomputation; three hints", () => {
    render(<TimescaleLab mode="cross-scope" />);
    expect(screen.queryAllByRole("button", { name: /^Suspect line:/ })).toHaveLength(0);
    skip();
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

    fireEvent.click(screen.getByRole("button", { name: /Need a hint\?/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    fireEvent.click(screen.getByRole("button", { name: /Another hint/ }));
    expect(screen.getAllByRole("listitem").filter((li) => /§5\.8|package boundary|§3\.14/.test(li.textContent ?? "")).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("button", { name: /Another hint/ })).not.toBeInTheDocument();
  });

  it("names each suspect button after its code line, with a touch-sized target and the verdict as its description", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
    expect(screen.getByRole("button", { name: "Suspect line: #t;" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspect line: timeunit 1ns; timeprecision 1ps;" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Suspect line: \$timeformat\(-9, 3, " ns", 0\);/ })).toBeInTheDocument();
    const call = screen.getByRole("button", { name: /^Suspect line: util_pkg::wait_t\(5ns\);/ });
    expect(call.className).toContain("min-h-7");
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
    { mode: "read-time", pick: /^\$time=2 \$realtime=1\.6 %0t=16$/, says: /^Correct\..*Prints \$time=2/ },
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
      const firstMomentAnswer = readTimeOptions(trace.snapshots[0], p.build, p.arg).find((o) => o.correct)?.label as string;
      expectAbsent(container, [firstMomentAnswer, p.outcome, ...trace.lines.filter((l) => l.momentIndex !== null).map((l) => l.text)]);
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
    { name: "util_pkg::wait_t(5ns);", values: ["5 ps", "woke at 0.005 ns"] },
    { name: "util_pkg::wait_t(1.5ns);", values: ["2 ps", "woke at 0.002 ns"] },
    // Here the answer equals the intent, which the lesson's $display states; the result itself stays hidden.
    { name: "util_pkg::wait_ns(5);", values: ["5000 ps", "woke at 5.000 ns"] },
    { name: "repeat (5) @(posedge clk);", values: ["woke at 5.000 ns"] },
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
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
    expect(screen.queryByTestId("global-precision-reveal")).not.toBeInTheDocument();
    expectAbsent(container, ["1fs / 1fs"]);
  });

  it("the comparison opens on that commit, and toggling back does not hide it again", () => {
    render(<TimescaleLab mode="global-precision" />);
    const box = screen.getByLabelText(/Add vendor_model\.sv/);
    fireEvent.click(box);
    lockIn(/is 1fs \/ 1fs/);
    expect(screen.getByRole("columnheader", { name: "Changed?" })).toBeInTheDocument();
    fireEvent.click(box);
    expect(screen.queryByTestId("global-precision-reveal")).not.toBeInTheDocument();
    lockIn(/is 100ps \/ 100ps/);
    expect(screen.getByRole("columnheader", { name: /With `timescale/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Changed?" })).toBeInTheDocument();
  });

  it("revealing without predicting opens the comparison too", () => {
    render(<TimescaleLab mode="global-precision" />);
    fireEvent.click(screen.getByLabelText(/Add vendor_model\.sv/));
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
    expect(code()).toHaveTextContent("always #0.5 clk = ~clk;");
    expect(code()).toHaveTextContent("period 1 ns");
    skip();
    expect(currentLine()).toContain("repeat (5) @(posedge clk);");
    next();
    expect(currentLine()).toContain("$display");
  });

  it("wait_t(5ns) and wait_t(1.5ns) execute the task's own lines, each with its own intent", () => {
    render(<TimescaleLab mode="cross-scope" />);
    skip();
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
    expect(screen.getByTestId("crossing-chip").className).toContain("transition-[left]");
    first.unmount();
    mock(true);
    render(<TimescaleLab mode="cross-scope" />);
    skip();
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
    },
    "cross-scope": () => {
      skip();
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
    for (const p of READ_TIME_PRESETS) {
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

  it("F2D's second moment, near the right edge, ends at the marker; a small value starts at it", () => {
    const { unmount } = render(<TimescaleLab mode="read-time" preset="f2d-printing-time" />);
    revealEveryMoment();
    fireEvent.change(screen.getByRole("slider", { name: "Moment" }), { target: { value: "1" } });
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
  it("an answered moment keeps asking about the argument the verdict refers to", () => {
    render(<TimescaleLab mode="read-time" />);
    lockIn(/^\$time=2 \$realtime=1\.6 %0t=16$/);
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent("%0t of $realtime show?");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "%t argument" })).getByRole("radio", { name: "%t of $time" }));
    expect(screen.getByTestId("reveal-heading")).toHaveTextContent("%0t of $realtime show?");
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.getByRole("group", { name: /%0t of \$time show\?/ })).toBeInTheDocument();
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
