"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Gauge, HardDrive, Zap } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
} from 'recharts';

const stateColor = {
  '0': 'bg-green-500',
  '1': 'bg-blue-500',
  'X': 'bg-red-500',
  'Z': 'bg-gray-500',
};

type StateColorKey = keyof typeof stateColor;

const TwoStateValues: StateColorKey[] = ['0', '1'];
const FourStateValues: StateColorKey[] = ['0', '1', 'X', 'Z'];

const SystemVerilogDataTypesAnimation = () => {
  const [twoStateValue, setTwoStateValue] = useState<StateColorKey>('0');
  const [fourStateValue, setFourStateValue] = useState<StateColorKey>('0');
  const [packedDim, setPackedDim] = useState(4);
  const [unpackedDim, setUnpackedDim] = useState(3);
  const [inputA, setInputA] = useState<StateColorKey>('0');
  const [inputB, setInputB] = useState<StateColorKey>('0');
  const [dynArray, setDynArray] = useState<number[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [assocArray, setAssocArray] = useState<Record<string, number>>({});
  const [assocKey, setAssocKey] = useState('');
  const [assocVal, setAssocVal] = useState(0);
  const [isStruct, setIsStruct] = useState(true);
  const [isPacked, setIsPacked] = useState(true);
  const [logicValue, setLogicValue] = useState<StateColorKey>('0');
  const [logicBitValue, setLogicBitValue] = useState<StateColorKey>('0');


  const cycleState = (currentValue: StateColorKey, values: StateColorKey[]) => {
    const currentIndex = values.indexOf(currentValue);
    return values[(currentIndex + 1) % values.length];
  };

  const computeAnd = (a: StateColorKey, b: StateColorKey): StateColorKey => {
    if (a === '0' || b === '0') return '0';
    if (a === '1' && b === '1') return '1';
    return 'X';
  };

  const andOutput = computeAnd(inputA, inputB);
  const logicToInt = (val: StateColorKey): number => (val === '1' ? 1 : 0);
  const logicToBit = (val: StateColorKey): StateColorKey => (val === '1' ? '1' : '0');
  const intValue = logicToInt(logicValue);
  const bitValue = logicToBit(logicBitValue);
  const logicBitPerfData = [
    { name: 'logic', memory: 2, speed: 1 },
    { name: 'bit', memory: 1, speed: 2 },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>SystemVerilog Data Types</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="md:flex gap-6">
          <div className="flex-1">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* 2-State Visualization */}
          <div>
            <h3 className="text-lg font-bold mb-2">2-State Data Types (e.g., bit, int)</h3>
            <p className="text-sm text-muted-foreground mb-4">Can only hold values 0 or 1.</p>
            <div className="flex items-center gap-4">
              <motion.div
                key={twoStateValue}
                className={`w-20 h-20 flex items-center justify-center text-white font-bold text-2xl rounded-lg ${stateColor[twoStateValue]}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {twoStateValue}
              </motion.div>
              <Button onClick={() => setTwoStateValue(cycleState(twoStateValue, TwoStateValues))}>
                Cycle State
              </Button>
            </div>
          </div>

          {/* 4-State Visualization */}
          <div>
            <h3 className="text-lg font-bold mb-2">4-State Data Types (e.g., logic, reg)</h3>
            <p className="text-sm text-muted-foreground mb-4">Can hold values 0, 1, X (unknown), or Z (high-impedance).</p>
            <div className="flex items-center gap-4">
              <motion.div
                key={fourStateValue}
                className={`w-20 h-20 flex items-center justify-center text-white font-bold text-2xl rounded-lg ${stateColor[fourStateValue]}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {fourStateValue}
              </motion.div>
              <Button onClick={() => setFourStateValue(cycleState(fourStateValue, FourStateValues))}>
                Cycle State
              </Button>
            </div>
          </div>
        </div>

        <hr className="my-8" />

        {/* X/Z Propagation */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2">X/Z Propagation (AND Gate)</h3>
          <div className="flex items-center gap-4 mb-2">
            <motion.div
              key={inputA}
              className={`w-14 h-14 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[inputA]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {inputA}
            </motion.div>
            <span className="font-mono">AND</span>
            <motion.div
              key={inputB}
              className={`w-14 h-14 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[inputB]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {inputB}
            </motion.div>
            <span className="font-mono">=</span>
            <motion.div
              key={andOutput}
              className={`w-14 h-14 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[andOutput]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {andOutput}
            </motion.div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setInputA(cycleState(inputA, FourStateValues))}>A</Button>
            <Button size="sm" onClick={() => setInputB(cycleState(inputB, FourStateValues))}>B</Button>
          </div>
        </div>

        {/* Array Visualization */}
        <div>
          <h3 className="text-lg font-bold mb-4">Packed vs. Unpacked Arrays</h3>
          <div className="flex gap-4 mb-4">
            <div>
              <Label htmlFor="packedDim">Packed Dimension</Label>
              <Input id="packedDim" type="number" value={packedDim} onChange={e => setPackedDim(parseInt(e.target.value))} min="1" max="8" />
            </div>
            <div>
              <Label htmlFor="unpackedDim">Unpacked Dimension</Label>
              <Input id="unpackedDim" type="number" value={unpackedDim} onChange={e => setUnpackedDim(parseInt(e.target.value))} min="1" max="5" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold">Packed Array: `logic [{packedDim-1}:0] array;`</h4>
              <p className="text-sm text-muted-foreground mb-2">Stored as a single, contiguous block of memory.</p>
              <div className="flex border-2 border-primary rounded-lg p-1">
                {Array.from({ length: packedDim }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-8 h-8 bg-blue-200 border border-blue-400 flex items-center justify-center text-xs"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    {packedDim - 1 - i}
                  </motion.div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Unpacked Array: `logic array [{unpackedDim}];`</h4>
              <p className="text-sm text-muted-foreground mb-2">Stored as individual elements in memory.</p>
              <div className="flex flex-col gap-1">
                {Array.from({ length: unpackedDim }).map((_, i) => (
                   <motion.div
                    key={i}
                    className="flex items-center gap-2"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                   >
                    <span className="font-mono text-sm">[{i}]</span>
                    <div className="w-8 h-8 bg-green-200 border border-green-400 flex items-center justify-center text-xs">0</div>
                   </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <hr className="my-8" />

        {/* Struct vs Union Memory Layout */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2">Struct vs Union Memory Layout</h3>
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant={isStruct ? 'default' : 'outline'} onClick={() => setIsStruct(true)}>
              Struct
            </Button>
            <Button size="sm" variant={!isStruct ? 'default' : 'outline'} onClick={() => setIsStruct(false)}>
              Union
            </Button>
            <Button size="sm" variant={isPacked ? 'default' : 'outline'} onClick={() => setIsPacked(true)}>
              Packed
            </Button>
            <Button size="sm" variant={!isPacked ? 'default' : 'outline'} onClick={() => setIsPacked(false)}>
              Unpacked
            </Button>
          </div>
          <div className="w-64 h-16 border-2 border-primary rounded-lg overflow-hidden relative">
            {isStruct ? (
              isPacked ? (
                <div className="flex w-full h-full">
                  <motion.div
                    className="flex-1 bg-blue-200 border-r border-primary flex items-center justify-center text-xs"
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    a
                  </motion.div>
                  <motion.div
                    className="flex-1 bg-green-200 flex items-center justify-center text-xs"
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    b
                  </motion.div>
                </div>
              ) : (
                <div className="flex flex-col w-full h-full">
                  <motion.div
                    className="flex-1 bg-blue-200 border-b border-primary flex items-center justify-center text-xs"
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    a
                  </motion.div>
                  <motion.div
                    className="flex-1 bg-green-200 flex items-center justify-center text-xs"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    b
                  </motion.div>
                </div>
              )
            ) : isPacked ? (
              <div className="relative w-full h-full">
                <motion.div
                  className="absolute inset-y-0 left-0 w-1/2 bg-blue-200 flex items-center justify-center text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                >
                  a
                </motion.div>
                <motion.div
                  className="absolute inset-0 bg-green-200 flex items-center justify-center text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                >
                  b
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col w-full h-full relative">
                <motion.div
                  className="flex-1 bg-blue-200 flex items-center justify-center text-xs"
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  a
                </motion.div>
                <motion.div
                  className="flex-1 bg-green-200 flex items-center justify-center text-xs"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  b
                </motion.div>
                <div className="absolute inset-0 border-2 border-primary pointer-events-none" />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isStruct
              ? isPacked
                ? 'Fields packed into contiguous bits.'
                : 'Fields stored separately.'
              : isPacked
              ? 'Members overlay within shared packed bits.'
              : 'Members share the same word but are accessed separately.'}
          </p>
        </div>

        <hr className="my-8" />

        {/* Type Conversion (logic → int) */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2">Type Conversion (logic → int)</h3>
          <p className="text-sm text-muted-foreground mb-4">X and Z convert to 0.</p>
          <div className="flex items-center gap-4">
            <motion.div
              key={logicValue}
              className={`w-16 h-16 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[logicValue]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {logicValue}
            </motion.div>
            <span className="font-mono text-xl">&rarr;</span>
            <motion.div
              key={intValue}
              className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg font-bold text-xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {intValue}
            </motion.div>
            <Button onClick={() => setLogicValue(cycleState(logicValue, FourStateValues))}>Cycle</Button>
          </div>
        </div>

        {/* Type Conversion (logic → bit) */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-2">Type Conversion (logic → bit)</h3>
          <p className="text-sm text-muted-foreground mb-4">X and Z convert to 0.</p>
          <div className="flex items-center gap-4">
            <motion.div
              key={logicBitValue}
              className={`w-16 h-16 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[logicBitValue]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {logicBitValue}
            </motion.div>
            <span className="font-mono text-xl">&rarr;</span>
            <motion.div
              key={bitValue}
              className={`w-16 h-16 flex items-center justify-center text-white font-bold rounded-lg ${stateColor[bitValue]}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {bitValue}
            </motion.div>
            <Button onClick={() => setLogicBitValue(cycleState(logicBitValue, FourStateValues))}>Cycle</Button>
          </div>
        </div>

        <hr className="my-8" />

        {/* Dynamic Array Operations */}
        <div>
          <h3 className="text-lg font-bold mb-2">Dynamic Array Operations</h3>
          <div className="flex gap-2 mb-2">
            <Button size="sm" onClick={() => setDynArray(prev => [...prev, Math.floor(Math.random() * 10)])}>Push</Button>
            <Button size="sm" onClick={() => setDynArray(prev => prev.slice(0, -1))} disabled={dynArray.length === 0}>Pop</Button>
          </div>
          <div className="flex gap-1">
            {dynArray.map((v, i) => (
              <motion.div
                key={i}
                className="w-8 h-8 bg-purple-200 border border-purple-400 flex items-center justify-center text-xs"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {v}
              </motion.div>
            ))}
          </div>
        </div>

        <hr className="my-8" />

        {/* Queue Operations */}
        <div>
          <h3 className="text-lg font-bold mb-2">Queue Operations</h3>
          <div className="flex gap-2 mb-2">
            <Button size="sm" onClick={() => setQueue(q => [Math.floor(Math.random() * 10), ...q])}>push_front</Button>
            <Button size="sm" onClick={() => setQueue(q => [...q, Math.floor(Math.random() * 10)])}>push_back</Button>
            <Button size="sm" onClick={() => setQueue(q => q.slice(1))} disabled={queue.length === 0}>pop_front</Button>
            <Button size="sm" onClick={() => setQueue(q => q.slice(0, -1))} disabled={queue.length === 0}>pop_back</Button>
          </div>
          <div className="flex gap-1">
            {queue.map((v, i) => (
              <motion.div
                key={i}
                className="w-8 h-8 bg-yellow-200 border border-yellow-400 flex items-center justify-center text-xs"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {v}
              </motion.div>
            ))}
          </div>
        </div>

        <hr className="my-8" />

        {/* Associative Array Operations */}
        <div>
          <h3 className="text-lg font-bold mb-2">Associative Array</h3>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="key"
              value={assocKey}
              onChange={e => setAssocKey(e.target.value)}
              className="w-24"
            />
            <Input
              placeholder="value"
              type="number"
              value={assocVal}
              onChange={e => setAssocVal(parseInt(e.target.value))}
              className="w-24"
            />
            <Button
              size="sm"
              onClick={() => {
                if (assocKey === '') return;
                setAssocArray(prev => ({ ...prev, [assocKey]: assocVal }));
                setAssocKey('');
              }}
            >
              Set
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAssocArray(prev => {
                  const copy = { ...prev };
                  delete copy[assocKey];
                  return copy;
                });
                setAssocKey('');
              }}
              disabled={!assocArray[assocKey]}
            >
              Delete
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(assocArray).map(([k, v]) => (
              <motion.div
                key={k}
                className="flex items-center gap-2"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <span className="font-mono text-sm">{k}:</span>
                <span className="w-8 h-8 bg-pink-200 border border-pink-400 flex items-center justify-center text-xs">{v}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <aside className="md:w-64 mt-8 md:mt-0">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Gauge className="w-4 h-4 mr-2" />
          Performance
        </h3>
        <div className="mb-6">
          <div className="flex items-center mb-2 text-sm font-medium">
            <HardDrive className="w-4 h-4 mr-2" />
            Memory
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={logicBitPerfData}>
              <XAxis dataKey="name" hide />
              <Bar dataKey="memory" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="flex items-center mb-2 text-sm font-medium">
            <Zap className="w-4 h-4 mr-2" />
            Speed
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={logicBitPerfData}>
              <XAxis dataKey="name" hide />
              <Bar dataKey="speed" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </aside>
    </div>
  </CardContent>
    </Card>
  );
};

export default SystemVerilogDataTypesAnimation;
