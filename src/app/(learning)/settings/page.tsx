import type { Metadata } from 'next';

import { siteLabel } from '@/lib/nav-labels';
import { SETTINGS_HREF } from '@/lib/site-links';

import SettingsPageClient from './SettingsPageClient';

export const metadata: Metadata = {
  title: siteLabel(SETTINGS_HREF),
  description: 'Your theme, and the learning data saved in this browser: back it up, restore it or delete it.',
};

// A static shell: the theme and learner data are read in the browser after
// hydration, and account preferences load only for a signed-in learner.
export const dynamic = 'error';

/** The page header, with the Dashboard › Settings trail, is part of SettingsPageClient. */
export default function SettingsPage() {
  return <SettingsPageClient />;
}
