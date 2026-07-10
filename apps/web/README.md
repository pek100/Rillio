# Rillio web client

The React + TypeScript client for [Rillio](../../README.md). It is embedded into
the Tauri desktop app's WebView at build time (`frontendDist`), and the same app
also runs in a plain browser. See the repo root `README.md` for the full
architecture, prerequisites, and the desktop build.

## Build

```bash
pnpm install
pnpm start                     # webpack dev server
pnpm run build                 # production build -> apps/web/build
```

Editing the Rust core (`crates/core`) only changes the app after
`pnpm build:wasm` from the repo root rebuilds `@rillio/core-web`.

## License

GPLv2. See [LICENSE.md](LICENSE.md). This client is a fork of Stremio's
`stremio-web` (copyright 2017-2023 Smart code), retained under the same license.
