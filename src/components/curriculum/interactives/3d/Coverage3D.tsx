// @ts-nocheck
'use client';

import React, { useRef, useMemo } from 'react';
// @ts-nocheck
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

const CoverageTower = ({ position, height, color, label }: { position: [number, number, number], height: number, color: string, label: string }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Animate the tower growing slightly or pulsating
    useFrame((state) => {
        if (meshRef.current) {
            // Just a small idle animation
            const time = state.clock.getElapsedTime();
            meshRef.current.position.y = (height / 2) + Math.sin(time * 2 + position[0]) * 0.02;
        }
    });

    return (
        <group position={[position[0], 0, position[2]]}>
            <mesh ref={meshRef} position={[0, height / 2, 0]}>
                <boxGeometry args={[0.8, height, 0.8]} />
                <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Platform/Base */}
            <mesh position={[0, -0.05, 0]}>
                <boxGeometry args={[0.9, 0.1, 0.9]} />
                <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Label */}
            <Text position={[0, -0.3, 0.5]} fontSize={0.25} color="white" anchorY="top">
                {label}
            </Text>
            <Text position={[0, height + 0.2, 0]} fontSize={0.3} color="white" anchorY="bottom">
                {Math.round((height / 4) * 100)}%
            </Text>
        </group>
    );
};

export default function Coverage3D() {
    // Generate random stable heights for functional coverage bins
    const bins = useMemo(() => {
        const data = [];
        const labels = ["cp_read", "cp_write", "cp_reset", "cp_error", "cross_1"];
        for (let i = 0; i < 5; i++) {
            const p = Math.random();
            const height = 0.5 + p * 3.5; // Max height 4

            let color = "#ef4444"; // Red (not covered)
            if (height > 3) color = "#22c55e"; // Green (fully covered)
            else if (height > 1.5) color = "#eab308"; // Yellow (partially covered)

            data.push({ x: (i - 2) * 1.5, height, color, label: labels[i] });
        }
        return data;
    }, []);

    return (
        <div className="w-full h-[400px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">Functional Coverage Topology</h3>
                <p className="text-sm text-slate-300 mt-1">Heat-map towers indicating coverage progress.</p>
                <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/30">100% Hit</span>
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">Partial</span>
                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/30">0% Hit</span>
                </div>
            </div>

            <Canvas camera={{ position: [0, 4, 7], fov: 45 }}>
                <fog attach="fog" args={["#0f172a", 5, 15]} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <spotLight position={[-5, 5, 5]} intensity={1} angle={0.3} penumbra={1} />

                {/* Floor Grid */}
                <gridHelper args={[10, 10, "#334155", "#1e293b"]} position={[0, -0.1, 0]} />

                {bins.map((bin, i) => (
                    <CoverageTower
                        key={i}
                        position={[bin.x, 0, 0]}
                        height={bin.height}
                        color={bin.color}
                        label={bin.label}
                    />
                ))}

                <OrbitControls
                    enablePan={true}
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2 + 0.1}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>
        </div>
    );
}
