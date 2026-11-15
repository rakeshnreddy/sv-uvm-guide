"use client";

/**
 * The "mem-block" scene of SystemVerilog3DVisualizer: logic [3:0][7:0] mem [16]
 * drawn as 16 unpacked drawers of 32 bit cubes in four byte lanes.
 *
 * Every select is evaluated by src/lib/sv-array-select-model.ts (the model
 * ArraySelectExplorer uses), so the value, kind, type and reasons on screen
 * come from one tested source:
 * - IEEE 1800-2023 §7.4.4: unpacked indices come first, then packed ones; the
 *   rightmost dimension varies fastest; omitting indices names a subarray.
 * - §7.4.5: slices keep their kind; an invalid index into an unpacked array
 *   reads the Table 7-1 value ('x for a 4-state element, '0 for a 2-state one).
 * - §11.5.1: invalid packed selects.
 * - §7.4.1: a packed array is a contiguous set of bits; an unpacked array may or
 *   may not be. That is why the lanes touch and the drawers sit apart.
 *
 * This file holds only layout helpers (which cube is where, which cubes a
 * result reads) and rendering; it adds no select semantics.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { WebGLFallbackBoundary } from "@/components/ui/WebGLFallbackBoundary";
import { BitStrip, type BitSegment } from "@/components/visual-system/BitStrip";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/visual-system/usePlayback";
import {
  SELECT_KIND_LABELS,
  evaluateCase,
  findSelectCase,
  formatBits,
  lessonDecl,
  offsetFromRight,
  orderedOptions,
  rangeIndices,
  rangeSize,
  rangeText,
  selectExpr,
  selectOptions,
  selectQuestion,
  wordBits,
  wordWidth,
  type ArrayDecl,
  type Bit,
  type SelectCase,
  type SelectResult,
  type StateKind,
} from "@/lib/sv-array-select-model";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Cases (the spec's select chips)                                     */
/* ------------------------------------------------------------------ */

export type MemBlockCaseId = "mem5" | "mem5_2" | "mem5_2_3" | "mem16" | "memi";

function sharedCase(id: string): SelectCase {
  const c = findSelectCase(id);
  if (!c) throw new Error(`sv-array-select-model has no case "${id}"`);
  return c;
}

/**
 * mem[5], mem[5][2] and mem[5][2][3] are the model's own cases. mem[16] (one
 * past [0:15]) and mem[i] with i = 'x are the two invalid unpacked indexes of
 * §7.4.5; the bound comes from the declaration, not a typed number.
 */
export function memBlockCases(): SelectCase[] {
  const mem = lessonDecl("mem");
  const pastEnd = Math.max(mem.unpacked[0].left, mem.unpacked[0].right) + 1;
  return [
    sharedCase("mem5"),
    sharedCase("mem5_2"),
    sharedCase("mem5_2_3"),
    { id: "mem16", decl: "mem", items: [{ kind: "index", value: pastEnd }] },
    { id: "memi", decl: "mem", items: [{ kind: "index", value: "x", name: "i" }], given: "i holds 'x" },
  ];
}

export const MEM_BLOCK_CASES: readonly SelectCase[] = memBlockCases();

export function findMemBlockCase(id: string | undefined): SelectCase {
  return MEM_BLOCK_CASES.find((c) => c.id === id) ?? MEM_BLOCK_CASES[0];
}

/* ------------------------------------------------------------------ */
/* Layout helpers (pure)                                               */
/* ------------------------------------------------------------------ */

export interface Lane {
  /** Declared index of the lane in the first packed dimension, e.g. 2. */
  index: number;
  /** Least significant bit of the lane in the word. */
  lo: number;
  hi: number;
}

/** The byte lanes of the first packed dimension, most significant first, with their bit positions in the word. */
export function memLanes(decl: ArrayDecl): Lane[] {
  const [first, ...rest] = decl.packed;
  const ew = rest.reduce((acc, r) => acc * rangeSize(r), 1);
  return rangeIndices(first).map((index) => {
    const lo = offsetFromRight(first, index) * ew;
    return { index, lo, hi: lo + ew - 1 };
  });
}

/** Bits of a word, most significant first, sliced to one lane. */
export function laneBits(word: readonly Bit[], lane: Lane): Bit[] {
  const W = word.length;
  return word.slice(W - 1 - lane.hi, W - lane.lo);
}

/** The bits of drawer i, most significant first. */
export const drawerBits = (decl: ArrayDecl, i: number): Bit[] => wordBits(decl.word([i]), wordWidth(decl));

