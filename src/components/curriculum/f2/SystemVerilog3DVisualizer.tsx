"use client";

import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { WebGLFallbackBoundary } from "@/components/ui/WebGLFallbackBoundary";
import { useSearchParams, useRouter } from "next/navigation";
import {
  buildArrayInstances,
  createQueueIdAllocator,
  MAX_VISIBLE_INSTANCES,
  validateDimensions,
} from "@/lib/systemverilog-array-model";

// ---- Shared Materials & Helpers ----
const materials = {
  blue: new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.5 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 }),
  hover: new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xccaa00 }),
  highlight: new THREE.MeshStandardMaterial({ color: 0xdb2777, emissive: 0xc11767 }),
};

const fixedColors = [0x0891b2, 0xbe185d, 0x059669, 0xb45309, 0x5b21b6, 0x4d7c0f, 0x9f1239, 0x1d4ed8];

function AnimatedCube({
  targetPos,
  targetScale = 1,
  material,
  tooltip,
  label,
  isHighlighted,
}: {
  targetPos: [number, number, number];
  targetScale?: number;
  material: THREE.Material;
  tooltip?: string;
  label?: string;
  isHighlighted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group>
      <mesh
        position={targetPos}
        scale={targetScale}
        material={isHighlighted ? materials.highlight : hovered ? materials.hover : material}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {label && (
        <Text position={[targetPos[0], targetPos[1] + 0.8, targetPos[2]]} fontSize={0.4} color="white" anchorX="center" anchorY="bottom">
          {label}
        </Text>
      )}
      {hovered && tooltip && (
        <Html position={[targetPos[0], targetPos[1] + 0.5, targetPos[2]]} center style={{ pointerEvents: "none" }}>
          <div className="bg-black/90 text-white text-xs px-2 py-1 rounded border border-white/20 whitespace-nowrap shadow-lg">
            <code>{tooltip}</code>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---- Data Structure Views ----

function DynamicArrayView({ items }: { items: number[] }) {
  return (
    <group>
      {items.map((val, i) => (
        <AnimatedCube
          key={`dyn-${val}-${i}`}
          targetPos={[i * 1.5, 0, 0]}
          material={materials.blue}
          label={String(val)}
          tooltip={`dyn_array[${i}] = ${val}`}
        />
      ))}
    </group>
  );
}

function QueueView({ items }: { items: { id: number; val: number }[] }) {
  return (
    <group>
      {items.map((item, i) => (
        <AnimatedCube
          key={`q-${item.id}`}
          targetPos={[i * 1.5, 0, 0]}
          material={materials.pink}
          label={String(item.val)}
          tooltip={`q[${i}] = ${item.val}`}
        />
      ))}
    </group>
  );
}

function AssocArrayView({ entries, highlightKey }: { entries: [string, number][]; highlightKey: string | null }) {
  const radius = Math.max(4, entries.length * 1.2);
  const angleStep = entries.length > 0 ? (2 * Math.PI) / entries.length : 0;

  return (
    <group>
      {entries.map(([key, val], i) => {
        const angle = i * angleStep;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const isHigh = key === highlightKey;
        return (
          <group key={`aa-${key}`}>
            <AnimatedCube targetPos={[x, 1.5, z]} material={materials.green} label={`"${key}"`} isHighlighted={isHigh} tooltip={`Key: "${key}"`} />
            <AnimatedCube targetPos={[x, 0, z]} material={materials.blue} label={String(val)} isHighlighted={isHigh} tooltip={`Value: ${val}`} />
          </group>
        );
      })}
    </group>
  );
}

function FixedArrayView({
  packed,
  unpacked,
  highlightIndices,
}: {
  packed: number[];
  unpacked: number[];
  highlightIndices: { u: number[]; p: number[] } | null;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const model = useMemo(
    () => buildArrayInstances({ packed, unpacked }, MAX_VISIBLE_INSTANCES),
    [packed, unpacked],
  );
  const geometry = useMemo(() => new THREE.BoxGeometry(0.9, 0.9, 0.9), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.5, vertexColors: true }),
    [],
  );

  useLayoutEffect(() => {
    if (!mesh.current || typeof mesh.current.setMatrixAt !== "function") return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    model.instances.forEach((instance, index) => {
      matrix.makeTranslation(...instance.position);
      mesh.current!.setMatrixAt(index, matrix);
      const highlighted = highlightIndices && instance.logicalIndex === 0;
      mesh.current!.setColorAt(index, color.setHex(highlighted ? 0xdb2777 : fixedColors[instance.colorIndex]));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [highlightIndices, model]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return <instancedMesh ref={mesh} args={[geometry, material, model.instances.length]} position={[-5, 0, -5]} />;
}

// ---- Main Component ----

type Mode = "dynamic" | "queue" | "assoc" | "fixed";

export function SystemVerilog3DVisualizer({ className, height = "720px", initialScene }: { className?: string; height?: string | number; initialScene?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mode mapping handling like prototype
  const sceneParamToMode: Record<string, Mode> = {
    'dynamic-array': 'dynamic',
    'queue': 'queue',
    'associative': 'assoc',
    'packed-matrix': 'fixed',
    'fixed-array': 'fixed',
  };

  const getInitialMode = (): Mode => {
    const qScene = searchParams?.get("scene");
    if (qScene && sceneParamToMode[qScene]) return sceneParamToMode[qScene];
    if (initialScene && sceneParamToMode[initialScene]) return sceneParamToMode[initialScene];
    return "dynamic";
  };

  const [mode, setMode] = useState<Mode>(getInitialMode);

  // Dynamic Array
  const [dynSizeInput, setDynSizeInput] = useState(8);
  const [dynArray, setDynArray] = useState<number[]>([]);
  const [lastOp, setLastOp] = useState<string>("null");

  // Queue
  const [queueItems, setQueueItems] = useState<{ id: number; val: number }[]>([]);
  const queueIds = useRef(createQueueIdAllocator());
  const [qValInput, setQValInput] = useState(10);
  const [qIdxInput, setQIdxInput] = useState(1);
  const [qInsValInput, setQInsValInput] = useState(99);

  // Assoc Array
  const [assocMap, setAssocMap] = useState<Map<string, number>>(new Map());
  const [aaKeyInput, setAaKeyInput] = useState("apple");
  const [aaValInput, setAaValInput] = useState(5);
  const [aaIterKey, setAaIterKey] = useState<string | null>(null);

  // Fixed Array
  const [packedDims, setPackedDims] = useState<number[]>([4]);
  const [unpackedDims, setUnpackedDims] = useState<number[]>([2]);
  const [highlightP, setHighlightP] = useState<number[]>([0]);
  const [highlightU, setHighlightU] = useState<number[]>([0]);
  const [activeHighlight, setActiveHighlight] = useState<{ u: number[]; p: number[] } | null>(null);
  const fixedModel = useMemo(
    () => buildArrayInstances({ packed: packedDims, unpacked: unpackedDims }, MAX_VISIBLE_INSTANCES),
    [packedDims, unpackedDims],
  );

  const entriesAsc = useMemo(() => Array.from(assocMap.entries()).sort((a,b) => a[0].localeCompare(b[0])), [assocMap]);
  const keysAsc = entriesAsc.map(e => e[0]);

  // Sync mode with URL if needed
  useEffect(() => {
    const modeToSceneParam = { dynamic: 'dynamic-array', queue: 'queue', assoc: 'associative', fixed: 'packed-matrix' };
    const sp = new URLSearchParams(searchParams?.toString() || "");
    const expectedQuery = modeToSceneParam[mode];
    if (sp.get("scene") !== expectedQuery) {
      if (mode === "dynamic") sp.delete("scene");
      else sp.set("scene", expectedQuery);
      // Wait for mount
      const query = sp.toString();
      router.replace(`?${query}`, { scroll: false });
    }
  }, [mode, router, searchParams]);

  // Initialize with prototype values
  useEffect(() => {
    setDynArray([1, 2, 3, 4, 5]);
    setQueueItems([
      { id: queueIds.current.next(), val: 10 },
      { id: queueIds.current.next(), val: 20 },
      { id: queueIds.current.next(), val: 30 },
    ]);
    const m = new Map();
    m.set('apple', 5);
    m.set('banana', 8);
    m.set('cherry', 3);
    setAssocMap(m);
  }, []);

  // Handlers
  const runDynNew = () => {
    const size = Math.max(0, Math.min(128, Number.isFinite(dynSizeInput) ? Math.trunc(dynSizeInput) : 0));
    setDynSizeInput(size);
    setDynArray(Array.from({ length: size }, (_, i) => i + 1));
    setLastOp(`dyn_array = new[${size}];`);
  };
  const runDynDelete = () => { setDynArray([]); setLastOp(`dyn_array.delete();`); };

  const qPushBack = () => { setQueueItems((items) => items.length >= 128 ? items : [...items, { id: queueIds.current.next(), val: qValInput }]); setLastOp(`q.push_back(${qValInput});`); };
  const qPushFront = () => { setQueueItems((items) => items.length >= 128 ? items : [{ id: queueIds.current.next(), val: qValInput }, ...items]); setLastOp(`q.push_front(${qValInput});`); };
  const qPopBack = () => { setQueueItems((items) => items.slice(0, -1)); setLastOp(`q.pop_back();`); };
  const qPopFront = () => { setQueueItems((items) => items.slice(1)); setLastOp(`q.pop_front();`); };
  const qInsert = () => {
    setQueueItems((items) => {
      if (items.length >= 128 || qIdxInput < 0 || qIdxInput > items.length) return items;
      const copy = [...items];
      copy.splice(qIdxInput, 0, { id: queueIds.current.next(), val: qInsValInput });
      return copy;
    });
    setLastOp(`q.insert(${qIdxInput}, ${qInsValInput});`);
  };
  const qDelete = () => {
    setQueueItems((items) => items.filter((_, index) => index !== qIdxInput));
    setLastOp(`q.delete(${qIdxInput});`);
  };

  const aaAssign = () => {
    if (!aaKeyInput) return;
    const m = new Map(assocMap);
    if (!m.has(aaKeyInput) && m.size >= 128) return;
    m.set(aaKeyInput.slice(0, 64), aaValInput);
    setAssocMap(m);
    setLastOp(`aa["${aaKeyInput}"] = ${aaValInput};`);
  };
  const aaDelete = () => {
    const m = new Map(assocMap);
    if (m.has(aaKeyInput)) {
      m.delete(aaKeyInput);
      setAssocMap(m);
      if (aaIterKey === aaKeyInput) setAaIterKey(null);
      setLastOp(`aa.delete("${aaKeyInput}");`);
    }
  };
  const aaExists = () => {
    if (assocMap.has(aaKeyInput)) {
      setAaIterKey(aaKeyInput);
      setLastOp(`aa.exists("${aaKeyInput}") // True`);
    } else {
      setAaIterKey(null);
      setLastOp(`aa.exists("${aaKeyInput}") // False`);
    }
  };
  const aaFirst = () => { if (keysAsc.length) { setAaIterKey(keysAsc[0]); setLastOp(`key = aa.first();`); } };
  const aaLast = () => { if (keysAsc.length) { setAaIterKey(keysAsc[keysAsc.length - 1]); setLastOp(`key = aa.last();`); } };
  const aaNext = () => {
    const idx = keysAsc.indexOf(aaIterKey as string);
    if (idx >= 0 && idx < keysAsc.length - 1) { setAaIterKey(keysAsc[idx + 1]); setLastOp(`key = aa.next(key);`); }
  };
  const aaPrev = () => {
    const idx = keysAsc.indexOf(aaIterKey as string);
    if (idx > 0) { setAaIterKey(keysAsc[idx - 1]); setLastOp(`key = aa.prev(key);`); }
  };

  const runFixedUpdate = () => {
    const validated = validateDimensions({ packed: packedDims, unpacked: unpackedDims });
    setPackedDims(validated.packed);
    setUnpackedDims(validated.unpacked);
    setActiveHighlight(null);
    setLastOp(`Updated Dimensions`);
  };
  const runFixedHighlight = () => {
    setActiveHighlight({ p: [...highlightP], u: [...highlightU] });
    setLastOp(`Highlight active`);
  };

  // Ensure highlight arrays match dims
  useEffect(() => { setHighlightP(Array(packedDims.length).fill(0)); }, [packedDims.length]);
  useEffect(() => { setHighlightU(Array(unpackedDims.length).fill(0)); }, [unpackedDims.length]);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-3xl border border-border/60 bg-black/90", className)} style={{ height }} data-testid="sv-3d-visualizer">
      {/* 3D Canvas */}
      <div className="absolute inset-0 cursor-move">
        <WebGLFallbackBoundary>
          <Canvas camera={{ position: [10, 8, 10], fov: 75 }} dpr={[1, 1.5]} frameloop="demand">
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 7.5]} intensity={1} />
            <Grid args={[50, 50]} cellColor="#444" sectionColor="#444" fadeDistance={30} infiniteGrid />
            <OrbitControls makeDefault dampingFactor={0.1} />
            
            {mode === "dynamic" && <DynamicArrayView items={dynArray} />}
            {mode === "queue" && <QueueView items={queueItems} />}
            {mode === "assoc" && <AssocArrayView entries={entriesAsc} highlightKey={aaIterKey} />}
            {mode === "fixed" && <FixedArrayView packed={packedDims} unpacked={unpackedDims} highlightIndices={activeHighlight} />}
          </Canvas>
        </WebGLFallbackBoundary>
      </div>

      {/* Control Panel overlay */}
      <div className="absolute top-4 left-4 w-[360px] max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/90 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-2xl text-slate-200">
        <h2 className="text-xl font-bold mb-4 text-white">SV Data Structures</h2>
        
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="mb-4 bg-slate-800 border-slate-700">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dynamic">Dynamic Array</SelectItem>
            <SelectItem value="queue">Queue</SelectItem>
            <SelectItem value="assoc">Associative Array</SelectItem>
            <SelectItem value="fixed">Fixed/Packed Array</SelectItem>
          </SelectContent>
        </Select>

        {mode === "dynamic" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runDynNew} className="bg-emerald-600 hover:bg-emerald-500 w-full text-xs">new [size]</Button>
              <Input type="number" value={dynSizeInput} onChange={e => setDynSizeInput(Number(e.target.value))} className="w-20 bg-slate-800 border-slate-700" />
            </div>
            <Button onClick={runDynDelete} className="bg-rose-700 hover:bg-rose-600 w-full text-xs">delete()</Button>
            <div className="bg-slate-800 p-3 rounded text-sm space-y-1 mt-4">
              <p>Size: <code className="text-indigo-300 ml-2">dyn.size() = {dynArray.length}</code></p>
              <p>Last Op: <code className="text-indigo-300 ml-2">{lastOp}</code></p>
            </div>
            <ul className="text-xs text-slate-400 list-disc ml-4 space-y-1">
              <li>Unsized array resized at runtime.</li>
              <li>Contiguous block of memory.</li>
            </ul>
          </div>
        )}

        {mode === "queue" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={qPushBack} className="bg-emerald-600 hover:bg-emerald-500 flex-1 text-xs px-2">push_back(val)</Button>
              <Input type="number" value={qValInput} onChange={e => setQValInput(Number(e.target.value))} className="w-16 h-8 bg-slate-800 border-slate-700" />
            </div>
            <Button onClick={qPushFront} className="bg-emerald-600 hover:bg-emerald-500 w-full text-xs h-8">push_front({qValInput})</Button>
            <div className="flex gap-2">
              <Button onClick={qPopFront} className="bg-rose-700 hover:bg-rose-600 flex-1 text-xs h-8">pop_front()</Button>
              <Button onClick={qPopBack} className="bg-rose-700 hover:bg-rose-600 flex-1 text-xs h-8">pop_back()</Button>
            </div>
            <div className="flex gap-2 items-center">
              <Button onClick={qInsert} className="bg-blue-600 hover:bg-blue-500 flex-1 text-xs px-2 h-8">insert(idx,val)</Button>
              <Input type="number" value={qIdxInput} onChange={e=>setQIdxInput(Number(e.target.value))} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" placeholder="idx" />
              <Input type="number" value={qInsValInput} onChange={e=>setQInsValInput(Number(e.target.value))} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" placeholder="val" />
            </div>
             <div className="flex gap-2 items-center">
              <Button onClick={qDelete} className="bg-rose-700 hover:bg-rose-600 flex-1 text-xs px-2 h-8">delete(idx)</Button>
              <Input type="number" value={qIdxInput} onChange={e=>setQIdxInput(Number(e.target.value))} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" placeholder="idx" />
            </div>
            <div className="bg-slate-800 p-3 rounded text-xs space-y-1 mt-4">
              <p>Size: <code className="text-indigo-300 ml-2">q.size() = {queueItems.length}</code></p>
              <p>Last Op: <code className="text-indigo-300 ml-2">{lastOp}</code></p>
            </div>
            <ul className="text-xs text-slate-400 list-disc ml-4 space-y-1">
              <li>Ordered collection of elements.</li>
              <li>Efficient insertion at boundaries.</li>
            </ul>
          </div>
        )}

        {mode === "assoc" && (
          <div className="space-y-3">
             <div className="flex gap-2 items-center">
              <Button onClick={aaAssign} className="bg-emerald-600 hover:bg-emerald-500 flex-1 px-1 h-8 text-[11px]">aa[key]=val</Button>
               <Input type="text" value={aaKeyInput} onChange={e=>setAaKeyInput(e.target.value)} className="w-16 h-8 p-1 bg-slate-800 border-slate-700" placeholder="key"/>
               <Input type="number" value={aaValInput} onChange={e=>setAaValInput(Number(e.target.value))} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" placeholder="val"/>
            </div>
             <div className="flex gap-2">
              <Button onClick={aaExists} className="bg-blue-600 hover:bg-blue-500 flex-1 text-xs h-8">exists(key)</Button>
              <Button onClick={aaDelete} className="bg-rose-700 hover:bg-rose-600 flex-1 text-xs h-8">delete(key)</Button>
            </div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase pt-2">Traversal</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={aaFirst} className="bg-amber-600 hover:bg-amber-500 h-8 text-xs text-secondary-foreground text-white bg-opacity-90">first()</Button>
              <Button onClick={aaLast} className="bg-amber-600 hover:bg-amber-500 h-8 text-xs text-secondary-foreground text-white bg-opacity-90">last()</Button>
              <Button onClick={aaPrev} className="bg-amber-600 hover:bg-amber-500 h-8 text-xs text-secondary-foreground text-white bg-opacity-90">prev()</Button>
              <Button onClick={aaNext} className="bg-amber-600 hover:bg-amber-500 h-8 text-xs text-secondary-foreground text-white bg-opacity-90">next()</Button>
            </div>
             <div className="bg-slate-800 p-3 rounded text-xs space-y-1 mt-2">
              <p>Entries: <code className="text-indigo-300 ml-2">aa.num() = {assocMap.size}</code></p>
              <p>Active Key: <code className="text-indigo-300 ml-2">{aaIterKey ?? 'null'}</code></p>
              <p>Last Op: <code className="text-indigo-300 ml-2">{lastOp}</code></p>
            </div>
            <ul className="text-xs text-slate-400 list-disc ml-4 space-y-1 pt-1">
              <li>Key-value map, hash table.</li>
              <li>Not stored contiguously.</li>
            </ul>
          </div>
        )}

        {mode === "fixed" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs mb-1 text-slate-400">Packed Dims (left to right)</p>
              <div className="flex gap-1 mb-2">
                {packedDims.map((d, i) => (
                  <Input key={i} type="number" min={1} max={64} value={d} onChange={e=> { const nd=[...packedDims]; nd[i]=Number(e.target.value); setPackedDims(validateDimensions({ packed: nd, unpacked: unpackedDims }).packed);}} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" />
                ))}
                {packedDims.length < 3 && <Button onClick={()=>setPackedDims([...packedDims, 4])} className="h-8 px-2 bg-slate-700 border-slate-600">+</Button>}
                {packedDims.length > 1 && <Button onClick={()=>setPackedDims(packedDims.slice(0,-1))} className="h-8 px-2 bg-rose-900 border border-slate-700">-</Button>}
              </div>
            </div>
            <div>
              <p className="text-xs mb-1 text-slate-400">Unpacked Dims (left to right)</p>
              <div className="flex gap-1 mb-2">
                {unpackedDims.map((d, i) => (
                  <Input key={i} type="number" min={1} max={64} value={d} onChange={e=> { const nd=[...unpackedDims]; nd[i]=Number(e.target.value); setUnpackedDims(validateDimensions({ packed: packedDims, unpacked: nd }).unpacked);}} className="w-12 h-8 p-1 bg-slate-800 border-slate-700" />
                ))}
                {unpackedDims.length < 3 && <Button onClick={()=>setUnpackedDims([...unpackedDims, 2])} className="h-8 px-2 bg-slate-700 border-slate-600">+</Button>}
                {unpackedDims.length > 1 && <Button onClick={()=>setUnpackedDims(unpackedDims.slice(0,-1))} className="h-8 px-2 bg-rose-900 border border-slate-700">-</Button>}
              </div>
            </div>
            <Button onClick={runFixedUpdate} className="bg-blue-600 hover:bg-blue-500 w-full h-8 text-xs">Update View</Button>

            <p className="text-xs text-slate-400" aria-live="polite">
              Showing {fixedModel.instances.length.toLocaleString()} of {fixedModel.logicalInstanceCount.toLocaleString()} logical bits
              {fixedModel.truncated ? " (LOD preview capped for performance)" : ""}.
            </p>

            <div className="bg-slate-800 p-2 rounded text-[10px] space-y-1">
               <code>logic {packedDims.map(d=>`[${Math.max(0,d-1)}:0]`).join("")} my_array {unpackedDims.map(d=>`[${d}]`).join("")};</code>
            </div>

            <div className="border-t border-slate-700 pt-3">
               <p className="text-xs mb-2 font-semibold text-emerald-400">Highlight Bit by Index</p>
               <div className="grid grid-cols-2 gap-2 text-xs">
                 {highlightU.map((v, i) => (
                   <div key={`hu${i}`} className="flex items-center justify-between gap-1">u{i+1}: <Input type="number" value={v} onChange={e=>{const n=[...highlightU]; n[i]=Number(e.target.value); setHighlightU(n);}} className="h-6 p-1 bg-slate-800 border-slate-700 w-10"/></div>
                 ))}
                 {highlightP.map((v, i) => (
                   <div key={`hp${i}`} className="flex items-center justify-between gap-1">p{i+1}: <Input type="number" value={v} onChange={e=>{const n=[...highlightP]; n[i]=Number(e.target.value); setHighlightP(n);}} className="h-6 p-1 bg-slate-800 border-slate-700 w-10"/></div>
                 ))}
               </div>
               <Button onClick={runFixedHighlight} className="bg-emerald-600 hover:bg-emerald-500 w-full mt-2 h-8 text-xs">Find Bit</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemVerilog3DVisualizer;
