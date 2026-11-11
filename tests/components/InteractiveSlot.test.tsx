import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INTERACTIVE_FAILED_TEXT,
  INTERACTIVE_LOADING_TEXT,
  INTERACTIVE_STATE_CLASS,
  InteractiveBoundary,
  InteractivePlaceholder,
} from "@/components/mdx/InteractiveBoundary";
import { createLazyComponentCache, InteractiveSlot, type InteractiveModule } from "@/components/mdx/InteractiveSlot";
import { readServerMarkup, SNAPSHOT_SLOT_ATTRIBUTE } from "@/components/mdx/server-markup-snapshot";
import {
  DEFAULT_INTERACTIVE_HEIGHT,
  interactiveTitleFromName,
  lazyMdxInteractiveMeta,
  lazyMdxInteractiveNames,
  lazyMdxInteractivePlaceholder,
  interactiveComponentProps,
  MID_BAND,
  PLACEHOLDER_HEIGHT_PROP,
  PLACEHOLDER_MID_HEIGHT_PROP,
  PLACEHOLDER_MOBILE_HEIGHT_PROP,
} from "@/components/mdx/lazy-mdx-interactives";
import { lazyMdxSlotProps } from "@/components/mdx/LazyMdxInteractive";

const Demo = ({ label }: { label?: string }) => <p>Demo ready {label}</p>;
const demoModule: InteractiveModule = { default: Demo as never };

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("InteractiveSlot", () => {
  it("shows the error state when the import fails, and Retry loads it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = vi
      .fn<() => Promise<InteractiveModule>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError: Loading chunk 42 failed"))
      .mockResolvedValue(demoModule);
    const cache = createLazyComponentCache({ Demo: loader });

    render(
      <InteractiveSlot name="Demo" title="Demo explorer" height={420} cache={cache} componentProps={{ label: "now" }} />,
    );

    // While the import is pending: a placeholder that carries the title and reserves the height.
    const placeholder = document.querySelector<HTMLElement>("[data-interactive-placeholder]")!;
    expect(placeholder).toHaveAttribute("aria-busy", "true");
    // Not a live region: five placeholders must not announce "Loading" five times.
    expect(screen.queryByRole("status")).toBeNull();
    expect(placeholder).toHaveTextContent("Demo explorer");
    expect(placeholder).toHaveTextContent(INTERACTIVE_LOADING_TEXT);
    expect(placeholder.style.getPropertyValue("--interactive-height")).toBe("420px");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(INTERACTIVE_FAILED_TEXT);
    expect(alert).toHaveTextContent("Demo explorer");
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Demo ready now")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares one lazy component per name until it is reset", () => {
    const cache = createLazyComponentCache({ Demo: () => Promise.resolve(demoModule) });
    const first = cache.get("Demo");
    expect(cache.get("Demo")).toBe(first);
    cache.reset("Demo");
    expect(cache.get("Demo")).not.toBe(first);
  });

  it("marks its wrapper for the server-markup snapshot without adding a box", () => {
    const cache = createLazyComponentCache({ Demo: () => new Promise<InteractiveModule>(() => {}) });
    const { container } = render(<InteractiveSlot name="Demo" title="Demo" height={300} cache={cache} componentProps={{}} />);
    const slot = container.querySelector("[data-mdx-interactive='Demo']");
    expect(slot).toHaveClass("contents");
    expect(slot?.getAttribute(SNAPSHOT_SLOT_ATTRIBUTE)).toBeTruthy();
  });
});

describe("InteractiveBoundary", () => {
  it("catches a render error and renders the children again on Retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    const Flaky = () => {
      if (fail) throw new Error("boom");
      return <p>Recovered</p>;
    };
    const onRetry = vi.fn(() => {
      fail = false;
    });
    render(
      <InteractiveBoundary title="Flaky model" onRetry={onRetry}>
        <Flaky />
      </InteractiveBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This interactive failed to load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("uses the secondary button, not an accent fill", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("boom");
    };
    render(
      <InteractiveBoundary title="Broken">
        <Broken />
      </InteractiveBoundary>,
    );
    expect(screen.getByRole("button", { name: "Retry" }).className).not.toMatch(/bg-primary/);
  });
});

