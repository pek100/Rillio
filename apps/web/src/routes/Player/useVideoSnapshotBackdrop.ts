// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Polls the shell for a snapshot of the current video frame while a player panel is
 * open, for the menus'/drawer's blurred backdrop (see SnapshotBackdrop for why the
 * frame has to come from the shell at all).
 *
 * Cost is zero when nothing is open: the poll only runs while `open`, and the shell
 * rate-limits real captures on its side too.
 *
 * FAILS QUIET: outside the shell, or once the shell has errored a few times in a row
 * (no video loaded, a libmpv without screenshot support, ...), this returns null
 * forever after and stops polling. Null means the panels render exactly as they do
 * today, dark glass only - never a spinner, never a crash. One console.warn marks it.
 *
 * DISABLED (2026-07): the capture is a CPU round-trip - mpv pulls the frame back from
 * the GPU (a hwdec readback that can stall), writes it to disk, we re-read and decode
 * it. Switching mpv from PNG to JPEG cut it hard, but the floor is still tens to
 * hundreds of ms and a ~3fps backdrop reads as lag, not as a material. The panels are
 * instantly dark instead. The real answer is a GPU-side mpv GLSL user shader blurring
 * the panel's rect live, which is its own project: it hooks the render pipeline that
 * carries the HDR passthrough (target-colorspace-hint=source + DV RPU), so it needs a
 * flag and an HDR verification pass. All the plumbing below (and the shell's
 * player_snapshot command) stays for whichever way that lands.
 */

import { useEffect, useState } from 'react';
import { useTauriApi } from 'rillio/common/Platform/shell/isShell';

// The kill switch for the paragraph above. Flip to true to get the snapshot
// backdrop back exactly as it was.
const SNAPSHOT_BACKDROP_ENABLED = false;

// ~3fps. The backdrop lives under a 24px blur and 55% black, so it only has to be
// "live enough"; the shell's own guard rejects anything faster than 200ms.
const SNAPSHOT_INTERVAL = 330;
// Consecutive failures after which we give up for this open panel. One transient
// error (a frame between loads) must not disable the backdrop for good.
const MAX_ERRORS = 3;

const useVideoSnapshotBackdrop = (open: boolean): string | null => {
    const TAURI = useTauriApi();
    const [snapshot, setSnapshot] = useState<string | null>(null);

    useEffect(() => {
        if (!SNAPSHOT_BACKDROP_ENABLED || !open || !TAURI?.core?.invoke) {
            setSnapshot(null);
            return undefined;
        }

        let cancelled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let errors = 0;

        const tick = async () => {
            try {
                const dataUrl = await TAURI.core.invoke('player_snapshot');
                if (cancelled) return;
                if (typeof dataUrl === 'string' && dataUrl.length > 0) {
                    setSnapshot(dataUrl);
                    errors = 0;
                }
            } catch (e) {
                if (cancelled) return;
                errors += 1;
                if (errors === 1) {
                    console.warn('Player', 'video snapshot backdrop unavailable, falling back to plain glass', e);
                }
                if (errors >= MAX_ERRORS) {
                    setSnapshot(null);
                    return; // stop polling; the panels keep their dark glass
                }
            }
            if (!cancelled) {
                timeout = setTimeout(tick, SNAPSHOT_INTERVAL);
            }
        };
        tick();

        return () => {
            cancelled = true;
            if (timeout !== null) clearTimeout(timeout);
            setSnapshot(null);
        };
    }, [open, TAURI]);

    return snapshot;
};

export default useVideoSnapshotBackdrop;
