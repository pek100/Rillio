# Cross-platform seams (Windows now, Android TV later)

Goal: make the Tauri shell select its native backends at runtime per device,
so an Android TV build reuses the Windows work as sibling implementations
rather than a fork. Phase 1 (this branch) extracts the seams on Windows with
ZERO behavior change. Phase 2 (later) adds the Android implementations behind
the same seams.

## The pattern (mirrored from TropxMotion's BLE factory)

TropxMotion picks its Bluetooth backend at runtime: `PlatformConfig.detectPlatform()`
returns a config (transport + strategy + timing + capability flags), a factory
(`createBleService`) constructs the right backend behind one interface
(`IBleService`), and a `NodeBleToNobleAdapter` normalizes the weaker backend to
the canonical vocabulary so the rest of the app speaks one language.

Rillio's Rust equivalent:

| TropX (JS, runtime import) | Rillio (Rust) |
| --- | --- |
| `IBleService` interface | `PlayerBackend` / `NativeSurface` / `HostPlatform` traits |
| `PlatformConfig.detectPlatform()` + capability flags | `platform::detect()` + `PlatformCaps` |
| `createBleService()` factory | `create_*` factory fns returning `Box<dyn Trait>` |
| noble backend (Windows/Mac) | libmpv backend (Windows) |
| node-ble backend (Linux) | Media3 backend (Android) [Phase 2] |
| `NodeBleToNobleAdapter` | `Media3` adapter emitting mpv-shaped props [Phase 2] |

Rust nuance: the trait gives runtime polymorphism (the "dynamic per device"
ask, calling code stays platform-agnostic via `Box<dyn Trait>`), while the
factory's construction is `#[cfg(target_os)]`-gated so only the backend the
target supports compiles. Interface = runtime; construction = compile-time.

## The seams

1. **`PlayerBackend`** (the mpv-shaped bridge contract). Canonical player
   interface the web `ShellVideo` talks to over `shell_send`/`shell-signal`.
   Windows impl = `MpvBackend` wrapping today's `Controller`. Capability-gated
   methods (blur, snapshot, scene-scan) have default no-op impls, matching
   TropX's feature flags. Android impl [Phase 2] = Media3 behind the same trait.

2. **`NativeSurface`** (render target + compositing). Formalize the already
   `#[cfg]`-stubbed `main_window_wid()` + `composite_behind_webview()` into one
   trait: acquire an opaque surface, composite it behind the WebView. This is
   the single genuinely-hard-per-platform concern; isolating it keeps the ~2000
   lines of shared player logic platform-free.

3. **`HostPlatform`** (lifecycle). Quarantine the WebView2 cache clearing,
   updater, profile-lock poll, and in-exe-folder cache (~400 lines in lib.rs)
   behind a trait so Android supplies `getFilesDir` cache + Play/APK update as a
   sibling instead of `#cfg`-ing each function. Mostly "delete on Android" code.

4. **Input source** (web, TS). Normalize Web-Gamepad events and Android-TV
   D-pad key events into the one `direction` dispatch `services/GamepadNavigation`
   already consumes. Plus an `'android'` arm in `packages/video/src/platform.js`.

## Phase 1: DONE (Windows, behavior byte-identical, verified with real playback)

- [x] `platform.rs`: `Platform::detect()` + `PlatformCaps` (embed_video, gpu_blur,
      signed_updater, webview2_cache). Windows caps = today's values.
- [x] `surface.rs`: `NativeSurface` trait + `create()` factory + `WindowsSurface`
      (HWND wid + z-order compositing), moved out of shell.rs. Non-Windows =
      `NoSurface`. shell.rs calls the trait.
- [x] `shell.rs`: `NativePlayer` enum (the Rust-idiomatic factory for a closed
      backend set; `Mpv` variant today, `Android` Media3 later). `ShellState`
      holds it; `shell_send` / stats / snapshot / blur route through it. Security
      allowlists stay in `shell_send` (backend-agnostic); the loadfile/stop
      normalization moved into `Controller::run_command`.
- [x] Host-lifecycle seam (lighter than a full trait: the updater is
      data-loss-adjacent, not worth the risk): the WebView2 stale-cache sweep is
      gated on `PlatformCaps::webview2_cache` in lib.rs. The updater command and
      the in-exe cache dir are already Windows-shaped and simply not invoked on a
      store-updated / scoped-storage host. `default_cache_dir` already falls back
      to `app_data_dir` when the exe folder is not writable (Android scoped
      storage), so it ports as-is.
- [x] Verified: cargo build + 16/16 tests green; launched the shell, drove
      `loadfile` on the cached 4K DV/HDR Silo file, confirmed real HEVC 3840x1606
      decode, mpv embedding + `composite mpv behind WebView`, and `player.stats()`
      through the enum. Byte-identical Windows behavior.

Web-side seams moved to Phase 2 (they need the Android runtime to be meaningful;
inert untested code now would be speculative): the D-pad input source in
`GamepadContext` (Android remote key events -> the existing spatial-nav
`direction` dispatch) and the `'android'` arm in `packages/video/src/platform.js`
(VO / player selection) both land when the Android player exists to test against.

## Phase 2 (Android TV, separate branch, later)

Android impls behind each trait: `AndroidSurface` (SurfaceView), `Media3Backend`
(ExoPlayer, DV/HDR gated on `Display.getHdrCapabilities()`), `AndroidHost`
(scoped storage + Play update). Cross-compile streaming server to
aarch64-linux-android (switch `default-tls` -> rustls). Leanback manifest.
D-pad key events into the input seam. Then CI/CD (NDK + keystore + arm64 AAB).
See the research in the session that produced this doc; DV Profile 7 degrades to
HDR10 on nearly all TV hardware (honest caveat).
