"use client";

import Link from "next/link";
import { getBreadcrumbs, curriculumData } from "@/lib/curriculum-data";
import { ChevronRight, ChevronsUpDown, CheckCircle, Circle, Clock } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BreadcrumbsProps = {
  slug: string[];
};

// Mock progress data - in a real app, this would come from a context or API
const progressData: { [key: string]: 'completed' | 'in_progress' } = {
    '/curriculum/T1_Foundational': 'completed',
    '/curriculum/T1_Foundational/F1_Why_Verification': 'completed',
    '/curriculum/T1_Foundational/F2_SystemVerilog_Primer': 'completed',
    '/curriculum/T1_Foundational/F2_Data_Types': 'in_progress',
};

export default function Breadcrumbs({ slug }: BreadcrumbsProps) {
  const breadcrumbs = getBreadcrumbs(slug);
  const [isJumpToOpen, setJumpToOpen] = useState(false);

  if (breadcrumbs.length <= 1) { // Hide if only on main curriculum page
    return null;
  }

  const currentModule = curriculumData.find(m => m.slug === slug[0]);
  const currentSection = currentModule?.sections.find(s => s.slug === slug[1]);

  const timeToComplete = currentSection ? currentSection.topics.length * 5 : 0; // 5 mins per topic

  return (
    <div className="bg-muted/20 border-b border-border/40 mb-8 -mt-8 print:hidden">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-muted-foreground h-14">
            <div className="flex items-center overflow-x-auto whitespace-nowrap py-4">
                {breadcrumbs.map((breadcrumb, index) => {
                    const status = progressData[breadcrumb.path];
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                        <div key={breadcrumb.path} className="flex items-center">
                        {index > 0 && <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />}
                        <Link
                            href={breadcrumb.path}
                            className={`flex items-center gap-1.5 hover:text-foreground transition-colors ${
                            isLast ? "text-foreground font-semibold" : ""
                            }`}
                        >
                            {status === 'completed' ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : (isLast ? <Circle className="h-4 w-4 text-primary flex-shrink-0" /> : <Circle className="h-4 w-4 flex-shrink-0" />)}
                            <span className="truncate">{breadcrumb.title}</span>
                        </Link>
                        </div>
                    )
                })}
            </div>
            <div className="hidden sm:flex items-center gap-4 ml-4">
                {currentSection && (
                    <div className="hidden lg:flex items-center gap-2 text-xs">
                        <Clock className="h-4 w-4" />
                        <span>Est. {timeToComplete} mins left</span>
                    </div>
                )}
                {currentSection && (
                    <div className="relative">
                        <button onClick={() => setJumpToOpen(!isJumpToOpen)} className="flex items-center gap-1 text-xs font-semibold p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border/40">
                            Jump to
                            <ChevronsUpDown className="w-3 h-3" />
                        </button>
                         <AnimatePresence>
                            {isJumpToOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full right-0 mt-2 w-72 bg-background border border-border/40 rounded-md shadow-lg z-10"
                                    onMouseLeave={() => setJumpToOpen(false)}
                                >
                                    <div className="p-2 font-semibold border-b border-border/40 text-sm">Topics in {currentSection.title}</div>
                                    <div className="p-2 max-h-60 overflow-y-auto">
                                        {currentSection.topics.map(topic => (
                                            <Link
                                                key={topic.slug}
                                                href={`/curriculum/${currentModule?.slug}/${currentSection?.slug}/${topic.slug}`}
                                                onClick={() => setJumpToOpen(false)}
                                                className={`block w-full text-left p-2 text-sm rounded-md hover:bg-muted ${slug[2] === topic.slug ? 'bg-muted font-semibold' : ''}`}
                                            >
                                                {topic.title}
                                            </Link>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </nav>
    </div>
  );
}
