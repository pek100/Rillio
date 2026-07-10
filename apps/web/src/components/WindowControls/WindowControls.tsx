import React from 'react';

// True only inside the Tauri desktop shell. `withGlobalTauri` exposes the API
// on `window.__TAURI__`; the web build has no such global, so the custom chrome
// simply never renders there (the browser/OS draws its own).
const tauri = () => (globalThis as any).__TAURI__;
export const isShell = (): boolean => !!tauri()?.core?.invoke;
const currentWindow = () => tauri()?.window?.getCurrentWindow?.();

// The window is frameless (decorations off in the Tauri shell), so the web app
// draws its own controls. They float in the top-right on every route and stay
// clickable (never a drag region); a thin strip along the very top edge, plus
// the draggable nav on the main routes, moves the window.
const WindowControls = () => {
    const [maximized, setMaximized] = React.useState(false);

    React.useEffect(() => {
        if (!isShell()) return;
        const win = currentWindow();
        if (!win) return;

        let unlisten: (() => void) | undefined;
        let cancelled = false;

        const sync = () => win.isMaximized?.()
            .then((m: boolean) => { if (!cancelled) setMaximized(!!m); })
            .catch(() => { /* getter unavailable, keep last state */ });

        sync();
        win.onResized?.(sync)
            .then((un: () => void) => { if (cancelled) un(); else unlisten = un; })
            .catch(() => { /* no resize events, icon just won't flip */ });

        return () => { cancelled = true; if (unlisten) unlisten(); };
    }, []);

    if (!isShell()) return null;

    const minimize = () => currentWindow()?.minimize?.();
    const toggleMaximize = () => currentWindow()?.toggleMaximize?.();
    const close = () => currentWindow()?.close?.();

    const btn = 'flex h-full w-11 items-center justify-center text-fg-muted outline-none transition-colors duration-150';

    return (
        <>
            {/* Thin top-edge grab so the window drags on any route (kept short so
                it never overlaps the nav's own controls below it). */}
            <div data-tauri-drag-region className="fixed left-0 right-[8.25rem] top-0 z-[9000] h-2.5" />

            {/* Controls: always on top, always clickable (no drag region). */}
            <div className="fixed right-0 top-0 z-[100000] flex h-8 select-none">
                <button
                    type="button"
                    className={`${btn} hover:bg-white/10 hover:text-fg`}
                    onClick={minimize}
                    title="Minimize"
                    aria-label="Minimize"
                >
                    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                        <rect x="1" y="5" width="9" height="1" fill="currentColor" />
                    </svg>
                </button>
                <button
                    type="button"
                    className={`${btn} hover:bg-white/10 hover:text-fg`}
                    onClick={toggleMaximize}
                    title={maximized ? 'Restore' : 'Maximize'}
                    aria-label={maximized ? 'Restore' : 'Maximize'}
                >
                    {maximized ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                            <rect x="1.5" y="3.5" width="6" height="6" />
                            <path d="M3.5 3.5V1.5h6v6h-2" />
                        </svg>
                    ) : (
                        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                            <rect x="1.5" y="1.5" width="8" height="8" />
                        </svg>
                    )}
                </button>
                <button
                    type="button"
                    className={`${btn} hover:bg-[#e5484d] hover:text-white`}
                    onClick={close}
                    title="Close"
                    aria-label="Close"
                >
                    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" />
                    </svg>
                </button>
            </div>
        </>
    );
};

export default WindowControls;
