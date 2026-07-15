// Copyright (C) 2017-2026 Smart code 203358507
//
// Adapted from Harbor (https://github.com/harborstremio/harbor),
// MIT License, Copyright (c) Harbor contributors.

// TheIntroDB: community intro/recap/credits timestamps for movies and TV,
// keyed by IMDB id (all our non-anime metas are 'tt...'). Keyless, optional,
// fail-quiet: any failure is just "no segments".

import type { SkipKind, SkipSegment } from './types';

type RawSpan = { start_ms: number | null; end_ms: number | null };

type RawResponse = {
    intro?: RawSpan[];
    recap?: RawSpan[];
    credits?: RawSpan[];
    preview?: RawSpan[];
};

const cache = new Map<string, RawResponse | null>();
const inflight = new Map<string, Promise<RawResponse | null>>();

const spanToSegment = (span: RawSpan, kind: SkipKind, durationSec: number): SkipSegment | null => {
    const startMs = span.start_ms ?? 0;
    // Credits often carry no end: they run to the end of the file.
    const endMs = span.end_ms ?? (durationSec > 0 ? Math.round(durationSec * 1000) : null);
    if (endMs === null || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    return { kind, startSec: startMs / 1000, endSec: endMs / 1000, source: 'introdb' };
};

const fetchRaw = (cacheKey: string): Promise<RawResponse | null> => {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return Promise.resolve(hit);
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
    const request = (async () => {
        const resp = await fetch(`https://api.theintrodb.org/v2/media?${cacheKey}`);
        if (!resp.ok) {
            cache.set(cacheKey, null);
            return null;
        }
        const json = await resp.json() as RawResponse;
        cache.set(cacheKey, json);
        return json;
    })()
        .catch(() => null)
        .finally(() => { inflight.delete(cacheKey); });
    inflight.set(cacheKey, request);
    return request;
};

export const fetchIntroDbSegments = async (
    imdbId: string,
    episode: { season: number; episode: number } | null,
    durationSec: number,
): Promise<SkipSegment[]> => {
    if (!imdbId.startsWith('tt')) return [];
    const params = new URLSearchParams();
    params.set('imdb_id', imdbId);
    if (episode !== null) {
        params.set('season', String(episode.season));
        params.set('episode', String(episode.episode));
    }
    const json = await fetchRaw(params.toString());
    if (json === null) return [];
    const out: SkipSegment[] = [];
    const collect = (spans: RawSpan[] | undefined, kind: SkipKind) => {
        for (const span of spans ?? []) {
            const segment = spanToSegment(span, kind, durationSec);
            if (segment !== null) out.push(segment);
        }
    };
    collect(json.intro, 'intro');
    collect(json.recap, 'recap');
    collect(json.credits, 'outro');
    collect(json.preview, 'outro');
    out.sort((a, b) => a.startSec - b.startSec);
    return out;
};
