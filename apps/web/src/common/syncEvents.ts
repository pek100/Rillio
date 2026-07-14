// Global bus for the Sync modal (opened from the account menu / settings, shown
// by a top-level <SyncModal/> mounted in App). Follows the app's modals-not-routes
// convention: dispatch a window CustomEvent, a single mounted modal listens.
export const OPEN_SYNC_EVENT = 'rillio:open-sync';

// Two destinations, not three. Import and Upload were separate tabs with two
// copies of the same Stremio sign-in form; they are one 'stremio' tab now (sign
// in once, then pick a direction), so 'upload' no longer names a place to open.
export type SyncTab = 'backup' | 'stremio';

export const openSync = (tab: SyncTab = 'backup'): void => {
    window.dispatchEvent(new CustomEvent(OPEN_SYNC_EVENT, { detail: { tab } }));
};
