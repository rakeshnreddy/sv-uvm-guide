import { notFound } from 'next/navigation';
import { SITE_FEATURES } from '@/lib/site-features';

export default async function CommunityPage() {
  // Community needs several learners' data, so it also needs accounts (SITE_FEATURES.community).
  if (!SITE_FEATURES.community) {
    notFound();
  }

  const CommunityPageClient = (await import('./CommunityPageClient')).default;
  return <CommunityPageClient />;
}
