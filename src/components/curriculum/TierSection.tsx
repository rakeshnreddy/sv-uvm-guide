import React from 'react';
import { Tier } from '@/lib/curriculum-data';
import { ModuleCard } from './ModuleCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TierSectionProps {
  tier: Tier;
  tierProgress: number;
  isTierUnlocked: boolean;
  getModuleProgress: (moduleId: string) => number;
  isModuleLocked: (moduleId: string) => boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const TierProgressBar: React.FC<{ progress: number; color: string }> = ({ progress, color }) => (
    <div className="w-full bg-muted rounded-full h-2.5">
        <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: color }}
        ></div>
    </div>
);


export const TierSection: React.FC<TierSectionProps> = ({
  tier,
  tierProgress,
  isTierUnlocked,
  getModuleProgress,
  isModuleLocked,
  isOpen,
  onToggle,
}) => {

  return (
    <div className={cn("relative mb-4 border rounded-lg overflow-hidden", !isTierUnlocked && "opacity-60 cursor-not-allowed", isOpen && "shadow-lg")}>
        <button onClick={onToggle} disabled={!isTierUnlocked} className="w-full p-6 text-left hover:bg-muted/50 transition-colors">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl md:text-3xl font-bold font-sans" style={{ color: tier.color }}>
                    {tier.title}
                </h2>
                <div className="flex items-center gap-4">
                  {!isTierUnlocked && <Lock className="w-6 h-6 text-muted-foreground" />}
                  <ChevronDown className={cn("w-6 h-6 transition-transform", isOpen && "rotate-180")} />
                </div>
            </div>
            <p className="text-md text-muted-foreground mt-1 mb-4 max-w-4xl">
                {tier.description}
            </p>
            <TierProgressBar progress={tierProgress} color={tier.color} />
        </button>
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.section
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                        open: { opacity: 1, height: "auto" },
                        collapsed: { opacity: 0, height: 0 }
                    }}
                    transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                >
                    <div className="p-6 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {tier.modules.map(module => (
                          <ModuleCard
                            key={module.id}
                            module={module}
                            tier={tier}
                            progress={getModuleProgress(module.id)}
                            isLocked={isModuleLocked(module.id)}
                          />
                        ))}
                      </div>
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    </div>
  );
};
