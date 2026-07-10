// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import Icon from '@stremio/stremio-icons/react';
import styles from './styles.less';

const Button = require('rillio/components/Button').default;

const ROTATE_MS = 7000;

type Props = {
    className?: string,
    items: any[],
};

// A rotating, Netflix-style hero above the board's catalog rows. Fed by the
// first loaded catalog, it crossfades between backdrops every 7s, pauses while
// the pointer is over it, and can be driven by the arrows or the dots.
const HeroCarousel = ({ className, items }: Props) => {
    const { t } = useTranslation();
    const [index, setIndex] = React.useState(0);
    const [paused, setPaused] = React.useState(false);
    const count = items.length;

    React.useEffect(() => {
        if (count > 0 && index >= count) {
            setIndex(0);
        }
    }, [count, index]);

    React.useEffect(() => {
        if (paused || count <= 1) {
            return;
        }

        const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
        return () => clearInterval(id);
    }, [paused, count]);

    const goPrev = React.useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
    const goNext = React.useCallback(() => setIndex((i) => (i + 1) % count), [count]);
    const pause = React.useCallback(() => setPaused(true), []);
    const resume = React.useCallback(() => setPaused(false), []);

    if (count === 0) {
        return null;
    }

    const item = items[Math.min(index, count - 1)];
    const deepLinks = item.deepLinks || {};
    const watchHref = deepLinks.metaDetailsStreams || deepLinks.player || deepLinks.metaDetailsVideos || null;
    const infoHref = deepLinks.metaDetailsVideos || deepLinks.metaDetailsStreams || null;

    return (
        <div className={classnames(className, styles['hero-carousel'])} onMouseEnter={pause} onMouseLeave={resume}>
            <div className={styles['slides']}>
                {
                    items.map((it, i) => (
                        <img
                            key={it.id || i}
                            className={classnames(styles['backdrop'], { [styles['active']]: i === index })}
                            src={it.background || it.poster || ''}
                            alt={''}
                        />
                    ))
                }
            </div>
            <div className={styles['scrim']} />

            <div className={styles['content']}>
                {
                    typeof item.logo === 'string' && item.logo.length > 0 ?
                        <img className={styles['logo']} src={item.logo} alt={item.name} />
                        :
                        <div className={styles['title']}>{item.name}</div>
                }
                {
                    typeof item.description === 'string' && item.description.length > 0 ?
                        <div className={styles['description']}>{item.description}</div>
                        :
                        null
                }
                <div className={styles['actions']}>
                    {
                        watchHref ?
                            <Button className={styles['watch-button']} href={watchHref} title={t('WATCH_NOW')}>
                                <Icon className={styles['icon']} name={'play'} />
                                <div className={styles['label']}>{t('WATCH_NOW')}</div>
                            </Button>
                            :
                            null
                    }
                    {
                        infoHref ?
                            <Button className={styles['info-button']} href={infoHref} title={t('MORE_INFO')}>
                                <div className={styles['label']}>{t('MORE_INFO')}</div>
                            </Button>
                            :
                            null
                    }
                </div>
            </div>

            {
                count > 1 ?
                    <React.Fragment>
                        <Button className={classnames(styles['arrow'], styles['prev'])} title={t('BUTTON_PREV')} onClick={goPrev}>
                            <Icon className={styles['arrow-icon']} name={'chevron-back'} />
                        </Button>
                        <Button className={classnames(styles['arrow'], styles['next'])} title={t('BUTTON_NEXT')} onClick={goNext}>
                            <Icon className={styles['arrow-icon']} name={'chevron-back'} />
                        </Button>
                        <div className={styles['dots']}>
                            {
                                items.map((it, i) => (
                                    <Button
                                        key={it.id || i}
                                        className={classnames(styles['dot'], { [styles['active']]: i === index })}
                                        title={it.name}
                                        onClick={() => setIndex(i)}
                                    />
                                ))
                            }
                        </div>
                    </React.Fragment>
                    :
                    null
            }
        </div>
    );
};

export default HeroCarousel;
