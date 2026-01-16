import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Post } from '@/types';

// Get reference to posts collection for a workspace
function getPostsCollection(workspaceId: string) {
  const db = getFirebaseDb();
  return collection(db, 'workspaces', workspaceId, 'posts');
}

// Get reference to a specific post document
function getPostDoc(workspaceId: string, date: string) {
  const db = getFirebaseDb();
  return doc(db, 'workspaces', workspaceId, 'posts', date);
}

// Create a new post
export async function createPost(
  workspaceId: string,
  data: {
    date: string;
    starterText?: string;
    imageUrl?: string;
    facebook?: Post['facebook'];
    instagram?: Post['instagram'];
  }
): Promise<Post> {
  const postRef = getPostDoc(workspaceId, data.date);

  const post: Post = {
    date: data.date,
    starterText: data.starterText || '',
    imageUrl: data.imageUrl,
    facebook: data.facebook,
    instagram: data.instagram,
    status: 'draft',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(postRef, post);
  return post;
}

// Create multiple posts in a batch
export async function createPostsBatch(
  workspaceId: string,
  posts: Array<{
    date: string;
    starterText?: string;
    imageUrl?: string;
    facebook?: Post['facebook'];
    instagram?: Post['instagram'];
  }>
): Promise<Post[]> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const createdPosts: Post[] = [];

  for (const data of posts) {
    const postRef = getPostDoc(workspaceId, data.date);
    const post: Post = {
      date: data.date,
      starterText: data.starterText || '',
      imageUrl: data.imageUrl,
      facebook: data.facebook,
      instagram: data.instagram,
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    batch.set(postRef, post);
    createdPosts.push(post);
  }

  await batch.commit();
  return createdPosts;
}

// Get a single post by date
export async function getPost(workspaceId: string, date: string): Promise<Post | null> {
  const postRef = getPostDoc(workspaceId, date);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as Post;
}

// Get all posts for a workspace
export async function getPosts(workspaceId: string): Promise<Post[]> {
  const postsRef = getPostsCollection(workspaceId);
  const q = query(postsRef, orderBy('date', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as Post);
}

// Get posts within a date range
export async function getPostsByDateRange(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<Post[]> {
  const postsRef = getPostsCollection(workspaceId);
  const q = query(
    postsRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as Post);
}

// Get posts by status
export async function getPostsByStatus(
  workspaceId: string,
  status: Post['status']
): Promise<Post[]> {
  const postsRef = getPostsCollection(workspaceId);
  const q = query(
    postsRef,
    where('status', '==', status),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as Post);
}

// Update a post
export async function updatePost(
  workspaceId: string,
  date: string,
  data: Partial<Omit<Post, 'date' | 'createdAt'>>
): Promise<void> {
  const postRef = getPostDoc(workspaceId, date);
  await updateDoc(postRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Update post's starter text
export async function updatePostStarterText(
  workspaceId: string,
  date: string,
  starterText: string
): Promise<void> {
  await updatePost(workspaceId, date, { starterText });
}

// Update post's image
export async function updatePostImage(
  workspaceId: string,
  date: string,
  imageAssetId?: string,
  imageUrl?: string
): Promise<void> {
  await updatePost(workspaceId, date, { imageAssetId, imageUrl });
}

// Update post's Facebook content
export async function updatePostFacebook(
  workspaceId: string,
  date: string,
  facebook: Post['facebook']
): Promise<void> {
  await updatePost(workspaceId, date, { facebook });
}

// Update post's Instagram content
export async function updatePostInstagram(
  workspaceId: string,
  date: string,
  instagram: Post['instagram']
): Promise<void> {
  await updatePost(workspaceId, date, { instagram });
}

// Update post status
export async function updatePostStatus(
  workspaceId: string,
  date: string,
  status: Post['status']
): Promise<void> {
  await updatePost(workspaceId, date, { status });
}

// Delete a post
export async function deletePost(workspaceId: string, date: string): Promise<void> {
  const postRef = getPostDoc(workspaceId, date);
  await deleteDoc(postRef);
}

// Delete multiple posts
export async function deletePostsBatch(workspaceId: string, dates: string[]): Promise<void> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  for (const date of dates) {
    const postRef = getPostDoc(workspaceId, date);
    batch.delete(postRef);
  }

  await batch.commit();
}

// Check if a post exists
export async function postExists(workspaceId: string, date: string): Promise<boolean> {
  const postRef = getPostDoc(workspaceId, date);
  const snapshot = await getDoc(postRef);
  return snapshot.exists();
}

// Get dates that already have posts (for scheduling)
export async function getExistingPostDates(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const posts = await getPostsByDateRange(workspaceId, startDate, endDate);
  return new Set(posts.map((post) => post.date));
}
