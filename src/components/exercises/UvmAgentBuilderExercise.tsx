"use client";

import React, { useMemo, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DraggableSyntheticListeners,
  DraggableAttributes,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { useExerciseProgress } from '@/hooks/useExerciseProgress';

export interface Item {
  id: string;
  name: string;
}

// Minimal required components for a basic UVM agent
export const REQUIRED_COMPONENTS: Item[] = [
  { id: 'sequencer', name: 'Sequencer' },
  { id: 'driver', name: 'Driver' },
  { id: 'monitor', name: 'Monitor' },
];

const instructionId = 'uvm-agent-builder-instructions';

// Helper used by the validate button and unit tests
export function checkAgentComponents(agentComponents: Item[]) {
  const missing = REQUIRED_COMPONENTS.filter(
    (req) => !agentComponents.find((item) => item.id === req.id),
  );

  const orderCorrect = REQUIRED_COMPONENTS.every(
    (req, index) => agentComponents[index]?.id === req.id,
  );

  const correctCount = REQUIRED_COMPONENTS.reduce(
    (count, req, index) =>
      agentComponents[index]?.id === req.id ? count + 1 : count,
    0,
  );

  const score = Math.round(
    (correctCount / REQUIRED_COMPONENTS.length) * 100,
  );

  const warnings: string[] = [];
  if (missing.length > 0) {
    warnings.push(
      `Missing components: ${missing.map((m) => m.name).join(', ')}`,
    );
  }
  if (!orderCorrect) {
    warnings.push('Components are not in the correct order.');
  }

  return { warnings, score };
}

interface DraggableItemProps {
  item: Item;
  isOverlay?: boolean; // To style the drag overlay differently if needed
}

interface FeedbackState {
  score: number;
  passed: boolean;
  warnings: string[];
  message: string;
}

// Simple Draggable Item Component
const DraggableItem: React.FC<
  DraggableItemProps & {
    attributes?: DraggableAttributes;
    listeners?: DraggableSyntheticListeners;
    style?: React.CSSProperties;
  }
> = ({ item, attributes, listeners, style, isOverlay }) => {
  return (
    <div
      {...(attributes ?? {})}
      {...(listeners ?? {})}
      style={style ?? {}}
      className={`p-3 mb-2 rounded-md shadow ${isOverlay ? 'bg-blue-400 text-white ring-2 ring-blue-600 cursor-grabbing' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-grab'}`}
    >
      {item.name}
    </div>
  );
};


// Sortable wrapper for DraggableItem
const SortableItem: React.FC<{ item: Item }> = ({ item }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 100 : 'auto',
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        role="listitem"
        aria-roledescription="sortable item"
      >
        <DraggableItem item={item} attributes={attributes} listeners={listeners} isOverlay={isDragging} />
      </div>
    );
};


