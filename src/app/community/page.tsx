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
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
        Community Forum
      </h1>
      {user && (
        <form onSubmit={handleCreatePost} className="mb-8">
          <input
            type="text"
            placeholder="Title"
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <textarea
            placeholder="Content"
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
            Create Post
          </button>
        </form>
      )}
      <div>
        {posts.map((post) => (
          <div key={post.id} className="p-4 mb-4 border rounded">
            <Link href={`/community/post/${post.id}`}>
              <h2 className="text-2xl font-bold">{post.title}</h2>
            </Link>
            <p>{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
