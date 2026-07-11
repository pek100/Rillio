// Copyright (C) 2017-2026 Smart code 203358507

// Pure translation of an OS deep link (stremio:// / rillio://) into an in-app
// action. Kept side-effect-free and dependency-light so it is unit-testable
// without a running shell (see tests/deepLinks.spec.js). The desktop shell
// (apps/desktop src/lib.rs) forwards the raw URL as the `deep-link-open` signal;
// DeepLinkOpenHandler feeds it here, then navigates on the result.
//
// This is UNTRUSTED input (a link the OS handed us from a browser / another
// app), so we fail closed: only the two registered schemes are accepted, route
// links are checked against the app's own route allowlist, and anything that
// does not match a known form returns null (the caller logs and ignores it).

const routesRegexp = require('./routesRegexp');

// The two schemes the desktop installer registers. stremio:// keeps existing
// ecosystem links (e.g. the stremio-addons.net "Install" buttons) working;
// rillio:// is the canonical one. URL#protocol includes the trailing colon.
const ALLOWED_PROTOCOLS = ['stremio:', 'rillio:'];

// Every route form the app actually serves, from the single source of truth in
// routesRegexp. A route deep link must match one of these or it is refused.
const ROUTE_REGEXPS = Object.keys(routesRegexp).map((key) => routesRegexp[key].regexp);

const isKnownRoute = (pathname) => ROUTE_REGEXPS.some((regexp) => regexp.test(pathname));

// Translate a deep link into one of:
//   { type: 'addon', transportUrl }  open the addon-details / install flow
//   { type: 'route', path }          navigate to an in-app route (path + query)
//   null                             reject (malformed / disallowed / unknown)
const parseDeepLink = (raw) => {
    if (typeof raw !== 'string' || raw.length === 0) {
        return null;
    }

    let url;
    try {
        url = new URL(raw);
    } catch (e) {
        // Unparseable (schemeless, bare path, ...) -> refuse.
        return null;
    }

    if (!ALLOWED_PROTOCOLS.includes(url.protocol.toLowerCase())) {
        return null;
    }

    // Addon-install link: stremio://<host>/<...>/manifest.json. The host-bearing
    // form is what the addon directory's "Install" buttons emit; it maps to the
    // https transport url of the addon manifest. (Internal route links carry an
    // empty authority, so a present host + a manifest.json path is unambiguous.)
    if (url.hostname.length > 0 && /\/manifest\.json$/i.test(url.pathname)) {
        return {
            type: 'addon',
            transportUrl: `https://${url.host}${url.pathname}${url.search}`,
        };
    }

    // Route link: the core emits stremio:///<segment>/... with an EMPTY
    // authority (see crates/core/src/deep_links), which is exactly the mapping
    // core-web mirrors when it rewrites stremio:// -> #. A leftover host here
    // would mean a segment got parsed as the authority, so refuse it rather than
    // silently drop it. The in-app path is pathname + query.
    if (url.hostname.length > 0) {
        return null;
    }
    if (!isKnownRoute(url.pathname)) {
        return null;
    }
    return {
        type: 'route',
        path: `${url.pathname}${url.search}`,
    };
};

module.exports = { parseDeepLink, isKnownRoute };
