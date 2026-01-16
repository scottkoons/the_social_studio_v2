'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

const baseInputStyles =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400';

const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="time"
          id={inputId}
          className={clsx(baseInputStyles, error && errorStyles, className)}
          {...props}
        />
        {(error || helperText) && (
          <p
            className={clsx(
              'mt-1.5 text-sm',
              error ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';

/**
 * Format 24-hour time to 12-hour display
 */
export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format 12-hour time to 24-hour
 */
export function formatTime24Hour(time12: string): string {
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return time12;

  let [, hours, minutes, period] = match;
  let h = parseInt(hours, 10);

  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;

  return `${h.toString().padStart(2, '0')}:${minutes}`;
}
