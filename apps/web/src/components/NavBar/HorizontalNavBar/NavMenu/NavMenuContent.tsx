// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Account hub panel (contents of the NavMenu popover). THE ACCOUNT, AND NOTHING
 * ELSE: who you are, and the way out.
 *
 * It used to carry a menu of eight rows, nearly all of them a second door to
 * something that already had one. Settings duplicated the nav's own gear icon;
 * Help & Feedback and Website duplicated, link for link, the Support and Website
 * entries in Settings > General; and Sync & backup / Import from Stremio / Upload
 * to Stremio were three rows opening ONE modal on three tabs. What genuinely had
 * no other home (sync, Play URL/Magnet) moved into Settings > General rather than
 * keeping a menu alive for it.
 *
 * Fullscreen is the one survivor, and only in a browser: `!inShell` means the
 * desktop shell never renders it (its window header owns real fullscreen), and
 * there is no window chrome to host it on the web. So in the shell this panel IS
 * account-only.
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Minimize, Maximize } from 'lucide-react';
import { useCore } from 'rillio/core';
import { useFullscreen } from 'rillio/common/Fullscreen';
import { withCoreSuspender } from 'rillio/common/CoreSuspender';
import { useDisplayName } from 'rillio/common/useDisplayName';
import { Button } from 'rillio/components/ui/button';
import DisplayNameEdit from 'rillio/components/DisplayNameEdit';
import { useIsShell } from 'rillio/components/WindowControls/WindowControls';

const useProfile = require('rillio/common/useProfile');
const usePWA = require('rillio/common/usePWA');
const avatarAnonymous = require('/assets/images/avatar-anonymous.svg');
const avatarDefault = require('/assets/images/avatar-default.svg');

const ROW = 'flex h-11 w-full items-center gap-3 rounded-none px-5 text-sm font-normal text-fg transition-colors duration-150 hover:bg-surface-hover [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-subtle hover:[&_svg]:text-fg';

type Props = {
    onSelect?: () => void,
};

const NavMenuContent = ({ onSelect }: Props) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const core = useCore();
    const profile = useProfile();
    const [displayName, setDisplayName] = useDisplayName();
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    const [, isAndroidPWA] = usePWA();
    // In the desktop shell the window header owns (native) fullscreen; this
    // browser-API entry would only fullscreen the webview inside the frame.
    const inShell = useIsShell();

    const logout = React.useCallback(() => {
        core.transport.dispatch({ action: 'Ctx', args: { action: 'Logout' } });
    }, [core]);

    const handleAuth = React.useCallback(() => {
        return profile.auth !== null ? logout() : navigate('/intro');
    }, [profile.auth, logout, navigate]);

    const avatarUrl = profile.auth === null
        ? avatarAnonymous
        : (profile.auth.user.avatar || avatarDefault);

    return (
        <div className="max-h-[calc(100vh-6rem)] w-[22rem] max-w-[calc(100vw-1rem)] overflow-y-auto" onClick={onSelect}>
            <div className="flex items-center gap-4 p-6">
                <div
                    className="size-10 shrink-0 rounded-full bg-cover bg-center bg-no-repeat opacity-90"
                    style={{ backgroundImage: `url('${avatarUrl}')`, backgroundColor: 'var(--color-fg)' }}
                />
                <div className="flex min-w-0 flex-auto flex-col justify-center">
                    <DisplayNameEdit className="min-h-[1.6rem]" value={displayName} onCommit={setDisplayName} />
                    {
                        profile.auth !== null ?
                            <div className="mt-1 flex items-center gap-2">
                                <div className="min-w-0 flex-1 truncate text-[0.85rem] text-fg-subtle" title={profile.auth.user.email}>{profile.auth.user.email}</div>
                                <Button
                                    variant="link"
                                    className="h-auto shrink-0 p-0 text-[0.85rem] font-semibold text-accent no-underline hover:brightness-110 hover:no-underline"
                                    title={t('LOG_OUT')}
                                    onClick={handleAuth}
                                >
                                    {t('LOG_OUT')}
                                </Button>
                            </div>
                            :
                            <div className="mt-1 text-[0.85rem] text-fg-subtle">{t('ANONYMOUS_USER')}</div>
                    }
                </div>
            </div>

            {
                supported && !isAndroidPWA && !inShell ?
                    <div className="border-t border-line py-1">
                        <Button variant="ghost" className={ROW} title={fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                            {fullscreen ? <Minimize /> : <Maximize />}
                            <span className="flex-1 text-left">{fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')}</span>
                        </Button>
                    </div>
                    :
                    null
            }

        </div>
    );
};

const NavMenuContentFallback = () => (
    <div className="w-[22rem] max-w-[calc(100vw-1rem)]" />
);

export default withCoreSuspender(NavMenuContent, NavMenuContentFallback);