export interface MemReadSet {
  /** The drawer (unpacked index) the select reads, or null. */
  drawer: number | null;
  /** Bit positions read inside that drawer's word. */
  bits: Set<number>;
  /** For an invalid unpacked index: the word the read returns, most significant first. */
  ghost: { label: string; bits: Bit[]; reason: "out-of-bounds" | "x-index" } | null;
}

/** What a model result lights up. Before the reveal nothing is lit. */
export function memReadSet(result: SelectResult, revealed: boolean): MemReadSet {
  if (!revealed) return { drawer: null, bits: new Set(), ghost: null };
  const drawer = result.rows.length === 1 ? result.rows[0][0] : null;
  const invalidUnpacked = result.invalid && !result.invalid.packed;
  const ghost =
    invalidUnpacked && result.value?.shape === "packed"
      ? { label: result.expr, bits: result.value.bits, reason: result.invalid!.reason }
      : null;
  return { drawer, bits: drawer === null ? new Set() : new Set(result.wordBits), ghost };
}

/** Lanes that hold at least one bit of the read. */
export function lanesRead(decl: ArrayDecl, read: MemReadSet): number[] {
  return memLanes(decl)
    .filter((l) => Array.from(read.bits).some((p) => p >= l.lo && p <= l.hi))
    .map((l) => l.index);
}

/** The accessible summary of the 3D view: what is drawn and, after the reveal, what lit up. */
export function memBlockSummary(decl: ArrayDecl, result: SelectResult, revealed: boolean): string {
  const u = decl.unpacked[0];
  const W = wordWidth(decl);
  const lanes = memLanes(decl);
  const ew = lanes.length ? W / lanes.length : W;
  const shape = `3D view of ${decl.declText}: ${rangeSize(u)} separate drawers stacked with gaps, ${decl.name}[${u.left}] at the top to ${decl.name}[${u.right}] at the bottom. Each drawer is one contiguous slab of ${W} bit cubes: ${lanes.length} byte lanes of ${ew} bits that touch, front to back. A 1 bit is a tall cube, a 0 bit a flat tile.`;
  if (!revealed) return `${shape} Predict what ${result.expr} reads to light up the selection.`;
  const read = memReadSet(result, true);
  if (read.ghost) {
    // An x bit is a flat tile like a 0, told apart only by its rose colour, so say so in words.
    const xTiles = read.ghost.bits.includes("x") ? ", its x bits drawn as flat rose tiles" : "";
    return `${shape} ${result.expr} names no drawer, so nothing in the block lights up; a ghost drawer outside the block shows the value read, ${result.valueText}${xTiles}.`;
  }
  const where =
    read.bits.size === W
      ? `the whole drawer ${decl.name}[${read.drawer}], a slab`
      : read.bits.size === 1
        ? `one cube, bit ${Array.from(read.bits)[0]} of ${decl.name}[${read.drawer}]`
        : `lane ${lanesRead(decl, read).map((l) => `[${l}]`).join(", ")} of ${decl.name}[${read.drawer}], a row of ${read.bits.size} cubes`;
  return `${shape} ${result.expr} lights up ${where}: it reads ${result.valueText}, ${SELECT_KIND_LABELS[result.kind]}.`;
}

/**
 * The screen-reader marker on a lit table cell: "(read)" when the select reads
 * the whole lane, otherwise which bits of the drawer's word it reads, so a
 * single-bit select is not taken for the whole byte.
 */
export function laneReadMarker(read: MemReadSet, lane: Lane): string | null {
  const inLane = Array.from(read.bits)
    .filter((p) => p >= lane.lo && p <= lane.hi)
    .sort((a, b) => b - a);
  if (!inLane.length) return null;
  if (inLane.length === lane.hi - lane.lo + 1) return "(read)";
  return inLane.length === 1 ? `(bit ${inLane[0]} read)` : `(bits ${inLane.join(", ")} read)`;
}

/** The polite live text: the prompt before the reveal; after it the value, kind and, for a single bit, which bit of which drawer. */
export function memBlockLiveText(decl: ArrayDecl, result: SelectResult, revealed: boolean): string {
  if (!revealed) return `Predict what ${result.expr} reads.`;
  const read = memReadSet(result, true);
  const bit = read.drawer !== null && read.bits.size === 1 ? ` (bit ${Array.from(read.bits)[0]} of ${decl.name}[${read.drawer}])` : "";
  return `Revealed: ${result.expr} reads ${result.valueText}, ${SELECT_KIND_LABELS[result.kind]}${bit}.`;
}

/* ------------------------------------------------------------------ */
/* 3D layout (pure)                                                    */
/* ------------------------------------------------------------------ */

