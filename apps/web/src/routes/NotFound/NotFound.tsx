// Copyright (C) 2017-2024 Smart code 203358507

/**
 * NotFound - the full-screen 404 state. A shared HorizontalNavBar (nav family,
 * referenced not rebuilt) over a centered branded empty illustration + label. Pure
 * view; the only logic is the i18n label.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { HorizontalNavBar, Image } from 'rillio/components';

const NotFound = () => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col w-full h-full bg-transparent">
            <HorizontalNavBar
                className="flex-none self-stretch"
                title={t('PAGE_NOT_FOUND')}
                backButton={true}
                fullscreenButton={true}
                navMenu={true}
            />
            <div className="flex-1 self-stretch flex flex-col items-center justify-center">
                <Image
                    className="flex-none w-48 h-48 mb-4 object-contain object-center opacity-90 animate-in fade-in zoom-in-95 duration-500"
                    src={require('/assets/images/empty.svg')}
                    alt=" "
                />
                <div className="flex-none max-w-[60%] max-h-[3.6em] text-center text-[2.5rem] text-fg-muted">
                    {t('PAGE_NOT_FOUND')}
                </div>
            </div>
        </div>
    );
};

export default NotFound;
