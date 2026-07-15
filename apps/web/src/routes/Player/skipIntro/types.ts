// Copyright (C) 2017-2026 Smart code 203358507

// Skip-segment model shared by every source (AniSkip / TheIntroDB / chapters).
// Seconds everywhere INSIDE this lib (the external APIs speak seconds); the
// player bridge speaks milliseconds and converts at the boundary.

export type SkipKind = 'intro' | 'outro' | 'recap';

export type SkipSource = 'aniskip' | 'introdb' | 'chapters';

export type SkipSegment = {
    kind: SkipKind;
    startSec: number;
    endSec: number;
    source: SkipSource;
};
