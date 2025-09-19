"use client";

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

type HandshakeStep = {
  id: string;
  from: string;
  to: string;
  action: string;
  description: string;
  hint: string;
};

type Participant = {
  id: string;
  name: string;
  x: number;
};

const steps: HandshakeStep[] = [
  {
    id: 'driver-requests',
    from: 'Driver',
    to: 'Sequencer',
    action: 'get_next_item(req)',
    description: 'Driver asks the sequencer for the next transaction and blocks until something is ready.',
    hint: 'This call sits pending while the sequencer waits for a sequence to deliver work.',
  },
  {
    id: 'sequence-requests',
    from: 'Sequence',
    to: 'Sequencer',
    action: 'start_item(seq_item)',
    description: 'Sequence raises its hand with a fresh transaction and requests ownership.',
    hint: 'Sequences never talk directly to drivers—they always route through the sequencer.',
  },
  {
    id: 'sequencer-grants',
    from: 'Sequencer',
    to: 'Sequence',
    action: 'wait_for_grant()',
    description: 'Sequencer arbitrates between contenders and grants the sequence permission to proceed.',
    hint: 'Arbitration policy (FIFO, priority, lock) is enforced during this grant.',
  },
  {
    id: 'sequence-finishes',
    from: 'Sequence',
    to: 'Sequencer',
    action: 'finish_item(seq_item)',
    description: 'Sequence finalizes fields and hands the transaction over to the sequencer.',
    hint: 'Until `finish_item`, the driver keeps waiting—no item, no progress.',
  },
  {
    id: 'sequencer-delivers',
    from: 'Sequencer',
    to: 'Driver',
    action: 'get_next_item returns',
    description: 'Sequencer releases the prepared item to the waiting driver.',
    hint: 'From the driver perspective the `get_next_item` call now returns.',
  },
  {
    id: 'driver-drives',
    from: 'Driver',
    to: 'DUT',
    action: 'drive_transfer(req)',
    description: 'Driver converts the abstract transaction into protocol-accurate pin wiggles.',
    hint: 'This is where virtual interfaces and timing live.',
  },
  {
    id: 'driver-item-done',
    from: 'Driver',
    to: 'Sequencer',
    action: 'item_done(rsp)',
    description: 'Driver signals completion (and optionally returns a response) so the sequencer can schedule the next item.',
    hint: 'Skip this call and the sequencer keeps waiting—classic hang scenario.',
  },
];

const participants: Participant[] = [
  { id: 'Sequence', name: 'Sequence', x: 120 },
  { id: 'Sequencer', name: 'Sequencer', x: 320 },
  { id: 'Driver', name: 'Driver', x: 520 },
  { id: 'DUT', name: 'DUT', x: 720 },
];

export const AnimatedUvmSequenceDriverHandshakeDiagram: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];

  const lifelineHeight = 360;
  const messageSpacing = 64;

  const progressPercent = useMemo(
    () => ((currentStepIndex + 1) / steps.length) * 100,
    [currentStepIndex]
  );

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleReset = () => setCurrentStepIndex(0);

  return (
    <section
      className="glass-card w-full overflow-hidden border border-white/10 bg-[var(--blueprint-glass)] px-6 py-8 text-[var(--blueprint-foreground)] shadow-[0_28px_70px_rgba(8,15,35,0.45)]"
      aria-labelledby="uvm-handshake-title"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[rgba(230,241,255,0.55)]">Sequencer ↔ Driver Protocol</p>
          <h3 id="uvm-handshake-title" className="mt-2 text-2xl font-semibold md:text-3xl">
            Trace the sequencer ↔ driver handshake timeline
          </h3>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.7)]">
            Advance through the timeline to see how ownership moves from sequence intent to driver execution and back.
          </p>
        </div>
        <div className="md:w-64">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-[rgba(230,241,255,0.55)]">
            <span>Step {currentStepIndex + 1}</span>
            <span>Total {steps.length}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--blueprint-accent)] transition-all"
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <svg
          className="mx-auto h-[420px] min-w-[780px] w-full"
          viewBox={`0 0 840 ${lifelineHeight + 120}`}
          role="img"
          aria-describedby="uvm-handshake-description"
        >
          <defs>
            <marker id="arrowhead-seq" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0, 12 4, 0 8" fill="currentColor" />
            </marker>
            <linearGradient id="lifelineGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(230,241,255,0.65)" />
              <stop offset="100%" stopColor="rgba(230,241,255,0.2)" />
            </linearGradient>
          </defs>

          {participants.map((participant) => (
            <g key={participant.id}>
              <motion.rect
                className="fill-white/5"
                x={participant.x - 70}
                y={20}
                width={140}
                height={40}
                rx={18}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
              <text
                x={participant.x}
                y={45}
                textAnchor="middle"
                className="text-sm font-semibold"
                fill="rgba(230,241,255,0.85)"
              >
                {participant.name}
              </text>
              <line
                x1={participant.x}
                y1={70}
                x2={participant.x}
                y2={lifelineHeight + 60}
                stroke="url(#lifelineGradient)"
                strokeWidth={2}
                strokeDasharray="8 10"
              />
            </g>
          ))}

          {steps.map((step, index) => {
            const from = participants.find((p) => p.id === step.from);
            const to = participants.find((p) => p.id === step.to);
            if (!from || !to) return null;

            const isActive = index <= currentStepIndex;
            const y = 100 + index * messageSpacing;
            const midX = (from.x + to.x) / 2;

            return (
              <motion.g
                key={step.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isActive ? 1 : 0.1, y: isActive ? 0 : 12 }}
                transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.2) }}
              >
                <line
                  x1={from.x}
                  y1={y}
                  x2={to.x}
                  y2={y}
                  stroke={isActive ? 'rgba(100,255,218,0.9)' : 'rgba(230,241,255,0.2)'}
                  strokeWidth={isActive ? 3 : 2}
                  markerEnd="url(#arrowhead-seq)"
                />
                <text
                  x={midX}
                  y={y - 14}
                  textAnchor="middle"
                  className="text-xs font-medium"
                  fill={isActive ? 'rgba(230,241,255,0.85)' : 'rgba(230,241,255,0.35)'}
                >
                  {step.action}
                </text>
                <text
                  x={midX}
                  y={y + 18}
                  textAnchor="middle"
                  className="text-[11px]"
                  fill={isActive ? 'rgba(230,241,255,0.65)' : 'rgba(230,241,255,0.3)'}
                >
                  {step.hint}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <p id="uvm-handshake-description" className="mt-6 text-sm text-[rgba(230,241,255,0.72)]">
        Step {currentStepIndex + 1}: {currentStep.description}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-[rgba(230,241,255,0.85)] shadow-[0_10px_25px_rgba(8,15,35,0.35)] transition hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={currentStepIndex === steps.length - 1}
          className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(100,255,218,0.35)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-[rgba(230,241,255,0.75)] transition hover:border-white/25 hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </section>
  );
};
