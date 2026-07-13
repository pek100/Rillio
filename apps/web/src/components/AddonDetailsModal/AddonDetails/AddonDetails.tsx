// Copyright (C) 2017-2024 Smart code 203358507

/**
 * AddonDetails - the addon manifest card shown inside AddonDetailsModal. Clean-room
 * rewrite as a flat divide-y read-out (logo + name + rounded-full version pill, then
 * a divided list of description / URL / supported types / disclaimer), matching the
 * Addon-row idiom for this family. View-only: the props contract is unchanged and the
 * Image broken-state fallback (Puzzle glyph) is preserved.
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle } from 'lucide-react';
import Image from 'rillio/components/Image';
import { cn } from 'rillio/components/ui/cn';

type Props = {
    className?: string;
    id?: string;
    name?: string;
    version?: string;
    logo?: string;
    description?: string;
    types?: string[];
    transportUrl?: string;
    official?: boolean;
};

const AddonDetails = ({ className, id, name, version, logo, description, types, transportUrl, official }: Props) => {
    const { t } = useTranslation();
    const renderLogoFallback = useCallback(() => (
        <Puzzle className="block size-full p-2.5 text-fg-muted" />
    ), []);

    const displayName = typeof name === 'string' && name.length > 0 ? name : id;
    const hasVersion = typeof version === 'string' && version.length > 0;
    const hasDescription = typeof description === 'string' && description.length > 0;
    const hasTransportUrl = typeof transportUrl === 'string' && transportUrl.length > 0;
    const hasTypes = Array.isArray(types) && types.length > 0;
    const typesLabel = hasTypes
        ? (types!.length === 1 ? types![0] : `${types!.slice(0, -1).join(', ')} & ${types![types!.length - 1]}`)
        : null;

    return (
        <div className={cn('flex flex-col', className)}>
            <div className="flex items-center gap-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-card bg-surface">
                    <Image
                        className="block size-full object-contain p-2"
                        src={logo}
                        alt=" "
                        renderFallback={renderLogoFallback}
                    />
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xl font-semibold text-fg" title={displayName}>{displayName}</span>
                    {
                        hasVersion ?
                            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-fg-muted">
                                {t('ADDON_VERSION_SHORT', { version })}
                            </span>
                            :
                            null
                    }
                </div>
            </div>
            {
                hasDescription || hasTransportUrl || hasTypes || !official ?
                    <div className="mt-4 divide-y divide-line">
                        {
                            hasDescription ?
                                <p className="py-3 text-sm font-light leading-relaxed text-fg first:pt-0">{description}</p>
                                :
                                null
                        }
                        {
                            hasTransportUrl ?
                                <div className="py-3 first:pt-0">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('URL')}</div>
                                    <div className="mt-1 select-text break-all text-sm text-fg-muted">{transportUrl}</div>
                                </div>
                                :
                                null
                        }
                        {
                            hasTypes ?
                                <div className="py-3 first:pt-0">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('ADDON_SUPPORTED_TYPES')}</div>
                                    <div className="mt-1 text-sm capitalize text-fg-muted">{typesLabel}</div>
                                </div>
                                :
                                null
                        }
                        {
                            !official ?
                                <div className="py-3 text-sm italic leading-relaxed text-fg-muted first:pt-0">{t('ADDON_DISCLAIMER')}</div>
                                :
                                null
                        }
                    </div>
                    :
                    null
            }
        </div>
    );
};

export default AddonDetails;
