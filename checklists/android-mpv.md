# Android mpv player - checklist

<!--
id: android-mpv-checklist
tags: player, android, mpv, hdr, dolby-vision, priority-critical
related_files: apps/desktop/src-tauri/src/shell.rs, apps/desktop/src-tauri/src/surface.rs, apps/desktop/src-tauri/src/mpv.rs, apps/desktop/src-tauri/gen/android/
doc: docs/android-mpv/decomposition.md
status: in-progress
last_sync: 2026-07-17
-->

## A. libmpv.so for arm64-android
- [x] A1 Research DONE: **jarnedemeulemeester/libmpv-android v1.0.0** (Findroid's;
      mpv 0.41.0 / ffmpeg 8.1 / libplacebo 7.360.1 / libass). KEY FACT: libdovi is
      NOT needed - libplacebo's `dovi` reshaping is default-on and mpv's DV path
      only needs PL_HAVE_DOVI + ffmpeg>=5.1 (RPU parsed by ffmpeg's SW hevcdec).
      media-kit builds DISQUALIFIED (-Dlibplacebo=disabled). mpv-android
      buildscripts explicitly do NOT work under WSL2; custom-flag fallback = fork
      jarne's repo, GitHub Actions builds it.
- [x] A2 Flags verified from their buildscripts (dovi default-on, --enable-jni,
      mediacodec, libass, GLES; vulkan disabled => SDR output only, see E2).
      Binaries effectively GPL (same posture as the Windows libmpv-2.dll).
- [x] A3 .so set staged in jniLibs/arm64-v8a (libmpv + 7 ffmpeg libs +
      libc++_shared; libplayer.so skipped - our Rust client replaces it).
      jniLibs/**/*.so is GITIGNORED -> scripts/fetch-libmpv-android.ps1 restores
      on a fresh checkout. minSdk bumped 24 -> 26 (the prebuilt's floor).
- [x] A4 default_dll_path Android arm returns bare soname "libmpv.so" (linker
      namespace resolves from the APK lib dir).

## B. Surface behind the WebView
- [x] B1 MainActivity.kt overrides setContentView (intercepts wry's
      webview-as-content-view): FrameLayout[SurfaceView, WebView]; WebView made
      transparent via build_mobile_window .transparent(true).
- [x] B2 Surface delivered over JNI (SurfaceBridge.kt -> surface.rs android
      module). NOTE: mpv's Android wid = the **Surface jobject global ref**
      (mpv-android convention), NOT ANativeWindow* - libmpv calls
      ANativeWindow_fromSurface internally.
- [x] B3 surface.rs AndroidSurface arm (video_wid = stored jobject;
      composite_behind_ui = no-op, z-order fixed by view order).
- [ ] B4 Surface lifecycle: destroy currently just drops the global ref; telling
      a LIVE player to detach (wid=0) before release is still open (Activity
      pause during playback). MVP risk accepted; revisit before ship.
- [x] B5 platform.rs Android embed_video=true (gpu_blur stays false until D3).

## C. Controller wiring
- [x] C1 mpv::set_ffmpeg_java_vm(): av_jni_set_java_vm + (best-effort)
      av_jni_set_android_app_ctx from libavcodec.so via ndk-context, called in
      Controller::create before init, fail-loud. Deps: jni 0.21 + ndk-context 0.1
      (android-only table in Cargo.toml).
- [x] C2 Android profile: ao=audiotrack (hwdec stays web-driven; NOTE from
      research: **DV RPUs do NOT survive mediacodec** - DV titles need hwdec=no,
      SW decode; SDR/HDR10 can use hwdec=mediacodec. Per-title logic = E1 work).
- [x] C3 Windows-only opts (target-colorspace-hint*, icc-profile-auto) now
      #[cfg(windows)]; shared profile keeps vo=gpu-next,gpu + tone-mapping.
- [x] C4 NativePlayer::Mpv path is platform-neutral already; on Android with the
      .so present it constructs; missing .so -> shell_init ok:false (existing
      loud-fallback path).

## D. E2E SDR on emulator
- [ ] D1 1080p H.264 plays via existing shell_send bridge
- [ ] D2 pause/seek/tracks/subs work from the web UI
- [ ] D3 stats/snapshot/thumbs OK or cap-gated

## E. DV/HDR correctness
- [ ] E1 DV clip tone-maps on emulator; frame-diff vs Windows
- [ ] E2 HDR output mode on real HDR device (follow-up after SDR ships)

## F. Real device
- [ ] F1 4K HEVC mediacodec-copy perf on a real TV box
- [ ] F2 audio formats sanity (AC3/EAC3)

## Meta
- [ ] Update memory (android-tv-cross-platform.md): Media3 decision REVERSED -> libmpv
- [ ] Update docs/cross-platform-refactor.md wall-2 section to match
