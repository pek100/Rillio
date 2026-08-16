// Boot-time guard against the "my data is gone" illusion (incident 2026-08-16):
// a WebView2 session can come up with its DOM-storage plane dead - every
// localStorage read returns empty and every write is silently dropped - while
// the real data sits INTACT in the profile's "Local Storage" leveldb on disk.
// An unguarded boot then runs the whole app against a default profile, which
// the user experiences as a wipe (and which WOULD become a real wipe the
// moment such a session, or a transiently-empty read, gets working writes).
//
// The guard: every healthy boot stamps a sentinel key. On the next boot, if
// localStorage answers empty (no sentinel, no user data) but the shell reports
// a non-trivial Local Storage database on disk, storage is UNREADABLE, not
// empty - the app must refuse to boot the core (which would persist defaults)
// and tell the user their data is safe, instead of silently reinitializing.
//
// Outside the shell there is no disk oracle, so an empty read is trusted there
// (first run and unreadable are indistinguishable in a plain browser).

import { getTauri, isShell } from 'rillio/common/Platform/shell/isShell';

// Written on every healthy boot. RAW key, deliberately not per-profile: it
// says "this install has data", not "this profile has data".
export const SENTINEL_KEY = 'rillio.storage.sentinel';

// Keys that exist in any install that has ever booted, whichever profile is
// active (the registry and the default profile's core buckets are unprefixed).
const USER_DATA_KEYS = [
    'rillio.profiles.registry',
    'installation_id',
    'schema_version',
    'profile',
];

export type StorageVerdict = 'ok' | 'first-run' | 'unreadable';

// The pure decision lives in a CommonJS sibling so the jest suite can require
// it directly (this repo's jest has no TS transform); this module owns the
// browser/shell wiring around it.
const { assessStorage } = require('./storageGuardAssess') as {
    assessStorage: (sentinelPresent: boolean, userDataPresent: boolean, diskBytes: number | null) => StorageVerdict,
};
export { assessStorage };

const readLocalStorageState = (): { sentinelPresent: boolean, userDataPresent: boolean, readable: boolean } => {
    try {
        return {
            sentinelPresent: window.localStorage.getItem(SENTINEL_KEY) !== null,
            userDataPresent: USER_DATA_KEYS.some((key) => window.localStorage.getItem(key) !== null),
            readable: true,
        };
    } catch (error) {
        // localStorage itself throwing (SecurityError) is the hard form of the
        // same failure: nothing can be read, so nothing may be persisted.
        console.error('storageGuard: localStorage is inaccessible', error);
        return { sentinelPresent: false, userDataPresent: false, readable: false };
    }
};

// The Tauri API global can attach a tick after the first scripts run; retry
// briefly before concluding it is not coming (mirrors common/serverAddress).
const waitForInvoke = async (timeoutMs: number): Promise<((cmd: string) => Promise<any>) | null> => {
    const startedAt = Date.now();
    for (;;) {
        const invoke = getTauri()?.core?.invoke;
        if (typeof invoke === 'function') return invoke;
        if (Date.now() - startedAt >= timeoutMs) return null;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
};

/**
 * Boot check. Resolves 'unreadable' when the app MUST NOT run the core
 * against what localStorage answered. Never rejects: an error in the probe
 * itself degrades to trusting localStorage (the pre-guard behavior).
 */
export const runStorageGuard = async (): Promise<StorageVerdict> => {
    const state = readLocalStorageState();
    if (!isShell()) {
        // No disk oracle outside the shell: trust whatever localStorage said.
        return assessStorage(state.sentinelPresent, state.userDataPresent, null);
    }
    if (state.sentinelPresent || state.userDataPresent) return 'ok';
    // A shell session where localStorage THROWS is never trustworthy,
    // whatever the disk probe would say.
    if (!state.readable) return 'unreadable';
    // Empty read in the shell: ask the disk before trusting it as a first run.
    let diskBytes: number | null = null;
    const invoke = await waitForInvoke(3000);
    if (invoke !== null) {
        try {
            const health = await invoke('storage_health');
            if (health && typeof health.localStorageBytes === 'number') {
                diskBytes = health.localStorageBytes;
            }
        } catch (error) {
            console.error('storageGuard: storage_health failed', error);
        }
    }
    return assessStorage(state.sentinelPresent, state.userDataPresent, diskBytes);
};

/** Stamp the sentinel; called once the boot is trusted. Best-effort. */
export const stampStorageSentinel = (): void => {
    try {
        window.localStorage.setItem(SENTINEL_KEY, new Date().toISOString());
    } catch (error) {
        console.error('storageGuard: could not stamp the sentinel', error);
    }
};

