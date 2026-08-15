---
id: tier2-socket-free
tags: [streaming-server, shell, web, mpv, ipc, critical]
related_files: [crates/streaming-server/src/lib.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/mpv.rs, apps/desktop/src-tauri/src/shell.rs, packages/video/src/ShellVideo/ShellVideo.js, crates/core-web/src/env.rs]
status: complete
last_sync: 2026-08-15
---

Feature: Tier 2 socket-free unification

Design decisions (locked):
- D1: profile settings stay SYMBOLIC (default URL). The real port is resolved
  at the edge: a fetch rewrite in the core worker + one web helper. Nothing
  dynamic is ever persisted (kills landmines 1-3).
- D2: bind 11470 FIRST, fall back to :0 only when refused. Healthy machines see
  zero change; external-player deep links keep working except on fallback
  boots (web rewrites those at click time).
- D3: the wasm core keeps speaking HTTP (to the dynamic port, via D1 rewrite).
  Only apps/web + packages/video callers move to IPC. Core IPC is out of scope.
- D4: the HTTP server remains, bound lazily on whatever port it got: casting,
  external players, subtitles self-fetch, browser dev all keep it. It is no
  longer load-bearing for playback or the cache UI.
- D5: one release ships the whole arc (Michael's call). Windows verified live;
  Android must keep compiling, its wiring is a follow-up arc.

Tier2 socket-free unification
├── S1 server crate (owner: A1, files: crates/streaming-server/**)
│   ├── bind_and_serve(config) -> (SocketAddr, Engine, Router, serve future); patches bind+base_url from local_addr BEFORE router() ✓ atomic
│   ├── port strategy: try DEFAULT_PORT, on refusal bind :0 (log both) ✓ atomic
│   ├── serve() reimplemented over bind_and_serve (bin + tests unchanged) ✓ atomic
│   └── tests: port-0 bind reports real port; base_url + ssrf self_port follow it ✓ atomic
├── S2 mpv byte plane (owner: A2, files: mpv.rs + new stream_cb module + src-tauri tests; NOT shell.rs/lib.rs/thumbs.rs)
│   ├── FFI: mpv_stream_cb_info types + mpv_stream_cb_add_ro as Option (missing symbol = HTTP fallback, never load failure) ✓ atomic
│   ├── client_api_version gate helper ✓ atomic
│   ├── rillio:// URL: strict parse (40-hex ih + integer idx), format + parse helpers ✓ atomic
│   ├── cookie bridge: Handle<runtime> + librqbit FileStream; read/seek/size/close (+cancel); block_on from mpv thread only ✓ atomic
│   ├── open hook: engine.get_or_create + touch + tail-prefetch parity ✓ atomic
│   └── SPIKE (gate): headless mpv (vo=null,ao=null) plays + seeks a real cached file through the callbacks; observed evidence required ✓ atomic
├── S3 web + core edge (owner: A3, files: apps/web/**, packages/video/**, crates/core-web/**; NOT src-tauri)
│   ├── serverAddress module: shell handshake (invoke streaming_server_url, retry until up), symbolic settings untouched ✓ atomic
│   ├── serverFetch wrapper: fetch-shaped; invoke('server_request') in shell, real fetch elsewhere ✓ atomic
│   ├── swap apps/web callers to serverFetch (list in touchpoints.md) ✓ atomic
│   ├── swap packages/video callers (createTorrent, convertStream, fetchVideoParams, withStreamingServer) ✓ atomic
│   ├── core worker fetch rewrite: default-server-origin -> actual port (env.rs/worker.js bridge; ~10 lines) ✓ atomic
│   └── external-player link rewrite at click/href time (fallback-port boots) ✓ atomic
├── S4 integration (owner: B, files: src-tauri lib.rs/shell.rs/thumbs.rs + ShellVideo glue; runs AFTER S1-S3)
│   ├── start_streaming_server -> bind_and_serve; app.manage(ServerState{engine,router,base_url,port}) ✓ atomic
│   ├── streaming_server_url command (None until bound; web retries) ✓ atomic
│   ├── server_request command: router oneshot; method+path+body; preserve POST-only mutation discipline ✓ atomic
│   ├── allowlist: rillio:// via strict parser in shell.rs validate_stream_url + thumbs.rs copy + tests updated ✓ atomic
│   ├── loadfile path: register stream_cb protocol at player create; ShellVideo emits rillio://ih/idx when shell+torrent (create via IPC first); HTTP fallback when stream_cb unavailable ✓ atomic
│   └── thumbs shadow: keep HTTP URL (rewrite rillio:// back to http form for the shadow) ✓ atomic
└── S5 verification (owners: V1-V3, R1-R2; runs AFTER S4)
    ├── V1: cargo test streaming-server suite + new port tests ✓ atomic
    ├── V2: web build + tsc scoped + shell cargo test (allowlist tests) ✓ atomic
    ├── V3: live E2E over CDP: dynamic-port boot (forced fallback via netsh-blocked sim or env), Cache page over IPC, rillio:// playback of the complete cached episode w/ seek, casting gate intact (baseUrl non-null) ✓ atomic
    ├── R1: adversarial security review (landmines 4,10,9,11) ✓ atomic
    └── R2: adversarial correctness review (landmines 1,2,3,5,6,7,8,12) ✓ atomic

Atomic Units: every leaf above; checklist = checklists/tier2-socket-free.md
