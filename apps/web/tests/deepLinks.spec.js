// Copyright (C) 2017-2026 Smart code 203358507

const { parseDeepLink } = require('../src/common/deepLinks');

describe('parseDeepLink', () => {
    describe('route links (empty authority, as core emits)', () => {
        it('maps stremio:/// detail to a route', () => {
            expect(parseDeepLink('stremio:///detail/movie/tt0111161'))
                .toEqual({ type: 'route', path: '/detail/movie/tt0111161' });
        });

        it('accepts the canonical rillio:// scheme too', () => {
            expect(parseDeepLink('rillio:///detail/movie/tt0111161'))
                .toEqual({ type: 'route', path: '/detail/movie/tt0111161' });
        });

        it('maps metadetails with a videoId', () => {
            expect(parseDeepLink('stremio:///metadetails/series/tt123/1:1'))
                .toEqual({ type: 'route', path: '/metadetails/series/tt123/1:1' });
        });

        it('maps a player link', () => {
            expect(parseDeepLink('stremio:///player/aHR0cA/st/mt/movie/tt1/v1'))
                .toEqual({ type: 'route', path: '/player/aHR0cA/st/mt/movie/tt1/v1' });
        });

        it('maps a 3-segment discover link', () => {
            expect(parseDeepLink('stremio:///discover/turl/movie/top'))
                .toEqual({ type: 'route', path: '/discover/turl/movie/top' });
        });

        it('preserves the query string on a search link', () => {
            expect(parseDeepLink('stremio:///search?query=batman'))
                .toEqual({ type: 'route', path: '/search?query=batman' });
        });

        it('maps the addons ROUTE (not an install link)', () => {
            expect(parseDeepLink('stremio:///addons/movie/turl/catId'))
                .toEqual({ type: 'route', path: '/addons/movie/turl/catId' });
        });

        it('maps the board root', () => {
            expect(parseDeepLink('stremio:///'))
                .toEqual({ type: 'route', path: '/' });
        });

        it('maps calendar and library roots', () => {
            expect(parseDeepLink('stremio:///calendar/2026/7'))
                .toEqual({ type: 'route', path: '/calendar/2026/7' });
            expect(parseDeepLink('stremio:///library'))
                .toEqual({ type: 'route', path: '/library' });
        });
    });

    describe('addon-install links (host-bearing, .../manifest.json)', () => {
        it('maps a bare host manifest to its https transport url', () => {
            expect(parseDeepLink('stremio://v3-cinemeta.strem.io/manifest.json'))
                .toEqual({ type: 'addon', transportUrl: 'https://v3-cinemeta.strem.io/manifest.json' });
        });

        it('preserves a configured manifest path', () => {
            expect(parseDeepLink('stremio://addon.example.com/some/config/manifest.json'))
                .toEqual({ type: 'addon', transportUrl: 'https://addon.example.com/some/config/manifest.json' });
        });

        it('preserves the port', () => {
            expect(parseDeepLink('stremio://127.0.0.1:11470/manifest.json'))
                .toEqual({ type: 'addon', transportUrl: 'https://127.0.0.1:11470/manifest.json' });
        });

        it('works with the rillio:// scheme too', () => {
            expect(parseDeepLink('rillio://addon.example.com/manifest.json'))
                .toEqual({ type: 'addon', transportUrl: 'https://addon.example.com/manifest.json' });
        });
    });

    describe('rejections (untrusted OS input, fail closed)', () => {
        it('rejects non-string / empty input', () => {
            expect(parseDeepLink(null)).toBeNull();
            expect(parseDeepLink(undefined)).toBeNull();
            expect(parseDeepLink('')).toBeNull();
            expect(parseDeepLink(42)).toBeNull();
        });

        it('rejects disallowed schemes', () => {
            for (const bad of [
                'http://evil.com/x',
                'https://evil.com/x',
                'magnet:?xt=urn:btih:abc',
                'file:///C:/Windows/System32/calc.exe',
                'javascript:alert(1)',
                'ms-msdt:/id',
                'made-up://whatever',
            ]) {
                expect(parseDeepLink(bad)).toBeNull();
            }
        });

        it('rejects unparseable urls', () => {
            expect(parseDeepLink('not a url')).toBeNull();
            expect(parseDeepLink('stremio')).toBeNull();
        });

        it('rejects unknown route paths', () => {
            expect(parseDeepLink('stremio:///bogus/route')).toBeNull();
            expect(parseDeepLink('stremio:///settings/extra')).toBeNull();
            // metadetails needs at least type + id
            expect(parseDeepLink('stremio:///metadetails')).toBeNull();
            // player needs a stream segment
            expect(parseDeepLink('stremio:///player')).toBeNull();
        });

        it('rejects a host-bearing link that is not a manifest (segment would be dropped)', () => {
            // stremio://detail/... parses `detail` as the host; refusing it avoids
            // silently navigating to the wrong (host-stripped) path.
            expect(parseDeepLink('stremio://detail/movie/tt1')).toBeNull();
        });
    });
});
