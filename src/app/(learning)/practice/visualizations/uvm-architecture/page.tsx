import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

import LearnInLesson from '@/components/practice/LearnInLesson';
import { PracticeInfoPage } from '@/components/practice/PracticeInfoPage';
import { requirePracticePage } from '@/lib/practice-links';

const InteractiveUvmArchitectureDiagram = dynamic(
  () => import('@/components/diagrams/InteractiveUvmArchitectureDiagram'),
  {
    ssr: false,
    loading: () => <div className="flex h-64 items-center justify-center">Loading visualization...</div>,
  },
);

const HREF = '/practice/visualizations/uvm-architecture';
const practice = requirePracticePage(HREF);

export const metadata: Metadata = { title: practice.title, description: practice.description };

const UvmArchitecturePage = () => {
  return (
    <PracticeInfoPage href={HREF}
      title={practice.title}
      description={practice.description}
      diagrams={[<InteractiveUvmArchitectureDiagram key="uvm-arch" />]}
    >
      <LearnInLesson item={practice} />
    </PracticeInfoPage>
  );
};

export default UvmArchitecturePage;
