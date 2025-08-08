/**
 * @file AchievementSystem.tsx
 * @description Component to display and manage user achievements, motivating users by
 * recognizing their accomplishments across various categories.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'; // Assuming Tabs component exists or can be created
import { Progress } from '@/components/ui/Progress';
import { Award, Lock, Star, Users, BrainCircuit, Briefcase, Lightbulb, GitMerge, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming a utility for classnames

// --- TYPE DEFINITIONS ---

type AchievementCategory =
  | 'Skill'          // Skill-based
  | 'Progress'       // Progress-based
  | 'Challenge'      // Challenge-based
  | 'Social'         // Social achievements
  | 'Expert'         // Expert-level
  | 'Industry'       // Industry-relevant
  | 'Creative'       // Creative problem-solving
  | 'Collaboration'  // Collaboration achievements
  | 'Mentoring';     // Teaching and mentoring

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: React.ReactNode;
  unlocked: boolean;
  unlockDate?: Date;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  progress?: number; // Progress percentage for locked achievements
}

// --- MOCK DATA ---

const mockAchievements: Achievement[] = [
  // Unlocked Achievements
  { id: 'sv_basics', name: 'SystemVerilog Novice', description: 'Complete the foundational SystemVerilog module.', category: 'Skill', icon: <Star />, unlocked: true, unlockDate: new Date('2024-08-10'), rarity: 'Common' },
  { id: 'first_tb', name: 'Testbench Architect', description: 'Build your first complete UVM testbench.', category: 'Progress', icon: <Award />, unlocked: true, unlockDate: new Date('2024-08-15'), rarity: 'Uncommon' },
  { id: 'debug_challenge', name: 'Bug Squasher', description: 'Successfully debug a complex testbench scenario.', category: 'Challenge', icon: <BrainCircuit />, unlocked: true, unlockDate: new Date('2024-08-20'), rarity: 'Rare' },
  { id: 'forum_helper', name: 'Community Helper', description: 'Your forum post was marked as the solution.', category: 'Social', icon: <Users />, unlocked: true, unlockDate: new Date('2024-08-18'), rarity: 'Uncommon' },

  // Locked Achievements
  { id: 'ral_expert', name: 'RAL Guru', description: 'Master the UVM Register Abstraction Layer.', category: 'Expert', icon: <GraduationCap />, unlocked: false, rarity: 'Epic' },
  { id: 'vip_integration', name: 'VIP Integrator', description: 'Integrate a third-party VIP into a project.', category: 'Industry', icon: <Briefcase />, unlocked: false, rarity: 'Epic', progress: 40 },
  { id: 'creative_solution', name: 'Creative Coder', description: 'Solve a challenge with a non-obvious, elegant solution.', category: 'Creative', icon: <Lightbulb />, unlocked: false, rarity: 'Rare', progress: 20 },
  { id: 'pair_programming', name: 'Dynamic Duo', description: 'Complete a collaborative project with a partner.', category: 'Collaboration', icon: <GitMerge />, unlocked: false, rarity: 'Uncommon', progress: 60 },
  { id: 'mentor_badge', name: 'Guiding Light', description: 'Successfully mentor a peer through a difficult concept.', category: 'Mentoring', icon: <Users />, unlocked: false, rarity: 'Legendary', progress: 10 },
];

// --- CHILD COMPONENT: AchievementCard ---

interface AchievementCardProps {
  achievement: Achievement;
}

const AchievementCard: React.FC<AchievementCardProps> = ({ achievement }) => {
  const cardClasses = cn(
    "flex items-center space-x-4 p-4 rounded-lg border",
    achievement.unlocked ? "bg-secondary/50 border-primary/20" : "bg-muted/50"
  );

  const iconClasses = cn(
    "w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full",
    achievement.unlocked ? `bg-primary/20 text-primary` : "bg-gray-300 text-gray-500"
  );

  return (
    <div className={cardClasses}>
      <div className={iconClasses}>
        {achievement.unlocked ? achievement.icon : <Lock />}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-lg">{achievement.name}</h4>
        <p className="text-sm text-muted-foreground">{achievement.description}</p>
        {achievement.unlocked && achievement.unlockDate && (
          <p className="text-xs text-green-500 mt-1">
            Unlocked on: {achievement.unlockDate.toLocaleDateString()}
          </p>
        )}
        {!achievement.unlocked && typeof achievement.progress === 'number' && (
          <div className="mt-2">
            <Progress value={achievement.progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{achievement.progress}% complete</p>
          </div>
        )}
      </div>
       <div className="ml-auto text-right flex-shrink-0">
         <span className={`text-sm font-semibold text-${achievement.unlocked ? 'yellow' : 'gray'}-500`}>{achievement.rarity}</span>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT: AchievementSystem ---

interface AchievementSystemProps {
  userId: string;
}

const AchievementSystem: React.FC<AchievementSystemProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filter, setFilter] = useState<AchievementCategory | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user's achievement status from a backend
    setIsLoading(true);
    // In a real app: const response = await fetch(`/api/users/${userId}/achievements`);
    // const data = await response.json();
    // setAchievements(data);
    setAchievements(mockAchievements);
    setIsLoading(false);
  }, [userId]);

  const filteredAchievements = achievements.filter(
    ach => filter === 'All' || ach.category === filter
  );

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return <Card><CardContent><p>Loading Achievements...</p></CardContent></Card>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Award className="mr-2" /> Your Achievements</CardTitle>
        <div className="mt-2">
            <p className="text-sm text-muted-foreground">{unlockedCount} of {totalCount} unlocked</p>
            <Progress value={completionPercentage} className="w-full mt-1" />
        </div>
      </CardHeader>
      <CardContent>
        {/* For simplicity, I'm implementing a simple filter with buttons. A Tabs component would be ideal. */}
        <div className="flex flex-wrap gap-2 mb-4">
            {(['All', 'Skill', 'Progress', 'Challenge', 'Social', 'Expert', 'Industry', 'Creative', 'Collaboration', 'Mentoring'] as const).map(cat => (
                <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={cn("px-3 py-1 text-sm rounded-full border", filter === cat ? "bg-primary text-primary-foreground" : "bg-transparent")}
                >
                    {cat}
                </button>
            ))}
        </div>

        <div className="space-y-4">
          {filteredAchievements.length > 0 ? (
            filteredAchievements.map(ach => <AchievementCard key={ach.id} achievement={ach} />)
          ) : (
            <p>No achievements in this category yet. Keep learning!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AchievementSystem;
