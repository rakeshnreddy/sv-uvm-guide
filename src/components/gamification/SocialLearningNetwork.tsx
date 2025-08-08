/**
 * @file SocialLearningNetwork.tsx
 * @description A component that fosters a collaborative learning environment by providing
 * access to study groups, forums, collaborative projects, and mentoring.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Users, MessageSquare, Briefcase, GraduationCap, PlusCircle, HelpCircle, Code, BookOpen, Share2 } from 'lucide-react';
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

interface Mentor {
  id: string;
  name: string;
  expertise: string;
  availability: string;
}

interface QAEvent {
  id: string;
  topic: string;
  expert: string;
  schedule: string;
}

interface CodeReview {
  id: string;
  title: string;
  author: string;
  reviews: number;
}

interface BestPractice {
  id: string;
  title: string;
  summary: string;
}

interface NetworkingEvent {
  id: string;
  title: string;
  date: string;
}

interface CareerCommunity {
  id: string;
  title: string;
  focus: string;
  members: number;
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

const mockMentors: Mentor[] = [
  { id: 'm1', name: 'Alice', expertise: 'UVM Architecture', availability: 'Evenings' },
  { id: 'm2', name: 'Bob', expertise: 'SystemVerilog Assertions', availability: 'Weekends' },
];

const mockQAEvents: QAEvent[] = [
  { id: 'qa1', topic: 'Coverage Closure Strategies', expert: 'Dr. Verification', schedule: 'Sept 20' },
  { id: 'qa2', topic: 'Career in Verification', expert: 'Industry Lead', schedule: 'Oct 5' },
];

const mockCodeReviews: CodeReview[] = [
  { id: 'cr1', title: 'AXI Monitor Implementation', author: 'VerilogViper', reviews: 3 },
  { id: 'cr2', title: 'UVM Sequencer Refactor', author: 'UVM_Master', reviews: 5 },
];

const mockBestPractices: BestPractice[] = [
  { id: 'bp1', title: 'Reusable Sequence Design', summary: 'Guidelines for crafting sequences that scale across projects.' },
  { id: 'bp2', title: 'Effective Code Reviews', summary: 'Checklist to ensure high-quality review feedback.' },
];

const mockNetworkingEvents: NetworkingEvent[] = [
  { id: 'ne1', title: 'Verification Summit Mixer', date: 'Nov 1' },
  { id: 'ne2', title: 'UVM Online Meetup', date: 'Dec 12' },
];

const mockCareerCommunities: CareerCommunity[] = [
  { id: 'cc1', title: 'Internship Hunters', focus: 'Finding entry-level roles', members: 120 },
  { id: 'cc2', title: 'Verification Leaders', focus: 'Growing into leadership', members: 60 },
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
          <TabsList className="flex flex-wrap w-full">
            <TabsTrigger value="groups"><Users className="mr-1 h-4 w-4"/>Study Groups</TabsTrigger>
            <TabsTrigger value="forums"><MessageSquare className="mr-1 h-4 w-4"/>Forums</TabsTrigger>
            <TabsTrigger value="projects"><Briefcase className="mr-1 h-4 w-4"/>Projects</TabsTrigger>
            <TabsTrigger value="mentoring"><GraduationCap className="mr-1 h-4 w-4"/>Mentoring</TabsTrigger>
            <TabsTrigger value="qa"><HelpCircle className="mr-1 h-4 w-4"/>Expert Q&A</TabsTrigger>
            <TabsTrigger value="code"><Code className="mr-1 h-4 w-4"/>Code Review</TabsTrigger>
            <TabsTrigger value="best"><BookOpen className="mr-1 h-4 w-4"/>Best Practices</TabsTrigger>
            <TabsTrigger value="network"><Share2 className="mr-1 h-4 w-4"/>Networking</TabsTrigger>
            <TabsTrigger value="career"><Briefcase className="mr-1 h-4 w-4"/>Career</TabsTrigger>
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

          <TabsContent value="mentoring" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Peer Mentoring</h3>
            <div className="space-y-4">
              {mockMentors.map(m => (
                <Card key={m.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">{m.name}</h4>
                    <p className="text-sm text-muted-foreground">{m.expertise}</p>
                  </div>
                  <p className="text-xs">Availability: {m.availability}</p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Upcoming Expert Q&A</h3>
            <div className="space-y-4">
              {mockQAEvents.map(ev => (
                <Card key={ev.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">{ev.topic}</h4>
                    <p className="text-sm text-muted-foreground">with {ev.expert}</p>
                  </div>
                  <span className="text-xs">{ev.schedule}</span>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Code Review Communities</h3>
            <div className="space-y-4">
              {mockCodeReviews.map(cr => (
                <Card key={cr.id} className="p-4">
                  <h4 className="font-bold">{cr.title}</h4>
                  <p className="text-sm text-muted-foreground">by {cr.author} • {cr.reviews} reviews</p>
                  <Button size="sm" className="mt-2">View Thread</Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="best" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Best Practice Sharing</h3>
            <div className="space-y-4">
              {mockBestPractices.map(bp => (
                <Card key={bp.id} className="p-4">
                  <h4 className="font-bold">{bp.title}</h4>
                  <p className="text-sm text-muted-foreground">{bp.summary}</p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="network" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Industry Networking</h3>
            <div className="space-y-4">
              {mockNetworkingEvents.map(ne => (
                <Card key={ne.id} className="p-4 flex justify-between items-center">
                  <h4 className="font-bold">{ne.title}</h4>
                  <span className="text-sm">{ne.date}</span>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="career" className="mt-4">
            <h3 className="text-lg font-semibold mb-4">Career Development Communities</h3>
            <div className="space-y-4">
              {mockCareerCommunities.map(cc => (
                <Card key={cc.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">{cc.title}</h4>
                    <p className="text-sm text-muted-foreground">{cc.focus}</p>
                  </div>
                  <p className="text-xs">{cc.members} members</p>
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
