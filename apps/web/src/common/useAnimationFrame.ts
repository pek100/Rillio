// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';

type RequestFn = (cb: () => void) => void;
type CancelFn = () => void;

const useAnimationFrame = (): [RequestFn, CancelFn] => {
    const animationFrameId = React.useRef<number | null>(null);
    const cancel = React.useCallback(() => {
        cancelAnimationFrame(animationFrameId.current!);
        animationFrameId.current = null;
    }, []);
    const request = React.useCallback((cb: () => void) => {
        cancel();
        animationFrameId.current = requestAnimationFrame(() => {
            cb();
            animationFrameId.current = null;
        });
    }, []);
    return [request, cancel];
};

export = useAnimationFrame;
