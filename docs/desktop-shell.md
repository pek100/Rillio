<!--
id: desktop-shell
tags: [shell, tauri, mpv, vlc, playback, roadmap, deferred]
status: deferred
last_sync: 2026-07-09
-->

# Desktop shell — decision & deferred plan

**Status: DEFERRED.** Not started until the streaming-server plan
(`checklists/streaming-server-rust.md`, M2–M6) is finished. Recorded here so the
direction is fixed and not re-litigated.

## Decision

Build a **new Tauri (Rust) host**, not a revival of the old Qt5 shell.

Rationale (full comparison in the session that produced this doc):
- The old `stremio-shell` is Qt5/C++ (EOL Chromium WebEngine), built for the **v4**
  web UI, and spawns `server.js`. "Reusing" it means porting Qt5→Qt6, rewiring
  v4→v5, swapping in our Rust server, and redoing code-signing — most of a rewrite,
  on a stack pointed away from this fork.
- A Tauri host is Rust-native, so it **embeds `crates/streaming-server` in-process**
  (the reason we built it as a library crate), ships a ~5–10 MB binary on the OS
  webview, and has official plugins for tray / updater / single-instance / deep links.

## Playback strategy (two tiers)

1. **Embedded libmpv — primary, in-app playback.** mpv (not VLC) is the pick:
   identical capability (HDR, 10-bit, every codec — both wrap FFmpeg) but a cleaner
   render/embed API and better-maintained Rust bindings (`libmpv2`). This is the one
   genuinely hard integration piece — libmpv via FFI, rendering into a native layer
   coordinated with the web UI's `ShellVideo` path. It gives full-format/HDR playback
   **inside** the app window.

2. **External player (VLC / mpv / iina / infuse / …) — fallback, "just in case."**
   Already supported by core: `ExternalPlayerLink` / `Settings::player_type`
   (`crates/core/src/deep_links/mod.rs:129-190`) generates a launch URL / `.m3u` that
   hands the stream to the user's installed player. Near-zero effort; playback happens
   in that player's own window. A legitimately popular mode, not a compromise.

Note on VLC: "using VLC's engine" (libVLC) offers no advantage over libmpv for
embedding and has weaker Rust bindings — so VLC is the *external-player* option, not
the embedded one. mpv is not derived from VLC; both are independent FFmpeg frontends.

## Rough phasing (when we start)

- Tauri host window loading the `apps/web` UI in the OS webview.
- Embed `crates/streaming-server` in-process (call `serve()`/`router()`), replacing
  the container/sidecar for desktop.
- Wire external-player launch first (trivial, full formats immediately).
- Then embed libmpv for in-app playback (the hard part).
- Tray, single-instance, updater, deep-link (`stremio://`) via Tauri plugins.
- OS-sandbox confinement for the ffmpeg/transcode subprocess (Tier 3 from M1.5).
