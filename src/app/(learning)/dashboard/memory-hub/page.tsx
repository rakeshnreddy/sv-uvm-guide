import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function MemoryHubPage() {
  if (!isFeatureEnabled('personalization')) {
    notFound();
  }

  const MemoryHubPageClient = (await import('./MemoryHubPageClient')).default;
  return <MemoryHubPageClient />;
}
