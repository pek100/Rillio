// Copyright (C) 2017-2026 Smart code 203358507

/**
 * CatalogRows - the shared catalog -> MetaRow tri-state mapper used by the Board (home)
 * and Search routes. Both rendered the identical Loading skeleton / Ready row / Err
 * (message or empty) mapping over their catalogs windowing; this is the single copy.
 *
 * The per-breakpoint poster trim (LESS purge, Stage B) is expressed with structural
 * arbitrary-variant classes on each row's OWN className that hide the items-container's
 * overflow children once the viewport is too narrow to fit them (the old nth-child media
 * queries, 2200/1900/1600/1300/1000/800/640px). `>*:last-child` is the items container
 * (Ready + placeholder rows both end with it); its children are the poster items.
 */

import React from 'react';
import useTranslate from 'rillio/common/useTranslate';
import MetaRow from 'rillio/components/MetaRow';
import MetaItem from 'rillio/components/MetaItem';

export const HIDE_POSTER =
    'max-[2200px]:[&>*:last-child>*:nth-child(n+10)]:hidden ' +
    'max-[1900px]:[&>*:last-child>*:nth-child(n+9)]:hidden ' +
    'max-[1600px]:[&>*:last-child>*:nth-child(n+8)]:hidden ' +
    'max-[1300px]:[&>*:last-child>*:nth-child(n+7)]:hidden ' +
    'max-[1000px]:[&>*:last-child>*:nth-child(n+6)]:hidden ' +
    'max-[800px]:[&>*:last-child>*:nth-child(n+5)]:hidden ' +
    'max-[640px]:[&>*:last-child>*:nth-child(n+4)]:hidden';

export const HIDE_LANDSCAPE =
    'max-[2200px]:[&>*:last-child>*:nth-child(n+9)]:hidden ' +
    'max-[1900px]:[&>*:last-child>*:nth-child(n+8)]:hidden ' +
    'max-[1600px]:[&>*:last-child>*:nth-child(n+7)]:hidden ' +
    'max-[1300px]:[&>*:last-child>*:nth-child(n+6)]:hidden ' +
    'max-[1000px]:[&>*:last-child>*:nth-child(n+5)]:hidden ' +
    'max-[800px]:[&>*:last-child>*:nth-child(n+4)]:hidden';

export const hideClassesForShape = (posterShape: string | undefined): string =>
    posterShape === 'landscape' ? HIDE_LANDSCAPE : HIDE_POSTER;

// Row rhythm shared by every catalog row: 1rem top / 2rem bottom, tightened to 1.5rem
// bottom at the minimum width, plus the mount fade.
export const ROW_CLASS = 'mt-4 mb-8 max-[640px]:mb-6 animation-fade-in';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const CatalogRows = ({ catalogs }: { catalogs: any[] }) => {
    const t = useTranslate();
    return (
        <>
            {catalogs.map((catalog: any, index: number) => {
                switch (catalog.content?.type) {
                    case 'Ready': {
                        return (
                            <MetaRow
                                key={index}
                                className={cx(ROW_CLASS, hideClassesForShape(catalog.content.content[0].posterShape))}
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
                                    className={ROW_CLASS}
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
                                className={cx(ROW_CLASS, HIDE_POSTER)}
                                catalog={catalog}
                                title={t.catalogTitle(catalog)}
                            />
                        );
                    }
                }
            })}
        </>
    );
};

export default CatalogRows;
