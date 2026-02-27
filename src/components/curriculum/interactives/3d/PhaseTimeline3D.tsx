// @ts-nocheck
'use client';

import React, { useRef } from 'react';
// @ts-nocheck
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

const PhaseBlock = ({ position, width, color, label }: { position: [number, number, number], width: number, color: string, label: string }) => {
    return (
        <group position={position}>
            <Box args={[width, 0.4, 0.4]}>
                <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Text position={[0, 0, 0.25]} fontSize={0.15} color="white">
                {label}
            </Text>
        </group>
    );
};

const ProgressPlane = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const time = (state.clock.getElapsedTime() % 10); // 10 second loop
            const xPos = -4.5 + (time / 10) * 9; // Map 0-10s to -4.5 to 4.5
            meshRef.current.position.x = xPos;
        }
    });

    return (
        <mesh ref={meshRef} position={[-4.5, 0, 0]}>
            <planeGeometry args={[0.05, 4]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
    );
};

export default function PhaseTimeline3D() {
    return (
        <div className="w-full h-[400px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">UVM Phase Concurrency</h3>
                <p className="text-sm text-slate-300 mt-1 bg-slate-900/50 p-1 rounded inline-block">Time-consuming phases overlap across components</p>
            </div>

            <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                <fog attach="fog" args={["#0f172a", 5, 20]} />
                <ambientLight intensity={0.6} />
                <pointLight position={[0, 5, 5]} intensity={1.5} />

                {/* Timeline background grid */}
                <gridHelper args={[10, 10, "#334155", "#1e293b"]} position={[0, 0, -1]} rotation={[Math.PI / 2, 0, 0]} />

                {/* Component A Timeline */}
                <group position={[0, 1, 0]}>
                    <Text position={[-5.5, 0, 0]} fontSize={0.2} color="white" anchorX="right">Comp A</Text>
                    <PhaseBlock position={[-3, 0, 0]} width={2} color="#3b82f6" label="reset" />
                    <PhaseBlock position={[-0.5, 0, 0]} width={1} color="#f59e0b" label="configure" />
                    <PhaseBlock position={[2, 0, 0]} width={4} color="#22c55e" label="main" />
                </group>

                {/* Component B Timeline */}
                <group position={[0, -0.2, 0]}>
                    <Text position={[-5.5, 0, 0]} fontSize={0.2} color="white" anchorX="right">Comp B</Text>
                    <PhaseBlock position={[-2.5, 0, 0]} width={3} color="#3b82f6" label="reset" />
                    <PhaseBlock position={[1, 0, 0]} width={2} color="#f59e0b" label="configure" />
                    <PhaseBlock position={[3.5, 0, 0]} width={1} color="#22c55e" label="main" />
                </group>

                {/* Component C Timeline */}
                <group position={[0, -1.4, 0]}>
                    <Text position={[-5.5, 0, 0]} fontSize={0.2} color="white" anchorX="right">Comp C</Text>
                    <PhaseBlock position={[-3.5, 0, 0]} width={1} color="#3b82f6" label="reset" />
                    <PhaseBlock position={[-1, 0, 0]} width={4} color="#f59e0b" label="configure" />
                    <PhaseBlock position={[2.5, 0, 0]} width={3} color="#22c55e" label="main" />
                </group>

                {/* Unified Run Phase (always active) */}
                <group position={[0, -2.6, 0]}>
                    <Text position={[-5.5, 0, 0]} fontSize={0.2} color="white" anchorX="right">Global</Text>
                    <PhaseBlock position={[0, 0, 0]} width={8} color="#a855f7" label="run_phase (parallel to task phases)" />
                </group>

                {/* Sweeping progress indicator */}
                <ProgressPlane />

                <OrbitControls
                    enablePan={true}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 1.5}
                />
            </Canvas>
        </div>
    );
}
