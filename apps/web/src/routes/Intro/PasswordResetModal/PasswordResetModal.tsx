// Copyright (C) 2017-2024 Smart code 203358507

/**
 * PasswordResetModal - a small confirm-style dialog for the login form's
 * "forgot password" flow. Trigger-driven (mounted by Intro while its binary state
 * is open), so it uses the kit Dialog's own open state rather than the URL-driven
 * ModalRoute shell. Send opens the external Stremio reset URL; every hook and the
 * email-validity check are reused verbatim.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from 'rillio/common';
import useRouteFocused from 'rillio/common/useRouteFocused';
import { Dialog, DialogContent, DialogTitle, DialogFooter, Button } from 'rillio/components/ui';
import CredentialsTextInput from '../CredentialsTextInput';

type Props = {
    email?: string;
    onCloseRequest: () => void;
};

const PasswordResetModal = ({ email, onCloseRequest }: Props) => {
    const { t } = useTranslation();
    const routeFocused = useRouteFocused();
    const platform = usePlatform();
    const [error, setError] = useState('');
    const emailRef = useRef<HTMLInputElement>(null);
    const goToPasswordReset = useCallback(() => {
        if (emailRef.current && emailRef.current.value.length > 0 && emailRef.current.validity.valid) {
            platform.openExternal('https://www.strem.io/reset-password/' + emailRef.current.value, '_blank');
        } else {
            setError(t('INVALID_EMAIL'));
        }
    }, []);
    const emailOnChange = useCallback(() => {
        setError('');
    }, []);
    useEffect(() => {
        if (routeFocused && emailRef.current) {
            emailRef.current.focus();
        }
    }, [routeFocused]);
    return (
        <Dialog open onOpenChange={(next) => { if (!next) onCloseRequest(); }}>
            <DialogContent className="w-full max-w-[30rem] gap-0 max-[640px]:max-w-[calc(100vw-3rem)]">
                <DialogTitle className="mb-6 pr-8">{t('PASSWORD_RESET')}</DialogTitle>
                <CredentialsTextInput
                    ref={emailRef}
                    className="h-14 px-4 text-base"
                    type="email"
                    placeholder={t('EMAIL')}
                    defaultValue={typeof email === 'string' ? email : ''}
                    onChange={emailOnChange}
                    onSubmit={goToPasswordReset}
                />
                {
                    error.length > 0 ?
                        <div className="mt-8 text-center text-[1.1rem] text-danger">{error}</div>
                        :
                        null
                }
                <DialogFooter className="mt-8">
                    <Button
                        variant="ghost"
                        className="h-14 px-6 bg-surface text-fg hover:bg-surface-hover"
                        onClick={onCloseRequest}
                    >
                        {t('BUTTON_CANCEL')}
                    </Button>
                    <Button className="h-14 px-6" onClick={goToPasswordReset}>
                        {t('BUTTON_SEND')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PasswordResetModal;
