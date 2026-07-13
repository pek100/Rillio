// Copyright (C) 2017-2024 Smart code 203358507

/**
 * RadioGroup (foundation kit) - Radix RadioGroup / RadioGroupItem with real grouping,
 * roving focus and arrow-key nav (the legacy per-item boolean hand-rolled these). Flat
 * ring with a brand accent dot when selected. Error state via `data-error`. The
 * URLsManager list becomes one group; standalone dots are a group-of-one.
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from './cn';

export const RadioGroup = forwardRef<
    ElementRef<typeof RadioGroupPrimitive.Root>,
    ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
    return <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />;
});

export const RadioGroupItem = forwardRef<
    ElementRef<typeof RadioGroupPrimitive.Item>,
    ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & { error?: boolean }
>(function RadioGroupItem({ className, error, ...props }, ref) {
    return (
        <RadioGroupPrimitive.Item
            ref={ref}
            data-error={error ? '' : undefined}
            className={cn(
                'aspect-square size-5 shrink-0 cursor-pointer rounded-full border border-border bg-transparent outline-none transition-colors',
                'data-[state=checked]:border-primary',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight',
                'disabled:cursor-not-allowed disabled:opacity-50 data-[error]:border-danger',
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                <span className="size-2.5 rounded-full bg-primary" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
});

export default RadioGroup;
