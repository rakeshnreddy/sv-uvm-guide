/**
 * @file RewardRecognitionHub.tsx
 * @description A central hub for users to view, manage, and redeem the rewards and
 * recognition they have earned through their learning journey.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Gift, Badge, Star, Briefcase, Ticket, Key, BookOpen, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---

type RewardType =
  | 'Badge'
  | 'Certificate'
  | 'SkillEndorsement'
  | 'ExpertRecognition'
  | 'IndustryRecognition'
  | 'CareerOpportunity'
  | 'LearningResource'
  | 'EventAccess'
  | 'ToolLicense'
  | 'ProfessionalDevelopment';

interface Reward {
  id: string;
  title: string;
  description: string;
  type: RewardType;
  icon: React.ReactNode;
  isRedeemed: boolean;
  isRedeemable: boolean;
  dateEarned: Date;
}

// --- MOCK DATA ---

const mockRewards: Reward[] = [
  { id: 'r1', title: 'UVM Basics Badge', description: 'Awarded for completing the UVM foundational track.', type: 'Badge', icon: <Badge />, isRedeemed: true, isRedeemable: false, dateEarned: new Date('2024-08-15') },
  { id: 'r2', title: 'Advanced Sequencer Certificate', description: 'Official certificate for mastering advanced UVM sequencing.', type: 'Certificate', icon: <Star />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-08-25') },
  { id: 'r3', title: '30-Day EDA Tool License', description: 'A free 30-day professional license for a leading EDA tool.', type: 'ToolLicense', icon: <Key />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-09-01') },
  { id: 'r4', title: 'Expert Q&A Session Invite', description: 'An exclusive invitation to a live Q&A with an industry expert.', type: 'EventAccess', icon: <Ticket />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-09-05') },
  { id: 'r5', title: 'Interview with Partner Company', description: 'A guaranteed first-round interview for an internship at a partner company.', type: 'CareerOpportunity', icon: <Briefcase />, isRedeemed: true, isRedeemable: false, dateEarned: new Date('2024-09-10') },
  { id: 'r6', title: 'Advanced Assertions E-Book', description: 'Free access to the "SystemVerilog Assertions In-Depth" e-book.', type: 'LearningResource', icon: <BookOpen />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-09-12') },
  { id: 'r7', title: 'UVM Skill Endorsement', description: 'Peers endorsed your UVM debugging skills.', type: 'SkillEndorsement', icon: <Star />, isRedeemed: true, isRedeemable: false, dateEarned: new Date('2024-09-15') },
  { id: 'r8', title: 'Community Expert Badge', description: 'Recognized as a top contributor in expert forums.', type: 'ExpertRecognition', icon: <Award />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-09-18') },
  { id: 'r9', title: 'Industry Partner Shoutout', description: 'Featured by an industry partner for outstanding project work.', type: 'IndustryRecognition', icon: <Briefcase />, isRedeemed: false, isRedeemable: false, dateEarned: new Date('2024-09-20') },
  { id: 'r10', title: 'Professional Workshop Pass', description: 'Access to an advanced verification workshop.', type: 'ProfessionalDevelopment', icon: <BookOpen />, isRedeemed: false, isRedeemable: true, dateEarned: new Date('2024-09-22') },
];

// --- CHILD COMPONENT: RewardCard ---

interface RewardCardProps {
  reward: Reward;
  onRedeem: (id: string) => void;
}

const RewardCard: React.FC<RewardCardProps> = ({ reward, onRedeem }) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">{reward.icon}</div>
        <div>
          <CardTitle>{reward.title}</CardTitle>
          <p className="text-xs text-muted-foreground">Earned: {reward.dateEarned.toLocaleDateString()}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{reward.description}</p>
      </CardContent>
      <div className="p-4 pt-0">
        {reward.isRedeemable && (
          <Button
            className="w-full"
            onClick={() => onRedeem(reward.id)}
            disabled={reward.isRedeemed}
          >
            {reward.isRedeemed ? 'Redeemed' : 'Redeem Now'}
          </Button>
        )}
        {!reward.isRedeemable && (
            <Button className="w-full" variant="secondary" disabled>View</Button>
        )}
      </div>
    </Card>
  );
};


// --- MAIN COMPONENT: RewardRecognitionHub ---

interface RewardRecognitionHubProps {
  userId: string;
}

const RewardRecognitionHub: React.FC<RewardRecognitionHubProps> = ({ userId }) => {
  const [rewards, setRewards] = useState<Reward[]>(mockRewards);

  const handleRedeem = (rewardId: string) => {
    setRewards(prevRewards =>
      prevRewards.map(reward =>
        reward.id === rewardId ? { ...reward, isRedeemed: true } : reward
      )
    );
    // In a real app, this would also trigger an API call.
    console.log(`User ${userId} redeemed reward ${rewardId}`);
  };

  const myBadges = rewards.filter(r => ['Badge', 'Certificate', 'SkillEndorsement', 'ExpertRecognition'].includes(r.type));
  const redeemableRewards = rewards.filter(r => r.isRedeemable && !myBadges.includes(r));
  const careerOpportunities = rewards.filter(r => ['CareerOpportunity', 'IndustryRecognition', 'ProfessionalDevelopment'].includes(r.type));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Gift className="mr-2" /> Reward & Recognition Hub</CardTitle>
        <p className="text-sm text-muted-foreground">Your collection of earned badges, certificates, and opportunities.</p>
      </CardHeader>
      <CardContent className="space-y-8">

        {/* Section 1: My Badges & Certificates */}
        <div>
          <h3 className="text-xl font-semibold mb-4">My Badges & Certificates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBadges.map(reward => (
              <RewardCard key={reward.id} reward={reward} onRedeem={handleRedeem} />
            ))}
          </div>
        </div>

        {/* Section 2: Redeemable Rewards */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Redeemable Rewards</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {redeemableRewards.filter(r => !myBadges.includes(r)).map(reward => (
              <RewardCard key={reward.id} reward={reward} onRedeem={handleRedeem} />
            ))}
          </div>
        </div>

        {/* Section 3: Career & Industry Recognition */}
         <div>
          <h3 className="text-xl font-semibold mb-4">Career & Industry</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {careerOpportunities.map(reward => (
              <RewardCard key={reward.id} reward={reward} onRedeem={handleRedeem} />
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default RewardRecognitionHub;
