'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadAsset,
  deleteAsset,
  validateImageFile,
} from '@/lib/services/assets';
import { updatePostImage } from '@/lib/services/posts';
import type { Asset } from '@/types';

interface UseAssetUploadReturn {
  uploading: boolean;
  progress: number;
  error: string | null;
  uploadImage: (file: File, postDate?: string) => Promise<Asset | null>;
  removeImage: (assetId: string, postDate?: string) => Promise<void>;
  clearError: () => void;
}

export function useAssetUpload(): UseAssetUploadReturn {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const uploadImage = useCallback(
    async (file: File, postDate?: string): Promise<Asset | null> => {
      if (!user) {
        setError('You must be logged in to upload images');
        return null;
      }

      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return null;
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        // Simulate progress (Firebase doesn't provide upload progress for uploadBytes)
        setProgress(30);

        const asset = await uploadAsset(user.uid, file);

        setProgress(80);

        // If postDate is provided, link the asset to the post
        if (postDate) {
          await updatePostImage(user.uid, postDate, asset.id, asset.downloadUrl);
        }

        setProgress(100);
        return asset;
      } catch (err) {
        console.error('Error uploading image:', err);
        setError('Failed to upload image. Please try again.');
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [user]
  );

  const removeImage = useCallback(
    async (assetId: string, postDate?: string): Promise<void> => {
      if (!user) {
        setError('You must be logged in to remove images');
        return;
      }

      setError(null);

      try {
        // If postDate is provided, unlink the asset from the post first
        if (postDate) {
          await updatePostImage(user.uid, postDate, undefined, undefined);
        }

        // Delete the asset
        await deleteAsset(user.uid, assetId);
      } catch (err) {
        console.error('Error removing image:', err);
        setError('Failed to remove image. Please try again.');
      }
    },
    [user]
  );

  return {
    uploading,
    progress,
    error,
    uploadImage,
    removeImage,
    clearError,
  };
}
