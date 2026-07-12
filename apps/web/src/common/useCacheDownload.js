// Copyright (C) 2017-2024 Smart code 203358507

const React = require('react');
const useProfile = require('rillio/common/useProfile');
const useToast = require('rillio/common/Toast/useToast');

// "Download to cache": ask the local streaming server to fetch a torrent
// stream in the background and PIN it (the cache sweeper never evicts pinned
// torrents) - watch-later without having to stream it now. Returns a callback
// that accepts a stream-like object ({ infoHash, fileIdx? }) and reports
// whether it could act on it (false = not a torrent stream / no server).
const useCacheDownload = () => {
    const profile = useProfile();
    const toast = useToast();
    return React.useCallback((stream) => {
        const serverUrl = profile.settings.streamingServerUrl;
        if (!stream || typeof stream.infoHash !== 'string' || typeof serverUrl !== 'string') {
            return false;
        }
        const body = { infoHash: stream.infoHash };
        if (typeof stream.fileIdx === 'number') {
            body.fileIdx = stream.fileIdx;
        }
        fetch(new URL('cache/download', serverUrl), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then((resp) => {
                if (!resp.ok) {
                    throw new Error(`cache/download responded ${resp.status}`);
                }
                toast.show({
                    type: 'success',
                    title: 'Downloading to cache',
                    message: 'Track progress on the Cached page.',
                    timeout: 4000,
                });
            })
            .catch((error) => {
                console.error('cache/download failed', error);
                toast.show({
                    type: 'error',
                    title: 'Download failed to start',
                    message: 'The streaming service is not reachable.',
                    timeout: 4000,
                });
            });
        return true;
    }, [profile.settings.streamingServerUrl]);
};

module.exports = useCacheDownload;
