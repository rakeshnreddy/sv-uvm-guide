import React from 'react';
import type { Metadata } from 'next';
import { siteLabel } from '@/lib/nav-labels';

import KnowledgeHubClient from './KnowledgeHubClient';

/*
 * The knowledge hub: a module map and a searchable concept list derived from
 * the curriculum manifest and the curriculum spine (src/lib/knowledge-graph-engine.ts).
 * Static: the graph is built from generated data at build time. Public: it
 * is in the sitemap and the footer's site map.
 */
export const metadata: Metadata = {
  title: siteLabel('/knowledge-hub'),
  description:
    'A map of every module in the SystemVerilog, UVM and AMBA curriculum with its prerequisites, and a searchable list of modules, lessons and key terms linked to the lessons that teach them.',
};

export default function KnowledgeHubPage() {
  return <KnowledgeHubClient />;
}
