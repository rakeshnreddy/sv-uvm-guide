// @ts-nocheck
'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';

// Nodes represent components like monitor, scoreboard, subscriber
const Node = ({ position, label, color }: { position: [number, number, number], label: string, color: string }) => {
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state: any) => {
        if (meshRef.current) {
            meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * 2 + position[0]) * 0.1;
        }
    });

    return (
        <group position={position} ref={meshRef}>
            <mesh>
                <octahedronGeometry args={[0.5]} />
                <meshStandardMaterial color={color} wireframe />
            </mesh>
            <mesh>
                <octahedronGeometry args={[0.4]} />
                <meshStandardMaterial color={color} transparent opacity={0.6} />
            </mesh>
            <Text position={[0, -0.7, 0]} fontSize={0.25} color="white" anchorY="top">
                {label}
            </Text>
        </group>
    );
};

// Represents the write() call broadcast
const TransactionPulse = ({ start, end, delay }: { start: [number, number, number], end: [number, number, number], delay: number }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    useFrame((state: any) => {
        if (meshRef.current) {
            const time = (state.clock.getElapsedTime() + delay) % 2;
            const progress = Math.min(Math.max(time / 1.5, 0), 1);

            meshRef.current.position.lerpVectors(startVec, endVec, progress);
            meshRef.current.scale.setScalar(progress === 0 || progress === 1 ? 0.001 : 1);
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.15]} />
            <meshBasicMaterial color="#38bdf8" />
        </mesh>
    );
};

export default function Analysis3D() {
    const monitorPos: [number, number, number] = [0, 2, 0];
    const tlmPos: [number, number, number] = [0, 0, 0];
    const sb1Pos: [number, number, number] = [-3, -2, 0];
    const sb2Pos: [number, number, number] = [0, -2, 1.5];
    const subPos: [number, number, number] = [3, -2, 0];

    return (
        <div className="w-full h-[500px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">UVM Analysis Fan-out</h3>
                <p className="text-sm text-slate-300 mt-1 bg-slate-900/50 p-1 rounded inline-block">One-to-many broadcast via uvm_analysis_port</p>
            </div>

            <Canvas camera={{ position: [0, 2, 8], fov: 45 }}>
                <fog attach="fog" args={["#0f172a", 5, 20]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[0, 5, 0]} intensity={2} />

                {/* Nodes */}
                <Node position={monitorPos} label="Monitor" color="#facc15" />
                <Node position={tlmPos} label="uvm_analysis_port" color="#a855f7" />
                <Node position={sb1Pos} label="Scoreboard A" color="#22c55e" />
                <Node position={sb2Pos} label="Scoreboard B" color="#22c55e" />
                <Node position={subPos} label="Coverage Sub" color="#3b82f6" />

                {/* Connections */}
                <Line points={[monitorPos, tlmPos]} color="#a855f7" lineWidth={2} dashed dashSize={0.2} />
                <Line points={[tlmPos, sb1Pos]} color="#475569" lineWidth={1} />
                <Line points={[tlmPos, sb2Pos]} color="#475569" lineWidth={1} />
                <Line points={[tlmPos, subPos]} color="#475569" lineWidth={1} />

                {/* Transactions */}
                <TransactionPulse start={monitorPos} end={tlmPos} delay={0} />
                <TransactionPulse start={tlmPos} end={sb1Pos} delay={1.5} />
                <TransactionPulse start={tlmPos} end={sb2Pos} delay={1.5} />
                <TransactionPulse start={tlmPos} end={subPos} delay={1.5} />

                <TransactionPulse start={monitorPos} end={tlmPos} delay={1} />
                <TransactionPulse start={tlmPos} end={sb1Pos} delay={2.5} />
                <TransactionPulse start={tlmPos} end={sb2Pos} delay={2.5} />
                <TransactionPulse start={tlmPos} end={subPos} delay={2.5} />

                <OrbitControls
                    enablePan={true}
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 1.5}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>
        </div>
    );
}
