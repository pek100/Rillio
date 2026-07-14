// Upload this device's local data to a Stremio account: the reverse of the Sync
// modal's "Import from Stremio". The core cannot do this with its dispatchable
// actions alone: Ctx.SyncLibraryWithAPI / Ctx.PushAddonsToAPI require a logged-in
// profile, but logging in (Ctx.Authenticate -> CtxAuthResult in
// crates/core/src/models/ctx/update_library.rs and update_profile.rs) REPLACES the
// local anonymous library and profile with the account's before anything could be
// pushed. So this module talks to the Stremio API directly with a temporary
// session, mirroring the core's own wire protocol byte for byte
// (crates/core/src/types/api/request.rs, fetch_api.rs), and never touches local
// state: read localStorage buckets, sign in, push, sign out.
//
// Semantics mirror the core's sync plan (plan_sync_with_api in update_library.rs):
// only items the account is missing, or that are newer on this device, are pushed;
// nothing on the account is ever deleted, and add-ons are merged (local ones the
// account lacks are appended), never replaced.

// Same endpoint the core uses (API_URL in crates/core/src/constants.rs).
const API_BASE = 'https://api.strem.io/api/';

// LIBRARY_COLLECTION_NAME in crates/core/src/constants.rs.
const LIBRARY_COLLECTION = 'libraryItem';

// Persisted LibraryItem, as the core stores it (crates/core/src/types/library/
// library_item.rs): the storage serde and the API serde are the same struct, so
// items read from localStorage can be sent to datastorePut verbatim.
type StoredLibraryItem = {
    _id: string;
    type: string;
    removed: boolean;
    _mtime: string;
    [key: string]: unknown;
};

type StoredAddon = {
    transportUrl: string;
    [key: string]: unknown;
};

export type UploadAuth =
    | { type: 'Login'; email: string; password: string; facebook?: boolean }
    | { type: 'Apple'; token: string; sub: string; email: string; name: string };

export type UploadResult = {
    itemsPushed: number;
    itemsConsidered: number;
    addonsAdded: number;
    // Of itemsPushed, how many are REMOVALS (removed: true). These are tombstones:
    // items taken out of the library, and the "temp" continue-watching entries that
    // were never explicitly added. They sync correctly and then show up nowhere,
    // which made "Sent 41 library items" read as a lie when 26 of the 41 were these
    // and only 15 appeared on the account. Reported separately so the result can say
    // what will actually be VISIBLE.
    removalsPushed: number;
};

// POST one API request and unwrap the { result } | { error: { message, code } }
// envelope (crates/core/src/types/api/response.rs). Any failure throws.
const apiFetch = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    let response: Response;
    try {
        response = await fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        throw new Error(`Could not reach the Stremio API (${path}). Check your connection and try again.`);
    }
    if (!response.ok) {
        throw new Error(`The Stremio API returned HTTP ${response.status} for ${path}.`);
    }
    let envelope: { result?: T; error?: { message?: string; code?: number } };
    try {
        envelope = await response.json();
    } catch {
        throw new Error(`The Stremio API sent an unreadable response for ${path}.`);
    }
    if (envelope.error) {
        throw new Error(envelope.error.message || `The Stremio API rejected the ${path} request.`);
    }
    if (!('result' in envelope) || envelope.result === undefined || envelope.result === null) {
        throw new Error(`The Stremio API sent an empty response for ${path}.`);
    }
    return envelope.result;
};

const readBucketItems = (key: string): Record<string, StoredLibraryItem> => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return {};
    let bucket: unknown;
    try {
        bucket = JSON.parse(raw);
    } catch {
        throw new Error(`The local "${key}" data is not valid JSON, cannot upload.`);
    }
    if (bucket === null || typeof bucket !== 'object' || typeof (bucket as { items?: unknown }).items !== 'object') {
        throw new Error(`The local "${key}" data does not look like a library bucket, cannot upload.`);
    }
    return ((bucket as { items: Record<string, StoredLibraryItem> | null }).items) || {};
};

// The core splits the library across two buckets (LIBRARY_RECENT_STORAGE_KEY +
// LIBRARY_STORAGE_KEY); merge them, recent bucket winning on overlap.
const readLocalLibraryItems = (): StoredLibraryItem[] => {
    const items = { ...readBucketItems('library'), ...readBucketItems('library_recent') };
    return Object.values(items);
};

const readLocalAddons = (): StoredAddon[] => {
    const raw = window.localStorage.getItem('profile');
    if (raw === null) return [];
    let profile: unknown;
    try {
        profile = JSON.parse(raw);
    } catch {
        throw new Error('The local profile data is not valid JSON, cannot upload add-ons.');
    }
    const addons = profile !== null && typeof profile === 'object' ? (profile as { addons?: unknown }).addons : null;
    if (!Array.isArray(addons)) return [];
    return addons.filter((addon): addon is StoredAddon =>
        addon !== null && typeof addon === 'object' && typeof addon.transportUrl === 'string');
};

