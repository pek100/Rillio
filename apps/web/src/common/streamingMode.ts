// Streaming mode: watched, un-kept streams are cleaned up from the cache
// automatically by the local streaming server. The toggle itself lives
// SERVER-side (GET/POST /torrent-settings, persisted next to the cache) because
// the sweeper that acts on it runs in the server; the one-time explainer-toast
// flag is a web preference and follows the profileStorage pattern (see
// nextEpisodePreloadPrefs for why core profile.settings is not an option).

import { getItem, setItem } from 'rillio/common/profileStorage';

export const fetchStreamingModeEnabled = (serverUrl: string): Promise<boolean> =>
    fetch(new URL('torrent-settings', serverUrl))
        .then((resp) => {
            if (!resp.ok) throw new Error(`torrent-settings responded ${resp.status}`);
            return resp.json();
        })
        .then((body: { streamingMode?: boolean }) => body.streamingMode !== false);

export const postStreamingModeEnabled = (serverUrl: string, enabled: boolean): Promise<void> =>
    fetch(new URL('torrent-settings', serverUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ streamingMode: enabled }),
    })
        .then((resp) => {
            if (!resp.ok) throw new Error(`torrent-settings responded ${resp.status}`);
        });

// The player reporting "this stream was watched" (>= ~90% through).
export const markStreamWatched = (serverUrl: string, infoHash: string): Promise<void> =>
    fetch(new URL('cache/watched', serverUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ infoHash, watched: true }),
    })
        .then((resp) => {
            if (!resp.ok) throw new Error(`cache/watched responded ${resp.status}`);
        });

const TOAST_SHOWN_KEY = 'rillio.streamingMode.toastShown';

// A broken preference store must fail toward NOT toasting (a repeated toast is
// worse than a missed one) and never toward crashing playback.
export const streamingModeToastShown = (): boolean => {
    try {
        return getItem(TOAST_SHOWN_KEY) === 'true';
    } catch (error) {
        console.error('streamingMode: failed to read the toast flag', error);
        return true;
    }
};

export const setStreamingModeToastShown = (): void => {
    try {
        setItem(TOAST_SHOWN_KEY, 'true');
    } catch (error) {
        console.error('streamingMode: failed to persist the toast flag', error);
    }
};
