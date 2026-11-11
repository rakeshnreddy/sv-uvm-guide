import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { learnerBreadcrumbs } from '@/components/learner/LearnerSectionNav';
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

export default function SettingsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl">
        <Breadcrumbs items={learnerBreadcrumbs('settings')} className="-mt-2 mb-4" />
      </div>
      <SettingsPageClient />
    </>
  );
}
