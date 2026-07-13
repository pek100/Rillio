// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Command (foundation kit) - cmdk command palette, re-skinned to our surface tokens.
 * CommandInput / Group-heading / Item / Empty map 1:1 to the SearchModal's search
 * field / History+Suggestions / rows / empty state and add the keyboard nav it lacks.
 * The SearchModal keeps its custom createPortal + un-animated backdrop-blur backdrop
 * and is opened from the URL (not TopNav internal state); this primitive is the inner
 * list machinery only.
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import Icon from '@stremio/stremio-icons/react';
import { cn } from './cn';
import { Dialog, DialogContent } from './dialog';

export const Command = forwardRef<
    ElementRef<typeof CommandPrimitive>,
    ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
    return (
        <CommandPrimitive
            ref={ref}
            className={cn('flex h-full w-full flex-col overflow-hidden rounded-card bg-popover text-popover-foreground', className)}
            {...props}
        />
    );
});

export function CommandDialog({ children, ...props }: ComponentPropsWithoutRef<typeof Dialog>) {
    return (
        <Dialog {...props}>
            <DialogContent showClose={false} className="overflow-hidden p-0">
                <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-fg-muted [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5">
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    );
}

export const CommandInput = forwardRef<
    ElementRef<typeof CommandPrimitive.Input>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
    return (
        <div className="flex items-center gap-2 px-3" cmdk-input-wrapper="">
            <Icon name="search" className="size-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
                ref={ref}
                className={cn(
                    'flex h-11 w-full bg-transparent py-3 text-sm text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50',
                    className,
                )}
                {...props}
            />
        </div>
    );
});

export const CommandList = forwardRef<
    ElementRef<typeof CommandPrimitive.List>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
    return <CommandPrimitive.List ref={ref} className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden p-1', className)} {...props} />;
});

export const CommandEmpty = forwardRef<
    ElementRef<typeof CommandPrimitive.Empty>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty(props, ref) {
    return <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm text-fg-muted" {...props} />;
});

export const CommandGroup = forwardRef<
    ElementRef<typeof CommandPrimitive.Group>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
    return (
        <CommandPrimitive.Group
            ref={ref}
            className={cn(
                'overflow-hidden p-1 text-fg [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-fg-muted',
                className,
            )}
            {...props}
        />
    );
});

export const CommandSeparator = forwardRef<
    ElementRef<typeof CommandPrimitive.Separator>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
    return <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 h-px bg-border', className)} {...props} />;
});

export const CommandItem = forwardRef<
    ElementRef<typeof CommandPrimitive.Item>,
    ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
    return (
        <CommandPrimitive.Item
            ref={ref}
            className={cn(
                'relative flex cursor-pointer select-none items-center gap-2 rounded-[calc(var(--radius-card)-0.25rem)] px-2 py-1.5 text-sm outline-none',
                'data-[selected=true]:bg-surface-hover data-[selected=true]:text-fg data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
                className,
            )}
            {...props}
        />
    );
});

export function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return <span className={cn('ml-auto text-xs tracking-widest text-fg-subtle', className)} {...props} />;
}

export default Command;
