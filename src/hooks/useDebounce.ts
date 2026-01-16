'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to debounce a callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): [(...args: Parameters<T>) => void, () => void] {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [debouncedCallback, cancel];
}

/**
 * Hook for auto-save with debouncing
 */
export function useAutoSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  delay: number = 1000
): { isSaving: boolean; error: Error | null } {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousValueRef = useRef<T>(value);
  const isFirstRender = useRef(true);

  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Skip if value hasn't changed
    if (debouncedValue === previousValueRef.current) {
      return;
    }

    previousValueRef.current = debouncedValue;

    const doSave = async () => {
      setIsSaving(true);
      setError(null);

      try {
        await save(debouncedValue);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsSaving(false);
      }
    };

    doSave();
  }, [debouncedValue, save]);

  return { isSaving, error };
}
