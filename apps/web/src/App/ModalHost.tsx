// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Renders the app's four global modals (Addons / Settings / Cached / Search) at
 * the app root, gated on the modal bus (common/modalEvents). They float over the
 * live routes beneath (each is a self-contained floating layer / portal), and
 * closing is a pure bus close, never a history navigation. One modal at a time:
 * the store only ever holds a single open name.
 */

import React from 'react';
import routes from 'rillio/routes';
import SearchModal from 'rillio/components/SearchModal';
import { useModalState, closeModal } from 'rillio/common/modalEvents';

const ModalHost = () => {
    const { name, payload } = useModalState();

    switch (name) {
        case 'addons':
            return <routes.Addons payload={payload} onClose={closeModal} />;
        case 'settings':
            return <routes.Settings onClose={closeModal} />;
        case 'cached':
            return <routes.Cached onClose={closeModal} />;
        case 'search':
            return <SearchModal onClose={closeModal} />;
        default:
            return null;
    }
};

export default ModalHost;
