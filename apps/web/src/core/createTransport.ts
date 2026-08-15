import Bridge from '@rillio/core-web/bridge';
import { getItem, setItem, removeItem } from 'rillio/common/profileStorage';
import { DEFAULT_SERVER_ORIGIN, getServerUrl, isServerUrlReady, subscribeServerUrl } from 'rillio/common/serverAddress';

// The wasm core's storage RPC resolves ['rillioStorage', ...] on window (see
// crates/core-web/src/worker.js): every core bucket read/write lands in the
// ACTIVE profile's namespace. Must exist before the worker's first storage
// call; defining it before the Bridge is constructed guarantees that.
(window as any).rillioStorage = { getItem, setItem, removeItem };

const worker = new Worker(`${process.env.COMMIT_HASH}/scripts/worker.js`);
const bridge = new Bridge(window, worker);

// Post-init dispatches must not race core startup: the wasm runtime only
// exists once `init` has resolved, so anything this module wants to dispatch
// on its own waits on this promise (set by the wrapped `init` below).
let resolveCoreInitialized: () => void;
const coreInitialized = new Promise<void>((resolve) => { resolveCoreInitialized = resolve; });

// On a fallback-port boot the core can probe /settings on the symbolic port
// BEFORE the address handshake resolves and the worker's fetch rewrite exists:
// connection refused, streamingServer.baseUrl stays null, and nothing ever
// re-probes - every playback then dies as UNSUPPORTED_STREAM. Once the real
// address has reached the worker, re-load the model exactly once so the probe
// runs again through the rewrite.
let streamingServerReloaded = false;
const reloadStreamingServerOnce = (): void => {
    if (streamingServerReloaded) return;
    streamingServerReloaded = true;
    coreInitialized
        .then(() => bridge.call(['dispatch'], [{ action: 'StreamingServer', args: { action: 'Reload' } }]))
        .catch((error: unknown) => console.error('createTransport: re-probing the streaming server after the address handshake failed', error));
};

// The core keeps speaking HTTP to the streaming server, but the url it builds
// comes from the SYMBOLIC setting (common/serverAddress explains why that must
// not hold a dynamic port), so the worker needs the real address to rewrite
// outgoing requests at its fetch edge (crates/core-web/src/env.rs). Push it now
// if the shell handshake already resolved, and again the moment it does.
const pushServerUrl = (url: string): void => {
    bridge.call(['setStreamingServerUrl'], [url])
        .then(() => {
            // Only a boot whose real address DIFFERS from the symbolic one can
            // have had its first probe die on the wrong port. The reload waits
            // for the rewrite to be in place (this then-chain), or the re-probe
            // would hit the symbolic port all over again.
            if (url.replace(/\/+$/, '') !== DEFAULT_SERVER_ORIGIN) reloadStreamingServerOnce();
        })
        .catch((error: unknown) => console.error('createTransport: handing the server address to the core worker failed', error));
};
if (isServerUrlReady()) pushServerUrl(getServerUrl());
subscribeServerUrl(pushServerUrl);

const createTransport = (): CoreTransport => {
    const init = (args: object): Promise<void> => {
        return bridge.call(['init'], [args]).then(() => {
            resolveCoreInitialized();
        });
    };

    const getState = (model: string): Promise<object> => {
        return bridge.call(['getState'], [model]);
    };

    const dispatch = (action: DispatchAction, model?: string): Promise<void> => {
        return bridge.call(['dispatch'], [action, model]);
    };

    const encodeStream = (stream: Stream): Promise<string> => {
        return bridge.call(['encodeStream'], [stream]);
    };

    const decodeStream = (stream: string): Promise<Stream> => {
        return bridge.call(['decodeStream'], [stream]);
    };

    return {
        init,
        getState,
        dispatch,
        encodeStream,
        decodeStream,
    };
};

export default createTransport;
