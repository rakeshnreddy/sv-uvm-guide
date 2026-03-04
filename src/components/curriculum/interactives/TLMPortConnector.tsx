'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TLMPortConnector() {
    const [wireState, setWireState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [isDriving, setIsDriving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleConnectClick = () => {
        if (wireState !== 'disconnected') return;
        setWireState('connecting');

        // Simulate connecting delay
        setTimeout(() => {
            setWireState('connected');
        }, 1000);
    };

    const handleDisconnect = () => {
        setWireState('disconnected');
        setIsDriving(false);
        setErrorMessage('');
    };

    const handleDriveTraffic = () => {
        if (wireState !== 'connected') {
            setWireState('error');
            setErrorMessage('Cannot drive traffic! Sequence item port is unbound (null pointer). Connect it to an export first.');
            setTimeout(() => {
                setWireState('disconnected');
                setErrorMessage('');
            }, 3000);
            return;
        }

        setIsDriving(true);
        setTimeout(() => {
            setIsDriving(false);
        }, 2000);
    };

    return (
        <div className="my-6 rounded-2xl border border-muted bg-muted/20 p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-foreground">TLM Handshake Interactive</h3>
            <p className="mb-6 text-sm text-muted-foreground">
                Connect the Initiator's <code>seq_item_port</code> to the Target's <code>seq_item_export</code> to enable the transaction flow. Notice what happens if you try to drive traffic while disconnected.
            </p>

            <div className="relative flex min-h-[220px] w-full flex-col items-center justify-center sm:flex-row sm:space-x-24">

                {/* Initiator (Driver side) */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="flex h-32 w-48 flex-col items-center justify-between rounded-lg border-2 border-[var(--primary)] bg-background p-4 shadow-lg shadow-[var(--primary)]/20">
                        <span className="font-bold text-[var(--primary)]">Driver (Initiator)</span>
                        <span className="text-xs text-muted-foreground font-mono">seq_item_port</span>

                        <button
                            aria-label="Connect"
                            onClick={wireState === 'disconnected' ? handleConnectClick : undefined}
                            disabled={wireState === 'connecting'}
                            className={`mt-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-colors ${wireState === 'disconnected' ? 'cursor-pointer bg-[var(--primary)] hover:bg-[var(--primary)]/80' :
                                wireState === 'error' ? 'bg-red-500' :
                                    'bg-[var(--primary)]/50'
                                }`}
                        >
                            <div className="h-3 w-3 rounded-full bg-white shadow-inner" />
                        </button>
                    </div>
                </div>

                {/* Connection Wire */}
                {wireState !== 'disconnected' && (
                    <div className="absolute left-[calc(50%-120px)] top-1/2 -z-10 hidden w-[240px] -translate-y-1/2 items-center justify-center sm:flex">
                        <div className="relative h-1 w-full rounded-full bg-muted-foreground/30 overflow-hidden">
                            <motion.div
                                initial={{ width: '0%' }}
                                animate={{ width: wireState === 'connecting' ? '50%' : '100%' }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                                className={`absolute left-0 top-0 h-full ${wireState === 'error' ? 'bg-red-500' : 'bg-green-500'}`}
                            />
                        </div>
                    </div>
                )}

                {/* Traffic Animation */}
                <AnimatePresence>
                    {isDriving && wireState === 'connected' && (
                        <motion.div
                            initial={{ left: 'calc(50% - 120px)' }}
                            animate={{ left: 'calc(50% + 120px)' }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1, repeat: 1 }}
                            className="absolute top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 sm:block"
                        >
                            <div className="flex items-center justify-center rounded border border-yellow-500/50 bg-yellow-400 p-1 text-xs font-bold text-yellow-900 shadow-lg shadow-yellow-500/20">
                                txn packet
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Target (Sequencer side) */}
                <div className="relative z-10 mt-12 flex flex-col items-center sm:mt-0">
                    <div className="flex h-32 w-48 flex-col items-center justify-between rounded-lg border-2 border-green-600 bg-background p-4 shadow-lg shadow-green-600/20">
                        <span className="font-bold text-green-600">Sequencer (Target)</span>
                        <span className="text-xs text-muted-foreground font-mono">seq_item_export</span>

                        <div className={`mt-2 flex h-8 w-8 items-center justify-center rounded-sm transition-colors ${wireState === 'connected' ? 'bg-green-500' : 'bg-muted-foreground/30'
                            }`}>
                            <div className="h-4 w-4 bg-background shadow-inner" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-col items-center space-y-4">
                <div className="flex space-x-4">
                    <button
                        onClick={handleDriveTraffic}
                        disabled={wireState === 'connecting' || isDriving}
                        className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
                    >
                        Drive Traffic
                    </button>

                    <button
                        onClick={handleDisconnect}
                        disabled={wireState === 'disconnected' || isDriving}
                        className="rounded border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                        Reset
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {errorMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="rounded border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 max-w-lg text-center font-medium"
                        >
                            {errorMessage}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
