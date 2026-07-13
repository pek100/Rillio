// Copyright (C) 2017-2026 Smart code 203358507

/**
 * EmptyState - the shared "branded empty illustration + label" block. One primitive for
 * every centered no-content / message state (Search, Discover, Library, MetaDetails,
 * NotFound, ...). The container / image-margin / label typography vary per surface, so
 * each is a merge-able className override on a common structure; an optional action slot
 * (children) renders below the label.
 */

import React from 'react';
import Image from 'rillio/components/Image';
import { cn } from 'rillio/components/ui/cn';

const EMPTY_IMAGE = require('/assets/images/empty.svg');

type Props = {
    label: React.ReactNode;
    src?: string;
    className?: string;
    imageClassName?: string;
    labelClassName?: string;
    children?: React.ReactNode;
};

const EmptyState = ({ label, src, className, imageClassName, labelClassName, children }: Props) => (
    <div className={cn('flex flex-col items-center', className)}>
        <Image
            className={cn('size-48 flex-none object-contain object-center opacity-90', imageClassName)}
            src={src ?? EMPTY_IMAGE}
            alt={' '}
        />
        <div className={cn('text-center', labelClassName)}>{label}</div>
        {children}
    </div>
);

export default EmptyState;