// Mirror of LibraryItem::should_sync (crates/core/src/types/library/
// library_item.rs): skip "other" items, and skip removals older than a year.
const shouldSync = (item: StoredLibraryItem): boolean => {
    const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const mtime = Date.parse(item._mtime);
    if (!Number.isFinite(mtime)) return false;
    const recentlyRemoved = item.removed && mtime > yearAgo;
    return item.type !== 'other' && (!item.removed || recentlyRemoved);
};

// Sign in the same way Ctx.Authenticate does (AuthRequest serde in
// crates/core/src/types/api/request.rs), returning the temporary authKey.
const login = async (auth: UploadAuth): Promise<string> => {
    const path = auth.type === 'Apple' ? 'authWithApple' : 'login';
    const body = auth.type === 'Apple' ?
        { type: 'Apple', token: auth.token, sub: auth.sub, email: auth.email, name: auth.name } :
        { type: 'Login', email: auth.email, password: auth.password, facebook: auth.facebook === true };
    const result = await apiFetch<{ authKey?: string }>(path, body);
    if (typeof result.authKey !== 'string' || result.authKey.length === 0) {
        throw new Error('Signed in, but the Stremio API did not return a session key.');
    }
    return result.authKey;
};

// Push the library: ask the API for its per-item mtimes (datastoreMeta), then put
// only the items it is missing or that are newer here - the push half of the
// core's plan_sync_with_api, with identical second-granularity comparison.
const pushLibrary = async (authKey: string, items: StoredLibraryItem[]): Promise<{ pushed: number; considered: number; removals: number }> => {
    const syncable = items.filter(shouldSync);
    if (syncable.length === 0) return { pushed: 0, considered: 0, removals: 0 };
    const remoteMeta = await apiFetch<[string, number][]>('datastoreMeta', {
        authKey,
        collection: LIBRARY_COLLECTION,
    });
    const remoteSeconds = new Map<string, number>();
    for (const entry of remoteMeta) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number') {
            remoteSeconds.set(entry[0], Math.floor(entry[1] / 1000));
        }
    }
    const changes = syncable.filter((item) => {
        const remote = remoteSeconds.get(item._id);
        if (remote === undefined) return true;
        return remote < Math.floor(Date.parse(item._mtime) / 1000);
    });
    if (changes.length > 0) {
        await apiFetch<{ success: boolean }>('datastorePut', {
            authKey,
            collection: LIBRARY_COLLECTION,
            changes,
        });
    }
    return {
        pushed: changes.length,
        considered: syncable.length,
        removals: changes.filter((item) => item.removed === true).length,
    };
};

// Merge add-ons: append local add-ons the account is missing (matched by
// transportUrl); never remove or reorder what the account already has.
const pushAddons = async (authKey: string, localAddons: StoredAddon[]): Promise<number> => {
    if (localAddons.length === 0) return 0;
    const collection = await apiFetch<{ addons: StoredAddon[] | null }>('addonCollectionGet', {
        type: 'AddonCollectionGet',
        authKey,
        update: false,
    });
    const remoteAddons = Array.isArray(collection.addons) ? collection.addons : [];
    const remoteUrls = new Set(remoteAddons.map((addon) => addon.transportUrl));
    const missing = localAddons.filter((addon) => !remoteUrls.has(addon.transportUrl));
    if (missing.length === 0) return 0;
    await apiFetch<{ success: boolean }>('addonCollectionSet', {
        type: 'AddonCollectionSet',
        authKey,
        addons: [...remoteAddons, ...missing],
    });
    return missing.length;
};

// The whole upload: sign in, push library + add-ons, sign out. The temporary
// session is always closed (best effort), and local data is never modified.
export const uploadToStremio = async (
    auth: UploadAuth,
    onProgress: (stage: string) => void,
): Promise<UploadResult> => {
    // Read local data up front so storage problems fail before any network call.
    const items = readLocalLibraryItems();
    const addons = readLocalAddons();
    onProgress('Signing in…');
    const authKey = await login(auth);
    try {
        onProgress('Uploading library…');
        const { pushed, considered, removals } = await pushLibrary(authKey, items);
        onProgress('Uploading add-ons…');
        const addonsAdded = await pushAddons(authKey, addons);
        return { itemsPushed: pushed, itemsConsidered: considered, addonsAdded, removalsPushed: removals };
    } finally {
        // Close the temporary session; a failure here must not mask the outcome.
        apiFetch('logout', { type: 'Logout', authKey }).catch(() => { /* best effort */ });
    }
};
