'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Box } from '@react-three/drei';
import * as THREE from 'three';

const ComponentBlock = ({ position, color, label }: { position: [number, number, number], color: string, label: string }) => {
    return (
        <group position={position}>
            <Box args={[1.5, 1, 1]}>
                <meshStandardMaterial color={color} transparent opacity={0.8} />
            </Box>
            <Text position={[0, -0.8, 0]} fontSize={0.25} color="white">
                {label}
            </Text>
        </group>
    );
};

const DataItem = ({ start, end, delay, color }: { start: [number, number, number], end: [number, number, number], delay: number, color: string }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    useFrame((state) => {
        if (meshRef.current) {
            const time = (state.clock.getElapsedTime() + delay) % 4; // 4 second loop
            const progress = Math.min(Math.max(time / 2, 0), 1); // 2 second travel time

            meshRef.current.position.lerpVectors(startVec, endVec, progress);
            meshRef.current.visible = (progress > 0 && progress < 1);
        }
    });

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
};

export default function Dataflow3D() {
    const seqPos: [number, number, number] = [-4, 0, 0];
    const drvPos: [number, number, number] = [-1, 0, 0];
    const monPos: [number, number, number] = [2, 0, 0];
    const sbPos: [number, number, number] = [5, 0, 0];

    return (
        <div className="w-full h-[400px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">UVM Data Flow Pipeline</h3>
                <p className="text-sm text-slate-300 mt-1 bg-slate-900/50 p-1 rounded inline-block">Sequencer → Driver → DUT → Monitor → Scoreboard</p>
            </div>

            <Canvas camera={{ position: [0.5, 3, 7], fov: 50 }}>
                <fog attach="fog" args={["#0f172a", 5, 20]} />
                <ambientLight intensity={0.6} />
                <pointLight position={[0, 8, 5]} intensity={1.5} />

                {/* Components */}
                <ComponentBlock position={seqPos} color="#3b82f6" label="Sequencer [REQ]" />
                <ComponentBlock position={drvPos} color="#f59e0b" label="Driver" />
                <ComponentBlock position={monPos} color="#10b981" label="Monitor" />
                <ComponentBlock position={sbPos} color="#a855f7" label="Scoreboard" />

                {/* TLM Path */}
                <Line points={[seqPos, drvPos]} color="#94a3b8" lineWidth={2} dashed dashSize={0.2} />

                {/* DUT Path (Virtual interface) */}
                <Line points={[
                    [drvPos[0], drvPos[1] - 0.5, drvPos[2]],
                    [drvPos[0], drvPos[1] - 1.5, drvPos[2]],
                    [monPos[0], monPos[1] - 1.5, monPos[2]],
                    [monPos[0], monPos[1] - 0.5, monPos[2]]
                ]} color="#ef4444" lineWidth={2} />
                <Text position={[0.5, -1.8, 0]} fontSize={0.25} color="#ef4444">Virtual Interface (DUT)</Text>

                {/* TLM Analysis Path */}
                <Line points={[monPos, sbPos]} color="#94a3b8" lineWidth={2} />

                {/* Animated Data Items */}
                {/* Sequence item to driver */}
                <DataItem start={[-3.25, 0, 0]} end={[-1.75, 0, 0]} delay={0} color="#60a5fa" />
                <DataItem start={[-3.25, 0, 0]} end={[-1.75, 0, 0]} delay={2} color="#60a5fa" />

                {/* Driver to Monitor across Virtual IF */}
                <DataItem start={[-1, -0.5, 0]} end={[-1, -1.5, 0]} delay={0.8} color="#fca5a5" />
                <DataItem start={[-1, -1.5, 0]} end={[2, -1.5, 0]} delay={1.2} color="#fca5a5" />
                <DataItem start={[2, -1.5, 0]} end={[2, -0.5, 0]} delay={1.8} color="#fca5a5" />

                <DataItem start={[-1, -0.5, 0]} end={[-1, -1.5, 0]} delay={2.8} color="#fca5a5" />
                <DataItem start={[-1, -1.5, 0]} end={[2, -1.5, 0]} delay={3.2} color="#fca5a5" />
                <DataItem start={[2, -1.5, 0]} end={[2, -0.5, 0]} delay={3.8} color="#fca5a5" />

                {/* Monitor to Scoreboard */}
                <DataItem start={[2.75, 0, 0]} end={[4.25, 0, 0]} delay={2.0} color="#34d399" />
                <DataItem start={[2.75, 0, 0]} end={[4.25, 0, 0]} delay={4.0} color="#34d399" />

                <OrbitControls
                    enablePan={false}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 2}
                />
            </Canvas>
        </div>
    );
}
