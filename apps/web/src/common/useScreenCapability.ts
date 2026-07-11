import { useEffect, useState } from 'react';

// What the current display can actually show, used by the streams "Auto" preset.
// resolution is the panel's real pixel height (physical, dpr-scaled); hdr is true
// when the OS/panel report HDR is on (dynamic-range: high).
export type ScreenCapability = { resolutionHeight: number; hdr: boolean };

const read = (): ScreenCapability => {
    try {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round((window.screen?.width || 1920) * dpr);
        const h = Math.round((window.screen?.height || 1080) * dpr);
        // Use the long edge as the resolution class (landscape displays).
        const longEdge = Math.max(w, h);
        // Map physical width to a standard vertical class.
        const resolutionHeight = longEdge >= 3840 ? 2160 : longEdge >= 2560 ? 1440 : longEdge >= 1920 ? 1080 : 720;
        const hdr = !!(window.matchMedia && (
            window.matchMedia('(dynamic-range: high)').matches ||
            window.matchMedia('(video-dynamic-range: high)').matches
        ));
        return { resolutionHeight, hdr };
    } catch {
        return { resolutionHeight: 1080, hdr: false };
    }
};

export const useScreenCapability = (): ScreenCapability => {
    const [cap, setCap] = useState<ScreenCapability>(read);
    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const mq = window.matchMedia('(dynamic-range: high)');
        const onChange = () => setCap(read());
        try { mq.addEventListener('change', onChange); } catch { mq.addListener(onChange); }
        return () => { try { mq.removeEventListener('change', onChange); } catch { mq.removeListener(onChange); } };
    }, []);
    return cap;
};
