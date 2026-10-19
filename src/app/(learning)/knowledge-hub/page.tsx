import React from 'react';
import { notFound } from 'next/navigation';
import { SITE_FEATURES } from '@/lib/site-features';
import KnowledgeHubClient from './KnowledgeHubClient';

/*
 * A draft page: its concept graph is 15 hand-written placeholder nodes that
 * link to no lesson (src/lib/knowledge-graph-engine.ts), so the page is hidden
 * (404, unlinked and out of the sitemap) unless draft pages are switched on
 * for a preview build (SITE_FEATURES.draftPages). The lessons and the Practice
 * Hub already cover what it would teach.
 */
export default function KnowledgeHubPage() {
  if (!SITE_FEATURES.draftPages) {
    notFound();
  }

  return <KnowledgeHubClient />;
}
