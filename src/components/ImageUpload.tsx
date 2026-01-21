'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { validateImageFile } from '@/lib/services/assets';
import { Spinner } from '@/components/ui';

interface ImageUploadProps {
  imageUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onUrlSubmit?: (url: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function ImageUpload({
  imageUrl,
  onUpload,
  onUrlSubmit,
  onRemove,
  disabled = false,
  className,
  compact = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        await onUpload(file);
      } catch (err) {
        console.error('Upload error:', err);
        setError('Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!onUrlSubmit || !urlValue.trim()) return;

    // Basic URL validation
    const trimmedUrl = urlValue.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    // Check for common image extensions or accept any URL
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(trimmedUrl);
    if (!hasImageExtension) {
      // Allow anyway but warn - many image URLs don't have extensions
      console.log('URL may not be an image, proceeding anyway');
    }

    setError(null);
    setIsUploading(true);

    try {
      await onUrlSubmit(trimmedUrl);
      setUrlValue('');
      setShowUrlInput(false);
    } catch (err) {
      console.error('URL submit error:', err);
      setError('Failed to set image URL');
    } finally {
      setIsUploading(false);
    }
  }, [onUrlSubmit, urlValue]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      // Check if it's a file drop
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
        return;
      }

      // Check if it's a URL drop (e.g., dragging an image from browser)
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (url && onUrlSubmit && (url.startsWith('http://') || url.startsWith('https://'))) {
        setUrlValue(url);
        setShowUrlInput(true);
        // Auto-submit the URL
        setTimeout(() => {
          handleUrlSubmit();
        }, 100);
      }
    },
    [disabled, isUploading, handleFile, onUrlSubmit, handleUrlSubmit]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && !showUrlInput) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading, showUrlInput]);

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        setIsUploading(true);
        try {
          await onRemove();
        } catch (err) {
          console.error('Remove error:', err);
          setError('Failed to remove image');
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onRemove]
  );

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUrlSubmit();
      } else if (e.key === 'Escape') {
        setShowUrlInput(false);
        setUrlValue('');
        setError(null);
      }
    },
    [handleUrlSubmit]
  );

  const toggleUrlInput = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUrlInput((prev) => !prev);
    setError(null);
    if (!showUrlInput) {
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [showUrlInput]);

  // If we have an image, show preview
  if (imageUrl) {
    return (
      <div className={clsx('relative group', className)}>
        <div
          className={clsx(
            'relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800',
            compact ? 'h-16 w-16' : 'h-32 w-32'
          )}
        >
          <Image
            src={imageUrl}
            alt="Post image"
            fill
            className="object-cover"
            sizes={compact ? '64px' : '128px'}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Spinner size="sm" className="text-white" />
            </div>
          )}
        </div>
        {onRemove && !disabled && !isUploading && (
          <button
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
            title="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Upload zone with URL input option
  return (
    <div className={className}>
      {showUrlInput ? (
        // URL Input Mode
        <div className={clsx('flex flex-col gap-2', compact ? 'w-48' : 'w-64')}>
          <div className="flex gap-1">
            <input
              ref={urlInputRef}
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="Paste image URL..."
              disabled={isUploading}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim() || isUploading}
              className="rounded-lg bg-primary-500 px-2 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <Spinner size="sm" /> : 'Go'}
            </button>
          </div>
          <button
            onClick={toggleUrlInput}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        // File Upload Mode
        <div className="flex items-center gap-2">
          <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={clsx(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
              compact ? 'h-16 w-16 p-2' : 'h-32 w-32 p-4',
              isDragging
                ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
              (disabled || isUploading) && 'cursor-not-allowed opacity-50'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleInputChange}
              className="hidden"
              disabled={disabled || isUploading}
            />
            {isUploading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <ImageIcon className={clsx('text-gray-400', compact ? 'h-5 w-5' : 'h-8 w-8')} />
                {!compact && (
                  <span className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    Drop image or click
                  </span>
                )}
              </>
            )}
          </div>
          {onUrlSubmit && (
            <button
              onClick={toggleUrlInput}
              disabled={disabled || isUploading}
              className={clsx(
                'flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300',
                compact ? 'h-16 w-8 p-1' : 'h-32 w-10 p-2',
                (disabled || isUploading) && 'cursor-not-allowed opacity-50'
              )}
              title="Paste image URL"
            >
              <LinkIcon className={clsx(compact ? 'h-4 w-4' : 'h-5 w-5')} />
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}
