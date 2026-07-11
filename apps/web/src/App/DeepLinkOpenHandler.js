// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const { usePlatform } = require('rillio/common');
const { parseDeepLink } = require('rillio/common/deepLinks');

// Handles OS deep links (stremio:// / rillio://) that the desktop shell forwards
// as the `deep-link-open` signal (apps/desktop src/lib.rs on_open_url). The URL
// is untrusted OS input, so parseDeepLink validates the scheme + route allowlist
// and detects addon-install links; anything it rejects is logged and ignored
// (no crash - in the spirit of the no-crash policy).
const DeepLinkOpenHandler = () => {
    const navigate = useNavigate();
    const { shell } = usePlatform();
    React.useEffect(() => {
        const onDeepLink = (url) => {
            const action = parseDeepLink(url);
            if (action === null) {
                console.warn('DeepLink', 'ignoring unrecognized deep link:', url);
                return;
            }
            if (action.type === 'addon') {
                // Same entry point as Addons.js: the `addon` query param opens the
                // addon-details / install modal for that transport url.
                navigate(`/addons?addon=${encodeURIComponent(action.transportUrl)}`);
            } else {
                navigate(action.path);
            }
        };

        shell.on('deep-link-open', onDeepLink);
        return () => shell.off('deep-link-open', onDeepLink);
    }, [shell, navigate]);
    return null;
};

module.exports = DeepLinkOpenHandler;
