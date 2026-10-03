import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CovergroupBuilder } from "@/components/visuals/CovergroupBuilder";

const choose = (label: RegExp | string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
};
const preset = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const code = () => screen.getByRole("list", { name: "Generated covergroup" }).textContent ?? "";

describe("CovergroupBuilder · bins", () => {
  it("asks where 13 lands before revealing it, and diagnoses 'bin high' (illegal takes precedence)", () => {
    render(<CovergroupBuilder />);
    expect(screen.getByText(/Which bin does the value 13 land in\?/)).toBeInTheDocument();
    expect(screen.queryByText(/Check it on the value map/)).not.toBeInTheDocument();
    choose("Bin high");
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(/high lists 13, but illegal_bins also lists it/)).toBeInTheDocument();
    expect(screen.getByText(/A run-time error from illegal_bins bad; no bin counts it/)).toBeInTheDocument();
  });

  it("does not claim an illegal hit terminates the simulation", () => {
    render(<CovergroupBuilder />);
    choose("The simulation terminates immediately");
    expect(screen.getByText(/depends on the tool's error-limit settings/)).toBeInTheDocument();
    expect(screen.queryByText(/Simulation terminated|SIMULATION FATAL/i)).not.toBeInTheDocument();
  });

  it("a value outside every bin with no default is not counted — there is no implicit default bin", () => {
    render(<CovergroupBuilder />);
    preset("explicit ranges");
    expect(screen.getByText(/Which bin does the value 9 land in\?/)).toBeInTheDocument();
    choose("An implicit default bin catches it");
    expect(screen.getByText(/Without bins others = default, a value outside every bin is simply not counted/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sample 9: in no bin: not counted" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sample 9: in no bin: not counted" }));
    expect(screen.getByText(/cp_data: 0 \/ 6 counted bins = 0%/)).toBeInTheDocument();
    expect(screen.getByText(/^Last sample 9:/)).toHaveTextContent(/no default bin, so the sample is simply not counted/);
  });

  it("sampling an illegal value reports an error and later samples still count", () => {
    render(<CovergroupBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /^Sample 13: illegal_bins bad/ }));
    expect(screen.getByText(/✕ Error: illegal_bins cp_data\.bad hit by data = 13/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Sample 12:/ }));
    expect(screen.getByText(/✓ covered \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/cp_data: 1 \/ 2 counted bins = 50%/)).toBeInTheDocument();
  });

  it("value cells are keyboard operable", async () => {
    const user = userEvent.setup();
    render(<CovergroupBuilder />);
    const two = screen.getByRole("button", { name: /^Sample 2: counted in low/ });
    two.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(screen.getByText(/✓ covered \(2\)/)).toBeInTheDocument();
  });

  it("fixed-count arrays put the remainder in the last bin: 9 lands in q[2]", () => {
    render(<CovergroupBuilder />);
    preset("[N] fixed arrays");
    choose("Bin q[2]");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("overlapping wildcard bins both count 12", () => {
    render(<CovergroupBuilder />);
    preset("wildcard");
    choose("Both upper and even[12]");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(code()).toContain("wildcard bins upper = {4'b11??};");
  });

  it("transition bins depend on the previous sample: 15 then 0 completes wrap", () => {
    render(<CovergroupBuilder />);
    preset("transitions");
    expect(screen.getByText(/After sampling 15, the next call is cg.sample\(0\)/)).toBeInTheDocument();
    choose("Bin rise");
    expect(screen.getByText(/rise counts the sequence \(0 => 1 => 2\)/)).toBeInTheDocument();
    expect(screen.getByText("Bin wrap")).toBeInTheDocument();
  });

  it("automatic bins use option.auto_bin_max (an instance option) and give the last bin the remainder", () => {
    render(<CovergroupBuilder />);
    preset("automatic bins");
    expect(code()).toContain("option.auto_bin_max = 3;");
    expect(code()).not.toContain("type_option");
    choose("Bin auto[10:15]");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
  });

  it("flags an invalid range, leaves the row out of the generated code and re-asks the prediction", () => {
    render(<CovergroupBuilder />);
    choose("Bin high");
    fireEvent.change(screen.getByRole("textbox", { name: "Bin 1 values" }), { target: { value: "[5:2]" } });
    expect(screen.getByText(/is empty: write the low bound first/)).toBeInTheDocument();
    expect(code()).not.toContain("bins low");
    expect(screen.getByRole("button", { name: /lock in prediction/i })).toBeDisabled();
  });
});

describe("CovergroupBuilder · sampling", () => {
  it("predicts the hit count per sampling style and exposes double sampling as false closure", () => {
    render(<CovergroupBuilder initialTab="sampling" />);
    expect(screen.getByText(/how many times does bin high increment/)).toBeInTheDocument();
    choose("6 times");
    expect(screen.getByText(/That is the count for @\(posedge clk\), no iff/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Honest number/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "@(posedge clk) + sample()" }));
    choose("2 times");
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/✕ False closure/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Covergroup and sampling code" }).textContent).toContain("@(posedge clk) if (valid) cov.sample();");
  });
});
