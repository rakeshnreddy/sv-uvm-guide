"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--blueprint-bg)] text-[var(--blueprint-foreground)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(100,255,218,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(255,202,134,0.16),_transparent_65%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(130deg,_rgba(5,11,26,0.92),_rgba(11,20,44,0.85))]" />
      </div>

      <main className="relative mx-auto max-w-5xl px-6 py-12">
        <header className="glass-card glow-border mb-10 overflow-hidden">
          <div className="hero-gradient px-8 py-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[rgba(230,241,255,0.65)]">Community control room</p>
            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Collaborate with fellow verification engineers</h1>
            <p className="mt-3 max-w-2xl text-sm text-[rgba(230,241,255,0.76)]">
              Share wins, request reviews, and surface tricky failure signatures. Every post feeds collective expertise.
            </p>
          </div>
        </header>

        {user ? (
          <form
            onSubmit={handleCreatePost}
            className="glass-card mb-12 space-y-4 border border-white/10 bg-[var(--blueprint-glass)] p-8"
          >
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.6)]">Headline</label>
              <input
                type="text"
                placeholder="Summarize your insight"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-[var(--blueprint-foreground)] placeholder:text-[rgba(230,241,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[var(--blueprint-accent)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.6)]">Details</label>
              <textarea
                placeholder="Describe the scenario, tools, and what you need help with."
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-[var(--blueprint-foreground)] placeholder:text-[rgba(230,241,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[var(--blueprint-accent)]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[rgba(230,241,255,0.6)]">Markdown supported. Keep code snippets short and link to labs when possible.</p>
              <button
                type="submit"
                className="btn-gradient rounded-full px-6 py-2 text-sm font-semibold text-white shadow-lg"
              >
                Post insight
              </button>
            </div>
          </form>
        ) : (
          <div className="glass-card mb-12 border border-white/10 bg-[var(--blueprint-glass)] p-6 text-sm text-[rgba(230,241,255,0.7)]">
            <p>
              Sign in to join the conversation, react to posts, and bookmark debug recipes.
            </p>
          </div>
        )}

        <section className="space-y-6">
          {posts.length === 0 ? (
            <div className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 text-center text-sm text-[rgba(230,241,255,0.7)]">
              <p>No community threads yet. Be the first to share a regression insight or ask for a review.</p>
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 transition-transform hover:-translate-y-1"
              >
                <Link href={`/community/post/${post.id}`} className="group">
                  <h2 className="text-2xl font-semibold text-[var(--blueprint-foreground)] group-hover:text-[var(--blueprint-accent)]">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-3 text-sm text-[rgba(230,241,255,0.75)]">{post.content}</p>
                <div className="mt-4 text-xs text-[rgba(230,241,255,0.5)]">
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
