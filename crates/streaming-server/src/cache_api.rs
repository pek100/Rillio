//! Cache management API (Rillio-specific, not in the stremio server oracle):
//! list what's cached, keep ("download to cache" = add + pin), pin/unpin, and
//! delete. Backs the web app's Cached page and per-stream Download buttons.
//!
//! Trust model matches the rest of the server (see `security`): reads are GET,
//! every mutation is POST-only so a foreign page's `<img src>`/navigation (a
//! GET with no Origin) can never trigger one, and the Origin allowlist runs in
//! front of all of it.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::engine::Engine;
use crate::torrent::is_valid_infohash;

/// One cached torrent, as the Cached page renders it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheEntry {
    pub info_hash: String,
    pub name: String,
    /// Bytes actually downloaded (≈ on-disk weight).
    pub downloaded: u64,
    /// Total size of the selected files.
    pub total: u64,
    /// "initializing" | "live" | "paused" | "error".
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub pinned: bool,
    pub file_count: usize,
}

/// `GET /cache/list` - every torrent the engine manages (the session persists
/// across restarts, so this is the whole cache), biggest first.
pub(crate) async fn list(State(engine): State<Engine>) -> Json<Vec<CacheEntry>> {
    let mut entries: Vec<CacheEntry> = engine
        .all()
        .iter()
        .map(|handle| {
            let stats = handle.stats();
            let info_hash = Engine::info_hash_hex(handle);
            CacheEntry {
                pinned: engine.is_pinned(&info_hash),
                info_hash,
                name: handle.name().unwrap_or_default(),
                downloaded: stats.progress_bytes,
                total: stats.total_bytes,
                state: format!("{:?}", stats.state).to_lowercase(),
                error: stats.error.clone(),
                file_count: Engine::files(handle).len(),
            }
        })
        .collect();
    entries.sort_by(|a, b| b.downloaded.cmp(&a.downloaded));
    Json(entries)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadBody {
    info_hash: String,
    /// Optional: ensure this file is part of the download selection (a stream
    /// row knows which file it points at).
    file_idx: Option<usize>,
}

/// `POST /cache/download` - "download to cache": add-or-get the torrent, make
/// sure it is running and the requested file is selected, and PIN it so the
/// cache sweeper never evicts it.
pub(crate) async fn download(
    State(engine): State<Engine>,
    Json(body): Json<DownloadBody>,
) -> Response {
    if !is_valid_infohash(&body.info_hash) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let info_hash = body.info_hash.to_lowercase();
    let handle = match engine.get_or_create(&info_hash).await {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("cache/download add failed: {e:#}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    if let Some(idx) = body.file_idx {
        engine.select_file(&handle, idx).await;
    }
    engine.unpause(&handle).await;
    engine.touch(&info_hash);
    engine.set_pinned(&info_hash, true);
    Json(serde_json::json!({ "success": true })).into_response()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PinBody {
    info_hash: String,
    pinned: bool,
}

/// `POST /cache/pin` - toggle eviction protection.
pub(crate) async fn pin(State(engine): State<Engine>, Json(body): Json<PinBody>) -> Response {
    if !is_valid_infohash(&body.info_hash) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    engine.set_pinned(&body.info_hash.to_lowercase(), body.pinned);
    Json(serde_json::json!({ "success": true })).into_response()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteBody {
    info_hash: String,
}

/// `POST /cache/delete` - stop the torrent and delete its cached files.
pub(crate) async fn delete(State(engine): State<Engine>, Json(body): Json<DeleteBody>) -> Response {
    if !is_valid_infohash(&body.info_hash) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    engine.remove(&body.info_hash.to_lowercase()).await;
    Json(serde_json::json!({ "success": true })).into_response()
}
