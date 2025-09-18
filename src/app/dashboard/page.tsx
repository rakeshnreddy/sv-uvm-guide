'use client';

import React from 'react';
import { useCurriculumProgress } from '../../hooks/useCurriculumProgress';
import { curriculumData, getModules } from '@/lib/curriculum-data';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--blueprint-bg)] text-[var(--blueprint-foreground)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(100,255,218,0.25),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,77,255,0.18),_transparent_65%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(10,15,35,0.6),_rgba(5,11,26,0.9))]" />
      </div>

      <main className="relative mx-auto max-w-6xl px-6 py-12">
        <section className="mb-10">
          <div className="glass-card glow-border overflow-hidden">
            <div className="hero-gradient p-8 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.58)]">Curriculum control tower</p>
                  <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Welcome back, verification lead</h1>
                  <p className="mt-3 max-w-2xl text-sm text-[rgba(230,241,255,0.78)]">
                    Your blueprint is on track. Review module trends, surface blocking actions, and tap into the community pulse in one place.
                  </p>
                </div>
                <div className="glass-card px-6 py-5 text-center shadow-none backdrop-blur-2xl">
                  <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.6)]">Overall progress</p>
                  <p className="mt-2 text-4xl font-bold text-[var(--blueprint-foreground)]">{overallProgress}%</p>
                  <Progress value={overallProgress} className="mt-4 h-2 bg-white/10" />
                  <p className="mt-3 text-xs text-[rgba(230,241,255,0.7)]">Keep momentum—two modules away from unlocking Tier 3 mastery.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.3em] text-[rgba(230,241,255,0.7)]">
                Progress pulse
              </CardTitle>
              <Target className="h-5 w-5 text-[var(--blueprint-accent)]" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{overallProgress}%</p>
              <Progress value={overallProgress} className="mt-4 h-2 bg-white/10" />
              <p className="mt-3 text-xs text-[rgba(230,241,255,0.7)]">Regression-ready in 3 days at current velocity.</p>
            </CardContent>
          </Card>

          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.3em] text-[rgba(230,241,255,0.7)]">
                Achievement streak
              </CardTitle>
              <Medal className="h-5 w-5 text-[var(--blueprint-accent-secondary)]" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="glass-card flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2 shadow-none">
                  <Zap className="h-6 w-6 text-[var(--blueprint-accent)]" />
                </div>
                <div>
                  <p className="text-lg font-semibold">5 badges earned</p>
                  <p className="text-xs text-[rgba(230,241,255,0.72)]">Automation ace unlocked yesterday</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.6)]">Next badge</p>
                  <p className="text-sm font-medium">Coverage Strategist</p>
                </div>
                <span className="text-sm font-semibold text-[var(--blueprint-accent)]">3 actions left</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.3em] text-[rgba(230,241,255,0.7)]">
                Community rank
              </CardTitle>
              <Users className="h-5 w-5 text-[var(--blueprint-accent)]" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">#12</p>
              <p className="mt-2 text-xs text-[rgba(230,241,255,0.72)]">Top 10% of learners</p>
              <div className="mt-4 space-y-2 text-xs text-[rgba(230,241,255,0.6)]">
                <div className="flex items-center justify-between">
                  <span>Discussion boosts</span>
                  <span>+4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shared labs</span>
                  <span>+2</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)] lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[var(--blueprint-foreground)]">Module trajectory</CardTitle>
              <CardDescription className="text-[rgba(230,241,255,0.65)]">
                Sequence focus on Tier 2 fundamentals before escalating to expert modules.
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pr-0">
              <div className="space-y-5 px-6 pb-6">
                {modules.map((module) => (
                  <div key={module.name} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <BookOpen className="h-5 w-5 text-[var(--blueprint-accent)]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{module.name}</p>
                        <span className="text-sm text-[rgba(230,241,255,0.7)]">{module.progress}%</span>
                      </div>
                      <Progress value={module.progress} className="mt-2 h-1.5 bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)] lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[var(--blueprint-foreground)]">Recent activity</CardTitle>
              <CardDescription className="text-[rgba(230,241,255,0.65)]">
                Automate follow-up actions from the past 72 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="glass-card flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2 shadow-none">
                      <Activity className="h-5 w-5 text-[var(--blueprint-accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.type}</p>
                      <p className="text-xs text-[rgba(230,241,255,0.72)]">{activity.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <Card className="glass-card border border-white/10 bg-[var(--blueprint-glass)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-[var(--blueprint-foreground)]">Learning prompts</CardTitle>
                <CardDescription className="text-[rgba(230,241,255,0.65)]">
                  Curated next actions to reinforce retention and unlock advanced badges.
                </CardDescription>
              </div>
              <button className="btn-gradient rounded-full px-6 py-2 text-sm font-semibold text-white shadow-lg">
                Generate new plan
              </button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[{
                  icon: <Lightbulb className="h-8 w-8 text-[var(--blueprint-accent)]" />,
                  title: 'Review flashcards',
                  description: 'Revisit Tier 2 coverage flashcards to lock in stimulus heuristics.'
                }, {
                  icon: <BarChart2 className="h-8 w-8 text-[var(--blueprint-accent-secondary)]" />,
                  title: 'Run coding challenge',
                  description: 'Spin up the factory overrides kata and practice scoped overrides.'
                }, {
                  icon: <PieChart className="h-8 w-8 text-[var(--blueprint-accent)]" />,
                  title: 'Dive into expert topics',
                  description: 'Preview Tier 4 debug drills to stay ahead of upcoming labs.'
                }].map((item, index) => (
                  <div
                    key={index}
                    className="glass-card flex h-full flex-col gap-3 border border-white/10 bg-white/10 p-6 text-left shadow-none"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--blueprint-foreground)]">{item.title}</h3>
                    <p className="text-xs text-[rgba(230,241,255,0.7)]">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
