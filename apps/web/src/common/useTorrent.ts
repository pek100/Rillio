// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';
import { useCore } from 'rillio/core';
import useToast from 'rillio/common/Toast/useToast';
import useStreamingServer from 'rillio/common/useStreamingServer';

// magnet-uri ships no type declarations, so it is kept as untyped `require`
// (typed `any`) rather than introducing a broken import.
const magnet = require('magnet-uri');

const CREATE_TORRENT_TIMEOUT = 20000;

const useTorrent = () => {
    const core = useCore();
    const streamingServer = useStreamingServer();
    const toast = useToast();
    const createTorrentTimeout = React.useRef<any>(null);
    const parsingToastId = React.useRef<any>(null);
    const createTorrentFromMagnet = React.useCallback((text: string) => {
        const parsed = magnet.decode(text);
        if (parsed && typeof parsed.infoHash === 'string') {
            parsingToastId.current = toast.show({
                type: 'success',
                title: 'Loading magnet link…',
                timeout: CREATE_TORRENT_TIMEOUT
            });
            core.transport.dispatch({
                action: 'StreamingServer',
                args: {
                    action: 'CreateTorrent',
                    args: text
                }
            });
            clearTimeout(createTorrentTimeout.current);
            createTorrentTimeout.current = setTimeout(() => {
                toast.remove(parsingToastId.current);
                toast.show({
                    type: 'error',
                    title: 'Failed to parse magnet link.',
                    timeout: 8000
                });
            }, CREATE_TORRENT_TIMEOUT);
        }
    }, []);
    React.useEffect(() => {
        if (streamingServer.torrent !== null) {
            const [, { type }] = streamingServer.torrent;
            if (type === 'Ready') {
                clearTimeout(createTorrentTimeout.current);
                toast.remove(parsingToastId.current);
            }
        }
    }, [streamingServer.torrent]);
    React.useEffect(() => {
        return () => clearTimeout(createTorrentTimeout.current);
    }, []);
    return {
        createTorrentFromMagnet
    };
};

export = useTorrent;
