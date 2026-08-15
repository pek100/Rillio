// Copyright (C) 2017-2026 Smart code 203358507

/**
 * SimilarRow - a keyless "Similar" section at the bottom of MetaDetails, built
 * entirely from the INSTALLED addon catalogs (no TMDB, no extra keys).
 *
 * Mechanism: take the current meta's genres (the core encodes them as `links`
 * with category "Genres") and its type, find installed catalogs that answer a
 * `genre` extra (same manifest shape-sniffing as cacheMetadata's
 * searchableCatalogs, but for 'genre'), and fetch the top results for the
 * strongest genre. Bounded on purpose: catalogs are asked one at a time, at
 * most a handful are tried, each request carries an 8s abort, and any failure
 * is silent - the section simply does not render. Results exclude the current
 * title, dedupe by id, and cap at 12.
 *
 * The row itself reuses the app's real poster machinery: MetaRow + MetaItem
 * with `#/metadetails/...` deep links, exactly as Board and Search rows render.
 *
 * The fetch goes DIRECTLY over the addon protocol (plain catalog GETs), never
 * through the core's CatalogsWithExtra singleton - that model is shared with
 * the Discover page and driving it from here would stomp on its state.
 */

import React from 'react';
import { useProfile } from 'rillio/common';
import MetaRow from 'rillio/components/MetaRow';
import MetaItem from 'rillio/components/MetaItem';
import { ROW_CLASS, HIDE_POSTER } from 'rillio/components/CatalogRows';
import { cn } from 'rillio/components/ui/cn';

type CatalogExtra = { name?: string; options?: unknown; isRequired?: boolean };
type ManifestCatalog = {
    type?: string;
    id?: string;
    extra?: CatalogExtra[];
    extraSupported?: string[];
    extraRequired?: string[];
};
type AddonLike = { transportUrl?: unknown; manifest?: { catalogs?: ManifestCatalog[] } };

type MetaPreviewLike = {
    id?: unknown;
    type?: unknown;
    name?: unknown;
    poster?: unknown;
    posterShape?: unknown;
};

const REQUEST_TIMEOUT_MS = 8000;
const MAX_ITEMS = 12;
// Stop after this many catalogs have answered with results...
const MAX_CATALOGS_ANSWERING = 2;
// ...and never contact more than this many per genre, answers or not.
const MAX_CATALOGS_TRIED = 5;

type GenreCatalog = { base: string; type: string; id: string };

// Installed catalogs that accept a `genre` extra for the given type and (when
// they declare their genre options) actually list the wanted genre. Catalogs
// that REQUIRE an extra we are not sending (search-only catalogs chiefly)
// cannot answer a bare genre request and are skipped.
const genreCatalogs = (addons: AddonLike[], type: string, genre: string): GenreCatalog[] =>
    addons.flatMap((addon) => {
        const transportUrl = addon.transportUrl;
        if (typeof transportUrl !== 'string') return [];
        const base = transportUrl.replace(/\/manifest\.json$/, '');
        return (addon.manifest?.catalogs ?? [])
            .filter((catalog) => catalog.type === type && typeof catalog.id === 'string')
            .filter((catalog) => {
                const supported = catalog.extraSupported ?? (catalog.extra ?? []).map((extra) => extra?.name);
                if (!Array.isArray(supported) || !supported.includes('genre')) return false;
                const required = catalog.extraRequired ??
                    (catalog.extra ?? []).filter((extra) => extra?.isRequired === true).map((extra) => extra?.name);
                if (Array.isArray(required) && required.some((name) => name !== 'genre')) return false;
                const options = (catalog.extra ?? []).find((extra) => extra?.name === 'genre')?.options;
                if (Array.isArray(options) && options.length > 0 && !options.includes(genre)) return false;
                return true;
            })
            .map((catalog) => ({ base, type, id: catalog.id as string }));
    });

// One catalog GET with an 8s abort; a dead addon answers with [] rather than
// hanging or throwing (one of them being down is routine).
const fetchGenreCatalog = (catalog: GenreCatalog, genre: string): Promise<MetaPreviewLike[]> => {
    const url = `${catalog.base}/catalog/${encodeURIComponent(catalog.type)}/${encodeURIComponent(catalog.id)}/genre=${encodeURIComponent(genre)}.json`;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    return fetch(url, { signal: abort.signal })
        .then((resp) => (resp.ok ? resp.json() : Promise.reject(new Error(String(resp.status)))))
        .then((body: { metas?: MetaPreviewLike[] }) => (Array.isArray(body?.metas) ? body.metas : []))
        .catch((): MetaPreviewLike[] => [])
        .finally(() => clearTimeout(timer));
};

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

