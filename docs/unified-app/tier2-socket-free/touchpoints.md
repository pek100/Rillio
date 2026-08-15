---
id: tier2-socket-free-touchpoints
tags: [streaming-server, shell, web, mpv, ipc, critical]
related_files: [crates/streaming-server/src/lib.rs, crates/streaming-server/src/config.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/mpv.rs, apps/desktop/src-tauri/src/shell.rs, packages/video/src/withStreamingServer/createTorrent.js, crates/core-web/src/env.rs]
status: complete
last_sync: 2026-08-14
---

# Tier 2 touchpoint map (exploration ground truth, 2026-08-14)

Codebase survey for: (a) dynamic port, (b) mpv in-process bytes via
mpv_stream_cb_add_ro, (c) web control plane over Tauri IPC. Line numbers are
from the survey date; verify before editing.

## (a) Dynamic port

Where 11470 is produced:
- `crates/streaming-server/src/config.rs:28` `DEFAULT_PORT: u16 = 11470`; `Config::local` (36-56) sets `bind` and `base_url` from it.
- `crates/streaming-server/src/bin/serve.rs:27-34` shows the override template (RILLIO_SERVER_PORT patches BOTH bind and base_url).
- `apps/desktop/src-tauri/src/lib.rs:1040` shell uses `Config::local(cache_dir)` unmodified.
- `crates/core/src/constants.rs:90` `STREAMING_SERVER_URL` (no trailing slash) -> `crates/core/src/types/profile/settings.rs:13,76` persisted default.
- `apps/web/src/common/CONSTANTS.ts:4` `DEFAULT_STREAMING_SERVER_URL` (WITH trailing slash); `Settings/Streaming/URLsManager/Item.tsx:26,30` compares by string equality.

The missing seam: `crates/streaming-server/src/lib.rs:162-173` `serve()` owns Engine, Router, TcpListener and returns none of them; `listener.local_addr()` never read. Needed: a bind-first entry point that patches `config.bind`/`config.base_url` from `local_addr()` BEFORE `router(config, engine)` is called, and returns the addr plus the serve future (and the Engine + Router for IPC).

`base_url` consumers: exactly one - `routes.rs:58-62` `SettingsResponse.base_url`. Nothing else emits absolute URLs (create responses, local-addon manifest, hlsv2 probe, proxy rewrites, stream ?external redirect are all relative or URL-free).

`bind` has a second consumer: `support.rs:27-29` `Policy::AllowSelf { self_port: cfg.bind.port() }` (SSRF guard for /opensubHash + subtitles). Derived from config, so it follows the dynamic port IF config is patched before router construction.

No channel exists today to tell the web the port: `start_streaming_server` (lib.rs:1014-1055) only emits `streaming-server-error`. No initialization_script anywhere in src-tauri (verified). The main window build races the async server bind.

## (b) mpv stream_cb

- `apps/desktop/src-tauri/src/mpv.rs`: hand-declared FFI (16-35), `Mpv::load` 146-187 with a `sym!` macro that hard-fails on a missing symbol; `_lib: Library` kept alive as last field. Symbols list at 166-180. `mpv_stream_cb_add_ro` ABSENT. No production API-version gate (only a test asserts >= 2<<16). DLL discovery 442-466 (RILLIO_LIBMPV env -> exe dir -> crate dir).
- loadfile sites: `shell.rs:590-615` (player; URL pre-validated), `thumbs.rs:187` (the thumbnail SHADOW mpv - a second instance opening the same URL; own validate_url at 254-262), `lib.rs:416` (dev only).
- Allowlist: `shell.rs:275` MPV_COMMAND_ALLOWLIST, `shell.rs:1299-1307` `validate_stream_url` = http(s)-prefix only. Tests at shell.rs:1313-1359 assert av:// is rejected. thumbs.rs duplicates the rule.
- ShellVideo hands the URL: `packages/video/src/ShellVideo/ShellVideo.js:497-509` (`mpv-command loadfile <stream.url> [start=+N]`, mpv >= 0.39 uses the 5-arg form). `stream.url` built by `withStreamingServer/createTorrent.js:11` as `{base}/{ih}/{idx}?tr=...`.
- Server byte path being replaced: `crates/streaming-server/src/stream.rs` - `open_body` (188-194) wraps `Arc::clone(handle).stream(file_id)` = librqbit `FileStream` (AsyncRead + AsyncSeek; reads PARK until the covering piece verifies). Tail prefetch `spawn_tail_prefetch` (205-257, 8 MiB, deduped via `engine.mark_prefetch`). Engine API: `get_or_create` (waits metadata), `get`, `touch`, `files`. librqbit pinned `=8.1.1`.
- mpv stream_cb facts: callbacks are SYNCHRONOUS, called from mpv demuxer threads (blocking allowed and expected). Need read/seek/size/close (+optional cancel). A naive block_on deadlocks if invoked on a tokio worker; use a stored `tokio::runtime::Handle` and `block_on` from the mpv thread (never a worker). `mpv_terminate_destroy` calls close_fn; cookie lifetime must survive Mpv drop order.

