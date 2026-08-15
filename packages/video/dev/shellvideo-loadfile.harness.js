// Behavior harness for the ShellVideo / withStreamingServer loadfile contract:
// which URL does the web player composition hand mpv, and how does it recover
// when the in-process byte plane refuses a load?
//
// Run with plain node (no test framework, no build step):
//
//     node packages/video/dev/shellvideo-loadfile.harness.js
//
// It instantiates the REAL withStreamingServer(withHTMLSubtitles(ShellVideo))
// composition with a fake shell IPC transport and a fake streaming-server edge
// (mirroring apps/web/src/common/videoServerContext.ts + serverAddress.ts:
// symbolic default origin, shell-resolved actual origin, bounded readiness
// wait), then reads back the `mpv-command loadfile` argv that came out.
// Exit code 0 = every scenario passed.

const path = require('path');
// Installed at packages/video/dev, so the package root is one level up; the
// fallback keeps the harness runnable from a scratch copy too.
const PKG = require('fs').existsSync(path.join(__dirname, '..', 'src', 'ShellVideo')) ?
    path.resolve(__dirname, '..')
    :
    'F:/Projects/Code/Rillio/packages/video';

// Minimal DOM for mediaCapabilities (probes <video>.canPlayType at import).
class HTMLElement {}
global.HTMLElement = HTMLElement;
const makeEl = () => Object.assign(new HTMLElement(), {
    canPlayType: () => '',
    style: {},
    classList: { add() {}, remove() {} },
    appendChild() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, querySelectorAll: () => [], querySelector: () => null,
    children: [],
});
global.window = {
    document: {
        createElement: () => makeEl(),
        getElementsByTagName: () => [],
    },
    MediaSource: undefined,
    navigator: { userAgent: 'node' },
};
global.document = global.window.document;
global.navigator = global.window.navigator;

const IH = '0123456789abcdef0123456789abcdef01234567';
// What profile settings say (the persisted SYMBOLIC default) vs where the
// server really bound on a fallback-port boot. Distinct on purpose: every url
// handed to mpv must carry the ACTUAL origin.
const SYMBOLIC_ORIGIN = 'http://127.0.0.1:11470';
const ACTUAL_ORIGIN = 'http://127.0.0.1:58549';

const serverContext = require(path.join(PKG, 'src/serverContext'));
const withStreamingServer = require(path.join(PKG, 'src/withStreamingServer'));
const withHTMLSubtitles = require(path.join(PKG, 'src/withHTMLSubtitles'));
const ShellVideo = require(path.join(PKG, 'src/ShellVideo'));

// ---------------------------------------------------------------------------
// The streaming-server edge, faked the way apps/web injects it.
// ---------------------------------------------------------------------------
const edge = {
    actualOrigin: ACTUAL_ORIGIN, // null = the shell handshake has not resolved
    pendingOrigin: null,         // what the handshake will resolve to, when delayed
    resolveDelayMs: 0,
    calls: [],
};

const startsWithOrigin = (url, origin) =>
    url.startsWith(origin) && (url.length === origin.length || /^[/?#]/.test(url[origin.length]));

const rewrite = (url) => {
    if (typeof url !== 'string' || edge.actualOrigin === null) return url;
    if (edge.actualOrigin === SYMBOLIC_ORIGIN) return url;
    if (!startsWithOrigin(url, SYMBOLIC_ORIGIN)) return url;
    return edge.actualOrigin + url.slice(SYMBOLIC_ORIGIN.length);
};

const isLocal = (url) => typeof url === 'string' && (
    startsWithOrigin(url, SYMBOLIC_ORIGIN) ||
    (edge.actualOrigin !== null && startsWithOrigin(url, edge.actualOrigin))
);

serverContext.setServerContext({
    resolveUrl: rewrite,
    resolveUrlWhenReady: (url) => {
        if (!isLocal(url)) return Promise.resolve(url);
        return new Promise((resolve) => setTimeout(() => {
            if (edge.pendingOrigin !== null) {
                edge.actualOrigin = edge.pendingOrigin;
                edge.pendingOrigin = null;
            }
            resolve(rewrite(url));
        }, edge.resolveDelayMs));
    },
    isLocalUrl: isLocal,
    // The streaming server, faked: /create answers a guessed file index; the
    // /hlsv2/probe reply is nonsense on purpose (canPlayStream then falls back
    // to the wrapped video's own answer, which for ShellVideo is "yes").
    fetch: (input, init) => {
        edge.calls.push(((init && init.method) || 'GET') + ' ' + String(input));
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ guessedFileIdx: 2 }),
        });
    },
});

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------
function makeIpc() {
    const sent = [];
    const handlers = {};
    return {
        sent,
        handlers,
        send: (method, args) => sent.push({ method, args }),
        on: (name, fn) => { handlers[name] = fn; },
        off: () => {},
    };
}

