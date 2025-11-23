'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Lock, Unlock, Mail, Send, ArrowRight } from 'lucide-react';

export default function MailboxSemaphoreGame() {
    const [mode, setMode] = useState<'semaphore' | 'mailbox'>('semaphore');

    // Semaphore State
    const [keys, setKeys] = useState(2);
    const [maxKeys] = useState(2);
    const [processA, setProcessA] = useState<'idle' | 'waiting' | 'working'>('idle');
    const [processB, setProcessB] = useState<'idle' | 'waiting' | 'working'>('idle');
    const [log, setLog] = useState<string[]>([]);

    // Mailbox State
    const [mailbox, setMailbox] = useState<number[]>([]);
    const [capacity] = useState(3);
    const [producerState, setProducerState] = useState<'idle' | 'putting'>('idle');
    const [consumerState, setConsumerState] = useState<'idle' | 'getting'>('idle');

    const addLog = (msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 5));
    };

    // Semaphore Logic
    const getKey = (proc: 'A' | 'B') => {
        if (keys > 0) {
            setKeys(k => k - 1);
            if (proc === 'A') setProcessA('working');
            else setProcessB('working');
            addLog(`Process ${proc} got key. Keys left: ${keys - 1}`);
        } else {
            if (proc === 'A') setProcessA('waiting');
            else setProcessB('waiting');
            addLog(`Process ${proc} waiting for key...`);
        }
    };

    const putKey = (proc: 'A' | 'B') => {
        if (keys < maxKeys) {
            setKeys(k => k + 1);
            if (proc === 'A') setProcessA('idle');
            else setProcessB('idle');
            addLog(`Process ${proc} returned key. Keys left: ${keys + 1}`);
        }
    };

    // Mailbox Logic
    const putMail = () => {
        if (mailbox.length < capacity) {
            const data = Math.floor(Math.random() * 100);
            setMailbox(prev => [...prev, data]);
            setProducerState('idle');
            addLog(`Producer put data: ${data}`);
        } else {
            setProducerState('putting'); // Blocked
            addLog(`Mailbox full! Producer blocked.`);
        }
    };

    const getMail = () => {
        if (mailbox.length > 0) {
            const [data, ...rest] = mailbox;
            setMailbox(rest);
            setConsumerState('idle');
            addLog(`Consumer got data: ${data}`);
        } else {
            setConsumerState('getting'); // Blocked
            addLog(`Mailbox empty! Consumer blocked.`);
        }
    };

    return (
        <Card className="my-8 border-slate-700 bg-slate-900 text-slate-100" data-testid="mailbox-semaphore-game">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-indigo-400">
                    {mode === 'semaphore' ? 'Semaphore (Shared Resource)' : 'Mailbox (Data Flow)'}
                </CardTitle>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={mode === 'semaphore' ? 'default' : 'outline'}
                        onClick={() => setMode('semaphore')}
                    >
                        Semaphore
                    </Button>
                    <Button
                        size="sm"
                        variant={mode === 'mailbox' ? 'default' : 'outline'}
                        onClick={() => setMode('mailbox')}
                    >
                        Mailbox
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-8">

                {mode === 'semaphore' && (
                    <div className="space-y-6">
                        <div className="flex justify-center gap-4">
                            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-indigo-500 bg-indigo-900/30">
                                <div className="text-2xl font-bold">{keys}</div>
                                <div className="text-xs text-indigo-300">Keys Available</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            {/* Process A */}
                            <div className={`rounded-lg border p-4 transition-all ${processA === 'working' ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}>
                                <div className="mb-2 font-bold text-slate-300">Process A</div>
                                <div className="mb-4 h-8 text-sm">
                                    {processA === 'working' && <span className="flex items-center text-emerald-400"><Lock className="mr-2 h-4 w-4" /> Working...</span>}
                                    {processA === 'waiting' && <span className="flex items-center text-amber-400"><ArrowRight className="mr-2 h-4 w-4 animate-pulse" /> Waiting...</span>}
                                    {processA === 'idle' && <span className="text-slate-500">Idle</span>}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => getKey('A')} disabled={processA !== 'idle' && processA !== 'waiting'}>Get Key</Button>
                                    <Button size="sm" variant="outline" onClick={() => putKey('A')} disabled={processA !== 'working'}>Put Key</Button>
                                </div>
                            </div>

                            {/* Process B */}
                            <div className={`rounded-lg border p-4 transition-all ${processB === 'working' ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}>
                                <div className="mb-2 font-bold text-slate-300">Process B</div>
                                <div className="mb-4 h-8 text-sm">
                                    {processB === 'working' && <span className="flex items-center text-emerald-400"><Lock className="mr-2 h-4 w-4" /> Working...</span>}
                                    {processB === 'waiting' && <span className="flex items-center text-amber-400"><ArrowRight className="mr-2 h-4 w-4 animate-pulse" /> Waiting...</span>}
                                    {processB === 'idle' && <span className="text-slate-500">Idle</span>}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => getKey('B')} disabled={processB !== 'idle' && processB !== 'waiting'}>Get Key</Button>
                                    <Button size="sm" variant="outline" onClick={() => putKey('B')} disabled={processB !== 'working'}>Put Key</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'mailbox' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-center gap-4">
                            {/* Producer */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="rounded bg-slate-800 p-3">Producer</div>
                                <Button onClick={putMail} disabled={producerState === 'putting' && mailbox.length >= capacity}>
                                    <Send className="mr-2 h-4 w-4" /> Put()
                                </Button>
                            </div>

                            {/* Mailbox Queue */}
                            <div className="flex h-32 w-48 flex-col items-center justify-end rounded-lg border-2 border-dashed border-slate-600 bg-black/20 p-2">
                                <div className="mb-auto text-xs text-slate-500">Mailbox (Cap: {capacity})</div>
                                <div className="flex flex-col-reverse gap-1 w-full">
                                    {mailbox.map((val, i) => (
                                        <div key={i} className="flex h-8 w-full items-center justify-center rounded bg-indigo-600 text-white animate-in slide-in-from-top-2">
                                            <Mail className="mr-2 h-3 w-3" /> {val}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Consumer */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="rounded bg-slate-800 p-3">Consumer</div>
                                <Button onClick={getMail} variant="secondary" disabled={consumerState === 'getting' && mailbox.length === 0}>
                                    <ArrowRight className="mr-2 h-4 w-4" /> Get()
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Log */}
                <div className="mt-4 rounded bg-black/40 p-3 font-mono text-xs text-slate-400">
                    {log.map((l, i) => <div key={i}>&gt; {l}</div>)}
                    {log.length === 0 && <div>&gt; System Ready.</div>}
                </div>

            </CardContent>
        </Card>
    );
}
