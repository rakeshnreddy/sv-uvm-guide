// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';

const Message = ({ position, color, label }: { position: [number, number, number], color: string, label: string }) => {
    return (
        <group position={position}>
            <Box args={[0.8, 0.8, 0.8]}>
                <meshStandardMaterial color={color} />
            </Box>
            <Text position={[0, 0, 0.41]} fontSize={0.3} color="black">
                {label}
            </Text>
        </group>
    );
};

const MailboxContainer = ({ messageCount, capacity }: { messageCount: number, capacity: number }) => {
    return (
        <group position={[0, 0, 0]}>
            {/* Container back and sides */}
            <mesh position={[0, -0.5, -0.5]}>
                <boxGeometry args={[capacity * 1.1, 1.1, 0.1]} />
                <meshStandardMaterial color="#475569" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, -1.05, 0]}>
                <boxGeometry args={[capacity * 1.1, 0.1, 1.1]} />
                <meshStandardMaterial color="#334155" />
            </mesh>

            {/* Render messages */}
            {Array.from({ length: messageCount }).map((_, i) => (
                <Message
                    key={i}
                    position={[-capacity / 2 + 0.55 + i * 1, -0.5, 0]}
                    color={i === capacity - 1 ? "#ef4444" : "#3b82f6"}
                    label={`Msg ${i}`}
                />
            ))}
        </group>
    );
};

export default function Mailbox3D() {
    const [messages, setMessages] = useState(2);
    const capacity = 5;

    return (
        <div className="w-full h-[400px] border border-slate-700 rounded-lg overflow-hidden bg-slate-900 relative my-8">
            <div className="absolute top-4 left-4 z-10 text-white pointer-events-none">
                <h3 className="text-xl font-bold bg-slate-900/50 p-1 rounded inline-block">Mailbox Arbitration & Backpressure</h3>
                <p className="text-sm text-slate-300 mt-1">Bounded capacity: {capacity}</p>
                <p className="text-sm mt-1 text-slate-300">Used: {messages} / {capacity}</p>
                {messages === capacity && <p className="text-sm text-red-500 font-bold mt-1">BACKPRESSURE (put() blocks)</p>}
                {messages === 0 && <p className="text-sm text-yellow-500 font-bold mt-1">EMPTY (get() blocks)</p>}
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2 justify-center">
                <button
                    onClick={() => setMessages(Math.min(messages + 1, capacity))}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-mono text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={messages >= capacity}
                >
                    put()
                </button>
                <button
                    onClick={() => setMessages(Math.min(messages + 1, Math.min(messages + capacity, messages + 1)))}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-mono text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    try_put()
                </button>
                <button
                    onClick={() => setMessages(Math.max(messages - 1, 0))}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-mono text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={messages <= 0}
                >
                    get()
                </button>
            </div>

            <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <directionalLight position={[-10, 10, -5]} intensity={0.5} />

                <MailboxContainer messageCount={messages} capacity={capacity} />

                <OrbitControls
                    enablePan={false}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 2}
                />
            </Canvas>
        </div>
    );
}
