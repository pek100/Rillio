// Copyright (C) 2017-2023 Smart code 203358507

import useModelState from 'rillio/common/useModelState';

const map = (ctx: any) => ({
    ...ctx.profile,
    settings: {
        ...ctx.profile.settings,
        streamingServerWarningDismissed: new Date(
            typeof ctx.profile.settings.streamingServerWarningDismissed === 'string' ?
                ctx.profile.settings.streamingServerWarningDismissed
                :
                NaN
        )
    }
});

const useProfile = (): Profile => {
    return useModelState({ model: 'ctx', map });
};

export = useProfile;
