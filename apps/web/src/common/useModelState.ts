// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';
import { deepEqual } from 'fast-equals';
import { useCore } from 'rillio/core';
import { useCoreSuspender } from 'rillio/common/CoreSuspender';
import useRouteFocused from 'rillio/common/useRouteFocused';

// lodash.throttle / lodash.intersection ship no type declarations, so they are
// kept as untyped `require` (typed `any`) rather than introducing a broken import.
const throttle = require('lodash.throttle');
const intersection = require('lodash.intersection');

type ModelStateOptions = {
    action?: DispatchAction;
    model: string;
    timeout?: number;
    map?: (state: any) => any;
    deps?: string[];
};

const useModelState = ({ action, ...args }: ModelStateOptions): any => {
    const core = useCore();
    const routeFocused = useRouteFocused();
    const mountedRef = React.useRef(false);
    const [model, timeout, map, deps] = React.useMemo(() => {
        return [args.model, args.timeout, args.map, args.deps] as const;
    }, []);
    const { getState } = useCoreSuspender()!;
    const [state, setState] = React.useReducer(
        (prevState: any, nextState: any) => {
            return Object.keys(prevState).reduce((result: any, key) => {
                result[key] = deepEqual(prevState[key], nextState[key]) ? prevState[key] : nextState[key];
                return result;
            }, {});
        },
        undefined,
        () => {
            const state = getState(model);
            return typeof map === 'function' ? map(state) : state;
        }
    );
    React.useEffect(() => {
        if (action) {
            core.transport.dispatch(action, model);
        }
    }, [action]);
    React.useEffect(() => {
        return () => {
            core.transport.dispatch({ action: 'Unload' }, model);
        };
    }, []);
    React.useEffect(() => {
        const onNewState = async (models: string[]) => {
            if (models.indexOf(model) === -1 && (!Array.isArray(deps) || intersection(deps, models).length === 0)) {
                return;
            }

            const state = await core.transport.getState(model);
            if (typeof map === 'function') {
                setState(map(state));
            } else {
                setState(state);
            }
        };
        const onNewStateThrottled = throttle(onNewState, timeout);
        if (routeFocused) {
            core.on('state', onNewStateThrottled);
            if (mountedRef.current) {
                onNewState([model]);
            }
        }
        return () => {
            onNewStateThrottled.cancel();
            core.off('state', onNewStateThrottled);
        };
    }, [routeFocused]);
    React.useEffect(() => {
        mountedRef.current = true;
    }, []);
    return state;
};

export = useModelState;