/*
 * The block: x runs along the bits of a byte lane (bit 7 on the left, bit 0 on
 * the right), z runs through the byte lanes (lane [3] at the back, lane [0] at
 * the front) and y runs down the drawers. A drawer is a 4 x 8 slab, a lane a
 * row of 8 and a bit one cube. The lanes touch (their pitch equals the cube
 * depth) because a packed array is one contiguous set of bits (§7.4.1); the
 * drawers sit a gap apart because an unpacked array may or may not be.
 */

/** Distance between drawers; a cube is 1 tall, so 0.7 of it is gap. */
export const ROW_PITCH = 1.7;
/** Distance between byte lanes; equal to the cube depth, so the lanes touch with no gap. */
export const LANE_PITCH = 1;
export const CUBE_DEPTH = LANE_PITCH;
/** Cube width along a lane: a hairline seam so single bits can be counted. */
export const CUBE_WIDTH = 0.94;
/** Height of a 0 bit (a flat tile); a 1 bit is a full cube. */
export const ZERO_HEIGHT = 0.35;

export interface CubeSpot {
  x: number;
  z: number;
  /** Declared index of the byte lane, e.g. 2. */
  lane: number;
  /** Bit number inside that lane, 0 = least significant. */
  bitInLane: number;
}

/** Where bit p of a drawer's word sits in the slab. */
export function cubeSpot(decl: ArrayDecl, p: number): CubeSpot {
  const lanes = memLanes(decl);
  const q = lanes.findIndex((l) => p >= l.lo && p <= l.hi);
  if (q < 0) throw new Error(`bit ${p} is outside ${decl.declText}`);
  const lane = lanes[q];
  const ew = lane.hi - lane.lo + 1;
  const k = p - lane.lo;
  return { x: (ew - 1) / 2 - k, z: (q - (lanes.length - 1) / 2) * LANE_PITCH, lane: lane.index, bitInLane: k };
}

/** Height of drawer i's slab; the first declared drawer is at 0 and the rest go down. */
export const drawerY = (decl: ArrayDecl, i: number) => 0 - offsetFromLeft(decl, i) * ROW_PITCH;

function offsetFromLeft(decl: ArrayDecl, i: number): number {
  const u = decl.unpacked[0];
  return u.left <= u.right ? i - u.left : u.left - i;
}

/**
 * Where the ghost of an invalid unpacked read is drawn: one drawer slot past
 * the end for an index past the end, one slot before the start for an index
 * before it, and above the block for an x index, which names no position.
 */
export function ghostY(decl: ArrayDecl, result: SelectResult): number | null {
  const inv = result.invalid;
  if (!inv || inv.packed) return null;
  const first = drawerY(decl, decl.unpacked[0].left);
  if (inv.reason === "x-index" || typeof inv.index !== "number") return first + ROW_PITCH;
  return drawerY(decl, inv.index);
}

/** Whether instance (drawer i, bit p) is dimmed: once anything lights up, everything not read is dimmed. */
export function isDimmed(read: MemReadSet, i: number, p: number): boolean {
  const anyLit = read.drawer !== null || read.ghost !== null;
  return anyLit && !(read.drawer === i && read.bits.has(p));
}

export interface OutlineBox {
  center: [number, number, number];
  size: [number, number, number];
  /** Dashed for a drawer that does not exist. */
  dashed: boolean;
}

const OUTLINE_PAD = 0.18;

/** The box drawn around what a select reads: a whole slab, one lane's row, or one cube. */
export function memOutlineBox(decl: ArrayDecl, read: MemReadSet, result: SelectResult): OutlineBox | null {
  if (read.ghost) {
    const y = ghostY(decl, result);
    if (y === null) return null;
    const all = Array.from({ length: wordWidth(decl) }, (_, p) => cubeSpot(decl, p));
    return boxAround(all, y, true);
  }
  if (read.drawer === null || read.bits.size === 0) return null;
  return boxAround(Array.from(read.bits, (p) => cubeSpot(decl, p)), drawerY(decl, read.drawer), false);
}

