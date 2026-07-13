// Copyright (C) 2017-2024 Smart code 203358507

/**
 * ToggleGroup (foundation kit) - Radix ToggleGroup re-skinned to rounded-full pills.
 * `type=multiple` for filter chips (string[]), `type=single` for sort / preset picks.
 * Roving keyboard focus + pressed-state a11y replace the manual `selected.includes`
 * plumbing. Active items take a brand accent fill; for a sliding shared-layout thumb,
 * overlay a `motion` element carrying a layoutId (see motion.ts / pillHover) at the
 * call site. Wrap in HorizontalScroll where the row scrolls.
 */

import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const toggleItemVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium outline-none transition-[background-color,color,filter] ' +
        'text-fg-muted hover:text-fg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight ' +
        'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-(--icon-size) [&_svg]:shrink-0',
    {
        variants: {
            size: {
                sm: 'h-7 px-3',
                default: 'h-9 px-4',
                lg: 'h-11 px-5',
            },
        },
        defaultVariants: { size: 'default' },
    },
);

type ToggleGroupItemProps = ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleItemVariants>;

export const ToggleGroup = forwardRef<
    ElementRef<typeof ToggleGroupPrimitive.Root>,
    ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ className, ...props }, ref) {
    return <ToggleGroupPrimitive.Root ref={ref} className={cn('inline-flex items-center gap-1', className)} {...props} />;
});

export const ToggleGroupItem = forwardRef<ElementRef<typeof ToggleGroupPrimitive.Item>, ToggleGroupItemProps>(
    function ToggleGroupItem({ className, size, ...props }, ref) {
        return <ToggleGroupPrimitive.Item ref={ref} className={cn(toggleItemVariants({ size }), className)} {...props} />;
    },
);

export { toggleItemVariants };
export default ToggleGroup;
