// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';

const usePWA = (): [boolean | undefined, boolean] => {
    const isPWA = React.useMemo<[boolean | undefined, boolean]>(() => {
        const isIOSPWA = (window.navigator as Navigator & { standalone?: boolean }).standalone;
        const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
        return [isIOSPWA, isAndroidPWA];
    }, []);
    return isPWA;
};

export = usePWA;
