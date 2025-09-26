import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function TestPage() {
  if (!isFeatureEnabled('community')) {
    notFound();
  }

  const TestPageClient = (await import('./TestPageClient')).default;
  return <TestPageClient />;
}
