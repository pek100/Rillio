// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Input (foundation kit) - a flat, borderless text input on a surface fill with an
 * inset accent outline on focus (not a ring-offset). Re-adds the app's ergonomics:
 * an `onSubmit` fired on Enter, and the hardcoded autoCorrect / autoCapitalize /
 * spellCheck-off defaults every text field in the app uses. Same forwardRef +
 * spread-props shape as the native input, so it drops into existing call sites.
 */

import React, { forwardRef, useCallback, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    /** Fired when Enter is pressed (after any onKeyDown). */
    onSubmit?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { className, type = 'text', onSubmit, onKeyDown, ...props },
    ref,
) {
    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (typeof onKeyDown === 'function') {
            onKeyDown(event);
        }
        if (event.key === 'Enter' && typeof onSubmit === 'function' && !event.defaultPrevented) {
            onSubmit(event);
        }
    }, [onKeyDown, onSubmit]);

    return (
        <input
            ref={ref}
            type={type}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={handleKeyDown}
            className={cn(
                'flex h-10 w-full rounded-card bg-surface-hover px-3 py-2 text-sm text-fg outline-none transition-colors',
                'placeholder:text-fg-subtle',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                className,
            )}
            {...props}
        />
    );
});

export default Input;
