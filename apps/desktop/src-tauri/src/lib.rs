//! Stremio desktop shell (Tauri v2).
//!
//! S0: a WebView2 window hosting the `apps/web` client. Later stages embed the
//! Rust streaming server in-process (S1), wire external-player launch (S2),
//! and integrate libmpv for in-app playback (S3).

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running the Stremio desktop shell");
}
