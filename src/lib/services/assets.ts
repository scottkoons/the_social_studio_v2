import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseStorage } from '@/lib/firebase';
import type { Asset } from '@/types';

// Generate a unique asset ID
function generateAssetId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Get reference to assets collection for a workspace
function getAssetsCollection(workspaceId: string) {
  const db = getFirebaseDb();
  return collection(db, 'workspaces', workspaceId, 'assets');
}

// Get reference to a specific asset document
function getAssetDoc(workspaceId: string, assetId: string) {
  const db = getFirebaseDb();
  return doc(db, 'workspaces', workspaceId, 'assets', assetId);
}

// Upload an image file and create an asset record
export async function uploadAsset(
  workspaceId: string,
  file: File
): Promise<Asset> {
  const storage = getFirebaseStorage();
  const assetId = generateAssetId();

  // Create storage path: workspaces/{workspaceId}/images/{assetId}-{filename}
  const storagePath = `workspaces/${workspaceId}/images/${assetId}-${file.name}`;
  const storageRef = ref(storage, storagePath);

  // Upload the file
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  // Get the download URL
  const downloadUrl = await getDownloadURL(snapshot.ref);

  // Create the asset record in Firestore
  const asset: Asset = {
    id: assetId,
    storagePath,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    downloadUrl,
    createdAt: Timestamp.now(),
  };

  const assetRef = getAssetDoc(workspaceId, assetId);
  await setDoc(assetRef, asset);

  return asset;
}

// Get a single asset by ID
export async function getAsset(
  workspaceId: string,
  assetId: string
): Promise<Asset | null> {
  const assetRef = getAssetDoc(workspaceId, assetId);
  const snapshot = await getDoc(assetRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as Asset;
}

// Get all assets for a workspace
export async function getAssets(workspaceId: string): Promise<Asset[]> {
  const assetsRef = getAssetsCollection(workspaceId);
  const snapshot = await getDocs(assetsRef);

  return snapshot.docs.map((doc) => doc.data() as Asset);
}

// Delete an asset (both storage and Firestore record)
export async function deleteAsset(
  workspaceId: string,
  assetId: string
): Promise<void> {
  // Get the asset first to get the storage path
  const asset = await getAsset(workspaceId, assetId);

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Delete from Storage
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, asset.storagePath);

  try {
    await deleteObject(storageRef);
  } catch (error) {
    // If the file doesn't exist in storage, continue with Firestore deletion
    console.warn('Storage file not found, continuing with Firestore deletion:', error);
  }

  // Delete from Firestore
  const assetRef = getAssetDoc(workspaceId, assetId);
  await deleteDoc(assetRef);
}

// Get asset download URL (refreshes if needed)
export async function getAssetUrl(
  workspaceId: string,
  assetId: string
): Promise<string | null> {
  const asset = await getAsset(workspaceId, assetId);

  if (!asset) {
    return null;
  }

  // If we already have a download URL, return it
  if (asset.downloadUrl) {
    return asset.downloadUrl;
  }

  // Otherwise, get a fresh URL from storage
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, asset.storagePath);

  try {
    const downloadUrl = await getDownloadURL(storageRef);

    // Update the asset with the download URL
    const assetRef = getAssetDoc(workspaceId, assetId);
    await setDoc(assetRef, { downloadUrl }, { merge: true });

    return downloadUrl;
  } catch (error) {
    console.error('Error getting asset URL:', error);
    return null;
  }
}

// Validate file before upload
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File is too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
}

// Get file size formatted as string
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
