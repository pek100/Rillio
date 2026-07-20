// Copyright (C) 2017-2026 Smart code 203358507

// What media a cached torrent actually is.
//
// A torrent only knows its release name ("Some.Movie.2026.1080p.HEVC-GRP"), so
// the Cache page used to show scene filenames and could only recover a real
// title for the handful of items still in continue-watching. This module fills
// the gap from both ends:
//
//   1. EAGER (the reliable path): when playback starts from a real title in the
//      app, we already hold the full metadata - save it against the infoHash
//      right there.
//   2. MATCHED (the fallback): for a torrent that arrived without context (a
//      pasted magnet, a leftover from an old install), parse the release name
//      and search the INSTALLED ADDONS for it, exactly as the app's own search
//      does, then save the best match.
//
// Storage is the streaming server's sidecar (POST /cache/meta, returned on
// /cache/list), not localStorage: the cache is a server-side concept, and the
// mapping should survive a profile switch and a reinstall of the web bundle.
//
// The addon search is issued DIRECTLY over the addon protocol rather than
// through the core's CatalogsWithExtra model, because that model is a singleton
// shared with the Search page - driving it from a background matcher would
// stomp on whatever the user is searching for.

export type CacheMeta = {
    metaId: string,
    type: string,
    name: string,
    poster: string | null,
    background: string | null,
    logo: string | null,
    year: string | null,
    // Series only: the specific episode this torrent holds, so the Cache page
    // can label it and deep link to the right video.
    videoId?: string | null,
    season?: number | null,
    episode?: number | null,
    // The addons this title resolves through. Kept so playing from the cache can
    // build the FULL player deep link (`/player/:stream/:streamTransportUrl?
    // /:metaTransportUrl?/:type?/:id?/:videoId?`) and therefore load exactly the
    // way a catalog play does: real metadata, library progress, next episode.
    // Without them the player only ever gets a bare stream.
    metaTransportUrl?: string | null,
    streamTransportUrl?: string | null,
    // Which file inside the torrent this title/episode is. A season pack has no
    // single playable file (`fileIdx` on the cache entry is absent by design),
    // but on ONE episode's page we know exactly which one is wanted - this is
    // how that page can still offer Play.
    fileIdx?: number | null,
};

/**
 * The full player deep link for an identified cached torrent, or null when we
 * only know the stream. `encodedStream` comes from core.transport.encodeStream.
 *
 * Mirrors the route's positional shape, so a missing streamTransportUrl still
 * has to occupy its slot - the meta addon stands in, which is what the core
 * itself does for a stream that came from a title's own addon.
 */
export const playerDeepLink = (encodedStream: string, meta: CacheMeta | undefined): string => {
    const stream = encodeURIComponent(encodedStream);
    const metaUrl = meta?.metaTransportUrl;
    if (meta === undefined || typeof metaUrl !== 'string' || metaUrl.length === 0) {
        return `/player/${stream}`;
    }
    const streamUrl = meta.streamTransportUrl ?? metaUrl;
    const videoId = meta.videoId ?? meta.metaId;
    return `/player/${stream}/${encodeURIComponent(streamUrl)}/${encodeURIComponent(metaUrl)}` +
        `/${encodeURIComponent(meta.type)}/${encodeURIComponent(meta.metaId)}/${encodeURIComponent(videoId)}`;
};

export const saveCacheMeta = (serverUrl: string, infoHash: string, meta: CacheMeta | null): Promise<void> =>
    fetch(new URL('cache/meta', serverUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ infoHash, meta }),
    })
        .then((resp) => {
            if (!resp.ok) throw new Error(`cache/meta responded ${resp.status}`);
        });

// ---------------------------------------------------------------------------
// Release-name parsing
// ---------------------------------------------------------------------------

// Everything after one of these tokens is release packaging, not the title.
const NOISE = /\b(2160p|1080p|720p|480p|4k|uhd|hdr10?\+?|dv|dolby|vision|hevc|x?26[45]|h ?26[45]|10bit|8bit|aac\d?|ac3|eac3|dts(-?hd)?|truehd|atmos|remux|bluray|blu-ray|bdrip|brrip|web-?dl|web-?rip|webrip|hdtv|dvdrip|amzn|nf|dsnp|hmax|atvp|repack|proper|extended|unrated|imax|multi|dual|subs?)\b/i;

const SEASON_EPISODE = /\bs(\d{1,2})[\s._-]?e(\d{1,3})\b/i;
const YEAR = /\b(19\d{2}|20\d{2})\b/;

export type ParsedRelease = {
    title: string,
    year: string | null,
    season: number | null,
    episode: number | null,
};

