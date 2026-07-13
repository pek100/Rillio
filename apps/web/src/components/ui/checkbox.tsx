// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Checkbox (foundation kit) - Radix Checkbox with a lucide checkmark glyph. Flat
 * square with a hairline at rest, brand accent fill when checked. Error state via a
 * `data-error` attribute (rendered in --color-danger). Call sites wrap this to keep
 * the app's rich {type,checked,reactEvent,nativeEvent} payload and label+inline-link
 * row; the primitive itself speaks Radix's onCheckedChange(boolean).
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from './cn';

export const Checkbox = forwardRef<
    ElementRef<typeof CheckboxPrimitive.Root>,
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { error?: boolean }
>(function Checkbox({ className, error, ...props }, ref) {
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            data-error={error ? '' : undefined}
            className={cn(
                'peer size-5 shrink-0 cursor-pointer rounded-[0.35rem] border border-border bg-transparent outline-none transition-colors',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'data-[error]:border-danger',
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center">
                <Check className="size-4" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});

export default Checkbox;
