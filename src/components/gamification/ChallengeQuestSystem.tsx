/**
 * @file ChallengeQuestSystem.tsx
 * @description A hub for users to find and engage with a variety of skill-building
 * challenges and quests, from debugging to architecture design.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Bug, Puzzle, Users, Timer, Package, Snail, Layers, Zap, Lightbulb, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---

type ChallengeType =
  | 'Skill-Building'
  | 'Real-World'
  | 'Team'
  | 'Time-Constrained'
  | 'Resource-Optimization'
  | 'Debugging'
  | 'Architecture'
  | 'Performance'
  | 'Innovation';

type ChallengeStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Failed';
type ChallengeDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  icon: React.ReactNode;
  difficulty: ChallengeDifficulty;
  status: ChallengeStatus;
  rewards: { xp: number; badge?: string };
}

// --- MOCK DATA ---

const mockChallenges: Challenge[] = [
  { id: 'c1', title: 'APB Protocol Debug', description: 'Find the bug in the APB slave component that is causing data corruption.', type: 'Debugging', icon: <Bug />, difficulty: 'Medium', status: 'Not Started', rewards: { xp: 500, badge: 'Bug Squasher' } },
  { id: 'c2', title: 'Design a DMA Controller', description: 'Create a high-level architecture for a multi-channel DMA controller.', type: 'Architecture', icon: <Layers />, difficulty: 'Hard', status: 'Not Started', rewards: { xp: 1000, badge: 'Architect' } },
  { id: 'c3', title: 'Optimize FIFO Performance', description: 'Refactor the given FIFO design to improve throughput by 25%.', type: 'Performance', icon: <Zap />, difficulty: 'Hard', status: 'Completed', rewards: { xp: 800 } },
  { id: 'c4', title: 'Team UVM Testbench', description: 'Collaborate with a partner to build a testbench for a complex DUT.', type: 'Team', icon: <Users />, difficulty: 'Expert', status: 'In Progress', rewards: { xp: 1500, badge: 'Team Player' } },
  { id: 'c5', title: 'Timed Coverage Closure', description: 'Reach 95% functional coverage on the given module within 60 minutes.', type: 'Time-Constrained', icon: <Timer />, difficulty: 'Medium', status: 'Not Started', rewards: { xp: 600 } },
  { id: 'c6', title: 'Creative Test Sequence', description: 'Develop an innovative sequence to find a hidden bug in the DUT.', type: 'Innovation', icon: <Lightbulb />, difficulty: 'Expert', status: 'Not Started', rewards: { xp: 1200, badge: 'Innovator' } },
  { id: 'c7', title: 'UVM Phases Quiz', description: 'Answer a series of questions to solidify your understanding of UVM phases.', type: 'Skill-Building', icon: <Puzzle />, difficulty: 'Easy', status: 'Not Started', rewards: { xp: 300 } },
  { id: 'c8', title: 'Automotive I2C Verification', description: 'Verify an I2C controller for an automotive safety system.', type: 'Real-World', icon: <Package />, difficulty: 'Medium', status: 'Not Started', rewards: { xp: 700 } },
  { id: 'c9', title: 'Memory Footprint Challenge', description: 'Reduce memory usage of the verification environment by 20%.', type: 'Resource-Optimization', icon: <Snail />, difficulty: 'Hard', status: 'Not Started', rewards: { xp: 900 } },
];


// --- CHILD COMPONENT: ChallengeCard ---

interface ChallengeCardProps {
  challenge: Challenge;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge }) => {
  const statusColors = {
    'Not Started': 'border-gray-300',
    'In Progress': 'border-blue-500',
    'Completed': 'border-green-500',
    'Failed': 'border-red-500',
  };

  const difficultyColors = {
    'Easy': 'text-green-600',
    'Medium': 'text-yellow-600',
    'Hard': 'text-red-600',
    'Expert': 'text-purple-600',
  };

  return (
    <Card className={cn("w-full", statusColors[challenge.status])}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {challenge.icon}
            <span>{challenge.title}</span>
          </div>
          <span className={cn("text-sm font-bold", difficultyColors[challenge.difficulty])}>
            {challenge.difficulty}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{challenge.description}</p>
        <div className="flex justify-between items-center">
            <div>
                <span className="text-xs font-semibold uppercase">Reward: {challenge.rewards.xp} XP</span>
            </div>
            <Button>{challenge.status === 'In Progress' ? 'Continue' : 'Start Challenge'}</Button>
        </div>
      </CardContent>
    </Card>
  );
};


// --- MAIN COMPONENT: ChallengeQuestSystem ---

interface ChallengeQuestSystemProps {
  userId: string;
}

const ChallengeQuestSystem: React.FC<ChallengeQuestSystemProps> = ({ userId }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filterType, setFilterType] = useState<ChallengeType | 'All'>('All');
  const [filterDifficulty, setFilterDifficulty] = useState<ChallengeDifficulty | 'All'>('All');
  const [suggested, setSuggested] = useState<Challenge[]>([]);

  useEffect(() => {
    // Fetch challenges for the user
    setChallenges(mockChallenges);
  }, [userId]);

  useEffect(() => {
    // Generate personalized challenge suggestions (placeholder logic)
    setSuggested(challenges.filter(c => c.status === 'Not Started').slice(0, 2));
  }, [challenges]);

  const filteredChallenges = challenges.filter(c =>
    (filterType === 'All' || c.type === filterType) &&
    (filterDifficulty === 'All' || c.difficulty === filterDifficulty)
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Swords className="mr-2" /> Challenge & Quest Hub</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Filtering controls could be more sophisticated */}
          <Select onValueChange={(value) => setFilterType(value as any)} defaultValue="All">
            <SelectTrigger><SelectValue placeholder="Filter by Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              {Object.keys(mockChallenges.reduce((acc, c) => ({...acc, [c.type]:1}), {})).map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => setFilterDifficulty(value as any)} defaultValue="All">
            <SelectTrigger><SelectValue placeholder="Filter by Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Difficulties</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
              <SelectItem value="Expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {suggested.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Suggested for You</h3>
            <div className="space-y-4">
              {suggested.map(ch => <ChallengeCard key={ch.id} challenge={ch} />)}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {filteredChallenges.length > 0 ? (
            filteredChallenges.map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} />)
          ) : (
            <p className="text-center text-muted-foreground">No challenges match your filters. Try broadening your search!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChallengeQuestSystem;
