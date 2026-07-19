'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { buildCurriculumStatus, summarizeByTier, TopicStatus } from '@/lib/curriculum-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

const statusLabel: Record<TopicStatus, string> = {
  complete: 'Complete',
  'in-review': 'In Review',
  draft: 'Draft',
};

const statusTone: Record<TopicStatus, string> = {
  complete: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/60',
  'in-review': 'bg-amber-500/15 text-amber-200 border border-amber-500/60',
  draft: 'bg-slate-500/15 text-slate-200 border border-slate-500/60',
};

const filterOptions: Array<{ value: 'all' | TopicStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Complete' },
  { value: 'in-review', label: 'In Review' },
  { value: 'draft', label: 'Draft' },
];

function StatusBadge({ status }: { status: TopicStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', statusTone[status])}>
      {statusLabel[status]}
    </span>
  );
}

function SectionHeading({ tier, complete, total }: { tier: string; complete: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm uppercase tracking-[0.3em] text-[rgba(230,241,255,0.65)]">
        {tier.replace('T', 'Tier ')} coverage
      </p>
      <p className="text-sm font-semibold text-primary">{percent}% complete</p>
    </div>
  );
}

const CoverageDashboardPage = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | TopicStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const statusEntries = useMemo(() => buildCurriculumStatus(), []);

  const summaryByTier = useMemo(() => summarizeByTier(statusEntries), [statusEntries]);

  const aggregate = useMemo(() => {
    return statusEntries.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[entry.status] += 1;
        return acc;
      },
      { total: 0, complete: 0, 'in-review': 0, draft: 0 } as Record<'total' | TopicStatus, number>,
    );
  }, [statusEntries]);

  const filteredEntries = useMemo(() => {
    return statusEntries.filter(entry => {
      const matchStatus = statusFilter === 'all' || entry.status === statusFilter;
      const term = searchTerm.trim().toLowerCase();
      if (!term) return matchStatus;
      const haystack = `${entry.topicTitle} ${entry.moduleTitle} ${entry.sectionTitle}`.toLowerCase();
      return matchStatus && haystack.includes(term);
    });
  }, [statusEntries, statusFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-[var(--blueprint-bg)] px-6 py-10 text-[var(--blueprint-foreground)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="glass-card glow-border rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[rgba(230,241,255,0.65)]">Content intelligence</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Curriculum Coverage Dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm text-[rgba(230,241,255,0.7)]">
            Track migration progress across every lesson. Filter by status, drill into modules, and identify which topics still need SME review before the next push.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="glass-card border border-white/10">
            <CardHeader>
              <CardTitle>Total topics</CardTitle>
              <CardDescription>Across all tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">{aggregate.total}</p>
              <div className="mt-4 space-y-1 text-sm text-[rgba(230,241,255,0.7)]">
                <p>{aggregate.complete} complete</p>
                <p>{aggregate['in-review']} in review</p>
                <p>{aggregate.draft} drafts</p>
              </div>
            </CardContent>
          </Card>

          {Object.entries(summaryByTier).map(([tier, stats]) => {
            const completePercent = stats.total === 0 ? 0 : Math.round((stats.complete / stats.total) * 100);
            return (
              <Card key={tier} className="glass-card border border-white/10">
                <CardHeader>
                  <SectionHeading tier={tier} complete={stats.complete} total={stats.total} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={completePercent} className="h-2 bg-white/10" />
                  <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.65)]">
                    <div>
                      <p className="text-lg font-semibold text-primary">{stats.complete}</p>
                      <p>Complete</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-amber-200">{stats.review}</p>
                      <p>Review</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-200">{stats.draft}</p>
                      <p>Draft</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="glass-card border border-white/10">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Topic tracker</CardTitle>
              <CardDescription>Filter lessons to see what still needs work before the next release.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="flex gap-2">
                {filterOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={statusFilter === option.value ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(option.value)}
                    className={cn('text-sm', statusFilter === option.value ? 'bg-primary text-primary-foreground' : 'bg-transparent text-[rgba(230,241,255,0.8)] hover:bg-white/10')}
                  >
                    {option.label}
                    {option.value !== 'all' && (
                      <span className="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-[0.7rem]">
                        {aggregate[option.value as TopicStatus]}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by topic or module"
                className="md:w-64"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-[rgba(230,241,255,0.8)]">
              <thead className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.5)]">
                <tr>
                  <th className="py-3 pr-6">Tier</th>
                  <th className="py-3 pr-6">Module</th>
                  <th className="py-3 pr-6">Topic</th>
                  <th className="py-3 pr-6">Status</th>
                  <th className="py-3 pr-6">Owner</th>
                  <th className="py-3 pr-6">Last Updated</th>
                  <th className="py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.path} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-3 pr-6 font-medium text-primary">{entry.tier.replace('T', 'Tier ')}</td>
                    <td className="py-3 pr-6">
                      <Link
                        href={`/curriculum/${entry.moduleSlug}/${entry.sectionSlug}/${entry.topicSlug}`}
                        className="text-primary hover:underline"
                      >
                        {entry.moduleTitle}
                      </Link>
                    </td>
                    <td className="py-3 pr-6">{entry.topicTitle}</td>
                    <td className="py-3 pr-6"><StatusBadge status={entry.status} /></td>
                    <td className="py-3 pr-6">{entry.owner}</td>
                    <td className="py-3 pr-6">{entry.lastUpdated}</td>
                    <td className="py-3 text-xs text-[rgba(230,241,255,0.65)]">{entry.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length === 0 && (
              <div className="py-12 text-center text-sm text-[rgba(230,241,255,0.6)]">
                No topics match your filters yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoverageDashboardPage;
