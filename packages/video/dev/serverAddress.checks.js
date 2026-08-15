// Unit checks for apps/web/src/common/serverAddress.ts, the module that
// decides which urls count as "the local streaming server" (serverFetch's IPC
// gate and the rillio:// identity gate both delegate to it).
//
// Run with plain node (no test framework, no build step):
//
//     node packages/video/dev/serverAddress.checks.js
//
// apps/web has no JS test runner, so this script loads the REAL serverAddress.ts
// by transpiling it with the workspace's own typescript compiler and stubbing
// its two imports: CONSTANTS (the symbolic default url) and isShell (faked as a
// shell whose streaming_server_url command reports a fallback-port address).
// Exit code 0 = every check passed.
//
// Covers review findings R6 (the resolved actual origin must ALSO count as
// local, or fallback-port boots bypass IPC) and R7 (a bare startsWith accepts
// the userinfo trick http://127.0.0.1:11470@evil.example/).

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const REPO = fs.existsSync(path.join(__dirname, '..', 'src', 'ShellVideo')) ?
    path.resolve(__dirname, '..', '..', '..')
    :
    'F:/Projects/Code/Rillio';
const webRequire = createRequire(path.join(REPO, 'apps', 'web', 'package.json'));
const ts = webRequire('typescript');

const SYMBOLIC = 'http://127.0.0.1:11470/';
const ACTUAL = 'http://127.0.0.1:58549/';

const stubs = {
    'rillio/common/CONSTANTS': { DEFAULT_STREAMING_SERVER_URL: SYMBOLIC },
    'rillio/common/Platform/shell/isShell': {
        isShell: () => true,
        getTauri: () => ({
            core: {
                invoke: (command) => command === 'streaming_server_url' ?
                    Promise.resolve(ACTUAL)
                    :
                    Promise.reject(new Error('unexpected invoke: ' + command)),
            },
        }),
    },
};

function loadServerAddress() {
    const source = fs.readFileSync(path.join(REPO, 'apps', 'web', 'src', 'common', 'serverAddress.ts'), 'utf8');
    const js = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const module = { exports: {} };
    const localRequire = (name) => {
        if (stubs[name]) return stubs[name];
        throw new Error('serverAddress.ts grew an import this stub does not know: ' + name);
    };
    new Function('require', 'module', 'exports', 'console', js)(localRequire, module, module.exports, console);
    return module.exports;
}

const checks = [];
const check = (name, actual, expected) => {
    const ok = actual === expected;
    checks.push(ok);
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name +
        (ok ? '' : '\n       actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected)));
};

(async () => {
    const addr = loadServerAddress();

    // ---- before the handshake resolves ------------------------------------
    check('symbolic origin is local', addr.isLocalServerUrl('http://127.0.0.1:11470/cache/list'), true);
    check('symbolic origin, bare (no path)', addr.isLocalServerUrl('http://127.0.0.1:11470'), true);
    check('R7: userinfo trick is NOT local', addr.isLocalServerUrl('http://127.0.0.1:11470@evil.example/'), false);
    check('longer port is NOT local', addr.isLocalServerUrl('http://127.0.0.1:114700/x'), false);
    check('foreign host is NOT local', addr.isLocalServerUrl('http://10.0.0.9:11470/x'), false);
    check('R6: resolved origin unknown yet -> not local yet', addr.isLocalServerUrl('http://127.0.0.1:58549/x'), false);
    check('rewrite is identity before the handshake', addr.rewriteServerUrl('http://127.0.0.1:11470/a/b?'), 'http://127.0.0.1:11470/a/b?');

    // ---- resolve the handshake (fake shell reports the fallback port) ------
    await addr.whenServerUrlReady();
    check('handshake resolved to the actual address', addr.getServerUrl(), ACTUAL);

    check('R6: the RESOLVED actual origin is local too', addr.isLocalServerUrl('http://127.0.0.1:58549/ih/2'), true);
    check('symbolic origin still local after resolve', addr.isLocalServerUrl('http://127.0.0.1:11470/settings'), true);
    check('R7 still holds against the actual origin', addr.isLocalServerUrl('http://127.0.0.1:58549@evil.example/'), false);
    check('rewrite maps a symbolic stream route (keeps the dangling ?)',
        addr.rewriteServerUrl('http://127.0.0.1:11470/0123456789abcdef0123456789abcdef01234567/0?'),
        'http://127.0.0.1:58549/0123456789abcdef0123456789abcdef01234567/0?');
    check('R7: rewrite refuses the userinfo trick',
        addr.rewriteServerUrl('http://127.0.0.1:11470@evil.example/'),
        'http://127.0.0.1:11470@evil.example/');
    check('rewrite leaves a foreign server alone',
        addr.rewriteServerUrl('http://10.0.0.9:11470/ih/2'),
        'http://10.0.0.9:11470/ih/2');

    const allOk = checks.every(Boolean);
    console.log(allOk ? '\nALL PASS' : '\nFAILURES');
    process.exit(allOk ? 0 : 1);
})();
