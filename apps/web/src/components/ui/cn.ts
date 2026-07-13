// Copyright (C) 2017-2024 Smart code 203358507

/**
 * cn() - the class merge helper for the Phase 2 foundation kit.
 *
 * twMerge(clsx(...)), with tailwind-merge taught about our custom design tokens so
 * it never silently drops or mis-dedupes them. tailwind-merge v3 tracks Tailwind v4
 * theme namespaces: extending `radius` teaches it our `rounded-card/-squircle/-pill`
 * utilities (so they dedupe against `rounded-full` etc. in the ONE rounded group),
 * and extending `color` teaches it every semantic `--color-*` token name (so
 * `bg-surface-hover`, `text-fg-muted`, `border-border`, `ring-ring`, `bg-primary`,
 * ... are recognised across all color utilities: bg / text / border / ring / ...).
 */

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            // Custom border-radius scale from @theme static in styles/tailwind.css.
            radius: ['card', 'squircle', 'pill'],
            // Every semantic color token: the base palette plus the shadcn bridge
            // aliases. Listed as bare names (the segment after bg-/text-/border-/...).
            color: [
                // base palette
                'bg', 'surface', 'surface-hover', 'line',
                'accent', 'accent-soft', 'highlight',
                'fg', 'fg-muted', 'fg-subtle',
                'ice', 'ice-muted',
                'success', 'warning', 'danger',
                // shadcn bridge aliases
                'background', 'foreground',
                'card', 'card-foreground',
                'popover', 'popover-foreground',
                'primary', 'primary-foreground',
                'secondary', 'secondary-foreground',
                'muted', 'muted-foreground',
                'accent-foreground',
                'destructive', 'destructive-foreground',
                'border', 'input', 'ring',
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export default cn;
