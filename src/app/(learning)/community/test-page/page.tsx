import { notFound } from 'next/navigation';
import { SITE_FEATURES } from '@/lib/site-features';

export default async function TestPage() {
  // Community needs several learners' data, so it also needs accounts (SITE_FEATURES.community).
  if (!SITE_FEATURES.community) {
    notFound();
  }

  const TestPageClient = (await import('./TestPageClient')).default;
  return <TestPageClient />;
}
