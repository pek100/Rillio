// Copyright (C) 2017-2025 Smart code 203358507

/**
 * MetaPreview - the meta-details hero panel. Ported to TypeScript with the leaf
 * pieces rebuilt on the foundation kit (ActionsGroup / Ratings / ActionButton /
 * MetaLinks are Tailwind; the share modal is now the kit Dialog). The panel's
 * structural layout keeps its flat, token-based LESS module because a sibling route
 * (Player SideDrawer) composes its `description-container` / `action-buttons-container`
 * classes; that cross-module contract must stay intact until SideDrawer is rewritten.
 *
 * All domain logic is reused verbatim: the linksGroups sanitizer (URL parse, redirect
 * allowlist, IMDb / SHARE special-casing, hidden-category filter - security relevant),
 * the showHref and metaItemActions memos, and the Ratings core-dispatch wiring.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck, Eye, EyeOff, Share2, Play } from 'lucide-react';
import { Imdb } from 'rillio/components/ui/brand-icons';
import Image from 'rillio/components/Image';
import ActionsGroup from 'rillio/components/ActionsGroup';
import { Button } from 'rillio/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from 'rillio/components/ui/dialog';
import ActionButton from './ActionButton';
import MetaLinks from './MetaLinks';
import MetaPreviewPlaceholder from './MetaPreviewPlaceholder';
import { Ratings } from './Ratings';
import styles from './styles.less';
const UrlUtils = require('url');
const SharePrompt = require('rillio/components/SharePrompt');
const CONSTANTS = require('rillio/common/CONSTANTS');
const routesRegexp = require('rillio/common/routesRegexp');
const useBinaryState = require('rillio/common/useBinaryState');

const ALLOWED_LINK_REDIRECTS = [
    routesRegexp.search.regexp,
    routesRegexp.discover.regexp,
    routesRegexp.metadetails.regexp,
];

// Categories never rendered as link pills: imdb/share are surfaced elsewhere,
// and cast/directors/writers are noise next to the genres.
const HIDDEN_LINK_CATEGORIES = [
    CONSTANTS.IMDB_LINK_CATEGORY,
    CONSTANTS.SHARE_LINK_CATEGORY,
    CONSTANTS.WRITERS_LINK_CATEGORY,
    'Cast',
    'Directors',
];

type Link = { category?: string; name?: string; url?: string };

type Props = {
    className?: string;
    compact?: boolean;
    name?: string;
    logo?: string;
    background?: string;
    runtime?: string;
    releaseInfo?: string;
    released?: Date;
    description?: string;
    deepLinks?: { metaDetailsVideos?: string; metaDetailsStreams?: string; player?: string };
    links?: Link[];
    inLibrary?: boolean;
    toggleInLibrary?: () => void;
    watched?: boolean;
    toggleWatched?: () => void;
    ratingInfo?: unknown;
};

type MetaPreviewType = React.ForwardRefExoticComponent<Props & React.RefAttributes<HTMLDivElement>> & {
    Placeholder?: typeof MetaPreviewPlaceholder;
};

const MetaPreview = React.forwardRef<HTMLDivElement, Props>(({
    className, compact, name, logo, background, runtime, releaseInfo, released, description,
    deepLinks, links, inLibrary, toggleInLibrary, watched, toggleWatched, ratingInfo,
}, ref) => {
    const { t } = useTranslation();
    const [shareModalOpen, openShareModal, closeShareModal] = useBinaryState(false);

    const linksGroups = React.useMemo(() => {
        return Array.isArray(links) ?
            links
                .filter((link) => link && typeof link.category === 'string' && typeof link.url === 'string')
                .reduce((linksGroups: Map<string, any>, { category, name, url }: Link) => {
                    const { protocol, path, pathname, hostname } = UrlUtils.parse(url as string);
                    if (category === CONSTANTS.IMDB_LINK_CATEGORY) {
                        if (hostname === 'imdb.com') {
                            linksGroups.set(category, {
                                label: name,
                                href: `https://www.stremio.com/warning#${encodeURIComponent(url as string)}`,
                            });
                        }
                    } else if (category === CONSTANTS.SHARE_LINK_CATEGORY) {
                        linksGroups.set(category, { label: name, href: url });
                    } else {
                        if (protocol === 'stremio:') {
                            if (pathname !== null && ALLOWED_LINK_REDIRECTS.some((regexp) => pathname.match(regexp))) {
                                if (!linksGroups.has(category as string)) {
                                    linksGroups.set(category as string, []);
                                }
                                linksGroups.get(category as string).push({ label: name, href: `#${path}` });
                            }
                        } else if (typeof hostname === 'string' && hostname.length > 0) {
                            if (!linksGroups.has(category as string)) {
                                linksGroups.set(category as string, []);
                            }
                            linksGroups.get(category as string).push({
                                label: name,
                                href: `https://www.stremio.com/warning#${encodeURIComponent(url as string)}`,
                            });
                        }
                    }
                    return linksGroups;
                }, new Map())
            :
            new Map();
    }, [links]);

    const showHref = React.useMemo(() => {
        return deepLinks ?
            typeof deepLinks.player === 'string' ?
                deepLinks.player
                :
                typeof deepLinks.metaDetailsStreams === 'string' ?
                    deepLinks.metaDetailsStreams
                    :
                    typeof deepLinks.metaDetailsVideos === 'string' ?
                        deepLinks.metaDetailsVideos
                        :
                        null
            :
            null;
    }, [deepLinks]);

    const renderLogoFallback = React.useCallback(() => (
        <div className={styles['logo-placeholder']}>{name}</div>
    ), [name]);

    const metaItemActions = React.useMemo(() => {
        const actions = [
            {
                icon: inLibrary ? BookmarkCheck : Bookmark,
                label: inLibrary ? t('REMOVE_FROM_LIB') : t('ADD_TO_LIB'),
                onClick: typeof toggleInLibrary === 'function' ? toggleInLibrary : undefined,
            },
            {
                icon: watched ? EyeOff : Eye,
                label: watched ? t('CTX_MARK_UNWATCHED') : t('CTX_MARK_WATCHED'),
                onClick: typeof toggleWatched === 'function' ? toggleWatched : undefined,
            },
        ];
        // Share lives in the same group as library/watched so every action reads as
        // one uniform pill, rather than a lone circular button beside them.
        if (linksGroups.has(CONSTANTS.SHARE_LINK_CATEGORY)) {
            actions.push({ icon: Share2, label: t('CTX_SHARE'), onClick: openShareModal });
        }
        return actions;
    }, [inLibrary, watched, toggleInLibrary, toggleWatched, linksGroups, openShareModal, t]);

    const hasActions = typeof toggleInLibrary === 'function' && typeof toggleWatched === 'function';

    return (
        <div className={[className, styles['meta-preview-container'], compact ? styles['compact'] : ''].filter(Boolean).join(' ')} ref={ref}>
            {
                typeof background === 'string' && background.length > 0 ?
                    <div className={styles['background-image-layer']}>
                        <Image className={styles['background-image']} src={background} alt={' '} />
                    </div>
                    :
                    null
            }
            <div className={styles['meta-info-container']}>
                {
                    typeof logo === 'string' && logo.length > 0 ?
                        <Image className={styles['logo']} src={logo} alt={' '} title={name} renderFallback={renderLogoFallback} />
                        :
                        renderLogoFallback()
                }
                {
                    !compact || (typeof releaseInfo === 'string' && releaseInfo.length > 0) || (released instanceof Date && !isNaN(released.getTime())) || (typeof runtime === 'string' && runtime.length > 0) || linksGroups.has(CONSTANTS.IMDB_LINK_CATEGORY) ?
                        <div className={styles['runtime-release-info-container']}>
                            {
                                typeof runtime === 'string' && runtime.length > 0 ?
                                    <div className={styles['runtime-label']}>{runtime}</div>
                                    :
                                    null
                            }
                            {
                                typeof releaseInfo === 'string' && releaseInfo.length > 0 ?
                                    <div className={styles['release-info-label']}>{releaseInfo}</div>
                                    :
                                    released instanceof Date && !isNaN(released.getTime()) ?
                                        <div className={styles['release-info-label']}>{released.getFullYear()}</div>
                                        :
                                        null
                            }
                            {
                                linksGroups.has(CONSTANTS.IMDB_LINK_CATEGORY) ?
                                    <Button
                                        variant="ghost"
                                        className={styles['imdb-button-container']}
                                        title={linksGroups.get(CONSTANTS.IMDB_LINK_CATEGORY).label}
                                        href={linksGroups.get(CONSTANTS.IMDB_LINK_CATEGORY).href}
                                        target={'_blank'}
                                        tabIndex={0}
                                    >
                                        <div className={styles['label']}>{linksGroups.get(CONSTANTS.IMDB_LINK_CATEGORY).label}</div>
                                        <Imdb className={styles['icon']} />
                                    </Button>
                                    :
                                    null
                            }
                            {
                                !compact ?
                                    <div className={styles['meta-actions']}>
                                        {
                                            hasActions ?
                                                <ActionsGroup items={metaItemActions} className={styles['group-container']} size="sm" />
                                                :
                                                null
                                        }
                                        {
                                            ratingInfo !== null && ratingInfo !== undefined ?
                                                <Ratings ratingInfo={ratingInfo as any} className={styles['group-container']} size="sm" />
                                                :
                                                null
                                        }
                                    </div>
                                    :
                                    null
                            }
                        </div>
                        :
                        null
                }
                {
                    typeof description === 'string' && description.length > 0 ?
                        <div className={styles['description-container']}>
                            {
                                !compact ?
                                    <div className={styles['label-container']}>{t('SUMMARY')}</div>
                                    :
                                    null
                            }
                            {description}
                        </div>
                        :
                        null
                }
                {
                    Array.from(linksGroups.keys())
                        .filter((category) => !HIDDEN_LINK_CATEGORIES.includes(category as string))
                        .map((category, index) => (
                            <MetaLinks
                                key={index}
                                className={styles['meta-links']}
                                label={category as string}
                                links={linksGroups.get(category as string)}
                            />
                        ))
                }
            </div>
            {
                compact ?
                    <div className={styles['action-buttons-container']}>
                        {
                            hasActions ?
                                <ActionsGroup items={metaItemActions} className="mb-4" />
                                :
                                null
                        }
                        {
                            typeof showHref === 'string' ?
                                <ActionButton
                                    className="mb-4 hover:bg-primary focus:bg-primary focus-visible:outline-none"
                                    icon={Play}
                                    label={t('SHOW')}
                                    tabIndex={0}
                                    href={showHref}
                                />
                                :
                                null
                        }
                    </div>
                    :
                    null
            }
            {
                linksGroups.has(CONSTANTS.SHARE_LINK_CATEGORY) ?
                    <Dialog open={shareModalOpen} onOpenChange={(open: boolean) => { if (!open) closeShareModal(); }}>
                        <DialogContent className="max-w-[32rem]">
                            <DialogTitle>{t('CTX_SHARE')}</DialogTitle>
                            <SharePrompt className={styles['share-prompt']} url={linksGroups.get(CONSTANTS.SHARE_LINK_CATEGORY).href} />
                        </DialogContent>
                    </Dialog>
                    :
                    null
            }
        </div>
    );
}) as MetaPreviewType;

MetaPreview.Placeholder = MetaPreviewPlaceholder;

export default MetaPreview;
