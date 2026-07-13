// Copyright (C) 2017-2023 Smart code 203358507

/**
 * Board - the home route. Clean-room rewrite (Phase 3 / Wave B): the shell, hero and
 * row orchestration are authored here in TypeScript on Tailwind utilities over our
 * semantic tokens; it consumes the already-rewritten kit-based MetaRow / MetaItem /
 * ContinueWatchingItem verbatim. Every hook and the windowing contract are reused
 * exactly as before: useBoard's loadBoardRows({start,end}) lazy loading, the hero
 * fed from the first Ready catalog, the boardCatalogsOffset that accounts for the
 * hero + continue-watching rows shifting the visible-child -> catalog index map, the
 * THRESHOLD=5 debounced scroll re-run, and the streaming-server warning gating.
 *
 * The per-breakpoint poster trim (LESS purge, Stage B) is now expressed the same way
 * routes/Search does it: structural arbitrary-variant classes on the row's OWN
 * className that hide the items-container's overflow children once the viewport is too
 * narrow to fit them (the old nth-child media queries, 2200/1900/1600/1300/1000/800/
 * 640px). No CSS module and no per-item API. `>*:last-child` is the items container
 * (Ready + placeholder rows both end with it); its children are the poster items.
 */

import React from 'react';
import debounce from 'lodash.debounce';
import useTranslate from 'rillio/common/useTranslate';
import { useStreamingServer, useNotifications, withCoreSuspender, getVisibleChildrenRange, useProfile } from 'rillio/common';
import { ContinueWatchingItem, EventModal, MainNavBars, MetaItem, MetaRow } from 'rillio/components';
import useBoard from './useBoard';
import useContinueWatchingPreview from './useContinueWatchingPreview';
import StreamingServerWarning from './StreamingServerWarning';
import HeroCarousel from './HeroCarousel';

const HERO_SLIDES = 6;

const THRESHOLD = 5;

const HIDE_POSTER =
    'max-[2200px]:[&>*:last-child>*:nth-child(n+10)]:hidden ' +
    'max-[1900px]:[&>*:last-child>*:nth-child(n+9)]:hidden ' +
    'max-[1600px]:[&>*:last-child>*:nth-child(n+8)]:hidden ' +
    'max-[1300px]:[&>*:last-child>*:nth-child(n+7)]:hidden ' +
    'max-[1000px]:[&>*:last-child>*:nth-child(n+6)]:hidden ' +
    'max-[800px]:[&>*:last-child>*:nth-child(n+5)]:hidden ' +
    'max-[640px]:[&>*:last-child>*:nth-child(n+4)]:hidden';

const HIDE_LANDSCAPE =
    'max-[2200px]:[&>*:last-child>*:nth-child(n+9)]:hidden ' +
    'max-[1900px]:[&>*:last-child>*:nth-child(n+8)]:hidden ' +
    'max-[1600px]:[&>*:last-child>*:nth-child(n+7)]:hidden ' +
    'max-[1300px]:[&>*:last-child>*:nth-child(n+6)]:hidden ' +
    'max-[1000px]:[&>*:last-child>*:nth-child(n+5)]:hidden ' +
    'max-[800px]:[&>*:last-child>*:nth-child(n+4)]:hidden';

const hideClassesForShape = (posterShape: string | undefined): string =>
    posterShape === 'landscape' ? HIDE_LANDSCAPE : HIDE_POSTER;

// The floating streaming-server warning: absolute inset placement with safe-area
// insets, rebased above the bottom nav rail at the minimum width, and nudged clear of
// the left rail in phone-landscape (was board-warning-container in styles.less).
const BOARD_WARNING =
    'absolute bottom-[calc(var(--safe-area-inset-bottom)+0.5rem)] left-[calc(var(--safe-area-inset-left)+0.5rem)] right-[calc(var(--safe-area-inset-right)+0.5rem)] ' +
    'max-[640px]:bottom-[calc(var(--vertical-nav-bar-size)+0.5rem)] max-[640px]:h-28 ' +
    '[@media(orientation:landscape)and(max-width:1000px)and(max-height:500px)]:left-[calc(var(--safe-area-inset-left)+var(--vertical-nav-bar-size)+0.5rem)]';

// Row rhythm: 1rem top / 2rem bottom, tightened to 1.5rem bottom at the minimum
// width. Kept as a shared string so every row (catalog, continue-watching,
// placeholder, error) matches exactly.
const ROW_SPACING = 'mt-4 mb-8 max-[640px]:mb-6';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

