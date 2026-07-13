// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import { Download, X } from 'lucide-react';

// Bottom-right prompt offering to preload the next episode into the cache.
// A small translucent chip (Michael's reference: YouTube's "Includes paid
// promotion" pill), not a toast card: one line, low-opacity black + blur,
// the whole chip is the accept action, a tiny x dismisses. It is PART of the
// immersion layer (player-immersion-fade): when the controls overlay hides,
// the chip fades with it; any activity that wakes the chrome brings it back
// for as long as its prompt window is open.

type Props = {
    onAccept?: React.MouseEventHandler<HTMLButtonElement>;
    onDismiss?: React.MouseEventHandler<HTMLButtonElement>;
    onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
    onMouseOver?: React.MouseEventHandler<HTMLDivElement>;
};

const NextEpisodePreloadPrompt = ({ onAccept, onDismiss, onMouseMove, onMouseOver }: Props) => {
    return (
        <div
            className={'player-immersion-fade absolute bottom-28 right-6 z-10 flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-md'}
            onMouseMove={onMouseMove}
            onMouseOver={onMouseOver}
        >
            <button
                type={'button'}
                onClick={onAccept}
                title={'Preload the next episode into the cache. You can turn this off for all series in Settings.'}
                className={'inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-full pl-3 pr-2 text-sm font-medium text-ice transition-colors duration-150 hover:bg-white/10 hover:text-white'}
            >
                <Download className={'size-(--icon-size-sm)'} />
                Preload next episode
            </button>
            <button
                type={'button'}
                onClick={onDismiss}
                title={'Not this time'}
                aria-label={'Dismiss'}
                className={'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ice-muted transition-colors duration-150 hover:bg-white/10 hover:text-white'}
            >
                <X className={'size-(--icon-size-sm)'} />
            </button>
        </div>
    );
};

export default NextEpisodePreloadPrompt;
