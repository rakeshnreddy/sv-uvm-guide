/**
 * @file SocialLearningNetwork.tsx
 * @description A component that fosters a collaborative learning environment by providing
 * access to study groups, forums, collaborative projects, and mentoring.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Users, MessageSquare, Briefcase, GraduationCap, Search, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Assuming an Avatar component exists

// --- TYPE DEFINITIONS ---

interface StudyGroup {
  id: string;
  name: string;
  topic: string;
  members: number;
  maxMembers: number;
  isMember: boolean;
}

interface ForumPost {
  id: string;
  title: string;
  author: string;
  authorAvatar?: string;
  replies: number;
  lastActivity: string;
}

interface CollaborativeProject {
  id: string;
  name: string;
  status: 'Recruiting' | 'In Progress' | 'Completed';
  participants: number;
  lookingFor: string[]; // e.g., ['RTL Designer', 'Verification Engineer']
}

// --- MOCK DATA ---

const mockStudyGroups: StudyGroup[] = [
  { id: 'sg1', name: 'UVM Sequencer Deep Dive', topic: 'Advanced UVM', members: 4, maxMembers: 8, isMember: true },
  { id: 'sg2', name: 'SystemVerilog Assertions Practice', topic: 'SVA', members: 7, maxMembers: 10, isMember: false },
  { id: 'sg3', name: 'SoC Verification Strategies', topic: 'Expert', members: 3, maxMembers: 5, isMember: false },
];

const mockForumPosts: ForumPost[] = [
    { id: 'fp1', title: 'How to handle multi-reset scenarios in a testbench?', author: 'NewbieNico', replies: 12, lastActivity: '2 hours ago' },
    { id: 'fp2', title: 'Best practices for UVM RAL model customization', author: 'RAL_Guru', replies: 5, lastActivity: '1 day ago' },
    { id: 'fp3', title: 'Showcase: My reusable coverage model for AXI', author: 'CoverageKing', replies: 8, lastActivity: '3 days ago' },
];

const mockProjects: CollaborativeProject[] = [
    { id: 'cp1', name: 'Open Source UART VIP', status: 'Recruiting', participants: 2, lookingFor: ['Verification Engineer'] },
    { id: 'cp2', name: 'RISC-V Core Verification', status: 'In Progress', participants: 5, lookingFor: [] },
];

// --- CHILD COMPONENTS ---

const StudyGroupCard: React.FC<{ group: StudyGroup }> = ({ group }) => (
    <Card className="p-4 flex justify-between items-center">
        <div>
            <h4 className="font-bold">{group.name}</h4>
            <p className="text-sm text-muted-foreground">{group.topic}</p>
        </div>
        <div className="text-right">
            <p>{group.members}/{group.maxMembers} members</p>
            <Button size="sm" className="mt-2" disabled={group.isMember}>{group.isMember ? 'Joined' : 'Join'}</Button>
        </div>
    </Card>
);

const ForumPostSnippet: React.FC<{ post: ForumPost }> = ({ post }) => (
    <div className="p-3 flex items-center border-b last:border-b-0">
        <Avatar className="h-9 w-9 mr-3">
            <AvatarImage src={post.authorAvatar} alt={post.author} />
            <AvatarFallback>{post.author.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-grow">
            <p className="font-semibold">{post.title}</p>
            <p className="text-xs text-muted-foreground">by {post.author} • {post.lastActivity}</p>
        </div>
        <div className="text-center w-20">
            <p className="font-bold">{post.replies}</p>
            <p className="text-xs text-muted-foreground">Replies</p>
        </div>
    </div>
);

// --- MAIN COMPONENT ---

const SocialLearningNetwork: React.FC<{ userId: string }> = ({ userId }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Users className="mr-2" /> Social Learning Network</CardTitle>
        <p className="text-sm text-muted-foreground">Connect, collaborate, and learn with the community.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="groups">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="groups"><Users className="mr-1 h-4 w-4"/>Study Groups</TabsTrigger>
            <TabsTrigger value="forums"><MessageSquare className="mr-1 h-4 w-4"/>Forums</TabsTrigger>
            <TabsTrigger value="projects"><Briefcase className="mr-1 h-4 w-4"/>Projects</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Find a Study Group</h3>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Create Group</Button>
            </div>
            <div className="space-y-4">
                {mockStudyGroups.map(group => <StudyGroupCard key={group.id} group={group} />)}
            </div>
          </TabsContent>

          <TabsContent value="forums" className="mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Latest Forum Topics</h3>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> New Post</Button>
            </div>
            <div className="border rounded-lg">
                {mockForumPosts.map(post => <ForumPostSnippet key={post.id} post={post} />)}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Collaborative Projects</h3>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Start Project</Button>
            </div>
            <div className="space-y-4">
                {mockProjects.map(project => (
                    <Card key={project.id} className="p-4">
                        <h4 className="font-bold">{project.name}</h4>
                        <p className="text-sm text-muted-foreground">Status: {project.status}</p>
                        {project.lookingFor.length > 0 && <p className="text-sm">Seeking: {project.lookingFor.join(', ')}</p>}
                        <Button size="sm" className="mt-2">View Details</Button>
                    </Card>
                ))}
            </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SocialLearningNetwork;
