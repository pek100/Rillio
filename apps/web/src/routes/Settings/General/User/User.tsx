import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCore } from 'rillio/core';
import { useDisplayName } from 'rillio/common/useDisplayName';
import { openSync } from 'rillio/common/syncEvents';
import DisplayNameEdit from 'rillio/components/DisplayNameEdit';
import { Link } from '../../components';
import styles from './User.less';

type Props = {
    profile: Profile,
};

const User = ({ profile }: Props) => {
    const { t } = useTranslation();
    const core = useCore();
    const [displayName, setDisplayName] = useDisplayName();

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

    return (
        <div className={styles['user']}>
            <div className={styles['user-info-content']}>
                <div
                    className={styles['avatar-container']}
                    style={{ backgroundImage: avatar }}
                />
                <div className={styles['email-logout-container']}>
                    <DisplayNameEdit className={styles['name-row']} value={displayName} onCommit={setDisplayName} />
                    <div className={styles['email-label-container']} title={profile.auth === null ? t('ANONYMOUS_USER') : profile.auth.user.email}>
                        <div className={styles['email-label']}>
                            {profile.auth === null ? t('ANONYMOUS_USER') : profile.auth.user.email}
                        </div>
                    </div>
                    <div className={styles['links-row']}>
                        <Link label={'Sync & backup'} onClick={() => openSync('backup')} />
                        <Link label={'Import from Stremio'} onClick={() => openSync('stremio')} />
                        <Link label={'Upload to Stremio'} onClick={() => openSync('upload')} />
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
