//! Dynamic-port binding (`bind_and_serve`): the socket is bound first and the
//! rest of the config is derived from the port we actually got.
//!
//! Three things must follow the real port, and each is checked here end to end:
//! the reported `local_addr`, `/settings.baseUrl` (the web client's "server is
//! up" gate and the URL handed to cast devices), and the SSRF self-port
//! exception in `support.rs` (`Policy::AllowSelf`), which is what lets
//! `/opensubHash` re-fetch a URL pointing back at our own loopback socket.

use std::net::SocketAddr;
use std::path::PathBuf;

use rillio_streaming_server::{bind_and_serve, Config};

/// A fresh cache dir per test so the engines never share state.
fn temp_app_path(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("rillio-dynport-{tag}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn config_on(tag: &str, port: u16) -> Config {
    let mut config = Config::local(temp_app_path(tag));
    config.bind = SocketAddr::from(([127, 0, 0, 1], port));
    config
}

/// Bind + start serving, returning the address the server actually got.
async fn start(config: Config) -> SocketAddr {
    let (addr, _engine, _router, fut) = bind_and_serve(config).await.unwrap();
    tokio::spawn(fut);
    addr
}

fn enc(s: &str) -> String {
    form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

#[tokio::test]
async fn port_zero_reports_a_real_port_and_serves_on_it() {
    let addr = start(config_on("zero", 0)).await;
    assert_ne!(addr.port(), 0, "local_addr must report the assigned port");

    // The reported port is the one actually accepting connections.
    let resp = reqwest::get(format!("http://127.0.0.1:{}/heartbeat", addr.port()))
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn settings_base_url_carries_the_actual_port() {
    let addr = start(config_on("baseurl", 0)).await;
    let settings: serde_json::Value =
        reqwest::get(format!("http://127.0.0.1:{}/settings", addr.port()))
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    assert_eq!(
        settings["baseUrl"],
        serde_json::json!(format!("http://127.0.0.1:{}", addr.port())),
        "baseUrl must advertise the bound port, not the default"
    );
}

#[tokio::test]
async fn occupied_port_falls_back_to_an_ephemeral_one() {
    // Hold a port, then ask the server for exactly it: the bind is refused
    // (AddrInUse) and must retry on :0 rather than fail the boot.
    let squatter = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .unwrap();
    let taken = squatter.local_addr().unwrap().port();

    let addr = start(config_on("fallback", taken)).await;
    assert_ne!(addr.port(), 0);
    assert_ne!(addr.port(), taken, "must not have stolen the occupied port");
    assert_eq!(addr.ip(), std::net::IpAddr::from([127, 0, 0, 1]));

    // And the fallback port is live + advertised.
    let settings: serde_json::Value =
        reqwest::get(format!("http://127.0.0.1:{}/settings", addr.port()))
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    assert_eq!(
        settings["baseUrl"],
        serde_json::json!(format!("http://127.0.0.1:{}", addr.port()))
    );

    drop(squatter);
}

/// The SSRF guard's self-port exception must follow the bound port.
///
/// `/opensubHash` reports its failure reason verbatim, which separates the two
/// cases cleanly: a blocked destination says so, while an allowed one gets far
/// enough to complain about the content itself. Pointing `videoUrl` at our own
/// `/heartbeat` on the ACTUAL port must be allowed (it fails later, on size);
/// pointing it at a different loopback port must still be blocked.
#[tokio::test]
async fn ssrf_self_port_follows_the_bound_port() {
    let addr = start(config_on("ssrf", 0)).await;
    let server = format!("http://127.0.0.1:{}", addr.port());

    // Sanity: the port is NOT the default, so a self-allow keyed to 11470 would
    // have blocked this.
    assert_ne!(addr.port(), 11470);

    let own = format!("{server}/heartbeat");
    let j: serde_json::Value = reqwest::get(format!("{server}/opensubHash?videoUrl={}", enc(&own)))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let err = j["error"].as_str().unwrap_or_default().to_owned();
    assert!(
        !err.contains("blocked destination"),
        "self loopback on the bound port must pass the SSRF guard, got: {err}"
    );
    assert!(
        err.contains("file too small"),
        "expected the guard to be passed and the fetch to proceed, got: {err}"
    );

    // A different loopback port is still a blocked destination.
    let other = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .unwrap();
    let other_port = other.local_addr().unwrap().port();
    let foreign = format!("http://127.0.0.1:{other_port}/media.bin");
    let j: serde_json::Value =
        reqwest::get(format!("{server}/opensubHash?videoUrl={}", enc(&foreign)))
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    let err = j["error"].as_str().unwrap_or_default().to_owned();
    assert!(
        err.contains("blocked destination"),
        "a non-self loopback port must stay blocked, got: {err}"
    );
}
