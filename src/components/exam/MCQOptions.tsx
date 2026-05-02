'use client';

import { cn } from '@/lib/utils';

interface MCQOption {
  value: string;
  label: string;
}

interface MCQOptionsProps {
  options: MCQOption[];
  selectedValue: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * MCQ Options Radio Button Component
 * Renders MCQ options as clickable rows with radio buttons
 */
export function MCQOptions({
  options,
  selectedValue,
  onChange,
  disabled = false,
}: MCQOptionsProps) {
  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const isSelected = selectedValue === option.value;
        const optionLetter = String.fromCharCode(65 + index); // A, B, C, D

        return (
          <div
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-4 transition-all cursor-pointer',
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white',
              !disabled && 'hover:bg-gray-50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Radio Circle */}
            <div className="flex-shrink-0">
              <div
                className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                  isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 bg-white'
                )}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
            </div>

            {/* Option Label */}
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  'font-medium',
                  isSelected ? 'text-blue-900' : 'text-gray-900'
                )}
              >
                <span className="font-semibold">{optionLetter}.</span>{' '}
                {option.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
