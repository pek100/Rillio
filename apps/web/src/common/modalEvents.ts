// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Global bus for the app's four top-level modals (Addons, Settings, Cached, and
 * the Search palette). Same modals-not-routes convention as the Sync modal
 * (common/syncEvents): the modal lifecycle NEVER touches the URL or browser
 * history, so closing can never overshoot a back-step or trap the user (the bug
 * the old modal-routes + useCloseModalRoute navigate(-1) guesswork produced).
 *
 * Where syncEvents dispatches a window CustomEvent, this bus keeps a tiny
 * top-level store: the four modals need one-at-a-time coordination plus a
 * payload, which a subscribable store expresses more cleanly than an event. Both
 * are "a global bus, not a URL" per the house rule. Read it with useModalState;
 * open/close from anywhere (no provider scoping) with openModal / closeModal.
 */

import { useSyncExternalStore } from 'react';

export type ModalName = 'addons' | 'settings' | 'cached' | 'search';

// Addons is the only modal with a sub-view a deep link can pre-expand: a catalog
// filter (type/transportUrl/catalogId) and/or the addon-details pane (addon =
// transport url). All of this used to live in the URL; it is now modal-local,
// handed in once as the open payload.
export type AddonsPayload = {
    type?: string,
    transportUrl?: string,
    catalogId?: string,
    addon?: string,
};

export type ModalState = {
    name: ModalName | null,
    payload?: AddonsPayload,
};

const CLOSED: ModalState = { name: null };

let state: ModalState = CLOSED;
const listeners = new Set<() => void>();
const emit = (): void => { listeners.forEach((listener) => listener()); };

// One modal at a time: opening any modal replaces whatever was open (a Search
// palette invoked over Settings simply takes over, matching user expectation).
export const openModal = (name: ModalName, payload?: AddonsPayload): void => {
    state = { name, payload };
    emit();
};

export const closeModal = (): void => {
    if (state.name === null) {
        return;
    }
    state = CLOSED;
    emit();
};

const subscribe = (onStoreChange: () => void): (() => void) => {
    listeners.add(onStoreChange);
    return () => { listeners.delete(onStoreChange); };
};

const getSnapshot = (): ModalState => state;

export const useModalState = (): ModalState => useSyncExternalStore(subscribe, getSnapshot);

// Debug handle for CDP sessions (see the matching note in ui/use-toast): the
// single-chunk bundle exposes no module graph, so this is the supported hatch
// for driving the modal bus from a devtools session.
if (typeof window !== 'undefined') {
    (window as unknown as { __rillioOpenModal?: typeof openModal }).__rillioOpenModal = openModal;
}
