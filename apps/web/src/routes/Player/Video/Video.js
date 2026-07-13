// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');

// Was routes/Player/Video/styles.less: the container is a bare passthrough; the
// inner div is the mpv playback surface (fills the container; its descendants
// inherit font-size). Ported to Tailwind on this component's own markup only - no
// logic, ref wiring or packages/video touched.
const Video = React.forwardRef(({ className, onClick, onDoubleClick }, ref) => {
    return (
        <div className={className} onClick={onClick} onDoubleClick={onDoubleClick}>
            <div ref={ref} className={'w-full h-full [&_*]:[font-size:inherit]'} />
        </div>
    );
});

Video.displayName = 'Video';

Video.propTypes = {
    className: PropTypes.string,
    onClick: PropTypes.func,
    onDoubleClick: PropTypes.func,
};

module.exports = Video;
