'use server';

import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/auth';

export async function createNotebookEntry(topicId: string, topicTitle: string) {
  await requireSession();

  // In a real application, you would create a new notebook entry in the database.
  // For now, we'll just redirect to the notebook page.
  console.log(`Creating notebook entry for topic ${topicId}: ${topicTitle}`);

  redirect('/dashboard/notebook');
}
