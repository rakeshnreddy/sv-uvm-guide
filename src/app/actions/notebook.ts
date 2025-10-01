'use server';

import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session-options';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';

export async function createNotebookEntry(topicId: string, topicTitle: string) {
  const session = await getSession();
  if (!session.userId) {
    throw new Error('You must be logged in to create a notebook entry.');
  }

  // In a real application, you would create a new notebook entry in the database.
  // For now, we'll just redirect to the notebook page.
  console.log(`Creating notebook entry for topic ${topicId}: ${topicTitle}`);

  redirect('/dashboard/notebook');
}