// Similar titles for a meta: sequential catalog walk for the strongest genre
// (falling back to the second genre only when the first yields nothing at all).
const useSimilar = (metaId: string | null, type: string | null, genres: string[], addons: AddonLike[]): MetaPreviewLike[] => {
    const [items, setItems] = React.useState<MetaPreviewLike[]>([]);
    // Key the effect on VALUES, not array identities: profile / meta re-renders
    // must not refetch a list that has not actually changed.
    const genresKey = genres.join('|');
    const addonsKey = addons.map((addon) => String(addon.transportUrl ?? '')).join('|');
    React.useEffect(() => {
        let cancelled = false;
        setItems([]);
        if (metaId === null || type === null || genres.length === 0 || addons.length === 0) return;
        (async () => {
            for (const genre of genres.slice(0, 2)) {
                const catalogs = genreCatalogs(addons, type, genre).slice(0, MAX_CATALOGS_TRIED);
                const collected = new Map<string, MetaPreviewLike>();
                let answered = 0;
                for (const catalog of catalogs) {
                    const metas = await fetchGenreCatalog(catalog, genre);
                    if (cancelled) return;
                    if (metas.length === 0) continue;
                    answered += 1;
                    for (const meta of metas) {
                        const id = str(meta.id);
                        if (id === null || id === metaId || collected.has(id) || str(meta.name) === null) continue;
                        collected.set(id, meta);
                        if (collected.size >= MAX_ITEMS) break;
                    }
                    if (answered >= MAX_CATALOGS_ANSWERING || collected.size >= MAX_ITEMS) break;
                }
                if (collected.size > 0) {
                    if (!cancelled) setItems([...collected.values()]);
                    return;
                }
            }
        })().catch(() => { /* fail silent: the section just stays hidden */ });
        return () => { cancelled = true; };
    }, [metaId, type, genresKey, addonsKey]);
    return items;
};

type Props = {
    className?: string;
    // The MetaDetails metaItem (tri-state loadable); only Ready renders anything.
    metaItem: any;
};

const SimilarRow = ({ className, metaItem }: Props) => {
    const profile = useProfile();
    const addons: AddonLike[] = (profile as unknown as { addons?: AddonLike[] })?.addons ?? [];

    const content = metaItem?.content?.type === 'Ready' ? metaItem.content.content : null;
    const metaId: string | null = str(content?.id);
    const type: string | null = str(content?.type);

    // Genres arrive as preview `links` (the core encodes them there); some raw
    // metas also carry a plain `genres` array, kept as the fallback.
    const genres = React.useMemo<string[]>(() => {
        const links: any[] = Array.isArray(content?.links) ? content.links : [];
        const fromLinks = links
            .filter((link) => link?.category === 'Genres' && typeof link?.name === 'string' && link.name.length > 0)
            .map((link) => link.name as string);
        if (fromLinks.length > 0) return fromLinks;
        return Array.isArray(content?.genres) ? content.genres.filter((genre: unknown) => typeof genre === 'string' && genre.length > 0) : [];
    }, [content]);

    const metas = useSimilar(metaId, type, genres, addons);

    // Raw addon previews -> the MetaItem prop shape Board rows feed it, with the
    // same deep links (series land on the videos view, movies go straight to
    // streams with the id standing in as the video id, as the core itself does).
    const items = React.useMemo(() => metas.map((meta) => {
        const id = String(meta.id);
        const itemType = str(meta.type) ?? type ?? 'movie';
        const posterShape = meta.posterShape === 'landscape' || meta.posterShape === 'square' ? meta.posterShape : 'poster';
        const deepLinks = itemType === 'series' ?
            { metaDetailsVideos: `#/metadetails/${encodeURIComponent(itemType)}/${encodeURIComponent(id)}` }
            :
            { metaDetailsStreams: `#/metadetails/${encodeURIComponent(itemType)}/${encodeURIComponent(id)}/${encodeURIComponent(id)}` };
        return {
            id,
            type: itemType,
            name: String(meta.name),
            poster: str(meta.poster) ?? undefined,
            posterShape,
            deepLinks,
        };
    }), [metas, type]);

    // Never an empty shell: no results (still loading, nothing found, every
    // catalog down) renders nothing at all, header included.
    if (items.length === 0) return null;

    return (
        <MetaRow
            className={cn('flex-none self-stretch', ROW_CLASS, HIDE_POSTER, className)}
            title="Similar"
            catalog={{ items }}
            itemComponent={MetaItem}
        />
    );
};

export default SimilarRow;
