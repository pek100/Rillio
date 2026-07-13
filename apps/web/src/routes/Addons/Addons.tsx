// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Addons - a bus-driven modal (common/modalEvents), mounted by ModalHost. Clean-room
 * rewrite onto the foundation kit: the frame is a controlled Radix Dialog (open always
 * true, closed via a pure bus close, never history), the filter pills are kit Selects,
 * the addon list is a flat divide-y of Addon rows, and the four nested surfaces
 * (all-filters, add-addon, share, addon-details) layer on top.
 *
 * State that used to live in the URL is now modal-local, seeded once from the open
 * payload: the catalog filter (type/transportUrl/catalogId) and the addon-details pane
 * (addon transport url). A deep link opens the modal pre-expanded to the right sub-view.
 * The filter Selects update this local state instead of navigating, so opening/closing
 * the modal never touches the address bar or browser history.
 *
 * The outer Dialog is modal={false} on purpose: it must NOT trap focus or disable
 * outside pointer events, because (a) it matches the old non-trapping shell and
 * (b) the legacy AddonDetailsModal portals outside this Dialog and has to stay
 * interactive. The old "let a nested dialog eat Escape first" precedence is kept by
 * guarding the Dialog's Escape / outside-interaction while any nested modal is open.
 *
 * Visuals only: every hook, the InstallAddon / UninstallAddon dispatch, the addon-url
 * parse, and the search predicate are reused exactly as before.
 */

import React from 'react';
import { matchPath } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Puzzle, Plus, SlidersHorizontal, Link } from 'lucide-react';
import { useCore } from 'rillio/core';
import { toPath } from 'rillio-router';
import type { AddonsPayload } from 'rillio/common/modalEvents';
import { cn } from 'rillio/components/ui/cn';
import { Button, IconButton } from 'rillio/components/ui/button';
import { Dialog, DialogContent, DialogPortal, DialogTitle, DialogFooter, ModalRoute } from 'rillio/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'rillio/components/ui/select';
import { Input } from 'rillio/components/ui/input';
import { AddonDetailsModal, Image, SearchBar, SharePrompt } from 'rillio/components';
import Addon from './Addon';
import { AddonPlaceholder } from './AddonPlaceholder';

const useInstalledAddons = require('./useInstalledAddons').default;
const useRemoteAddons = require('./useRemoteAddons').default;
const useSelectableInputs = require('./useSelectableInputs').default;
const { usePlatform, useBinaryState, withCoreSuspender } = require('rillio/common');
const useToast = require('rillio/common/Toast/useToast');

// The centered panel geometry the old modal-shell used, minus the hand-rolled
// backdrop/Escape (Radix owns those now).
const PANEL_CLASS = cn(
    'flex flex-col gap-0 overflow-hidden border border-line p-0',
    'h-[min(46rem,calc(100vh-6rem))] w-[min(72rem,calc(100vw-4rem))] max-w-none',
);

type SelectableInput = {
    options: { value: string; label: React.ReactNode; title?: string }[];
    value?: string;
    title?: (() => React.ReactNode) | null;
    onSelect: (value: string) => void;
};

