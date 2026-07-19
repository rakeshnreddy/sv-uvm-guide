import InfoPage from '@/components/templates/InfoPage';
import { isFeatureEnabled } from '@/tools/featureFlags';

export default async function AssessmentPage() {
  if (!isFeatureEnabled('tracking')) {
    return (
      <InfoPage
        title="Assessment Center"
        description="Test your skills and track your progress."
      >
        <p className="text-sm text-muted-foreground">
          The assessment center is currently disabled while we focus on the core learning path.
        </p>
      </InfoPage>
    );
  }

  const ComprehensiveAssessmentSystem = (await import('@/components/assessment/ComprehensiveAssessmentSystem')).default;

  return (
    <InfoPage title="Assessment Center" description="Test your skills and track your progress.">
      <ComprehensiveAssessmentSystem />
    </InfoPage>
  );
}
