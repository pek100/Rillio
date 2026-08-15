var url = require('url');
var magnet = require('magnet-uri');
var createTorrent = require('./createTorrent');

function buildProxyUrl(streamingServerURL, streamURL, requestHeaders, responseHeaders) {
    var parsedStreamURL = new URL(streamURL);
    var proxyOptions = new URLSearchParams();
    proxyOptions.set('d', parsedStreamURL.origin);
    Object.entries(requestHeaders).forEach(function(entry) {
        proxyOptions.append('h', entry[0] + ':' + entry[1]);
    });
    Object.entries(responseHeaders).forEach(function(entry) {
        proxyOptions.append('r', entry[0] + ':' + entry[1]);
    });
    return url.resolve(streamingServerURL, '/proxy/' + proxyOptions.toString() + parsedStreamURL.pathname) + parsedStreamURL.search;
}

// A usable file index out of whatever the stream carries: the core hands a
// number, but a decoded deep link (the Cache page round-trips streams through
// encodeStream/decodeStream) can deliver a digit string. null when unusable.
function toFileIdx(value) {
    if (typeof value === 'number' && isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
        return parseInt(value, 10);
    }
    return null;
}

// (infoHash, fileIdx) recovered from a stream-route url path ({base}/{ih}/{idx}),
// or null when the path is not one.
function parseStreamRoutePath(streamURL) {
    if (typeof streamURL !== 'string') {
        return null;
    }
    try {
        var parsed = new URL(streamURL);
        var parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length === 2 && /^[a-f0-9]{40}$/i.test(parts[0]) && /^-?\d+$/.test(parts[1])) {
            return { infoHash: parts[0].toLowerCase(), fileIdx: parseInt(parts[1], 10) };
        }
    } catch (_e) { /* unparsable URL */ }
    return null;
}

function convertStream(streamingServerURL, stream, seriesInfo, streamingServerSettings) {
    return new Promise(function(resolve, reject) {
        if (typeof stream.url === 'string') {
            if (stream.url.indexOf('magnet:') === 0) {
                var parsedMagnetURI;
                try {
                    parsedMagnetURI = magnet.decode(stream.url);
                    if (!parsedMagnetURI || typeof parsedMagnetURI.infoHash !== 'string') {
                        throw new Error('Failed to decode magnet url');
                    }
                } catch (error) {
                    reject(error);
                    return;
                }

                var sources = Array.isArray(parsedMagnetURI.announce) ?
                    parsedMagnetURI.announce.map(function(source) {
                        return 'tracker:' + source;
                    })
                    :
                    [];
                createTorrent(streamingServerURL, parsedMagnetURI.infoHash, null, sources, seriesInfo)
                    .then(function(torrent) {
                        resolve({ url: torrent.url, infoHash: torrent.infoHash, fileIdx: torrent.fileIdx });
                    })
                    .catch(function(error) {
                        reject(error);
                    });
            } else {
                var proxyStreamsEnabled = streamingServerSettings && streamingServerSettings.proxyStreamsEnabled;
                var proxyHeaders = stream.behaviorHints && stream.behaviorHints.proxyHeaders;
                var resolved;
                if (proxyStreamsEnabled || proxyHeaders) {
                    var requestHeaders = proxyHeaders && proxyHeaders.request ? proxyHeaders.request : {};
                    var responseHeaders = proxyHeaders && proxyHeaders.response ? proxyHeaders.response : {};
                    resolved = { url: buildProxyUrl(streamingServerURL, stream.url, requestHeaders, responseHeaders) };
                } else {
                    resolved = { url: stream.url };
                }
                // Propagate infoHash/fileIdx so fetchFilename can hit stats.json
                // instead of leaking the URL fragment as the filename, and so a
                // shell player can recognize its own engine's stream route.
                if (typeof stream.infoHash === 'string' && stream.infoHash.length > 0) {
                    resolved.infoHash = stream.infoHash.toLowerCase();
                    var fileIdx = toFileIdx(stream.fileIdx);
                    if (fileIdx === null) {
                        // The url path is the only other place the index lives
                        // (the core builds {base}/{ih}/{idx} urls). Only trust
                        // it when it names THIS stream's torrent.
                        var fromPath = parseStreamRoutePath(stream.url);
                        if (fromPath !== null && fromPath.infoHash === resolved.infoHash) {
                            fileIdx = fromPath.fileIdx;
                        }
                    }
                    if (fileIdx !== null) {
                        resolved.fileIdx = fileIdx;
                    }
                } else {
                    // Fallback for addons shipping pre-computed streaming-server URLs.
                    var recovered = parseStreamRoutePath(stream.url);
                    if (recovered !== null) {
                        resolved.infoHash = recovered.infoHash;
                        resolved.fileIdx = recovered.fileIdx;
                    }
                }
                resolve(resolved);
            }

            return;
        }

        if (typeof stream.infoHash === 'string') {
            createTorrent(streamingServerURL, stream.infoHash, stream.fileIdx, stream.announce, seriesInfo)
                .then(function(torrent) {
                    resolve({ url: torrent.url, infoHash: torrent.infoHash, fileIdx: torrent.fileIdx });
                })
                .catch(function(error) {
                    reject(error);
                });

            return;
        }

        reject(new Error('Stream cannot be converted'));
    });
}

module.exports = convertStream;
