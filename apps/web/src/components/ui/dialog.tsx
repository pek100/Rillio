// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Dialog primitives + the ModalRoute shell (foundation kit).
 *
 * Radix Dialog gives focus-trap, Escape, scroll-lock, outside-click and aria for
 * free. ModalRoute is the wrapper the bus-driven modals (Settings/Cached) and every
 * domain modal (AddonDetails/Event/SharePrompt) compose on: fully CONTROLLED open
 * (driven by the caller's state, never DialogTrigger), a suspense-friendly body, and
 * a per-modal size via className. The overlay is our blur(24px) + rgba(0,0,0,.6)
 * scrim so the view beneath stays visible-but-blurred.
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
    ElementRef<typeof DialogPrimitive.Overlay>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
    return (
        <DialogPrimitive.Overlay
            ref={ref}
            className={cn(
                'fixed inset-0 z-50 bg-black/60 backdrop-blur-(--scrim-blur)',
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                className,
            )}
            {...props}
        />
    );
});

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    overlayClassName?: string;
};

export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
    function DialogContent({ className, children, showClose = true, overlayClassName, ...props }, ref) {
        return (
            <DialogPortal>
                <DialogOverlay className={overlayClassName} />
                <DialogPrimitive.Content
                    ref={ref}
                    className={cn(
                        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4',
                        // Dark translucent panel; the blur comes from the overlay, so NO
                        // backdrop-blur here (one blur per stacking context). The
                        // border-line hairline crisps the edge over the scrim.
                        'bg-card text-card-foreground rounded-squircle border border-line p-6 shadow-elevated',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                        'focus:outline-none',
                        className,
                    )}
                    {...props}
                >
                    {children}
                    {showClose ? (
                        <DialogPrimitive.Close
                            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-fg-muted opacity-70 outline-none transition hover:bg-surface-hover hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight"
                            aria-label="Close"
                        >
                            <X className="size-4" />
                        </DialogPrimitive.Close>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPortal>
        );
    },
);

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export const DialogTitle = forwardRef<
    ElementRef<typeof DialogPrimitive.Title>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cn('text-lg font-bold leading-tight', className)} {...props} />;
});

export const DialogDescription = forwardRef<
    ElementRef<typeof DialogPrimitive.Description>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cn('text-sm text-fg-muted', className)} {...props} />;
});

/**
 * ModalRoute - the controlled modal shell for the app's modals.
 *
 * `open` and `onClose` come from the caller (the modal bus, or domain state); no
 * DialogTrigger is ever rendered. `size` picks a max-width preset, or pass
 * `className` for a bespoke width. `title`/`description` are announced to screen
 * readers (visually hidden when not shown). Children can suspend - keep the fallback
 * an empty DialogContent so the frame is painted while the route resolves.
 */
const modalSize = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[min(96vw,80rem)]',
} as const;

export type ModalRouteProps = {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    size?: keyof typeof modalSize;
    className?: string;
    overlayClassName?: string;
    showClose?: boolean;
    title?: ReactNode;
    description?: ReactNode;
    /** Visually hide the title/description but keep them for screen readers. */
    hideHeader?: boolean;
    'aria-label'?: string;
};

export function ModalRoute({
    open,
    onClose,
    children,
    size = 'md',
    className,
    overlayClassName,
    showClose = true,
    title,
    description,
    hideHeader = false,
    'aria-label': ariaLabel,
}: ModalRouteProps) {
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                showClose={showClose}
                overlayClassName={overlayClassName}
                aria-label={!title ? ariaLabel : undefined}
                className={cn(modalSize[size], className)}
            >
                {title != null ? (
                    hideHeader ? (
                        <DialogTitle className="sr-only">{title}</DialogTitle>
                    ) : (
                        <DialogTitle>{title}</DialogTitle>
                    )
                ) : null}
                {description != null ? (
                    hideHeader ? (
                        <DialogDescription className="sr-only">{description}</DialogDescription>
                    ) : (
                        <DialogDescription>{description}</DialogDescription>
                    )
                ) : null}
                {children}
            </DialogContent>
        </Dialog>
    );
}

export default Dialog;
