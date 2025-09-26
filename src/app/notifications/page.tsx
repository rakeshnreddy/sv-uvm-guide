import { isFeatureEnabled } from '@/tools/featureFlags';

const notifications = [
  {
    title: 'Tier 3 sequencing review ready',
    detail: 'Miguel left feedback on your arbitration sandbox submission.',
    timestamp: '2 hours ago',
  },
  {
    title: 'Regression diagnostics tutorial unlocked',
    detail: 'Because you completed the performance hotspot lesson, the follow-up lab is now available.',
    timestamp: 'Yesterday',
  },
  {
    title: 'Streak reminder',
    detail: 'Keep your 12 day learning streak alive with a 15 minute flashcard session.',
    timestamp: 'Yesterday',
  },
];

export default function NotificationsPage() {
  if (!isFeatureEnabled('accountUI')) {
    return (
      <div className="space-y-6">
        <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
          <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Notifications</h1>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
            Notifications will launch once account preferences are wired up. For now, focus on the core curriculum—there are no
            alerts you might miss.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Notifications</h1>
        <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
          This inbox collects learning nudges, reviewer hand-offs, and achievement updates. Real-time delivery is on the
          roadmap once the dashboard web socket channel ships.
        </p>
      </header>

      <section className="space-y-4">
        {notifications.map((item) => (
          <article
            key={item.title}
            className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">{item.title}</h2>
              <span className="text-xs text-[rgba(230,241,255,0.55)]">{item.timestamp}</span>
            </div>
            <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">{item.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
