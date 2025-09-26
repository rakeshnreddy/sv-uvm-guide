"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [shareTelemetry, setShareTelemetry] = useState(true);

  return (
    <div className="space-y-10">
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Settings</h1>
        <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
          Tune preferences for appearance, communication, and data usage. These settings will expand as dashboard
          features graduate from beta.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Appearance</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">Choose your default theme and interface density.</p>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-[rgba(230,241,255,0.8)]">Enable dark interface</span>
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              aria-pressed={darkMode}
              className={`w-14 rounded-full border border-white/15 bg-white/5 px-1 py-1 transition ${darkMode ? 'bg-[var(--blueprint-accent)]/40 text-white' : 'text-[rgba(230,241,255,0.6)]'}`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <p className="mt-4 text-xs text-[rgba(230,241,255,0.55)]">
            Dark mode keeps the blueprint aesthetic; light mode will arrive later this quarter.
          </p>
        </article>

        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Notifications</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">Decide when we nudge you about streaks, reviews, and new labs.</p>
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => setEmailUpdates((value) => !value)}
              aria-pressed={emailUpdates}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-[rgba(230,241,255,0.8)] transition hover:bg-white/10"
            >
              Email updates about new modules
              <span className={`text-xs ${emailUpdates ? 'text-[var(--blueprint-accent)]' : 'text-[rgba(230,241,255,0.45)]'}`}>
                {emailUpdates ? 'On' : 'Off'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShareTelemetry((value) => !value)}
              aria-pressed={shareTelemetry}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-[rgba(230,241,255,0.8)] transition hover:bg-white/10"
            >
              Share anonymous telemetry to improve recommendations
              <span className={`text-xs ${shareTelemetry ? 'text-[var(--blueprint-accent)]' : 'text-[rgba(230,241,255,0.45)]'}`}>
                {shareTelemetry ? 'On' : 'Off'}
              </span>
            </button>
          </div>
        </article>
      </section>

      <section className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
        <h2 className="text-xl font-semibold text-primary">Account Controls</h2>
        <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
          Export your learning records or deactivate the account when the project is complete.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Button variant="outline">Export progress (CSV)</Button>
          <Button variant="outline">Request data deletion</Button>
          <Button variant="destructive">Deactivate account</Button>
        </div>
        <p className="mt-4 text-xs text-[rgba(230,241,255,0.55)]">
          These actions currently open support tickets; automated flows ship once the dashboard moves out of beta.
        </p>
      </section>
    </div>
  );
}