function boxAround(spots: CubeSpot[], y: number, dashed: boolean): OutlineBox {
  const xs = spots.map((s) => s.x);
  const zs = spots.map((s) => s.z);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return {
    center: [(x0 + x1) / 2, y, (z0 + z1) / 2],
    size: [x1 - x0 + 1 + 2 * OUTLINE_PAD, 1 + 2 * OUTLINE_PAD, z1 - z0 + CUBE_DEPTH + 2 * OUTLINE_PAD],
    dashed,
  };
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** The volume the camera keeps in view: every drawer plus both ghost slots, so the view does not jump between chips. */
export function memBlockBounds(decl: ArrayDecl): Bounds {
  const W = wordWidth(decl);
  const spots = Array.from({ length: W }, (_, p) => cubeSpot(decl, p));
  const xs = spots.map((s) => s.x);
  const zs = spots.map((s) => s.z);
  const u = decl.unpacked[0];
  const top = drawerY(decl, u.left) + ROW_PITCH + 0.5;
  const bottom = drawerY(decl, u.right) - ROW_PITCH - 0.5;
  return {
    min: [Math.min(...xs) - 0.5, bottom, Math.min(...zs) - CUBE_DEPTH / 2],
    max: [Math.max(...xs) + 0.5, top, Math.max(...zs) + CUBE_DEPTH / 2],
  };
}

/** Camera direction from the target: in front, a little to the right and above, so the slabs show their depth. */
export const CAMERA_DIR: readonly [number, number, number] = [0.55, 0.42, 1];
export const CAMERA_FOV = 40;
/**
 * The labels are HTML at a fixed 12 px, so they do not shrink with the scene.
 * The camera looks a little right of the block so the block sits left of
 * centre: the drawer names on the left are short, the lane label on the right
 * is wider.
 */
export const TARGET_SHIFT_X = 2;

/** The target the camera and orbit controls look at. */
export function memBlockTarget(bounds: Bounds): [number, number, number] {
  return [(bounds.min[0] + bounds.max[0]) / 2 + TARGET_SHIFT_X, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
}

/**
 * The smallest camera distance along `dir` from `target` at which every corner
 * of `bounds` lies inside the frustum of a perspective camera with vertical
 * field of view `fovDeg` and the canvas `aspect` (width / height), with a
 * fractional `margin` left over on each side.
 */
export function fitCameraDistance(bounds: Bounds, target: readonly number[], dir: readonly number[], fovDeg: number, aspect: number, margin = 0.04): number {
  const f = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize();
  const up = new THREE.Vector3().crossVectors(f, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * (1 - margin);
  const tanH = tanV * aspect;
  let d = 0;
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const c = new THREE.Vector3(x - target[0], y - target[1], z - target[2]);
        const depthOffset = c.dot(f);
        d = Math.max(d, depthOffset + Math.abs(c.dot(up)) / tanV, depthOffset + Math.abs(c.dot(right)) / tanH);
      }
  return d;
}

/* ------------------------------------------------------------------ */
/* 3D scene                                                            */
/* ------------------------------------------------------------------ */

/** Visual-language colours: slate is 0, cyan is 1, rose is x. */
const BIT_COLOURS: Record<Bit, number> = { "0": 0x64748b, "1": 0x06b6d4, x: 0xf43f5e };
const DIM_TOWARD = 0x05070d;
const FALLBACK_OUTLINE = 0xe9ecf2;

/** Reads an HSL triplet token (e.g. "220 20% 93%") into a THREE colour; jsdom and SSR use the fallback. */
function tokenColour(name: string, fallback: number): THREE.Color {
  const colour = new THREE.Color(fallback);
  if (typeof window === "undefined") return colour;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (m) colour.setHSL(Number(m[1]) / 360, Number(m[2]) / 100, Number(m[3]) / 100);
  return colour;
}

/** Keeps the whole block in view at the canvas's current aspect, at the smallest distance that fits. */
function CameraFit({ bounds, target }: { bounds: Bounds; target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  useLayoutEffect(() => {
    if (!camera || !(camera instanceof THREE.PerspectiveCamera) || !width || !height) return;
    const dist = fitCameraDistance(bounds, target, CAMERA_DIR, camera.fov, width / height);
    const f = new THREE.Vector3(...CAMERA_DIR).normalize();
    camera.position.set(target[0] + f.x * dist, target[1] + f.y * dist, target[2] + f.z * dist);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
    if (typeof invalidate === "function") invalidate();
  }, [bounds, camera, height, invalidate, target, width]);
  return null;
}

function BitCubes({ decl, read }: { decl: ArrayDecl; read: MemReadSet }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const W = wordWidth(decl);
  const drawers = useMemo(() => rangeIndices(decl.unpacked[0]), [decl]);
  const spots = useMemo(() => Array.from({ length: W }, (_, p) => cubeSpot(decl, p)), [decl, W]);
  const count = drawers.length * W;
  const geometry = useMemo(() => new THREE.BoxGeometry(CUBE_WIDTH, 1, CUBE_DEPTH), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55 }), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m || typeof m.setMatrixAt !== "function") return;
    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();
    const dim = new THREE.Color(DIM_TOWARD);
    let n = 0;
    drawers.forEach((i) => {
      const bits = drawerBits(decl, i);
      const y = drawerY(decl, i);
      for (let p = W - 1; p >= 0; p -= 1) {
        const b = bits[W - 1 - p];
        const h = b === "1" ? 1 : ZERO_HEIGHT;
        matrix.makeScale(1, h, 1).setPosition(spots[p].x, y - (1 - h) / 2, spots[p].z);
        m.setMatrixAt(n, matrix);
        colour.setHex(BIT_COLOURS[b]);
        if (isDimmed(read, i, p)) colour.lerp(dim, 0.72);
        m.setColorAt(n, colour);
        n += 1;
      }
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (typeof invalidate === "function") invalidate();
  }, [W, decl, drawers, invalidate, read, spots]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, count]} />;
}

