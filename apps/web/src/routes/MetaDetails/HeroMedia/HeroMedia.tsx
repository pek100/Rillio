// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import classnames from 'classnames';
import styles from './styles.less';

type Props = {
    className?: string,
    ytId?: string | null,
    background?: string | null,
    poster?: string | null,
    name?: string,
};

// The hero's 16:9 media panel, beside the meta details. A trailer autoplays
// MUTED and loops, using YouTube's own player chrome -- overlaying our controls
// on top of theirs fought their UI. Unmuting is YouTube's speaker button.
// Falls back to the backdrop, then the poster.
//
// Note: the privacy-enhanced youtube-nocookie host sends no session cookies, so
// YouTube's anti-bot check challenges it more readily (especially from a VPN or
// datacenter IP). Swap to www.youtube.com if that ever becomes intolerable.
const HeroMedia = ({ className, ytId, background, poster, name }: Props) => {
    const still = background || poster || null;
    const trailerSrc = ytId
        ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${ytId}&iv_load_policy=3`
        : null;

    return (
        <div className={classnames(className, styles['hero-media'])}>
            {
                trailerSrc ?
                    <iframe
                        className={styles['trailer']}
                        src={trailerSrc}
                        title={name || 'Trailer'}
                        allow={'autoplay; encrypted-media; picture-in-picture'}
                        allowFullScreen
                    />
                    :
                    still ?
                        <img className={styles['still']} src={still} alt={name || ''} />
                        :
                        <div className={styles['still-empty']} />
            }
        </div>
    );
};

export default HeroMedia;
