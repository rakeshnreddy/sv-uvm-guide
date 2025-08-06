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

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ events }) => {
  const competency = computeCompetency(events).toFixed(2);
  const engagement = computeEngagement(events);
  const performance = predictPerformance(events).toFixed(2);
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
};

export default AnalyticsDashboard;
