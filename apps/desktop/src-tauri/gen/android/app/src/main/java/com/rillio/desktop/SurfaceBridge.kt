package com.rillio.desktop

import android.content.Context
import android.view.Surface

/**
 * JNI bridge to the Rust surface seam (src/surface.rs, `android` module).
 * MainActivity reports the video SurfaceView's lifecycle here; Rust holds the
 * Surface as a JNI global ref and hands its jobject pointer to libmpv as `wid`
 * (libmpv's Android backend does ANativeWindow_fromSurface on it internally).
 *
 * The Rust cdylib is loaded by generated/Rust.kt's `System.loadLibrary` in
 * Activity onCreate, before any Surface can exist, so these externals always
 * resolve by the time they are called.
 */
object SurfaceBridge {
    /** Captures the JavaVM + Application context on the Rust side (the ffmpeg
     * mediacodec/audiotrack JNI handoff). Call AFTER super.onCreate, which is
     * what loads the Rust cdylib. */
    @JvmStatic external fun onActivityCreated(appContext: Context)
    @JvmStatic external fun onSurfaceCreated(surface: Surface)
    @JvmStatic external fun onSurfaceDestroyed()
}
