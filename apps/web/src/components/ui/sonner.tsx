// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Toaster (foundation kit) - the single Sonner <Toaster/> mounted once at app root.
 * Sonner is shadcn's current toast (the old Radix Toast is deprecated). Re-skinned to
 * our flat surface tokens; the imperative `toast()` API is wrapped by the useToast
 * adapter (see use-toast.tsx) so no existing call site changes.
 */

import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { cn } from './cn';

export function Toaster({ className, toastOptions, ...props }: ToasterProps) {
    return (
        <Sonner
            theme="dark"
            position="bottom-right"
            className={cn('toaster group', className)}
            toastOptions={{
                ...toastOptions,
                classNames: {
                    // Floating glass toast (same family as menus/tooltip): black-alpha
                    // bg-popover + backdrop-blur-md + border-line hairline.
                    toast: 'group glass rounded-card bg-popover text-fg backdrop-blur-(--glass-blur)',
                    title: 'text-sm font-semibold',
                    description: 'text-xs text-fg-muted',
                    actionButton: 'rounded-full bg-primary text-primary-foreground',
                    cancelButton: 'rounded-full bg-surface text-fg-muted',
                    closeButton: 'bg-surface-hover text-fg-muted',
                    ...toastOptions?.classNames,
                },
            }}
            {...props}
        />
    );
}

export default Toaster;
