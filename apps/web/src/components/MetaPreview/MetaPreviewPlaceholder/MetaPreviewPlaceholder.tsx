// Copyright (C) 2017-2025 Smart code 203358507

/**
 * MetaPreviewPlaceholder - skeleton logo / duration / genre blocks shown while the
 * meta hero loads. Clean-room Tailwind; purely presentational.
 */

import React from 'react';
import { cn } from 'rillio/components/ui/cn';

type Props = {
    className?: string,
};

const skeleton = 'rounded-card bg-[var(--color-placeholder-background)]';

const MetaPreviewPlaceholder = ({ className }: Props) => {
    return (
        <div className={cn('flex flex-col', className)}>
            <div className="flex-1 self-stretch">
                <div className={cn('h-32 w-80 max-w-full', skeleton)} />
                <div className="my-4 flex flex-row flex-wrap">
                    <div className={cn('mr-4 h-[1.4rem] basis-20', skeleton)} />
                    <div className={cn('h-[1.4rem] basis-20', skeleton)} />
                </div>
                {
                    [0, 1, 2].map((index) => (
                        <div key={index} className="my-4">
                            <div className={cn('h-[1.6rem] w-[6.5rem] max-w-full', skeleton)} />
                            <div className={cn('mt-[0.2rem] h-[1.2rem] w-40 max-w-full', skeleton)} />
                        </div>
                    ))
                }
            </div>
            <div className="mb-4 flex h-16 flex-row flex-wrap rounded-full bg-[var(--color-placeholder-background)]" />
        </div>
    );
};

export default MetaPreviewPlaceholder;
