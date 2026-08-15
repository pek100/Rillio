// Copyright (C) 2017-2026 Smart code 203358507

// Hand packages/video the same streaming-server edge the rest of the web uses.
//
// The player is loaded with `streamingServerURL` taken from profile settings,
// which is deliberately SYMBOLIC (see common/serverAddress): on a boot where
// the shell had to bind an ephemeral port, every url withStreamingServer
// derives from it would point at the wrong place, and in the shell those
// requests should not go over a socket at all.
//
// Imported for its side effect from index.tsx, before anything can load a
// video, so the injection cannot lose a race with the first playback.

import { setServerContext } from '@rillio/video/src/serverContext';
import { isLocalServerUrl, rewriteServerUrl, whenServerUrlReady } from 'rillio/common/serverAddress';
import { serverFetch } from 'rillio/common/serverFetch';

setServerContext({
    resolveUrl: rewriteServerUrl,
    // The async form withStreamingServer gates a load on: for a LOCAL url it
    // waits (bounded) for the shell's address handshake, so the symbolic port
    // never reaches mpv on a fallback-port boot. On timeout it proceeds with
    // whatever the sync mapping gives (the symbolic form), which fails the
    // same way the old code did - but loudly.
    resolveUrlWhenReady: (url: string): Promise<string> => {
        if (!isLocalServerUrl(url)) return Promise.resolve(url);
        return whenServerUrlReady()
            .catch((error: unknown) => {
                console.error('videoServerContext: no server address before the load; proceeding with the symbolic one', error);
            })
            .then(() => rewriteServerUrl(url));
    },
    // Only the in-process server's streams may be swapped for the rillio://
    // byte plane (which always reads the LOCAL engine); a remote streaming
    // server selected in Settings keeps http.
    isLocalUrl: isLocalServerUrl,
    fetch: serverFetch,
});
