//! Stremio desktop shell (Tauri v2).
//!
//! S0: a WebView2 window hosting the `apps/web` client.
//! S1: the Rust streaming server runs in-process (no container/sidecar) — the
//! web client reaches it at http://127.0.0.1:11470 exactly as before.

use tauri::Manager;

/// Open a URL or file path in the OS default handler / native app (S2).
///
/// This is the desktop implementation of the web client's
/// `platform.openExternal`. Running in the trusted shell, it opens the target
/// directly (external player, torrent client, browser) instead of the browser's
/// `window.open` + safety-warning redirect.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("open_external({url}): {e}"))
}

/// Build and run the Tauri application.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            start_streaming_server(app.handle());
            build_main_window(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_external])
        .run(tauri::generate_context!())
        .expect("error while running the Stremio desktop shell");
}

/// Create the main window in code so we can intercept navigation: custom-scheme
/// links (`vlc://`, `mpv://`, `magnet:`, external-player deep links) are opened
/// in the OS/native app and the in-app navigation is cancelled (S2). Normal
/// http(s)/tauri navigations proceed in the WebView.
fn build_main_window(app: &tauri::App) -> tauri::Result<()> {
    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
        .title("Stremio")
        .inner_size(1280.0, 800.0)
        .resizable(true)
        .on_navigation(|url| {
            match url.scheme() {
                "http" | "https" | "tauri" | "data" | "blob" | "about" => true,
                _ => {
                    // External-player / torrent / other custom scheme.
                    if let Err(e) = open::that(url.as_str()) {
                        tracing::error!("failed to open external {url}: {e}");
                    }
                    false
                }
            }
        })
        .build()?;
    Ok(())
}

/// Spawn the embedded streaming server on Tauri's async (tokio) runtime. It
/// binds 127.0.0.1:11470 and owns the torrent cache under the app data dir.
fn start_streaming_server(app: &tauri::AppHandle) {
    let cache_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("streaming-server");
    if let Err(e) = std::fs::create_dir_all(&cache_dir) {
        tracing::error!("cannot create cache dir {cache_dir:?}: {e}");
    }
    let config = stremio_streaming_server::Config::local(cache_dir);
    tauri::async_runtime::spawn(async move {
        if let Err(e) = stremio_streaming_server::serve(config).await {
            tracing::error!("embedded streaming server exited: {e}");
        }
    });
}
