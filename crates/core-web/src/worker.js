const Bridge = require('./bridge');

const bridge = new Bridge(self, self);

// Where the local streaming server really is.
//
// The shell binds it on whatever port it can get, but the core's profile
// settings stay SYMBOLIC (the default http://127.0.0.1:11470) - a dynamic port
// must never be persisted. So the main thread pushes the real address here as
// soon as its handshake with the shell resolves (apps/web core/createTransport)
// and WebEnv::fetch reads it back through the getter to rewrite every outgoing
// request whose origin is the symbolic one (see src/env.rs).
//
// Both live at module scope rather than inside init(): the push must not have
// to wait for, or race with, core startup.
let streamingServerUrl = null;
self.rillio_streaming_server_url = () => streamingServerUrl;
self.setStreamingServerUrl = async (url) => {
    streamingServerUrl = typeof url === 'string' && url.length > 0 ? url : null;
};

self.init = async () => {
    // TODO remove the document shim when this PR is merged
    // https://github.com/cfware/babel-plugin-bundled-import-meta/pull/26
    self.document = {
        baseURI: self.location.href
    };
    // Storage goes through window.rillioStorage (apps/web common/profileStorage
    // via core/createTransport), which namespaces every key under the ACTIVE
    // profile. Never call window.localStorage directly from here: a raw key
    // would read/write the default profile regardless of which one is active.
    self.local_storage_get_item = async (key) => bridge.call(['rillioStorage', 'getItem'], [key]);
    self.local_storage_set_item = async (key, value) => bridge.call(['rillioStorage', 'setItem'], [key, value]);
    self.local_storage_remove_item = async (key) => bridge.call(['rillioStorage', 'removeItem'], [key]);
    const { default: initialize_api, initialize_runtime, get_state, get_debug_state, dispatch, decode_stream, encode_stream } = require('./rillio_core_web.js');
    self.getState = get_state;
    self.getDebugState = get_debug_state;
    self.dispatch = dispatch;
    self.decodeStream = decode_stream;
    self.encodeStream = encode_stream;
    await initialize_api(require('./rillio_core_web_bg.wasm'));
    await initialize_runtime((event) => bridge.call(['onCoreEvent'], [event]));
};
