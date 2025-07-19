import React from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import PostClientPage from './PostClientPage';
import { notFound } from 'next/navigation';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
};

type PostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;
  const docRef = doc(db, 'posts', postId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    notFound();
  }

  const post = { id: docSnap.id, ...docSnap.data() } as Post;

  return <PostClientPage post={post} />;
}
