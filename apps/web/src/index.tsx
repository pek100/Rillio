// Copyright (C) 2017-2023 Smart code 203358507

import './styles/tailwind.css';
import Bowser from 'bowser';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import stremioTranslations from 'rillio-translations';
// Side effect only: gives packages/video the streaming-server address resolver
// and transport (see common/videoServerContext). Sits ahead of the app graph so
// it cannot lose a race with the first video load.
import './common/videoServerContext';
import App from './App';
import { CoreProvider } from './core';
import { FileDropProvider, PlatformProvider } from './common';
import {
    runStorageGuard,
    stampStorageSentinel,
    decideUnreadableAction,
    autoRetryDelayMs,
    getStorageRetryCount,
    incrementStorageRetryCount,
    resetStorageRetryCount,
} from './common/storageGuard';
import { getTauri } from './common/Platform/shell/isShell';
// NEVER run the cache-first service worker inside the desktop shell. The shell's
// assets are embedded and swapped in whole by the native updater, and the asset
// path is prefixed with the (stable-between-rebuilds) commit hash, so a
// cache-first SW keeps serving the OLD bundle after every update, and the new UI
// never appears. Detect the shell via the shared predicate.
import { isShell } from './common/Platform/shell/isShell';

const browser = Bowser.parse(window.navigator?.userAgent || '');
if (browser?.platform?.type === 'desktop') {
    document.querySelector('meta[name="viewport"]')?.setAttribute('content', '');
}

const translations = Object.fromEntries(Object.entries(stremioTranslations()).map(([key, value]) => [key, {
    translation: value
}]));

i18n
    .use(initReactI18next)
    .init({
        resources: translations,
        lng: 'en-US',
        fallbackLng: 'en-US',
        interpolation: {
            escapeValue: false
        }
    });

const appInfo = {
    appVersion: process.env.VERSION,
    shellVersion: null
};

const root = ReactDOM.createRoot(document.getElementById('app')!);

// The normal app graph. Reached from the trusted-boot path AND from the
// refusal screen's continue-anyway escape hatch, so it must be callable twice
// never - the guard IIFE and the button are mutually exclusive paths.
const mountApp = () => {
    document.getElementById('rillio-loading')?.classList.add('rl-hide');
    root.render(
        <React.StrictMode>
            <PlatformProvider>
                <CoreProvider appInfo={appInfo}>
                    <FileDropProvider>
                        <HashRouter>
                            <App />
                        </HashRouter>
                    </FileDropProvider>
                </CoreProvider>
            </PlatformProvider>
        </React.StrictMode>
    );
};

// Storage-unreadable refusal screen (see common/storageGuard). Deliberately
// self-contained: the app graph must NOT mount (mounting boots the core, and
// the core would persist a default profile over whatever this session cannot
// read). Restart goes through the shell when available; reloading the page
// would reuse the same broken browser session.
const StorageUnreadable = () => {
    const t = i18n.t.bind(i18n);
    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-bg p-8 text-center text-fg">
            <div className="text-xl font-semibold">
                {t('STORAGE_UNREADABLE_TITLE', 'Rillio can\'t read its saved data')}
            </div>
            <div className="max-w-md text-sm opacity-80">
                {t('STORAGE_UNREADABLE_BODY', 'Your profile and library are intact on disk, but this session came up without access to them. To avoid overwriting anything, Rillio won\'t start with a blank profile. Close Rillio completely and open it again.')}
            </div>
            <button
                className="rounded-full bg-[#FFA033] px-6 py-2 text-sm font-semibold text-black hover:brightness-110"
                onClick={() => {
                    const invoke = getTauri()?.core?.invoke;
                    if (typeof invoke === 'function') {
                        // A manual restart is still a restart attempt: count it,
                        // so the counter keeps meaning "restarts attempted this
                        // streak". Restart even if counting fails - the user
                        // asked for it, and this path cannot loop on its own.
                        incrementStorageRetryCount()
                            .catch((error: unknown) => console.error('storage_retry_increment failed', error))
                            .then(() => invoke('restart_app'))
                            .catch((error: unknown) => console.error('restart_app failed', error));
                    }
                }}
            >
                {t('STORAGE_UNREADABLE_RESTART', 'Restart Rillio')}
            </button>
            {/* Escape hatch (v0.1.30 locked users into this screen when the broken
                browser session outlived restarts): boot anyway, AFTER snapshotting
                the on-disk stores, so even the worst case (empty reads + working
                writes overwriting the profile) stays recoverable. */}
            <button
                className="text-xs text-fg opacity-50 hover:opacity-90"
                onClick={() => {
                    // Continue-anyway RESETS the retry counter (deliberate): the
                    // user is abandoning this dead-storage streak and booting the
                    // session, so a future streak deserves its own fresh
                    // auto-retry budget instead of inheriting a spent one.
                    resetStorageRetryCount();
                    const invoke = getTauri()?.core?.invoke;
                    const snapshot = typeof invoke === 'function' ?
                        invoke('snapshot_storage').catch((error: unknown) => console.error('snapshot_storage failed', error))
                        :
                        Promise.resolve();
                    snapshot.then(() => mountApp());
                }}
            >
                {t('STORAGE_UNREADABLE_CONTINUE', 'Continue anyway (a backup of your data is saved first)')}
            </button>
        </div>
    );
};

