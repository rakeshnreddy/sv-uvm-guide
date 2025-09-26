import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function SettingsPage() {
  if (!isFeatureEnabled('accountUI')) {
    notFound();
  }

  const SettingsPageClient = (await import('./SettingsPageClient')).default;
  return <SettingsPageClient />;
}
