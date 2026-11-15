import React from "react";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { camera: {}, gl: {}, size: { width: 358, height: 260 }, invalidate: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Text: () => null,
  // Html labels render in place, carrying their scene position so tests can check where a label sits.
  Html: ({ children, position }: { children: React.ReactNode; position?: number[] }) => <div data-position={JSON.stringify(position)}>{children}</div>,
  Grid: () => null,
}));

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  // A plain class, so vi.restoreAllMocks() between tests cannot strip dispose().
  class MeshStandardMaterial {
    dispose() {}
  }
  return { ...actual, MeshStandardMaterial };
});

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";
import * as THREE from "three";
import {
  CAMERA_DIR,
  CAMERA_FOV,
  CUBE_DEPTH,
  CUBE_WIDTH,
  MEM_BLOCK_CASES,
  MEM_BLOCK_GOAL,
  MemBlockCanvasContents,
  ROW_PITCH,
  cubeSpot,
  drawerBits,
  drawerY,
  fitCameraDistance,
  ghostY,
  isDimmed,
  laneAxisText,
  laneBits,
  laneReadMarker,
  lanesRead,
  litLabelText,
  memBlockBounds,
  memBlockLiveText,
  memBlockResultText,
  memBlockSummary,
  memBlockTarget,
  memLanes,
  memOutlineBox,
  memReadSet,
  useMemBlockFrame,
} from "@/components/curriculum/f2/MemBlockScene";
import { SELECT_KIND_LABELS, evaluateCase, formatBits, lessonDecl, memByte, orderedOptions, selectOptions, wordBits } from "@/lib/sv-array-select-model";

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

// ---- Memory block scene: logic [3:0][7:0] mem [16] ----------------------------

const memCase = (id: string) => MEM_BLOCK_CASES.find((c) => c.id === id)!;
const renderMem = (props: Record<string, unknown> = {}) => render(<SystemVerilog3DVisualizer initialScene="mem-block" syncSceneToUrl={false} {...props} />);
const memTable = () => within(screen.getByTestId("mem-block-table"));
const chip = (expr: string) => screen.getByRole("radio", { name: expr });

/** Picks the model's correct option for that case and type, then locks it in. */
function predict(id: string, state: "logic" | "bit" = "logic") {
  const option = selectOptions(memCase(id), state).find((o) => o.correct)!;
  fireEvent.click(screen.getByRole("radio", { name: option.label }));
  fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
  return option;
}