const FilterSelect = ({ input, className }: { input: SelectableInput; className?: string }) => {
    const placeholder = typeof input.title === 'function' ? input.title() : undefined;
    return (
        <Select value={input.value} onValueChange={input.onSelect}>
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {input.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

const Message = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-full items-center justify-center px-6 py-10 text-center text-lg text-fg-muted">
        {children}
    </div>
);

const PlaceholderList = () => (
    <div className="divide-y divide-line">
        {Array.from({ length: 6 }).map((_, index) => (
            <AddonPlaceholder key={index} />
        ))}
    </div>
);

const ADDONS_PATH = '/addons/:type?/:transportUrl?/:catalogId?';

type UrlParams = {
    type?: string,
    transportUrl?: string,
    catalogId?: string,
};

type Props = {
    payload?: AddonsPayload,
    onClose: () => void,
};

type BodyProps = {
    payload?: AddonsPayload,
    // The shell owns the persistent Dialog and reads this ref in its Escape /
    // interact-outside / open-change guards. The body mirrors its nested-modal
    // state into it (the guards must keep the outer dialog open while a nested
    // filters / add-addon / share / addon-details modal is up). A ref, not state,
    // because the shell only reads it from event handlers, never renders on it.
    nestedOpenRef: React.MutableRefObject<boolean>,
};

// The core-consuming body: the installed / remote addon reads suspend on first open
// (a fresh withCoreSuspender cache). It renders the filter bar + list as children of
// the shell's DialogContent, plus the four nested modals (which portal to the body).
const AddonsBody = ({ payload, nestedOpenRef }: BodyProps) => {
    // The catalog filter (type/transportUrl/catalogId) and the open addon-details
    // pane used to come from the URL; they are now modal-local, seeded from the open
    // payload so a deep link lands pre-expanded.
    const [urlParams, setUrlParams] = React.useState<UrlParams>(() => ({
        type: payload?.type,
        transportUrl: payload?.transportUrl,
        catalogId: payload?.catalogId,
    }));
    const [addonDetailsTransportUrl, setAddonDetailsTransportUrl] = React.useState<string | null>(payload?.addon ?? null);
    const { t } = useTranslation();
    const platform = usePlatform();
    const core = useCore();
    const toast = useToast();
    const installedAddons = useInstalledAddons(urlParams);
    const remoteAddons = useRemoteAddons(urlParams);
    // A filter Select carries a deepLinks.addons value (a #/addons/... path). Parse it
    // into the local filter params instead of navigating, so the URL stays clean.
    const selectFilterPath = React.useCallback((link: string) => {
        const match = matchPath({ path: ADDONS_PATH, end: true }, toPath(link));
        const params = (match?.params ?? {}) as UrlParams;
        setUrlParams({
            type: params.type ?? undefined,
            transportUrl: params.transportUrl ?? undefined,
            catalogId: params.catalogId ?? undefined,
        });
    }, []);
    const selectInputs: SelectableInput[] = useSelectableInputs(installedAddons, remoteAddons, selectFilterPath);
    const [filtersModalOpen, openFiltersModal, closeFiltersModal] = useBinaryState(false);
    const [addAddonModalOpen, openAddAddonModal, closeAddAddonModal] = useBinaryState(false);
    const addAddonUrlInputRef = React.useRef<HTMLInputElement>(null);
    const addAddonOnSubmit = React.useCallback(() => {
        if (addAddonUrlInputRef.current !== null) {
            try {
                const url = new URL(addAddonUrlInputRef.current.value).toString();
                setAddonDetailsTransportUrl(url);
            } catch (e) {
                toast.show({
                    type: 'error',
                    title: `Failed to parse addon url: ${addAddonUrlInputRef.current.value}`,
                    timeout: 10000,
                });
                console.error('Failed to parse addon url:', e);
            }
        }
    }, [setAddonDetailsTransportUrl]);
    const [search, setSearch] = React.useState('');
    const searchInputOnChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.currentTarget.value);
    }, []);
    const [sharedAddon, setSharedAddon] = React.useState<any>(null);
    const clearSharedAddon = React.useCallback(() => {
        setSharedAddon(null);
    }, []);
    const onAddonShare = React.useCallback((event: any) => {
        setSharedAddon(event.dataset.addon);
    }, []);
    const onAddonInstall = React.useCallback((event: any) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: event.dataset.addon,
            },
        });
    }, []);
    const onAddonUninstall = React.useCallback((event: any) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UninstallAddon',
                args: event.dataset.addon,
            },
        });
    }, []);
    const onAddonConfigure = React.useCallback((event: any) => {
        platform.openExternal(event.dataset.addon.transportUrl.replace('manifest.json', 'configure'));
    }, []);
    const openAddonDirectory = React.useCallback(() => {
        platform.openExternal('https://stremio-addons.net/addons');
    }, [platform]);
    const onAddonOpen = React.useCallback((event: any) => {
        setAddonDetailsTransportUrl(event.dataset.addon.transportUrl);
    }, [setAddonDetailsTransportUrl]);
    const closeAddonDetails = React.useCallback(() => {
        setAddonDetailsTransportUrl(null);
    }, [setAddonDetailsTransportUrl]);
    const searchFilterPredicate = React.useCallback((addon: any) => {
        return search.length === 0 ||
            (
                (typeof addon.manifest.name === 'string' && addon.manifest.name.toLowerCase().includes(search.toLowerCase())) ||
                (typeof addon.manifest.description === 'string' && addon.manifest.description.toLowerCase().includes(search.toLowerCase()))
            );
    }, [search]);
    const renderLogoFallback = React.useCallback(() => (
        <Puzzle className="block size-full p-2.5 text-fg-muted" />
    ), []);
    React.useLayoutEffect(() => {
        closeAddAddonModal();
        setSearch('');
        clearSharedAddon();
    }, [urlParams, addonDetailsTransportUrl]);

    // Closing is a pure bus close (common/modalEvents), never a history navigation.
    // Changing a filter only updates local state, so it never touches the URL either.
    // The shell owns the close wiring now; the body only publishes whether a nested
    // modal is open so the shell's dialog guards can keep the outer dialog alive.
    const nestedModalOpen = filtersModalOpen || addAddonModalOpen || sharedAddon !== null || typeof addonDetailsTransportUrl === 'string';
    nestedOpenRef.current = nestedModalOpen;

    const renderAddon = (addon: any, index: number) => (
        <Addon
            key={index}
            id={addon.manifest.id}
            name={addon.manifest.name}
            version={addon.manifest.version}
            logo={addon.manifest.logo}
            description={addon.manifest.description}
            types={addon.manifest.types}
            behaviorHints={addon.manifest.behaviorHints}
            installed={addon.installed}
            onInstall={onAddonInstall}
            onUninstall={onAddonUninstall}
            onConfigure={onAddonConfigure}
            onOpen={onAddonOpen}
            onShare={onAddonShare}
            dataset={{ addon }}
        />
    );

    return (
        <>
            <div className="flex shrink-0 items-center gap-4 p-6 max-sm:gap-3">
                        {selectInputs.map((selectInput, index) => (
                            <FilterSelect
                                key={index}
                                input={selectInput}
                                className="flex-[0_1_15rem] max-sm:hidden"
                            />
                        ))}
                        <div className="flex-1 max-sm:hidden" />
                        <Button
                            variant="ghost"
                            title={t('ADD_ADDON')}
                            onClick={openAddAddonModal}
                            className="h-12 shrink-0 gap-2 bg-accent-soft px-6 text-accent hover:bg-accent-soft hover:brightness-110 active:scale-[0.97] max-sm:fixed max-sm:bottom-[calc(3rem+var(--horizontal-nav-bar-size))] max-sm:right-0 max-sm:z-10"
                        >
                            <Plus className="size-4" />
                            <span className="text-base font-semibold">{t('ADD_ADDON')}</span>
                        </Button>
                        <SearchBar
                            className="flex-[0_1_18rem] max-sm:flex-1"
                            title={t('ADDON_SEARCH')}
                            value={search}
                            onChange={searchInputOnChange}
                        />
                        <IconButton
                            size="lg"
                            title={t('ALL_FILTERS')}
                            onClick={openFiltersModal}
                            className="hidden shrink-0 bg-surface-hover opacity-100 max-sm:inline-flex"
                        >
                            <SlidersHorizontal className="size-4 text-fg-muted" />
                        </IconButton>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {
                            installedAddons.selected !== null ?
                                installedAddons.selectable.types.length === 0 ?
                                    <Message>{t('NO_ADDONS')}</Message>
                                    :
                                    installedAddons.catalog.length === 0 ?
                                        <Message>{t('NO_ADDONS_FOR_TYPE')}</Message>
                                        :
                                        <div className="divide-y divide-line animate-in fade-in-0 duration-200">
                                            {installedAddons.catalog.filter(searchFilterPredicate).map(renderAddon)}
                                        </div>
                                :
                                remoteAddons.selected !== null ?
                                    remoteAddons.catalog.content.type === 'Err' ?
                                        <Message>{remoteAddons.catalog.content.content}</Message>
                                        :
                                        remoteAddons.catalog.content.type === 'Loading' ?
                                            <PlaceholderList />
                                            :
                                            <div className="divide-y divide-line animate-in fade-in-0 duration-200">
                                                {remoteAddons.catalog.content.content.filter(searchFilterPredicate).map(renderAddon)}
                                            </div>
                                    :
                                    <PlaceholderList />
                        }
                    </div>

            {
                filtersModalOpen ?
                    <ModalRoute open onClose={closeFiltersModal} title={t('ADDONS_FILTERS')} size="sm">
                        <div className="flex flex-col gap-4">
                            {selectInputs.map((selectInput, index) => (
                                <FilterSelect key={index} input={selectInput} className="w-full" />
                            ))}
                        </div>
                    </ModalRoute>
                    :
                    null
            }

            {
                addAddonModalOpen ?
                    <ModalRoute open onClose={closeAddAddonModal} title={t('ADD_ADDON')} size="sm">
                        <p className="text-sm text-fg-muted">{t('ADD_ADDON_DESCRIPTION')}</p>
                        <Input
                            ref={addAddonUrlInputRef}
                            type="text"
                            placeholder={t('PASTE_ADDON_URL')}
                            autoFocus
                            onSubmit={addAddonOnSubmit}
                            className="w-full"
                        />
                        <Button
                            variant="ghost"
                            onClick={openAddonDirectory}
                            title={t('ADD_ADDON_DIRECTORY')}
                            className="h-auto justify-start gap-2 self-start p-0 text-accent hover:bg-transparent hover:brightness-110"
                        >
                            <Link className="size-4" />
                            <span className="text-sm font-semibold">{t('ADD_ADDON_DIRECTORY')}</span>
                        </Button>
                        <DialogFooter>
                            <Button variant="ghost" onClick={closeAddAddonModal} className="text-fg-muted hover:text-fg">
                                {t('BUTTON_CANCEL')}
                            </Button>
                            <Button onClick={addAddonOnSubmit}>{t('ADDON_ADD')}</Button>
                        </DialogFooter>
                    </ModalRoute>
                    :
                    null
            }

            {
                sharedAddon !== null ?
                    <ModalRoute open onClose={clearSharedAddon} title={t('SHARE_ADDON')} size="sm">
                        <div className="flex items-center gap-6">
                            <div className="size-20 shrink-0 overflow-hidden rounded-card bg-surface">
                                <Image
                                    className="block size-full object-contain p-2"
                                    src={sharedAddon.manifest.logo}
                                    alt=" "
                                    renderFallback={renderLogoFallback}
                                />
                            </div>
                            <div className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-2xl font-semibold text-fg">
                                    {typeof sharedAddon.manifest.name === 'string' && sharedAddon.manifest.name.length > 0 ? sharedAddon.manifest.name : sharedAddon.manifest.id}
                                </span>
                                {
                                    typeof sharedAddon.manifest.version === 'string' && sharedAddon.manifest.version.length > 0 ?
                                        <span className="text-fg-muted">{t('ADDON_VERSION_SHORT', { version: sharedAddon.manifest.version })}</span>
                                        :
                                        null
                                }
                            </div>
                        </div>
                        <SharePrompt url={sharedAddon.transportUrl} />
                    </ModalRoute>
                    :
                    null
            }

            {
                typeof addonDetailsTransportUrl === 'string' ?
                    <AddonDetailsModal
                        transportUrl={addonDetailsTransportUrl}
                        onCloseRequest={closeAddonDetails}
                    />
                    :
                    null
            }
        </>
    );
};