function Outline({ box, colour }: { box: OutlineBox; colour: THREE.Color }) {
  const [sx, sy, sz] = box.size;
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)), [sx, sy, sz]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments
      geometry={geometry}
      position={box.center}
      onUpdate={(l: THREE.LineSegments) => {
        if (box.dashed && typeof l.computeLineDistances === "function") l.computeLineDistances();
      }}
    >
      {box.dashed ? <lineDashedMaterial color={colour} dashSize={0.4} gapSize={0.25} /> : <lineBasicMaterial color={colour} />}
    </lineSegments>
  );
}

function GhostDrawer({ decl, y, bits }: { decl: ArrayDecl; y: number; bits: readonly Bit[] }) {
  const W = bits.length;
  return (
    <group>
      {bits.map((b, k) => {
        const s = cubeSpot(decl, W - 1 - k);
        const h = b === "1" ? 1 : ZERO_HEIGHT;
        return (
          <mesh key={k} position={[s.x, y - (1 - h) / 2, s.z]} scale={[1, h, 1]}>
            <boxGeometry args={[CUBE_WIDTH, 1, CUBE_DEPTH]} />
            <meshStandardMaterial color={BIT_COLOURS[b]} transparent opacity={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A 12 px HTML label pinned to a point in the scene. Decorative: the canvas's role="img" label carries the same text. */
function Label({ position, align, strong, testId, children }: { position: [number, number, number]; align: "left" | "right"; strong?: boolean; testId: string; children: React.ReactNode }) {
  return (
    <Html position={position} pointerEvents="none" zIndexRange={[10, 0]}>
      <span
        aria-hidden="true"
        data-testid={testId}
        className={cn(
          "block whitespace-pre font-mono text-xs leading-none [font-variant-ligatures:none]",
          align === "right" ? "-translate-x-full -translate-y-1/2 pr-1" : "-translate-y-1/2 pl-1",
          strong ? "font-semibold text-code-foreground" : "text-code-muted",
        )}
      >
        {children}
      </span>
    </Html>
  );
}

/** The text of the lane label: bit ranges before the reveal (lane indices would answer mem[5][2]), lane indices after. */
export function laneAxisText(decl: ArrayDecl, revealed: boolean): string {
  const lanes = memLanes(decl);
  const [back, front] = [lanes[0], lanes[lanes.length - 1]];
  return revealed ? `back: lane [${back.index}]\nfront: lane [${front.index}]` : `back: bits ${back.hi}:${back.lo}\nfront: bits ${front.hi}:${front.lo}`;
}

/** The label beside a lit lane or bit, or null when a whole drawer (or nothing) is read. */
export function litLabelText(decl: ArrayDecl, read: MemReadSet): string | null {
  if (read.drawer === null || read.bits.size === 0 || read.bits.size === wordWidth(decl)) return null;
  const lanes = lanesRead(decl, read);
  if (read.bits.size === 1) {
    const s = cubeSpot(decl, Array.from(read.bits)[0]);
    return `lane [${s.lane}], bit ${s.bitInLane}`;
  }
  return lanes.map((l) => `lane [${l}]`).join(", ");
}

/**
 * The camera's bounds and target, keyed on their values rather than on the
 * declaration object: the logic/bit toggle builds a new decl of the same shape,
 * and a new object here would make CameraFit snap back and drop the learner's orbit.
 */
export function useMemBlockFrame(decl: ArrayDecl): { bounds: Bounds; target: [number, number, number] } {
  const key = JSON.stringify(memBlockBounds(decl));
  return useMemo(() => {
    const bounds = JSON.parse(key) as Bounds;
    return { bounds, target: memBlockTarget(bounds) };
  }, [key]);
}

export function MemBlockCanvasContents({ decl, result, revealed, reducedMotion }: { decl: ArrayDecl; result: SelectResult; revealed: boolean; reducedMotion: boolean }) {
  const read = useMemo(() => memReadSet(result, revealed), [result, revealed]);
  const outline = useMemo(() => tokenColour("--code-foreground", FALLBACK_OUTLINE), []);
  const { bounds, target } = useMemBlockFrame(decl);
  const drawers = useMemo(() => rangeIndices(decl.unpacked[0]), [decl]);
  const box = memOutlineBox(decl, read, result);
  const gy = read.ghost ? ghostY(decl, result) : null;
  // Labels sit just outside the slab: names on the left at the front edge, lane notes on the right.
  const leftX = bounds.min[0] - 0.3;
  const rightX = bounds.max[0] + 0.3;
  const frontZ = bounds.max[2];
  const litText = litLabelText(decl, read);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 14, 12]} intensity={1} />
      <CameraFit bounds={bounds} target={target} />
      <OrbitControls makeDefault target={target} enableDamping={!reducedMotion} dampingFactor={0.1} />
      <BitCubes decl={decl} read={read} />
      {drawers.map((i) => (
        <Label key={`d${i}`} testId="mem-3d-drawer-label" position={[leftX, drawerY(decl, i), frontZ]} align="right" strong={read.drawer === i}>
          {`${decl.name}[${i}]`}
        </Label>
      ))}
      <Label testId="mem-3d-lane-label" position={[rightX, drawerY(decl, drawers[0]), 0]} align="left">
        {laneAxisText(decl, revealed)}
      </Label>
      {box ? <Outline box={box} colour={outline} /> : null}
      {litText && read.drawer !== null && box ? (
        <Label testId="mem-3d-lit-label" position={[rightX, drawerY(decl, read.drawer), box.center[2]]} align="left" strong>
          {litText}
        </Label>
      ) : null}
      {read.ghost && gy !== null ? (
        <>
          <GhostDrawer decl={decl} y={gy} bits={read.ghost.bits} />
          <Label testId="mem-3d-ghost-label" position={[leftX, gy, frontZ]} align="right" strong>
            {read.ghost.label}
          </Label>
        </>
      ) : null}
    </>
  );
}

/** The result line over the canvas after the reveal; HTML, so it never falls outside the view. */
export function memBlockResultText(result: SelectResult, read: MemReadSet): string {
  return read.ghost ? `${result.expr}: no such drawer, reads ${result.valueText}` : `${result.expr} = ${result.valueText}`;
}

/* ------------------------------------------------------------------ */
/* Text view: rows by lanes                                            */
/* ------------------------------------------------------------------ */

const mono = "font-mono [font-variant-ligatures:none]";
/** Rose hatching is the visual-language encoding for x. */
const hatch = "border-rose-500/80 text-rose-700 dark:text-rose-200 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0_4px,transparent_4px_8px)]";
/** A read cell: neutral raised surface, a strong outline and a text marker, so it cannot be read as a signal value. */
const readCell = "border-2 border-foreground bg-muted font-semibold text-foreground";

export function MemBlockTable({ decl, result, revealed }: { decl: ArrayDecl; result: SelectResult; revealed: boolean }) {
  const read = memReadSet(result, revealed);
  const lanes = memLanes(decl);
  const lit = new Set(lanesRead(decl, read));
  const four = decl.base === "logic";
  return (
    <div className="space-y-2" data-testid="mem-block-table">
      <div role="region" aria-label="Text view of mem" tabIndex={0} className="max-w-full overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <table className={cn("border-separate border-spacing-0.5 text-xs", mono)}>
          <caption className="pb-1 text-left font-sans text-xs text-muted-foreground">
            Text view: {decl.declText}, one row per drawer and one column per byte lane, in hex. It shows the same state as the 3D view.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-1 text-left font-sans font-normal text-muted-foreground">
                Drawer
              </th>
              {lanes.map((l) => (
                <th key={l.index} scope="col" className="px-1 font-normal text-muted-foreground">
                  {revealed ? `[${l.index}]` : `${l.hi}:${l.lo}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rangeIndices(decl.unpacked[0]).map((i) => {
              const rowLit = read.drawer === i;
              const bits = drawerBits(decl, i);
              return (
                <tr key={i} aria-current={rowLit ? "true" : undefined}>
                  <th scope="row" className={cn("whitespace-nowrap px-1 text-left font-normal", rowLit ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {decl.name}[{i}]
                  </th>
                  {lanes.map((l) => {
                    const cellLit = rowLit && lit.has(l.index);
                    const marker = cellLit ? laneReadMarker(read, l) : null;
                    return (
                      <td key={l.index} className={cn("rounded border px-1.5 py-0.5 text-center", cellLit ? readCell : "border-border/60 text-foreground")}>
                        {formatBits(laneBits(bits, l))}
                        {marker ? <span className="sr-only"> {marker}</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {read.ghost ? (
              <tr data-testid="mem-block-ghost-row">
                <th scope="row" className="whitespace-nowrap px-1 text-left font-semibold text-foreground">
                  {read.ghost.label}
                </th>
                {lanes.map((l) => (
                  <td key={l.index} className={cn("rounded border border-dashed px-1.5 py-0.5 text-center", four ? hatch : "border-slate-400/80 bg-slate-500/10 text-foreground")}>
                    {formatBits(laneBits(read.ghost!.bits, l))}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {read.ghost ? (
        <p className="text-xs text-muted-foreground">
          {read.ghost.label} names no drawer ({read.ghost.reason === "x-index" ? "the index has x bits" : `the index is outside ${rangeText(decl.unpacked[0])}`}), so it reads {result.valueText}, shown in the dashed row.
        </p>
      ) : null}
      {read.drawer !== null && read.bits.size === 1 ? (
        <p className="text-xs text-muted-foreground" data-testid="mem-block-bit-note">
          The outlined cell holds the whole lane; {result.expr} reads only bit {Array.from(read.bits)[0]} of {decl.name}[{read.drawer}] in it.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The scene with its prediction                                      */
/* ------------------------------------------------------------------ */

/** Rendered only once PredictionPrompt reveals; it records which case and type the reveal belongs to. */
function RevealSignal({ revealKey, onChange }: { revealKey: string; onChange: (update: (current: string | null) => string | null) => void }) {
  useEffect(() => {
    onChange(() => revealKey);
    return () => onChange((current) => (current === revealKey ? null : current));
  }, [onChange, revealKey]);
  return null;
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-1">
      {notes.map((n) => (
        <li key={n} role="note" className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground">
          <span className="mr-1.5 rounded bg-warning-subtle px-1.5 py-0.5 text-label text-warning">Tool note</span>
          {n}
        </li>
      ))}
    </ul>
  );
}

export function MemBlockReveal({ decl, result }: { decl: ArrayDecl; result: SelectResult }) {
  const v = result.value;
  const drawer = result.rows.length === 1 ? result.rows[0][0] : null;
  const segments: BitSegment[] = memLanes(decl).map((l) => ({ hi: l.hi, lo: l.lo, label: `[${l.index}]` }));
  return (
    <div className="space-y-3 text-sm" data-testid="mem-block-reveal">
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Reads</dt>
        <dd className={cn(mono, "font-semibold")} data-testid="mem-block-value">
          {result.valueText}
        </dd>
        <dt className="text-muted-foreground">Kind</dt>
        <dd data-testid="mem-block-kind">{SELECT_KIND_LABELS[result.kind]}</dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd className={mono}>{result.typeText}</dd>
        {result.bitArithmetic ? (
          <>
            <dt className="text-muted-foreground">Bit number</dt>
            <dd className={mono}>{result.bitArithmetic}</dd>
          </>
        ) : null}
      </dl>
      {drawer !== null && v?.shape === "packed" ? (
        <BitStrip
          bits={drawerBits(decl, drawer)}
          label={`${decl.name}[${drawer}], the drawer read`}
          segments={segments}
          highlight={result.wordBits}
          highlightLabel={`read by ${result.expr}`}
          bitNumbers
        />
      ) : null}
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground" aria-label="Why">
        {result.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Notes notes={result.notes} />
    </div>
  );
}

/** Buttons inside reach the 40 px touch target on coarse pointers. */
export const TOUCH_BUTTONS = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const touchButtons = TOUCH_BUTTONS;

/** The scene's goal, shown above the chips. */
export const MEM_BLOCK_GOAL =
  "Each index you add removes one dimension: predict what each select reads and what kind of value it is. The byte lanes of a drawer touch because a packed array is one contiguous set of bits; the drawers sit apart because the elements of an unpacked array need not be (§7.4.1).";

export interface MemBlockModeProps {
  /** "3d" draws the block beside the text view; "2d" shows the text view alone. */
  view: "3d" | "2d";
  /** Height of the 3D canvas from 640 px up; phones use 260 px. */
  height?: string | number;
  /** Select chip to start on. */
  initialCase?: MemBlockCaseId;
}

export function MemBlockMode({ view, height = 420, initialCase = "mem5" }: MemBlockModeProps) {
  const [caseId, setCaseId] = useState<string>(initialCase);
  const [state, setState] = useState<StateKind>("logic");
  // The reveal is stored against the case and type it belongs to, so a chip or type change can never show the old reveal for the new case.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((update: (current: string | null) => string | null) => setRevealedKey(update), []);
  const reducedMotion = usePrefersReducedMotion();

  const c = findMemBlockCase(caseId);
  const decl = useMemo(() => lessonDecl("mem", state), [state]);
  const result = useMemo(() => evaluateCase(c, state), [c, state]);
  const resetKey = `${c.id}-${state}`;
  const revealed = revealedKey === resetKey;
  const resultText = revealed ? memBlockResultText(result, memReadSet(result, true)) : null;
  const question = selectQuestion(c, state);
  const options: PredictionOption[] = useMemo(
    () =>
      orderedOptions(selectOptions(c, state), resetKey).map((o) => ({
        id: o.id,
        label: <span className={mono}>{o.label}</span>,
        correct: o.correct,
        feedback: o.feedback,
      })),
    [c, state, resetKey],
  );
  const summary = memBlockSummary(decl, result, revealed);
  const heightCss = typeof height === "number" ? `${height}px` : height;

  return (
    <div className="space-y-4" data-testid="mem-block-scene">
      <p className="text-sm text-foreground" data-testid="mem-block-goal">
        {MEM_BLOCK_GOAL}
      </p>
      <div className={cn("space-y-3", touchButtons)}>
        <SegmentedControl
          label="Select expression"
          mono
          value={c.id}
          onChange={setCaseId}
          options={MEM_BLOCK_CASES.map((sc) => ({ value: sc.id, label: selectExpr(lessonDecl("mem"), sc.items) }))}
        />
        <SegmentedControl
          label="Element type"
          mono
          value={state}
          onChange={setState}
          options={[
            { value: "logic" as const, label: "logic (4-state)", ariaLabel: "logic, 4-state" },
            { value: "bit" as const, label: "bit (2-state)", ariaLabel: "bit, 2-state" },
          ]}
        />
      </div>
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-label text-muted-foreground">Given</p>
        <ul className={cn("mt-1 space-y-0.5 text-xs text-foreground", mono)}>
          {[`${decl.declText};`, decl.valueText, ...(c.given ? [c.given] : [])].map((l) => (
            <li key={l} className="break-words">
              {l}
            </li>
          ))}
        </ul>
      </div>
      <PredictionPrompt
        key={resetKey}
        resetKey={resetKey}
        className={touchButtons}
        question={
          <>
            {question.lead}
            <code className={cn("rounded bg-muted px-1", mono)}>{question.expr}</code>
            {question.tail}
          </>
        }
        options={options}
      >
        <RevealSignal revealKey={resetKey} onChange={onReveal} />
        <MemBlockReveal decl={decl} result={result} />
      </PredictionPrompt>
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <MemBlockTable decl={decl} result={result} revealed={revealed} />
        {view === "3d" ? (
          <div className="min-w-0 space-y-1.5">
            <div
              data-testid="mem-block-viewport"
              role="img"
              aria-label={summary}
              className="relative isolate h-[260px] min-w-0 cursor-move overflow-hidden rounded-xl border border-code-border bg-code-surface sm:h-[var(--mem-block-h)]"
              style={{ "--mem-block-h": heightCss } as React.CSSProperties}
            >
              <WebGLFallbackBoundary fallback={<p className="p-3 text-xs text-code-foreground">The 3D view could not start here. The text view shows the same state.</p>}>
                {/* CameraFit places the camera; this position is only the first frame's. */}
                <Canvas camera={{ position: [20, 4, 40], fov: CAMERA_FOV }} dpr={[1, 1.5]} frameloop="demand">
                  <MemBlockCanvasContents decl={decl} result={result} revealed={revealed} reducedMotion={reducedMotion} />
                </Canvas>
              </WebGLFallbackBoundary>
            </div>
            {/* Under the canvas, not over it, so it never covers a drawer label. The reveal panel says the same in full. */}
            {resultText ? (
              <p aria-hidden="true" data-testid="mem-block-3d-result" className={cn("break-words text-xs font-semibold text-foreground", mono)}>
                {resultText}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" data-testid="mem-block-live">
        {memBlockLiveText(decl, result, revealed)}
      </p>
    </div>
  );
}

export default MemBlockMode;
