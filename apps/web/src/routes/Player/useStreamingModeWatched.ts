// Copyright (C) 2017-2026 Smart code 203358507

// Streaming mode's watched reporter: once playback of a TORRENT stream passes
// ~90%, tell the local streaming server the stream was watched so it can clean
// the cache entry up later (un-kept entries only; see common/streamingMode).
// Reported at most once per infoHash per mount, and only while the server-side
// streaming-mode toggle is on - the toggle is read at report time, not at
// mount, so flipping it mid-playback is respected. The first ever report also
// shows a one-time explainer toast pointing at the Cached page, where the user
// can keep the title or turn the mode off.

import { useEffect, useRef } from 'react';
import useToast from 'rillio/common/Toast/useToast';
import { openModal } from 'rillio/common/modalEvents';
import {
    fetchStreamingModeEnabled,
    markStreamWatched,
    streamingModeToastShown,
    setStreamingModeToastShown,
} from 'rillio/common/streamingMode';

const WATCHED_THRESHOLD = 0.9;

type Args = {
    infoHash: string | null,
    serverUrl: string | null,
    time: number | null,
    duration: number | null,
};

const useStreamingModeWatched = ({ infoHash, serverUrl, time, duration }: Args) => {
    const toast = useToast();
    const reported = useRef<string | null>(null);
    useEffect(() => {
        if (typeof infoHash !== 'string' || infoHash.length === 0 || typeof serverUrl !== 'string') return;
        if (typeof time !== 'number' || typeof duration !== 'number' || duration <= 0) return;
        if (time / duration < WATCHED_THRESHOLD) return;
        if (reported.current === infoHash) return;
        reported.current = infoHash;
        fetchStreamingModeEnabled(serverUrl)
            .then((enabled) => {
                if (!enabled) return;
                return markStreamWatched(serverUrl, infoHash).then(() => {
                    if (streamingModeToastShown()) return;
                    setStreamingModeToastShown();
                    toast.show({
                        type: 'info',
                        title: 'Streaming mode is on',
                        message: 'Finished streams are cleaned up from the cache after a while. Use Keep on any title, or turn this off, on the Cache page.',
                        timeout: 12000,
                        action: { label: 'Open Cache', onSelect: () => openModal('cached') },
                    });
                });
            })
            .catch((error) => {
                // Retryable next tick: an offline server at the exact threshold
                // crossing must not permanently swallow the mark.
                reported.current = null;
                console.error('streamingMode: reporting the stream watched failed', error);
            });
    }, [infoHash, serverUrl, time, duration]);
};

export default useStreamingModeWatched;
