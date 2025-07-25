"use client";

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react'; // For drag handle

interface Phase {
  id: UniqueIdentifier; // Use UniqueIdentifier from dnd-kit
  name: string;
  correctOrder: number; // To verify later
}

const uvmPhases: Phase[] = [
  // Common phases, order is important
  { id: 'build', name: 'build_phase', correctOrder: 0 },
  { id: 'connect', name: 'connect_phase', correctOrder: 1 },
  { id: 'end_of_elaboration', name: 'end_of_elaboration_phase', correctOrder: 2 },
  { id: 'start_of_simulation', name: 'start_of_simulation_phase', correctOrder: 3 },
  { id: 'run', name: 'run_phase', correctOrder: 4 }, // This is the parent of runtime phases if detailed
  // Pre-Run
  { id: 'pre_reset', name: 'pre_reset_phase (if applicable)', correctOrder: 4.1},
  { id: 'reset', name: 'reset_phase (if applicable)', correctOrder: 4.2},
  { id: 'post_reset', name: 'post_reset_phase (if applicable)', correctOrder: 4.3},
  { id: 'pre_configure', name: 'pre_configure_phase (if applicable)', correctOrder: 4.4},
  { id: 'configure', name: 'configure_phase (if applicable)', correctOrder: 4.5},
  { id: 'post_configure', name: 'post_configure_phase (if applicable)', correctOrder: 4.6},
  { id: 'pre_main', name: 'pre_main_phase (if applicable)', correctOrder: 4.7},
  { id: 'main', name: 'main_phase (if applicable)', correctOrder: 4.8},
  { id: 'post_main', name: 'post_main_phase (if applicable)', correctOrder: 4.9},
  { id: 'pre_shutdown', name: 'pre_shutdown_phase (if applicable)', correctOrder: 4.91},
  { id: 'shutdown', name: 'shutdown_phase (if applicable)', correctOrder: 4.92},
  { id: 'post_shutdown', name: 'post_shutdown_phase (if applicable)', correctOrder: 4.93},
  // Post-Run
  { id: 'extract', name: 'extract_phase', correctOrder: 5 },
  { id: 'check', name: 'check_phase', correctOrder: 6 },
  { id: 'report', name: 'report_phase', correctOrder: 7 },
  { id: 'final', name: 'final_phase', correctOrder: 8 },
];

// Helper to shuffle array
const shuffleArray = (array: Phase[]): Phase[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface SortablePhaseItemProps {
  phase: Phase;
}

const SortablePhaseItem: React.FC<SortablePhaseItemProps> = ({ phase }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center p-3 mb-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg text-foreground touch-none select-none"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 mr-3 text-muted-foreground hover:bg-white/20 rounded"
        aria-label={`Drag ${phase.name}`}
      >
        <GripVertical size={20} />
      </button>
      <span>{phase.name}</span>
    </div>
  );
};


const UvmPhaseSorterExercise: React.FC = () => {
  const [items, setItems] = useState<Phase[]>([]);
  const [activeItem, setActiveItem] = useState<Phase | null>(null);

  useEffect(() => {
    setItems(shuffleArray(uvmPhases));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragEndEvent) {
    const { active } = event;
    setActiveItem(items.find(item => item.id === active.id) || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full max-w-md mx-auto p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-center text-primary">Sort the UVM Phases</h3>
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((phase) => (
              <SortablePhaseItem key={phase.id} phase={phase} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center p-3 mb-2 bg-primary text-primary-foreground rounded-md border border-white/20 shadow-xl cursor-grabbing">
               <GripVertical size={20} className="mr-3"/>
              <span>{activeItem.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
      {/* TODO: Add Check Order Button, Feedback, Score, Retry */}
    </DndContext>
  );
};

export default UvmPhaseSorterExercise;
