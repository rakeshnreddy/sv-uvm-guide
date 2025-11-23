'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function LogicStateDiagram() {
    return (
        <div className="my-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-orange-300 bg-orange-100 shadow-sm dark:border-orange-500/70 dark:bg-[#331800]">
                    <CardHeader>
                        <CardTitle className="text-base text-orange-900 dark:text-orange-50">`X` — contention made visible</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-orange-900/80 mb-4 dark:text-orange-100/90">Two blocks drive the same net with different values. The simulator resolves the fight to `X`, exactly how silicon would behave until one driver wins.</p>
                        <svg viewBox="0 0 360 175" className="w-full text-orange-600 dark:text-orange-200" role="img" aria-label="Two drivers colliding on a net">
                            <defs>
                                <marker id="ribbon" markerWidth="10" markerHeight="10" viewBox="0 0 10 10" refX="6" refY="5" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
                                </marker>
                            </defs>
                            <rect x="18" y="32" width="120" height="52" rx="14" className="fill-white stroke-orange-500 dark:fill-orange-800/40 dark:stroke-orange-200" strokeWidth="3" />
                            <text x="78" y="60" textAnchor="middle" className="fill-orange-900 text-sm font-semibold dark:fill-orange-50">Driver A = 0</text>
                            <rect x="18" y="98" width="120" height="52" rx="14" className="fill-white stroke-orange-500 dark:fill-orange-800/40 dark:stroke-orange-200" strokeWidth="3" />
                            <text x="78" y="126" textAnchor="middle" className="fill-orange-900 text-sm font-semibold dark:fill-orange-50">Driver B = 1</text>
                            <line x1="138" y1="58" x2="250" y2="58" className="stroke-current" strokeWidth="7" markerEnd="url(#ribbon)" strokeLinecap="round" />
                            <line x1="138" y1="124" x2="250" y2="124" className="stroke-current" strokeWidth="7" markerEnd="url(#ribbon)" strokeLinecap="round" />
                            <rect x="240" y="78" width="120" height="52" rx="14" className="fill-white stroke-orange-500 dark:fill-orange-800/40 dark:stroke-orange-200" strokeWidth="3" />
                            <text x="300" y="106" textAnchor="middle" className="fill-orange-900 text-lg font-semibold dark:fill-orange-50">Bus → `X`</text>
                        </svg>
                    </CardContent>
                </Card>
                <Card className="border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/70 dark:bg-[#041f37]">
                    <CardHeader>
                        <CardTitle className="text-base text-slate-900 dark:text-blue-100">`Z` — floating but intentional</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-blue-900/80 mb-4 dark:text-blue-100/90">No driver is active, so the bus floats. That `Z` reminds you to enable a pull-up, keeper, or the next driver before sampling.</p>
                        <svg viewBox="0 0 360 175" className="w-full text-blue-600 dark:text-blue-200" role="img" aria-label="Floating wire with pull-up">
                            <rect x="210" y="22" width="115" height="48" rx="14" className="fill-white stroke-blue-400 dark:fill-blue-500/25 dark:stroke-blue-200" strokeWidth="3" />
                            <text x="268" y="50" textAnchor="middle" className="fill-blue-700 text-xs font-semibold dark:fill-blue-100">Pull-up / keeper</text>
                            <line x1="60" y1="92" x2="268" y2="92" className="stroke-current" strokeOpacity="0.9" strokeWidth="7" strokeDasharray="16 11" strokeLinecap="round" />
                            <circle cx="268" cy="92" r="8" className="fill-current" />
                            <line x1="268" y1="92" x2="268" y2="58" className="stroke-current" strokeWidth="7" strokeLinecap="round" />
                            <text x="120" y="84" textAnchor="middle" className="fill-blue-700 text-lg font-semibold dark:fill-blue-100">`Z`</text>
                            <rect x="40" y="122" width="160" height="48" rx="14" className="fill-white stroke-blue-400 dark:fill-blue-500/25 dark:stroke-blue-200" strokeWidth="3" />
                            <text x="120" y="150" textAnchor="middle" className="fill-blue-700 text-sm font-semibold dark:fill-blue-100">No active drivers</text>
                        </svg>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
