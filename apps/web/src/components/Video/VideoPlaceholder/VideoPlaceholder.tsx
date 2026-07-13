// Copyright (C) 2017-2025 Smart code 203358507

/**
 * VideoPlaceholder - skeleton row shown while an episode list loads. Clean-room
 * Tailwind; purely presentational.
 */

import React from 'react';
import { cn } from 'rillio/components/ui/cn';

type Props = {
    className?: string,
};

const VideoPlaceholder = ({ className }: Props) => {
    return (
        <div className={cn('flex flex-row items-center px-4 py-2', className)}>
            <div className="mx-4 my-2 flex h-12 flex-1 flex-col justify-between">
                <div className="h-[1.2rem] w-4/5 rounded-card bg-[var(--color-placeholder-background)]" />
                <div className="h-4 rounded-card bg-[var(--color-placeholder-background)]" />
            </div>
        </div>
    );
};

export default VideoPlaceholder;
