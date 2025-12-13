import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const defaultQueue = [14, 28, 42, 56];
const hardLimit = 6;

function formatQueue(queue: number[]) {
  if (queue.length === 0) return 'Empty queue — head/tail idle';
  return `Head → [ ${queue.join(' | ')} ] ← Tail (depth ${queue.length})`;
}

export const QueueOperationLab: React.FC = () => {
  const [queue, setQueue] = useState<number[]>(defaultQueue);
  const [value, setValue] = useState(99);
  const [index, setIndex] = useState(1);
  const [message, setMessage] = useState('Use the controls to animate queue pressure.');

  const pressure = useMemo(() => {
    if (queue.length === 0) return 'Idle — ready for traffic';
    if (queue.length >= hardLimit) return '🔴 Full: additional pushes will overflow';
    if (queue.length >= hardLimit - 1) return '🟠 Near capacity: consider backpressure';
    return '🟢 Healthy headroom for bursts';
  }, [queue.length]);

  const applyUpdate = (next: number[], detail: string) => {
    setQueue(next);
    setMessage(detail);
  };

  const handlePushBack = () => {
    if (queue.length >= hardLimit) {
      setMessage('Push blocked — FIFO at max depth.');
      return;
    }
    applyUpdate([...queue, value], `push_back(${value}) → tail grows`);
  };

  const handlePushFront = () => {
    if (queue.length >= hardLimit) {
      setMessage('Push front blocked — FIFO at max depth.');
      return;
    }
    applyUpdate([value, ...queue], `push_front(${value}) → urgent packet preempts head`);
  };

  const handleInsert = () => {
    if (queue.length >= hardLimit) {
      setMessage('Insert blocked — FIFO at max depth.');
      return;
    }
    const clampedIndex = Math.min(Math.max(index, 0), queue.length);
    const next = [...queue.slice(0, clampedIndex), value, ...queue.slice(clampedIndex)];
    applyUpdate(next, `insert(${clampedIndex}, ${value}) → O(N) shuffle`);
  };

  const handlePopFront = () => {
    if (queue.length === 0) {
      setMessage('Nothing to pop — queue already empty.');
      return;
    }
    const [head, ...rest] = queue;
    applyUpdate(rest, `pop_front() → released ${head}`);
  };

  const handlePopBack = () => {
    if (queue.length === 0) {
      setMessage('Nothing to pop — queue already empty.');
      return;
    }
    const tail = queue[queue.length - 1];
    applyUpdate(queue.slice(0, -1), `pop_back() → dropped newest ${tail}`);
  };

  const handleReset = () => {
    setQueue(defaultQueue);
    setValue(99);
    setIndex(1);
    setMessage('Reset to steady-state FIFO.');
  };

  return (
    <Card className="my-8 border-primary/30 bg-background/80 shadow-lg" data-testid="queue-operation-lab">
      <CardHeader>
        <CardTitle className="text-lg">Queue Operations Lab</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visualize how SystemVerilog queue methods reshape a FIFO. Track depth, head/tail movement, and when an O(N) shuffle happens.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary-foreground/90" data-testid="queue-lab-state">
              {formatQueue(queue)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground" data-testid="queue-lab-pressure">
              {pressure}
            </p>
            <p className="mt-2 text-sm text-muted-foreground" data-testid="queue-lab-log">
              {message}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span>Value</span>
              <input
                type="number"
                value={value}
                onChange={e => setValue(Number(e.target.value))}
                className="w-24 rounded-md border px-2 py-1 text-right"
                data-testid="queue-lab-value"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span>Index (insert)</span>
              <input
                type="number"
                value={index}
                onChange={e => setIndex(Number(e.target.value))}
                className="w-24 rounded-md border px-2 py-1 text-right"
                data-testid="queue-lab-index"
              />
            </label>
            <button
              type="button"
              onClick={handlePushBack}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow"
              data-testid="queue-lab-push-back"
            >
              push_back()
            </button>
            <button
              type="button"
              onClick={handlePushFront}
              className="rounded-md bg-primary/90 px-3 py-2 text-sm font-semibold text-primary-foreground shadow"
              data-testid="queue-lab-push-front"
            >
              push_front()
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow"
              data-testid="queue-lab-insert"
            >
              insert(index)
            </button>
            <button
              type="button"
              onClick={handlePopFront}
              className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground shadow"
              data-testid="queue-lab-pop-front"
            >
              pop_front()
            </button>
            <button
              type="button"
              onClick={handlePopBack}
              className="rounded-md bg-secondary/90 px-3 py-2 text-sm font-semibold text-secondary-foreground shadow"
              data-testid="queue-lab-pop-back"
            >
              pop_back()
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md bg-muted px-3 py-2 text-sm font-semibold text-foreground shadow"
              data-testid="queue-lab-reset"
            >
              Reset demo
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-primary/30 bg-background p-3 text-xs text-muted-foreground">
          <p>
            <strong>Performance note:</strong> pushes/pops at either end are O(1). Any insert/delete in the middle is O(N) because elements shuffle to make room.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default QueueOperationLab;
