// Copyright (C) 2017-2026 Smart code 203358507

/**
 * The skip-intro/outro pill. Appears while the playhead is inside a known
 * segment (see skipIntro/) and seeks past it on click - manual, Netflix-style;
 * nothing is ever skipped without the user asking.
 *
 * Deliberately NOT tagged player-immersion-fade: the whole point is being
 * clickable while the chrome has faded out mid-intro. Same right alignment and
 * control-bar clearance as the player menus (MENU_LAYER), so it never sits on
 * the seek bar. Player-glass family material: black-alpha + blur, never a
 * white lift over video.
 */

import React from 'react';
import { Button } from 'rillio/components/ui/button';
import { skipLabel, type SkipSegment } from '../skipIntro';

type Props = {
    segment: SkipSegment;
    onSkip: (segment: SkipSegment) => void;
};

const SkipPill = ({ segment, onSkip }: Props) => {
    return (
        <Button
            variant="ghost"
            title={skipLabel(segment.kind)}
            onClick={() => onSkip(segment)}
            className={'absolute bottom-(--player-chrome-clearance) right-16 z-0 h-9 rounded-full border border-line bg-glass-panel px-4 text-sm font-semibold text-ice backdrop-blur-(--glass-blur) duration-200 animate-in fade-in slide-in-from-bottom-2 hover:bg-white/10'}
        >
            {skipLabel(segment.kind)}
        </Button>
    );
};

export default SkipPill;