const UvmAgentBuilderExercise: React.FC = () => {
  const initialComponents = useMemo<Item[]>(
    () => [
      ...REQUIRED_COMPONENTS,
      { id: 'config_obj', name: 'Config Object' },
      { id: 'virtual_sequencer', name: 'Virtual Sequencer' },
    ],
    [],
  );

  const [availableComponents, setAvailableComponents] = useState<Item[]>(() => [...initialComponents]);
  const [agentComponents, setAgentComponents] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const {
    progress: savedProgress,
    recordAttempt,
    resetProgress,
    logInteraction,
    analytics,
  } = useExerciseProgress('uvm-agent-builder');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findContainer = (id: string) => {
    if (agentComponents.find(item => item.id === id)) return 'agent';
    if (availableComponents.find(item => item.id === id)) return 'available';
    return null;
  }

  const getActiveItem = () => {
    if (!activeId) return null;
    return availableComponents.find(i => i.id === activeId) || agentComponents.find(i => i.id === activeId);
  }

  useEffect(() => {
    // Expose deterministic controls for Playwright so the suite can stage
    // required components without relying on flaky drag-and-drop gestures.
    if (typeof window === 'undefined') {
      return;
    }

    const testApi = {
      setAgentComponents: (ids: string[]) => {
        const desired = initialComponents.filter((item) => ids.includes(item.id));
        setAgentComponents(desired);
        setAvailableComponents(initialComponents.filter((item) => !ids.includes(item.id)));
        setFeedback(null);
      },
      reset: () => {
        setAvailableComponents([...initialComponents]);
        setAgentComponents([]);
        setFeedback(null);
      },
    };

    (window as typeof window & {
      __uvmAgentBuilderTest?: typeof testApi;
    }).__uvmAgentBuilderTest = testApi;

    return () => {
      const win = window as typeof window & {
        __uvmAgentBuilderTest?: typeof testApi;
      };

      if (win.__uvmAgentBuilderTest === testApi) {
        delete win.__uvmAgentBuilderTest;
      }
    };
  }, [initialComponents]);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
    logInteraction();
  }


  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return; // Dropped outside any droppable

    logInteraction();

    const activeContainer = findContainer(active.id as string);
    const overContainerId = over.id as string; // 'available-droppable' or 'agent-droppable'

    const activeItem = availableComponents.find(i => i.id === active.id) || agentComponents.find(i => i.id === active.id);
    if (!activeItem) return;

    if (activeContainer === 'available' && overContainerId === 'agent-droppable') {
        // Moving from Available to Agent
        setAvailableComponents(prev => prev.filter(item => item.id !== active.id));
        setAgentComponents(prev => [...prev, activeItem]);
    } else if (activeContainer === 'agent' && overContainerId === 'available-droppable') {
        // Moving from Agent to Available
        setAgentComponents(prev => prev.filter(item => item.id !== active.id));
        setAvailableComponents(prev => [...prev, activeItem]);
    } else if (activeContainer === 'agent' && overContainerId === 'agent-droppable') {
        // Reordering within Agent container
        const oldIndex = agentComponents.findIndex(item => item.id === active.id);
        const newIndex = agentComponents.findIndex(item => item.id === over.id) !== -1
                         ? agentComponents.findIndex(item => item.id === over.id)
                         : agentComponents.length -1; // if over a non-item part of droppable
        if (oldIndex !== newIndex) {
            setAgentComponents(items => arrayMove(items, oldIndex, newIndex));
        }
    } else if (activeContainer === 'available' && overContainerId === 'available-droppable') {
        // Reordering within Available container
        const oldIndex = availableComponents.findIndex(item => item.id === active.id);
        const newIndex = availableComponents.findIndex(item => item.id === over.id) !== -1
                         ? availableComponents.findIndex(item => item.id === over.id)
                         : availableComponents.length -1;
        if (oldIndex !== newIndex) {
            setAvailableComponents(items => arrayMove(items, oldIndex, newIndex));
        }
    }
  }

  const activeItem = getActiveItem();

  const checkAgent = () => {
    logInteraction();
    const { warnings, score } = checkAgentComponents(agentComponents);
    const passed = score === 100;
    const message = passed
      ? 'Sequencer, driver, and monitor are assembled in the right order. Nice work!'
      : warnings.length > 0
        ? `Keep iterating—${warnings.join(' ')}`
        : 'Components are present but the order needs a quick check.';

    recordAttempt(score);
    setFeedback({ score, passed, warnings, message });
  };

  const handleRetry = () => {
    setAvailableComponents([...initialComponents]);
    setAgentComponents([]);
    setFeedback(null);
    logInteraction();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-[rgba(230,241,255,0.75)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-primary">Best score: {savedProgress.bestScore}%</p>
          <p>
            Attempts: {savedProgress.attempts}
            {savedProgress.lastPlayedLabel ? ` • Last played ${savedProgress.lastPlayedLabel}` : ''}
          </p>
          {savedProgress.attempts > 0 && (
            <p className="text-xs text-[rgba(230,241,255,0.65)]">
              Average score: {Math.round(analytics.competency)}% • Interactions: {analytics.engagement}
            </p>
          )}
        </div>
        {savedProgress.attempts > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetProgress}
            className="self-start text-xs text-[rgba(230,241,255,0.8)] hover:bg-white/10"
          >
            Clear saved progress
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col items-start gap-6 p-4 md:flex-row">
          <p id={instructionId} className="mb-4 text-sm text-muted-foreground md:w-full">
            Drag each component or use keyboard controls (space to lift, arrow keys to move) to assemble the agent. Drop sequencer, driver, and monitor into the UVM Agent zone.
          </p>
          <div
            className="w-full rounded-lg border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg md:w-1/3"
            data-testid="agent-palette"
          >
            <h3 className="mb-3 text-lg font-semibold text-primary">Available UVM Components</h3>
            <SortableContext items={availableComponents.map(i => i.id)} strategy={verticalListSortingStrategy} id="available-droppable">
              <div
                id="available-droppable"
                className="min-h-[220px] rounded border-2 border-dashed border-white/20 p-2"
                role="list"
                aria-describedby={instructionId}
              >
                {availableComponents.map(item => <SortableItem key={item.id} item={item} />)}
                {availableComponents.length === 0 && <p className="py-4 text-center text-muted-foreground">All components used.</p>}
              </div>
            </SortableContext>
          </div>

          <div className="w-full rounded-lg border-2 border-accent bg-white/10 p-4 shadow-lg backdrop-blur-lg md:w-2/3">
            <h3 className="mb-3 text-lg font-semibold text-accent">UVM Agent (Drop Zone)</h3>
            <SortableContext items={agentComponents.map(i => i.id)} strategy={verticalListSortingStrategy} id="agent-droppable">
              <div
                id="agent-droppable"
                className="min-h-[220px] rounded border border-dashed border-accent bg-white/10 p-2"
                role="list"
                aria-describedby={instructionId}
              >
                {agentComponents.map(item => <SortableItem key={item.id} item={item} />)}
                {agentComponents.length === 0 && <p className="py-4 text-center text-muted-foreground">Drag components here</p>}
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeItem ? <DraggableItem item={activeItem} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <div className="flex justify-center gap-2">
        <Button onClick={checkAgent}>Check Agent</Button>
        <Button variant="outline" onClick={handleRetry}>Retry</Button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border p-4 text-sm ${feedback.passed ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/50 bg-amber-500/10 text-amber-100'}`}
          role="status"
          aria-live="polite"
          data-testid="exercise-feedback"
        >
          <p className="text-lg font-semibold">Score: {feedback.score}%</p>
          <p className="mt-1">{feedback.message}</p>
          {feedback.warnings.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-xs">
              {feedback.warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default UvmAgentBuilderExercise;
