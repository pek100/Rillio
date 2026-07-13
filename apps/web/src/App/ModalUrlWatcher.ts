// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Bridges legacy modal URLs into the modal bus. The modals are no longer routes,
 * but three entry points still arrive as URLs and must keep working:
 *   - stremio-addons.net install links and OS deep links (stremio:// / rillio://)
 *     that land the app on #/addons?addon=<manifest-url>,
 *   - any of the four old modal paths (#/addons, #/settings, #/cached,
 *     #/search-palette) opened directly (typed, bookmarked, or forwarded).
 * When the app lands on one, open the matching modal (Addons pre-expanded from
 * the URL, per the "deep links open the modal pre-expanded" rule) and normalize
 * the URL away with a REPLACE, so a modal entry is never left in history.
 *
 * The work runs in a layout effect so the URL is normalized before paint (no
 * NotFound flash on a cold deep-link start).
 */

import React from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router';
import { openModal } from 'rillio/common/modalEvents';

// Same param shape the old /addons route matched, so a deep link parses
// identically to before (matchPath decodes the transportUrl segment for us).
const ADDONS_PATH = '/addons/:type?/:transportUrl?/:catalogId?';

const ModalUrlWatcher = () => {
    const location = useLocation();
    const navigate = useNavigate();

    React.useLayoutEffect(() => {
        const { pathname, search } = location;

        const addonsMatch = matchPath({ path: ADDONS_PATH, end: true }, pathname);
        if (addonsMatch) {
            const { type, transportUrl, catalogId } = addonsMatch.params;
            const addon = new URLSearchParams(search).get('addon');
            openModal('addons', {
                type: type ?? undefined,
                transportUrl: transportUrl ?? undefined,
                catalogId: catalogId ?? undefined,
                addon: addon ?? undefined,
            });
            navigate('/', { replace: true });
            return;
        }

        if (matchPath({ path: '/settings', end: true }, pathname)) {
            openModal('settings');
            navigate('/', { replace: true });
            return;
        }

        if (matchPath({ path: '/cached', end: true }, pathname)) {
            openModal('cached');
            navigate('/', { replace: true });
            return;
        }

        if (matchPath({ path: '/search-palette', end: true }, pathname)) {
            openModal('search');
            navigate('/', { replace: true });
        }
    }, [location, navigate]);

    return null;
};

export default ModalUrlWatcher;
