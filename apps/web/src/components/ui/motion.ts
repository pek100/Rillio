// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Motion vocabulary for the foundation kit.
 *
 * CSS-first philosophy: reach for tw-animate-css (`animate-in`, `fade-*`, `zoom-*`,
 * `slide-*`) for the common enter/exit cases. `motion` is reserved for the few
 * genuine needs: shared-layout sliding indicators (`layoutId`), gesture / drag, and
 * scroll-linked animation. Import `motion` from `motion/react` only in the parts
 * that need it, and wrap a subtree in <LazyMotionProvider> so the ~15kb
 * `domAnimation` feature bundle loads lazily (add `domMax` locally where drag /
 * shared-layout is used).
 *
 * The easings mirror the two reused tokens in @theme static (--ease-smooth /
 * --ease-spring) as cubic-bezier arrays so `motion` and CSS stay in lockstep.
 */

import { createElement, type ReactNode } from 'react';
import { LazyMotion, domAnimation, domMax, type Variants } from 'motion/react';

// Durations (seconds, for `motion`) with millisecond twins (for CSS/timeouts).
export const DURATION = {
    instant: 0.1,
    fast: 0.15,
    base: 0.2,
    slow: 0.3,
    slower: 0.45,
} as const;

export const DURATION_MS = {
    instant: 100,
    fast: 150,
    base: 200,
    slow: 300,
    slower: 450,
} as const;

// Easings - cubic-bezier arrays matching --ease-smooth / --ease-spring, plus the
// two standard CSS easings for completeness.
export const EASE = {
    smooth: [0.22, 1, 0.36, 1] as const, // --ease-smooth
    spring: [0.34, 1.56, 0.64, 1] as const, // --ease-spring (slight overshoot)
    out: [0, 0, 0.2, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
} as const;

// Named variant presets shared across the kit. Consumed as `variants={fade}` with
// initial="hidden" animate="visible" exit="hidden".
export const fade: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.smooth } },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE.smooth } },
};

export const slideUp: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.smooth } },
};

// Reusable transition for shared-layout pill indicators (TopNav tabs, ToggleGroup,
// Settings menu). Apply to the `motion` element that carries the shared layoutId.
export const pillHover = {
    type: 'spring' as const,
    stiffness: 380,
    damping: 30,
};

/**
 * LazyMotionProvider - wrap a subtree so `motion` features load lazily.
 * Defaults to `domAnimation` (~15kb: animations + variants + exit + gestures). Pass
 * `full` where drag or shared-layout (`layoutId` across siblings) is needed, which
 * swaps in `domMax`. `strict` forbids the full <motion.*> API inside, nudging every
 * consumer onto the lazy `<m.*>` components.
 */
export function LazyMotionProvider({ children, full = false }: { children: ReactNode; full?: boolean }) {
    return createElement(LazyMotion, { features: full ? domMax : domAnimation, strict: true }, children);
}

export { domAnimation, domMax };
export type { Variants };
