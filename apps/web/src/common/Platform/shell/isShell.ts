import { useEffect, useState } from 'react';

// Single source of truth for "are we running inside the Tauri desktop shell".
// Tauri always injects `__TAURI_INTERNALS__` into every webview, and
// `withGlobalTauri` (enabled in apps/desktop/src-tauri/tauri.conf.json)
// additionally exposes the JS API on `window.__TAURI__`. Detect on either
// signal rather than the narrower `__TAURI__.core.invoke`, which can read
// false if the global attaches a tick after first render; components that
// render early must use the reactive hooks below. The web build has neither
// global, so everything here stays false/undefined there.
export const isShell = (): boolean => {
    const w = globalThis as any;
    return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
};

// The full Tauri JS API (`window.__TAURI__`). Code that talks to the shell
// (core.invoke / event.listen / window) must key on this, NOT on isShell():
// shell presence does not guarantee the API object has attached yet.
export const getTauri = (): any => (globalThis as any).__TAURI__;

// Seeds from the probe and re-checks briefly after mount, so a component that
// first rendered before the Tauri global attached still flips true; a plain
// probe call is evaluated once and never re-runs.
const useLateSignal = (probe: () => boolean): boolean => {
    const [on, setOn] = useState(probe);
    useEffect(() => {
        if (on) return undefined;
        if (probe()) { setOn(true); return undefined; }
        const id = setInterval(() => { if (probe()) { setOn(true); clearInterval(id); } }, 200);
        const stop = setTimeout(() => clearInterval(id), 3000);
        return () => { clearInterval(id); clearTimeout(stop); };
    }, [on]);
    return on;
};

export const useIsShell = (): boolean => useLateSignal(isShell);

// Reactive form of getTauri(): undefined until `window.__TAURI__` has a
// working core.invoke, then the API object (stable identity, it is the
// injected global). Use this to select IPC transports, so the choice cannot
// disagree with what invoke() can actually do.
export const useTauriApi = (): any => {
    const ready = useLateSignal(() => !!getTauri()?.core?.invoke);
    return ready ? getTauri() : undefined;
};
