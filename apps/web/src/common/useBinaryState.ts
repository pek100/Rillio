// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';

const useBinaryState = (initialValue?: boolean): [
    boolean,
    () => void,
    () => void,
    () => void,
] => {
    const [value, setValue] = React.useState(!!initialValue);
    const on = React.useCallback(() => {
        setValue(true);
    }, []);
    const off = React.useCallback(() => {
        setValue(false);
    }, []);
    const toggle = React.useCallback(() => {
        setValue(!value);
    }, [value]);
    return [value, on, off, toggle];
};

export = useBinaryState;
