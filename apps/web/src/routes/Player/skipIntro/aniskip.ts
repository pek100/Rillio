// Copyright (C) 2017-2026 Smart code 203358507
//
// Adapted from Harbor (https://github.com/harborstremio/harbor),
// MIT License, Copyright (c) Harbor contributors.

// AniSkip: community-submitted intro/outro timestamps for anime, keyed by
// MyAnimeList id + episode. Our anime metas are Kitsu-keyed ('kitsu:<id>...'),
// so the Kitsu mappings API resolves Kitsu -> MAL first; that mapping never
// changes, so it persists in localStorage. Both APIs are keyless and optional:
// every failure resolves to "no segments", never an error the player sees.

import type { SkipSegment } from './types';

const KITSU_MAL_CACHE_KEY = 'rillio.kitsuToMal.v1';

let kitsuToMalCache: Record<number, number | null> = {};
try {
    const raw = window.localStorage.getItem(KITSU_MAL_CACHE_KEY);
    if (raw) kitsuToMalCache = JSON.parse(raw);
} catch { /* start with an empty cache */ }

let writeTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleCacheWrite = () => {
    if (writeTimeout !== null) return;
    writeTimeout = setTimeout(() => {
        writeTimeout = null;
        try {
            window.localStorage.setItem(KITSU_MAL_CACHE_KEY, JSON.stringify(kitsuToMalCache));
        } catch { /* cache write is best-effort */ }
    }, 1000);
};

// Per-session memo + in-flight coalescing so a rerendering player never
// duplicates a request for the same episode.
const segmentCache = new Map<string, SkipSegment[]>();
const inflight = new Map<string, Promise<SkipSegment[]>>();

export const kitsuToMal = async (kitsuId: number): Promise<number | null> => {
    if (kitsuId in kitsuToMalCache) return kitsuToMalCache[kitsuId];
    let result: number | null = null;
    try {
        const resp = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}/mappings`);
        if (resp.ok) {
            const json = await resp.json() as {
                data?: { attributes?: { externalSite?: string; externalId?: string } }[];
            };
            const mal = json.data?.find((d) => d.attributes?.externalSite === 'myanimelist/anime');
            const id = mal?.attributes?.externalId ? parseInt(mal.attributes.externalId, 10) : NaN;
            result = Number.isFinite(id) ? id : null;
        }
    } catch { /* offline / blocked: cache the miss, do not retry every episode */ }
    kitsuToMalCache[kitsuId] = result;
    scheduleCacheWrite();
    return result;
};

export const fetchAniSkipSegments = (
    malId: number,
    episode: number,
    episodeLengthSec: number,
): Promise<SkipSegment[]> => {
    const key = `${malId}:${episode}:${Math.round(episodeLengthSec)}`;
    const hit = segmentCache.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = inflight.get(key);
    if (pending) return pending;
    const request = (async () => {
        const params = new URLSearchParams();
        for (const type of ['op', 'ed', 'mixed-op', 'mixed-ed', 'recap']) params.append('types', type);
        params.set('episodeLength', String(Math.round(episodeLengthSec)));
        const resp = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?${params.toString()}`);
        if (!resp.ok) {
            // 404 = "no timestamps submitted", the common case for niche titles.
            segmentCache.set(key, []);
            return [];
        }
        const json = await resp.json() as {
            found?: boolean;
            results?: { interval?: { startTime?: number; endTime?: number }; skipType?: string }[];
        };
        if (!json.found || !Array.isArray(json.results)) {
            segmentCache.set(key, []);
            return [];
        }
        const segments: SkipSegment[] = [];
        for (const entry of json.results) {
            const start = entry.interval?.startTime;
            const end = entry.interval?.endTime;
            if (typeof start !== 'number' || typeof end !== 'number' || end <= start) continue;
            const type = entry.skipType ?? '';
            segments.push({
                kind: type === 'ed' || type === 'mixed-ed' ? 'outro' : type === 'recap' ? 'recap' : 'intro',
                startSec: start,
                endSec: end,
                source: 'aniskip',
            });
        }
        segments.sort((a, b) => a.startSec - b.startSec);
        segmentCache.set(key, segments);
        return segments;
    })()
        .catch((): SkipSegment[] => [])
        .finally(() => { inflight.delete(key); });
    inflight.set(key, request);
    return request;
};
