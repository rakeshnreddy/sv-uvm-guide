"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
};

type Comment = {
  id: string;
  text: string;
  author: string;
  createdAt: any;
};

type PostClientPageProps = {
  post: Post;
};

export default function PostClientPage({ post }: PostClientPageProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!post.id) return;
    const unsubscribe = onSnapshot(collection(db, 'posts', post.id, 'comments'), (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post.id) return;
    await addDoc(collection(db, 'posts', post.id, 'comments'), {
      text: newComment,
      author: user.uid,
      createdAt: serverTimestamp(),
    });
    setNewComment('');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
      <p className="mb-8">{post.content}</p>
      <hr />
      <h2 className="text-2xl font-bold my-4">Comments</h2>
      {user && (
        <form onSubmit={handleAddComment} className="mb-8">
          <textarea
            placeholder="Add a comment"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="w-full p-2 mb-2 border border-border rounded bg-background"
          />
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">
            Add Comment
          </button>
        </form>
      )}
      <div>
          {comments.map((comment) => (
          <div key={comment.id} className="p-4 mb-4 border border-border rounded bg-card text-card-foreground">
            <p>{comment.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
