// Copyright (C) 2017-2024 Smart code 203358507

/**
 * NumberStepper (foundation kit) - the ONE custom numeric stepper, built on the
 * kit IconButton. shadcn has no number primitive and the react-aria field would add
 * a dep and change contracts, so this is deliberately custom (per decisions.md #2).
 *
 * Covers: clamp-to-range, controlled OR uncontrolled, an optional inline label, and
 * optional press-and-hold repeat (250ms delay, then 100ms interval - the player
 * Stepper cadence). Keyboard: ArrowUp/ArrowDown step, Enter submits.
 *
 * Dual onChange contract so every legacy call site is preserved:
 *  - onValueChange(value: number)                       // the plain contract
 *  - onChange({ target: { value: string } })            // NumberInput's synthetic event
 * Both fire together; callers subscribe to whichever they already expect.
 */

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '@stremio/stremio-icons/react';
import { cn } from './cn';
import { IconButton } from './button';

const HOLD_DELAY_MS = 250;
const HOLD_INTERVAL_MS = 100;

export type NumberStepperProps = {
    value?: number;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    /** Optional inline label rendered before the value. */
    label?: ReactNode;
    /** Optional unit / suffix rendered after the value (e.g. "s", "%"). */
    unit?: ReactNode;
    /** Enable press-and-hold auto-repeat on the +/- buttons. */
    holdRepeat?: boolean;
    className?: string;
    valueClassName?: string;
    'aria-label'?: string;
    onValueChange?: (value: number) => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (value: number) => void;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function NumberStepper({
    value: controlledValue,
    defaultValue = 0,
    min = -Infinity,
    max = Infinity,
    step = 1,
    disabled = false,
    label,
    unit,
    holdRepeat = false,
    className,
    valueClassName,
    'aria-label': ariaLabel,
    onValueChange,
    onChange,
    onSubmit,
}: NumberStepperProps) {
    const isControlled = controlledValue != null;
    const [uncontrolled, setUncontrolled] = useState<number>(clamp(defaultValue, min, max));
    const value = clamp(isControlled ? controlledValue! : uncontrolled, min, max);

    const holdTimeout = useRef<ReturnType<typeof setTimeout>>();
    const holdInterval = useRef<ReturnType<typeof setInterval>>();
    // Live ref so the repeat loop always reads the latest committed value.
    const valueRef = useRef(value);
    valueRef.current = value;

    const commit = useCallback((next: number) => {
        const clamped = clamp(next, min, max);
        if (clamped === valueRef.current) return;
        valueRef.current = clamped;
        if (!isControlled) setUncontrolled(clamped);
        onValueChange?.(clamped);
        onChange?.({ target: { value: String(clamped) } });
    }, [isControlled, min, max, onValueChange, onChange]);

    const stepBy = useCallback((direction: 1 | -1) => {
        commit(valueRef.current + direction * step);
    }, [commit, step]);

    const clearHold = useCallback(() => {
        clearTimeout(holdTimeout.current);
        clearInterval(holdInterval.current);
    }, []);

    const startHold = useCallback((direction: 1 | -1) => {
        if (!holdRepeat || disabled) return;
        clearHold();
        holdTimeout.current = setTimeout(() => {
            holdInterval.current = setInterval(() => stepBy(direction), HOLD_INTERVAL_MS);
        }, HOLD_DELAY_MS);
    }, [holdRepeat, disabled, clearHold, stepBy]);

    useEffect(() => clearHold, [clearHold]);

    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            stepBy(1);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            stepBy(-1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit?.(valueRef.current);
        }
    }, [disabled, stepBy, onSubmit]);

    return (
        <div
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={min === -Infinity ? undefined : min}
            aria-valuemax={max === Infinity ? undefined : max}
            aria-label={ariaLabel}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={onKeyDown}
            className={cn(
                'inline-flex items-center gap-2 rounded-full bg-surface-hover px-1.5 py-1 outline-none',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight',
                disabled && 'pointer-events-none opacity-50',
                className,
            )}
        >
            {label != null ? <span className="pl-2 text-sm text-fg-muted">{label}</span> : null}
            <IconButton
                size="sm"
                tabIndex={-1}
                disabled={disabled || value <= min}
                aria-label="Decrease"
                onClick={() => stepBy(-1)}
                onMouseDown={() => startHold(-1)}
                onMouseUp={clearHold}
                onMouseLeave={clearHold}
            >
                <Icon name="remove" className="size-4" />
            </IconButton>
            <span className={cn('min-w-8 text-center text-sm tabular-nums text-fg', valueClassName)}>
                {value}{unit != null ? <span className="text-fg-muted">{unit}</span> : null}
            </span>
            <IconButton
                size="sm"
                tabIndex={-1}
                disabled={disabled || value >= max}
                aria-label="Increase"
                onClick={() => stepBy(1)}
                onMouseDown={() => startHold(1)}
                onMouseUp={clearHold}
                onMouseLeave={clearHold}
            >
                <Icon name="add" className="size-4" />
            </IconButton>
        </div>
    );
}

export default NumberStepper;
