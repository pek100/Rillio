// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Switch (foundation kit) - Radix Switch retokenized to our on/off look: neutral
 * track off, brand accent track on, foreground thumb, sized 3.2rem x 1.7rem to match
 * the legacy Toggle. Callers move from the old Button-props-controlled shape to
 * `checked` + `onCheckedChange`.
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';

export const Switch = forwardRef<
    ElementRef<typeof SwitchPrimitive.Root>,
    ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
    return (
        <SwitchPrimitive.Root
            ref={ref}
            className={cn(
                'peer inline-flex h-[1.7rem] w-[3.2rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-colors',
                'data-[state=unchecked]:bg-surface-hover data-[state=checked]:bg-primary',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                className={cn(
                    'pointer-events-none block size-[1.3rem] rounded-full bg-fg shadow-island transition-transform',
                    'data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[1.5rem] data-[state=checked]:bg-primary-foreground',
                )}
            />
        </SwitchPrimitive.Root>
    );
});

export default Switch;
