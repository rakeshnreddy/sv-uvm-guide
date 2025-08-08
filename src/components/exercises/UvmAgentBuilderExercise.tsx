"use client";

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DraggableSyntheticListeners,
  DraggableAttributes,
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

// Simple Draggable Item Component
const DraggableItem: React.FC<DraggableItemProps & { attributes: DraggableAttributes; listeners?: DraggableSyntheticListeners; style: React.CSSProperties }> = ({ item, attributes, listeners, style, isOverlay }) => {
  return (
    <div
      {...attributes}
      {...listeners}
      style={style}
      className={`p-3 mb-2 rounded-md shadow ${isOverlay ? 'bg-blue-400 text-white ring-2 ring-blue-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-grab'}`}
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
      <div ref={setNodeRef} style={style}>
        <DraggableItem item={item} attributes={attributes} listeners={listeners} style={{}} isOverlay={isDragging} />
      </div>
    );
};


const UvmAgentBuilderExercise: React.FC = () => {
  const initialComponents: Item[] = [
    ...REQUIRED_COMPONENTS,
    { id: 'config_obj', name: 'Config Object' }, // Example of another component
  ];

  const [availableComponents, setAvailableComponents] = useState<Item[]>(initialComponents);
  const [agentComponents, setAgentComponents] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);


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

  function handleDragStart(event: DragEndEvent) {
    const {active} = event;
    setActiveId(active.id as string);
  }


  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return; // Dropped outside any droppable

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

  const handleValidate = () => {
    const { warnings, score } = checkAgentComponents(agentComponents);
    setScore(score);
    if (warnings.length === 0) {
      setFeedback('Agent correctly built!');
    } else {
      setFeedback(warnings.join(' '));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row gap-6 p-4 items-start">
        {/* Available Components */}
        <div className="w-full md:w-1/3 p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-3 text-primary">Available UVM Components</h3>
          <SortableContext items={availableComponents.map(i => i.id)} strategy={verticalListSortingStrategy} id="available-droppable">
             <div id="available-droppable" className="min-h-[200px] border-2 border-dashed border-white/20 rounded p-2">
                {availableComponents.map(item => <SortableItem key={item.id} item={item} />)}
                {availableComponents.length === 0 && <p className="text-muted-foreground text-center py-4">All components used.</p>}
             </div>
          </SortableContext>
        </div>

        {/* Agent Target Area */}
        <div className="w-full md:w-2/3 p-4 bg-white/10 backdrop-blur-lg border-2 border-accent rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-3 text-accent">UVM Agent (Drop Zone)</h3>
           <SortableContext items={agentComponents.map(i => i.id)} strategy={verticalListSortingStrategy} id="agent-droppable">
            <div id="agent-droppable" className="min-h-[200px] p-2 bg-white/10 rounded border border-dashed border-accent">
                {agentComponents.map(item => <SortableItem key={item.id} item={item} />)}
                {agentComponents.length === 0 && <p className="text-muted-foreground text-center py-4">Drag components here</p>}
            </div>
          </SortableContext>
        </div>
      </div>
      <div className="flex flex-col items-center mt-4">
        <Button onClick={handleValidate}>Validate Agent</Button>
        {feedback && (
          <p className="mt-2 text-center">
            {feedback}
            {score !== null && ` Score: ${score}%`}
          </p>
        )}
      </div>
       {typeof document !== 'undefined' && activeId && (
          <div style={{position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 1000}}>
            {/* This is a simplified drag overlay. For a perfect overlay matching the item,
                you'd use <DragOverlay> from @dnd-kit/core andPortal={document.body} */}
            {activeItem &&
              <DraggableItem
                item={activeItem}
                isOverlay={true}
                attributes={{
                  role: 'button', // Or appropriate role for a draggable item
                  'aria-roledescription': 'draggable item',
                  tabIndex: -1,
                  'aria-disabled': true,
                  'aria-pressed': undefined,
                  'aria-describedby': 'draggable-item-description', // A bit generic, but satisfies type
                }}
                style={{}}
              />}
          </div>
        )}
    </DndContext>
  );
};

export default UvmAgentBuilderExercise;
