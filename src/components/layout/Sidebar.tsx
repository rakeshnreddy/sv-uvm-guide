"use client";

import { useNavigation } from '@/contexts/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, Link as LinkIcon, ChevronsUpDown, LayoutList } from 'lucide-react';
import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';

// Placeholder data
const moduleOutline = {
  title: 'T2: Intermediate UVM',
  sections: [
    { id: '1', title: 'I-UVM-1: UVM Intro', completed: true, current: false },
    { id: '2', title: 'I-UVM-2: Building a TB', completed: true, current: false },
    { id: '3', title: 'I-UVM-3: Sequences', completed: false, current: true },
    { id: '4', title: 'I-UVM-4: Phasing', completed: false, current: false },
  ],
};

const quickLinks = [
  { id: '1', label: 'Exercises', href: '/exercises', icon: LayoutList },
  { id: '2', label: 'UVM Phase Sorter', href: '/exercises/uvm-phase-sorter', icon: LayoutList },
];

const initialBookmarks = [
  { id: 'bookmark-1', label: 'Advanced Sequencing' },
  { id: 'bookmark-2', label: 'RAL Model' },
  { id: 'bookmark-3', label: 'Scoreboarding' },
];

// Sortable Item Component
const SortableItem = ({ id, label }: { id: string, label: string }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-muted/50 rounded-md mb-2 flex items-center cursor-grab active:cursor-grabbing">
            <Book className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="flex-grow">{label}</span>
        </div>
    );
};


const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar } = useNavigation();
  const [isOutlineOpen, setOutlineOpen] = useState(true);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: { active: any; over: any; }) => {
    const {active, over} = event;
    if (active.id !== over.id) {
      setBookmarks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={toggleSidebar}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 h-full w-80 bg-background z-50 shadow-lg border-r border-border/40 flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-border/40 flex-shrink-0">
              <h2 className="text-lg font-semibold">Quick Access</h2>
              <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-muted">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
              {/* Module Outline */}
              <div>
                <button onClick={() => setOutlineOpen(!isOutlineOpen)} className="w-full flex justify-between items-center font-semibold text-left mb-2">
                  <span>Module Outline</span>
                  <ChevronsUpDown className={`h-4 w-4 transition-transform ${isOutlineOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isOutlineOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 space-y-2 overflow-hidden"
                        >
                            <h3 className="font-semibold text-sm text-muted-foreground px-2">{moduleOutline.title}</h3>
                            <div className="mt-1 space-y-1">
                              {moduleOutline.sections.map(section => (
                                  <Link key={section.id} href="#" className={`block text-sm p-2 rounded-md ${section.current ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/50'} ${section.completed ? 'text-muted-foreground line-through' : ''}`}>
                                      {section.title}
                                  </Link>
                              ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="font-semibold mb-2">Quick Links</h3>
                <div className="space-y-2">
                    {quickLinks.map(link => (
                        <Link key={link.id} href={link.href} className="flex items-center p-2 bg-muted/50 rounded-md hover:bg-muted">
                            <link.icon className="h-4 w-4 mr-2" />
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </div>
              </div>

              {/* Bookmarks */}
              <div>
                <h3 className="font-semibold mb-2">Bookmarks</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={bookmarks} strategy={verticalListSortingStrategy}>
                        {bookmarks.map(bookmark => <SortableItem key={bookmark.id} id={bookmark.id} label={bookmark.label} />)}
                    </SortableContext>
                </DndContext>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
