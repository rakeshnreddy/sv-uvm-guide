"use client";

import React from 'react';
import {
  computeCompetency,
  computeEngagement,
  predictPerformance,
  type AnalyticsEvent,
} from '../../lib/analytics';

interface AnalyticsDashboardProps {
  events: AnalyticsEvent[];
}

// ⚡ Bolt: Wrapped analytics calculations in useMemo and component in React.memo to prevent unnecessary re-renders
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = React.memo(({ events }) => {
  const { competency, engagement, performance } = React.useMemo(() => {
    return {
      competency: computeCompetency(events).toFixed(2),
      engagement: computeEngagement(events),
      performance: predictPerformance(events).toFixed(2),
    };
  }, [events]);

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Learning Analytics</h3>
      <ul className="text-sm list-disc ml-5">
        <li>Competency: {competency}</li>
        <li>Engagement events: {engagement}</li>
        <li>Predicted performance: {performance}</li>
      </ul>
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;
