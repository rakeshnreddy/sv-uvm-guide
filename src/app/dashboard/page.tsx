'use client';

import React from 'react';
import { useCurriculumProgress } from '../../hooks/useCurriculumProgress';
import { curriculumData, getModules } from '@/lib/curriculum-data';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Medal, BookOpen, Target, TrendingUp, Users, Zap, Lightbulb, BarChart2, PieChart, Activity } from 'lucide-react';

const DashboardPage = () => {
  const overallProgress = 65;
  const modules = [
    { name: 'Foundational', progress: 80 },
    { name: 'Intermediate', progress: 50 },
    { name: 'Advanced', progress: 70 },
    { name: 'Expert', progress: 60 },
  ];
  const recentActivities = [
    { type: 'Completed', description: 'Finished the "UVM Sequences" module.' },
    { type: 'Started', description: 'Began the "Scoreboards and Coverage" section.' },
    { type: 'Practiced', description: 'Completed 3 practice exercises.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallProgress}%</div>
              <Progress value={overallProgress} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Achievements</CardTitle>
              <Medal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Zap className="h-6 w-6 text-yellow-500 mr-2" />
                <span className="text-lg font-semibold">5 Badges Earned</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Keep up the great work!</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Community Rank</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">#12</div>
              <p className="text-xs text-muted-foreground">Top 10% of learners</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Module Progress</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="space-y-4">
                  {modules.map((module) => (
                    <div key={module.name} className="flex items-center">
                      <BookOpen className="h-5 w-5 mr-3 text-blue-500" />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium">{module.name}</p>
                          <span className="text-sm font-medium text-muted-foreground">{module.progress}%</span>
                        </div>
                        <Progress value={module.progress} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start">
                      <Activity className="h-5 w-5 mt-1 mr-3 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">{activity.type}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Learning Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <Card>
                            <CardContent className="p-4">
                                <Lightbulb className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                                <h3 className="font-semibold">Review Flashcards</h3>
                                <p className="text-xs text-muted-foreground">Strengthen your foundations.</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <BarChart2 className="h-8 w-8 mx-auto text-red-500 mb-2" />
                                <h3 className="font-semibold">New Coding Challenge</h3>
                                <p className="text-xs text-muted-foreground">Apply your skills practically.</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <PieChart className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                                <h3 className="font-semibold">Explore Advanced Topics</h3>
                                <p className="text-xs text-muted-foreground">Expand your knowledge.</p>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;