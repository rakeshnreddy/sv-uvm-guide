import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function CommunityPage() {
  if (!isFeatureEnabled('community')) {
    notFound();
  }

  const CommunityPageClient = (await import('./CommunityPageClient')).default;
  return <CommunityPageClient />;
}
