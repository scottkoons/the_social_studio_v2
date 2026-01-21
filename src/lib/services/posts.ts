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

/**
 * Validate a date string format (YYYY-MM-DD)
 */
function isValidDateString(date: unknown): date is string {
  if (typeof date !== 'string' || !date) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Validate workspaceId
 */
function isValidWorkspaceId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0;
}

/**
 * Sanitize an object for Firestore by removing undefined values.
 * Firestore does not accept undefined - use null for missing optional fields.
 * This recursively processes nested objects.
 */
function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      // Skip undefined values entirely (omit from payload)
      continue;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      // Recursively sanitize nested objects (but not arrays, nulls, or Timestamps)
      result[key] = sanitizeForFirestore(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// Get reference to posts collection for a workspace
function getPostsCollection(workspaceId: string) {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspaceId: must be a non-empty string');
  }
  const db = getFirebaseDb();
  return collection(db, 'workspaces', workspaceId, 'posts');
}

// Get reference to a specific post document
function getPostDoc(workspaceId: string, date: string) {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspaceId: must be a non-empty string');
  }
  if (!isValidDateString(date)) {
    throw new Error(`Invalid date: "${date}" - must be a string in YYYY-MM-DD format`);
  }
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
  if (!isValidDateString(data.date)) {
    throw new Error(`Cannot create post: invalid date "${data.date}"`);
  }

  const postRef = getPostDoc(workspaceId, data.date);

  const post = sanitizeForFirestore({
    date: data.date,
    starterText: data.starterText || '',
    imageUrl: data.imageUrl,
    facebook: data.facebook,
    instagram: data.instagram,
    status: 'draft' as const,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }) as Post;

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
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspaceId: must be a non-empty string');
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('No posts to create');
  }

  // Validate all posts before starting the batch
  const invalidPosts = posts
    .map((p, i) => ({ index: i, date: p.date }))
    .filter((p) => !isValidDateString(p.date));

  if (invalidPosts.length > 0) {
    const details = invalidPosts
      .slice(0, 3)
      .map((p) => `post ${p.index + 1}: "${p.date}"`)
      .join(', ');
    throw new Error(
      `Cannot create posts: ${invalidPosts.length} post(s) have invalid dates (${details}${invalidPosts.length > 3 ? '...' : ''})`
    );
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const createdPosts: Post[] = [];

  for (const data of posts) {
    const postRef = getPostDoc(workspaceId, data.date);
    const post = sanitizeForFirestore({
      date: data.date,
      starterText: data.starterText || '',
      imageUrl: data.imageUrl,
      facebook: data.facebook,
      instagram: data.instagram,
      status: 'draft' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }) as Post;
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
  const sanitizedData = sanitizeForFirestore({
    ...data,
    updatedAt: Timestamp.now(),
  });
  await updateDoc(postRef, sanitizedData);
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
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspaceId: must be a non-empty string');
  }

  const validDates = dates.filter(isValidDateString);
  if (validDates.length === 0) {
    return; // Nothing to delete
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  for (const date of validDates) {
    const postRef = getPostDoc(workspaceId, date);
    batch.delete(postRef);
  }

  await batch.commit();
}

// Check if a post exists
export async function postExists(workspaceId: string, date: string): Promise<boolean> {
  if (!isValidDateString(date)) {
    return false;
  }
  const postRef = getPostDoc(workspaceId, date);
  const snapshot = await getDoc(postRef);
  return snapshot.exists();
}

// Change a post's date with validation
export interface ChangeDateResult {
  success: boolean;
  error?: string;
}

export async function changePostDate(
  workspaceId: string,
  oldDate: string,
  newDate: string
): Promise<ChangeDateResult> {
  if (!isValidWorkspaceId(workspaceId)) {
    return { success: false, error: 'Invalid workspace' };
  }
  if (!isValidDateString(oldDate) || !isValidDateString(newDate)) {
    return { success: false, error: 'Invalid date format' };
  }
  if (oldDate === newDate) {
    return { success: true }; // No change needed
  }

  // Validate new date is not in the past
  const today = new Date().toISOString().split('T')[0];
  if (newDate < today) {
    return { success: false, error: 'Cannot schedule posts in the past' };
  }

  // Get the existing post
  const existingPost = await getPost(workspaceId, oldDate);
  if (!existingPost) {
    return { success: false, error: 'Post not found' };
  }

  // Check for platform conflicts on the target date
  const targetPost = await getPost(workspaceId, newDate);
  if (targetPost) {
    // Check if there's a platform conflict
    const sourceHasFacebook = !!existingPost.facebook;
    const sourceHasInstagram = !!existingPost.instagram;
    const targetHasFacebook = !!targetPost.facebook;
    const targetHasInstagram = !!targetPost.instagram;

    if (sourceHasFacebook && targetHasFacebook) {
      return { success: false, error: 'Target date already has a Facebook post' };
    }
    if (sourceHasInstagram && targetHasInstagram) {
      return { success: false, error: 'Target date already has an Instagram post' };
    }

    // If there's a post on the target date but no platform conflict,
    // we still can't move because each date can only have one post document
    return { success: false, error: 'Target date already has a post' };
  }

  // Perform the move: create new document, delete old one
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  const newPostRef = getPostDoc(workspaceId, newDate);
  const oldPostRef = getPostDoc(workspaceId, oldDate);

  // Create new post with updated date
  const newPost = sanitizeForFirestore({
    ...existingPost,
    date: newDate,
    updatedAt: Timestamp.now(),
  });

  batch.set(newPostRef, newPost);
  batch.delete(oldPostRef);

  try {
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error changing post date:', error);
    return { success: false, error: 'Failed to update post' };
  }
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
