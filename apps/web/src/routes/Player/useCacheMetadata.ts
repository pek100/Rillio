// Copyright (C) 2017-2026 Smart code 203358507

// The eager half of torrent<->metadata correlation (see common/cacheMetadata):
// when a torrent stream plays from a real title in the app, we are already
// holding everything the Cache page wishes it knew - meta id, type, title,
// artwork, and for a series the exact episode. Save it against the infoHash
// while we have it, instead of trying to recover it later from a scene
// filename.
//
// Runs once per (infoHash, videoId): a series episode changing within the same
// torrent is a new fact worth writing, a re-render is not.

import { useEffect, useRef } from 'react';
import { saveCacheMeta, type CacheMeta } from 'rillio/common/cacheMetadata';

type Args = {
    infoHash: string | null,
    serverUrl: string | null,
    player: Player,
};

const useCacheMetadata = ({ infoHash, serverUrl, player }: Args) => {
    const saved = useRef<string | null>(null);
    useEffect(() => {
        if (typeof infoHash !== 'string' || infoHash.length === 0 || typeof serverUrl !== 'string') return;
        // Loadable's `content` is typed as the value OR an error, so narrowing on
        // `type` does not narrow it; the Ready check is the guard.
        const metaItem = player.metaItem?.type === 'Ready' ? player.metaItem.content as MetaItemPlayer : null;
        const metaId = metaItem?.id ?? player.selected?.metaRequest?.path?.id ?? null;
        if (metaItem === null || typeof metaId !== 'string' || metaId.length === 0) return;

        const videoId = player.selected?.streamRequest?.path?.id ?? null;
        const key = `${infoHash}:${videoId ?? ''}`;
        if (saved.current === key) return;
        saved.current = key;

        const meta: CacheMeta = {
            metaId,
            type: metaItem.type ?? player.selected?.metaRequest?.path?.type ?? 'movie',
            name: metaItem.name ?? player.title ?? '',
            poster: metaItem.poster ?? null,
            background: metaItem.background ?? null,
            logo: metaItem.logo ?? null,
            year: metaItem.releaseInfo ?? null,
            videoId: typeof videoId === 'string' && videoId !== metaId ? videoId : null,
            season: player.seriesInfo?.season ?? null,
            episode: player.seriesInfo?.episode ?? null,
            // The exact addons the core resolved this playback through - the
            // authoritative values, so replaying from the cache reproduces this
            // session rather than guessing at an addon.
            metaTransportUrl: player.selected?.metaRequest?.base ?? null,
            streamTransportUrl: player.selected?.streamRequest?.base ?? null,
            // The file actually being played, which for a season pack is the
            // only way to know which episode is which.
            fileIdx: typeof player.selected?.stream?.fileIdx === 'number' ? player.selected.stream.fileIdx : null,
        };

        saveCacheMeta(serverUrl, infoHash, meta)
            // Retryable: a metadata write is a nicety, and a failed one must not
            // be remembered as done.
            .catch((error) => {
                saved.current = null;
                console.error('useCacheMetadata: saving the cache metadata failed', error);
            });
    }, [infoHash, serverUrl, player.metaItem, player.selected, player.seriesInfo, player.title]);
};

export default useCacheMetadata;
