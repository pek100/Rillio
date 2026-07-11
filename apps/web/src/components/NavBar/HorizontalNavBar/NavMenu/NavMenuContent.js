// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useCore } = require('rillio/core');
const { Button } = require('rillio/components');
const { useFullscreen } = require('rillio/common/Fullscreen');
const useProfile = require('rillio/common/useProfile');
const usePWA = require('rillio/common/usePWA');
const { default: usePlayUrl } = require('rillio/common/usePlayUrl');
const useToast = require('rillio/common/Toast/useToast');
const { withCoreSuspender } = require('rillio/common/CoreSuspender');
const useStreamingServer = require('rillio/common/useStreamingServer');
const { useDisplayName } = require('rillio/common/useDisplayName');
const { openSync } = require('rillio/common/syncEvents');
const { default: DisplayNameEdit } = require('rillio/components/DisplayNameEdit');
const { useIsShell } = require('rillio/components/WindowControls/WindowControls');
const styles = require('./styles');

const NavMenuContent = ({ onClick }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const core = useCore();
    const profile = useProfile();
    const [displayName, setDisplayName] = useDisplayName();
    const streamingServer = useStreamingServer();
    const { handlePlayUrl } = usePlayUrl();
    const toast = useToast();
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    const [, isAndroidPWA] = usePWA();
    // In the desktop shell the window header owns fullscreen (native, actually
    // fullscreens the window); this browser-API entry would only fullscreen the
    // webview inside the frame.
    const inShell = useIsShell();
    const streamingServerWarningDismissed = React.useMemo(() => {
        return streamingServer.settings !== null && streamingServer.settings.type === 'Ready' || (
            !isNaN(profile.settings.streamingServerWarningDismissed.getTime()) &&
            profile.settings.streamingServerWarningDismissed.getTime() > Date.now()
        );
    }, [profile.settings, streamingServer.settings]);
    const logoutButtonOnClick = React.useCallback(() => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'Logout'
            }
        });
    }, []);
    const onPlayMagnetLinkClick = React.useCallback(async () => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            const handled = await handlePlayUrl(clipboardText);
            if (!handled) {
                toast.show({
                    type: 'error',
                    title: 'Clipboard does not contain a valid URL or magnet link.',
                    timeout: 5000
                });
            }
        } catch(e) {
            console.error(e);
        }
    }, [handlePlayUrl]);
    const handleAuth = React.useCallback(() => {
        return profile.auth !== null
            ? logoutButtonOnClick()
            : navigate('/intro');
    }, [profile.auth, logoutButtonOnClick, navigate]);

    return (
        <div className={classnames(styles['nav-menu-container'], 'animation-fade-in', { [styles['with-warning']]: !streamingServerWarningDismissed } )} onClick={onClick}>
            <div className={styles['user-info-container']}>
                <div
                    className={styles['avatar-container']}
                    style={{
                        backgroundImage: profile.auth === null ?
                            `url('${require('/assets/images/avatar-anonymous.svg')}')`
                            :
                            profile.auth.user.avatar ?
                                `url('${profile.auth.user.avatar}')`
                                :
                                `url('${require('/assets/images/avatar-default.svg')}')`
                    }}
                />
                <div className={styles['user-info-details']}>
                    <DisplayNameEdit className={styles['name-container']} value={displayName} onCommit={setDisplayName} />
                    {
                        profile.auth !== null ?
                            <div className={styles['email-container']}>
                                <div className={styles['email-label']} title={profile.auth.user.email}>{profile.auth.user.email}</div>
                                <Button className={styles['logout-button-container']} title={t('LOG_OUT')} onClick={handleAuth}>
                                    <div className={styles['logout-label']}>{t('LOG_OUT')}</div>
                                </Button>
                            </div>
                            :
                            <div className={styles['email-container']}>
                                <div className={styles['anon-label']}>{t('ANONYMOUS_USER')}</div>
                            </div>
                    }
                </div>
            </div>
            {
                supported && !isAndroidPWA && !inShell ?
                    <div className={styles['nav-menu-section']}>
                        <Button className={styles['nav-menu-option-container']} title={fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                            <Icon className={styles['icon']} name={fullscreen ? 'minimize' : 'maximize'} />
                            <div className={styles['nav-menu-option-label']}>{fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')}</div>
                        </Button>
                    </div>
                    :
                    null
            }
            <div className={styles['nav-menu-section']}>
                <Button className={styles['nav-menu-option-container']} title={ t('SETTINGS') } href={'#/settings'}>
                    <Icon className={styles['icon']} name={'settings'} />
                    <div className={styles['nav-menu-option-label']}>{ t('SETTINGS') }</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={'Sync & backup'} onClick={() => openSync('backup')}>
                    <Icon className={styles['icon']} name={'cloud-sync'} />
                    <div className={styles['nav-menu-option-label']}>Sync & backup</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={'Import from Stremio'} onClick={() => openSync('stremio')}>
                    <Icon className={styles['icon']} name={'download'} />
                    <div className={styles['nav-menu-option-label']}>Import from Stremio</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={ t('PLAY_URL_MAGNET_LINK') } onClick={onPlayMagnetLinkClick}>
                    <Icon className={styles['icon']} name={'magnet-link'} />
                    <div className={styles['nav-menu-option-label']}>{ t('PLAY_URL_MAGNET_LINK') }</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={ t('HELP_FEEDBACK') } href={'https://stremio.zendesk.com/'} target={'_blank'}>
                    <Icon className={styles['icon']} name={'help'} />
                    <div className={styles['nav-menu-option-label']}>{ t('HELP_FEEDBACK') }</div>
                </Button>
            </div>
            <div className={styles['nav-menu-section']}>
                <Button className={styles['nav-menu-option-container']} title={ t('TERMS_OF_SERVICE') } href={'https://www.stremio.com/tos'} target={'_blank'}>
                    <div className={styles['nav-menu-option-label']}>{ t('TERMS_OF_SERVICE') }</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={ t('PRIVACY_POLICY') } href={'https://www.stremio.com/privacy'} target={'_blank'}>
                    <div className={styles['nav-menu-option-label']}>{ t('PRIVACY_POLICY') }</div>
                </Button>
                {
                    profile.auth !== null ?
                        <Button className={styles['nav-menu-option-container']} title={ t('USER_PANEL') } href={'https://www.stremio.com/acc-settings'} target={'_blank'}>
                            <div className={styles['nav-menu-option-label']}>{ t('USER_PANEL') }</div>
                        </Button>
                        :
                        null
                }
            </div>
        </div>
    );
};

NavMenuContent.propTypes = {
    onClick: PropTypes.func
};

const NavMenuContentFallback = () => (
    <div className={styles['nav-menu-container']} />
);

module.exports = withCoreSuspender(NavMenuContent, NavMenuContentFallback);
