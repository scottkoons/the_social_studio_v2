'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Post } from '@/types';

interface UsePostsOptions {
  startDate?: string;
  endDate?: string;
  status?: Post['status'];
}

interface UsePostsReturn {
  posts: Post[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePosts(options: UsePostsOptions = {}): UsePostsReturn {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirebaseDb();
    const postsRef = collection(db, 'workspaces', user.uid, 'posts');

    // Build query based on options
    let constraints: any[] = [orderBy('date', 'asc')];

    if (options.startDate && options.endDate) {
      constraints = [
        where('date', '>=', options.startDate),
        where('date', '<=', options.endDate),
        orderBy('date', 'asc'),
      ];
    } else if (options.status) {
      constraints = [
        where('status', '==', options.status),
        orderBy('date', 'asc'),
      ];
    }

    const q = query(postsRef, ...constraints);

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newPosts = snapshot.docs.map((doc) => doc.data() as Post);
        setPosts(newPosts);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching posts:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, options.startDate, options.endDate, options.status, refetchTrigger]);

  return { posts, loading, error, refetch };
}

// Hook for a single post by date
export function usePost(date: string | null): {
  post: Post | null;
  loading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !date) {
      setPost(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirebaseDb();
    const postsRef = collection(db, 'workspaces', user.uid, 'posts');
    const q = query(postsRef, where('date', '==', date));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setPost(null);
        } else {
          setPost(snapshot.docs[0].data() as Post);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching post:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, date]);

  return { post, loading, error };
}

// Hook for posts counts/stats
export function usePostsStats(): {
  total: number;
  draft: number;
  generated: number;
  exported: number;
  loading: boolean;
} {
  const { posts, loading } = usePosts();

  const stats = {
    total: posts.length,
    draft: posts.filter((p) => p.status === 'draft').length,
    generated: posts.filter((p) => p.status === 'generated' || p.status === 'edited').length,
    exported: posts.filter((p) => p.status === 'exported').length,
    loading,
  };

  return stats;
}

// Hook for posts this week
export function usePostsThisWeek(): UsePostsReturn {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return usePosts({
    startDate: formatDate(startOfWeek),
    endDate: formatDate(endOfWeek),
  });
}
