import { notFound } from 'next/navigation';
import InfoPage from '@/components/templates/InfoPage';
import { SITE_FEATURES } from '@/lib/site-features';

/*
 * The assessment center is mostly mock content, so it is hidden (404,
 * unlinked and out of the sitemap) unless it is switched on for a preview
 * build (SITE_FEATURES.assessmentCenter).
 */
export default async function AssessmentPage() {
  if (!SITE_FEATURES.assessmentCenter) {
    notFound();
  }

  const ComprehensiveAssessmentSystem = (await import('@/components/assessment/ComprehensiveAssessmentSystem')).default;

  return (
    <InfoPage title="Assessment Center" description="Test your skills and track your progress.">
      <ComprehensiveAssessmentSystem />
    </InfoPage>
  );
}
