// Copyright (C) 2017-2023 Smart code 203358507

import useModelState from 'rillio/common/useModelState';

const map = (ctx: any) => ctx.notifications;

const useNotifications = (): Notifications => {
    return useModelState({ model: 'ctx', map });
};

export = useNotifications;