describe("Memory block scene (mem-block)", () => {
  it("offers the five select chips as buttons, computed from the model", () => {
    renderMem();
    const group = screen.getByRole("radiogroup", { name: "Select expression" });
    const labels = within(group).getAllByRole("radio").map((b) => b.textContent);
    expect(labels).toEqual(["mem[5]", "mem[5][2]", "mem[5][2][3]", "mem[16]", "mem[i]"]);
    within(group).getAllByRole("radio").forEach((b) => expect(b.tagName).toBe("BUTTON"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("Given: mem[i][j] = 8'((i << 4) | j), and the text view holds those bytes in rows by lanes", () => {
    renderMem();
    expect(screen.getByText("logic [3:0][7:0] mem [16];")).toBeInTheDocument();
    const rows = memTable().getAllByRole("row");
    expect(rows).toHaveLength(1 + 16);
    const row5 = within(memTable().getByRole("rowheader", { name: "mem[5]" }).closest("tr")!);
    // Lanes are drawn [3], [2], [1], [0]: most significant first.
    expect(row5.getAllByRole("cell").map((c) => c.textContent)).toEqual([3, 2, 1, 0].map((j) => formatBits(wordBits(memByte(5, j), 8))));
    expect(row5.getAllByRole("cell").map((c) => c.textContent)).toEqual(["8'h53", "8'h52", "8'h51", "8'h50"]);
    // Every row, including mem[8]..mem[15] whose top bit is set.
    for (let i = 0; i < 16; i += 1) {
      const row = within(memTable().getByRole("rowheader", { name: `mem[${i}]` }).closest("tr")!);
      expect(row.getAllByRole("cell").map((c) => c.textContent)).toEqual([3, 2, 1, 0].map((j) => formatBits(wordBits(memByte(i, j), 8))));
    }
  });

  it("predict first: nothing is lit and no value is shown until the prediction is locked in", () => {
    renderMem();
    expect(screen.queryByTestId("mem-block-reveal")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(read\)/)).not.toBeInTheDocument();
    // Before the reveal the lane headers give bit ranges, not lane indices, so mem[5][2] is not answered by the table.
    expect(memTable().getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Drawer", "31:24", "23:16", "15:8", "7:0"]);
    expect(screen.getByTestId("mem-block-live")).toHaveTextContent("Predict what mem[5] reads.");
  });

  it("§7.4.4: mem[5] names the whole drawer, a 32-bit packed word, and lights all four lanes", () => {
    renderMem();
    const right = predict("mem5");
    expect(right.label).toBe("32'h5352_5150 · packed vector");
    expect(screen.getByText(/^Correct\./)).toBeInTheDocument();
    expect(screen.getByTestId("mem-block-value")).toHaveTextContent("32'h5352_5150");
    expect(screen.getByTestId("mem-block-kind")).toHaveTextContent(SELECT_KIND_LABELS.packed);
    expect(screen.getByText("logic [3:0][7:0]")).toBeInTheDocument();
    expect(memTable().getAllByText("(read)")).toHaveLength(4);
    expect(memTable().getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Drawer", "[3]", "[2]", "[1]", "[0]"]);
    expect(screen.getByTestId("mem-block-live")).toHaveTextContent("Revealed: mem[5] reads 32'h5352_5150, packed vector.");
  });

  it("§7.4.4: mem[5][2] is lane [2] of drawer 5 (the declared index, not a position from the left): one byte", async () => {
    renderMem();
    fireEvent.click(chip("mem[5][2]"));
    predict("mem5_2");
    expect(screen.getByTestId("mem-block-value")).toHaveTextContent("8'h52");
    expect(screen.getByText("logic [7:0]")).toBeInTheDocument();
    const lit = memTable().getAllByText("(read)");
    expect(lit).toHaveLength(1);
    expect(lit[0].closest("td")).toHaveTextContent("8'h52");
  });

  it("§7.4.4: mem[5][2][3] is one bit, bit 19 of mem[5] (2×8 + 3)", () => {
    renderMem();
    fireEvent.click(chip("mem[5][2][3]"));
    const right = predict("mem5_2_3");
    expect(right.label).toBe("bit 19 of mem[5] = 1'b0 · single bit");
    expect(screen.getByTestId("mem-block-kind")).toHaveTextContent(SELECT_KIND_LABELS.bit);
    expect(screen.getByText("2×8 + 3 = 19")).toBeInTheDocument();
  });

  it("a wrong prediction gets the model's feedback that names the misreading", () => {
    renderMem();
    fireEvent.click(chip("mem[5][2]"));
    const wrong = selectOptions(memCase("mem5_2"), "logic").find((o) => o.id === "from-left")!;
    fireEvent.click(screen.getByRole("radio", { name: wrong.label }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
    expect(screen.getByText(/^Not quite\./)).toBeInTheDocument();
    expect(screen.getByText(wrong.feedback)).toBeInTheDocument();
  });

  it("§7.4.5, Table 7-1: mem[16] is an invalid index into [0:15] and reads 'x for logic; a dashed ghost row shows it", () => {
    renderMem({ initialMemCase: "mem16" });
    predict("mem16");
    const r = evaluateCase(memCase("mem16"), "logic");
    expect(screen.getByTestId("mem-block-value")).toHaveTextContent(r.valueText);
    expect(r.valueText).toBe("32'hxxxx_xxxx");
    expect(screen.getByTestId("mem-block-kind")).toHaveTextContent(SELECT_KIND_LABELS.invalid);
    const ghost = within(screen.getByTestId("mem-block-ghost-row"));
    expect(ghost.getByRole("rowheader")).toHaveTextContent("mem[16]");
    expect(ghost.getAllByRole("cell").map((c) => c.textContent)).toEqual(["8'hxx", "8'hxx", "8'hxx", "8'hxx"]);
    expect(screen.queryByText("(read)")).not.toBeInTheDocument();
    expect(screen.getByText(/the index is outside \[0:15\]/)).toBeInTheDocument();
  });

  it("§7.4.5, Table 7-1: the logic/bit toggle shows an invalid read as 'x versus '0, and resets the prediction", () => {
    renderMem({ initialMemCase: "mem16" });
    predict("mem16");
    fireEvent.click(screen.getByRole("radio", { name: "bit, 2-state" }));
    expect(screen.queryByTestId("mem-block-reveal")).not.toBeInTheDocument();
    predict("mem16", "bit");
    expect(screen.getByTestId("mem-block-value")).toHaveTextContent("32'h0000_0000");
    expect(screen.getByText("bit [3:0][7:0] mem [16];")).toBeInTheDocument();
  });

  it("§7.4.5: mem[i] with i = 'x is invalid (x bits in the index) and reads 'x; the tool may warn", () => {
    renderMem({ initialMemCase: "memi" });
    expect(screen.getByText("i holds 'x")).toBeInTheDocument();
    predict("memi");
    expect(screen.getByTestId("mem-block-value")).toHaveTextContent("32'hxxxx_xxxx");
    expect(screen.getByText(/the index has x bits/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Implementations may issue a warning for an invalid index (§7.4.5).");
  });

  it("keyboard: arrow keys move between chips", () => {
    renderMem();
    fireEvent.keyDown(chip("mem[5]"), { key: "ArrowRight" });
    expect(chip("mem[5][2]")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("mem-block-live")).toHaveTextContent("Predict what mem[5][2] reads.");
  });

  it("3D: the canvas is described in text, shrinks to 260 px on phones, and its summary does not answer before the reveal", () => {
    enableWebGL();
    renderMem({ height: 480 });
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
    const viewport = screen.getByTestId("mem-block-viewport");
    expect(viewport).toHaveClass("h-[260px]");
    expect(viewport.style.getPropertyValue("--mem-block-h")).toBe("480px");
    expect(viewport.getAttribute("aria-label")).toBe(memBlockSummary(lessonDecl("mem"), evaluateCase(memCase("mem5"), "logic"), false));
    expect(viewport.getAttribute("aria-label")).not.toMatch(/5352/);
    // The text view stays on screen beside the canvas.
    expect(screen.getByTestId("mem-block-table")).toBeInTheDocument();
    predict("mem5");
    expect(viewport.getAttribute("aria-label")).toMatch(/mem\[5\] lights up the whole drawer mem\[5\], a slab: it reads 32'h5352_5150, packed vector\./);
  });

  it("2D / text view drops the canvas and keeps the same table", () => {
    enableWebGL();
    renderMem();
    fireEvent.click(screen.getByRole("radio", { name: "2D / text" }));
    expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("mem-block-table")).toBeInTheDocument();
  });

  it("deep link: choosing the memory block from the structure control syncs ?scene=mem-block", () => {
    render(<SystemVerilog3DVisualizer />);
    fireEvent.click(screen.getByRole("radio", { name: "Memory block" }));
    expect(replace).toHaveBeenCalledWith("?scene=mem-block", { scroll: false });
    expect(screen.getByTestId("mem-block-scene")).toBeInTheDocument();
  });
});

describe("Memory block layout helpers", () => {
  const decl = lessonDecl("mem");

  it("§7.4.4: lanes of [3:0][7:0] run [3] to [0], lane j holding bits 8j+7 to 8j", () => {
    expect(memLanes(decl)).toEqual([
      { index: 3, lo: 24, hi: 31 },
      { index: 2, lo: 16, hi: 23 },
      { index: 1, lo: 8, hi: 15 },
      { index: 0, lo: 0, hi: 7 },
    ]);
    expect(formatBits(laneBits(wordBits(0x53525150, 32), memLanes(decl)[1]))).toBe("8'h52");
  });

  it("lights nothing before the reveal, and exactly the model's bits after it", () => {
    const r = evaluateCase(memCase("mem5_2_3"), "logic");
    expect(memReadSet(r, false)).toEqual({ drawer: null, bits: new Set(), ghost: null });
    const read = memReadSet(r, true);
    expect(read.drawer).toBe(5);
    expect(Array.from(read.bits)).toEqual([19]);
  });

  it("§7.4.5: an invalid unpacked index lights no drawer and carries the Table 7-1 word as a ghost", () => {
    const read = memReadSet(evaluateCase(memCase("memi"), "bit"), true);
    expect(read.drawer).toBeNull();
    expect(read.ghost?.reason).toBe("x-index");
    expect(read.ghost?.bits.every((b) => b === "0")).toBe(true);
    const r16 = memReadSet(evaluateCase(memCase("mem16"), "logic"), true);
    expect(r16.drawer).toBeNull();
    expect(r16.bits.size).toBe(0);
    expect(r16.ghost?.reason).toBe("out-of-bounds");
    expect(r16.ghost?.bits).toHaveLength(32);
    expect(r16.ghost?.bits.every((b) => b === "x")).toBe(true);
  });

  it("the 3D summary names what lit up for a lane, a bit and a ghost, and says x bits are flat rose tiles", () => {
    const sum = (id: string, state: "logic" | "bit" = "logic") => memBlockSummary(lessonDecl("mem", state), evaluateCase(memCase(id), state), true);
    expect(sum("mem5_2")).toMatch(/mem\[5\]\[2\] lights up lane \[2\] of mem\[5\], a row of 8 cubes: it reads 8'h52, /);
    expect(sum("mem5_2_3")).toMatch(/mem\[5\]\[2\]\[3\] lights up one cube, bit 19 of mem\[5\]: it reads 1'b0, /);
    expect(sum("mem16")).toMatch(/mem\[16\] names no drawer, so nothing in the block lights up; a ghost drawer outside the block shows the value read, 32'hxxxx_xxxx, its x bits drawn as flat rose tiles\./);
    expect(sum("mem16", "bit")).toMatch(/shows the value read, 32'h0000_0000\.$/);
  });

  it("laneReadMarker: a whole lane is (read); part of a lane names its bits", () => {
    const [l3, l2] = memLanes(decl);
    const r = (id: string) => memReadSet(evaluateCase(memCase(id), "logic"), true);
    expect(laneReadMarker(r("mem5"), l3)).toBe("(read)");
    expect(laneReadMarker(r("mem5_2"), l2)).toBe("(read)");
    expect(laneReadMarker(r("mem5_2"), l3)).toBeNull();
    expect(laneReadMarker(r("mem5_2_3"), l2)).toBe("(bit 19 read)");
    expect(memBlockLiveText(decl, evaluateCase(memCase("mem5_2"), "logic"), true)).toBe("Revealed: mem[5][2] reads 8'h52, packed vector.");
    expect(memBlockLiveText(decl, evaluateCase(memCase("mem5_2"), "logic"), false)).toBe("Predict what mem[5][2] reads.");
  });

  it("the camera frame keeps the same object across the logic/bit toggle, so the orbit is not reset", () => {
    const { result, rerender } = renderHook(({ state }: { state: "logic" | "bit" }) => useMemBlockFrame(lessonDecl("mem", state)), { initialProps: { state: "logic" as "logic" | "bit" } });
    const first = result.current;
    rerender({ state: "bit" });
    expect(result.current).toBe(first);
    expect(first.target).toEqual(memBlockTarget(memBlockBounds(decl)));
  });
});

describe("Memory block 3D layout", () => {
  const decl = lessonDecl("mem");
  const read = (id: string, state: "logic" | "bit" = "logic") => memReadSet(evaluateCase(memCase(id), state), true);

  it("§7.4.1: a drawer is a slab of 4 touching lanes; lane [3] at the back, lane [0] at the front, bit 0 of a lane on the right", () => {
    const lanes = memLanes(decl);
    const z = lanes.map((l) => cubeSpot(decl, l.lo).z);
    // Back (most negative z) to front: [3], [2], [1], [0].
    expect(lanes.map((l) => l.index)).toEqual([3, 2, 1, 0]);
    expect(z).toEqual([...z].sort((a, b) => a - b));
    // The lanes touch: their pitch equals the cube depth, so there is no gap between them.
    z.slice(1).forEach((zz, k) => expect(zz - z[k]).toBe(CUBE_DEPTH));
    // Inside a lane: bit 7 on the left, bit 0 on the right, one unit apart.
    const b0 = cubeSpot(decl, 16);
    const b7 = cubeSpot(decl, 23);
    expect(b0).toMatchObject({ lane: 2, bitInLane: 0 });
    expect(b7).toMatchObject({ lane: 2, bitInLane: 7 });
    expect(b0.x).toBeGreaterThan(b7.x);
    expect(b0.x - cubeSpot(decl, 17).x).toBe(1);
    expect(CUBE_WIDTH).toBeLessThan(1);
    // Bit 19 is lane [2], bit 3: the cube mem[5][2][3] lights.
    expect(cubeSpot(decl, 19)).toMatchObject({ lane: 2, bitInLane: 3 });
  });

  it("§7.4.1: the drawers sit a gap apart, mem[0] at the top", () => {
    expect(drawerY(decl, 0)).toBe(0);
    expect(drawerY(decl, 1)).toBe(-ROW_PITCH);
    expect(drawerY(decl, 5) - drawerY(decl, 6)).toBeCloseTo(ROW_PITCH);
    // A cube is 1 tall, so a pitch over 1 leaves a gap.
    expect(ROW_PITCH).toBeGreaterThan(1);
  });

  it("drawerBits gives each drawer's word from the model", () => {
    expect(formatBits(drawerBits(decl, 5))).toBe(formatBits(wordBits(0x53525150, 32)));
    expect(formatBits(drawerBits(decl, 5))).toBe("32'h5352_5150");
  });

  it("lanesRead: mem[5] reads all four lanes, mem[5][2] and mem[5][2][3] read lane [2]", () => {
    expect(lanesRead(decl, read("mem5"))).toEqual([3, 2, 1, 0]);
    expect(lanesRead(decl, read("mem5_2"))).toEqual([2]);
    expect(lanesRead(decl, read("mem5_2_3"))).toEqual([2]);
    expect(lanesRead(decl, read("mem16"))).toEqual([]);
  });

  it("each index removes one dimension: the outline is a slab, then a row of 8, then one cube", () => {
    const pad = (n: number) => expect.closeTo(n, 5);
    const slab = memOutlineBox(decl, read("mem5"), evaluateCase(memCase("mem5"), "logic"))!;
    const row = memOutlineBox(decl, read("mem5_2"), evaluateCase(memCase("mem5_2"), "logic"))!;
    const cube = memOutlineBox(decl, read("mem5_2_3"), evaluateCase(memCase("mem5_2_3"), "logic"))!;
    const extra = slab.size[1] - 1; // the padding on a 1-tall cube
    expect(slab.size).toEqual([pad(8 + extra), pad(1 + extra), pad(4 + extra)]);
    expect(row.size).toEqual([pad(8 + extra), pad(1 + extra), pad(1 + extra)]);
    expect(cube.size).toEqual([pad(1 + extra), pad(1 + extra), pad(1 + extra)]);
    expect(row.center[2]).toBe(cubeSpot(decl, 16).z);
    const s19 = cubeSpot(decl, 19);
    expect(cube.center).toEqual([s19.x, drawerY(decl, 5), s19.z]);
    [slab, row, cube].forEach((b) => {
      expect(b.dashed).toBe(false);
      expect(b.center[1]).toBe(drawerY(decl, 5));
    });
    expect(memOutlineBox(decl, memReadSet(evaluateCase(memCase("mem5"), "logic"), false), evaluateCase(memCase("mem5"), "logic"))).toBeNull();
  });

  it("§7.4.5: the ghost of mem[16] sits one drawer slot past mem[15]; the ghost of mem[i] with i = 'x floats above mem[0]", () => {
    const r16 = evaluateCase(memCase("mem16"), "logic");
    const ri = evaluateCase(memCase("memi"), "logic");
    expect(ghostY(decl, r16)).toBe(drawerY(decl, 16));
    expect(ghostY(decl, r16)!).toBeLessThan(drawerY(decl, 15));
    expect(ghostY(decl, ri)!).toBeGreaterThan(drawerY(decl, 0));
    expect(ghostY(decl, evaluateCase(memCase("mem5"), "logic"))).toBeNull();
    const ghostBox = memOutlineBox(decl, read("mem16"), r16)!;
    expect(ghostBox.dashed).toBe(true);
    expect(ghostBox.center[1]).toBe(ghostY(decl, r16));
  });

  it("dimming: nothing before the reveal; after it every cube the select does not read", () => {
    const before = memReadSet(evaluateCase(memCase("mem5_2"), "logic"), false);
    expect(isDimmed(before, 5, 0)).toBe(false);
    const r = read("mem5_2");
    expect(isDimmed(r, 5, 16)).toBe(false);
    expect(isDimmed(r, 5, 23)).toBe(false);
    expect(isDimmed(r, 5, 24)).toBe(true);
    expect(isDimmed(r, 5, 15)).toBe(true);
    expect(isDimmed(r, 4, 16)).toBe(true);
    // An invalid unpacked read lights no drawer: every real cube dims, so only the ghost stands out.
    const g = read("mem16");
    expect(isDimmed(g, 15, 0)).toBe(true);
  });

  it("the camera fit keeps the whole block (both ghost slots included) in view at phone and desktop aspects", () => {
    const bounds = memBlockBounds(decl);
    const target = memBlockTarget(bounds);
    expect(bounds.min[1]).toBeLessThan(ghostY(decl, evaluateCase(memCase("mem16"), "logic"))!);
    expect(bounds.max[1]).toBeGreaterThan(ghostY(decl, evaluateCase(memCase("memi"), "logic"))!);
    for (const [w, h] of [
      [358, 260],
      [350, 420],
      [720, 480],
    ]) {
      const dist = fitCameraDistance(bounds, target, CAMERA_DIR, CAMERA_FOV, w / h);
      const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 1000);
      const f = new THREE.Vector3(...CAMERA_DIR).normalize();
      const place = (d: number) => {
        camera.position.set(target[0] + f.x * d, target[1] + f.y * d, target[2] + f.z * d);
        camera.lookAt(...target);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
      };
      const corners = [bounds.min[0], bounds.max[0]].flatMap((x) => [bounds.min[1], bounds.max[1]].flatMap((y) => [bounds.min[2], bounds.max[2]].map((z) => new THREE.Vector3(x, y, z))));
      place(dist);
      corners.forEach((c) => {
        const p = c.clone().project(camera);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      });
      // Tight: a little closer and some corner leaves the view.
      place(dist * 0.9);
      expect(corners.some((c) => {
        const p = c.clone().project(camera);
        return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      })).toBe(true);
      // Readable: at the fitted distance, neighbouring drawers are at least 12 px apart, so 12 px labels do not overlap.
      place(dist);
      const y0 = new THREE.Vector3(0, drawerY(decl, 0), bounds.max[2]).project(camera).y;
      const y1 = new THREE.Vector3(0, drawerY(decl, 1), bounds.max[2]).project(camera).y;
      expect(((y0 - y1) / 2) * h).toBeGreaterThanOrEqual(12);
    }
  });

  it("labels: bit ranges before the reveal, lane indices after; a lit lane or bit is named", () => {
    expect(laneAxisText(decl, false)).toBe("back: bits 31:24\nfront: bits 7:0");
    expect(laneAxisText(decl, true)).toBe("back: lane [3]\nfront: lane [0]");
    expect(litLabelText(decl, read("mem5"))).toBeNull();
    expect(litLabelText(decl, read("mem5_2"))).toBe("lane [2]");
    expect(litLabelText(decl, read("mem5_2_3"))).toBe("lane [2], bit 3");
    expect(memBlockResultText(evaluateCase(memCase("mem5_2"), "logic"), read("mem5_2"))).toBe("mem[5][2] = 8'h52");
    expect(memBlockResultText(evaluateCase(memCase("mem16"), "bit"), read("mem16", "bit"))).toBe("mem[16]: no such drawer, reads 32'h0000_0000");
  });
});

describe("Memory block 3D scene contents", () => {
  const decl = lessonDecl("mem");
  const pos = (el: HTMLElement) => JSON.parse(el.parentElement!.getAttribute("data-position")!) as number[];
  const renderContents = (id: string, revealed: boolean) =>
    render(<MemBlockCanvasContents decl={decl} result={evaluateCase(memCase(id), "logic")} revealed={revealed} reducedMotion />);

  it("before the reveal: drawer and lane labels only, with bit ranges, and no ghost or lit label", () => {
    renderContents("mem16", false);
    expect(screen.getAllByTestId("mem-3d-drawer-label")).toHaveLength(16);
    expect(screen.getByTestId("mem-3d-lane-label").textContent).toBe(laneAxisText(decl, false));
    expect(screen.queryByTestId("mem-3d-ghost-label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mem-3d-lit-label")).not.toBeInTheDocument();
    // Every drawer label sits at its drawer's height.
    screen.getAllByTestId("mem-3d-drawer-label").forEach((el, i) => expect(pos(el)[1]).toBe(drawerY(decl, i)));
  });

  it("§7.4.5: the mem[16] ghost is drawn below mem[15]; the mem[i] ghost above mem[0]", () => {
    const { unmount } = renderContents("mem16", true);
    const g16 = screen.getByTestId("mem-3d-ghost-label");
    expect(g16).toHaveTextContent("mem[16]");
    expect(pos(g16)[1]).toBe(ghostY(decl, evaluateCase(memCase("mem16"), "logic")));
    expect(pos(g16)[1]).toBeLessThan(drawerY(decl, 15));
    unmount();
    renderContents("memi", true);
    const gi = screen.getByTestId("mem-3d-ghost-label");
    expect(gi).toHaveTextContent("mem[i]");
    expect(pos(gi)[1]).toBeGreaterThan(drawerY(decl, 0));
  });

  it("after the reveal of mem[5][2][3], the lit cube is named beside drawer 5", () => {
    renderContents("mem5_2_3", true);
    const lit = screen.getByTestId("mem-3d-lit-label");
    expect(lit).toHaveTextContent("lane [2], bit 3");
    expect(pos(lit)[1]).toBe(drawerY(decl, 5));
    expect(screen.getByTestId("mem-3d-lane-label").textContent).toBe(laneAxisText(decl, true));
  });
});

describe("Memory block scene: goal and reveal state", () => {
  it("states its goal above the chips", () => {
    renderMem();
    expect(screen.getByTestId("mem-block-goal")).toHaveTextContent(MEM_BLOCK_GOAL);
  });

  it("a reveal belongs to its case: changing chip after a reveal shows nothing lit and bit-range headers at once", () => {
    renderMem();
    predict("mem5");
    expect(memTable().getAllByText("(read)")).toHaveLength(4);
    fireEvent.click(chip("mem[5][2]"));
    expect(screen.queryByText("(read)")).not.toBeInTheDocument();
    expect(memTable().getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Drawer", "31:24", "23:16", "15:8", "7:0"]);
    expect(screen.getByTestId("mem-block-live")).toHaveTextContent("Predict what mem[5][2] reads.");
  });

  it("§7.4.5: the Why list of an invalid read says a write through that index does nothing", () => {
    for (const id of ["mem16", "memi"] as const) {
      const { unmount } = renderMem({ initialMemCase: id });
      predict(id);
      const why = within(screen.getByRole("list", { name: "Why" }));
      expect(why.getByText("Writing through an invalid index does nothing (§7.4.5).")).toBeInTheDocument();
      unmount();
    }
  });

  it("§7.4.5, Table 7-1: for bit, the rendered ghost row of mem[16] holds '0 in every lane", () => {
    renderMem({ initialMemCase: "mem16" });
    fireEvent.click(screen.getByRole("radio", { name: "bit, 2-state" }));
    predict("mem16", "bit");
    const ghost = within(screen.getByTestId("mem-block-ghost-row"));
    expect(ghost.getAllByRole("cell").map((c) => c.textContent)).toEqual(["8'h00", "8'h00", "8'h00", "8'h00"]);
  });

  it("mem[5][2][3]: the table marks the lane cell as bit 19 read, not the whole byte, and the live text names the bit", () => {
    renderMem({ initialMemCase: "mem5_2_3" });
    predict("mem5_2_3");
    expect(screen.queryByText("(read)")).not.toBeInTheDocument();
    const marker = memTable().getByText("(bit 19 read)");
    expect(marker.closest("td")).toHaveTextContent("8'h52");
    expect(screen.getByTestId("mem-block-bit-note")).toHaveTextContent("mem[5][2][3] reads only bit 19 of mem[5]");
    expect(screen.getByTestId("mem-block-live")).toHaveTextContent("Revealed: mem[5][2][3] reads 1'b0, single bit (bit 19 of mem[5]).");
  });

  it("the prediction offers exactly the model's options in its order, and every misreading gets its own feedback", () => {
    const expectedIds: Record<string, string[]> = {
      mem5: ["kind-swap", "packed-first"],
      mem5_2: ["from-left", "swapped"],
      mem5_2_3: ["from-left", "swapped", "packed-first"],
      mem16: ["other-state", "packed-first", "wrap"],
      memi: ["x-as-zero", "other-state"],
    };
    for (const state of ["logic", "bit"] as const) {
      for (const c of MEM_BLOCK_CASES) {
        const opts = selectOptions(c, state);
        expect(opts.map((o) => o.id)).toEqual(expect.arrayContaining(expectedIds[c.id]));
        const wrong = opts.filter((o) => !o.correct);
        for (const w of wrong) {
          const { unmount } = renderMem({ initialMemCase: c.id });
          if (state === "bit") fireEvent.click(screen.getByRole("radio", { name: "bit, 2-state" }));
          const shown = screen.getAllByRole("radio").filter((r) => r.tagName === "INPUT").map((r) => r.closest("label")!.textContent);
          expect(shown).toEqual(orderedOptions(opts, `${c.id}-${state}`).map((o) => o.label));
          fireEvent.click(screen.getByRole("radio", { name: w.label }));
          fireEvent.click(screen.getByRole("button", { name: "Lock in prediction" }));
          expect(screen.getAllByText(w.feedback).length).toBeGreaterThan(0);
          unmount();
        }
      }
    }
  });

  it("§7.4.1: the contiguity caveat is listed in the assumptions", () => {
    renderMem();
    expect(screen.getByText(/§7\.4\.1 guarantees a packed array is a contiguous set of bits and says an unpacked array may or may not be/)).toBeInTheDocument();
  });

  it("3D: the result line under the canvas appears only after the reveal, computed by the model", () => {
    enableWebGL();
    renderMem();
    fireEvent.click(chip("mem[5][2]"));
    expect(screen.queryByTestId("mem-block-3d-result")).not.toBeInTheDocument();
    predict("mem5_2");
    expect(screen.getByTestId("mem-block-3d-result")).toHaveTextContent(`mem[5][2] = ${evaluateCase(memCase("mem5_2"), "logic").valueText}`);
  });
});
