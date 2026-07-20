// Copyright (C) 2017-2026 Smart code 203358507

/**
 * The per-row file browser (the Cache page's advanced view): everything inside
 * a cached torrent, not just the file being streamed. A torrent is a directory,
 * and until now the app pretended it was a single movie - so extras, bundled
 * subtitles, or the second half of a double feature were invisible and
 * unreachable even though the swarm was right there.
 *
 * Each file can be pulled into the download selection (or dropped out of it),
 * and any video file can be played straight from here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Play, Download, Loader2, Check, X } from 'lucide-react';
import { useProfile } from 'rillio/common';
import { IconButton, cn } from 'rillio/components/ui';

export type TorrentFile = {
    index: number,
    path: string,
    length: number,
    downloaded: number,
    selected: boolean,
    video: boolean,
};

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const formatBytes = (bytes: number): string => {
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
    return `${Math.max(0, Math.round(bytes / 1024))} KB`;
};

type Props = {
    infoHash: string,
    // librqbit hard-refuses a selection change while a torrent is hash-checking
    // ("can't update initializing torrent"), exactly as it refuses pause there.
    // Offering the control anyway would produce a toast-worthy 409 for a user
    // who did nothing wrong, so it is disabled with the reason instead.
    initializing: boolean,
    onPlayFile: (infoHash: string, fileIdx: number, name: string) => void,
    onSetFileSelected: (infoHash: string, fileIdx: number, selected: boolean) => Promise<void> | void,
};

const TorrentFiles = ({ infoHash, initializing, onPlayFile, onSetFileSelected }: Props) => {
    const profile = useProfile();
    const serverUrl = profile.settings.streamingServerUrl;
    const [files, setFiles] = useState<TorrentFile[] | null>(null);
    const [failed, setFailed] = useState(false);
    // Indices with a selection change in flight, so a click cannot be
    // double-fired while the engine is still applying the last one.
    const [pending, setPending] = useState<number[]>([]);

    const load = useCallback(() => {
        if (typeof serverUrl !== 'string') return;
        fetch(new URL(`cache/files/${infoHash}`, serverUrl))
            .then((resp) => {
                if (!resp.ok) throw new Error(`cache/files responded ${resp.status}`);
                return resp.json();
            })
            .then((list: TorrentFile[]) => { setFiles(list); setFailed(false); })
            .catch((error) => {
                console.error('TorrentFiles: listing the torrent failed', error);
                setFailed(true);
            });
    }, [serverUrl, infoHash]);

    // Poll while open: a file the user just added starts filling immediately,
    // and a frozen byte count reads as a stalled download.
    useEffect(() => {
        load();
        const interval = setInterval(load, 3000);
        return () => clearInterval(interval);
    }, [load]);

    const toggle = useCallback((file: TorrentFile) => {
        setPending((current) => [...current, file.index]);
        Promise.resolve(onSetFileSelected(infoHash, file.index, !file.selected))
            .finally(() => {
                setPending((current) => current.filter((i) => i !== file.index));
                load();
            });
    }, [infoHash, onSetFileSelected, load]);

    if (failed) {
        return <div className="px-6 pb-4 text-xs text-fg-muted">Could not read this torrent&apos;s contents.</div>;
    }
    if (files === null) {
        return <div className="px-6 pb-4 text-xs text-fg-muted">Loading files...</div>;
    }

    return (
        // Nearly opaque, not a light tint: under the hero this panel sits on top of
        // backdrop ARTWORK, and a 20% scrim left the filenames fighting Rick's face.
        <div className="divide-y divide-white/5 border-t border-white/10 bg-black/75 backdrop-blur-md">
            {files.map((file) => {
                const complete = file.length > 0 && file.downloaded >= file.length;
                const busy = pending.includes(file.index);
                return (
                    <div key={file.index} className="flex items-center gap-3 py-2 pl-10 pr-6">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-fg-muted" title={file.path}>{file.path}</div>
                            <div className="mt-0.5 text-[0.6875rem] tabular-nums text-fg-subtle">
                                {formatBytes(file.length)}
                                {
                                    file.selected && !complete ?
                                        <>{' · '}{formatBytes(file.downloaded)} downloaded</>
                                        :
                                        null
                                }
                                {file.selected && complete ? <>{' · '}Complete</> : null}
                                {!file.selected ? <>{' · '}Not downloaded</> : null}
                            </div>
                        </div>
                        {
                            // Play only what is actually playable AND actually here:
                            // offering Play on a file nobody selected would start a
                            // download behind a spinner with no explanation.
                            file.video && file.selected ?
                                <IconButton
                                    onClick={() => onPlayFile(infoHash, file.index, file.path)}
                                    title="Play this file"
                                    className="size-8 shrink-0 text-accent hover:brightness-110"
                                >
                                    <Play className="size-4" />
                                </IconButton>
                                :
                                null
                        }
                        <IconButton
                            onClick={() => toggle(file)}
                            disabled={busy || initializing}
                            title={
                                initializing ? 'Available once this torrent finishes preparing' :
                                    file.selected ? 'Stop downloading this file' : 'Download this file too'
                            }
                            className={cn(
                                'group/toggle size-8 shrink-0',
                                file.selected ? 'text-fg-muted hover:text-danger' : 'text-fg-subtle hover:text-accent',
                            )}
                        >
                            {
                                busy ? <Loader2 className="size-4 animate-spin" /> :
                                    file.selected ?
                                        // A check states what IS; hovering must state what
                                        // the click DOES, and this click removes the file
                                        // from the download.
                                        <>
                                            <Check className="size-4 group-hover/toggle:hidden" />
                                            <X className="hidden size-4 group-hover/toggle:block" />
                                        </>
                                        :
                                        <Download className="size-4" />
                            }
                        </IconButton>
                    </div>
                );
            })}
        </div>
    );
};

export default TorrentFiles;
