// Export / import the whole local account as one compact code. Everything the
// core persists lives in window.localStorage (crates/core/src/constants.rs), so a
// backup is just those keys (plus our local display name) bundled, gzip'd, and
// base64'd. Import writes them back and the caller reloads so the core re-reads.
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

// Binary <-> base64 without Buffer (chunked so large arrays don't blow the stack).
const bytesToBase64 = (bytes: Uint8Array): string => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(bin);
};
const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

// Buckets the Rust core reads on boot. `schema_version` is included so an import
// stays internally consistent with the buckets it shipped with.
const CORE_KEYS = [
    'profile',
    'library',
    'library_recent',
    'streams',
    'search_history',
    'streaming_server_urls',
    'notifications',
    'calendar',
    'dismissed_events',
    'schema_version',
];
const NAME_KEY = 'rillio.displayName';
const ALL_KEYS = [...CORE_KEYS, NAME_KEY];

// Encode the local account into a paste/scan-friendly base64 string.
export const exportLocalData = (): string => {
    const data: Record<string, string> = {};
    for (const k of ALL_KEYS) {
        const v = window.localStorage.getItem(k);
        if (v !== null) data[k] = v;
    }
    const json = JSON.stringify({ v: 1, data });
    const gz = gzipSync(strToU8(json), { level: 9 });
    return bytesToBase64(gz);
};

// Decode a code and write the buckets back. Only known keys are written; anything
// else in the payload is ignored. Caller should reload the page on success.
export const importLocalData = (code: string): { ok: boolean; error?: string; keys?: number } => {
    const trimmed = (code || '').trim();
    if (!trimmed) return { ok: false, error: 'Paste a sync code first.' };
    let parsed: any;
    try {
        parsed = JSON.parse(strFromU8(gunzipSync(base64ToBytes(trimmed))));
    } catch {
        return { ok: false, error: 'Could not read that code — it may be truncated or corrupted.' };
    }
    if (!parsed || parsed.v !== 1 || typeof parsed.data !== 'object') {
        return { ok: false, error: 'This does not look like a Rillio sync code.' };
    }
    let keys = 0;
    for (const k of ALL_KEYS) {
        if (typeof parsed.data[k] === 'string') {
            try { window.localStorage.setItem(k, parsed.data[k]); keys++; } catch { /* full/blocked */ }
        }
    }
    if (keys === 0) return { ok: false, error: 'The code contained no account data.' };
    return { ok: true, keys };
};

// Rewrite a persisted bucket's owner id to anonymous (null). Used after a one-time
// Stremio import so the pulled library/notifications load under the local guest.
export const anonymizeBucket = (key: string): void => {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && 'uid' in obj) {
            obj.uid = null;
            window.localStorage.setItem(key, JSON.stringify(obj));
        }
    } catch {
        /* leave the bucket as-is if it isn't the shape we expect */
    }
};
