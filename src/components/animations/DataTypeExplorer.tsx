"use client";

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ArrayItem {
  id: number;
  label: string;
  value: string;
}

const LOG_LIMIT = 6;

const DataTypeExplorer = () => {
  const [dynamicItems, setDynamicItems] = useState<ArrayItem[]>([
    { id: 0, label: '0', value: "8'hAA" },
    { id: 1, label: '1', value: "8'h55" },
  ]);
  const [dynamicNextId, setDynamicNextId] = useState(2);
  const [dynamicSeed, setDynamicSeed] = useState(0x10);
  const [dynamicLog, setDynamicLog] = useState<string[]>([
    'Initialized dynamic array with 2 elements.',
  ]);

  const [queueItems, setQueueItems] = useState<ArrayItem[]>([
    { id: 0, label: 'front', value: 'req_0' },
    { id: 1, label: '', value: 'req_1' },
  ]);
  const [queueNextId, setQueueNextId] = useState(2);
  const [queueLog, setQueueLog] = useState<string[]>([
    'Queue seeded with two outstanding transactions.',
  ]);

  const [assocItems, setAssocItems] = useState<ArrayItem[]>([
    { id: 0, label: 'addr_0x10', value: "8'h3C" },
    { id: 1, label: 'addr_0x14', value: "8'h7E" },
  ]);
  const [assocNextId, setAssocNextId] = useState(2);
  const [assocLog, setAssocLog] = useState<string[]>([
    'Associative array mirrors two register writes.',
  ]);

  const appendLog = (setter: (value: string[] | ((prev: string[]) => string[])) => void) =>
    (message: string) => {
      setter((prev) => [message, ...prev].slice(0, LOG_LIMIT));
    };

  const appendDynamicLog = useMemo(() => appendLog(setDynamicLog), []);
  const appendQueueLog = useMemo(() => appendLog(setQueueLog), []);
  const appendAssocLog = useMemo(() => appendLog(setAssocLog), []);

  const handleDynamicPush = () => {
    const valueHex = `8'h${(dynamicSeed & 0xff).toString(16).padStart(2, '0')}`;
    setDynamicItems((prev) => [
      ...prev,
      { id: dynamicNextId, label: `${prev.length}`, value: valueHex },
    ]);
    setDynamicNextId((id) => id + 1);
    setDynamicSeed((seed) => (seed + 0x15) & 0xff);
    appendDynamicLog(`arr.push_back(${valueHex}); // size=${dynamicItems.length + 1}`);
  };

  const handleDynamicPop = () => {
    setDynamicItems((prev) => {
      if (!prev.length) {
        appendDynamicLog('arr.pop_back(); // no elements to remove');
        return prev;
      }
      const removed = prev[prev.length - 1];
      appendDynamicLog(`arr.pop_back() -> ${removed.value}; // size=${prev.length - 1}`);
      return prev.slice(0, prev.length - 1).map((item, idx) => ({
        ...item,
        label: `${idx}`,
      }));
    });
  };

  const handleDynamicSize = () => {
    appendDynamicLog(`arr.size() -> ${dynamicItems.length}`);
  };

  const handleDynamicDelete = () => {
    setDynamicItems([]);
    appendDynamicLog('arr.delete(); // array cleared');
  };

  const handleQueuePushBack = () => {
    const value = `req_${queueNextId}`;
    setQueueItems((prev) => [
      ...prev,
      { id: queueNextId, label: prev.length ? '' : 'front', value },
    ]);
    setQueueNextId((id) => id + 1);
    appendQueueLog(`q.push_back(${value}); // size=${queueItems.length + 1}`);
  };

  const handleQueuePushFront = () => {
    const value = `urgent_${queueNextId}`;
    setQueueItems((prev) => {
      const next = [
        { id: queueNextId, label: 'front', value },
        ...prev.map((item) => ({ ...item, label: '' })),
      ];
      return next;
    });
    setQueueNextId((id) => id + 1);
    appendQueueLog(`q.push_front(${value}); // size=${queueItems.length + 1}`);
  };

  const handleQueuePopFront = () => {
    setQueueItems((prev) => {
      if (!prev.length) {
        appendQueueLog('q.pop_front(); // queue empty');
        return prev;
      }
      const [head, ...rest] = prev;
      appendQueueLog(`q.pop_front() -> ${head.value}; // size=${rest.length}`);
      return rest.map((item, idx) => ({
        ...item,
        label: idx === 0 ? 'front' : '',
      }));
    });
  };

  const handleQueueSize = () => {
    appendQueueLog(`q.size() -> ${queueItems.length}`);
  };

  const handleAssocAdd = () => {
    const key = `addr_0x${(0x10 + assocNextId * 4).toString(16)}`;
    const value = `8'h${(0x20 + assocNextId * 3).toString(16).padStart(2, '0')}`;
    setAssocItems((prev) => [
      ...prev,
      { id: assocNextId, label: key, value },
    ]);
    setAssocNextId((id) => id + 1);
    appendAssocLog(`aa["${key}"] = ${value};`);
  };

  const handleAssocDelete = () => {
    setAssocItems((prev) => {
      if (!prev.length) {
        appendAssocLog('aa.delete(key); // nothing to delete');
        return prev;
      }
      const [head, ...rest] = prev;
      appendAssocLog(`aa.delete("${head.label}");`);
      return rest;
    });
  };

  const handleAssocExists = () => {
    if (!assocItems.length) {
      appendAssocLog('aa.exists(key) -> 0 // array empty');
      return;
    }
    const probe = assocItems[0];
    appendAssocLog(`aa.exists("${probe.label}") -> 1`);
  };

  const handleAssocKeys = () => {
    const keys = assocItems.map((item) => item.label).join(', ');
    appendAssocLog(`aa.first()/aa.next() => { ${keys || '∅'} }`);
  };

  return (
    <Card className="my-8" data-testid="data-type-explorer">
      <CardHeader>
        <CardTitle>SystemVerilog Data Structure Explorer</CardTitle>
        <p className="text-sm text-muted-foreground">
          Experiment with dynamic arrays (§7.5), queues (§7.8), and associative arrays (§7.10).
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dynamic">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="dynamic" className="rounded border px-3 py-1 text-sm">
              Dynamic Array
            </TabsTrigger>
            <TabsTrigger value="queue" className="rounded border px-3 py-1 text-sm">
              Queue
            </TabsTrigger>
            <TabsTrigger value="assoc" className="rounded border px-3 py-1 text-sm">
              Associative Array
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dynamic" className="mt-6 space-y-4" data-testid="dynamic-array-panel">
            <div className="flex flex-wrap gap-2" data-testid="dynamic-array-visual">
              <AnimatePresence>
                {dynamicItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex h-16 w-24 flex-col items-center justify-center rounded border border-primary/40 bg-primary/5 text-xs"
                  >
                    <span className="font-semibold">idx {item.label}</span>
                    <span>{item.value}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleDynamicPush} data-testid="dynamic-push-back">
                push_back
              </Button>
              <Button
                type="button"
                onClick={handleDynamicPop}
                variant="secondary"
                data-testid="dynamic-pop-back"
              >
                pop_back
              </Button>
              <Button
                type="button"
                onClick={handleDynamicSize}
                variant="outline"
                data-testid="dynamic-size"
              >
                size()
              </Button>
              <Button
                type="button"
                onClick={handleDynamicDelete}
                variant="ghost"
                data-testid="dynamic-delete"
              >
                delete()
              </Button>
            </div>
            <Console log={dynamicLog} label="dynamic array console" />
          </TabsContent>

          <TabsContent value="queue" className="mt-6 space-y-4" data-testid="queue-panel">
            <div className="flex flex-wrap gap-2" data-testid="queue-visual">
              <AnimatePresence>
                {queueItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex h-16 w-28 flex-col items-center justify-center rounded border border-secondary/40 bg-secondary/5 text-xs"
                  >
                    <span className="font-semibold">{item.label || 'item'}</span>
                    <span>{item.value}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleQueuePushFront} data-testid="queue-push-front">
                push_front
              </Button>
              <Button
                type="button"
                onClick={handleQueuePushBack}
                variant="secondary"
                data-testid="queue-push-back"
              >
                push_back
              </Button>
              <Button
                type="button"
                onClick={handleQueuePopFront}
                variant="outline"
                data-testid="queue-pop-front"
              >
                pop_front
              </Button>
              <Button
                type="button"
                onClick={handleQueueSize}
                variant="ghost"
                data-testid="queue-size"
              >
                size()
              </Button>
            </div>
            <Console log={queueLog} label="queue console" />
          </TabsContent>

          <TabsContent value="assoc" className="mt-6 space-y-4" data-testid="assoc-panel">
            <div className="flex flex-wrap gap-2" data-testid="assoc-visual">
              <AnimatePresence>
                {assocItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex h-20 w-40 flex-col items-center justify-center rounded border border-amber-400/40 bg-amber-500/10 text-xs"
                  >
                    <span className="font-semibold">{item.label}</span>
                    <span>{item.value}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleAssocAdd} data-testid="assoc-add">
                add/update key
              </Button>
              <Button
                type="button"
                onClick={handleAssocDelete}
                variant="secondary"
                data-testid="assoc-delete"
              >
                delete(key)
              </Button>
              <Button
                type="button"
                onClick={handleAssocExists}
                variant="outline"
                data-testid="assoc-exists"
              >
                exists()
              </Button>
              <Button
                type="button"
                onClick={handleAssocKeys}
                variant="ghost"
                data-testid="assoc-iterate"
              >
                iterate keys
              </Button>
            </div>
            <Console log={assocLog} label="associative array console" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const Console = ({ log, label }: { log: string[]; label: string }) => (
  <div className="rounded border border-border bg-background/70 p-3 text-xs" data-testid={`${label.replace(/\s+/g, '-')}-log`}>
    <p className="mb-2 font-semibold text-muted-foreground">{label}</p>
    <div className="space-y-1 font-mono">
      {log.length ? log.map((entry, idx) => <div key={`${entry}-${idx}`}>{entry}</div>) : <span>no output yet</span>}
    </div>
  </div>
);

export default DataTypeExplorer;
