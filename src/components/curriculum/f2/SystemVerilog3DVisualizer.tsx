"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useRouter, useSearchParams } from "next/navigation";

import { WebGLFallbackBoundary } from "@/components/ui/WebGLFallbackBoundary";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  applyContainerOp,
  buildArrayInstances,
  createAssocArray,
  createDynamicArray,
  createQueue,
  declarationOf,
  encodeArrayCoordinates,
  formatAssocKey,
  formatElem,
  MAX_VISIBLE_INSTANCES,
  validateDimensions,
  type ArrayOpResult,
  type AssocArrayState,
  type ContainerOp,
  type ContainerState,
  type SvElem,
} from "@/lib/systemverilog-array-model";
import { cn } from "@/lib/utils";

import { ContainerControls, ContainerStateView, OpResultPanel } from "./DynamicStructureVisualizer";

// ---- 3D materials ----------------------------------------------------------

const materials = {
  value: new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.5 }),
  unknown: new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.5 }),
  key: new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 }),
  highlight: new THREE.MeshStandardMaterial({ color: 0xdb2777, emissive: 0xc11767 }),
};

const fixedColors = [0x0891b2, 0xbe185d, 0x059669, 0xb45309, 0x5b21b6, 0x4d7c0f, 0x9f1239, 0x1d4ed8];

function Cube({ position, material, label }: { position: [number, number, number]; material: THREE.Material; label?: string }) {
  return (
    <group>
      <mesh position={position} material={material}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {label ? (
        <Text position={[position[0], position[1] + 0.8, position[2]]} fontSize={0.4} color="white" anchorX="center" anchorY="bottom">
          {label}
        </Text>
      ) : null}
    </group>
  );
}

function ElementRow3D({ values, changed = [] }: { values: SvElem[]; changed?: number[] }) {
  return (
    <group position={[-(values.length * 1.5) / 2, 0, 0]}>
      {values.map((v, i) => (
        <Cube
          key={i}
          position={[i * 1.5, 0, 0]}
          material={changed.includes(i) ? materials.highlight : v === "X" ? materials.unknown : materials.value}
          label={`[${i}] ${formatElem(v)}`}
        />
      ))}
    </group>
  );
}

function AssocRow3D({ state }: { state: AssocArrayState }) {
  return (
    <group position={[-(state.entries.length * 2) / 2, 0, 0]}>
      {state.entries.map((e, i) => (
        <group key={String(e.key)}>
          <Cube position={[i * 2, 1.5, 0]} material={e.key === state.iter ? materials.highlight : materials.key} label={formatAssocKey(e.key)} />
          <Cube position={[i * 2, 0, 0]} material={e.value === "X" ? materials.unknown : materials.value} label={formatElem(e.value)} />
        </group>
      ))}
    </group>
  );
}