function loadfilesOf(ipc) {
    return ipc.sent
        .filter((s) => s.method === 'mpv-command' && s.args && s.args[0] === 'loadfile')
        .map((s) => s.args);
}

function handlerOr(ipc, name) {
    const fn = ipc.handlers[name];
    if (!fn) throw new Error('ShellVideo never subscribed to ' + name);
    return fn;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

// opts: { available, stream, expect, serverURL?, actualOrigin?, pendingOrigin?,
//         resolveDelayMs?, settleMs?, after? }
async function scenario(name, opts) {
    edge.actualOrigin = 'actualOrigin' in opts ? opts.actualOrigin : ACTUAL_ORIGIN;
    edge.pendingOrigin = opts.pendingOrigin !== undefined ? opts.pendingOrigin : null;
    edge.resolveDelayMs = opts.resolveDelayMs || 0;
    edge.calls.length = 0;

    const ipc = makeIpc();
    // Exactly the composition selectVideoImplementation builds in the shell.
    const Video = withStreamingServer(withHTMLSubtitles(ShellVideo));
    const video = new Video({ shellTransport: ipc, containerElement: makeEl() });
    video.on('error', () => {});

    const asked = ipc.sent.some((s) => s.method === 'rillio-stream-cb-query');

    if (opts.available !== null) {
        handlerOr(ipc, 'rillio-stream-cb')({ available: opts.available });
    }
    handlerOr(ipc, 'mpv-prop-change')({ name: 'mpv-version', data: '0.40.0' });

    video.dispatch({
        type: 'command',
        commandName: 'load',
        commandArgs: {
            stream: opts.stream,
            streamingServerURL: opts.serverURL || (SYMBOLIC_ORIGIN + '/'),
            time: 0,
            platform: 'windows',
            videoMode: null,
        },
    });

    // The capability-query timeout is 3s; wait past it for the "shell never
    // answers" case.
    await new Promise((r) => setTimeout(r, opts.settleMs || (opts.available === null ? 3600 : 400)));

    const argv = loadfilesOf(ipc)[0] || null;
    const actual = argv ? argv[1] : null;
    let ok = actual === opts.expect && asked;
    let afterNote = '';
    if (ok && typeof opts.after === 'function') {
        const verdict = await opts.after(ipc);
        ok = ok && verdict.ok;
        afterNote = '\n       after: ' + verdict.note;
    }
    console.log(
        (ok ? 'PASS' : 'FAIL') + ' | ' + name +
        '\n       queried=' + asked +
        '\n       loadfile=' + JSON.stringify(argv) +
        '\n       expected=' + JSON.stringify(opts.expect) +
        afterNote
    );
    return ok;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
(async () => {
    let allOk = true;
    const run = async (name, opts) => { allOk = (await scenario(name, opts)) && allOk; };

    // The exact stream shape a Cache-page play produces: the core serializes
    // ConvertedStreamSource::Torrent as { url, infoHash, fileIdx, announce }
    // where url is built from the SYMBOLIC setting and query_pairs_mut leaves a
    // dangling '?' when there are no trackers. Observed live: loadfile
    // http://127.0.0.1:11470/<ih>/0? while the server sat on another port.
    const cacheStream = {
        url: SYMBOLIC_ORIGIN + '/' + IH + '/0?',
        infoHash: IH,
        fileIdx: 0,
        announce: [],
    };

    // BLOCKER 1: the byte plane must win for the local server's own stream
    // route even when the url is the core-built symbolic-origin '?' form.
    await run('B1: cache play (core-built ?-url, fileIdx 0) -> rillio://', {
        available: true,
        stream: cacheStream,
        expect: 'rillio://' + IH + '/0',
    });

    // BLOCKER 2: without the byte plane the SAME stream must fall back to the
    // RESOLVED origin, never the symbolic port.
    await run('B2: cache play without the byte plane -> http on the resolved port', {
        available: false,
        stream: cacheStream,
        expect: ACTUAL_ORIGIN + '/' + IH + '/0?',
    });

    // BLOCKER 2 (async): a load that fires BEFORE the address handshake
    // resolves must wait for it instead of emitting the symbolic port.
    await run('B2: load before the address resolves -> waits, then resolved port', {
        available: false,
        stream: cacheStream,
        actualOrigin: null,
        pendingOrigin: ACTUAL_ORIGIN,
        resolveDelayMs: 150,
        expect: ACTUAL_ORIGIN + '/' + IH + '/0?',
    });

    // fileIdx variants that must not lose the identity.
    await run('B1: fileIdx arrives as a string -> still rillio://', {
        available: true,
        stream: { url: SYMBOLIC_ORIGIN + '/' + IH + '/2?', infoHash: IH, fileIdx: '2' },
        expect: 'rillio://' + IH + '/2',
    });
    await run('B1: fileIdx missing, recovered from the url path -> rillio://', {
        available: true,
        stream: { url: SYMBOLIC_ORIGIN + '/' + IH + '/2?', infoHash: IH },
        expect: 'rillio://' + IH + '/2',
    });

    // A torrent stream (infoHash source, no url), shell reports the byte plane.
    await run('torrent {infoHash, fileIdx} + stream_cb available -> rillio://', {
        available: true,
        stream: { infoHash: IH, fileIdx: 2 },
        expect: 'rillio://' + IH + '/2',
    });

    // Same stream, shell says no: the http url, on the resolved origin.
    await run('torrent + stream_cb unavailable -> http on the resolved port', {
        available: false,
        stream: { infoHash: IH, fileIdx: 2 },
        expect: ACTUAL_ORIGIN + '/' + IH + '/2',
    });

    // A direct addon url must never become rillio://, even with the byte plane.
    await run('direct http stream + stream_cb -> http untouched', {
        available: true,
        stream: { url: 'https://cdn.example/movie.mkv' },
        expect: 'https://cdn.example/movie.mkv',
    });

    // An addon url that merely LOOKS like a stream route on another server.
    await run('foreign server stream route -> http untouched', {
        available: true,
        stream: { url: 'http://10.0.0.9:11470/' + IH + '/2' },
        expect: 'http://10.0.0.9:11470/' + IH + '/2',
    });

    // R2: a REMOTE streaming server selected in Settings. Its stream route
    // matches torrentIdentity's url check, but swapping to rillio:// would make
    // the LOCAL engine download the torrent - identity must be withheld.
    await run('R2: remote server selected -> identity withheld, http on the remote', {
        available: true,
        stream: { infoHash: IH, fileIdx: 2 },
        serverURL: 'http://10.0.0.9:11470/',
        expect: 'http://10.0.0.9:11470/' + IH + '/2',
    });

    // R8: the server gives ?f=<name> priority over the numeric idx, so a
    // rillio://ih/idx swap could play a DIFFERENT file. Only ?tr= may ride.
    await run('R8: ?f= query outranks the idx -> stays http', {
        available: true,
        stream: { url: SYMBOLIC_ORIGIN + '/' + IH + '/2?f=Some.Other.File.mkv', infoHash: IH, fileIdx: 2 },
        expect: ACTUAL_ORIGIN + '/' + IH + '/2?f=Some.Other.File.mkv',
    });

    // A shell too old to answer the query must still play (HTTP, after the
    // timeout) instead of parking loadfile forever.
    await run('shell never answers the query -> http after timeout', {
        available: null,
        stream: { infoHash: IH, fileIdx: 2 },
        expect: ACTUAL_ORIGIN + '/' + IH + '/2',
    });

    // ORDERING: a magnet needs the /create POST (peer sources + a guessed file
    // index). It must land BEFORE the loadfile, so the torrent is in the engine
    // before mpv opens rillio://. The ?tr= query on the built url is dropped by
    // the byte plane, which is fine precisely because /create already carried
    // those trackers.
    await run('magnet -> create POST first, then rillio://', {
        available: true,
        stream: { url: 'magnet:?xt=urn:btih:' + IH + '&tr=http%3A%2F%2Ftracker.example%2Fannounce' },
        expect: 'rillio://' + IH + '/2',
        after: async () => {
            const createAt = edge.calls.findIndex((c) => c.startsWith('POST') && c.indexOf('/create') !== -1);
            return {
                ok: createAt === 0,
                note: 'create POST index=' + createAt + ' of ' + JSON.stringify(edge.calls),
            };
        },
    });

    // FALLBACK: a rillio:// load that fails (end-file with error; the shell
    // answers fast for an unknown torrent) retries ONCE over http. A failing
    // http retry surfaces the error instead of looping.
    await run('rillio:// load error -> ONE http retry, no loop', {
        available: true,
        stream: cacheStream,
        expect: 'rillio://' + IH + '/0',
        after: async (ipc) => {
            handlerOr(ipc, 'mpv-event-ended')({ error: 'loading failed' });
            await tick();
            const afterFirst = loadfilesOf(ipc);
            const retried = afterFirst.length === 2 &&
                afterFirst[1][1] === ACTUAL_ORIGIN + '/' + IH + '/0?';
            handlerOr(ipc, 'mpv-event-ended')({ error: 'loading failed' });
            await tick();
            const afterSecond = loadfilesOf(ipc);
            return {
                ok: retried && afterSecond.length === 2,
                note: 'loadfiles=' + JSON.stringify(afterSecond.map((a) => a[1])),
            };
        },
    });

    console.log(allOk ? '\nALL PASS' : '\nFAILURES');
    process.exit(allOk ? 0 : 1);
})();
