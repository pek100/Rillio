// Copyright (C) 2017-2025 Smart code 203358507

/**
 * MetaRowPlaceholder - skeleton row shown while a catalog loads. Ported to
 * TypeScript, and (LESS purge, Stage B) off its structural LESS module onto Tailwind.
 * Board / Search hide overflow skeletons per breakpoint via arbitrary-variant classes
 * on the row's own className (targeting the items container's children), so nothing
 * per-item is needed here.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Button } from 'rillio/components/ui/button';
const CONSTANTS = require('rillio/common/CONSTANTS');

type Props = {
    className?: string;
    title?: string;
    deepLinks?: { discover?: string };
};

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

const S = {
    header: 'flex flex-row items-center justify-end px-4 mb-2',
    title: 'flex-1 max-h-[2.4em] text-[1.6rem] font-semibold text-[color:var(--color-placeholder-text)] empty:h-[1.2em] empty:bg-[linear-gradient(to_right,var(--color-placeholder-background)_0_40%,transparent_40%_100%)]',
    seeAll: 'flex-none flex flex-row items-center max-w-48 p-[0.2rem] gap-0 focus:bg-[var(--color-placeholder-background)]',
    label: 'flex-[0_1_auto] max-h-[1.2em] text-base font-medium text-[color:var(--color-placeholder-text)]',
    icon: 'flex-none h-4 ml-2 text-[color:var(--color-placeholder-text)]',
    items: 'flex flex-row items-stretch',
    item: 'flex-1 m-4 [&:not(:first-child)]:ml-6 max-[640px]:m-2 max-[640px]:[&:not(:first-child)]:ml-2',
    poster: 'rounded-[var(--border-radius)] pb-[calc(100%*var(--poster-shape-ratio))] bg-[var(--color-placeholder-background)]',
    titleBar: 'flex flex-row items-center justify-center h-[2.8rem] max-[640px]:mt-2',
    titleLabel: 'flex-none w-[60%] h-[1.2rem] rounded-[var(--border-radius)] bg-[var(--color-placeholder-background)]',
};

const MetaRowPlaceholder = ({ className, title, deepLinks }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={className}>
            <div className={S.header}>
                <div className={S.title} title={typeof title === 'string' && title.length > 0 ? title : undefined}>
                    {typeof title === 'string' && title.length > 0 ? title : null}
                </div>
                {
                    deepLinks && typeof deepLinks.discover === 'string' ?
                        <Button variant="ghost" className={S.seeAll} title={t('BUTTON_SEE_ALL')} href={deepLinks.discover} tabIndex={-1}>
                            <div className={S.label}>{ t('BUTTON_SEE_ALL') }</div>
                            <ChevronRight className={S.icon} />
                        </Button>
                        :
                        null
                }
            </div>
            <div className={S.items}>
                {Array(CONSTANTS.CATALOG_PREVIEW_SIZE).fill(null).map((_: null, index: number) => (
                    <div key={index} className={S.item}>
                        <div className={S.poster} />
                        <div className={S.titleBar}>
                            <div className={S.titleLabel} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MetaRowPlaceholder;
