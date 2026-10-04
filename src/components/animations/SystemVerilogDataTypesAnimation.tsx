"use client";
import React, { useCallback, useRef, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  applyAssocOp,
  applyDynamicOp,
  applyQueueOp,
  createAssocArray,
  createDynamicArray,
  createQueue,
  formatAssocKey,
  formatElem,
  type DynamicArrayOp,
  type QueueOp,
} from '@/lib/systemverilog-array-model';
import { assignToIntegral, bitwiseBit, defaultVariableValue, type Bit4 } from '@/lib/sv-four-state-model';

// Every rule shown here comes from a tested model:
// - 4-state operators and 4→2-state conversion: sv-four-state-model.ts (§11.4.8, §6.11.2)
// - defaults: Table 6-7; containers: systemverilog-array-model.ts (§7.5, §7.8–§7.10)

const stateColor: Record<Bit4, string> = {
  '0': 'bg-slate-600',
  '1': 'bg-cyan-600',
  'x': 'bg-rose-600',
  'z': 'bg-amber-600',
};

const TwoStateValues: Bit4[] = ['0', '1'];
const FourStateValues: Bit4[] = ['0', '1', 'x', 'z'];
const cycle = (current: Bit4, values: Bit4[]) => values[(values.indexOf(current) + 1) % values.length];
const clampInt = (raw: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

/** Deterministic value source (seeded LCG) so demos never depend on Math.random. */
function useSeededValues(seed = 7) {
  const state = useRef(seed);
  return useCallback(() => {
    // Park–Miller minimal standard generator: products stay below 2^53, so it is exact in JS numbers.
    state.current = (state.current * 48271) % 2147483647;
    return state.current % 10;
  }, []);
}

function StateBox({ value, size = 'h-14 w-14', label }: { value: Bit4; size?: string; label: string }) {
  return (
    <motion.div
      key={value}
      aria-label={`${label} = ${value}`}
      className={`flex items-center justify-center rounded-lg font-mono text-xl font-bold text-white ${size} ${stateColor[value]} ${value === 'z' ? 'border-2 border-dashed border-white/70' : ''}`}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {value}
    </motion.div>
  );
}

type Layout = 'packed-struct' | 'unpacked-struct' | 'packed-union' | 'unpacked-union';

const LAYOUT_TEXT: Record<Layout, { code: string; text: string }> = {
  'packed-struct': {
    code: 'typedef struct packed { logic [3:0] a; logic [3:0] b; } s_t;',
    text: 'Members are concatenated into one 8-bit vector, first member in the most significant bits (§7.2.1).',
  },
  'unpacked-struct': {
    code: 'typedef struct { logic [3:0] a; logic [3:0] b; } s_t;',
    text: 'Separate members. How they are packed in memory is implementation-dependent (§7.2.1).',
  },
  'packed-union': {
    code: 'typedef union packed { logic [7:0] a; logic [7:0] b; } u_t;',
    text: 'One 8-bit vector seen through two names. A hard packed union needs every member to be the same size, and a value written as a can be read back as b (§7.3.1).',
  },
  'unpacked-union': {
    code: 'typedef union { logic [7:0] a; int b; } u_t;',
    text: 'One piece of storage, used as one member at a time. Its layout is not defined, so writing a and reading b is not portable (§7.3).',
  },
};

const SystemVerilogDataTypesAnimation = () => {
  const nextValue = useSeededValues();
  const [twoStateValue, setTwoStateValue] = useState<Bit4>('0');
  const [fourStateValue, setFourStateValue] = useState<Bit4>('x');
  const [packedDim, setPackedDim] = useState(4);
  const [unpackedDim, setUnpackedDim] = useState(3);
  const [inputA, setInputA] = useState<Bit4>('1');
  const [inputB, setInputB] = useState<Bit4>('x');
  const [layout, setLayout] = useState<Layout>('packed-struct');
  const [convertValue, setConvertValue] = useState<Bit4>('x');

  // Dynamic array: int arr[]. Only new[], new[](arr), size() and delete() exist (IEEE 1800-2023 §7.5).
  const [dyn, setDyn] = useState(() => ({
    arr: createDynamicArray('arr', 'int', []),
    log: null as { code: string; why: string } | null,
  }));
  const dynArray = dyn.arr;
  const dynLog = dyn.log;
  const runDyn = useCallback((op: DynamicArrayOp) => {
    setDyn(prev => {
      const result = applyDynamicOp(prev.arr, op);
      return { arr: result.after, log: { code: result.code, why: result.why } };
    });
  }, []);

  const [queue, setQueue] = useState(() => ({ q: createQueue('q', 'int', null), log: null as { code: string; why: string } | null }));
  const runQueue = (op: QueueOp) =>
    setQueue(prev => {
      const result = applyQueueOp(prev.q, op);
      return { q: result.after, log: { code: result.code, why: result.why } };
    });

  const [assoc, setAssoc] = useState(() => ({ a: createAssocArray('aa', 'int', 'string'), log: null as { code: string; why: string } | null }));
  const [assocKey, setAssocKey] = useState('');
  const [assocVal, setAssocVal] = useState(0);
  const runAssoc = (op: Parameters<typeof applyAssocOp>[1]) =>
    setAssoc(prev => {
      const result = applyAssocOp(prev.a, op);
      return { a: result.after, log: { code: result.code, why: result.why } };
    });
  const keyExists = assoc.a.entries.some(e => e.key === assocKey);

  const andOutput = bitwiseBit('&', inputA, inputB);
  const converted = assignToIntegral([convertValue], { states: 2, width: 1 }).bits[0];
  const unpackedDefault = defaultVariableValue('logic', 1)[0];

  return (
    <MotionConfig reducedMotion="user">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>SystemVerilog Data Types</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each section runs a tested model of the IEEE 1800-2023 rule it shows. Change the inputs and read the explanation.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-8 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            <section aria-label="2-state types">
              <h3 className="mb-2 text-lg font-bold">2-State Data Types (e.g., bit, int)</h3>
              <p className="mb-4 text-sm text-muted-foreground">Can only hold 0 or 1, and start at 0 (Table 6-7).</p>
              <div className="flex items-center gap-4">
                <StateBox value={twoStateValue} size="h-20 w-20" label="bit value" />
                <Button onClick={() => setTwoStateValue(cycle(twoStateValue, TwoStateValues))} aria-label="Cycle the 2-state value">
                  Cycle State
                </Button>
              </div>
            </section>
            <section aria-label="4-state types">
              <h3 className="mb-2 text-lg font-bold">4-State Data Types (e.g., logic, reg)</h3>
              <p className="mb-4 text-sm text-muted-foreground">Hold 0, 1, x (unknown) or z (high impedance), and start at x (Table 6-7).</p>
              <div className="flex items-center gap-4">
                <StateBox value={fourStateValue} size="h-20 w-20" label="logic value" />
                <Button onClick={() => setFourStateValue(cycle(fourStateValue, FourStateValues))} aria-label="Cycle the 4-state value">
                  Cycle State
                </Button>
              </div>
            </section>
          </div>

          <section aria-label="X and Z propagation">
            <h3 className="mb-2 text-lg font-bold">X/Z Propagation (AND Gate)</h3>
            <div className="mb-2 flex flex-wrap items-center gap-4">
              <StateBox value={inputA} label="a" />
              <span className="font-mono">&amp;</span>
              <StateBox value={inputB} label="b" />
              <span className="font-mono">=</span>
              <StateBox value={andOutput} label="a & b" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setInputA(cycle(inputA, FourStateValues))} aria-label="Cycle input a">
                Cycle a
              </Button>
              <Button size="sm" onClick={() => setInputB(cycle(inputB, FourStateValues))} aria-label="Cycle input b">
                Cycle b
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {inputA === '0' || inputB === '0'
                ? '0 is the controlling value of &: the result is 0 whatever the other input is, even x or z (§11.4.8).'
                : andOutput === '1'
                  ? 'Both inputs are 1, so the result is 1.'
                  : 'With no 0 to decide it, an x or z input makes the result x. z is treated as x by the operator (§11.4.8).'}
            </p>
          </section>

          <section aria-label="Packed and unpacked arrays">
            <h3 className="mb-4 text-lg font-bold">Packed vs. Unpacked Arrays</h3>
            <div className="mb-4 flex flex-wrap gap-4">
              <div>
                <Label htmlFor="packedDim">Packed width (bits)</Label>
                <Input id="packedDim" type="number" value={packedDim} onChange={e => setPackedDim(clampInt(e.target.value, 1, 8, packedDim))} min="1" max="8" />
              </div>
              <div>
                <Label htmlFor="unpackedDim">Unpacked elements</Label>
                <Input id="unpackedDim" type="number" value={unpackedDim} onChange={e => setUnpackedDim(clampInt(e.target.value, 1, 5, unpackedDim))} min="1" max="5" />
              </div>
            </div>
            <div className="grid gap-8 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              <div>
                <h4 className="font-mono font-semibold [font-variant-ligatures:none]">{`logic [${packedDim - 1}:0] v;`}</h4>
                <p className="mb-2 text-sm text-muted-foreground">One vector: bit {packedDim - 1} is the most significant. Usable as a whole number.</p>
                <div className="flex w-fit rounded-lg border-2 border-primary p-1">
                  {Array.from({ length: packedDim }).map((_, i) => (
                    <div key={i} className="flex h-8 w-8 items-center justify-center border border-cyan-500/60 bg-cyan-500/15 font-mono text-xs">
                      {packedDim - 1 - i}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-mono font-semibold [font-variant-ligatures:none]">{`logic mem [${unpackedDim}];`}</h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  {unpackedDim} separate elements, indexed 0..{unpackedDim - 1}. Each logic element starts at {unpackedDefault} (Table 6-7).
                </p>
                <div className="flex flex-col gap-1">
                  {Array.from({ length: unpackedDim }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-sm">[{i}]</span>
                      <div aria-label={`mem[${i}] = ${unpackedDefault}`} className="flex h-8 w-8 items-center justify-center border border-rose-500/60 bg-rose-500/15 font-mono text-xs">
                        {unpackedDefault}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Struct and union layout">
            <h3 className="mb-2 text-lg font-bold">Struct vs Union Layout</h3>
            <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Layout">
              {(Object.keys(LAYOUT_TEXT) as Layout[]).map(l => (
                <Button key={l} size="sm" role="radio" aria-checked={layout === l} variant={layout === l ? 'default' : 'outline'} onClick={() => setLayout(l)}>
                  {l.replace('-', ' ')}
                </Button>
              ))}
            </div>
            <pre className="mb-2 overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-xs text-slate-100 [font-variant-ligatures:none]">
              <code>{LAYOUT_TEXT[layout].code}</code>
            </pre>
            <div className="h-16 w-full max-w-64 overflow-hidden rounded-lg border-2 border-primary">
              {layout === 'packed-struct' ? (
                <div className="flex h-full w-full">
                  <div className="flex flex-1 items-center justify-center border-r border-primary bg-cyan-500/20 text-xs">a [7:4]</div>
                  <div className="flex flex-1 items-center justify-center bg-violet-500/20 text-xs">b [3:0]</div>
                </div>
              ) : layout === 'unpacked-struct' ? (
                <div className="flex h-full w-full flex-col gap-1 p-1">
                  <div className="flex flex-1 items-center justify-center rounded border border-dashed border-primary/60 bg-cyan-500/20 text-xs">a</div>
                  <div className="flex flex-1 items-center justify-center rounded border border-dashed border-primary/60 bg-violet-500/20 text-xs">b</div>
                </div>
              ) : layout === 'packed-union' ? (
                <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(90deg,rgba(6,182,212,0.25)_0_12px,rgba(139,92,246,0.25)_12px_24px)] text-xs">
                  a = b : the same bits [7:0]
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-primary/60 text-xs">
                  a or b: one storage, layout undefined
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {LAYOUT_TEXT[layout].text}
            </p>
          </section>

          <section aria-label="4-state to 2-state conversion">
            <h3 className="mb-2 text-lg font-bold">Type Conversion (logic → bit, logic → int)</h3>
            <p className="mb-4 text-sm text-muted-foreground">Assigning to a 2-state type turns x and z bits into 0 (§6.11.2), silently.</p>
            <div className="flex flex-wrap items-center gap-4">
              <StateBox value={convertValue} size="h-16 w-16" label="logic source" />
              <span className="font-mono text-xl" aria-hidden>
                &rarr;
              </span>
              <StateBox value={converted} size="h-16 w-16" label="bit result" />
              <Button onClick={() => setConvertValue(cycle(convertValue, FourStateValues))} aria-label="Cycle the logic source value">
                Cycle
              </Button>
            </div>
          </section>

          {/* Dynamic Array Operations: no push/pop on dynamic arrays (§7.5) */}
          <section aria-label="Dynamic array">
            <h3 className="mb-2 text-lg font-bold">Dynamic Array Operations</h3>
            <p className="mb-2 font-mono text-xs [font-variant-ligatures:none]">int arr[];  // size() = {dynArray.values.length}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => runDyn({ op: 'new', size: 3 })} title="Allocate 3 elements; old contents are discarded">
                arr = new[3]
              </Button>
              <Button
                size="sm"
                onClick={() => runDyn({ op: 'new-copy', size: dynArray.values.length + 2 })}
                title="Grow by 2 and keep the old contents"
              >
                {`arr = new[${dynArray.values.length + 2}](arr)`}
              </Button>
              <Button
                size="sm"
                onClick={() => runDyn({ op: 'write', index: 0, value: nextValue() + 1 })}
                disabled={dynArray.values.length === 0}
                title="Write element 0"
              >
                arr[0] = v
              </Button>
              <Button size="sm" onClick={() => runDyn({ op: 'delete' })} disabled={dynArray.values.length === 0} title="Empty the array">
                arr.delete()
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {dynArray.values.map((v, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center border border-violet-400 bg-violet-500/15 font-mono text-xs"
                  aria-label={`arr[${i}] = ${formatElem(v)}`}
                >
                  {formatElem(v)}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {dynLog ? (
                <>
                  <code className="font-mono [font-variant-ligatures:none]">{dynLog.code}</code> {dynLog.why}
                </>
              ) : (
                'A dynamic array has no push or pop. new[N] discards the old contents and fills with the default (0 for int); new[N](arr) keeps them.'
              )}
            </p>
          </section>

          <section aria-label="Queue">
            <h3 className="mb-2 text-lg font-bold">Queue Operations</h3>
            <p className="mb-2 font-mono text-xs [font-variant-ligatures:none]">int q[$];  // size() = {queue.q.values.length}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => runQueue({ op: 'push_front', value: nextValue() })}>
                push_front
              </Button>
              <Button size="sm" onClick={() => runQueue({ op: 'push_back', value: nextValue() })}>
                push_back
              </Button>
              <Button size="sm" onClick={() => runQueue({ op: 'pop_front' })}>
                pop_front
              </Button>
              <Button size="sm" onClick={() => runQueue({ op: 'pop_back' })}>
                pop_back
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {queue.q.values.map((v, i) => (
                <div key={i} aria-label={`q[${i}] = ${formatElem(v)}`} className="flex h-8 w-8 items-center justify-center border border-amber-400 bg-amber-500/15 font-mono text-xs">
                  {formatElem(v)}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {queue.log ? (
                <>
                  <code className="font-mono [font-variant-ligatures:none]">{queue.log.code}</code> {queue.log.why}
                </>
              ) : (
                'A queue grows and shrinks at both ends. Popping an empty queue returns the default value (0 for int); it does not block.'
              )}
            </p>
          </section>

          <section aria-label="Associative array">
            <h3 className="mb-2 text-lg font-bold">Associative Array</h3>
            <p className="mb-2 font-mono text-xs [font-variant-ligatures:none]">int aa[string];  // num() = {assoc.a.entries.length}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <Input aria-label="Key" placeholder="key" value={assocKey} onChange={e => setAssocKey(e.target.value)} className="w-24" />
              <Input
                aria-label="Value"
                placeholder="value"
                type="number"
                value={assocVal}
                onChange={e => setAssocVal(clampInt(e.target.value, -2147483648, 2147483647, 0))}
                className="w-24"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (assocKey === '') return;
                  runAssoc({ op: 'write', key: assocKey, value: assocVal });
                  setAssocKey('');
                }}
                disabled={assocKey === ''}
              >
                Set
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  runAssoc({ op: 'delete-key', key: assocKey });
                  setAssocKey('');
                }}
                disabled={!keyExists}
              >
                Delete
              </Button>
            </div>
            <ul className="flex flex-col gap-1" aria-label="Entries in index order">
              {assoc.a.entries.map(e => (
                <li key={String(e.key)} className="flex items-center gap-2">
                  <span className="font-mono text-sm">{formatAssocKey(e.key)}:</span>
                  <span className="flex h-8 min-w-8 items-center justify-center border border-pink-400 bg-pink-500/15 px-1 font-mono text-xs">{formatElem(e.value)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {assoc.log ? (
                <>
                  <code className="font-mono [font-variant-ligatures:none]">{assoc.log.code}</code> {assoc.log.why}
                </>
              ) : (
                'Entries are listed in index order: for a string index that is lexicographic order, not the order you wrote them (§7.8.2).'
              )}
            </p>
          </section>
        </CardContent>
      </Card>
    </MotionConfig>
  );
};

export default SystemVerilogDataTypesAnimation;
