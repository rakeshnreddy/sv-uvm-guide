import dynamic from 'next/dynamic';
import { InfoPage } from '@/components/templates/InfoPage';

const AssertionBuilder = dynamic(
  () => import('@/components/animations/AssertionBuilder'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const AssertionBuilderPage = () => {
  return (
    <InfoPage title="SVA Assertion Builder" diagrams={[<AssertionBuilder key="assertion" />]} />
  );
};

export default AssertionBuilderPage;
