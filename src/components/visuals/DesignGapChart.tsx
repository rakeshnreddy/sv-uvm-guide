'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';

export default function DesignGapChart() {
    return (
        <Card className="my-8 border-slate-200/10 bg-slate-900/60 p-6 text-slate-100 shadow-lg">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Design vs. Verification</p>
            <svg viewBox="0 0 560 200" className="mt-4 h-48 w-full">
                <defs>
                    <linearGradient id="designLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="verificationLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="560" height="200" rx="24" fill="rgba(15,23,42,0.6)" />
                <polyline
                    fill="none"
                    stroke="url(#designLine)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    points="40,160 140,110 220,70 320,40 420,24 520,20"
                />
                <polyline
                    fill="none"
                    stroke="url(#verificationLine)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    points="40,160 140,150 220,140 320,128 420,120 520,112"
                />
                <text x="60" y="48" fill="#bae6fd" fontSize="14">Transistor Count / Design Complexity</text>
                <text x="60" y="180" fill="#fed7aa" fontSize="14">Verification Productivity</text>
            </svg>
            <p className="mt-4 text-sm text-slate-200">
                Verification asks, <strong>“Are we building the product right?”</strong> — the disciplined inspection of every logic path, handshake, and failure mode. Validation asks, <strong>“Are we building the right product?”</strong> — checking that the finished system meets customer intent. Think of a chef: verification is following the recipe precisely; validation is serving diners what they actually ordered.
            </p>
        </Card>
    );
}
