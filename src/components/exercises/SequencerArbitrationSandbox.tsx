"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";

type ArbitrationMode = "fifo" | "weighted" | "random";

type SequenceState = {
  id: string;
  name: string;
  color: string;
  priority: number; // 1 - 10
  pending: number;
  isLocked: boolean;
  hasGrab: boolean;
};

const INITIAL_SEQUENCES: SequenceState[] = [
  {
    id: "alpha",
    name: "Sequence A",
    color: "bg-sky-500",
    priority: 5,
    pending: 0,
    isLocked: false,
    hasGrab: false,
  },
  {
    id: "beta",
    name: "Sequence B",
    color: "bg-violet-500",
    priority: 5,
    pending: 0,
    isLocked: false,
    hasGrab: false,
  },
  {
    id: "gamma",
    name: "Sequence C",
    color: "bg-emerald-500",
    priority: 5,
    pending: 0,
    isLocked: false,
    hasGrab: false,
  },
];

const modeLabels: Record<ArbitrationMode, string> = {
  fifo: "SEQ_ARB_FIFO",
  weighted: "SEQ_ARB_WEIGHTED",
  random: "SEQ_ARB_RANDOM",
};

const SequencerArbitrationSandbox: React.FC = () => {
  const [sequences, setSequences] = useState<SequenceState[]>(
    INITIAL_SEQUENCES.map((seq) => ({ ...seq }))
  );
  const [queue, setQueue] = useState<string[]>([]);
  const [arbitrationMode, setArbitrationMode] = useState<ArbitrationMode>("fifo");
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [grabOwner, setGrabOwner] = useState<string | null>(null);
  const [decision, setDecision] = useState<string>(
    "Queue some requests, experiment with lock/grab, then arbitrate to see who wins."
  );
  const [history, setHistory] = useState<string[]>([]);
  const { logInteraction, analytics } = useExerciseProgress("sequencer-arbitration-sandbox");

  const sequenceMap = useMemo(() => {
    const map = new Map<string, SequenceState>();
    sequences.forEach((seq) => map.set(seq.id, seq));
    return map;
  }, [sequences]);

  const queueDisplay = useMemo(() => {
    return queue.map((id, idx) => {
      const seq = sequenceMap.get(id);
      return seq ? `${idx + 1}. ${seq.name}` : `${idx + 1}. ?`;
    });
  }, [queue, sequenceMap]);

  const updateSequence = (id: string, updater: (seq: SequenceState) => SequenceState) => {
    setSequences((prev) => prev.map((seq) => (seq.id === id ? updater(seq) : seq)));
  };

  const addRequest = (id: string) => {
    const seq = sequenceMap.get(id);
    if (!seq) return;
    logInteraction();
    setSequences((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pending: item.pending + 1 } : item
      )
    );
    setQueue((prev) => [...prev, id]);
    setDecision(`${seq.name} requested access. It now has ${seq.pending + 1} pending item(s).`);
  };

  const handlePriorityChange = (id: string, priority: number) => {
    logInteraction();
    updateSequence(id, (seq) => ({ ...seq, priority }));
  };

  const toggleGrab = (id: string) => {
    logInteraction();
    const current = grabOwner === id ? null : id;
    setGrabOwner(current);
    setSequences((prev) =>
      prev.map((seq) => ({ ...seq, hasGrab: current === seq.id }))
    );
    if (current) {
      const seq = sequenceMap.get(id);
      setDecision(`${seq?.name ?? "Sequence"} called grab(); it now pre-empts others until ungrabbed.`);
    } else {
      setDecision("Grab released. Normal arbitration resumes.");
    }
  };

  const toggleLock = (id: string) => {
    logInteraction();
    if (lockOwner === id) {
      // release existing lock
      setLockOwner(null);
      updateSequence(id, (seq) => ({ ...seq, isLocked: false }));
      setDecision(`${sequenceMap.get(id)?.name ?? "Sequence"} released its lock.`);
      return;
    }

    // assign new lock, clearing previous owner
    setLockOwner(id);
    setSequences((prev) =>
      prev.map((seq) => ({ ...seq, isLocked: seq.id === id }))
    );
    setDecision(`${sequenceMap.get(id)?.name ?? "Sequence"} acquired the lock; others will queue behind it.`);
  };

  const resetSandbox = () => {
    logInteraction();
    setSequences(INITIAL_SEQUENCES.map((seq) => ({ ...seq })));
    setQueue([]);
    setLockOwner(null);
    setGrabOwner(null);
    setDecision("Sandbox reset. Add requests to start exploring arbitration behaviour.");
    setHistory([]);
  };

  const evaluateWeightedWinner = (pendingIds: string[]): string | null => {
    if (pendingIds.length === 0) return null;
    let winnerId: string | null = null;
    let bestPriority = -Infinity;
    let bestPosition = Infinity;

    pendingIds.forEach((id) => {
      const seq = sequenceMap.get(id);
      if (!seq || seq.pending === 0) return;
      if (seq.priority > bestPriority) {
        bestPriority = seq.priority;
        winnerId = id;
        bestPosition = queue.findIndex((entry) => entry === id);
      } else if (seq.priority === bestPriority) {
        const pos = queue.findIndex((entry) => entry === id);
        if (pos !== -1 && pos < bestPosition) {
          winnerId = id;
          bestPosition = pos;
        }
      }
    });

    return winnerId;
  };

  const handleArbitrate = () => {
    logInteraction();
    if (queue.length === 0) {
      setDecision("No pending requests. Have a sequence queue work first.");
      return;
    }

    let rationale: string[] = [];
    let winnerId: string | null = null;

    const lockSeq = lockOwner ? sequenceMap.get(lockOwner) : null;
    if (lockSeq && lockSeq.pending > 0) {
      winnerId = lockSeq.id;
      rationale.push(`${lockSeq.name} holds a lock, so it keeps the sequencer until it unlocks.`);
    } else if (lockSeq && lockSeq.pending === 0) {
      // stale lock: release automatically for clarity
      setLockOwner(null);
      updateSequence(lockSeq.id, (seq) => ({ ...seq, isLocked: false }));
      rationale.push(`${lockSeq.name} had no pending work, so the lock was released.`);
    }

    if (!winnerId && grabOwner) {
      const grabSeq = sequenceMap.get(grabOwner);
      if (grabSeq && grabSeq.pending > 0) {
        winnerId = grabSeq.id;
        rationale.push(`${grabSeq.name} called grab(), so it overrides normal arbitration.`);
      } else if (grabSeq && grabSeq.pending === 0) {
        setGrabOwner(null);
        updateSequence(grabSeq.id, (seq) => ({ ...seq, hasGrab: false }));
        rationale.push(`${grabSeq.name} released grab automatically because it had nothing pending.`);
      }
    }

    if (!winnerId) {
      if (arbitrationMode === "fifo") {
        winnerId = queue[0];
        const seq = sequenceMap.get(winnerId!);
        rationale.push(`SEQ_ARB_FIFO: ${seq?.name ?? "A sequence"} requested earliest and wins.`);
      } else if (arbitrationMode === "weighted") {
        const uniquePending = Array.from(new Set(queue));
        winnerId = evaluateWeightedWinner(uniquePending);
        const seq = winnerId ? sequenceMap.get(winnerId) : null;
        if (seq) {
          rationale.push(
            `SEQ_ARB_WEIGHTED favoured ${seq.name} with priority ${seq.priority}. Ties fall back to queue order.`
          );
        }
      } else {
        const randomIndex = Math.floor(Math.random() * queue.length);
        winnerId = queue[randomIndex];
        const seq = sequenceMap.get(winnerId!);
        rationale.push(
          `SEQ_ARB_RANDOM selected ${seq?.name ?? "a sequence"} at random among the pending requests.`
        );
      }
    }

    if (!winnerId) {
      setDecision("No eligible sequence could be granted. Check locks/grabs and pending requests.");
      return;
    }

    const winner = sequenceMap.get(winnerId);
    if (!winner) {
      setDecision("Internal error: winner not found.");
      return;
    }

    const nextPending = Math.max(0, winner.pending - 1);

    setQueue((prev) => {
      const idx = prev.indexOf(winnerId!);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated.splice(idx, 1);
      return updated;
    });

    setSequences((prev) =>
      prev.map((seq) => {
        if (seq.id === winnerId) {
          const shouldKeepLock = seq.isLocked && nextPending > 0;
          return {
            ...seq,
            pending: nextPending,
            isLocked: shouldKeepLock,
          };
        }
        return seq;
      })
    );

    if (lockOwner === winnerId && nextPending === 0) {
      setLockOwner(null);
      rationale.push(`${winner.name} finished its locked work, so the lock was released.`);
    }

    if (grabOwner === winnerId && nextPending === 0) {
      setGrabOwner(null);
      updateSequence(winnerId, (seq) => ({ ...seq, hasGrab: false }));
      rationale.push(`${winner.name} completed its grabbed work, so grab was cleared.`);
    }

    const message = `${winner.name} won arbitration. ${rationale.join(" ")}`;
    setDecision(message);
    setHistory((prev) => [message, ...prev].slice(0, 6));
  };

  return (
    <div className="w-full space-y-6">
      <Card className="border border-white/20 bg-[var(--blueprint-glass)]/70 p-6 text-[var(--blueprint-foreground)] shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Sequencer Arbitration Sandbox</h3>
            <p className="mt-1 text-sm text-white/70">
              Queue work for each sequence, experiment with <code>lock()</code>, <code>grab()</code>, and different arbitration policies, then step the sequencer to see who wins and why.
            </p>
            <p className="mt-2 text-xs text-white/60">Interactions logged: {analytics.engagement}</p>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/60">
              Arbitration Mode
            </label>
            <Select
              value={arbitrationMode}
              onValueChange={(value) => setArbitrationMode(value as ArbitrationMode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">{modeLabels.fifo}</SelectItem>
                <SelectItem value="weighted">{modeLabels.weighted}</SelectItem>
                <SelectItem value="random">{modeLabels.random}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{seq.name}</span>
                <span className={`h-3 w-3 rounded-full ${seq.color}`} aria-hidden />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                <span className="rounded-full bg-white/10 px-2 py-1 text-white/70">
                  Pending: {seq.pending}
                </span>
                {seq.isLocked && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">
                    Lock Active
                  </span>
                )}
                {seq.hasGrab && (
                  <span className="rounded-full bg-rose-500/20 px-2 py-1 text-rose-200">
                    Grab Active
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Priority (weighted mode)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={seq.priority}
                    onChange={(event) =>
                      handlePriorityChange(seq.id, Number(event.target.value))
                    }
                    className="w-full"
                  />
                  <div className="text-right text-xs text-white/60">{seq.priority}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => addRequest(seq.id)}
                    className="flex-1"
                  >
                    Request Item
                  </Button>
                  <Button
                    variant={seq.hasGrab ? "destructive" : "outline"}
                    onClick={() => toggleGrab(seq.id)}
                    className="flex-1"
                  >
                    {seq.hasGrab ? "Release Grab" : "Grab()"}
                  </Button>
                  <Button
                    variant={seq.isLocked ? "destructive" : "outline"}
                    onClick={() => toggleLock(seq.id)}
                    className="flex-1"
                  >
                    {seq.isLocked ? "Unlock" : "Lock()"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Pending Queue
          </h4>
          {queue.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">
              No requests yet. Use "Request Item" on a sequence to add it to the queue.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {queueDisplay.map((label, idx) => (
                <span
                  key={`${queue[idx]}-${idx}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button onClick={handleArbitrate}>Arbitrate Next Grant</Button>
            <Button variant="outline" onClick={resetSandbox}>
              Reset Sandbox
            </Button>
          </div>
          <p className="text-sm text-white/70" role="status" aria-live="polite">
            {decision}
          </p>
        </div>

        {history.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Recent Decisions
            </h4>
            <ul className="mt-2 space-y-2 text-sm text-white/70">
              {history.map((entry, idx) => (
                <li key={idx} className="rounded-md bg-white/5 px-3 py-2">
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SequencerArbitrationSandbox;
