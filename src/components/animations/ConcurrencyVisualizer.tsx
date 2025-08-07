"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { concurrencyData } from './concurrency-data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useLazyRender } from '@/hooks/useLazyRender';
import { useLocale } from '@/hooks/useLocale';
import { useTheme } from '@/hooks/useTheme';

const ConcurrencyVisualizer = () => {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  type ProcState = {
    id: string;
    priority: number;
    status: "running" | "blocked" | "waiting";
    resource?: string;
  };

  const [processState, setProcessState] = useState<ProcState[]>([]);
  const [semaphoreOwner, setSemaphoreOwner] = useState<string | null>(null);
  const [mailboxMessage, setMailboxMessage] = useState<string | null>(null);
  const [mutexOwner, setMutexOwner] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string[]>([]);
  const [deadlock, setDeadlock] = useState(false);

  const semaphoreRef = useRef<HTMLDivElement>(null);
  const mailboxRef = useRef<HTMLDivElement>(null);
  const mutexRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = useLazyRender(containerRef);
  const { locale } = useLocale();
  const { theme } = useTheme();

  useAccessibility(containerRef, 'Concurrency visualizer', { svg: false });

  if (!visible) {
    return <div ref={containerRef}>Loading visualization...</div>;
  }

  const recalcScheduling = (state: ProcState[]): ProcState[] => {
    const unblocked = state.filter(p => p.status !== "blocked");
    if (unblocked.length === 0) return state;
    const highest = Math.min(...unblocked.map(p => p.priority));
    return state.map(p => {
      if (p.status === "blocked") return p;
      return { ...p, status: p.priority === highest ? "running" : "waiting" };
    });
  };

  const adjustPriority = (id: string, delta: number) => {
    setProcessState(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;
      let newPrio = target.priority + delta;
      newPrio = Math.max(1, Math.min(prev.length, newPrio));
      const updated = prev.map(p => {
        if (p.id === id) return { ...p, priority: newPrio };
        if (delta < 0 && p.priority === newPrio) return { ...p, priority: p.priority + 1 };
        if (delta > 0 && p.priority === newPrio) return { ...p, priority: p.priority - 1 };
        return p;
      });
      return recalcScheduling(updated);
    });
  };

  useEffect(() => {
    const initial: ProcState[] = concurrencyData[exampleIndex].processes.map(
      (p, i) => ({
        id: p,
        priority: i + 1,
        status: "running" as const,
      })
    );
    setProcessState(recalcScheduling(initial));
    setSemaphoreOwner(null);
    setMailboxMessage(null);
    setMutexOwner(null);
    setConflict([]);
  }, [exampleIndex]);

  useEffect(() => {
    const allBlocked =
      processState.length > 0 && processState.every(p => p.status !== "running");
    setDeadlock(allBlocked);
  }, [processState]);

  const handleNext = () => {
    setCurrentStepIndex(prev => (prev < concurrencyData[exampleIndex].steps.length - 1 ? prev + 1 : prev));
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleExampleChange = (index: string) => {
    setExampleIndex(parseInt(index));
    setCurrentStepIndex(0);
  };

  const currentExample = concurrencyData[exampleIndex];
  const currentStep = currentExample.steps[currentStepIndex];
  const showRace = conflict.length >= 2;
  const showDeadlock = deadlock;
  const showLivelock =
    conflict.length > 0 && !deadlock && processState.some(p => p.status === "waiting");

  const isInside = (point: { x: number; y: number }, rect: DOMRect) => {
    return (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    );
  };

  const handleDragEnd = (
    id: string,
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const point = info.point;
    const semRect = semaphoreRef.current?.getBoundingClientRect();
    const mailRect = mailboxRef.current?.getBoundingClientRect();
    const mtxRect = mutexRef.current?.getBoundingClientRect();

    if (semRect && isInside(point, semRect)) {
      if (!semaphoreOwner) {
        setSemaphoreOwner(id);
        setProcessState(prev =>
          recalcScheduling(
            prev.map<ProcState>(p =>
              p.id === id ? { ...p, resource: "semaphore" } : p
            )
          )
        );
      } else if (semaphoreOwner !== id) {
        setConflict([semaphoreOwner, id]);
        setProcessState(prev =>
          recalcScheduling(
            prev.map<ProcState>(p =>
              p.id === id
                ? { ...p, status: "blocked" as const, resource: "semaphore" }
                : p
            )
          )
        );
      }
      return;
    }

    if (mailRect && isInside(point, mailRect)) {
      if (!mailboxMessage) {
        setMailboxMessage(id);
      } else if (mailboxMessage !== id) {
        setMailboxMessage(null);
        setProcessState(prev =>
          recalcScheduling(
            prev.map<ProcState>(p =>
              p.id === id ? { ...p, status: "running" as const } : p
            )
          )
        );
      }
      return;
    }

    if (mtxRect && isInside(point, mtxRect)) {
      if (!mutexOwner) {
        setMutexOwner(id);
        setProcessState(prev =>
          recalcScheduling(
            prev.map<ProcState>(p =>
              p.id === id ? { ...p, resource: "mutex" } : p
            )
          )
        );
      } else if (mutexOwner !== id) {
        setConflict([mutexOwner, id]);
        setProcessState(prev =>
          recalcScheduling(
            prev.map<ProcState>(p =>
              p.id === id
                ? { ...p, status: "blocked" as const, resource: "mutex" }
                : p
            )
          )
        );
      }
      return;
    }

    if (semaphoreOwner === id) {
      setSemaphoreOwner(null);
      setConflict([]);
      setProcessState(prev =>
        recalcScheduling(
          prev.map<ProcState>(p =>
            p.id === id ? { ...p, resource: undefined } : p
          )
        )
      );
    }

    if (mutexOwner === id) {
      setMutexOwner(null);
      setConflict([]);
      setProcessState(prev =>
        recalcScheduling(
          prev.map<ProcState>(p =>
            p.id === id ? { ...p, resource: undefined } : p
          )
        )
      );
    }
  };

  return (
    <div ref={containerRef} className="w-full">
      <Card>
      <CardHeader>
        <CardTitle>Concurrency Visualizer</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleExampleChange} defaultValue={exampleIndex.toString()}>
          <SelectTrigger className="w-[280px] mb-4">
            <SelectValue placeholder="Select an example" />
          </SelectTrigger>
          <SelectContent>
            {concurrencyData.map((example, index) => (
              <SelectItem key={example.name} value={index.toString()}>{example.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <CodeBlock code={currentExample.code} language="systemverilog" />
          </div>
          <div className="flex flex-col items-center">
            <div
              ref={containerRef}
              className="relative w-full h-64 bg-muted rounded-lg p-4 overflow-hidden"
            >
              {processState.map(proc => (
                <motion.div
                  key={proc.id}
                  drag
                  dragConstraints={containerRef}
                  onDragEnd={(e, info) => handleDragEnd(proc.id, e, info)}
                  className={`absolute w-24 h-16 rounded-lg flex items-center justify-center cursor-move ${
                    conflict.includes(proc.id)
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                  animate={{ top: (proc.priority - 1) * 48, scale: proc.status === "running" ? 1.1 : 1 }}
                  style={{ left: 16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {proc.id}
                </motion.div>
              ))}
              <div
                ref={semaphoreRef}
                className="absolute top-2 right-2 w-32 h-16 border-2 border-primary flex flex-col items-center justify-center text-xs"
              >
                <span>Semaphore</span>
                {semaphoreOwner && (
                  <span>locked by {semaphoreOwner}</span>
                )}
              </div>
              <div
                ref={mailboxRef}
                className="absolute bottom-2 right-2 w-32 h-16 border-2 border-primary flex flex-col items-center justify-center text-xs"
              >
                <span>Mailbox</span>
                {mailboxMessage && <span>msg from {mailboxMessage}</span>}
              </div>
              <div
                ref={mutexRef}
                className="absolute bottom-2 left-2 w-32 h-16 border-2 border-primary flex flex-col items-center justify-center text-xs"
              >
                <span>Mutex</span>
                {mutexOwner && <span>locked by {mutexOwner}</span>}
              </div>
              <AnimatePresence>
                {(showRace || showDeadlock || showLivelock) && (
                  <motion.div
                    className="absolute inset-0 bg-background/80 flex items-center justify-center text-xs font-medium pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {showRace && 'Race condition detected'}
                    {showDeadlock && 'Deadlock detected'}
                    {showLivelock && 'Livelock detected'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-4 w-full">
              <p className="text-sm font-medium mb-2">Scheduling (by priority)</p>
              <ul className="flex flex-col space-y-1">
                {processState
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map(p => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span>{p.id}</span>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => adjustPriority(p.id, -1)}
                          disabled={p.priority === 1}
                        >
                          ↑
                        </Button>
                        <span>{p.priority}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => adjustPriority(p.id, 1)}
                          disabled={p.priority === processState.length}
                        >
                          ↓
                        </Button>
                      </div>
                      <span>{p.status}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4 border rounded-lg bg-background/50 mt-4"
          >
            <p>{currentStep}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev} disabled={currentStepIndex === 0}>Previous</Button>
          <Button onClick={handleNext} disabled={currentStepIndex === currentExample.steps.length - 1}>Next</Button>
        </div>
      </CardContent>
      </Card>
    </div>
  );
};

export default ConcurrencyVisualizer;
