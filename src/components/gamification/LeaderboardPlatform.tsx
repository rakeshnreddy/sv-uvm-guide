/**
 * @file LeaderboardPlatform.tsx
 * @description A component to display multi-dimensional leaderboards, fostering healthy
 * competition and motivation among learners.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Trophy, Zap, Target, Award, Users, Mic, Briefcase, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string; // Optional avatar
  score: number;
  scoreUnit: string; // e.g., 'XP', 'Challenges', 'Days'
}

type LeaderboardType =
  | 'Skill'
  | 'ProgressSpeed'
  | 'Challenge'
  | 'Achievement'
  | 'Collaboration'
  | 'Expertise'
  | 'IndustryPrep'
  | 'Innovation';

interface LeaderboardInfo {
    id: LeaderboardType;
    title: string;
    icon: React.ReactNode;
    description: string;
}

// --- MOCK DATA & CONFIG ---

const leaderboards: Record<LeaderboardType, LeaderboardInfo> = {
    Skill: { id: 'Skill', title: 'Skill Competency', icon: <Trophy />, description: "Top users by total XP earned." },
    ProgressSpeed: { id: 'ProgressSpeed', title: 'Progress Speed', icon: <Zap />, description: "Fastest to complete the core curriculum." },
    Challenge: { id: 'Challenge', title: 'Challenge Masters', icon: <Target />, description: "Most unique challenges completed." },
    Achievement: { id: 'Achievement', title: 'Achievement Hunters', icon: <Award />, description: "Highest count of rare achievements." },
    Collaboration: { id: 'Collaboration', title: 'Top Collaborators', icon: <Users />, description: "Most contributions to group projects." },
    Expertise: { id: 'Expertise', title: 'Expert Recognition', icon: <Mic />, description: "Most 'expert' answers in forums." },
    IndustryPrep: { id: 'IndustryPrep', title: 'Industry Ready', icon: <Briefcase />, description: "Highest score on industry-standard simulations." },
    Innovation: { id: 'Innovation', title: 'Creative Minds', icon: <Lightbulb />, description: "Top-voted creative solutions." },
};

const mockLeaderboardData: Record<LeaderboardType, LeaderboardEntry[]> = {
  Skill: [
    { rank: 1, userId: 'user2', username: 'VerilogViper', score: 15000, scoreUnit: 'XP' },
    { rank: 2, userId: 'user3', username: 'UVM_Master', score: 14500, scoreUnit: 'XP' },
    { rank: 3, userId: 'user1', username: 'You', score: 12000, scoreUnit: 'XP' },
  ],
  ProgressSpeed: [
    { rank: 1, userId: 'user4', username: 'SpeedySV', score: 25, scoreUnit: 'Days' },
    { rank: 2, userId: 'user2', username: 'VerilogViper', score: 30, scoreUnit: 'Days' },
    { rank: 3, userId: 'user5', username: 'QuickChip', score: 32, scoreUnit: 'Days' },
  ],
  Challenge: [
    { rank: 1, userId: 'user3', username: 'UVM_Master', score: 25, scoreUnit: 'Challenges' },
    { rank: 2, userId: 'user1', username: 'You', score: 22, scoreUnit: 'Challenges' },
    { rank: 3, userId: 'user2', username: 'VerilogViper', score: 20, scoreUnit: 'Challenges' },
  ],
  // Add mock data for other leaderboards as needed...
  Achievement: [],
  Collaboration: [],
  Expertise: [],
  IndustryPrep: [],
  Innovation: [],
};


// --- CHILD COMPONENT: LeaderboardList ---

interface LeaderboardListProps {
    entries: LeaderboardEntry[];
    currentUserId: string;
}

const LeaderboardList: React.FC<LeaderboardListProps> = ({ entries, currentUserId }) => {
    if (entries.length === 0) {
        return <p className="text-center text-muted-foreground">No rankings yet. Be the first!</p>;
    }

    return (
        <ul className="space-y-2">
            {entries.map(entry => (
                <li key={entry.userId} className={cn(
                    "flex items-center p-3 rounded-lg",
                    entry.userId === currentUserId ? "bg-primary/20 border border-primary" : "bg-secondary"
                )}>
                    <span className="text-lg font-bold w-8 text-center">{entry.rank}</span>
                    <div className="flex-grow mx-4">
                        <p className="font-semibold">{entry.username}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-primary">{entry.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{entry.scoreUnit}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
};


// --- MAIN COMPONENT: LeaderboardPlatform ---

interface LeaderboardPlatformProps {
  currentUserId: string;
}

const LeaderboardPlatform: React.FC<LeaderboardPlatformProps> = ({ currentUserId }) => {
  const [activeBoard, setActiveBoard] = useState<LeaderboardType>('Skill');
  const [boardData, setBoardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Simulate API call to fetch leaderboard data
    // const response = await fetch(`/api/leaderboards/${activeBoard}`);
    // const data = await response.json();
    setBoardData(mockLeaderboardData[activeBoard]);
    setIsLoading(false);
  }, [activeBoard]);

  const activeLeaderboardInfo = leaderboards[activeBoard];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
            {activeLeaderboardInfo.icon}
            <span className="ml-2">{activeLeaderboardInfo.title}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{activeLeaderboardInfo.description}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.values(leaderboards).map(board => (
            <button
              key={board.id}
              onClick={() => setActiveBoard(board.id)}
              className={cn(
                "px-3 py-1 text-sm rounded-full border flex items-center gap-1",
                activeBoard === board.id ? "bg-primary text-primary-foreground" : "bg-transparent"
              )}
            >
              {board.icon} {board.title}
            </button>
          ))}
        </div>

        {isLoading ? (
            <p>Loading leaderboard...</p>
        ) : (
            <LeaderboardList entries={boardData} currentUserId={currentUserId} />
        )}
      </CardContent>
    </Card>
  );
};

export default LeaderboardPlatform;
