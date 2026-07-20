// Copyright (C) 2017-2026 Smart code 203358507

// "What of this title do I already have on disk?"
//
// The streams panel lists what ADDONS can offer, which is a strange thing to
// stare at when the file is already sitting in the cache, fully downloaded.
// This reads the local cache and returns the entries that belong to the title
// being viewed, matched through the metadata sidecar (common/cacheMetadata):
// metaId for a movie, and the exact videoId for a series episode, so season 9
// episode 2 never surfaces under episode 1.
//
// Cheap and quiet: one fetch per title (plus a refresh while a download is
// still running), and a missing/unreachable server just yields nothing.

import { useCallback, useEffect, useState } from 'react';
import { useProfile } from 'rillio/common';
import type { CacheMeta } from 'rillio/common/cacheMetadata';

export type CachedStream = {
    infoHash: string,
    name: string,
    downloaded: number,
    total: number,
    state: string,
    fileIdx?: number,
    meta?: CacheMeta,
};

const POLL_MS = 3000;

const useCachedStreams = (metaId: string | null, videoId: string | null): CachedStream[] => {
    const profile = useProfile();
    const serverUrl = profile.settings.streamingServerUrl;
    const [matches, setMatches] = useState<CachedStream[]>([]);

    const load = useCallback(() => {
        if (typeof serverUrl !== 'string' || typeof metaId !== 'string' || metaId.length === 0) {
            setMatches([]);
            return;
        }
        fetch(new URL('cache/list', serverUrl))
            .then((resp) => {
                if (!resp.ok) throw new Error(`cache/list responded ${resp.status}`);
                return resp.json();
            })
            .then((list: CachedStream[]) => {
                setMatches(list.filter((entry) => {
                    if (entry.meta?.metaId !== metaId) return false;
                    // A series page is always scoped to one episode: only show a
                    // torrent that holds THAT episode. An entry with no videoId
                    // (a whole-season pack we could not pin down) is shown on any
                    // episode of the title rather than hidden everywhere.
                    if (typeof videoId === 'string' && videoId.length > 0) {
                        const entryVideo = entry.meta?.videoId;
                        return typeof entryVideo !== 'string' || entryVideo.length === 0 || entryVideo === videoId;
                    }
                    return true;
                }));
            })
            // No streaming server, or it is down: there is simply nothing cached
            // to show. Never surfaced to the user - the addon streams below are
            // unaffected.
            .catch(() => setMatches([]));
    }, [serverUrl, metaId, videoId]);

    useEffect(() => {
        load();
        const interval = setInterval(load, POLL_MS);
        return () => clearInterval(interval);
    }, [load]);

    return matches;
};

export default useCachedStreams;
