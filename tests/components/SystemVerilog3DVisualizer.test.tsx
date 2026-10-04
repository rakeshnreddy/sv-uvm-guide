import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {}, gl: {} })),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Text: () => null,
  Grid: () => null,
}));

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return { ...actual, MeshStandardMaterial: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })) };
});

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";

const ops = () => within(screen.getByRole("group", { name: "Operations" }));

function enableWebGL() {
  (window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {};
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({})) as unknown as HTMLCanvasElement["getContext"]);
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).WebGLRenderingContext;
  vi.restoreAllMocks();
  replace.mockClear();
});

describe("SystemVerilog3DVisualizer", () => {
  it("falls back to the 2D view and disables 3D when WebGL is unavailable", () => {
    render(<SystemVerilog3DVisualizer />);
    expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "3D" })).toBeDisabled();
    expect(screen.getByText(/3D needs WebGL/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^dyn_array:/ }).getAttribute("aria-label")).toBe("dyn_array: [0] 10, [1] 20, [2] 30");
  });

  it("renders the 3D canvas with a text summary when WebGL is available, and the 2D view on request", () => {
    enableWebGL();
    render(<SystemVerilog3DVisualizer height="500px" />);
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
    const viewport = screen.getByTestId("sv-3d-viewport");
    expect(viewport.style.height).toBe("500px");
    expect(viewport.getAttribute("aria-label")).toMatch(/dyn_array: 10, 20, 30/);
    fireEvent.click(screen.getByRole("radio", { name: "2D / text" }));
    expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
  });

  it("§7.5.1: new[N] default-initializes int elements to 0 (not 1..N)", () => {
    render(<SystemVerilog3DVisualizer />);
    fireEvent.click(ops().getByRole("button", { name: /^dyn_array = new\[6\]$/ }));
    expect(screen.getByRole("group", { name: /^dyn_array:/ }).getAttribute("aria-label")).toBe("dyn_array: [0] 0, [1] 0, [2] 0, [3] 0, [4] 0, [5] 0");
    expect(screen.getByText(/is destructive/)).toBeInTheDocument();
  });

  it("§7.8.2: associative keys appear in character-code order (uppercase first)", () => {
    render(<SystemVerilog3DVisualizer initialScene="associative" syncSceneToUrl={false} />);
    const strip = screen.getByRole("group", { name: /^aa in index order/ });
    expect(strip.getAttribute("aria-label")).toBe('aa in index order: "Cherry" = 3, "apple" = 5, "banana" = 8');
    expect(replace).not.toHaveBeenCalled();
  });

  it("§7.4.4: the packed/unpacked view explains the reference order and finds a bit", () => {
    render(<SystemVerilog3DVisualizer initialScene="packed-matrix" />);
    expect(screen.getByText(/rightmost index varies fastest, and every packed dimension varies faster/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Unpacked index 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Packed index 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Find bit" }));
    expect(screen.getByText(/Highlighted logical bit 6: my_array\[1\]\[2\]/)).toBeInTheDocument();
    expect(screen.getByLabelText(/my_array\[1\]\[2\], logical bit 6, highlighted/)).toBeInTheDocument();
  });

  it("keyboard: arrow keys switch structures and sync the scene to the URL", () => {
    render(<SystemVerilog3DVisualizer />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Dynamic array" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true");
    expect(replace).toHaveBeenCalledWith("?scene=queue", { scroll: false });
  });
});
