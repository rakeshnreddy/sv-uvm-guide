import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function NotebookPage() {
  if (!isFeatureEnabled('personalization')) {
    notFound();
  }

  const NotebookPageClient = (await import('./NotebookPageClient')).default;
  return <NotebookPageClient />;
}
