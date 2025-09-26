import ComprehensiveAssessmentSystem from '@/components/assessment/ComprehensiveAssessmentSystem';
import InfoPage from '@/components/templates/InfoPage';

const AssessmentPage = () => {
  return (
    <InfoPage title="Assessment Center" description="Test your skills and track your progress.">
      <ComprehensiveAssessmentSystem />
    </InfoPage>
  );
};

export default AssessmentPage;
