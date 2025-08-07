import ComprehensiveAssessmentSystem from '@/components/assessment/ComprehensiveAssessmentSystem';
import MainLayout from '@/components/layout/MainLayout';
import InfoPage from '@/components/templates/InfoPage';

const AssessmentPage = () => {
  return (
    <MainLayout>
      <InfoPage title="Assessment Center" description="Test your skills and track your progress.">
        <ComprehensiveAssessmentSystem />
      </InfoPage>
    </MainLayout>
  );
};

export default AssessmentPage;
