"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
};

export default function CommunityPageClient() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await addDoc(collection(db, 'posts'), {
      ...newPost,
      author: user.uid,
      createdAt: serverTimestamp(),
    });
    setNewPost({ title: '', content: '' });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">

      <main className="relative mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="px-8 py-10">
            <p className="text-xs font-medium text-muted-foreground">Community control room</p>
            <h1 className="mt-4 text-h1 text-foreground">Collaborate with fellow verification engineers</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Share wins, request reviews, and surface tricky failure signatures. Every post feeds collective expertise.
            </p>
          </div>
        </header>

        {user ? (
          <form
            onSubmit={handleCreatePost}
            className="mb-12 space-y-4 rounded-xl border border-border bg-card p-8 shadow-card"
          >
            <div>
              <label className="text-xs font-medium text-muted-foreground">Headline</label>
              <input
                type="text"
                placeholder="Summarize your insight"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Details</label>
              <textarea
                placeholder="Describe the scenario, tools, and what you need help with."
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                className="mt-2 min-h-[140px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">Markdown supported. Keep code snippets short and link to labs when possible.</p>
              <button
                type="submit"
                className="rounded-lg border border-transparent bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 forced-colors:border-[ButtonText]"
              >
                Post insight
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-12 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
            <p>
              Sign in to join the conversation, react to posts, and bookmark debug recipes.
            </p>
          </div>
        )}

        <section className="space-y-6">
          {posts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
              <p>No community threads yet. Be the first to share a regression insight or ask for a review.</p>
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="rounded-xl border border-border bg-card p-8 shadow-card"
              >
                <Link href={`/community/post/${post.id}`} className="group">
                  <h2 className="text-h2 text-foreground group-hover:text-primary">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-3 text-sm text-muted-foreground">{post.content}</p>
                <div className="mt-4 text-xs text-subtle">
                  {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
