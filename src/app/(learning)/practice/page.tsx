import React from 'react';
import type { Metadata } from 'next';

import PracticeHub from '@/components/practice/PracticeHub';

export const metadata: Metadata = {
  title: 'Practice Hub',
  description:
    'Labs, exercises, interactive models, tools and interview questions for SystemVerilog and UVM, in curriculum order, each linked to the lesson that teaches it.',
};

export default function PracticePage() {
  return <PracticeHub />;
}
