// Copyright (C) 2017-2026 Smart code 203358507

// Timeline chapters for the seek bar, merged per availability from three
// sources, most precise first:
//   1. the file's own chapter marks (the player bridge's `chapters`, ms)
//   2. dialogue silence gaps in the selected EXTERNAL subtitle track (precise
//      scene boundaries; embedded tracks are not batch-readable, so external
//      only)
//   3. the shell's scene sweep (thumbs.rs): coarse visual cuts from comparing
//      trickplay-sized frames across the whole file - universal but shell-only
// Later sources only contribute boundaries that no earlier source already
// marked (within a merge window), so a file with rich real chapters is
// untouched and a bare file still gets segments.

import { useEffect, useMemo, useState } from 'react';
import { getTauri } from 'rillio/common/Platform/shell/isShell';

export type TimelineChapter = { time: number, title?: string | null };

const SCENE_POLL_MS = 3000;
// Dialogue silence at least this long reads as a scene change.
const SUBTITLE_GAP_MS = 20000;
// Boundaries from different sources closer than this collapse into the
// earlier (more precise) source's mark.
const MERGE_WINDOW_MS = 30000;

// Cue timing line shared by SRT and VTT ("00:01:02,003 --> ..." / with dots).
const CUE_RE = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{3})/g;

const cueMs = (h: string | undefined, m: string, s: string, ms: string): number =>
    (h ? parseInt(h, 10) * 3600000 : 0) + parseInt(m, 10) * 60000 + parseInt(s, 10) * 1000 + parseInt(ms, 10);

// Scene cuts from the shell's background sweep: null while it runs (or when
// not in the shell), ms times when done. Polls until the shell answers - an
// empty answer (shadow unavailable) also stops the polling.
const useSceneCuts = (streamUrl: string | null): number[] | null => {
    const [cuts, setCuts] = useState<number[] | null>(null);
    useEffect(() => {
        setCuts(null);
        const tauri = getTauri();
        if (typeof streamUrl !== 'string' || !tauri?.core?.invoke) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const poll = () => {
            (tauri.core.invoke('player_scene_cuts', { url: streamUrl }) as Promise<number[] | null>)
                .then((result) => {
                    if (cancelled) return;
                    if (Array.isArray(result)) {
                        setCuts(result.map((sec) => Math.round(sec * 1000)));
                    } else {
                        timer = setTimeout(poll, SCENE_POLL_MS);
                    }
                })
                .catch(() => {
                    // A transient invoke failure (shell busy, startup race) must
                    // not end the polling - the sweep may still be running.
                    if (!cancelled) {
                        timer = setTimeout(poll, SCENE_POLL_MS);
                    }
                });
        };
        poll();
        return () => {
            cancelled = true;
            if (timer !== null) clearTimeout(timer);
        };
    }, [streamUrl]);
    return cuts;
};

// Silence-gap boundaries from an external subtitle track's cue timings.
const useSubtitleGaps = (trackUrl: string | null): number[] | null => {
    const [gaps, setGaps] = useState<number[] | null>(null);
    useEffect(() => {
        setGaps(null);
        if (typeof trackUrl !== 'string' || !/^https?:/i.test(trackUrl)) return;
        let cancelled = false;
        fetch(trackUrl)
            .then((resp) => resp.ok ? resp.text() : Promise.reject(new Error(`${resp.status}`)))
            .then((text) => {
                if (cancelled) return;
                const cues: { start: number, end: number }[] = [];
                for (const match of text.matchAll(CUE_RE)) {
                    cues.push({
                        start: cueMs(match[1], match[2], match[3], match[4]),
                        end: cueMs(match[5], match[6], match[7], match[8]),
                    });
                }
                cues.sort((a, b) => a.start - b.start);
                const found: number[] = [];
                for (let i = 1; i < cues.length; i++) {
                    const gap = cues[i].start - cues[i - 1].end;
                    if (gap >= SUBTITLE_GAP_MS) {
                        found.push(cues[i - 1].end + gap / 2);
                    }
                }
                setGaps(found);
            })
            .catch(() => { /* CORS / dead url: this source just stays absent */ });
        return () => { cancelled = true; };
    }, [trackUrl]);
    return gaps;
};

export const useTimelineChapters = (
    realChapters: TimelineChapter[],
    streamUrl: string | null,
    subtitleTrackUrl: string | null,
): TimelineChapter[] => {
    const sceneCuts = useSceneCuts(streamUrl);
    const subtitleGaps = useSubtitleGaps(subtitleTrackUrl);
    return useMemo(() => {
        const merged: TimelineChapter[] = Array.isArray(realChapters) ? [...realChapters] : [];
        const addUnlessCovered = (times: number[] | null) => {
            for (const time of times ?? []) {
                if (merged.every((chapter) => Math.abs(chapter.time - time) >= MERGE_WINDOW_MS)) {
                    merged.push({ time, title: null });
                }
            }
        };
        addUnlessCovered(subtitleGaps);
        addUnlessCovered(sceneCuts);
        return merged.sort((a, b) => a.time - b.time);
    }, [realChapters, sceneCuts, subtitleGaps]);
};

export default useTimelineChapters;
