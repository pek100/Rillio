package com.rillio.desktop

import android.os.Bundle
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity(), SurfaceHolder.Callback {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // After super: the Rust cdylib is loaded by the super chain (Rust.kt), and
    // the external below resolves against it.
    SurfaceBridge.onActivityCreated(applicationContext)
  }

  /**
   * wry hands the WebView over as the ENTIRE content view (its main_pipe calls
   * activity.setContentView(webView), dispatched virtually, so this override
   * intercepts it). Interpose the video surface UNDERNEATH:
   *
   *   FrameLayout [ SurfaceView (video, index 0), WebView (UI, on top) ]
   *
   * This is the Android analog of the Windows HWND z-order compositing in
   * src/surface.rs: libmpv renders into the SurfaceView while the transparent
   * WebView (build_mobile_window sets transparent(true)) overlays the UI.
   * Lifecycle goes to Rust via SurfaceBridge.
   */
  override fun setContentView(view: View?) {
    if (view is WebView) {
      val frame = FrameLayout(this)
      val match = FrameLayout.LayoutParams.MATCH_PARENT
      val videoSurface = SurfaceView(this)
      videoSurface.holder.addCallback(this)
      frame.addView(videoSurface, FrameLayout.LayoutParams(match, match))
      frame.addView(view, FrameLayout.LayoutParams(match, match))
      super.setContentView(frame)
    } else {
      super.setContentView(view)
    }
  }

  override fun surfaceCreated(holder: SurfaceHolder) {
    SurfaceBridge.onSurfaceCreated(holder.surface)
  }

  // Size changes do not re-deliver the Surface; mpv tracks the ANativeWindow's
  // own size. (mpv-android additionally forwards android-surface-size for
  // pre-layout accuracy; wire that up if letterboxing misbehaves.)
  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}

  override fun surfaceDestroyed(holder: SurfaceHolder) {
    SurfaceBridge.onSurfaceDestroyed()
  }
}
