// Copyright (C) 2017-2026 Smart code 203358507

// The matching half of torrent<->metadata correlation (see
// common/cacheMetadata). Anything played from a real title in the app is
// already identified by the Player's eager write; this covers the leftovers -
// a pasted magnet, a torrent from before the sidecar existed, a download
// started from the Cache page itself.
//
// Runs while the Cache page is open: for each entry with no metadata, parse the
// release name and search the installed addons for it. One attempt per infoHash
// per mount (a miss is usually a permanent miss - an obscure release name no
// catalog knows - and retrying it every 3s poll would hammer every addon in the
// profile), and strictly sequential, so opening the page does not fire a dozen
// parallel searches at someone's addon server.

import { useEffect, useRef } from 'react';
import { useProfile } from 'rillio/common';
import { matchRelease, parseReleaseName, saveCacheMeta, type AddonLike } from 'rillio/common/cacheMetadata';
import type { CacheEntry } from './useCachedTorrents';

const useMetadataMatcher = (entries: CacheEntry[] | null, onMatched: () => void) => {
    const profile = useProfile();
    const serverUrl = profile.settings.streamingServerUrl;
    // The core's profile carries the installed addons; the checked-in Profile
    // type predates them (it only declares auth + settings), hence the cast.
    const addons = (profile as unknown as { addons?: AddonLike[] }).addons ?? [];
    const attempted = useRef<Set<string>>(new Set());
    // Serializes the queue across renders: the effect re-runs on every poll.
    const running = useRef(false);

    useEffect(() => {
        if (entries === null || typeof serverUrl !== 'string' || running.current) return;
        const pending = entries.filter((entry) =>
            entry.meta === undefined &&
            !attempted.current.has(entry.infoHash) &&
            typeof entry.name === 'string' && entry.name.length > 0);
        if (pending.length === 0) return;

        running.current = true;
        let cancelled = false;
        (async () => {
            let matchedAny = false;
            for (const entry of pending) {
                if (cancelled) break;
                attempted.current.add(entry.infoHash);
                try {
                    const meta = await matchRelease(addons, parseReleaseName(entry.name));
                    if (meta === null || cancelled) continue;
                    await saveCacheMeta(serverUrl, entry.infoHash, meta);
                    matchedAny = true;
                } catch (error) {
                    console.error('useMetadataMatcher: matching failed for', entry.name, error);
                }
            }
            running.current = false;
            // One refresh at the end rather than per match: the list re-renders
            // once with everything that was identified.
            if (matchedAny && !cancelled) onMatched();
        })();

        return () => { cancelled = true; };
    }, [entries, serverUrl, addons, onMatched]);
};

export default useMetadataMatcher;
