import React from 'react';

import type { InterviewQuestion } from '@/app/(learning)/interview-prep/interview-banks';

import { questionListHtml } from './question-html';

/**
 * A level's questions, server-rendered as one HTML string of native
 * disclosures (question-html.ts). Style it with QUESTION_LIST_CLASS on an
 * ancestor. After hydration React never touches the inside, so the
 * controller and the learner can open and close rows freely.
 */
export function QuestionList({ questions }: { questions: readonly InterviewQuestion[] }) {
  // A row opened before hydration changes the markup; that is expected, not a mismatch.
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: questionListHtml(questions) }} />;
}

export default QuestionList;
