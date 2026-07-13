// Copyright (C) 2017-2025 Smart code 203358507

/**
 * Video - an episode/video list row. Clean-room Tailwind row body on the foundation
 * kit Button, with the right-click / long-press / Ctrl+click menu rebuilt on the kit
 * (Radix) ContextMenu. Radix handles right-click and touch long-press natively; the
 * Ctrl+click path synthesizes a contextmenu event so all three triggers survive. The
 * old Popup gesture flags (togglePopupPrevented / buttonClickPrevented) are dropped
 * because the menu now portals to the body and never bubbles back to the row.
 *
 * Reused verbatim: useProfile (hideSpoilers spoiler-blur + interfaceLanguage date),
 * usePlatform (isMobile replace-nav), navigate + toPath, the mark-watched callbacks,
 * and the selected -> scrollIntoView effect. The `.video-container` hook class stays
 * so VideosList can compose it.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import Icon from '@stremio/stremio-icons/react';
import { cn } from 'rillio/components/ui/cn';
import { Button } from 'rillio/components/ui/button';
import Image from 'rillio/components/Image';
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
} from 'rillio/components/ui/context-menu';
import VideoPlaceholder from './VideoPlaceholder';
import styles from './styles.less';
const { default: toPath } = require('rillio-router/toPath');
const useProfile = require('rillio/common/useProfile');
const { usePlatform } = require('rillio/common/Platform');

type Props = {
    className?: string;
    id?: string;
    title?: string;
    thumbnail?: string;
    season?: number;
    episode?: number;
    released?: Date;
    upcoming?: boolean;
    watched?: boolean;
    progress?: number;
    scheduled?: boolean;
    seasonWatched?: boolean;
    selected?: boolean;
    deepLinks?: { metaDetailsStreams?: string; player?: string };
    onSelect?: () => void;
    onMarkVideoAsWatched?: (video: { id?: string; released?: Date }, watched?: boolean) => void;
    onMarkSeasonAsWatched?: (season?: number, seasonWatched?: boolean) => void;
};

type VideoType = React.FC<Props> & { Placeholder?: typeof VideoPlaceholder };

const Video: VideoType = ({
    className, id, title, thumbnail, season, episode, released, upcoming, watched, progress,
    scheduled, seasonWatched, selected, deepLinks, onSelect, onMarkVideoAsWatched, onMarkSeasonAsWatched, ...props
}) => {
    const { t } = useTranslation();
    const profile = useProfile();
    const navigate = useNavigate();
    const platform = usePlatform();
    const rowRef = useRef<HTMLElement>(null);

    const blurThumbnail = !!(profile.settings.hideSpoilers && season && episode && !watched);

    const onRowClick = useCallback((event: React.MouseEvent) => {
        // Ctrl+click opens the context menu (parity with the old Popup gesture) by
        // synthesizing a contextmenu event that Radix ContextMenu picks up.
        if (event.ctrlKey) {
            event.preventDefault();
            event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                clientX: event.clientX,
                clientY: event.clientY,
            }));
            return;
        }
        if (typeof onSelect === 'function') {
            onSelect();
        }
        if (deepLinks) {
            if (typeof deepLinks.player === 'string') {
                navigate(toPath(deepLinks.player));
            } else if (typeof deepLinks.metaDetailsStreams === 'string') {
                navigate(toPath(deepLinks.metaDetailsStreams), { replace: !platform.isMobile });
            }
        }
    }, [deepLinks, onSelect, navigate, platform.isMobile]);

    const onToggleWatched = useCallback(() => {
        if (typeof onMarkVideoAsWatched === 'function') {
            onMarkVideoAsWatched({ id, released }, watched);
        }
    }, [id, released, watched, onMarkVideoAsWatched]);
    const onToggleSeasonWatched = useCallback(() => {
        if (typeof onMarkSeasonAsWatched === 'function') {
            onMarkSeasonAsWatched(season, seasonWatched);
        }
    }, [season, seasonWatched, onMarkSeasonAsWatched]);

    useEffect(() => {
        if (selected && rowRef.current) {
            if ((progress && watched) || !watched) {
                rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }
        }
    }, [selected]);

    const renderThumbnailFallback = useMemo(() => () => (
        <Icon className="block h-20 w-32 bg-[var(--overlay-color)] p-4 text-fg opacity-25" name="symbol" />
    ), []);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Button
                    ref={rowRef}
                    variant="ghost"
                    title={title}
                    {...props}
                    onClick={onRowClick}
                    className={cn(
                        'flex h-auto scroll-m-5 flex-row flex-wrap items-center justify-start gap-0 rounded-card border-[0.15rem] border-transparent p-2 text-base font-normal whitespace-normal',
                        'hover:bg-[var(--overlay-color)] focus:bg-[var(--overlay-color)] focus-visible:outline-none data-[state=open]:bg-[var(--overlay-color)]',
                        styles['video-container'],
                        selected && styles['selected'],
                        className,
                    )}
                >
                    {
                        typeof thumbnail === 'string' && thumbnail.length > 0 ?
                            <div className="relative flex-none overflow-hidden rounded-[0.3rem]">
                                <Image
                                    className={cn('pointer-events-none block h-20 w-32 bg-[var(--overlay-color)] object-cover object-center opacity-90', blurThumbnail && 'blur-[0.5rem]')}
                                    src={thumbnail}
                                    alt={' '}
                                    renderFallback={renderThumbnailFallback}
                                />
                                {
                                    typeof progress === 'number' && !isNaN(progress) && progress > 0 ?
                                        <div className="absolute bottom-2 left-2 right-2 rounded-card">
                                            <div className="relative z-[1] h-[0.4rem] bg-primary" style={{ width: `${progress}%` }} />
                                            <div className="absolute inset-0 z-0 bg-fg opacity-20" />
                                        </div>
                                        :
                                        null
                                }
                            </div>
                            :
                            null
                    }
                    <div className="flex flex-1 flex-col justify-center self-stretch pl-6 pr-2">
                        <div className="mb-4 line-clamp-2 text-fg">
                            {typeof episode === 'number' && !isNaN(episode) ? `${episode}. ` : null}
                            {typeof title === 'string' && title.length > 0 ? title : id}
                        </div>
                        <div className="flex flex-row items-center justify-end">
                            {
                                released instanceof Date && !isNaN(released.getTime()) ?
                                    <div className="flex-1 mr-2 overflow-hidden py-[0.2rem] text-[0.8rem] font-medium whitespace-nowrap text-ellipsis text-fg opacity-[0.44]">
                                        {released.toLocaleString(profile.settings.interfaceLanguage, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </div>
                                    :
                                    scheduled ?
                                        <div className="flex-1 mr-2 overflow-hidden py-[0.2rem] text-[0.8rem] font-medium whitespace-nowrap text-ellipsis text-fg opacity-[0.44]" title={t('TBA')}>
                                            {t('TBA')}
                                        </div>
                                        :
                                        null
                            }
                            <div className="flex h-[1.6rem] flex-[0_1_auto] flex-row items-center rounded-[0.3rem] [&>*:nth-child(2)]:ml-2">
                                {
                                    upcoming && !watched ?
                                        <div className="flex h-full max-w-40 flex-none items-center rounded-[0.3rem] bg-[var(--color-accent-soft)] px-2 [&:not(:only-child)]:max-w-20">
                                            <div className="overflow-hidden text-[0.8rem] font-extrabold uppercase whitespace-nowrap text-ellipsis text-primary">{t('UPCOMING')}</div>
                                        </div>
                                        :
                                        null
                                }
                                {
                                    watched ?
                                        <div className="flex h-full max-w-40 flex-none items-center rounded-[0.3rem] bg-[var(--overlay-color)] px-2 [&:not(:only-child)]:max-w-20">
                                            <Icon className="mr-1 h-[1.15rem] w-[1.15rem] text-fg-muted" name="eye" />
                                            <div className="overflow-hidden text-[0.8rem] font-extrabold uppercase whitespace-nowrap text-ellipsis text-fg-muted">{t('CTX_WATCHED')}</div>
                                        </div>
                                        :
                                        null
                                }
                            </div>
                        </div>
                    </div>
                </Button>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[12rem]">
                <ContextMenuItem className="px-6 py-4 font-medium text-fg">
                    {t('CTX_WATCH')}
                </ContextMenuItem>
                <ContextMenuItem className="px-6 py-4 font-medium text-fg" onSelect={onToggleWatched}>
                    {watched ? t('CTX_MARK_NON_WATCHED') : t('CTX_MARK_WATCHED')}
                </ContextMenuItem>
                <ContextMenuItem className="px-6 py-4 font-medium text-fg" onSelect={onToggleSeasonWatched}>
                    {seasonWatched ? t('CTX_UNMARK_REST') : t('CTX_MARK_REST')}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

Video.Placeholder = VideoPlaceholder;

export default Video;
