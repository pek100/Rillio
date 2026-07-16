//! Native render-surface seam: acquiring the video output surface and
//! compositing it behind the WebView. This is the single genuinely-hard-per-
//! platform concern, isolated here so the ~2000 lines of shared player logic in
//! shell.rs stay platform-free.
//!
//! Mirrors TropxMotion's transport seam: a trait (`NativeSurface`) with a
//! factory (`create`) that returns the implementation for the running platform.
//! Windows embeds mpv into the main window's HWND and z-orders it behind the
//! WebView; a platform without embedding returns `NoSurface` and the player
//! opens its own output window. The interface is a trait object (calling code
//! stays platform-agnostic); construction is `#[cfg]`-gated so only the target's
//! backend compiles.

use tauri::AppHandle;

/// The two per-platform operations the player needs from the windowing system.
pub trait NativeSurface: Send + Sync {
    /// An opaque window handle (mpv `wid`) to render the video into, or `None`
    /// to let the player open its own output window.
    fn video_wid(&self, app: &AppHandle) -> Option<isize>;
    /// Push the player's output behind the WebView so the UI overlays it.
    /// A no-op where the player owns its own window.
    fn composite_behind_ui(&self, app: &AppHandle);
}

/// The surface backend for the running platform (the `createBleService`
/// analogue). Construction is compile-time per target; the returned trait
/// object keeps callers platform-free.
pub fn create() -> Box<dyn NativeSurface> {
    #[cfg(windows)]
    {
        Box::new(WindowsSurface)
    }
    #[cfg(target_os = "android")]
    {
        Box::new(AndroidSurface)
    }
    // Everything else embeds nothing and lets the player open its own window.
    #[cfg(not(any(windows, target_os = "android")))]
    {
        Box::new(NoSurface)
    }
}

/// No embedding: the player opens its own output window; nothing to composite.
#[cfg(not(any(windows, target_os = "android")))]
struct NoSurface;
#[cfg(not(any(windows, target_os = "android")))]
impl NativeSurface for NoSurface {
    fn video_wid(&self, _app: &AppHandle) -> Option<isize> {
        None
    }
    fn composite_behind_ui(&self, _app: &AppHandle) {}
}

/// Android: mpv renders into a `SurfaceView` that MainActivity.kt places
/// UNDERNEATH the transparent WebView (FrameLayout child order), the analog of
/// the Windows HWND z-order compositing. The `wid` is the `android.view.Surface`
/// jobject (held as a JNI global ref by [`android`]) - libmpv's Android backend
/// takes that jobject pointer as `wid` and does ANativeWindow_fromSurface on it
/// internally (the mpv-android convention).
#[cfg(target_os = "android")]
struct AndroidSurface;

#[cfg(target_os = "android")]
impl NativeSurface for AndroidSurface {
    /// The Surface's jobject pointer, once MainActivity has delivered it over
    /// JNI. `None` until surfaceCreated fires (the player init path treats that
    /// as "no embedding yet" and fails loud on loadfile, never half-renders).
    fn video_wid(&self, _app: &AppHandle) -> Option<isize> {
        android::current_wid()
    }

    /// No-op: z-order is fixed by view insertion order in MainActivity.kt
    /// (SurfaceView at index 0, WebView on top). Nothing to re-assert.
    fn composite_behind_ui(&self, _app: &AppHandle) {}
}

/// JNI receiving end of the Kotlin `SurfaceBridge` (MainActivity.kt owns the
/// SurfaceView and reports its lifecycle here). Kept in the surface seam module
/// because this IS the Android surface acquisition.
#[cfg(target_os = "android")]
pub mod android {
    use jni::objects::{GlobalRef, JClass, JObject};
    use jni::{JNIEnv, JavaVM};
    use std::sync::{Mutex, OnceLock};

    /// The video Surface, alive from surfaceCreated to surfaceDestroyed. A
    /// global ref: without one the jobject pointer dies with the JNI local
    /// frame and mpv would render into a dangling handle.
    static SURFACE: Mutex<Option<GlobalRef>> = Mutex::new(None);
    /// Captured from the first JNI call in (MainActivity.onCreate). ndk-context
    /// is NOT usable here: its singleton is never initialized in Tauri's mobile
    /// flow (tao/wry keep their own), and android_context() aborts the process.
    static JAVA_VM: OnceLock<JavaVM> = OnceLock::new();
    /// The Application context, for ffmpeg's av_jni_set_android_app_ctx.
    static APP_CONTEXT: OnceLock<GlobalRef> = OnceLock::new();

    /// The current Surface jobject as an mpv `wid`, if the SurfaceView is alive.
    pub fn current_wid() -> Option<isize> {
        SURFACE
            .lock()
            .unwrap()
            .as_ref()
            .map(|s| s.as_obj().as_raw() as isize)
    }

