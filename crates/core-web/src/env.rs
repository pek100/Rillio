use std::collections::HashMap;

use chrono::{offset::TimeZone, DateTime, Utc};
use futures::{future, Future, FutureExt, TryFutureExt};
use gloo_utils::format::JsValueSerdeExt;
use http::{Method, Request};
use serde::{Deserialize, Serialize};

use tracing::trace;

use wasm_bindgen::{prelude::wasm_bindgen, JsCast, JsValue};
use wasm_bindgen_futures::{spawn_local, JsFuture};
use web_sys::WorkerGlobalScope;

use rillio_core::runtime::{Env, EnvError, TryEnvFuture};

const UNKNOWN_ERROR: &str = "Unknown Error";

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(catch, js_namespace = ["self"])]
    async fn local_storage_get_item(key: String) -> Result<JsValue, JsValue>;
    #[wasm_bindgen(catch, js_namespace = ["self"])]
    async fn local_storage_set_item(key: String, value: String) -> Result<(), JsValue>;
    #[wasm_bindgen(catch, js_namespace = ["self"])]
    async fn local_storage_remove_item(key: String) -> Result<(), JsValue>;
    /// The streaming server's REAL address, or null until the shell has
    /// reported one. Defined at worker.js module scope, so it is always
    /// callable; see the comment there.
    #[wasm_bindgen(js_namespace = ["self"])]
    fn rillio_streaming_server_url() -> JsValue;
}

/// The symbolic streaming-server origin. Profile settings hold this (never a
/// dynamic port), so every server url the core builds starts with it.
const DEFAULT_STREAMING_SERVER_ORIGIN: &str = "http://127.0.0.1:11470";

/// Point a url built from the symbolic origin at wherever the server actually
/// bound. Anything else - a user-configured remote server, an addon, the
/// Stremio API - is left exactly as the core produced it. `actual` is None
/// until the shell has reported an address, in which case the symbolic default
/// stands, which is the right answer on every boot that got the port it asked
/// for.
fn rewrite_origin(url: String, actual: Option<String>) -> String {
    if !url.starts_with(DEFAULT_STREAMING_SERVER_ORIGIN) {
        return url;
    }
    // Only a path, query or fragment may follow the origin: a host that merely
    // starts the same way is a different host.
    let rest = &url[DEFAULT_STREAMING_SERVER_ORIGIN.len()..];
    if !(rest.is_empty() || rest.starts_with('/') || rest.starts_with('?') || rest.starts_with('#'))
    {
        return url;
    }
    match actual {
        Some(actual) => {
            let actual = actual.trim_end_matches('/');
            if actual.is_empty() || actual == DEFAULT_STREAMING_SERVER_ORIGIN {
                url
            } else {
                format!("{actual}{rest}")
            }
        }
        None => url,
    }
}

fn rewrite_streaming_server_url(url: String) -> String {
    let actual = rillio_streaming_server_url().as_string();
    rewrite_origin(url, actual)
}

#[cfg(test)]
mod rewrite_origin_tests {
    use super::rewrite_origin;

    fn actual() -> Option<String> {
        Some("http://127.0.0.1:54321".to_owned())
    }

    #[test]
    fn rewrites_a_symbolic_server_url() {
        assert_eq!(
            rewrite_origin("http://127.0.0.1:11470/settings".to_owned(), actual()),
            "http://127.0.0.1:54321/settings"
        );
    }

    #[test]
    fn rewrites_the_bare_origin_and_a_query() {
        assert_eq!(
            rewrite_origin("http://127.0.0.1:11470".to_owned(), actual()),
            "http://127.0.0.1:54321"
        );
        assert_eq!(
            rewrite_origin("http://127.0.0.1:11470/ab/0?tr=x".to_owned(), actual()),
            "http://127.0.0.1:54321/ab/0?tr=x"
        );
    }

    #[test]
    fn tolerates_a_trailing_slash_on_the_actual_url() {
        assert_eq!(
            rewrite_origin(
                "http://127.0.0.1:11470/settings".to_owned(),
                Some("http://127.0.0.1:54321/".to_owned())
            ),
            "http://127.0.0.1:54321/settings"
        );
    }

