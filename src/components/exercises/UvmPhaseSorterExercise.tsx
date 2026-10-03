"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import { COMMON_ORDER, DIRECTION_PHASES, SCHEDULE_ORDER, gradePhaseSorter, seededShuffle, type SorterGrade } from "@/lib/uvm-phase-model";
import { cn } from "@/lib/utils";

/**
 * Two-lane phase sorter. Lane 1 is the common domain (build … final, with
 * run_phase as one task phase); lane 2 is the uvm schedule that runs beside
 * run_phase. Learners order each lane and mark each function phase top-down or
 * bottom-up. Grading comes from gradePhaseSorter in uvm-phase-model.
 */

export type Lane = "common" | "schedule";
type Direction = "top-down" | "bottom-up";

export interface Phase {
  id: UniqueIdentifier;
  name: string;
  /** Position within its lane. */
  correctOrder: number;
  lane: Lane;
}

export const uvmPhases: Phase[] = [
  ...COMMON_ORDER.map((n, i) => ({ id: n, name: `${n}_phase`, correctOrder: i, lane: "common" as const })),
  ...SCHEDULE_ORDER.map((n, i) => ({ id: n, name: `${n}_phase`, correctOrder: i, lane: "schedule" as const })),
];

/** Deterministic shuffle (seeded), so server and client render the same order. */
export const shuffleArray = (array: Phase[], seed = 1): Phase[] => seededShuffle(array, seed);

export function movePhase(items: Phase[], activeId: UniqueIdentifier, overId: UniqueIdentifier): Phase[] {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex < 0 || newIndex < 0) return items;
  return arrayMove(items, oldIndex, newIndex);
}

/** True when a lane is in schedule order. */
export function evaluatePhaseOrder(items: Phase[]): boolean {
  return items.every((item, i) => i === 0 || items[i - 1].correctOrder <= item.correctOrder);
}

const laneOf = (items: Phase[], lane: Lane) => items.filter((p) => p.lane === lane);

function SortableRow({
  phase,
  index,
  count,
  onMove,
  mark,
  direction,
  onDirection,
}: {
  phase: Phase;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  mark: "ok" | "bad" | null;
  direction?: Direction;
  onDirection?: (d: Direction) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : "auto" };
  const isRun = phase.id === "run";
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-sm text-foreground",
        isDragging && "opacity-70 shadow-lg",
        mark === "ok" && "border-emerald-500/60",
        mark === "bad" && "border-rose-500/60",
        !mark && "border-border/70",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${phase.name}`}
        className="inline-flex h-9 w-8 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <span className="min-w-0 flex-1 font-mono text-[12px] [font-variant-ligatures:none]">
        {mark === "ok" ? <span aria-label="in order">✓ </span> : mark === "bad" ? <span aria-label="out of order">✕ </span> : null}
        {phase.name}
      </span>
      {isRun ? (
        <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px]">∥ task</span>
      ) : onDirection ? (
        <span role="group" aria-label={`Direction of ${phase.name}`} className="inline-flex gap-1">
          {(["top-down", "bottom-up"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              aria-label={`${phase.name} runs ${d}`}
              onClick={() => onDirection(d)}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                direction === d ? "border-cyan-500 bg-cyan-500/15" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {d === "top-down" ? "↓" : "↑"}
            </button>
          ))}
        </span>
      ) : null}
      <span className="inline-flex gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Move ${phase.name} up`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
        >
          <ArrowUp size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label={`Move ${phase.name} down`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
        >
          <ArrowDown size={14} aria-hidden />
        </button>
      </span>
    </li>
  );
}