describe("InteractivePlaceholder", () => {
  it("reserves the phone height and the wider height separately", () => {
    render(<InteractivePlaceholder title="Fork join visualizer" height={500} mobileHeight={820} />);
    const box = document.querySelector<HTMLElement>("[data-interactive-placeholder]")!;
    expect(box).not.toHaveAttribute("role");
    expect(box.style.getPropertyValue("--interactive-height")).toBe("500px");
    expect(box.style.getPropertyValue("--interactive-height-sm")).toBe("820px");
    expect(box).toHaveClass("min-h-[var(--interactive-height-sm)]", "sm:min-h-[var(--interactive-height)]");
    // No mid-band height given: the 640 px-up height holds from 1024 to 1279 px too.
    expect(box.style.getPropertyValue("--interactive-height-md")).toBe("500px");
  });

  it("reserves the 1024 to 1279 px height in its own band", () => {
    render(<InteractivePlaceholder title="Timescale lab" height={730} midHeight={860} mobileHeight={900} />);
    const box = document.querySelector<HTMLElement>("[data-interactive-placeholder]")!;
    expect(box.style.getPropertyValue("--interactive-height-md")).toBe("860px");
    expect(box).toHaveClass("lg:max-xl:min-h-[var(--interactive-height-md)]");
  });

  it("draws the same liquid glass frame as VisualFrame, in loading and in error", () => {
    render(<InteractivePlaceholder title="Timescale lab" height={730} />);
    expect(document.querySelector("[data-interactive-placeholder]")).toHaveClass("glass-liquid", "p-3", "sm:p-4", "md:p-6");
    expect(INTERACTIVE_STATE_CLASS).not.toMatch(/bg-card|rounded-xl/);
  });
});

describe("InteractiveSlot passes the mid-band height to its placeholder", () => {
  it("on a client render with no server HTML", () => {
    const cache = createLazyComponentCache({ Slow: () => new Promise<InteractiveModule>(() => {}) });
    render(<InteractiveSlot name="Slow" title="Slow" height={400} midHeight={520} mobileHeight={600} cache={cache} componentProps={{}} />);
    const box = document.querySelector<HTMLElement>("[data-interactive-placeholder]")!;
    expect(box.style.getPropertyValue("--interactive-height-md")).toBe("520px");
  });
});

describe("readServerMarkup", () => {
  const slot = (id: string, name: string, html: string) => {
    const element = document.createElement("div");
    element.setAttribute(SNAPSHOT_SLOT_ATTRIBUTE, id);
    element.setAttribute("data-mdx-interactive", name);
    element.innerHTML = html;
    document.body.appendChild(element);
    return element;
  };

  it("returns the slot's server HTML", () => {
    slot(":R1:", "Demo", '<!--$--><section class="my-8">Model</section><!--/$-->');
    expect(readServerMarkup(":R1:", "Demo")).toContain('<section class="my-8">Model</section>');
  });

  it("returns null for another interactive, a missing slot or streamed content still pending", () => {
    slot(":R2:", "Other", "<section>Other</section>");
    expect(readServerMarkup(":R2:", "Demo")).toBeNull();
    expect(readServerMarkup(":R9:", "Demo")).toBeNull();
    slot(":R3:", "Demo", '<!--$?--><template id="B:0"></template><p>fallback</p>');
    expect(readServerMarkup(":R3:", "Demo")).toBeNull();
  });

  it("ignores a slot that React already owns (a page that hydrated earlier)", () => {
    const element = slot(":R4:", "Demo", "<section>Old page</section>");
    (element as unknown as Record<string, unknown>)["__reactFiber$test"] = {};
    expect(readServerMarkup(":R4:", "Demo")).toBeNull();
  });
});

