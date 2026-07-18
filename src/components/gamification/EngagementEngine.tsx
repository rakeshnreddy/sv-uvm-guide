"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { TrendingUp, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import type {
  EngagementGoal,
  EngagementMotivationalProfile,
  EngagementResponse,
} from "@/lib/engagement";
import { cn } from "@/lib/utils";

const EngagementActivityChart = dynamic(
  () => import("./EngagementActivityChart").then((module) => module.EngagementActivityChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-52 w-full animate-pulse rounded-lg bg-muted" aria-busy="true" />
    ),
  },
);

interface Strategy {
  id: string;
  title: string;
  description: string;
  href: string;
}

const EMPTY_CHART = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
  (name) => ({ name, activity: 0 }),
);

export default function EngagementEngine() {
  const [engagement, setEngagement] = useState<EngagementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTarget, setGoalTarget] = useState("5");
  const [goalUnit, setGoalUnit] = useState("lessons");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/me/engagement", { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load engagement data");
        setEngagement(payload as EngagementResponse);
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError("Unable to load your engagement dashboard. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const metrics = engagement?.metrics;
  const profile = engagement?.motivationalProfile;
  const goals = engagement?.goals ?? [];
  const recommendedDifficulty = !metrics
    ? "Medium"
    : metrics.dailyStreak >= 7 && metrics.challengesAttempted > 10
      ? "Hard"
      : metrics.lessonsCompleted < 5
        ? "Easy"
        : "Medium";

  const strategies = useMemo<Strategy[]>(() => {
    if (!engagement) return [];
    const items: Strategy[] = [];
    if (engagement.metrics.dailyStreak > 3) {
      items.push({
        id: "streak-master",
        title: `You’re on a ${engagement.metrics.dailyStreak}-day streak`,
        description: "Complete one focused lesson today to keep the streak moving.",
        href: "/curriculum",
      });
    }
    if (engagement.patterns.learningStyle === "steady-progress") {
      items.push({
        id: "steady-learner",
        title: "Raise the challenge",
        description: "Your consistency supports a slightly harder practice problem this week.",
        href: "/practice",
      });
    }
    if (engagement.metrics.timeSpentMinutes < 30) {
      items.push({
        id: "quick-boost",
        title: "Take a quick practice session",
        description: "A short lab or flashcard review can restart momentum.",
        href: "/practice",
      });
    }
    return items;
  }, [engagement]);

  const addGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = Number(goalTarget);
    if (!goalDescription.trim() || !Number.isInteger(target) || target <= 0) {
      setError("Enter a goal description and a positive whole-number target.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/me/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: goalDescription.trim(),
          target,
          unit: goalUnit.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save goal");
      const goal: EngagementGoal = {
        id: payload.goal.id,
        description: payload.goal.description,
        target: payload.goal.target,
        progress: payload.goal.progress,
        unit: payload.goal.unit,
      };
      setEngagement((current) =>
        current ? { ...current, goals: [...current.goals, goal] } : current,
      );
      setGoalDescription("");
      setShowGoalForm(false);
    } catch {
      setError("Unable to save the goal. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateRewardPreference = async (
    rewardPreference: EngagementMotivationalProfile["rewardPreference"],
  ) => {
    const nextProfile: EngagementMotivationalProfile = {
      style: profile?.style ?? "goal-oriented",
      rewardPreference,
    };
    setError(null);
    try {
      const response = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivationalProfile: nextProfile }),
      });
      if (!response.ok) throw new Error("Unable to save reward preference");
      setEngagement((current) =>
        current ? { ...current, motivationalProfile: nextProfile } : current,
      );
    } catch {
      setError("Unable to save your reward preference. Please try again.");
    }
  };

  if (isLoading) {
    return <Card aria-busy="true"><CardContent><p>Loading engagement data…</p></CardContent></Card>;
  }

  if (!engagement || !metrics) {
    return (
      <Card>
        <CardContent>
          <p role="alert">{error ?? "Engagement data is unavailable."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp aria-hidden="true" className="mr-2" /> Your Engagement Hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}

        <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
          {[
            [metrics.dailyStreak, "Day streak"],
            [`${metrics.weeklyActiveDays}/7`, "Active this week"],
            [metrics.lessonsCompleted, "Lessons done"],
            [`${Math.floor(metrics.timeSpentMinutes / 60)}h ${metrics.timeSpentMinutes % 60}m`, "Time spent"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-secondary p-4">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="weekly-activity-title">
          <h3 id="weekly-activity-title" className="mb-2 text-lg font-semibold">Weekly activity</h3>
          <EngagementActivityChart data={engagement.activityChart ?? EMPTY_CHART} />
        </section>

        <section aria-labelledby="goals-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id="goals-title" className="text-lg font-semibold">Your goals</h3>
            <Button size="sm" type="button" onClick={() => setShowGoalForm((open) => !open)} aria-expanded={showGoalForm}>
              {showGoalForm ? "Cancel" : "Add goal"}
            </Button>
          </div>
          {showGoalForm ? (
            <form onSubmit={addGoal} className="mb-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
              <label className="sm:col-span-3">
                <span className="mb-1 block text-sm font-medium">Goal description</span>
                <Input value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} maxLength={200} required />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Target</span>
                <Input type="number" min={1} step={1} value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} required />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Unit</span>
                <Input value={goalUnit} onChange={(event) => setGoalUnit(event.target.value)} maxLength={40} required />
              </label>
              <div className="flex items-end"><Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save goal"}</Button></div>
            </form>
          ) : null}
          <div className="space-y-2">
            {goals.length === 0 ? <p className="text-sm text-muted-foreground">No goals yet.</p> : goals.map((goal) => (
              <div key={goal.id} className="rounded border p-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{goal.description}</span>
                  <span>{goal.progress}/{goal.target} {goal.unit}</span>
                </div>
                <Progress value={goal.target > 0 ? (goal.progress / goal.target) * 100 : 0} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-secondary p-4" aria-labelledby="difficulty-title">
          <h3 id="difficulty-title" className="text-sm font-semibold">Recommended next difficulty: {recommendedDifficulty}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span>Reward preference:</span>
            {(["badges", "certificates", "career", "tools"] as const).map((preference) => (
              <button
                key={preference}
                type="button"
                onClick={() => void updateRewardPreference(preference)}
                aria-pressed={profile?.rewardPreference === preference}
                className={cn("rounded border px-2 py-1", profile?.rewardPreference === preference ? "bg-primary text-primary-foreground" : "bg-transparent")}
              >
                {preference}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="strategies-title">
          <h3 id="strategies-title" className="mb-2 text-lg font-semibold">Personalized suggestions</h3>
          <div className="space-y-3">
            {strategies.length === 0 ? <p>No suggestions right now. Keep building steady progress.</p> : strategies.map((strategy) => (
              <div key={strategy.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div><h4 className="font-bold">{strategy.title}</h4><p className="text-sm text-muted-foreground">{strategy.description}</p></div>
                <Button asChild><Link href={strategy.href}>Start</Link></Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-primary/10 p-4" aria-labelledby="mentor-title">
          <h3 id="mentor-title" className="mb-1 flex items-center font-bold"><UserCheck aria-hidden="true" className="mr-2" />Your mentor</h3>
          <p className="text-sm text-muted-foreground">{engagement.mentorMessage}</p>
        </section>
      </CardContent>
    </Card>
  );
}
