'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  showValue?: boolean;
  valueLabel?: string;
  marks?: Array<{ value: number; label: string }>;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      label,
      helperText,
      showValue = true,
      valueLabel,
      marks,
      value,
      min = 0,
      max = 100,
      ...props
    },
    ref
  ) => {
    const currentValue = Number(value) || Number(min);

    return (
      <div className="w-full">
        {(label || showValue) && (
          <div className="mb-2 flex items-center justify-between">
            {label && (
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {currentValue} {valueLabel}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          value={value}
          min={min}
          max={max}
          className={clsx(
            'h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700',
            '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:bg-primary-700',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:bg-primary-700',
            className
          )}
          {...props}
        />
        {marks && marks.length > 0 && (
          <div className="mt-1 flex justify-between px-1">
            {marks.map((mark) => (
              <span
                key={mark.value}
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                {mark.label}
              </span>
            ))}
          </div>
        )}
        {helperText && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Slider.displayName = 'Slider';
