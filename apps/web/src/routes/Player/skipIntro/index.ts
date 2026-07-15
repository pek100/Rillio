// Copyright (C) 2017-2026 Smart code 203358507
//
// Multi-source skip-intro/outro segments, adapted from Harbor
// (https://github.com/harborstremio/harbor), MIT License,
// Copyright (c) Harbor contributors. Substantial portions of the merging and
// source design follow Harbor's src/lib/skip-intro; reworked for Rillio's
// player state (kitsu/imdb meta ids, millisecond chapters, no ad corpus).

// Sources, in priority order (first wins where segments overlap):
//   1. chapters   - the file's own named chapters ("Opening", "End Credits"):
//                   the encoder's ground truth for THIS exact cut.
//   2. aniskip    - community timestamps for anime (MAL id via Kitsu mapping).
//   3. introdb    - community timestamps for movies/TV (IMDB id).
// All keyless, all optional, all fail-quiet: no segments simply means no pill.

import React from 'react';
import { fetchAniSkipSegments, kitsuToMal } from './aniskip';
import { fetchIntroDbSegments } from './theintrodb';
import { chaptersToSegments, type PlayerChapter } from './chapters';
import type { SkipSegment, SkipKind } from './types';

export type { SkipSegment, SkipKind } from './types';

// A segment shorter than this is noise; longer than this is not an intro/outro
// but a mislabel (6 minutes covers the longest real recaps).
const MIN_SEGMENT_SEC = 2;
const MAX_SEGMENT_SEC = 360;
// An "outro" starting in the first half of the runtime is a mislabel.
const MIN_OUTRO_START_FRACTION = 0.5;

export const mergeSegments = (sourcesInPriority: SkipSegment[][]): SkipSegment[] => {
    const merged: SkipSegment[] = [];
    for (const list of sourcesInPriority) {
        for (const segment of list ?? []) {
            const overlaps = merged.some((existing) =>
                segment.startSec < existing.endSec && segment.endSec > existing.startSec);
            if (!overlaps) merged.push(segment);
        }
    }
    return merged.sort((a, b) => a.startSec - b.startSec);
};

// 'kitsu:7442' / 'kitsu:7442:3' -> 7442
const parseKitsuId = (metaId: string): number | null => {
    if (!metaId.startsWith('kitsu:')) return null;
    const id = parseInt(metaId.slice('kitsu:'.length).split(':')[0], 10);
    return Number.isFinite(id) ? id : null;
};

// 'tt0816692' -> movie; 'tt7440726:3:2' -> season 3 episode 2;
// 'kitsu:7442:5' -> episode 5 (anime episodes are absolute-numbered).
const parseVideoId = (videoId: string | null): { season: number | null; episode: number | null } => {
    if (typeof videoId !== 'string') return { season: null, episode: null };
    const parts = videoId.split(':');
    if (parts[0] === 'kitsu') {
        const episode = parseInt(parts[2], 10);
        return { season: null, episode: Number.isFinite(episode) ? episode : null };
    }
    if (parts.length >= 3) {
        const season = parseInt(parts[1], 10);
        const episode = parseInt(parts[2], 10);
        return {
            season: Number.isFinite(season) ? season : null,
            episode: Number.isFinite(episode) ? episode : null,
        };
    }
    return { season: null, episode: null };
};

// All skip segments for the playing video, refreshed as chapters/duration
// arrive. metaId/videoId come from player.selected; chapters and duration from
// the video state (both in the bridge's milliseconds; this lib runs in seconds).
export const useSkipSegments = (
    metaId: string | null,
    videoId: string | null,
    chapters: PlayerChapter[],
    durationMs: number | null,
): SkipSegment[] => {
    const durationSec = typeof durationMs === 'number' && durationMs > 0 ? durationMs / 1000 : 0;
    const [aniSkip, setAniSkip] = React.useState<SkipSegment[]>([]);
    const [introDb, setIntroDb] = React.useState<SkipSegment[]>([]);
    const { season, episode } = React.useMemo(() => parseVideoId(videoId), [videoId]);

    React.useEffect(() => {
        setAniSkip([]);
        if (metaId === null || episode === null || durationSec <= 0) return;
        const kitsuId = parseKitsuId(metaId);
        if (kitsuId === null) return;
        let cancelled = false;
        kitsuToMal(kitsuId)
            .then((malId): Promise<SkipSegment[]> => {
                if (cancelled || malId === null) return Promise.resolve([]);
                return fetchAniSkipSegments(malId, episode, durationSec);
            })
            .then((segments) => { if (!cancelled) setAniSkip(segments); })
            .catch(() => { /* fail-quiet: no pill */ });
        return () => { cancelled = true; };
    }, [metaId, episode, durationSec]);

    React.useEffect(() => {
        setIntroDb([]);
        if (metaId === null || !metaId.startsWith('tt') || durationSec <= 0) return;
        let cancelled = false;
        const episodeArg = season !== null && episode !== null ? { season, episode } : null;
        fetchIntroDbSegments(metaId, episodeArg, durationSec)
            .then((segments) => { if (!cancelled) setIntroDb(segments); })
            .catch(() => { /* fail-quiet: no pill */ });
        return () => { cancelled = true; };
    }, [metaId, season, episode, durationSec]);

    const fromChapters = React.useMemo(
        () => chaptersToSegments(chapters, durationSec),
        [chapters, durationSec],
    );

    return React.useMemo(() => {
        const merged = mergeSegments([fromChapters, aniSkip, introDb]);
        if (durationSec <= 0) return merged;
        const minOutroStart = durationSec * MIN_OUTRO_START_FRACTION;
        return merged
            .filter((s) => s.startSec < durationSec)
            .map((s) => (s.endSec > durationSec ? { ...s, endSec: durationSec } : s))
            .filter((s) => {
                const length = s.endSec - s.startSec;
                return length >= MIN_SEGMENT_SEC && length <= MAX_SEGMENT_SEC;
            })
            .filter((s) => s.kind !== 'outro' || s.startSec >= minOutroStart);
    }, [fromChapters, aniSkip, introDb, durationSec]);
};

// The segment the playhead is currently inside (with a small tail margin so
// the pill does not flash for the final moments of a segment).
export const activeSegment = (segments: SkipSegment[], timeMs: number | null): SkipSegment | null => {
    if (typeof timeMs !== 'number') return null;
    const positionSec = timeMs / 1000;
    for (const segment of segments) {
        if (positionSec >= segment.startSec && positionSec < segment.endSec - 0.75) return segment;
    }
    return null;
};

export const skipLabel = (kind: SkipKind): string => {
    return kind === 'outro' ? 'Skip outro' : kind === 'recap' ? 'Skip recap' : 'Skip intro';
};