// Suspense fallback: the panel geometry lives on the shell's DialogContent, so a
// placeholder list keeps the same panel size while the addon reads resolve.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AddonsBodySkeleton = (_props: BodyProps) => (
    <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceholderList />
    </div>
);

const AddonsBodySuspended = withCoreSuspender(AddonsBody, AddonsBodySkeleton);

// The shell owns the persistent Dialog frame (modal={false}, its own blur scrim,
// the Escape / interact-outside / open-change close wiring) and consumes NO core
// state, so it mounts once and stays mounted while the body suspends. Only
// <AddonsBodySuspended /> suspends, inside DialogContent, so the dialog and its
// entrance animation are never torn down (fixes the open flicker / mount churn).
//
// modal={false} is deliberate: the outer dialog must NOT trap focus or disable
// outside pointer events, so the nested AddonDetailsModal (which portals outside
// this dialog) stays interactive. The nested-modal-open guards keep the old "let a
// nested dialog eat Escape first" precedence, reading the ref the body publishes.
const Addons = ({ payload, onClose }: Props) => {
    const { t } = useTranslation();
    const nestedOpenRef = React.useRef(false);
    return (
        <Dialog open modal={false} onOpenChange={(next) => { if (!next && !nestedOpenRef.current) onClose(); }}>
            {/* modal={false} means Radix renders NO DialogOverlay, so without this
                the page behind would show through unblurred. Paint our own scrim
                matching the blur the ModalRoute-based modals (Settings/Cached) get
                from DialogOverlay. pointer-events-none preserves the deliberate
                non-trapping outside-interaction the nested AddonDetails modal needs. */}
            <DialogPortal>
                <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/60 backdrop-blur-[24px] animate-in fade-in-0" />
            </DialogPortal>
            <DialogContent
                showClose={false}
                aria-label={t('ADDONS')}
                className={PANEL_CLASS}
                onEscapeKeyDown={(event) => { if (nestedOpenRef.current) event.preventDefault(); }}
                onInteractOutside={(event) => { if (nestedOpenRef.current) event.preventDefault(); }}
            >
                <DialogTitle className="sr-only">{t('ADDONS')}</DialogTitle>
                <AddonsBodySuspended payload={payload} nestedOpenRef={nestedOpenRef} />
            </DialogContent>
        </Dialog>
    );
};

export default Addons;
