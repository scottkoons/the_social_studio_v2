'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { validateImageFile, formatFileSize } from '@/lib/services/assets';
import { Spinner } from '@/components/ui';

interface ImageUploadProps {
  imageUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function ImageUpload({
  imageUrl,
  onUpload,
  onRemove,
  disabled = false,
  className,
  compact = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isUploading, handleFile]
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
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading]);

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

  // Upload zone
  return (
    <div className={className}>
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