function LaneList({
  title,
  description,
  items,
  setItems,
  marks,
  directions,
  onDirection,
  onInteract,
}: {
  title: string;
  description: string;
  items: Phase[];
  setItems: (next: Phase[]) => void;
  marks: Set<string> | null;
  directions?: Partial<Record<string, Direction>>;
  onDirection?: (name: string, d: Direction) => void;
  onInteract: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onInteract();
      setItems(movePhase(items, active.id, over.id));
    }
  };
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    onInteract();
    setItems(arrayMove(items, i, j));
  };
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mb-2 text-xs text-muted-foreground">{description}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1.5">
            {items.map((p, i) => (
              <SortableRow
                key={p.id}
                phase={p}
                index={i}
                count={items.length}
                onMove={(d) => move(i, d)}
                mark={marks ? (marks.has(String(p.id)) ? "ok" : "bad") : null}
                direction={directions?.[String(p.id)]}
                onDirection={onDirection && DIRECTION_PHASES.includes(String(p.id)) ? (d) => onDirection(String(p.id), d) : undefined}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

interface UvmPhaseSorterExerciseProps {
  /** Starting order (both lanes); defaults to a seeded shuffle. */
  initialItems?: Phase[];
  initialDirections?: Partial<Record<string, Direction>>;
}

const shuffledLanes = (seed: number) => ({
  common: shuffleArray(laneOf(uvmPhases, "common"), seed),
  schedule: shuffleArray(laneOf(uvmPhases, "schedule"), seed + 101),
});

const UvmPhaseSorterExercise: React.FC<UvmPhaseSorterExerciseProps> = ({ initialItems, initialDirections }) => {
  const [seed, setSeed] = useState(1);
  const [common, setCommon] = useState<Phase[]>(() => (initialItems ? laneOf(initialItems, "common") : shuffledLanes(1).common));
  const [schedule, setSchedule] = useState<Phase[]>(() => (initialItems ? laneOf(initialItems, "schedule") : shuffledLanes(1).schedule));
  const [directions, setDirections] = useState<Partial<Record<string, Direction>>>(initialDirections ?? {});
  const [grade, setGrade] = useState<SorterGrade | null>(null);
  const { progress, recordAttempt, resetProgress, logInteraction } = useExerciseProgress("uvm-phase-sorter");

  const touch = () => {
    logInteraction();
    setGrade(null);
  };

  const checkOrder = () => {
    logInteraction();
    const g = gradePhaseSorter({ common: common.map((p) => String(p.id)), schedule: schedule.map((p) => String(p.id)), directions });
    recordAttempt(g.percent);
    setGrade(g);
  };

  const retry = () => {
    const next = seed + 1;
    const lanes = shuffledLanes(next);
    setSeed(next);
    setCommon(lanes.common);
    setSchedule(lanes.schedule);
    setDirections({});
    setGrade(null);
    logInteraction();
  };

  const dirCount = grade ? Object.values(grade.directionCorrect).filter(Boolean).length : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        After start_of_simulation, two lanes run at the same time: <strong>run_phase</strong> (common domain) and the <strong>uvm schedule</strong>. Put each
        lane in order, and mark every function phase ↓ top-down or ↑ bottom-up. Drag a handle (Space to lift, arrows to move, Space to drop) or use the
        arrow buttons.
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <LaneList
          title="Lane 1 · common domain"
          description="Nine phases from build to final. run_phase is one task phase."
          items={common}
          setItems={(next) => {
            setCommon(next);
            setGrade(null);
          }}
          marks={grade ? new Set(grade.commonInPlace) : null}
          directions={directions}
          onDirection={(name, d) => {
            touch();
            setDirections((prev) => ({ ...prev, [name]: d }));
          }}
          onInteract={logInteraction}
        />
        <LaneList
          title="Lane 2 · uvm schedule (beside run_phase)"
          description="Twelve runtime task phases. Every component goes through them together."
          items={schedule}
          setItems={(next) => {
            setSchedule(next);
            setGrade(null);
          }}
          marks={grade ? new Set(grade.scheduleInPlace) : null}
          onInteract={logInteraction}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={checkOrder}>Check Order</Button>
        <Button variant="outline" onClick={retry}>
          Shuffle Again
        </Button>
      </div>

      {grade ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="exercise-feedback"
          className={cn(
            "rounded-lg border p-4 text-sm",
            grade.passed ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100",
          )}
        >
          <p className="text-lg font-semibold">Score: {grade.percent}%</p>
          <p className="mt-1">
            {grade.passed
              ? "Every phase falls into place: both lanes in order and every direction right."
              : "A few phases are still out of order or pointing the wrong way. ✕ marks a phase that breaks its lane's order."}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Common domain: {grade.commonInPlace.length}/{COMMON_ORDER.length} in order
            </li>
            <li>
              uvm schedule: {grade.scheduleInPlace.length}/{SCHEDULE_ORDER.length} in order
            </li>
            <li>
              Directions: {dirCount}/{DIRECTION_PHASES.length} right
            </li>
            {grade.diagnoses.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Best score: {progress.bestScore}% · Attempts: {progress.attempts}
        </span>
        {progress.attempts > 0 ? (
          <Button variant="ghost" size="sm" onClick={resetProgress} className="text-xs">
            Clear saved progress
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default UvmPhaseSorterExercise;