    #[test]
    fn leaves_everything_else_alone() {
        // No address reported yet.
        assert_eq!(
            rewrite_origin("http://127.0.0.1:11470/settings".to_owned(), None),
            "http://127.0.0.1:11470/settings"
        );
        // A user-configured remote server.
        assert_eq!(
            rewrite_origin("http://192.168.1.5:11470/settings".to_owned(), actual()),
            "http://192.168.1.5:11470/settings"
        );
        // An addon.
        assert_eq!(
            rewrite_origin("https://v3-cinemeta.strem.io/manifest.json".to_owned(), actual()),
            "https://v3-cinemeta.strem.io/manifest.json"
        );
        // A longer host that merely starts the same way.
        assert_eq!(
            rewrite_origin("http://127.0.0.1:114700/x".to_owned(), actual()),
            "http://127.0.0.1:114700/x"
        );
        // The server did get the port it asked for.
        assert_eq!(
            rewrite_origin(
                "http://127.0.0.1:11470/settings".to_owned(),
                Some("http://127.0.0.1:11470".to_owned())
            ),
            "http://127.0.0.1:11470/settings"
        );
    }
}

pub enum WebEnv {}

impl WebEnv {
    /// Sets panic hook, enables logging
    pub fn init() -> TryEnvFuture<()> {
        WebEnv::migrate_storage_schema()
            .inspect(|migration_result| trace!("Migration result: {migration_result:?}",))
            .boxed_local()
    }
}

impl Env for WebEnv {
    fn fetch<IN, OUT>(request: Request<IN>) -> TryEnvFuture<OUT>
    where
        IN: Serialize,
        for<'de> OUT: Deserialize<'de> + 'static,
    {
        let (parts, body) = request.into_parts();
        let url = rewrite_streaming_server_url(parts.uri.to_string());
        let method = parts.method.as_str();
        let headers = {
            let mut headers = HashMap::new();
            for (key, value) in parts.headers.iter() {
                let key = key.as_str().to_owned();
                let value = String::from_utf8_lossy(value.as_bytes()).into_owned();
                headers.entry(key).or_insert_with(Vec::new).push(value);
            }
            <JsValue as JsValueSerdeExt>::from_serde(&headers)
                .expect("WebEnv::fetch: JsValue from Headers failed to be built")
        };

        let body = match serde_json::to_string(&body) {
            Ok(ref body) if body != "null" && parts.method != Method::GET => {
                let js_value = JsValue::from_str(body);
                Some(js_value)
            }
            _ => None,
        };
        let mut request_options = web_sys::RequestInit::new();
        request_options
            .method(method)
            .headers(&headers)
            .body(body.as_ref());

        let request = web_sys::Request::new_with_str_and_init(&url, &request_options)
            .expect("request builder failed");

        let promise = global().fetch_with_request(&request);
        async move {
            let js_fut = JsFuture::from(promise);
            let resp = js_fut.await.map_err(|error| {
                tracing::error!(
                    "{:?}\n Method: {} Url: {} {body_nobody}",
                    error
                        .clone()
                        .dyn_into::<js_sys::Error>()
                        .map(|error| String::from(error.message()))
                        .unwrap_or_else(|_err| {
                            tracing::error!("Failed to dyn_into Js Error, use '{UNKNOWN_ERROR}'");
                            UNKNOWN_ERROR.to_owned()
                        }),
                    parts.method,
                    url,
                    body_nobody = if Method::GET == parts.method {
                        "".to_owned()
                    } else {
                        let body_content = body
                            .map(|js_value| js_value.as_string().unwrap_or_default())
                            .unwrap_or_default();

                        if body_content.is_empty() {
                            "\nNo JSON body".to_owned()
                        } else {
                            format!("\nBody: {}", body_content)
                        }
                    }
                );
                EnvError::Fetch(
                    error
                        .dyn_into::<js_sys::Error>()
                        .map(|error| String::from(error.message()))
                        .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                )
            })?;

            let resp = resp
                .dyn_into::<web_sys::Response>()
                .expect("WebEnv::fetch: Response into web_sys::Response failed to be built");
            // status check and JSON extraction from response.
            let resp = if ![200, 201].contains(&resp.status()) {
                return Err(EnvError::Fetch(format!(
                    "Unexpected HTTP status code {}",
                    resp.status(),
                )));
            } else {
                // Response.json() to JSON::Stringify

                JsFuture::from(
                    resp.text()
                        .expect("WebEnv::fetch: Response text failed to be retrieved"),
                )
                .map_err(|error| {
                    EnvError::Fetch(
                        error
                            .dyn_into::<js_sys::Error>()
                            .map(|error| String::from(error.message()))
                            .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                    )
                })
                .await
                .and_then(|js_value| {
                    js_value.dyn_into::<js_sys::JsString>().map_err(|error| {
                        EnvError::Fetch(
                            error
                                .dyn_into::<js_sys::Error>()
                                .map(|error| String::from(error.message()))
                                .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                        )
                    })
                })?
            };

            response_deserialize(resp)
        }
        .boxed_local()
    }

