// Copyright (C) 2017-2023 Smart code 203358507

import * as React from 'react';

const useLiveRef = <T>(value: T): React.MutableRefObject<T> => {
    const ref = React.useRef<T>(value);
    ref.current = value;
    return ref;
};

export = useLiveRef;
