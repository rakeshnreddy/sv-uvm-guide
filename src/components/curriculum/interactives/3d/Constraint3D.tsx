// @ts-nocheck
'use client';

import React, { useRef, useState } from 'react';
// @ts-nocheck
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const TreeNode = ({ position, label, color, opacity = 1 }: { position: [number, number, number], label: string, color: string, opacity?: number }) => {
    return (
        <group position={position}>
            <mesh>
                <sphereGeometry args={[0.3]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <Text position={[0, -0.5, 0]} fontSize={0.2} color="white" fillOpacity={opacity}>
                {label}
            </Text>
        </group>
    );
};

export default function Constraint3D() {
    const [step, setStep] = useState(0);

    // Tree positions
    const rootPos: [number, number, number] = [0, 3, 0];
    const l1Pos: [number, number, number] = [-2, 1, 0];
    const r1Pos: [number, number, number] = [2, 1, 0];

    const l2aPos: [number, number, number] = [-3, -1, 0];
    const l2bPos: [number, number, number] = [-1, -1, 0];

    const r2aPos: [number, number, number] = [1, -1, 0];
    const r2bPos: [number, number, number] = [3, -1, 0];

    // Colors based on step
    const l1Color = step >= 1 ? "#ef4444" : "#3b82f6"; // Pruned at step 1
    const r1Color = step >= 1 ? "#22c55e" : "#3b82f6"; // Selected

    const l2aColor = step >= 2 ? "#ef4444" : "#3b82f6";
    const l2bColor = step >= 2 ? "#ef4444" : "#3b82f6";
    const r2aColor = step >= 2 ? "#ef4444" : "#3b82f6"; // Pruned at step 2
    const r2bColor = step >= 2 ? "#22c55e" : "#3b82f6"; // Final Solution

    return (
        <div className="w-full h-[400px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">Constraint Solver Domain</h3>
                <p className="text-sm text-slate-300 mt-1 bg-slate-900/50 p-1 rounded inline-block">Branch Pruning & Solution Search Space</p>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2 justify-center">
                <button
                    onClick={() => setStep(0)}
                    className={`px-4 py-2 rounded font-mono text-sm shadow-lg ${step === 0 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Initial State
                </button>
                <button
                    onClick={() => setStep(1)}
                    className={`px-4 py-2 rounded font-mono text-sm shadow-lg ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Apply: addr {'<'} 100
                </button>
                <button
                    onClick={() => setStep(2)}
                    className={`px-4 py-2 rounded font-mono text-sm shadow-lg ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Apply: data == 0
                </button>
            </div>

            <Canvas camera={{ position: [0, 1, 8], fov: 45 }}>
                <fog attach="fog" args={["#0f172a", 5, 20]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[0, 5, 5]} intensity={1.5} />

                {/* Edges */}
                <Line points={[rootPos, l1Pos]} color={l1Color} lineWidth={step >= 1 ? 1 : 2} transparent opacity={step >= 1 ? 0.3 : 1} />
                <Line points={[rootPos, r1Pos]} color={r1Color} lineWidth={2} />

                <Line points={[l1Pos, l2aPos]} color={l2aColor} lineWidth={1} transparent opacity={step >= 1 ? 0.3 : 1} />
                <Line points={[l1Pos, l2bPos]} color={l2bColor} lineWidth={1} transparent opacity={step >= 1 ? 0.3 : 1} />

                <Line points={[r1Pos, r2aPos]} color={r2aColor} lineWidth={step >= 2 ? 1 : 2} transparent opacity={step >= 2 ? 0.3 : 1} />
                <Line points={[r1Pos, r2bPos]} color={r2bColor} lineWidth={2} />

                {/* Nodes */}
                <TreeNode position={rootPos} label="Start" color={step > 0 ? "#22c55e" : "#3b82f6"} />

                <TreeNode position={l1Pos} label="addr >= 100" color={l1Color} opacity={step >= 1 ? 0.3 : 1} />
                <TreeNode position={r1Pos} label="addr < 100" color={r1Color} />

                <TreeNode position={l2aPos} label="data=1" color={l2aColor} opacity={step >= 1 ? 0.3 : 1} />
                <TreeNode position={l2bPos} label="data=0" color={l2bColor} opacity={step >= 1 ? 0.3 : 1} />

                <TreeNode position={r2aPos} label="data=1" color={r2aColor} opacity={step >= 2 ? 0.3 : 1} />
                <TreeNode position={r2bPos} label="data=0 (Solution)" color={r2bColor} />

                <OrbitControls
                    enablePan={false}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 1.5}
                />
            </Canvas>
        </div>
    );
}