/** Reduce a scene release name to a searchable title (+ year, + S/E). */
export const parseReleaseName = (raw: string): ParsedRelease => {
    // Drop a file extension and normalise separators to spaces.
    let name = raw.replace(/\.[a-z0-9]{2,4}$/i, '');
    name = name.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();

    const se = name.match(SEASON_EPISODE);
    const season = se ? parseInt(se[1], 10) : null;
    const episode = se ? parseInt(se[2], 10) : null;

    // The title ends at whichever marker comes first: the season/episode tag,
    // the release year, or the first packaging token. Everything to the left is
    // the title, which is what a catalog search wants.
    const cuts = [se?.index, name.match(YEAR)?.index, name.match(NOISE)?.index]
        .filter((index): index is number => typeof index === 'number' && index > 0);
    const cut = cuts.length > 0 ? Math.min(...cuts) : name.length;

    const title = name
        .slice(0, cut)
        // A trailing group tag or bracketed junk survives the cut sometimes.
        .replace(/[[({].*$/, '')
        .replace(/[-\s]+$/, '')
        .trim();

    return {
        title: title.length > 0 ? title : name,
        year: name.match(YEAR)?.[1] ?? null,
        season,
        episode,
    };
};

// ---------------------------------------------------------------------------
// Addon search
// ---------------------------------------------------------------------------

export type AddonLike = {
    transportUrl?: unknown,
    manifest?: {
        resources?: unknown[],
        catalogs?: { type?: string, id?: string, extra?: { name?: string }[], extraSupported?: string[] }[],
    },
};

type SearchableCatalog = { base: string, type: string, id: string, transportUrl: string };

/** Installed catalogs that accept a `search` extra, for the types we care about. */
const searchableCatalogs = (addons: AddonLike[], type: string): SearchableCatalog[] =>
    addons.flatMap((addon) => {
        const transportUrl = addon.transportUrl;
        if (typeof transportUrl !== 'string') return [];
        const base = transportUrl.replace(/\/manifest\.json$/, '');
        return (addon.manifest?.catalogs ?? [])
            .filter((catalog) => catalog.type === type && typeof catalog.id === 'string')
            .filter((catalog) => {
                const supported = catalog.extraSupported ?? (catalog.extra ?? []).map((extra) => extra?.name);
                return Array.isArray(supported) && supported.includes('search');
            })
            .map((catalog) => ({ base, type, id: catalog.id as string, transportUrl }));
    });

type MetaPreviewLike = {
    id?: unknown,
    type?: unknown,
    name?: unknown,
    poster?: unknown,
    background?: unknown,
    logo?: unknown,
    releaseInfo?: unknown,
};

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

// Comparable form of a title: case, punctuation and articles are all things
// scene names and catalogs disagree about.
const normalizeTitle = (title: string): string =>
    title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const REQUEST_TIMEOUT_MS = 8000;

/** A search hit, tagged with the addon that returned it (see CacheMeta's
 *  transport urls: that addon is also where the title's meta comes from). */
type SearchHit = { meta: MetaPreviewLike, transportUrl: string };

const fetchCatalogSearch = (catalog: SearchableCatalog, query: string): Promise<SearchHit[]> => {
    const url = `${catalog.base}/catalog/${encodeURIComponent(catalog.type)}/${encodeURIComponent(catalog.id)}/search=${encodeURIComponent(query)}.json`;
    // A dead or slow addon must not hang the matcher: every addon in the
    // profile is contacted, and one of them being down is routine.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    return fetch(url, { signal: abort.signal })
        .then((resp) => (resp.ok ? resp.json() : Promise.reject(new Error(String(resp.status)))))
        .then((body: { metas?: MetaPreviewLike[] }) => (body?.metas ?? []).map((meta) => ({ meta, transportUrl: catalog.transportUrl })))
        .catch((): SearchHit[] => [])
        .finally(() => clearTimeout(timer));
};

/**
 * Find the addon metadata for a parsed release name. Returns null when nothing
 * matches well enough - a WRONG title on a cached item is worse than a scene
 * filename, so the bar is an exact normalised title match, with the year used
 * to break ties (and to reject a same-name remake when we know the year).
 */
export const matchRelease = async (addons: AddonLike[], parsed: ParsedRelease): Promise<CacheMeta | null> => {
    if (parsed.title.length < 2) return null;
    // A season/episode tag means series; otherwise try movie first, then series
    // (a series pack often carries no S/E in the folder name).
    const types = parsed.season !== null ? ['series', 'movie'] : ['movie', 'series'];
    const wanted = normalizeTitle(parsed.title);

    for (const type of types) {
        const catalogs = searchableCatalogs(addons, type);
        if (catalogs.length === 0) continue;
        const results = (await Promise.all(catalogs.map((catalog) => fetchCatalogSearch(catalog, parsed.title)))).flat();
        const candidates = results.filter((r) => str(r.meta.id) !== null && normalizeTitle(String(r.meta.name ?? '')) === wanted);
        if (candidates.length === 0) continue;
        // Prefer the candidate whose year matches the release's, when both are known.
        const hit = (parsed.year !== null ?
            candidates.find((c) => str(c.meta.releaseInfo)?.startsWith(parsed.year as string))
            :
            undefined) ?? candidates[0];
        const best = hit.meta;
        return {
            metaId: String(best.id),
            type: str(best.type) ?? type,
            name: String(best.name ?? parsed.title),
            poster: str(best.poster),
            background: str(best.background),
            logo: str(best.logo),
            year: str(best.releaseInfo),
            season: parsed.season,
            episode: parsed.episode,
            videoId: parsed.season !== null && parsed.episode !== null ?
                `${String(best.id)}:${parsed.season}:${parsed.episode}`
                :
                null,
            // The addon that knew this title also serves its meta, so playing
            // from the cache can load it natively.
            metaTransportUrl: hit.transportUrl,
            streamTransportUrl: null,
        };
    }
    return null;
};
