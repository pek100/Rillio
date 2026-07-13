// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Canonical Button + IconButton (foundation kit).
 *
 * Keeps the app's behavioral base verbatim - long-press (Pointer), Enter ->
 * synthetic click, mousedown-blur, the buttonClickPrevented / buttonBlurPrevented
 * nativeEvent escape hatches, polymorphic href -> <a>, forwardRef - and bolts on
 * cva variants + Radix Slot `asChild`. Rendered as a div/a (not a native <button>)
 * to preserve the selectPrevented / togglePopupPrevented bubbling contract the
 * cards and player chrome depend on.
 *
 * Focus is our inset solid outline (accent, negative outline-offset), NOT a
 * ring-offset. IconButton is ALWAYS an explicit square with flex centering
 * (`inline-flex size-N items-center justify-center rounded-full`) - never
 * padding-based, which renders ellipses.
 */

import React, { createElement, forwardRef, useCallback } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { LongPressEventType, useLongPress } from 'use-long-press';
import { cn } from './cn';

const NOOP = () => { /* no-op long-press fallback */ };

export const buttonVariants = cva(
    // Base: pill, flex-centered, inset accent focus outline (no ring-offset).
    'inline-flex items-center justify-center gap-2 cursor-pointer select-none whitespace-nowrap rounded-full text-sm font-semibold outline-none transition-[background-color,color,filter,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight [&.disabled]:pointer-events-none [&.disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                // Brand accent fill.
                default: 'bg-primary text-primary-foreground hover:brightness-110',
                // Bare glyph / text with neutral hover tint (accent = surface-hover).
                ghost: 'bg-transparent text-foreground hover:bg-accent',
                // Hairline outline, neutral hover tint.
                outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
                // Inline text link, brand colored.
                link: 'bg-transparent text-primary p-0 h-auto underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-12 px-6 text-base',
                icon: 'size-10 p-0',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

type ButtonBaseProps = {
    className?: string;
    style?: React.CSSProperties;
    href?: string;
    target?: string;
    download?: string;
    title?: string;
    disabled?: boolean;
    tabIndex?: number;
    asChild?: boolean;
    children?: React.ReactNode;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    onMouseDown?: (event: React.MouseEvent) => void;
    onMouseUp?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onLongPress?: () => void;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onDoubleClick?: () => void;
};

export type ButtonProps = ButtonBaseProps & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
    { className, variant, size, href, disabled, asChild, children, onLongPress, onDoubleClick, ...props },
    ref,
) {
    const longPress = useLongPress(onLongPress ?? NOOP, { detect: LongPressEventType.Pointer });

    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (typeof props.onKeyDown === 'function') {
            props.onKeyDown(event);
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            // @ts-expect-error: buttonClickPrevented is our nativeEvent escape hatch.
            if (!event.nativeEvent.buttonClickPrevented) {
                event.currentTarget.click();
            }
        }
    }, [props.onKeyDown]);

    const onMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (typeof props.onMouseDown === 'function') {
            props.onMouseDown(event);
        }
        // @ts-expect-error: buttonBlurPrevented is our nativeEvent escape hatch.
        if (!event.nativeEvent.buttonBlurPrevented) {
            event.preventDefault();
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    }, [props.onMouseDown]);

    const isLink = typeof href === 'string' && href.length > 0;
    // React.ElementType so createElement accepts the spread (href/anchor props on
    // <a>, arbitrary props forwarded through Slot.Root when asChild).
    const Comp: React.ElementType = asChild ? Slot.Root : (isLink ? 'a' : 'div');

    return createElement(
        Comp,
        {
            tabIndex: 0,
            ...props,
            ref,
            className: cn(buttonVariants({ variant, size }), className, { disabled }),
            href: isLink ? href : undefined,
            onKeyDown,
            onMouseDown,
            onDoubleClick,
            ...longPress(),
        },
        children,
    );
});

// Square dimensions for IconButton - static classes so Tailwind's JIT keeps them.
const iconButtonSize = {
    sm: 'size-8',
    default: 'size-10',
    lg: 'size-12',
} as const;

export type IconButtonProps = Omit<ButtonProps, 'size' | 'variant'> & {
    size?: keyof typeof iconButtonSize;
    variant?: 'ghost' | 'outline' | 'default';
};

/**
 * IconButton - the canonical bare-glyph button. Explicit square + flex centering +
 * rounded-full, never padding-based (that renders ellipses). Bare glyph sits at
 * ~60% opacity and lifts to full on hover with a neutral bg tint.
 */
export const IconButton = forwardRef<HTMLElement, IconButtonProps>(function IconButton(
    { className, size = 'default', variant = 'ghost', ...props },
    ref,
) {
    return (
        <Button
            ref={ref}
            variant={variant}
            className={cn(
                'inline-flex items-center justify-center rounded-full p-0',
                iconButtonSize[size],
                variant === 'ghost' && 'opacity-60 hover:opacity-100 hover:bg-accent',
                className,
            )}
            {...props}
        />
    );
});

export default Button;