describe("lazy interactive placeholders", () => {
  it("derives sentence-case titles that keep acronyms and proper nouns", () => {
    expect(interactiveTitleFromName("PssIntentMapVisualizer")).toBe("PSS intent map visualizer");
    expect(interactiveTitleFromName("UVMTreeExplorer")).toBe("UVM tree explorer");
    expect(interactiveTitleFromName("SystemVerilog3DVisualizer")).toBe("SystemVerilog 3D visualizer");
    expect(interactiveTitleFromName("AxiIdOrderingVisualizer")).toBe("AXI ID ordering visualizer");
    expect(interactiveTitleFromName("ConfigDbExplorer")).toBe("Config DB explorer");
  });

  it("prefers the MDX title prop and falls back to the default height", () => {
    const named = lazyMdxInteractivePlaceholder("InterviewQuestionPlayground", {
      title: "Interview: why can't a resource be an input?",
    });
    expect(named.title).toBe("Interview: why can't a resource be an input?");
    const plain = lazyMdxInteractivePlaceholder("DeferredReportVisualizer");
    expect(plain.title).toBe("Deferred report visualizer");
    expect(plain.height).toBe(lazyMdxInteractiveMeta.DeferredReportVisualizer?.height ?? DEFAULT_INTERACTIVE_HEIGHT);
  });

  it("has measured heights only for registered interactives, as positive whole pixels", () => {
    const measured = Object.entries(lazyMdxInteractiveMeta);
    expect(measured.length).toBeGreaterThanOrEqual(10);
    for (const [name, meta] of measured) {
      expect(lazyMdxInteractiveNames).toContain(name);
      for (const value of [meta?.height, meta?.mobileHeight]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it("picks the variant an instance's props open, before the interactive's own height", () => {
    const meta = lazyMdxInteractiveMeta.PolymorphismDispatchVisualizer!;
    const dispatch = lazyMdxInteractivePlaceholder("PolymorphismDispatchVisualizer", { section: "dispatch" });
    const cast = lazyMdxInteractivePlaceholder("PolymorphismDispatchVisualizer", { section: "cast" });
    expect(dispatch).toMatchObject({ height: meta.height, mobileHeight: meta.mobileHeight });
    expect(cast.height).toBeLessThan(dispatch.height);
    expect(cast.mobileHeight).toBeLessThan(dispatch.mobileHeight);
    const bug = lazyMdxInteractivePlaceholder("ObjectHandleVisualizer", { mode: "bug" });
    const tour = lazyMdxInteractivePlaceholder("ObjectHandleVisualizer", {
      scenario: "shallow-copy",
      scenarios: ["aliasing", "shallow-copy", "deep-copy", "static-count"],
    });
    expect(bug.height).not.toBe(tour.height);
  });

  it("lets one instance state its own placeholder height, and keeps those props from the interactive", () => {
    const own = lazyMdxInteractivePlaceholder("ObjectHandleVisualizer", {
      mode: "bug",
      [PLACEHOLDER_HEIGHT_PROP]: 640,
      [PLACEHOLDER_MOBILE_HEIGHT_PROP]: "910",
    });
    expect(own).toMatchObject({ height: 640, mobileHeight: 910 });
    expect(lazyMdxInteractivePlaceholder("ScenarioSorter", { [PLACEHOLDER_HEIGHT_PROP]: 700 })).toMatchObject({
      height: 700,
      mobileHeight: 700,
    });
    // Nonsense values fall back to the measured height.
    expect(lazyMdxInteractivePlaceholder("ScenarioSorter", { [PLACEHOLDER_HEIGHT_PROP]: -5 }).height).toBe(
      lazyMdxInteractiveMeta.ScenarioSorter!.height,
    );
    expect(interactiveComponentProps({ mode: "bug", [PLACEHOLDER_HEIGHT_PROP]: 640 })).toEqual({ mode: "bug" });
    const untouched = { mode: "bug" };
    expect(interactiveComponentProps(untouched)).toBe(untouched);
  });

  it("gives every variant whole positive pixel heights", () => {
    for (const meta of Object.values(lazyMdxInteractiveMeta)) {
      for (const variant of meta?.variants ?? []) {
        for (const value of [variant.height, variant.mobileHeight]) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("the 1024 to 1279 px placeholder height", () => {
  it("gives every measured interactive and variant a whole positive mid-band height", () => {
    for (const [name, meta] of Object.entries(lazyMdxInteractiveMeta)) {
      expect(Number.isInteger(meta!.midHeight), name).toBe(true);
      expect(meta!.midHeight! > 0, name).toBe(true);
      for (const variant of meta!.variants ?? []) expect(Number.isInteger(variant.midHeight), name).toBe(true);
    }
    expect(MID_BAND).toEqual({ min: 1024, max: 1279 });
  });

  it("picks the variant's mid height, then the interactive's, then the wider height", () => {
    expect(lazyMdxInteractivePlaceholder("PolymorphismDispatchVisualizer", { section: "cast" }).midHeight).toBe(1010);
    expect(lazyMdxInteractivePlaceholder("InterviewQuestionPlayground").midHeight).toBe(
      lazyMdxInteractiveMeta.InterviewQuestionPlayground!.midHeight,
    );
    // No measured value: the default, like the wider height.
    expect(lazyMdxInteractivePlaceholder("DeferredReportVisualizer").midHeight).toBe(DEFAULT_INTERACTIVE_HEIGHT);
  });

  it("lets one instance state its own mid height, falls back to its own wider height, and keeps the prop from the interactive", () => {
    expect(lazyMdxInteractivePlaceholder("ScenarioSorter", { [PLACEHOLDER_MID_HEIGHT_PROP]: "640" }).midHeight).toBe(640);
    expect(lazyMdxInteractivePlaceholder("ScenarioSorter", { [PLACEHOLDER_HEIGHT_PROP]: 700 }).midHeight).toBe(700);
    expect(interactiveComponentProps({ a: 1, [PLACEHOLDER_MID_HEIGHT_PROP]: 640 })).toEqual({ a: 1 });
  });

  it("hands the slot all three heights", () => {
    const props = lazyMdxSlotProps("ObjectHandleVisualizer", { mode: "bug" });
    expect(props).toMatchObject({ name: "ObjectHandleVisualizer", height: 731, midHeight: 731, mobileHeight: 878 });
    expect(props.componentProps).toEqual({ mode: "bug" });
  });
});
