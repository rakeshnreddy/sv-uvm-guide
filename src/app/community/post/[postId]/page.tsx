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

export default function PostPage({ params }: { params: { postId: string } }) {
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const fetchPost = async () => {
      const docRef = doc(db, 'posts', params.postId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() } as Post);
      }
    };
    fetchPost();
  }, [params.postId]);

  useEffect(() => {
    if (!params.postId) return;
    const unsubscribe = onSnapshot(collection(db, 'posts', params.postId, 'comments'), (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [params.postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !params.postId) return;
    await addDoc(collection(db, 'posts', params.postId, 'comments'), {
      text: newComment,
      author: user.uid,
      createdAt: serverTimestamp(),
    });
    setNewComment('');
  };

  if (!post) {
    return <div>Loading...</div>;
  }

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
            className="w-full p-2 mb-2 border rounded"
          />
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
            Add Comment
          </button>
        </form>
      )}
      <div>
        {comments.map((comment) => (
          <div key={comment.id} className="p-4 mb-4 border rounded">
            <p>{comment.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