## (c) IPC control plane

- Tauri commands registered at lib.rs:360-372; web calls via `getTauri()?.core?.invoke` (`apps/web/src/common/Platform/shell/isShell.ts:19`). CSP already allows ipc: origins. No streaming-server state is managed today; `serve(config)` swallows Engine and Router.
- Router IS shareable: `AppState { config, engine }` + `pub fn router(...) -> Router` (Clone). tower 0.5 already a dep -> `ServiceExt::oneshot` works.
- Full route inventory: settings, torrent-settings, network-info, device-info, casting, heartbeat, create, {ih}/create, removeAll, {ih}/remove, cache/{list,download,pin,pause,watched,select,meta,delete}, cache/files/{ih}, stats.json x3, proxy, opensubHash, subtitles.vtt/.srt, subtitlesTracks, tracks/{url}, yt/{id}, hlsv2/probe, local-addon/*, {ih}/{idx} stream.
- Web callers to reroute (fetch-shaped wrapper): packages/video (createTorrent.js:55, convertStream.js:15, fetchVideoParams.js:11,55,72, withStreamingServer.js:189,194,289,388) and apps/web (useActiveDownloads:30, useCacheDownload:38, useFasterDownloads:28,47, useCachedTorrents:52,75,106-149, useMetadataMatcher:49, TorrentFiles:58, Cached.tsx:192,200, useCachedStreams:41, Player.tsx:370, useNextEpisodePreload:255,297, useCacheMetadata:58, useStreamingModeWatched:40-43).
- The wasm core runs in a WORKER: `crates/core-web/src/env.rs:41-76` fetches via WorkerGlobalScope. No __TAURI__ there. Existing bridge pattern to copy: `worker.js:15-17` rillioStorage RPC + `apps/web/src/core/createTransport.ts:8-11`.
- Core's own server calls (crates/core/src/models/streaming_server.rs): settings GET/POST, casting, network-info, device-info, {ih}/create, create, stats, play_on_device, get-https. Fed from persisted `profile.settings.streaming_server_url`; ProfileChanged re-selects (243-268).

## What genuinely needs a real socket (keep it)

1. Chromecast: `Player.tsx:701-707` hands `streamingServer.baseUrl` (from /settings base_url) to the cast device; `play_on_device` POSTs absolute source URLs.
2. `streamingServer.baseUrl` is a GATE: falsy -> streamingServerURL null -> UNSUPPORTED_STREAM (withStreamingServer.js:267-273). /settings must keep returning a live base_url.
3. External-player deep links (crates/core deep_links: download/m3u URLs from settings URL) -> separate OS process.
4. The thumbnail shadow mpv (second instance; keep HTTP or register its own stream_cb).
5. /opensubHash + subtitles routes re-fetch the media URL over loopback, gated by self_port. A rillio:// video URL would be rejected by ssrf vet (http/https only) - fetchVideoParams must keep passing the HTTP form of the stream URL, not rillio://.
6. /proxy playlist rewrites produce absolute URLs the player fetches.

## Landmines (verification rubric)

1. SETTINGS PERSISTENCE TRAP: never write a dynamic port into profile settings (persisted; also ServerUrlsBucket accumulates every URL forever; Item.tsx treats the default string as undeletable). Resolution at the edge only.
2. Trailing-slash asymmetry: web constant has trailing slash, core constant does not; Item.tsx compares strings; url.resolve vs new URL semantics differ.
3. base_url gate (see above): stop populating it and every playback dies as UNSUPPORTED_STREAM.
4. Allowlist widening is a security decision: rillio:// must be strictly parsed (40-hex infohash + integer index, nothing else); av://, edl://, memory://, file:// stay blocked; update shell.rs tests + thumbs.rs copy.
5. sym! hard-fails: mpv_stream_cb_add_ro must load as Option with HTTP fallback, plus a real client_api_version gate.
6. block_on deadlock + cancel_fn semantics (see (b)).
7. Range/DLNA/?external contract lives only on the HTTP route - keep the route.
8. Tail prefetch parity: the stream_cb path must trigger spawn_tail_prefetch (or equivalent) and engine.touch, or Cues seeks race exactly as stream.rs:196-204 documents.
9. Removing the socket entirely would break opensubHash/subtitles self-fetch; socket stays.
10. IPC bypasses origin_guard: the server_request command is the new trust boundary; preserve POST-only mutation discipline; never forward arbitrary methods blindly.
11. Single-instance plugin stays (WebView2 profile reason), even though the port-collision reason goes away.
12. Stale docs/tests referencing 11470: README.md:82, checklists/streaming-server-rust.md:42,120 (the :120 tracksData.js claim is stale - file no longer exists), docs/streaming-server-rust specs, core unit tests hardcode the URL.
