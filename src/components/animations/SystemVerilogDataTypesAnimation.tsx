"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

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

  const cycleState = (currentValue: StateColorKey, values: StateColorKey[]) => {
    const currentIndex = values.indexOf(currentValue);
    return values[(currentIndex + 1) % values.length];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>SystemVerilog Data Types</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};

export default SystemVerilogDataTypesAnimation;
