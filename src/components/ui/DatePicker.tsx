'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

const baseInputStyles =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400';

const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
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
          type="date"
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

DatePicker.displayName = 'DatePicker';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  error?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
  error,
}: DateRangePickerProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          min={minDate}
          max={endDate || maxDate}
        />
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={startDate || minDate}
          max={maxDate}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
