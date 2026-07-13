// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';
import { useCore } from 'rillio/core';

type CoreSuspenderValue = {
    getState: (model: string) => any;
    decodeStream: (stream: string) => any;
};

const CoreSuspenderContext = React.createContext<CoreSuspenderValue | null>(null);

CoreSuspenderContext.displayName = 'CoreSuspenderContext';

type WrappedPromise<T> = {
    read: () => T | undefined;
};

function wrapPromise<T>(promise: Promise<T>): WrappedPromise<T> {
    let status: 'pending' | 'success' | 'error' = 'pending';
    let result: T | unknown;
    const suspender = promise.then(
        (resp) => {
            status = 'success';
            result = resp;
        },
        (error) => {
            status = 'error';
            result = error;
        }
    );
    return {
        read() {
            if (status === 'pending') {
                throw suspender;
            } else if (status === 'error') {
                throw result;
            } else if (status === 'success') {
                return result as T;
            }
        }
    };
}

const useCoreSuspender = (): CoreSuspenderValue | null => {
    return React.useContext(CoreSuspenderContext);
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const withCoreSuspender = <P extends object>(
    Component: React.ComponentType<P>,
    Fallback: React.ComponentType<P> = () => null
) => {
    return function withCoreSuspender(props: P) {
        const core = useCore();
        const parentSuspender = useCoreSuspender();
        const [render, setRender] = React.useState(parentSuspender === null);
        const statesRef = React.useRef<Record<string, WrappedPromise<any>>>({});
        const streamsRef = React.useRef<Record<string, WrappedPromise<any>>>({});
        const getState = React.useCallback((model: string) => {
            if (!statesRef.current[model]) {
                statesRef.current[model] = wrapPromise(core.transport.getState(model));
            }

            return statesRef.current[model].read();
        }, []);
        const decodeStream = React.useCallback((stream: string) => {
            if (!streamsRef.current[stream]) {
                streamsRef.current[stream] = wrapPromise(core.transport.decodeStream(stream));
            }

            return streamsRef.current[stream].read();
        }, []);
        const suspender = React.useMemo(() => ({ getState, decodeStream }), []);
        React.useLayoutEffect(() => {
            if (!render) {
                setRender(true);
            }
        }, []);
        return render ?
            <React.Suspense fallback={<Fallback {...props} />}>
                <CoreSuspenderContext.Provider value={suspender}>
                    <Component {...props} />
                </CoreSuspenderContext.Provider>
            </React.Suspense>
            :
            null;
    };
};

export { withCoreSuspender, useCoreSuspender };
