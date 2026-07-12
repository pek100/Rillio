// Global bus for the Sync modal (opened from the account menu / settings, shown
// by a top-level <SyncModal/> mounted in App). Follows the app's modals-not-routes
// convention: dispatch a window CustomEvent, a single mounted modal listens.
export const OPEN_SYNC_EVENT = 'rillio:open-sync';

export type SyncTab = 'backup' | 'stremio' | 'upload';

export const openSync = (tab: SyncTab = 'backup'): void => {
    window.dispatchEvent(new CustomEvent(OPEN_SYNC_EVENT, { detail: { tab } }));
};
