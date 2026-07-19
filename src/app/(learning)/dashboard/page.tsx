import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function DashboardPage() {
  if (!isFeatureEnabled('tracking')) {
    notFound();
  }

  const DashboardPageClient = (await import('./DashboardPageClient')).default;
  return <DashboardPageClient />;
}
