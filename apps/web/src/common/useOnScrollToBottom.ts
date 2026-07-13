// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';

const useOnScrollToBottom = (cb: (event: React.UIEvent<HTMLElement>) => void, threshold = 0) => {
    const triggeredRef = React.useRef(false);
    const onScroll = React.useCallback((event: React.UIEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - threshold) {
            if (!triggeredRef.current) {
                triggeredRef.current = true;
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        } else {
            triggeredRef.current = false;
        }
    }, [cb]);
    return onScroll;
};

export = useOnScrollToBottom;
