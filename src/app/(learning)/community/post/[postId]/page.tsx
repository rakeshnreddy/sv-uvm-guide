import { notFound } from 'next/navigation';
import { SITE_FEATURES } from '@/lib/site-features';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
};

type PostPageProps = {
  params: {
    postId: string;
  };
};

export default async function PostPage({ params }: PostPageProps) {
  // Community needs several learners' data, so it also needs accounts (SITE_FEATURES.community).
  if (!SITE_FEATURES.community) {
    notFound();
  }

  const [{ db }, { doc, getDoc }] = await Promise.all([
    import('@/lib/firebase'),
    import('firebase/firestore'),
  ]);

  const { postId } = params;
  const docRef = doc(db, 'posts', postId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    notFound();
  }

  const post = { id: docSnap.id, ...docSnap.data() } as Post;
  const PostClientPage = (await import('./PostClientPage')).default;

  return <PostClientPage post={post} />;
}
