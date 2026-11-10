"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { AdaptiveTestEngine } from './AdaptiveTestEngine';
import { ProjectBasedEvaluator } from './ProjectBasedEvaluator';
import { CompetencyCertification } from './CompetencyCertification';
import { Button } from '@/components/ui/Button';

const VisualizationFallback = () => (
  <div className="flex h-48 items-center justify-center">Loading visualization...</div>
);

const SkillMatrixVisualizer = dynamic(
  () => import('./SkillMatrixVisualizer'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);

const ProgressAnalytics = dynamic(
  () => import('./ProgressAnalytics'),
  { ssr: false, loading: () => <VisualizationFallback /> },
);

type AssessmentTab = 'overview' | 'test' | 'project' | 'skills' | 'analytics' | 'certification';

const TABS: { id: AssessmentTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'test', label: 'Adaptive Test' },
  { id: 'project', label: 'Project Evaluation' },
  { id: 'skills', label: 'Skill Matrix' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'certification', label: 'Certification' },
];

export const ComprehensiveAssessmentSystem = () => {
  const [activeTab, setActiveTab] = useState<AssessmentTab>('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-4">
            <h3 className="text-h3 mb-2 text-foreground">Welcome to the Assessment Center</h3>
            <p className="text-muted-foreground">
              Here you can test your knowledge, evaluate complex projects, visualize your skills, and track your progress towards certification.
              Select a tab above to begin.
            </p>
          </div>
        );
      case 'test':
        return <AdaptiveTestEngine />;
      case 'project':
        return <ProjectBasedEvaluator />;
      case 'skills':
        return <SkillMatrixVisualizer />;
      case 'analytics':
        return <ProgressAnalytics />;
      case 'certification':
        return <CompetencyCertification />;
      default:
        return null;
    }
  };

  return (
    <div className="my-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-h2 mb-4 text-foreground">Comprehensive Assessment System</h2>
      <div className="mb-4 border-b border-border">
        <nav className="flex space-x-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-t-md rounded-b-none"
            >
              {tab.label}
            </Button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default ComprehensiveAssessmentSystem;
