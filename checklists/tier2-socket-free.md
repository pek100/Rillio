---
id: tier2-socket-free
tags: [streaming-server, shell, web, mpv, ipc, critical]
related_files: [crates/streaming-server/src/lib.rs, apps/desktop/src-tauri/src/lib.rs, apps/desktop/src-tauri/src/mpv.rs, apps/desktop/src-tauri/src/shell.rs, apps/desktop/src-tauri/src/stream_cb.rs, apps/web/src/common/serverAddress.ts, apps/web/src/common/serverFetch.ts, packages/video/src/ShellVideo/ShellVideo.js, packages/video/src/withStreamingServer/withStreamingServer.js]
status: complete
last_sync: 2026-08-15
---

# Tier 2 socket-free unification

Tree: docs/unified-app/tier2-socket-free/decomposition.md
Ground truth: docs/unified-app/tier2-socket-free/touchpoints.md
Evidence rule: an item is [x] only on OBSERVED evidence (test run / behavior
exercised). Compiles-only stays [ ] with a note.

## S1 server crate (agent A1)
- [x] bind_and_serve entry point (addr+engine+router+future; config patched pre-router) - V1: live bin bound, /settings baseUrl carried the actual port
- [x] 11470-first, :0 fallback - V1 live: WARN refusal pair (os error 10013, PermissionDenied branch) then ephemeral bind; unit test covers AddrInUse branch
- [x] serve() over bind_and_serve; bin/tests unchanged - V1: git status clean apart from lib.rs + new test; full suite green
- [x] tests: real port reported; base_url + ssrf self_port follow - tests/dynamic_port.rs 4/4; SSRF self-allow verified live on the dynamic port both directions

## S2 mpv byte plane (agent A2)
- [x] stream_cb FFI as Option + api-version gate - probe test printed exports + api on a real DLL; absent-symbol path proven
- [x] rillio:// strict parse/format helpers - rejects_everything_malformed + format_round_trips green
- [x] FileStream cookie bridge (read/seek/size/close/cancel, no worker block_on) - engine bridge test on a live FileStream; parked read cancelled ~300ms; tokio-worker guard test
- [x] open hook: get_or_create + touch + tail-prefetch parity - V4 live: tail-prefetch warmed 8 MiB on the real playback; FIX after review: absent torrent bounded at OPEN_ABSENT_TIMEOUT=15s (observed 15.0s, was 180s uncancellable)
- [x] SPIKE: headless play + seek through callbacks - opens=1 reads=22 bytes=1638400 seeks=3; NOTE: skips silently without RILLIO_LIBMPV; only an env-set run counts

## S3 web + core edge (agent A3)
- [x] serverAddress handshake module (no settings persistence) - V4: three boots, three different ports, page invoke matched each; profile setting stayed symbolic
- [x] serverFetch wrapper (invoke in shell, fetch elsewhere) - IPC cache page live with no socket on 11470; FIX after review: isLocalServerUrl covers resolved origin (R6) + origin-boundary guard kills userinfo trick (R7), dev/serverAddress.checks.js 14/14
- [x] apps/web callers swapped - V4 cache modal + settings over IPC on every boot
- [x] packages/video callers swapped - harness 14/14 incl. /create-before-loadfile ordering
- [x] core worker fetch rewrite to actual port - V4: worker getState streaming_server Ready on the bound origin; Settings shows Server Version live
- [x] external-player link rewrite on fallback boots - A3 evidence (32/32 module checks); not separately re-exercised in V4

## S4 integration (agent B)
- [x] ServerState managed; start_streaming_server -> bind_and_serve - V4 boot logs: bound + advertised on every boot
- [x] streaming_server_url command - V4: answered the real port on all three boots
- [x] server_request command (POST-only discipline preserved) - live: mutations POST-only, stream route + traversal refused; FIX after review: guard is decoded-first-segment-40-hex by exclusion (name/query/percent bypasses closed), ipc tests green
- [x] allowlist rillio:// + tests (shell.rs + thumbs.rs) - live negatives BLOCKED and logged; FIX after review: full loadfile argv shape validated (stream-record/sub-file/vf refused; all real ShellVideo forms accepted)
- [x] stream_cb registered at player create; ShellVideo emits rillio://; HTTP fallback - V4 HEADLINE: real Play emitted rillio:// on 3/3 boots, playback + seek + real frames; FIX for P0s: identity survives core-serialized streams (symbolic url + dangling '?'), mediaURL resolved before mpv, one-shot http retry on rillio failure (harness-proven)
- [x] thumbs shadow keeps HTTP - shadow-mapping tests green; FIX after V4 finding: thumbStreamUrl now rewritten to the bound origin (Player.tsx), controlled experiment proved thumbs work on the bound port and die on the symbolic one; wiring verified by composition + build, not re-exercised live

## S5 verification
- [x] V1 server crate suite green - 81 tests, 12 targets, 0 failed
- [x] V2 web build + tsc + shell tests green - build exit 0; tsc zero NEW errors in touched files (baseline documented); shell crate 38/38 after fixes
- [x] V3/V4 live E2E: dynamic port boot, IPC cache page, rillio:// playback + seek, baseUrl gate intact - V3 FAILED (2 P0s), fixes landed, V4 PASSED 3/3 boots; artifacts v4-devshell*.log, v4-boot*-frame*.jpg
- [x] R1 security review: no unresolved CONFIRMED findings - is_raw_stream_path bypass, loadfile argv injection, serverFetch userinfo trick: all fixed with tests
- [x] R2 correctness review: no unresolved CONFIRMED findings - remote-server seeding gate, ?f= selector divergence, core re-probe on late handshake, bounded open, double-resolution: all fixed (harness/unit); R4 re-probe additionally corroborated by V4 (no wedged boots from the arc)

## Follow-ups filed (outside this arc)
- Unfocused-window player wedge (pre-existing focus gate in useRouteFocused/useModelState) - root-caused in V4 boot 1, healed by focus; spawned as its own task
- The V3 wedge attribution: NOT the port work (proven by V4 instrumentation)