const Board = () => {
    const t = useTranslate();
    const streamingServer = useStreamingServer();
    const continueWatchingPreview = useContinueWatchingPreview();
    const [board, loadBoardRows] = useBoard();
    const notifications = useNotifications();
    const profile = useProfile();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const showStreamingServerWarning = React.useMemo(() => {
        return streamingServer.settings !== null && streamingServer.settings.type === 'Err' && (
            isNaN(profile.settings.streamingServerWarningDismissed.getTime()) ||
            profile.settings.streamingServerWarningDismissed.getTime() < Date.now());
    }, [profile.settings, streamingServer.settings]);
    // Feed the hero from the first catalog that has loaded (Cinemeta's Popular
    // /Top row), so it costs no extra fetch. Only items with a backdrop qualify.
    const heroItems = React.useMemo(() => {
        const catalog = board.catalogs.find((catalog: any) => (
            catalog.content?.type === 'Ready' &&
            Array.isArray(catalog.content.content) &&
            catalog.content.content.length > 0
        ));
        if (!catalog) {
            return [];
        }

        return catalog.content.content
            .filter((item: any) => typeof item.background === 'string' && item.background.length > 0)
            .slice(0, HERO_SLIDES);
    }, [board.catalogs]);
    // The hero and the continue-watching row precede the catalog rows inside the
    // scroll container, so they shift the visible-child -> catalog index mapping.
    const boardCatalogsOffset = (continueWatchingPreview.items.length > 0 ? 1 : 0) + (heroItems.length > 0 ? 1 : 0);
    const onVisibleRangeChange = React.useCallback(() => {
        const range = getVisibleChildrenRange(scrollContainerRef.current);
        if (range === null) {
            return;
        }

        const start = Math.max(0, range.start - boardCatalogsOffset - THRESHOLD);
        const end = range.end - boardCatalogsOffset + THRESHOLD;
        if (end < start) {
            return;
        }

        loadBoardRows({ start, end });
    }, [boardCatalogsOffset]);
    const onScroll = React.useCallback(debounce(onVisibleRangeChange, 250), [onVisibleRangeChange]);
    React.useLayoutEffect(() => {
        onVisibleRangeChange();
    }, [board.catalogs, onVisibleRangeChange]);
    return (
        <div className="flex h-[calc(100%-var(--safe-area-inset-bottom))] w-full flex-col max-[640px]:relative max-[640px]:z-0">
            <EventModal />
            <MainNavBars className="flex-1 self-stretch bg-transparent" route={'board'}>
                <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto px-4" onScroll={onScroll}>
                    {
                        heroItems.length > 0 ?
                            <HeroCarousel className={cx('mt-2 mb-8', 'animation-fade-in')} items={heroItems} />
                            :
                            null
                    }
                    {
                        continueWatchingPreview.items.length > 0 ?
                            <MetaRow
                                className={cx(ROW_SPACING, HIDE_POSTER, 'animation-fade-in')}
                                title={t.string('BOARD_CONTINUE_WATCHING')}
                                catalog={continueWatchingPreview}
                                itemComponent={ContinueWatchingItem}
                                notifications={notifications}
                            />
                            :
                            null
                    }
                    {board.catalogs.map((catalog: any, index: number) => {
                        switch (catalog.content?.type) {
                            case 'Ready': {
                                return (
                                    <MetaRow
                                        key={index}
                                        className={cx(ROW_SPACING, hideClassesForShape(catalog.content.content[0].posterShape), 'animation-fade-in')}
                                        catalog={catalog}
                                        itemComponent={MetaItem}
                                    />
                                );
                            }
                            case 'Err': {
                                if (catalog.content.content !== 'EmptyContent') {
                                    return (
                                        <MetaRow
                                            key={index}
                                            className={cx(ROW_SPACING, 'animation-fade-in')}
                                            catalog={catalog}
                                            message={catalog.content.content}
                                        />
                                    );
                                }
                                return null;
                            }
                            default: {
                                return (
                                    <MetaRow.Placeholder
                                        key={index}
                                        className={cx(ROW_SPACING, HIDE_POSTER, 'animation-fade-in')}
                                        catalog={catalog}
                                        title={t.catalogTitle(catalog)}
                                    />
                                );
                            }
                        }
                    })}
                </div>
            </MainNavBars>
            {
                showStreamingServerWarning ?
                    <StreamingServerWarning className={BOARD_WARNING} />
                    :
                    null
            }
        </div>
    );
};

const BoardFallback = () => (
    <div className="flex h-[calc(100%-var(--safe-area-inset-bottom))] w-full flex-col">
        <MainNavBars className="flex-1 self-stretch bg-transparent" route={'board'} />
    </div>
);

export default withCoreSuspender(Board, BoardFallback);
