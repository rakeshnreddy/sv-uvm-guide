import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
vi.stubGlobal("React", React);

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string } & Record<string, unknown>) => {
    const { src, alt, fill: _fill, priority: _priority, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    return <img src={src} alt={alt} {...rest} />;
  },
}));

vi.mock("embla-carousel-react", () => {
  const mockApi = {
    on: vi.fn(),
    off: vi.fn(),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    selectedScrollSnap: () => 0,
  };
  const viewportRef = (_node: HTMLElement | null) => {};
  return {
    __esModule: true,
    default: () => [viewportRef, mockApi],
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

import InteractiveCostOfBugGraph from "@/components/curriculum/f1/InteractiveCostOfBugGraph";
import HallOfShameCarousel from "@/components/curriculum/f1/HallOfShameCarousel";
import VerificationMethodologiesDiagram, { METHODOLOGIES } from "@/components/curriculum/f1/VerificationMethodologiesDiagram";
import DesignGapChart from "@/components/visuals/DesignGapChart";
import VerilogVsSystemVerilog, { COMPARISON } from "@/components/visuals/VerilogVsSystemVerilog";

describe("InteractiveCostOfBugGraph", () => {
  it("gates the cost ladder behind a prediction and diagnoses an underestimate", () => {
    render(<InteractiveCostOfBugGraph />);
    expect(screen.queryByLabelText("Where is the bug found?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/About 2–3× more/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getAllByText(/one order of magnitude per stage/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Where is the bug found?")).toBeInTheDocument();
  });

  it("is operable without a pointer: the slider and stage buttons show the description on change or focus", () => {
    render(<InteractiveCostOfBugGraph />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    const slider = screen.getByRole("slider", { name: "Where is the bug found?" });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/RTL simulation/));
    fireEvent.change(slider, { target: { value: "3" } });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/Post-silicon \(lab\): about ×1,000/));
    expect(screen.getByText(/×100 an RTL-simulation fix/)).toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: /In the field/ }));
    expect(screen.getByText(/Recalls or replacements/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In the field/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("formats the illustrative $100M correctly and labels it as an assumption", () => {
    render(<InteractiveCostOfBugGraph />);
    fireEvent.click(screen.getByRole("button", { name: /reveal without predicting/i }));
    fireEvent.click(screen.getByRole("radio", { name: "$10K" }));
    fireEvent.click(screen.getByRole("button", { name: /In the field/ }));
    expect(screen.getByText("$100M")).toBeInTheDocument();
    expect(screen.queryByText(/\$1\.0B/)).not.toBeInTheDocument();
    expect(screen.getByText(/Commonly cited escalation; actual costs vary by product and node/)).toBeInTheDocument();
  });
});

describe("HallOfShameCarousel", () => {
  it("renders incident details inside a labelled carousel with current-slide state", () => {
    render(
      <HallOfShameCarousel
        items={[
          {
            image: "/visuals/example.svg",
            title: "Example Bug",
            story: "A notorious issue that forced a costly respin.",
            impact: "Large payout and public apology.",
          },
          {
            image: "/visuals/example2.svg",
            title: "Second Bug",
            story: "Another issue.",
            impact: "Delay.",
          },
        ]}
      />,
    );
    expect(screen.getByText("The Hall of Shame")).toBeInTheDocument();
    expect(screen.getByText("Example Bug")).toBeInTheDocument();
    expect(screen.getByText("Large payout and public apology.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Hall of Shame/ })).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getByRole("button", { name: /Go to incident 1: Example Bug/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Go to incident 2: Second Bug/ })).not.toHaveAttribute("aria-current");
  });
});

describe("VerificationMethodologiesDiagram", () => {
  it("places emulation at the RTL stage (it runs synthesized RTL), not at the netlist", () => {
    expect(METHODOLOGIES.find((m) => m.id === "emulation")?.stage).toBe("rtl");
    render(<VerificationMethodologiesDiagram />);
    fireEvent.click(screen.getByRole("button", { name: /Emulation \/ FPGA prototyping/ }));
    const stages = screen.getByRole("list", { name: "Design flow stages" });
    const current = within(stages)
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent(/^\s*2\.\s*RTL/);
    expect(current).toHaveTextContent(/Emulation \/ FPGA prototyping runs here/);
  });

  it("never autoplays, and the learner can play and pause the tour", () => {
    vi.useFakeTimers();
    render(<VerificationMethodologiesDiagram />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("button", { name: /Formal property verification/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(screen.getByRole("button", { name: /RTL simulation/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("button", { name: /RTL simulation/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("supports keyboard stepping inside the playback group", () => {
    render(<VerificationMethodologiesDiagram />);
    const group = screen.getByRole("group", { name: /Method playback controls/ });
    fireEvent.keyDown(within(group).getByRole("button", { name: /next method/i }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /RTL simulation/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("checks transfer: booting an OS before tape-out needs emulation", () => {
    render(<VerificationMethodologiesDiagram />);
    fireEvent.click(screen.getByLabelText("Post-silicon validation in the lab"));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/only exist after tape-out/)).toBeInTheDocument();
  });
});

describe("DesignGapChart", () => {
  it("has an accessible title and description, labelled axes, an illustrative label, and no numbers", () => {
    render(<DesignGapChart />);
    const chart = screen.getByRole("img", { name: /Illustration: design complexity versus verification capability/ });
    expect(chart).toHaveAccessibleDescription(/Illustrative shape, not data/);
    expect(within(chart).getByText(/Time \(process generations\)/)).toBeInTheDocument();
    expect(within(chart).getByText(/Capability \(no scale\)/)).toBeInTheDocument();
    expect(within(chart).getByText("Illustrative")).toBeInTheDocument();
    expect(chart.textContent).not.toMatch(/\d/);
    expect(screen.getByText("Design vs. Verification")).toBeInTheDocument();
  });
});

describe("VerilogVsSystemVerilog", () => {
  it("does not claim that all Verilog is valid SystemVerilog, and explains `begin_keywords", () => {
    render(<VerilogVsSystemVerilog />);
    expect(screen.queryByText(/All Verilog code is valid SystemVerilog/)).not.toBeInTheDocument();
    expect(screen.getByText(/not a drop-in superset/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/It compiles\. SystemVerilog accepts all Verilog code/));
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }));
    expect(screen.getByText(/This is the common myth/)).toBeInTheDocument();
    expect(screen.getByText(/OK: not a keyword in 1364-2001/)).toBeInTheDocument();
  });

  it("shows a complete class snippet (with endfunction) on the OOP tab", () => {
    expect(COMPARISON.oop.sv.code).toMatch(/function void print\(\);[\s\S]*endfunction[\s\S]*endclass/);
    render(<VerilogVsSystemVerilog />);
    const oop = screen.getByRole("button", { name: "Object Oriented Programming" });
    fireEvent.click(oop);
    expect(oop).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Full OOP support: Classes, Inheritance/)).toBeInTheDocument();
    expect(screen.getByText(/endfunction/)).toBeInTheDocument();
  });
});
