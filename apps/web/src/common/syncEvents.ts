// Global bus for the Sync modal (opened from the account menu / settings, shown
// by a top-level <SyncModal/> mounted in App). Follows the app's modals-not-routes
// convention: dispatch a window CustomEvent, a single mounted modal listens.
export const OPEN_SYNC_EVENT = 'rillio:open-sync';

export type SyncTab = 'export' | 'import' | 'stremio';

export const openSync = (tab: SyncTab = 'export'): void => {
    window.dispatchEvent(new CustomEvent(OPEN_SYNC_EVENT, { detail: { tab } }));
};
