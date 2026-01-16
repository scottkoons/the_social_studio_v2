'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { clsx } from 'clsx';

interface HashtagInputProps {
  hashtags: string[];
  onChange: (hashtags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function HashtagInput({
  hashtags,
  onChange,
  placeholder = 'Add hashtag...',
  disabled = false,
  className,
}: HashtagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addHashtag = useCallback(
    (tag: string) => {
      // Clean up the tag
      let cleaned = tag.trim().toLowerCase();
      if (!cleaned.startsWith('#')) {
        cleaned = `#${cleaned}`;
      }
      // Remove any spaces or special characters
      cleaned = cleaned.replace(/[^#\w]/g, '');

      if (cleaned.length > 1 && !hashtags.includes(cleaned)) {
        onChange([...hashtags, cleaned]);
      }
      setInputValue('');
    },
    [hashtags, onChange]
  );

  const removeHashtag = useCallback(
    (index: number) => {
      const newHashtags = [...hashtags];
      newHashtags.splice(index, 1);
      onChange(newHashtags);
    },
    [hashtags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        e.preventDefault();
        if (inputValue.trim()) {
          addHashtag(inputValue);
        }
      } else if (e.key === 'Backspace' && !inputValue && hashtags.length > 0) {
        removeHashtag(hashtags.length - 1);
      }
    },
    [inputValue, hashtags, addHashtag, removeHashtag]
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addHashtag(inputValue);
    }
  }, [inputValue, addHashtag]);

  return (
    <div className={clsx('w-full', className)}>
      <div
        className={clsx(
          'flex flex-wrap gap-1.5 rounded-lg border border-gray-300 bg-white p-2 transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {hashtags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeHashtag(index)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={hashtags.length === 0 ? placeholder : ''}
            className="min-w-[100px] flex-1 border-0 bg-transparent p-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-gray-500"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press Enter, comma, or space to add
      </p>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
