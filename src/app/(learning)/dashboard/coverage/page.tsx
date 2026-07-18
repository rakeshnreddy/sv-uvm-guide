import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function CoverageDashboardPage() {
  if (!isFeatureEnabled('tracking')) {
    notFound();
  }

  const CoveragePageClient = (await import('./CoveragePageClient')).default;
  return <CoveragePageClient />;
}
