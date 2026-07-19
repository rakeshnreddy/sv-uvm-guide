import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';

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
  if (!isFeatureEnabled('community')) {
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
