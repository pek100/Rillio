# Rillio

Local-first streaming app: a hard fork of Stremio (web UI + core) with its own
Rust streaming server and a Tauri v2 desktop shell. Windows-only for now.

## Layout

- `apps/web` - the React web app (webpack, CommonJS-heavy legacy + newer TS/Tailwind v4)
- `apps/desktop/src-tauri` - the Tauri shell (frameless window, embedded mpv player, updater)
- `crates/core` - forked stremio-core (Rust; profile/library/addons logic)
- `crates/core-web` - wasm bridge exposing the core to the web app (artifacts are gitignored build outputs)
- `crates/streaming-server` - the Rust torrent/streaming engine (librqbit), runs in-process in the shell
- `landing` - rillio.app landing page (static, deployed to Vercel)

## Build and run

```
pnpm build:wasm                 # rebuild the core wasm (needed after crates/core changes)
pnpm --filter rillio build      # build the web app into apps/web/build
cargo run                       # in apps/desktop/src-tauri: build + launch the desktop shell
```

The shell serves the static `apps/web/build`, so **rebuild the web app before
`cargo run`** to see web changes. `libmpv-2.dll` is not present next to the debug
binary, so playback is disabled under `cargo run` (harmless for UI work; the
release bundle ships the dll).

### Dev-loop gotcha: stale WebView2 cache (bites constantly)

Webpack prefixes asset URLs with the **git commit hash**, so rebuilding at the
same commit produces identical URLs and WebView2's service worker + HTTP cache
serve the OLD bundle - edits silently do not appear. Before each relaunch:

```powershell
Get-Process rillio-desktop -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$d = "$env:LOCALAPPDATA\com.rillio.desktop\EBWebView\Default"
foreach ($t in @('Service Worker','Cache','Code Cache')) { Remove-Item (Join-Path $d $t) -Recurse -Force -ErrorAction SilentlyContinue }
```

Production is unaffected (each release is a new commit, and the shell also
clears these caches when its version changes).

## Releases

Tag `v*` on main -> `.github/workflows/release.yml` builds, signs and publishes
a DRAFT GitHub release. Then, every release (until `bundle.targets` is switched
to nsis-only): download `latest.json`, point the `windows-x86_64` entry at the
NSIS `-setup.exe` (mirror url+signature from `windows-x86_64-nsis`), re-upload
with `--clobber`, publish with `gh release edit v<X> --draft=false --latest`,
and verify `/releases/latest/download/latest.json` + `RillioSetup.exe`.
Bump `version` in `apps/desktop/src-tauri/tauri.conf.json` before tagging.

The landing deploys from `landing/` with the Vercel CLI: `vercel build --prod`
then `vercel deploy --prebuilt --prod` (the remote build is flaky), then
`vercel alias set <deployment-url> rillio.app` (aliasing is NOT automatic).

## Conventions

- No em dashes anywhere (UI copy, commits, docs). Use commas, parentheses, or hyphens.
- Colors/spacing via semantic tokens only (`--color-*` in `apps/web/src/styles/tailwind.css`).
  Tailwind v4 rules there are load-bearing: utilities imported UNLAYERED and
  `@theme static` (see the comments in that file); keyframes live outside `@theme`.
- Flat, borderless UI: `divide-y` lists over nested cards, `rounded-full` pills,
  one accent color (#FFA033), hover via `brightness-110` or a bg tint.
- Root-cause fixes only; no silent fallbacks - fail loud.
- Windows dev: prefer PowerShell for shell commands (bash tooling misbehaves on
  the F: drive); write multi-line commit messages to a file and use `git commit -F`
  (embedded double quotes break `-m` arg passing from PowerShell).
