"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";

type DynamicArrayState = {
  values: number[];
  capacity: number;
  isResizing: boolean;
  message: string | null;
};

type QueueState = {
  values: number[];
  bounded: boolean;
  boundSize: number;
  warning: string | null;
  message: string | null;
};

type AssociativeEntry = {
  key: string;
  value: string;
  highlight: boolean;
};

type AssociativeState = {
  entries: AssociativeEntry[];
  lastHashedKey: string | null;
};

type PackedDimension = {
  label: string;
  detail: string;
};

type PackedScenario = {
  id: string;
  title: string;
  declaration: string;
  description: string;
  packedDimensions: PackedDimension[];
  unpackedDimensions: PackedDimension[];
  memoryRows: Array<{ label: string; bits: string[] }>;
  challenge: {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
  };
};

const initialArrayValues = [8, 16, 24];
const initialQueueValues = [101, 102, 103];

const packedScenarios: PackedScenario[] = [
  {
    id: "byte-buffer",
    title: "Burst Payload Buffer",
    declaration: "logic [7:0] payload [0:3];",
    description:
      "A packed byte rides inside each unpacked queue slot. The packed dimension keeps contiguous bits, while the unpacked dimension walks through payload samples.",
    packedDimensions: [
      {
        label: "Packed [7:0]",
        detail: "Bits 7 down to 0 stay together as a single byte—this dimension becomes the vector width.",
      },
    ],
    unpackedDimensions: [
      {
        label: "Unpacked [0:3]",
        detail: "Four payload entries are stored sequentially: payload[0], payload[1], ... payload[3].",
      },
    ],
    memoryRows: [
      { label: "payload[0]", bits: ["7", "6", "5", "4", "3", "2", "1", "0"] },
      { label: "payload[1]", bits: ["7", "6", "5", "4", "3", "2", "1", "0"] },
      { label: "payload[2]", bits: ["7", "6", "5", "4", "3", "2", "1", "0"] },
      { label: "payload[3]", bits: ["7", "6", "5", "4", "3", "2", "1", "0"] },
    ],
    challenge: {
      question: "Which index toggles fastest as the simulator walks memory?",
      options: ["Packed bit position", "Unpacked payload index"],
      answer: "Packed bit position",
      explanation:
        "Packed bits live contiguously, so bit 0..7 flip faster than the unpacked entry number advancing.",
    },
  },
  {
    id: "lane-matrix",
    title: "Lane Matrix",
    declaration: "bit [3:0][1:0] lane_matrix [0:1];",
    description:
      "Two packed dimensions capture nibble-by-lane ordering, while the unpacked dimension selects which channel is being buffered.",
    packedDimensions: [
      {
        label: "Packed [3:0]",
        detail: "The outer packed dimension is the most-significant slice—it changes slowest across memory.",
      },
      {
        label: "Packed [1:0]",
        detail: "The inner packed dimension toggles fastest, hopping between lane_matrix[x][n][1] then [n][0].",
      },
    ],
    unpackedDimensions: [
      {
        label: "Unpacked [0:1]",
        detail: "Two channels exist. The entire packed payload for channel 0 is stored before channel 1.",
      },
    ],
    memoryRows: [
      {
        label: "lane_matrix[0]",
        bits: ["[3][1]", "[3][0]", "[2][1]", "[2][0]", "[1][1]", "[1][0]", "[0][1]", "[0][0]"],
      },
      {
        label: "lane_matrix[1]",
        bits: ["[3][1]", "[3][0]", "[2][1]", "[2][0]", "[1][1]", "[1][0]", "[0][1]", "[0][0]"],
      },
    ],
    challenge: {
      question: "Which dimension flips first when walking bits inside lane_matrix[0]?",
      options: ["Packed [1:0] lane", "Packed [3:0] nibble", "Unpacked channel"],
      answer: "Packed [1:0] lane",
      explanation:
        "Inner packed dimensions are least significant, so the lane index toggles with every adjacent bit.",
    },
  },
  {
    id: "scoreboard-grid",
    title: "Scoreboard Grid",
    declaration: "logic [3:0] scoreboard [0:1][0:2];",
    description:
      "One packed nibble per cell, arranged in a 2×3 unpacked matrix. Right-most unpacked dimensions iterate first.",
    packedDimensions: [
      {
        label: "Packed [3:0]",
        detail: "Each score entry is 4 bits wide and is stored contiguously as bits 3..0.",
      },
    ],
    unpackedDimensions: [
      {
        label: "Unpacked row [0:1]",
        detail: "Rows represent scoreboard phases. Row 0 is fully stored before row 1.",
      },
      {
        label: "Unpacked column [0:2]",
        detail: "Columns are the least-significant unpacked dimension and iterate first within a row.",
      },
    ],
    memoryRows: [
      { label: "scoreboard[0][0]", bits: ["3", "2", "1", "0"] },
      { label: "scoreboard[0][1]", bits: ["3", "2", "1", "0"] },
      { label: "scoreboard[0][2]", bits: ["3", "2", "1", "0"] },
      { label: "scoreboard[1][0]", bits: ["3", "2", "1", "0"] },
      { label: "scoreboard[1][1]", bits: ["3", "2", "1", "0"] },
      { label: "scoreboard[1][2]", bits: ["3", "2", "1", "0"] },
    ],
    challenge: {
      question: "After scoreboard[0][1], which unpacked element comes next in memory?",
      options: ["scoreboard[0][2]", "scoreboard[1][0]", "scoreboard[1][1]"],
      answer: "scoreboard[0][2]",
      explanation: "The right-most unpacked dimension (column) increments before the row advances.",
    },
  },
];

const slotVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

const warningVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const annotationVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

const drawerVariants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
};

const hashVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const getNextCapacity = (current: number) => Math.max(current * 2, current + 1);

const DynamicArrayTab: React.FC = () => {
  const [state, setState] = useState<DynamicArrayState>({
    values: initialArrayValues,
    capacity: 4,
    isResizing: false,
    message: null,
  });
  const [input, setInput] = useState("32");
  const [resizeInput, setResizeInput] = useState("6");

  useEffect(() => {
    if (!state.isResizing) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setState((prev) => ({ ...prev, isResizing: false }));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [state.isResizing]);

  const pushBack = () => {
    setState((prev) => {
      const value = Number.parseInt(input, 10);
      const nextValue = Number.isFinite(value) ? value : prev.values.length * 8;
      const needsResize = prev.values.length >= prev.capacity;
      const nextCapacity = needsResize ? getNextCapacity(prev.capacity) : prev.capacity;
      return {
        values: [...prev.values, nextValue],
        capacity: nextCapacity,
        isResizing: needsResize,
        message: needsResize
          ? `Auto-resized to capacity ${nextCapacity} after push_back.`
          : "Added element to the end.",
      };
    });
  };

  const popBack = () => {
    setState((prev) => {
      if (prev.values.length === 0) {
        return {
          ...prev,
          message: "Nothing to pop—dynamic arrays can shrink to zero.",
          isResizing: false,
        };
      }
      const newValues = prev.values.slice(0, -1);
      return {
        ...prev,
        values: newValues,
        isResizing: false,
        message: "Removed the last element with pop_back().",
      };
    });
  };

  const deleteArray = () => {
    setState({ values: [], capacity: 0, isResizing: false, message: "Array deleted—memory released." });
  };

  const resizeArray = () => {
    const target = Number.parseInt(resizeInput, 10);
    if (!Number.isFinite(target) || target < 0) {
      setState((prev) => ({
        ...prev,
        isResizing: false,
        message: "Enter a non-negative size before calling new[].",
      }));
      return;
    }

    setState((prev) => {
      const clipped = prev.values.slice(0, target);
      if (target > clipped.length) {
        const padding = Array.from({ length: target - clipped.length }, () => 0);
        clipped.push(...padding);
      }
      return {
        values: clipped,
        capacity: target,
        isResizing: true,
        message: `Called new[${target}] — packed values were trimmed or padded.`,
      };
    });
  };

  return (
    <div className="space-y-4" data-testid="dynamic-array-tab">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <Label htmlFor="dynamic-array-input">Value</Label>
          <Input
            id="dynamic-array-input"
            data-testid="dynamic-array-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="dynamic-array-push" onClick={pushBack}>
            push_back(value)
          </Button>
          <Button data-testid="dynamic-array-pop" variant="secondary" onClick={popBack}>
            pop_back()
          </Button>
          <Button data-testid="dynamic-array-delete" variant="outline" onClick={deleteArray}>
            delete()
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <div className="space-y-1">
            <Label htmlFor="dynamic-array-resize">new[size]</Label>
            <Input
              id="dynamic-array-resize"
              data-testid="dynamic-array-resize-input"
              value={resizeInput}
              onChange={(event) => setResizeInput(event.target.value)}
              className="w-full sm:w-32"
            />
          </div>
          <Button data-testid="dynamic-array-resize" variant="secondary" onClick={resizeArray}>
            new[size]
          </Button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-background/80 p-4" data-testid="dynamic-array-visual">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {state.values.map((value, index) => (
              <motion.div
                key={`${value}-${index}`}
                layout
                variants={slotVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-sm font-semibold text-primary dark:bg-primary/20 dark:text-primary-foreground"
              >
                <span>idx {index}</span>
                <span className="text-lg">{value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {state.isResizing && (
            <motion.div
              className="absolute inset-x-4 bottom-4 rounded-md border border-amber-500/50 bg-amber-100/90 p-3 text-sm font-medium text-amber-700 shadow-lg dark:bg-amber-900/80 dark:text-amber-100"
              variants={annotationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {state.message ?? "Resizing! This can be a hidden performance cost."}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="dynamic-array-info">
        <InfoTile label="size()" value={state.values.length.toString()} />
        <InfoTile label="capacity" value={state.capacity.toString()} />
        <InfoTile label="sum()" value={state.values.reduce((acc, value) => acc + value, 0).toString()} />
        <InfoTile label="Status" value={state.message ?? "Interact with the controls"} className="lg:col-span-2" />
      </div>
    </div>
  );
};

const QueueTab: React.FC = () => {
  const [state, setState] = useState<QueueState>({
    values: initialQueueValues,
    bounded: false,
    boundSize: 6,
    warning: null,
    message: null,
  });
  const [input, setInput] = useState("104");
  const [indexInput, setIndexInput] = useState("0");

  const toggleBounded = (checked: boolean) => {
    setState((prev) => ({
      ...prev,
      bounded: checked,
      warning: null,
      message: checked ? "Bound enabled—respect depth limits." : "Bound disabled—queue grows as needed.",
    }));
  };

  const pushBack = () => {
    setState((prev) => {
      const value = Number.parseInt(input, 10);
      const nextValue = Number.isFinite(value) ? value : prev.values.length + 100;
      if (prev.bounded && prev.values.length >= prev.boundSize) {
        return {
          ...prev,
          warning: "Queue Full!",
          message: "push_back() blocked by active bound.",
        };
      }
      return {
        ...prev,
        values: [...prev.values, nextValue],
        warning: null,
        message: `push_back() appended ${nextValue}.`,
      };
    });
  };

  const pushFront = () => {
    setState((prev) => {
      const value = Number.parseInt(input, 10);
      const nextValue = Number.isFinite(value) ? value : prev.values.length + 90;
      if (prev.bounded && prev.values.length >= prev.boundSize) {
        return {
          ...prev,
          warning: "Queue Full!",
          message: "push_front() blocked by active bound.",
        };
      }
      return {
        ...prev,
        values: [nextValue, ...prev.values],
        warning: null,
        message: `push_front() inserted ${nextValue} at the head.`,
      };
    });
  };

  const popFront = () => {
    setState((prev) => {
      if (prev.values.length === 0) {
        return {
          ...prev,
          warning: "Queue empty—no packet to pop.",
          message: "Queue empty—cannot pop_front().",
        };
      }
      const [, ...rest] = prev.values;
      return {
        ...prev,
        values: rest,
        warning: null,
        message: "pop_front() removed the oldest entry.",
      };
    });
  };

  const popBack = () => {
    setState((prev) => {
      if (prev.values.length === 0) {
        return {
          ...prev,
          warning: "Queue empty—no packet to pop.",
          message: "Queue empty—cannot pop_back().",
        };
      }
      const nextValues = prev.values.slice(0, -1);
      return {
        ...prev,
        values: nextValues,
        warning: null,
        message: "pop_back() dropped the newest entry.",
      };
    });
  };

  const parseIndex = () => {
    const parsed = Number.parseInt(indexInput, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const insertAt = () => {
    setState((prev) => {
      const index = parseIndex();
      const value = Number.parseInt(input, 10);
      const nextValue = Number.isFinite(value) ? value : prev.values.length + 88;
      if (Number.isNaN(index) || index < 0 || index > prev.values.length) {
        return {
          ...prev,
          message: "Index out of range for insert().",
        };
      }
      if (prev.bounded && prev.values.length >= prev.boundSize) {
        return {
          ...prev,
          warning: "Queue Full!",
          message: "insert() blocked by active bound.",
        };
      }
      const values = [...prev.values];
      values.splice(index, 0, nextValue);
      return {
        ...prev,
        values,
        warning: null,
        message: `insert(${index}) placed ${nextValue}.`,
      };
    });
  };

  const deleteAt = () => {
    setState((prev) => {
      const index = parseIndex();
      if (Number.isNaN(index) || index < 0 || index >= prev.values.length) {
        return {
          ...prev,
          message: "Index out of range for delete().",
        };
      }
      const values = prev.values.filter((_, idx) => idx !== index);
      return {
        ...prev,
        values,
        warning: null,
        message: `delete(${index}) removed the entry.`,
      };
    });
  };

  const updateBoundSize = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setState((prev) => ({ ...prev, boundSize: parsed, message: `Bound set to ${parsed}.` }));
    }
  };

  return (
    <div className="space-y-4" data-testid="queue-tab">
      <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div className="space-y-1">
          <Label htmlFor="queue-input">Value</Label>
          <Input
            id="queue-input"
            data-testid="queue-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="queue-index">Index</Label>
          <Input
            id="queue-index"
            data-testid="queue-index"
            value={indexInput}
            onChange={(event) => setIndexInput(event.target.value)}
            className="w-full sm:w-32"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="queue-push" onClick={pushBack}>
            push_back(value)
          </Button>
          <Button data-testid="queue-push-front" variant="secondary" onClick={pushFront}>
            push_front(value)
          </Button>
          <Button data-testid="queue-pop" variant="outline" onClick={popFront}>
            pop_front()
          </Button>
          <Button data-testid="queue-pop-back" variant="outline" onClick={popBack}>
            pop_back()
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-3">
          <Button data-testid="queue-insert" onClick={insertAt}>
            insert(index, value)
          </Button>
          <Button data-testid="queue-delete" variant="secondary" onClick={deleteAt}>
            delete(index)
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 p-4">
        <Switch id="queue-bounded" checked={state.bounded} onCheckedChange={toggleBounded} data-testid="queue-bounded-switch" />
        <Label htmlFor="queue-bounded" className="flex-1">
          Bounded queue
        </Label>
        {state.bounded && (
          <Input
            type="number"
            min={1}
            value={state.boundSize}
            onChange={updateBoundSize}
            className="w-24"
            data-testid="queue-bound-input"
          />
        )}
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-background/80 p-4">
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto" data-testid="queue-visual">
          <AnimatePresence>
            {state.values.map((value, index) => (
              <motion.div
                key={`${value}-${index}`}
                layout
                variants={slotVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="flex h-16 w-20 flex-col items-center justify-center rounded-md border border-sky-500/50 bg-sky-500/10 text-sm font-semibold text-sky-600 dark:text-sky-200"
              >
                <span>pos {index}</span>
                <span className="text-lg">{value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {state.warning && (
            <motion.div
              data-testid="queue-warning"
              className="absolute inset-x-4 bottom-4 rounded-md border border-rose-500/60 bg-rose-100/90 p-3 text-center text-sm font-semibold text-rose-700 shadow-lg dark:bg-rose-900/80 dark:text-rose-100"
              variants={warningVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {state.warning}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="queue-info">
        <InfoTile label="size()" value={state.values.length.toString()} />
        <InfoTile label="front()" value={state.values[0]?.toString() ?? "—"} />
        <InfoTile label="back()" value={state.values[state.values.length - 1]?.toString() ?? "—"} />
        <InfoTile
          label={state.bounded ? "capacity" : "capacity"}
          value={state.bounded ? state.boundSize.toString() : "∞"}
        />
        <InfoTile
          label="Status"
          value={state.message ?? "Queue methods await your call"}
          className="lg:col-span-4"
        />
      </div>
    </div>
  );
};

const AssociativeArrayTab: React.FC = () => {
  const [state, setState] = useState<AssociativeState>({
    entries: [
      { key: "packet_1001", value: "ACK", highlight: false },
      { key: "packet_1042", value: "ERR", highlight: false },
    ],
    lastHashedKey: null,
  });
  const [keyInput, setKeyInput] = useState("packet_1200");
  const [valueInput, setValueInput] = useState("PENDING");

  useEffect(() => {
    if (state.entries.some((entry) => entry.highlight)) {
      const timeout = window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          entries: prev.entries.map((entry) => ({ ...entry, highlight: false })),
        }));
      }, 600);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [state.entries]);

  const addOrUpdate = () => {
    setState((prev) => {
      const entries = [...prev.entries];
      const index = entries.findIndex((entry) => entry.key === keyInput.trim());
      if (keyInput.trim().length === 0) {
        return prev;
      }
      if (index >= 0) {
        entries[index] = { key: keyInput.trim(), value: valueInput.trim(), highlight: true };
      } else {
        entries.push({ key: keyInput.trim(), value: valueInput.trim(), highlight: true });
      }
      return {
        entries,
        lastHashedKey: keyInput.trim(),
      };
    });
  };

  const deleteKey = () => {
    setState((prev) => ({
      entries: prev.entries.filter((entry) => entry.key !== keyInput.trim()),
      lastHashedKey: keyInput.trim(),
    }));
  };

  const hashedSlot = useMemo(() => {
    if (!state.lastHashedKey) return null;
    const sum = state.lastHashedKey.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return sum % Math.max(state.entries.length || 1, 5);
  }, [state.entries.length, state.lastHashedKey]);

  return (
    <div className="space-y-4" data-testid="associative-array-tab">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="associative-key">Key</Label>
          <Input
            id="associative-key"
            data-testid="associative-key"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            className="w-full sm:w-48"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="associative-value">Value</Label>
          <Input
            id="associative-value"
            data-testid="associative-value"
            value={valueInput}
            onChange={(event) => setValueInput(event.target.value)}
            className="w-full sm:w-48"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="associative-add" onClick={addOrUpdate}>
            Add / Update
          </Button>
          <Button data-testid="associative-delete" variant="secondary" onClick={deleteKey}>
            delete(key)
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-4" data-testid="associative-visual">
          <div className="grid gap-2 sm:grid-cols-2">
            <AnimatePresence>
              {state.entries.map((entry) => (
                <motion.div
                  key={entry.key}
                  layout
                  variants={drawerVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "rounded-md border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 shadow-sm dark:bg-emerald-900/80 dark:text-emerald-100",
                    entry.highlight && "ring-2 ring-emerald-400",
                  )}
                >
                  <div className="text-xs uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">Key</div>
                  <div data-testid={`associative-entry-${entry.key}`}>{entry.key}</div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">Value</div>
                  <div>{entry.value}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-4" data-testid="associative-hash">
          <div className="text-sm font-semibold">Hashing Function</div>
          <AnimatePresence>
            {state.lastHashedKey && (
              <motion.div
                key={state.lastHashedKey}
                variants={hashVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="rounded-md border border-primary/50 bg-primary/10 p-3 text-sm"
              >
                <div className="font-semibold">Key: {state.lastHashedKey}</div>
                <div>→ Slot {hashedSlot}</div>
                <div className="text-xs text-muted-foreground">Associative arrays use hashing to jump to entries quickly.</div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="text-sm font-medium" data-testid="associative-count">
            Entries: {state.entries.length}
          </div>
        </div>
      </div>
    </div>
  );
};

const PackedUnpackedTab: React.FC = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const scenario = packedScenarios[scenarioIndex];

  const goToNextScenario = () => {
    setScenarioIndex((prev) => (prev + 1) % packedScenarios.length);
    setSelectedOption(null);
  };

  const goToPreviousScenario = () => {
    setScenarioIndex((prev) => (prev - 1 + packedScenarios.length) % packedScenarios.length);
    setSelectedOption(null);
  };

  const handleSelect = (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);
  };

  const feedback = selectedOption
    ? selectedOption === scenario.challenge.answer
      ? {
          tone: "success" as const,
          title: "Correct!",
          detail: scenario.challenge.explanation,
        }
      : {
          tone: "error" as const,
          title: "Try again",
          detail: scenario.challenge.explanation,
        }
    : null;

  return (
    <div className="space-y-5" data-testid="packed-unpacked-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold" data-testid="packed-scenario-title">
            {scenario.title}
          </h4>
          <p className="text-sm text-muted-foreground">{scenario.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={goToPreviousScenario} data-testid="packed-prev">
            Previous layout
          </Button>
          <Button onClick={goToNextScenario} data-testid="packed-next">
            Next layout
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
        <code className="rounded bg-muted/50 px-2 py-1 text-sm">{scenario.declaration}</code>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packed dimensions</div>
            <ul className="mt-2 space-y-2 text-sm">
              {scenario.packedDimensions.map((dimension) => (
                <li key={dimension.label} className="rounded-md border border-primary/40 bg-primary/10 p-3 dark:bg-primary/20">
                  <div className="font-semibold">{dimension.label}</div>
                  <div className="text-muted-foreground">{dimension.detail}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unpacked dimensions</div>
            <ul className="mt-2 space-y-2 text-sm">
              {scenario.unpackedDimensions.map((dimension) => (
                <li key={dimension.label} className="rounded-md border border-secondary/40 bg-secondary/10 p-3 dark:bg-secondary/20">
                  <div className="font-semibold">{dimension.label}</div>
                  <div className="text-muted-foreground">{dimension.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scenario.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4" data-testid="packed-memory">
            <div className="text-sm font-semibold">Memory walk</div>
            <div className="space-y-3">
              {scenario.memoryRows.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {row.bits.map((bitLabel, index) => (
                      <div
                        key={`${row.label}-${bitLabel}-${index}`}
                        className="flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-border/40 bg-muted/40 px-2 text-xs font-semibold"
                      >
                        {bitLabel}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4" data-testid="packed-quiz">
            <div className="text-sm font-semibold">Quick recall</div>
            <p className="text-sm text-muted-foreground">{scenario.challenge.question}</p>
            <div className="flex flex-wrap gap-2">
              {scenario.challenge.options.map((option) => {
                const isSelected = selectedOption === option;
                const isCorrect = option === scenario.challenge.answer;
                const showState = Boolean(selectedOption);
                return (
                  <Button
                    key={option}
                    data-testid={`packed-option-${option.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                    variant="outline"
                    className={cn(
                      "h-auto whitespace-normal text-left",
                      showState && isCorrect && "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-100",
                      showState && isSelected && !isCorrect && "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:bg-rose-900/80 dark:text-rose-100",
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>
            <AnimatePresence>
              {feedback && (
                <motion.div
                  key={feedback.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className={
                    feedback.tone === "success"
                      ? "rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-100"
                      : "rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm text-amber-700 dark:bg-amber-900/80 dark:text-amber-100"
                  }
                  data-testid="packed-feedback"
                >
                  <div className="font-semibold">{feedback.title}</div>
                  <div>{feedback.detail}</div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={goToNextScenario}
                data-testid="packed-advance"
                disabled={!selectedOption}
              >
                {scenarioIndex === packedScenarios.length - 1 ? "Loop to start" : "Next layout"}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const InfoTile: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
  <div className={cn("rounded-lg border border-border/60 bg-muted/30 p-3 text-sm", className)}>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export const DynamicStructureVisualizer: React.FC = () => {
  const [tab, setTab] = useState("dynamic");

  return (
    <div className="space-y-6" data-testid="dynamic-structure-visualizer">
      <Tabs defaultValue="dynamic" value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-2" data-testid="dynamic-structure-tabs">
          <TabsTrigger value="dynamic" data-testid="tab-dynamic-array" className="rounded-full px-4 py-2 text-sm font-medium">
            Dynamic Array
          </TabsTrigger>
          <TabsTrigger value="queue" data-testid="tab-queue" className="rounded-full px-4 py-2 text-sm font-medium">
            Queue
          </TabsTrigger>
          <TabsTrigger
            value="associative"
            data-testid="tab-associative"
            className="rounded-full px-4 py-2 text-sm font-medium"
          >
            Associative Array
          </TabsTrigger>
          <TabsTrigger value="packed" data-testid="tab-packed" className="rounded-full px-4 py-2 text-sm font-medium">
            Packed vs. Unpacked
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dynamic" forceMount>
          <DynamicArrayTab />
        </TabsContent>
        <TabsContent value="queue" forceMount>
          <QueueTab />
        </TabsContent>
        <TabsContent value="associative" forceMount>
          <AssociativeArrayTab />
        </TabsContent>
        <TabsContent value="packed" forceMount>
          <PackedUnpackedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DynamicStructureVisualizer;
