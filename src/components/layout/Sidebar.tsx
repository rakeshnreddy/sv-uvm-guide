"use client";

import React, { useMemo, useState } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, ChevronsUpDown, LayoutList } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { curriculumData, normalizeSlug } from '@/lib/curriculum-data';
import { buildCurriculumStatus, type TopicStatus } from '@/lib/curriculum-status';

type OutlineSection = {
  id: string;
  title: string;
  href: string;
  status: TopicStatus;
  current: boolean;
};

type OutlineModule = {
  title: string;
  sections: OutlineSection[];
};

const statusLabels: Record<TopicStatus, string> = {
  complete: 'Complete',
  'in-review': 'In Review',
  draft: 'Draft',
};

const statusStyles: Record<TopicStatus, string> = {
  complete: 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  'in-review': 'border border-amber-400/30 bg-amber-500/15 text-amber-200',
  draft: 'border border-slate-400/30 bg-slate-500/15 text-slate-200',
};

const formatTierTitle = (slug: string, fallback: string): string => {
  if (!slug) return fallback;
  const [tierCode, ...rest] = slug.split('_');
  if (!tierCode) return fallback;
  const tierLabel = tierCode.replace(/^T/, 'Tier ');
  if (rest.length === 0) return `${tierLabel}: ${fallback}`;
  const descriptor = rest.join(' ').replace(/_/g, ' ');
  const titled = descriptor.replace(/\b\w/g, char => char.toUpperCase());
  return `${tierLabel}: ${titled}`;
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
  const pathname = usePathname();

  const curriculumStatus = useMemo(() => buildCurriculumStatus(), []);

  const moduleOutline: OutlineModule | null = useMemo(() => {
    if (!curriculumData.length) {
      return null;
    }

    const activePath = pathname ?? '';
    const segments = activePath.split('/').filter(Boolean);
    let normalized: string[] = [];

    if (segments[0] === 'curriculum') {
      normalized = normalizeSlug(segments.slice(1));
    }

    if (normalized.length === 0) {
      const defaultTier = curriculumData[0];
      normalized = defaultTier ? normalizeSlug([defaultTier.slug]) : [];
    }

    if (normalized.length < 2) {
      return null;
    }

    const [tierSlug, sectionSlug] = normalized;
    const tier = curriculumData.find(module => module.slug === tierSlug);
    if (!tier || tier.sections.length === 0) {
      return null;
    }

    const tierStatuses = curriculumStatus.filter(entry => entry.moduleSlug === tierSlug);

    const sections: OutlineSection[] = tier.sections.map(section => {
      const sectionStatuses = tierStatuses.filter(entry => entry.sectionSlug === section.slug);
      let status: TopicStatus = 'draft';

      if (sectionStatuses.length > 0) {
        if (sectionStatuses.every(entry => entry.status === 'complete')) {
          status = 'complete';
        } else if (sectionStatuses.some(entry => entry.status === 'in-review')) {
          status = 'in-review';
        }
      }

      const targetSlug = normalizeSlug([tier.slug, section.slug]);
      const href = targetSlug.length === 3 ? `/curriculum/${targetSlug.join('/')}` : `/curriculum/${tier.slug}`;

      return {
        id: section.slug,
        title: section.title,
        href,
        status,
        current: section.slug === sectionSlug,
      };
    });

    return {
      title: formatTierTitle(tier.slug, tier.title),
      sections,
    };
  }, [curriculumStatus, pathname]);

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
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1 rounded-md hover:bg-muted"
                aria-label="Close quick access sidebar"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
              {/* Module Outline */}
              {moduleOutline && moduleOutline.sections.length > 0 && (
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
                                    <Link
                                      key={section.id}
                                      href={section.href}
                                      className={`flex items-center justify-between gap-2 rounded-md p-2 text-sm transition-colors ${section.current ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                      <span className="truncate">{section.title}</span>
                                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[section.status]}`}>
                                        {statusLabels[section.status]}
                                      </span>
                                    </Link>
                                ))}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
                </div>
              )}

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