// Interim screen for an automatic dead-storage restart: shown for the moment
// between the 'unreadable' verdict and the shell tearing the window down (see
// decideUnreadableAction in common/storageGuardAssess). No controls on
// purpose, the restart is already in flight.
const StorageReconnecting = () => {
    const t = i18n.t.bind(i18n);
    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-bg p-8 text-center text-fg">
            <div className="text-xl font-semibold">
                {t('STORAGE_RECONNECTING_TITLE', 'Reconnecting to your data...')}
            </div>
            <div className="max-w-md text-sm opacity-80">
                {t('STORAGE_RECONNECTING_BODY', 'Rillio is restarting itself to reach your saved profile and library. This takes a few seconds.')}
            </div>
            <div className="h-1 w-24 animate-pulse rounded-full bg-[#FFA033]" />
        </div>
    );
};

// The guard owns the shell window reveal (index.html defers to
// window.__rillioReveal): healthy boots reveal at mount, dead-storage
// auto-retries keep the window HIDDEN through the whole delay+restart cycle
// so a streak reads as one quiet launch instead of the app opening and
// closing itself several times (observed live on v0.1.33, disliked).
const revealShellWindow = () => {
    try {
        (window as { __rillioReveal?: () => void }).__rillioReveal?.();
    } catch (error) {
        console.error('reveal failed', error);
    }
};

// The guard must settle BEFORE the core can exist: CoreProvider's transport
// boots the wasm core, whose empty reads would be persisted as a fresh default
// profile. 'unreadable' therefore renders the refusal screen INSTEAD of the app.
void (async () => {
    let verdict: 'ok' | 'first-run' | 'unreadable' = 'ok';
    try {
        verdict = await runStorageGuard();
    } catch (error) {
        // The guard never rejects by contract; treat a broken guard as no guard.
        console.error('storageGuard: unexpected failure, booting unguarded', error);
    }
    if (verdict === 'unreadable') {
        console.error('storageGuard: localStorage reads empty but the profile database on disk has data; refusing to boot the core');
        // The static splash overlay (#rillio-loading in index.html) is dismissed
        // by App.tsx on mount - a path this branch never takes. Without this the
        // refusal screen renders INVISIBLY underneath the splash and the user
        // sees an infinite loading logo (v0.1.29 hotfix; observed live).
        document.getElementById('rillio-loading')?.classList.add('rl-hide');
        // Each restart is a re-roll of the WebView2 coin flip, so retry a few
        // times automatically (counted in a SHELL-side file, since localStorage
        // is dead right now) before asking the user to. The pause before each
        // restart is deliberate and escalating: rapid restarts share the broken
        // fate, spaced ones heal (observed 2026-08-17). The window stays hidden
        // throughout; StorageReconnecting only shows if the shell's own
        // fallback reveal fires on a pathologically slow cycle.
        const retryCount = await getStorageRetryCount();
        if (decideUnreadableAction(retryCount, isShell()) === 'auto-retry') {
            const invoke = getTauri()?.core?.invoke;
            if (typeof invoke === 'function') {
                try {
                    root.render(<StorageReconnecting />);
                    // Count FIRST; if the attempt cannot be counted the retry
                    // loop could never end, so fall through to the manual
                    // screen instead of restarting.
                    await incrementStorageRetryCount();
                    // This boot restarts itself: cancel index.html's fallback
                    // reveal so no flicker, but arm a failsafe first - if the
                    // restart never tears us down, an invisible dead app is
                    // worse than the refusal screen.
                    setTimeout(() => {
                        revealShellWindow();
                        root.render(<StorageUnreadable />);
                    }, 20000);
                    (window as { __rillioSuppressReveal?: () => void }).__rillioSuppressReveal?.();
                    await new Promise((resolve) => setTimeout(resolve, autoRetryDelayMs(retryCount)));
                    // Fires the teardown; this session ends here, so the
                    // promise is not awaited (it never resolves).
                    invoke('restart_app').catch((error: unknown) => console.error('restart_app failed', error));
                    return;
                } catch (error) {
                    console.error('storageGuard: auto-retry could not be counted, showing the refusal screen', error);
                }
            }
        }
        revealShellWindow();
        root.render(<StorageUnreadable />);
        return;
    }
    stampStorageSentinel();
    // A trusted boot ends any dead-storage streak: give the next one a fresh
    // auto-retry budget. Fire-and-forget, no-op outside the shell.
    resetStorageRetryCount();
    revealShellWindow();
    mountApp();
})();

const rawServiceWorkerDisabled = process.env.SERVICE_WORKER_DISABLED as unknown;
const SERVICE_WORKER_DISABLED = rawServiceWorkerDisabled === 'true' || rawServiceWorkerDisabled === true;

const inShell = isShell();

if (process.env.NODE_ENV === 'production' && !SERVICE_WORKER_DISABLED && !inShell && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .catch((registrationError) => {
                console.error('SW registration failed: ', registrationError);
            });
    });
} else if ('serviceWorker' in navigator) {
    // Self-heal when the service worker is not used (the desktop shell, or a
    // build with it disabled): tear down any worker + precache a previous build
    // registered, so it stops serving a stale bundle. Then hard-reload once if a
    // worker was actually controlling this page (it had been serving stale).
    const controlled = !!navigator.serviceWorker.controller;
    Promise.all([
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .catch(() => { /* noop */ }),
        (typeof caches !== 'undefined' && caches.keys)
            ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => { /* noop */ })
            : Promise.resolve(),
    ]).then(() => {
        // Only reload if a worker had been intercepting (otherwise this page is
        // already fresh) and we have not reloaded for this reason before.
        if (controlled && !sessionStorage.getItem('rillio-sw-healed')) {
            sessionStorage.setItem('rillio-sw-healed', '1');
            window.location.reload();
        }
    });
}