function FixedArrayView({ packed, unpacked, highlightLogicalIndex }: { packed: number[]; unpacked: number[]; highlightLogicalIndex: number | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const model = useMemo(() => buildArrayInstances({ packed, unpacked }, MAX_VISIBLE_INSTANCES, highlightLogicalIndex), [highlightLogicalIndex, packed, unpacked]);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.9, 0.9, 0.9), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.5, vertexColors: true }), []);

  useLayoutEffect(() => {
    if (!mesh.current || typeof mesh.current.setMatrixAt !== "function") return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    model.instances.forEach((instance, index) => {
      matrix.makeTranslation(...instance.position);
      mesh.current!.setMatrixAt(index, matrix);
      const highlighted = highlightLogicalIndex === instance.logicalIndex;
      mesh.current!.setColorAt(index, color.setHex(highlighted ? 0xdb2777 : fixedColors[instance.colorIndex]));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [highlightLogicalIndex, model]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, model.instances.length]} position={[-5, 0, -5]} />;
}

// ---- 2D packed/unpacked view -------------------------------------------------

const product = (dims: number[]) => dims.reduce((a, b) => a * b, 1);

function decode(index: number, dims: number[]): number[] {
  const out = Array(dims.length).fill(0) as number[];
  let rest = index;
  for (let d = dims.length - 1; d >= 0; d -= 1) {
    out[d] = rest % dims[d];
    rest = Math.floor(rest / dims[d]);
  }
  return out;
}

const MAX_ROWS = 16;
const MAX_CELLS = 64;

/** Text/2D equivalent of the packed/unpacked cube: one row per unpacked element, packed bits MSB first. */
export function PackedArray2D({ packed, unpacked, highlight }: { packed: number[]; unpacked: number[]; highlight: number | null }) {
  const P = product(packed);
  const U = product(unpacked);
  const rows = Math.min(U, MAX_ROWS);
  const cells = Math.min(P, MAX_CELLS);
  return (
    <div className="space-y-2" data-testid="packed-2d">
      <div className="overflow-x-auto">
        <table className="min-w-[300px] border-separate border-spacing-1 font-mono text-[11px] [font-variant-ligatures:none]">
          <caption className="pb-1 text-left font-sans text-xs text-muted-foreground">
            One row per unpacked element (left index varies slowest). Packed bits are drawn MSB first.
            {U > rows || P > cells ? ` Showing ${rows} of ${U} rows and ${cells} of ${P} bits per row.` : ""}
          </caption>
          <tbody>
            {Array.from({ length: rows }, (_, u) => {
              const uc = decode(u, unpacked);
              return (
                <tr key={u}>
                  <th scope="row" className="whitespace-nowrap pr-2 text-left font-normal text-muted-foreground">
                    my_array{uc.map((c) => `[${c}]`).join("")}
                  </th>
                  {Array.from({ length: cells }, (_, k) => {
                    const p = P - 1 - k;
                    const pc = decode(p, packed);
                    const logical = u * P + p;
                    const hit = highlight === logical;
                    return (
                      <td
                        key={k}
                        aria-label={hit ? `my_array${uc.map((c) => `[${c}]`).join("")}${pc.map((c) => `[${c}]`).join("")}, logical bit ${logical}, highlighted` : undefined}
                        className={cn(
                          "rounded border px-1 text-center",
                          hit ? "border-pink-500 bg-pink-500/20 font-bold text-foreground" : "border-border/60 text-muted-foreground",
                        )}
                      >
                        {pc.map((c) => `[${c}]`).join("")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Main component -------------------------------------------------------------

type Mode = "dynamic" | "queue" | "assoc" | "fixed";

const sceneParamToMode: Record<string, Mode> = {
  "dynamic-array": "dynamic",
  queue: "queue",
  associative: "assoc",
  "packed-matrix": "fixed",
  "fixed-array": "fixed",
};
const modeToSceneParam: Record<Mode, string> = { dynamic: "dynamic-array", queue: "queue", assoc: "associative", fixed: "packed-matrix" };

function detectWebGL(): boolean {
  if (typeof window === "undefined" || !("WebGLRenderingContext" in window)) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const initialContainers = () => ({
  dynamic: createDynamicArray("dyn_array", "int", [10, 20, 30]),
  queue: createQueue("q", "int", null, [10, 20, 30]),
  assoc: createAssocArray("aa", "int", "string", [["banana", 8], ["apple", 5], ["Cherry", 3]]),
});

const ASSUMPTIONS = [
  "Container operations use the same tested model as the container lab (§7.5, §7.8–§7.10).",
  "The cube layout is a picture of index order, not of simulator memory: the LRM defines iteration and assignment order, not storage layout.",
  "Large packed/unpacked shapes are capped for rendering; the logical bit numbering stays exact.",
];

interface SystemVerilog3DVisualizerProps {
  className?: string;
  /** Height of the 3D viewport. */
  height?: string | number;
  initialScene?: string;
  /** Mirror the selected scene into ?scene=… (for the standalone route). Pass false inside lessons. */
  syncSceneToUrl?: boolean;
}

export function SystemVerilog3DVisualizer({ className, height = 420, initialScene, syncSceneToUrl = true }: SystemVerilog3DVisualizerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(() => {
    const q = syncSceneToUrl ? searchParams?.get("scene") : null;
    if (q && sceneParamToMode[q]) return sceneParamToMode[q];
    if (initialScene && sceneParamToMode[initialScene]) return sceneParamToMode[initialScene];
    return "dynamic";
  });
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [viewChoice, setViewChoice] = useState<"3d" | "2d" | null>(null);
  const view = viewChoice ?? (webgl ? "3d" : "2d");

  const [containers, setContainers] = useState(initialContainers);
  const [lastResult, setLastResult] = useState<ArrayOpResult | null>(null);

  const [packedDims, setPackedDims] = useState<number[]>([4]);
  const [unpackedDims, setUnpackedDims] = useState<number[]>([2]);
  const [highlightP, setHighlightP] = useState<number[]>([0]);
  const [highlightU, setHighlightU] = useState<number[]>([0]);
  const [activeHighlight, setActiveHighlight] = useState<number | null>(null);
  const [findMessage, setFindMessage] = useState("");
  const fixedModel = useMemo(() => buildArrayInstances({ packed: packedDims, unpacked: unpackedDims }, MAX_VISIBLE_INSTANCES), [packedDims, unpackedDims]);

  useEffect(() => {
    setWebgl(detectWebGL());
  }, []);

  useEffect(() => {
    if (!syncSceneToUrl) return;
    const sp = new URLSearchParams(searchParams?.toString() || "");
    const expected = modeToSceneParam[mode];
    if (sp.get("scene") !== expected) {
      if (mode === "dynamic") sp.delete("scene");
      else sp.set("scene", expected);
      router.replace(`?${sp.toString()}`, { scroll: false });
    }
  }, [mode, router, searchParams, syncSceneToUrl]);

  useEffect(() => setHighlightP(Array(packedDims.length).fill(0)), [packedDims.length]);
  useEffect(() => setHighlightU(Array(unpackedDims.length).fill(0)), [unpackedDims.length]);

  const current: ContainerState | null = mode === "fixed" ? null : containers[mode];

  const run = (op: ContainerOp) => {
    if (!current) return;
    const r = applyContainerOp(current, op);
    const after = r.after;
    setContainers((c) => {
      if (after.kind === "dynamic") return { ...c, dynamic: after };
      if (after.kind === "queue") return { ...c, queue: after };
      return { ...c, assoc: after };
    });
    setLastResult(r);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setLastResult(null);
  };

  const findBit = () => {
    const logical = encodeArrayCoordinates({ packed: packedDims, unpacked: unpackedDims }, { packed: highlightP, unpacked: highlightU });
    setActiveHighlight(logical);
    setFindMessage(
      logical === null
        ? "✕ That index is outside the declared dimensions."
        : `Highlighted logical bit ${logical}: my_array${highlightU.map((c) => `[${c}]`).join("")}${highlightP.map((c) => `[${c}]`).join("")}, unpacked indices first, then packed (§7.4.4).`,
    );
  };

  const setDim = (which: "packed" | "unpacked", i: number, value: number) => {
    const list = which === "packed" ? [...packedDims] : [...unpackedDims];
    list[i] = value;
    const v = validateDimensions(which === "packed" ? { packed: list, unpacked: unpackedDims } : { packed: packedDims, unpacked: list });
    if (which === "packed") setPackedDims(v.packed);
    else setUnpackedDims(v.unpacked);
    setActiveHighlight(null);
    setFindMessage("");
  };

  const declaration = `logic ${packedDims.map((d) => `[${d - 1}:0]`).join("")} my_array ${unpackedDims.map((d) => `[${d}]`).join("")};`;
  const stateSummary =
    mode === "fixed"
      ? `${declaration} ${fixedModel.logicalInstanceCount} logical bits`
      : current?.kind === "assoc"
        ? `${current.name}: ${current.entries.map((e) => `${formatAssocKey(e.key)}=${formatElem(e.value)}`).join(", ") || "empty"}`
        : current
          ? `${current.name}: ${current.values.map(formatElem).join(", ") || "empty"}`
          : "";

  const numberInput =
    "h-9 w-14 rounded-md border border-border bg-background px-1.5 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const twoD =
    mode === "fixed" ? (
      <PackedArray2D packed={packedDims} unpacked={unpackedDims} highlight={activeHighlight} />
    ) : current ? (
      <ContainerStateView state={current} result={lastResult} />
    ) : null;

  return (
    <VisualFrame
      label="SystemVerilog array sandbox"
      eyebrow="Sandbox"
      title="Array sandbox: 3D picture, 2D truth"
      summary="Drive each structure and watch it in 3D, or switch to the 2D view, which shows exactly the same state as text."
      fidelity="model"
      assumptions={ASSUMPTIONS}
      className={cn("bg-card", className)}
    >
      <div data-testid="sv-3d-visualizer" className="space-y-4">
        <SegmentedControl
          label="Structure"
          options={[
            { value: "dynamic" as const, label: "Dynamic array" },
            { value: "queue" as const, label: "Queue" },
            { value: "assoc" as const, label: "Associative array" },
            { value: "fixed" as const, label: "Packed / unpacked" },
          ]}
          value={mode}
          onChange={switchMode}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="View"
            options={[
              { value: "3d" as const, label: "3D", disabled: webgl === false },
              { value: "2d" as const, label: "2D / text" },
            ]}
            value={view}
            onChange={setViewChoice}
          />
          {webgl === false ? <p className="text-xs text-muted-foreground">3D needs WebGL, which is unavailable here. The 2D view shows the same state.</p> : null}
        </div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <div
            data-testid="sv-3d-viewport"
            role={view === "3d" ? "img" : undefined}
            aria-label={view === "3d" ? `3D view. ${stateSummary}` : undefined}
            className={cn("relative min-w-0 overflow-hidden rounded-xl border border-border/70", view === "3d" ? "cursor-move bg-slate-950" : "bg-background/50 p-3")}
            style={view === "3d" ? { height } : undefined}
          >
            {view === "3d" ? (
              <WebGLFallbackBoundary fallback={<div className="h-full overflow-auto bg-background p-3">{twoD}</div>}>
                <Canvas camera={{ position: [6, 6, 10], fov: 60 }} dpr={[1, 1.5]} frameloop="demand">
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[5, 10, 7.5]} intensity={1} />
                  <Grid args={[50, 50]} cellColor="#444" sectionColor="#444" fadeDistance={30} infiniteGrid />
                  <OrbitControls makeDefault dampingFactor={0.1} />
                  {mode === "dynamic" ? <ElementRow3D values={containers.dynamic.values} changed={lastResult?.changedIndices} /> : null}
                  {mode === "queue" ? <ElementRow3D values={containers.queue.values} changed={lastResult?.changedIndices} /> : null}
                  {mode === "assoc" ? <AssocRow3D state={containers.assoc} /> : null}
                  {mode === "fixed" ? <FixedArrayView packed={packedDims} unpacked={unpackedDims} highlightLogicalIndex={activeHighlight} /> : null}
                </Canvas>
              </WebGLFallbackBoundary>
            ) : (
              twoD
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {current ? (
              <>
                <p className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">{declarationOf(current)}</p>
                <ContainerControls key={mode} state={current} onRun={run} />
                <div aria-live="polite" className="rounded-xl border border-border/70 bg-background/50 p-3">
                  {lastResult ? <OpResultPanel result={lastResult} elemType={current.elemType} /> : <p className="text-sm text-muted-foreground">Run an operation to see its code, result and rule.</p>}
                </div>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-mono text-xs text-foreground [font-variant-ligatures:none]">{declaration}</p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Packed dimensions (before the name)</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {packedDims.map((d, i) => (
                      <input key={i} aria-label={`Packed dimension ${i + 1} size`} type="number" min={1} max={64} value={d} onChange={(e) => setDim("packed", i, Number(e.target.value))} className={numberInput} />
                    ))}
                    <button type="button" disabled={packedDims.length >= 3} onClick={() => setPackedDims([...packedDims, 2])} className="h-9 rounded-md border border-border/70 px-2 text-xs hover:bg-muted disabled:opacity-40" aria-label="Add packed dimension">
                      +
                    </button>
                    <button type="button" disabled={packedDims.length <= 1} onClick={() => setPackedDims(packedDims.slice(0, -1))} className="h-9 rounded-md border border-border/70 px-2 text-xs hover:bg-muted disabled:opacity-40" aria-label="Remove packed dimension">
                      −
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Unpacked dimensions (after the name)</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {unpackedDims.map((d, i) => (
                      <input key={i} aria-label={`Unpacked dimension ${i + 1} size`} type="number" min={1} max={64} value={d} onChange={(e) => setDim("unpacked", i, Number(e.target.value))} className={numberInput} />
                    ))}
                    <button type="button" disabled={unpackedDims.length >= 3} onClick={() => setUnpackedDims([...unpackedDims, 2])} className="h-9 rounded-md border border-border/70 px-2 text-xs hover:bg-muted disabled:opacity-40" aria-label="Add unpacked dimension">
                      +
                    </button>
                    <button type="button" disabled={unpackedDims.length <= 1} onClick={() => setUnpackedDims(unpackedDims.slice(0, -1))} className="h-9 rounded-md border border-border/70 px-2 text-xs hover:bg-muted disabled:opacity-40" aria-label="Remove unpacked dimension">
                      −
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] p-3 text-xs text-foreground">
                  <p className="font-semibold">The one rule (§7.4.4)</p>
                  <p className="mt-1">
                    You write the unpacked indices first, then the packed ones: <code className="font-mono">my_array{unpackedDims.map((_, i) => `[u${i + 1}]`).join("")}{packedDims.map((_, i) => `[p${i + 1}]`).join("")}</code>. In that list the rightmost index varies fastest, and every packed dimension varies faster than every unpacked one.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Find a bit by index</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {highlightU.map((v, i) => (
                      <label key={`u${i}`} className="flex items-center gap-1">
                        u{i + 1}
                        <input aria-label={`Unpacked index ${i + 1}`} type="number" value={v} onChange={(e) => setHighlightU(highlightU.map((x, j) => (j === i ? Number(e.target.value) : x)))} className={numberInput} />
                      </label>
                    ))}
                    {highlightP.map((v, i) => (
                      <label key={`p${i}`} className="flex items-center gap-1">
                        p{i + 1}
                        <input aria-label={`Packed index ${i + 1}`} type="number" value={v} onChange={(e) => setHighlightP(highlightP.map((x, j) => (j === i ? Number(e.target.value) : x)))} className={numberInput} />
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={findBit} className="min-h-10 rounded-lg border border-cyan-500/50 px-3 text-xs hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Find bit
                  </button>
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {findMessage || `${fixedModel.logicalInstanceCount.toLocaleString()} logical bits${fixedModel.truncated ? ` (3D preview capped at ${fixedModel.instances.length.toLocaleString()})` : ""}.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export default SystemVerilog3DVisualizer;
