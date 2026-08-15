// Where the local streaming server really is, as far as this package is
// concerned.
//
// Every url in withStreamingServer is derived from the `streamingServerURL`
// load argument, which is the SYMBOLIC value the core persists in profile
// settings. The desktop shell binds the server on a dynamic port and can answer
// requests in-process over IPC, so the host app injects the two things needed
// to reach the real one:
//
//   resolveUrl(url) - the symbolic server url mapped to the real one
//   resolveUrlWhenReady(url) - the same mapping, but as a promise that WAITS
//       (bounded) for the shell's address handshake first. The sync form
//       returns the url unmapped while the handshake is still pending, which
//       must never leak into something handed to mpv or another process.
//   isLocalUrl(url) - whether the url targets the IN-PROCESS server (the
//       symbolic default origin or the shell-resolved actual origin). Only
//       then may a stream route be swapped for the rillio:// byte plane; a
//       user-configured remote server must keep speaking http.
//   fetch(input, init) - the transport those urls should be requested over
//
// Nothing injected (the browser build, tests, a bare require of this package)
// means the identity mapping and the global fetch, i.e. exactly the old
// behaviour.

var context = {
    resolveUrl: null,
    resolveUrlWhenReady: null,
    isLocalUrl: null,
    fetch: null
};

function setServerContext(next) {
    context.resolveUrl = next && typeof next.resolveUrl === 'function' ? next.resolveUrl : null;
    context.resolveUrlWhenReady = next && typeof next.resolveUrlWhenReady === 'function' ? next.resolveUrlWhenReady : null;
    context.isLocalUrl = next && typeof next.isLocalUrl === 'function' ? next.isLocalUrl : null;
    context.fetch = next && typeof next.fetch === 'function' ? next.fetch : null;
}

function resolveServerUrl(streamingServerURL) {
    if (typeof streamingServerURL !== 'string' || context.resolveUrl === null) {
        return streamingServerURL;
    }

    return context.resolveUrl(streamingServerURL);
}

function resolveServerUrlWhenReady(streamingServerURL) {
    if (typeof streamingServerURL !== 'string' || context.resolveUrlWhenReady === null) {
        return Promise.resolve(resolveServerUrl(streamingServerURL));
    }

    return context.resolveUrlWhenReady(streamingServerURL);
}

function isLocalServerUrl(streamingServerURL) {
    if (context.isLocalUrl === null) {
        // Nothing injected means one server: whatever the setting names IS the
        // local one, exactly the pre-shell behaviour.
        return true;
    }

    return typeof streamingServerURL === 'string' && context.isLocalUrl(streamingServerURL) === true;
}

function serverFetch(input, init) {
    if (context.fetch !== null) {
        return context.fetch(input, init);
    }

    return fetch(input, init);
}

module.exports = {
    setServerContext: setServerContext,
    resolveServerUrl: resolveServerUrl,
    resolveServerUrlWhenReady: resolveServerUrlWhenReady,
    isLocalServerUrl: isLocalServerUrl,
    fetch: serverFetch
};
