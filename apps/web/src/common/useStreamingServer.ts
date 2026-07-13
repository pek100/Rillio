// Copyright (C) 2017-2023 Smart code 203358507

import useModelState from 'rillio/common/useModelState';

const useStreamingServer = (): StreamingServer => {
    return useModelState({ model: 'streaming_server' });
};

export = useStreamingServer;