    /// Raw JavaVM pointer for ffmpeg's av_jni_set_java_vm.
    pub fn java_vm_ptr() -> Option<*mut std::ffi::c_void> {
        JAVA_VM
            .get()
            .map(|vm| vm.get_java_vm_pointer() as *mut std::ffi::c_void)
    }

    /// Application context jobject for av_jni_set_android_app_ctx.
    pub fn app_context_ptr() -> Option<*mut std::ffi::c_void> {
        APP_CONTEXT
            .get()
            .map(|c| c.as_obj().as_raw() as *mut std::ffi::c_void)
    }

    fn capture_vm(env: &JNIEnv) {
        if JAVA_VM.get().is_none() {
            match env.get_java_vm() {
                Ok(vm) => {
                    let _ = JAVA_VM.set(vm);
                }
                Err(e) => tracing::error!("android: GetJavaVM failed: {e}"),
            }
        }
    }

    #[no_mangle]
    extern "system" fn Java_com_rillio_desktop_SurfaceBridge_onActivityCreated(
        mut env: JNIEnv,
        _class: JClass,
        app_context: JObject,
    ) {
        capture_vm(&env);
        if APP_CONTEXT.get().is_none() {
            match env.new_global_ref(&app_context) {
                Ok(global) => {
                    let _ = APP_CONTEXT.set(global);
                }
                Err(e) => tracing::error!("android: app context global ref failed: {e}"),
            }
        }
        tracing::info!("android activity created (JavaVM captured)");
    }

    #[no_mangle]
    extern "system" fn Java_com_rillio_desktop_SurfaceBridge_onSurfaceCreated(
        mut env: JNIEnv,
        _class: JClass,
        surface: JObject,
    ) {
        capture_vm(&env);
        match env.new_global_ref(&surface) {
            Ok(global) => {
                tracing::info!("android surface created (wid ready)");
                *SURFACE.lock().unwrap() = Some(global);
            }
            Err(e) => tracing::error!("android surface: NewGlobalRef failed: {e}"),
        }
    }

    #[no_mangle]
    extern "system" fn Java_com_rillio_desktop_SurfaceBridge_onSurfaceDestroyed(
        _env: JNIEnv,
        _class: JClass,
    ) {
        // Drop the global ref. Detaching a LIVE player from a dying surface
        // (Activity pause) is wall-2 lifecycle work: the player must be told to
        // release the window BEFORE this ref goes away, or mpv renders into a
        // dead ANativeWindow. Tracked in checklists/android-mpv.md B4.
        tracing::info!("android surface destroyed");
        *SURFACE.lock().unwrap() = None;
    }
}

/// Windows: mpv renders into the main window's HWND (embedded) and is z-ordered
/// behind the transparent WebView so the UI overlays it.
#[cfg(windows)]
struct WindowsSurface;

#[cfg(windows)]
impl NativeSurface for WindowsSurface {
    /// The main window's HWND as an mpv `wid`, if in-window embedding is enabled
    /// (`RILLIO_EMBED_MPV`). Otherwise `None` -> mpv uses its own output window
    /// (the working default; see `lib::mpv_embed_enabled`).
    fn video_wid(&self, app: &AppHandle) -> Option<isize> {
        use tauri::Manager;
        if !crate::mpv_embed_enabled() {
            return None;
        }
        let window = app.get_webview_window("main")?;
        let hwnd = window.hwnd().ok()?;
        Some(hwnd.0 as isize)
    }

    /// Push mpv's embedded video child window to the bottom of the main window's
    /// z-order, so the (transparent-during-playback) WebView renders on top and
    /// its controls overlay the video. mpv registers its output window with
    /// class "mpv" as a child of the `wid` we gave it.
    fn composite_behind_ui(&self, app: &AppHandle) {
        use tauri::Manager;
        use windows::core::BOOL;
        use windows::Win32::Foundation::{HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumChildWindows, GetClassNameW, SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE,
        };

        let Some(window) = app.get_webview_window("main") else { return };
        let Ok(hwnd) = window.hwnd() else { return };

        unsafe extern "system" fn enum_cb(child: HWND, _: LPARAM) -> BOOL {
            let mut buf = [0u16; 32];
            let len = unsafe { GetClassNameW(child, &mut buf) };
            if len > 0 {
                let class = String::from_utf16_lossy(&buf[..len as usize]);
                if class == "mpv" {
                    let _ = unsafe {
                        SetWindowPos(
                            child,
                            Some(HWND_BOTTOM),
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        )
                    };
                }
            }
            BOOL(1)
        }

        unsafe {
            let _ = EnumChildWindows(Some(HWND(hwnd.0 as *mut _)), Some(enum_cb), LPARAM(0));
        }
        tracing::debug!("shell: composited mpv behind WebView");
    }
}
