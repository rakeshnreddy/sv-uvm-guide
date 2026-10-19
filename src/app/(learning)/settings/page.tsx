import type { Metadata } from 'next';

import SettingsPageClient from './SettingsPageClient';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your theme, and the learning data saved in this browser: back it up, restore it or delete it.',
};

// A static shell: the theme and learner data are read in the browser after
// hydration, and account preferences load only for a signed-in learner.
export const dynamic = 'error';

export default function SettingsPage() {
  return <SettingsPageClient />;
}
