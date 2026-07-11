import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '@stremio/stremio-icons/react';
import { useCore } from 'rillio/core';
import { useDisplayName } from 'rillio/common/useDisplayName';
import { openSync } from 'rillio/common/syncEvents';
import { Link } from '../../components';
import styles from './User.less';

type Props = {
    profile: Profile,
};

const User = ({ profile }: Props) => {
    const { t } = useTranslation();
    const core = useCore();
    const [displayName, setDisplayName] = useDisplayName();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const avatar = useMemo(() => (
        !profile.auth ?
            `url('${require('/assets/images/avatar-anonymous.svg')}')`
            :
            profile.auth.user.avatar ?
                `url('${profile.auth.user.avatar}')`
                :
                `url('${require('/assets/images/avatar-default.svg')}')`
    ), [profile.auth]);

    const onLogout = useCallback(() => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'Logout'
            }
        });
    }, []);

    const startEdit = useCallback(() => { setDraft(displayName); setEditing(true); }, [displayName]);
    const commit = useCallback(() => { setDisplayName(draft); setEditing(false); }, [draft, setDisplayName]);
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
    }, [commit]);
    useEffect(() => {
        if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    return (
        <div className={styles['user']}>
            <div className={styles['user-info-content']}>
                <div
                    className={styles['avatar-container']}
                    style={{ backgroundImage: avatar }}
                />
                <div className={styles['email-logout-container']}>
                    <div className={styles['name-row']}>
                        {
                            editing ?
                                <input
                                    ref={inputRef}
                                    className={styles['name-input']}
                                    value={draft}
                                    maxLength={40}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    onBlur={commit}
                                />
                                :
                                <React.Fragment>
                                    <div className={styles['name-label']} title={displayName}>{displayName}</div>
                                    <button type={'button'} className={styles['name-edit']} title={'Edit name'} onClick={startEdit}>
                                        <Icon className={styles['name-edit-icon']} name={'edit'} />
                                    </button>
                                </React.Fragment>
                        }
                    </div>
                    <div className={styles['email-label-container']} title={profile.auth === null ? t('ANONYMOUS_USER') : profile.auth.user.email}>
                        <div className={styles['email-label']}>
                            {profile.auth === null ? t('ANONYMOUS_USER') : profile.auth.user.email}
                        </div>
                    </div>
                    <div className={styles['links-row']}>
                        <Link label={'Sync & backup'} onClick={() => openSync('export')} />
                        <Link label={'Import from Stremio'} onClick={() => openSync('stremio')} />
                        {
                            profile.auth !== null ?
                                <Link label={t('LOG_OUT')} onClick={onLogout} />
                                :
                                null
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default User;
