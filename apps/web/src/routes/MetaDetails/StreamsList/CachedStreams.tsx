// Copyright (C) 2017-2026 Smart code 203358507

/**
 * "On this device" - the cached copies of the title you are looking at, shown
 * above the addon streams.
 *
 * The point is that a file already on disk should be the obvious thing to
 * press, not something you have to remember and go find on the Cache page. Each
 * row states what the addon list cannot: how much of it is actually here, and
 * where you stopped watching (the library's own timeOffset, the same number
 * that drives Continue Watching).
 */

import React from 'react';
import { Play, HardDriveDownload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCore } from 'rillio/core';
import { Button } from 'rillio/components/ui/button';
import { cn } from 'rillio/components/ui/cn';
import { playerDeepLink } from 'rillio/common/cacheMetadata';
import type { CachedStream } from './useCachedStreams';

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const formatBytes = (bytes: number): string => {
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
    return `${Math.max(0, Math.round(bytes / 1024))} KB`;
};

// "1h 12m in" / "6m in" - a position, not a duration, so it reads as a place to
// resume rather than a runtime.
const formatOffset = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return `${h}h ${m}m in`;
    return `${Math.max(1, m)}m in`;
};

type Props = {
    streams: CachedStream[],
    // The library item for this title, when it has one: carries the resume
    // position and which video it belongs to.
    libraryItem?: {
        state?: { timeOffset?: number, duration?: number, video_id?: string },
    } | null,
    videoId?: string | null,
};

const CachedStreams = ({ streams, libraryItem, videoId }: Props) => {
    const core = useCore();
    const navigate = useNavigate();

    // The resume position only belongs to a row when the library's progress is
    // for the SAME video (a series' library item tracks one episode at a time).
    const resumeMs = React.useMemo(() => {
        const state = libraryItem?.state;
        if (!state || typeof state.timeOffset !== 'number' || state.timeOffset <= 0) return null;
        if (typeof videoId === 'string' && videoId.length > 0 && typeof state.video_id === 'string' && state.video_id !== videoId) {
            return null;
        }
        return state.timeOffset;
    }, [libraryItem, videoId]);
    const duration = libraryItem?.state?.duration ?? 0;

    // The entry's own playable file, or - for a season pack, which has none -
    // the file this specific episode was recorded as.
    const fileIdxFor = (entry: CachedStream): number | undefined =>
        typeof entry.fileIdx === 'number' ? entry.fileIdx :
            typeof entry.meta?.fileIdx === 'number' ? entry.meta.fileIdx : undefined;

    const play = React.useCallback((entry: CachedStream) => {
        core.transport.encodeStream({
            name: entry.name,
            description: '',
            infoHash: entry.infoHash,
            fileIdx: fileIdxFor(entry),
        })
            .then((encoded: unknown) => {
                if (typeof encoded !== 'string') {
                    console.error('CachedStreams: the core could not encode a stream for', entry.infoHash);
                    return;
                }
                navigate(playerDeepLink(encoded, entry.meta));
            })
            .catch((error: unknown) => console.error('CachedStreams: encoding the stream failed', error));
    }, [core, navigate]);

    if (streams.length === 0) {
        return null;
    }

    return (
        <div className="mb-3 flex flex-col gap-1.5 px-4">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-subtle">
                <HardDriveDownload className="size-3.5" />
                On this device
            </div>
            {streams.map((entry) => {
                const complete = entry.total > 0 && entry.downloaded >= entry.total;
                const pct = entry.total > 0 ? Math.min(100, Math.round((entry.downloaded / entry.total) * 100)) : 0;
                const playable = fileIdxFor(entry) !== undefined;
                return (
                    <div
                        key={entry.infoHash}
                        className="group flex items-center gap-3 rounded-lg bg-accent/10 px-3 py-2.5 transition hover:bg-accent/15"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-fg" title={entry.name}>
                                {complete ? 'Downloaded' : 'Downloading'}
                                <span className="ml-2 text-xs font-normal text-fg-muted">
                                    {
                                        complete ?
                                            formatBytes(entry.downloaded)
                                            :
                                            `${pct}% of ${formatBytes(entry.total)}`
                                    }
                                </span>
                            </div>
                            <div className="mt-0.5 truncate text-[0.6875rem] text-fg-subtle" title={entry.name}>
                                {
                                    resumeMs !== null ?
                                        <>
                                            <span className="text-accent">{formatOffset(resumeMs)}</span>
                                            {duration > 0 ? ` of ${formatOffset(duration).replace(' in', '')}` : null}
                                            <span>{' · '}</span>
                                        </>
                                        :
                                        null
                                }
                                {entry.name}
                            </div>
                            {
                                !complete && entry.total > 0 ?
                                    <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-surface">
                                        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
                                    </div>
                                    :
                                    null
                            }
                        </div>
                        {
                            // Streams while it downloads, so an incomplete entry is
                            // still worth pressing.
                            playable ?
                                <Button
                                    onClick={() => play(entry)}
                                    title={complete ? 'Play from this device' : 'Play (streams while it downloads)'}
                                    className={cn('h-9 shrink-0 gap-2 px-4 text-sm font-semibold')}
                                >
                                    <Play className="size-4" />
                                    {resumeMs !== null ? 'Resume' : 'Play'}
                                </Button>
                                :
                                null
                        }
                    </div>
                );
            })}
        </div>
    );
};

export default CachedStreams;
