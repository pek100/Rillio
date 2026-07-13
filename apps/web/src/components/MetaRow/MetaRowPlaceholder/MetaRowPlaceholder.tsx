// Copyright (C) 2017-2025 Smart code 203358507

/**
 * MetaRowPlaceholder - skeleton row shown while a catalog loads. Ported to
 * TypeScript. The structural LESS module is retained because Board and Search compose
 * its `.meta-item` class (as `meta-item-placeholder`) to hide items per breakpoint.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Button } from 'rillio/components/ui/button';
import styles from './styles.less';
const CONSTANTS = require('rillio/common/CONSTANTS');

type Props = {
    className?: string;
    title?: string;
    deepLinks?: { discover?: string };
};

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

const MetaRowPlaceholder = ({ className, title, deepLinks }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={cx(className, styles['meta-row-placeholder-container'])}>
            <div className={styles['header-container']}>
                <div className={styles['title-container']} title={typeof title === 'string' && title.length > 0 ? title : undefined}>
                    {typeof title === 'string' && title.length > 0 ? title : null}
                </div>
                {
                    deepLinks && typeof deepLinks.discover === 'string' ?
                        <Button variant="ghost" className={cx(styles['see-all-container'], 'gap-0')} title={t('BUTTON_SEE_ALL')} href={deepLinks.discover} tabIndex={-1}>
                            <div className={styles['label']}>{ t('BUTTON_SEE_ALL') }</div>
                            <ChevronRight className={styles['icon']} />
                        </Button>
                        :
                        null
                }
            </div>
            <div className={styles['meta-items-container']}>
                {Array(CONSTANTS.CATALOG_PREVIEW_SIZE).fill(null).map((_: null, index: number) => (
                    <div key={index} className={styles['meta-item']}>
                        <div className={styles['poster-container']} />
                        <div className={styles['title-bar-container']}>
                            <div className={styles['title-label']} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MetaRowPlaceholder;