    fn get_storage<T>(key: &str) -> TryEnvFuture<Option<T>>
    where
        for<'de> T: Deserialize<'de> + 'static,
    {
        local_storage_get_item(key.to_owned())
            .map_err(|error| {
                EnvError::StorageReadError(
                    error
                        .dyn_into::<js_sys::Error>()
                        .map(|error| String::from(error.message()))
                        .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                )
            })
            .and_then(|value| async move {
                value
                    .as_string()
                    .map(|value| serde_json::from_str(&value))
                    .transpose()
                    .map_err(EnvError::from)
            })
            .boxed_local()
    }

    fn set_storage<T: Serialize>(key: &str, value: Option<&T>) -> TryEnvFuture<()> {
        let key = key.to_owned();
        match value {
            Some(value) => future::ready(serde_json::to_string(value))
                .map_err(EnvError::from)
                .and_then(|value| {
                    local_storage_set_item(key, value).map_err(|error| {
                        EnvError::StorageWriteError(
                            error
                                .dyn_into::<js_sys::Error>()
                                .map(|error| String::from(error.message()))
                                .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                        )
                    })
                })
                .boxed_local(),
            None => local_storage_remove_item(key)
                .map_err(|error| {
                    EnvError::StorageWriteError(
                        error
                            .dyn_into::<js_sys::Error>()
                            .map(|error| String::from(error.message()))
                            .unwrap_or_else(|_| UNKNOWN_ERROR.to_owned()),
                    )
                })
                .boxed_local(),
        }
    }

    fn exec_concurrent<F>(future: F)
    where
        F: Future<Output = ()> + 'static,
    {
        spawn_local(future)
    }

    fn exec_sequential<F>(future: F)
    where
        F: Future<Output = ()> + 'static,
    {
        spawn_local(future)
    }

    fn now() -> DateTime<Utc> {
        let msecs = js_sys::Date::now() as i64;
        let (secs, nsecs) = (msecs / 1000, msecs % 1000 * 1_000_000);
        Utc.timestamp_opt(secs, nsecs as u32)
            .single()
            .expect("Invalid timestamp")
    }

    #[cfg(debug_assertions)]
    fn log(message: String) {
        use tracing::info;

        info!("{message}");
        // web_sys::console::log_1();
    }
}

fn global() -> WorkerGlobalScope {
    js_sys::global()
        .dyn_into::<WorkerGlobalScope>()
        .expect("worker global scope is not available")
}

fn response_deserialize<OUT>(response: js_sys::JsString) -> Result<OUT, EnvError>
where
    for<'de> OUT: Deserialize<'de> + 'static,
{
    let response = Into::<String>::into(response);
    let mut deserializer = serde_json::Deserializer::from_str(response.as_str());

    // deserialize into the final OUT struct

    serde_path_to_error::deserialize::<_, OUT>(&mut deserializer)
        .map_err(|error| EnvError::Fetch(error.to_string()))
}

/// > One other difference is that the tests must be in the root of the crate,
/// > or within a pub mod. Putting them inside a private module will not work.
#[cfg(test)]
pub mod tests {
    wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

    use wasm_bindgen_test::wasm_bindgen_test;

    use rillio_core::{
        runtime::EnvError,
        types::{
            addon::ResourceResponse,
            api::{APIResult, CollectionResponse},
        },
    };

    use super::response_deserialize;

    #[wasm_bindgen_test]
    fn test_deserialization_path_error() {
        let json_string = serde_json::json!({
            "result": []
        })
        .to_string();
        let result = response_deserialize::<APIResult<Vec<String>>>(json_string.into());
        assert!(result.is_ok());

        // Bad ApiResult response, non-existing variant
        {
            let json_string = serde_json::json!({
                "unknown_variant": {"test": 1}
            })
            .to_string();
            let result = response_deserialize::<APIResult<CollectionResponse>>(json_string.into());

            assert_eq!(
                result.expect_err("Should be an error"),
                EnvError::Fetch("unknown variant `unknown_variant`, expected `error` or `result` at line 1 column 18".to_string()),
                "Message does not include the text 'unknown variant `unknown_variant`, expected `error` or `result` at line 1 column 18'"
            );
        }

        // Addon ResourceResponse error, bad variant values
        {
            let json_string = serde_json::json!({
                "metas": {"object_key": "value"}
            })
            .to_string();
            let result = response_deserialize::<ResourceResponse>(json_string.into());

            assert_eq!(
                result.expect_err("Should be an error"),
                EnvError::Fetch("invalid type: map, expected a sequence".to_string()),
                "Message does not include the text 'Cannot deserialize as ResourceResponse'"
            );
        }
    }
}
