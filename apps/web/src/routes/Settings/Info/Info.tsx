import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from 'rillio/common';
import { Option, Section } from '../components';

type Props = {
    streamingServer: StreamingServer,
};

const Info = ({ streamingServer }: Props) => {
    const { shell } = usePlatform();
    const { t } = useTranslation();

    const settings = useMemo(() => (
        streamingServer?.settings?.type === 'Ready' ?
            streamingServer.settings.content as StreamingServerSettings : null
    ), [streamingServer?.settings]);

    return (
        <Section className="hidden max-[1000px]:flex">
            {/* Rillio's OWN version. process.env.VERSION is the web bundle's,
                still carrying upstream's 5.0.0-beta.x, which read as a different
                app entirely next to an updater that ships 0.1.x. The shell knows
                the real one; the browser build has no shell, so it falls back. */}
            <Option label={t('SETTINGS_APP_VERSION')}>
                <div className="w-full truncate text-fg">
                    {typeof shell.state.version === 'string' ? shell.state.version : process.env.VERSION}
                </div>
            </Option>
            <Option label={t('SETTINGS_BUILD_VERSION')}>
                <div className="w-full truncate text-fg">
                    {process.env.COMMIT_HASH}
                </div>
            </Option>
            {
                settings?.serverVersion &&
                    <Option label={t('SETTINGS_SERVER_VERSION')}>
                        <div className="w-full truncate text-fg">
                            {settings.serverVersion}
                        </div>
                    </Option>
            }
            {/* No separate "Shell version" row: it is the app version above. */}
        </Section>
    );
};

export default Info;
