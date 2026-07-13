// Copyright (C) 2017-2025 Smart code 203358507

/**
 * ActionsGroup - a horizontal segmented pill of icon buttons (library / watched /
 * share / ratings). Clean-room Tailwind rewrite: one flat `--overlay-color` pill,
 * backdrop-blurred, with fixed-square focusable cells (never padding-sized) whose
 * glyphs sit at 0.7 opacity and lift to full on hover / focus. The `size` prop
 * replaces the old cross-component LESS `:import` that shrank the group inside
 * MetaPreview. Tooltips come from the foundation-kit Radix Tooltip.
 */

import React from 'react';
import Icon from '@stremio/stremio-icons/react';
import { cn } from 'rillio/components/ui/cn';
import { Tooltip } from 'rillio/components/ui/tooltip';

type Item = {
    icon: string;
    label?: string;
    filled?: string;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
};

type Props = {
    items: Item[];
    className?: string;
    /** `default` = 4rem hero pill; `sm` = 2.5rem row pill (MetaPreview meta-actions). */
    size?: 'default' | 'sm';
};

const containerSize = {
    default: 'h-16 max-sm:h-12',
    sm: 'h-10',
} as const;

const cellSize = {
    default: 'size-16 max-sm:size-12',
    sm: 'h-10 w-11',
} as const;

const iconSize = {
    default: 'size-8 max-sm:size-7',
    sm: 'size-[1.15rem]',
} as const;

const ActionsGroup = ({ items, className, size = 'default' }: Props) => {
    return (
        <div
            className={cn(
                'flex w-fit flex-row items-center justify-start rounded-full bg-[var(--overlay-color)] backdrop-blur-[5px]',
                containerSize[size],
                className,
            )}
        >
            {
                items.map((item, index) => (
                    <Tooltip key={index} label={item.label} side="top">
                        <div
                            className={cn(
                                'group flex cursor-pointer items-center justify-center rounded-full outline-none',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight',
                                cellSize[size],
                                item.disabled && 'pointer-events-none',
                                item.className,
                            )}
                            tabIndex={0}
                            onClick={item.disabled ? undefined : item.onClick}
                        >
                            <Icon
                                name={item.icon}
                                className={cn(
                                    'text-fg opacity-70 transition-opacity duration-150',
                                    'group-hover:opacity-100 group-focus:opacity-100',
                                    iconSize[size],
                                )}
                            />
                        </div>
                    </Tooltip>
                ))
            }
        </div>
    );
};

export default ActionsGroup;
