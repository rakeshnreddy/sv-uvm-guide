import AssertionBuilder from '@/components/animations/AssertionBuilder';
import { InfoPage } from '@/components/templates/InfoPage';

const AssertionBuilderPage = () => {
  return (
    <InfoPage title="SVA Assertion Builder" diagrams={[<AssertionBuilder key="assertion" />]} />
  );
};

export default AssertionBuilderPage;
